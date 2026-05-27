const { DEFAULT_MODEL } = require('./constants');

function buildEndpointCandidates(apiBaseUrl, pathSuffix) {
  const trimmed = apiBaseUrl.replace(/\/$/, '');
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

async function streamFromProvider(settings, prompt, onText) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const requestBody = JSON.stringify({
    model: settings.model,
    stream: true,
    temperature: settings.temperature || 0.8,
    messages: [
      {
        role: 'system',
        content: '你负责把结构化导演指令写成沉浸、克制、持续推进的汉末中文叙事。'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const candidates = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions');
  const errors = [];
  const connectTimeoutMs = Number(settings.connectTimeoutMs) || 15000;
  const streamIdleTimeoutMs = Number(settings.streamIdleTimeoutMs) || 20000;
  const maxStreamDurationMs = Number(settings.maxStreamDurationMs) || 90000;

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
      errors.push(`${url} -> ${error.message}`);
      connectTimeout.clear();
      continue;
    }
    connectTimeout.clear();

    if (!response.ok || !response.body) {
      errors.push(`${url} -> ${response.status}`);
      continue;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalText = '';
    let checkedFirstChunk = false;
    const startedAt = Date.now();

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
            throw new Error('返回了页面内容而不是叙事流');
          }
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return finalText.trim();

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta
              ? parsed.choices[0].delta.content || ''
              : '';
            if (!delta) continue;
            finalText += delta;
            await onText(delta);
          } catch (error) {
            // Ignore malformed upstream chunks.
          }
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
      return finalText.trim();
    }
  }

  throw new Error(`未能从上游取得叙事回应：${errors.join('；') || candidates.join('，')}`);
}

async function streamFallback(text, onText) {
  const chunks = text.match(/.{1,18}/g) || [text];
  let finalText = '';

  for (const chunk of chunks) {
    finalText += chunk;
    await onText(chunk);
    await new Promise((resolve) => setTimeout(resolve, 40));
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

  await onStatus(providerEnabled ? '史官正在铺陈此回风云……' : '烛火摇曳，史笔暂由旧卷续写……');

  try {
    const streamed = await streamFromProvider(settings, prompt, onText);
    if (streamed && streamed.trim()) {
      return { text: streamed.trim(), mode: 'provider' };
    }
  } catch (error) {
    await onStatus('外间文书久候不至，先由案头旧卷补完这一回。');
  }

  const fallback = await streamFallback(fallbackText, onText);
  return { text: fallback.trim(), mode: 'fallback' };
}

module.exports = {
  narrateScene
};
