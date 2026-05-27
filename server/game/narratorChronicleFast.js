const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCleanSafe');
const { NARRATION_CONFIG } = require('./chronicleV5NarrationConfigSafe');

function buildEndpointCandidates(apiBaseUrl, pathSuffix) {
  const trimmed = String(apiBaseUrl || '').replace(/\/$/, '');
  const normalizedSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  const candidates = [];

  if (trimmed.endsWith('/v1')) {
    candidates.push(trimmed + normalizedSuffix);
    candidates.push(trimmed.slice(0, -3) + normalizedSuffix);
  } else {
    candidates.push(trimmed + '/v1' + normalizedSuffix);
    candidates.push(trimmed + normalizedSuffix);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function isHtmlResponse(response, previewText) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) return true;
  return /<!doctype html|<html/i.test(previewText || '');
}

function withTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout:${timeoutMs}`)), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

async function readChunkWithTimeout(reader, timeoutMs) {
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`idle-timeout:${timeoutMs}`)), timeoutMs);
    })
  ]);
}

function createRequestBody(settings, prompt) {
  return JSON.stringify({
    model: settings.model,
    stream: true,
    temperature: settings.temperature || 0.8,
    messages: [
      {
        role: 'system',
        content: NARRATION_CONFIG.request.systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });
}

function createRequestBodyV2(settings, prompt) {
  return JSON.stringify({
    model: settings.model,
    stream: true,
    temperature: settings.temperature || 0.8,
    messages: [
      {
        role: 'system',
        content: NARRATION_CONFIG.request.systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });
}

async function streamFromProvider(settings, prompt, onText, onStatus) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const requestBody = createRequestBodyV2(settings, prompt);
  const candidates = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions');
  const errors = [];
  const connectTimeoutMs = Number(settings.connectTimeoutMs) || 15000;
  const streamIdleTimeoutMs = Number(settings.streamIdleTimeoutMs) || 20000;
  const maxStreamDurationMs = Number(settings.maxStreamDurationMs) || 120000;
  const firstContentTimeoutMs = Number(settings.firstContentTimeoutMs) || 18000;

  for (const url of candidates) {
    const connectTimeout = withTimeoutSignal(connectTimeoutMs);
    let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: requestBody,
        signal: connectTimeout.signal
      });
    } catch (error) {
      connectTimeout.clear();
      errors.push(`${url} -> ${error.message}`);
      continue;
    }
    connectTimeout.clear();

    if (!response.ok || !response.body) {
      errors.push(`${url} -> ${response.status}`);
      continue;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const startedAt = Date.now();
    const firstContentDeadline = startedAt + firstContentTimeoutMs;
    let buffer = '';
    let checkedFirstChunk = false;
    let finalText = '';
    let sawReasoningOnly = false;

    try {
      while (true) {
        if (Date.now() - startedAt > maxStreamDurationMs) {
          throw new Error(`stream-timeout:${maxStreamDurationMs}`);
        }

        const { done, value } = await readChunkWithTimeout(reader, streamIdleTimeoutMs);
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;

        if (!checkedFirstChunk) {
          checkedFirstChunk = true;
          if (isHtmlResponse(response, chunkText)) {
            throw new Error('upstream-returned-html');
          }
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;

          const payload = line.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') return finalText.trim();

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta
              ? parsed.choices[0].delta
              : {};
            const textDelta = typeof delta.content === 'string' ? sanitizeChronicleText(delta.content, '') : '';
            const reasoningDelta = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : '';

            if (!textDelta && reasoningDelta) {
              sawReasoningOnly = true;
            }

            if (textDelta) {
              finalText += textDelta;
              await onText(textDelta);
            }
          } catch (error) {
            // Ignore malformed upstream chunks.
          }
        }

        if (!finalText && Date.now() > firstContentDeadline) {
          if (sawReasoningOnly && onStatus) {
            await onStatus('上游模型已经接通，但暂时只返回内部推演，正文首段还没及时落下。');
          }
          throw new Error(`first-content-timeout:${firstContentTimeoutMs}`);
        }
      }
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
      try {
        await reader.cancel();
      } catch (cancelError) {
        // Ignore cancel errors.
      }
      continue;
    }

    if (finalText.trim()) {
      return sanitizeChronicleText(finalText.trim(), finalText.trim());
    }
  }

  throw new Error(`upstream-unavailable:${errors.join(' | ') || candidates.join(' | ')}`);
}

async function streamFallback(text, onText) {
  const chunks = String(text || '').match(/.{1,18}/g) || [String(text || '')];
  let finalText = '';

  for (const chunk of chunks) {
    finalText += chunk;
    await onText(chunk);
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  return finalText;
}

async function narrateScene(options) {
  const { settings, prompt, fallbackText, onText, onStatus } = options;
  const providerEnabled = Boolean(
    settings &&
    settings.apiBaseUrl &&
    settings.apiKey &&
    settings.model &&
    settings.model !== DEFAULT_MODEL
  );

  if (onStatus) {
    await onStatus(providerEnabled ? '外部模型已接入，若正文迟迟不到会自动切回本地续写。' : '当前未启用外部模型，本回合直接使用本地续写。');
  }

  try {
    const streamed = await streamFromProvider(settings, prompt, onText, onStatus);
    if (streamed && streamed.trim()) {
      return { text: streamed.trim(), mode: 'provider' };
    }
  } catch (error) {
    if (onStatus) {
      await onStatus('正文首段没及时到达，已经切回本地续写接住这一回。');
    }
  }

  const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
  return { text: fallback.trim(), mode: 'fallback' };
}

module.exports = {
  narrateScene
};


