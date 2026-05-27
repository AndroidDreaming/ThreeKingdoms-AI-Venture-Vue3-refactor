const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCleanSafe');
const { NARRATION_CONFIG } = require('./chronicleV5NarrationConfigSafe');

function buildEndpointCandidates(apiBaseUrl, pathSuffix) {
  const trimmed = String(apiBaseUrl || '').replace(/\/$/, '');
  const normalizedSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  const candidates = [];

  if (/\/(?:chat\/completions|responses)$/i.test(trimmed)) {
    candidates.push(trimmed);
    return Array.from(new Set(candidates.filter(Boolean)));
  }

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

function normalizeChunkText(value) {
  if (typeof value === 'string') return sanitizeChronicleText(value, '');
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeChunkText(item))
      .filter(Boolean)
      .join('');
  }
  if (!value || typeof value !== 'object') return '';

  return [
    normalizeChunkText(value.text),
    normalizeChunkText(value.content),
    normalizeChunkText(value.output_text),
    normalizeChunkText(value.delta)
  ].filter(Boolean).join('');
}

function extractTextDelta(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const segments = [];
  const push = (value) => {
    const text = normalizeChunkText(value);
    if (text) segments.push(text);
  };

  push(payload.text);
  push(payload.content);
  push(payload.output_text);
  push(payload.message && payload.message.content);
  push(payload.message && payload.message.text);
  push(payload.delta && payload.delta.content);
  push(payload.delta && payload.delta.text);
  push(payload.data && payload.data.content);
  push(payload.data && payload.data.text);
  push(payload.data && payload.data.output_text);

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      push(choice && choice.text);
      push(choice && choice.message && choice.message.content);
      push(choice && choice.message && choice.message.text);
      push(choice && choice.delta && choice.delta.content);
      push(choice && choice.delta && choice.delta.text);
      push(choice && choice.delta && choice.delta.output_text);
    });
  }

  if (Array.isArray(payload.output)) {
    payload.output.forEach((item) => {
      push(item && item.content);
      push(item && item.text);
      push(item && item.output_text);
    });
  }

  return segments.join('');
}

function extractReasoningDelta(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const values = [
    payload.reasoning_content,
    payload.message && payload.message.reasoning_content,
    payload.delta && payload.delta.reasoning_content,
    payload.data && payload.data.reasoning_content
  ];

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      values.push(choice && choice.delta && choice.delta.reasoning_content);
      values.push(choice && choice.message && choice.message.reasoning_content);
    });
  }

  return values
    .filter((item) => typeof item === 'string' && item.trim())
    .join('');
}

function extractPayloadCandidates(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return [];
  if (line.startsWith('data:')) return [line.slice(5).trim()];
  if (line.startsWith('{') || line.startsWith('[')) return [line];
  return [];
}

function mapFallbackReason(error, providerEnabled) {
  return mapFallbackReasonSafe(error, providerEnabled);
}

async function streamFromProvider(settings, prompt, onText, onStatus) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const requestBody = createRequestBody(settings, prompt);
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

    const handlePayload = async(payloadText) => {
      if (!payloadText) return false;
      if (payloadText === '[DONE]') return true;

      let parsed;
      try {
        parsed = JSON.parse(payloadText);
      } catch (error) {
        return false;
      }

      const textDelta = extractTextDelta(parsed);
      const reasoningDelta = extractReasoningDelta(parsed);

      if (!textDelta && reasoningDelta) {
        sawReasoningOnly = true;
      }

      if (textDelta) {
        finalText += textDelta;
        await onText(textDelta);
      }

      return false;
    };

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

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const payloads = extractPayloadCandidates(rawLine);
          for (const payloadText of payloads) {
            const doneFlag = await handlePayload(payloadText);
            if (doneFlag) {
              return sanitizeChronicleText(finalText.trim(), finalText.trim());
            }
          }
        }

        if (!finalText && Date.now() > firstContentDeadline) {
          if (sawReasoningOnly && onStatus) {
            await onStatus('云端模型已经接通，但当前只返回了内部推演片段，正文首段仍未落下。');
          }
          throw new Error(`first-content-timeout:${firstContentTimeoutMs}`);
        }
      }

      const trailingPayloads = extractPayloadCandidates(buffer);
      for (const payloadText of trailingPayloads) {
        const doneFlag = await handlePayload(payloadText);
        if (doneFlag) break;
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
    await onStatus(
      providerEnabled
        ? '云端叙事已经接通，正在等待正文起笔。'
        : '未启用云端叙事，本回合将直接使用本地续写。'
    );
  }

  try {
    const streamed = await streamFromProvider(settings, prompt, onText, onStatus);
    if (streamed && streamed.trim()) {
      return { text: streamed.trim(), mode: 'provider', reason: 'provider_stream_ok' };
    }
  } catch (error) {
    const reason = mapFallbackReason(error, providerEnabled);
    if (onStatus) {
      await onStatus(reason.statusText);
    }
    const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
    return { text: fallback.trim(), mode: 'fallback', reason: reason.code };
  }

  const reason = mapFallbackReason(null, providerEnabled);
  if (onStatus) {
    await onStatus(reason.statusText);
  }
  const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
  return { text: fallback.trim(), mode: 'fallback', reason: reason.code };
}

module.exports = {
  narrateScene
};

function createRequestBodySafe(settings, prompt) {
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

function mapFallbackReasonSafe(error, providerEnabled) {
  if (!providerEnabled) {
    return {
      code: 'provider_disabled',
      statusText: '\u672a\u542f\u7528\u4e91\u7aef\u53d9\u4e8b\uff0c\u672c\u56de\u5408\u6539\u7531\u672c\u5730\u7eed\u5199\u3002'
    };
  }

  const message = String((error && error.message) || '');
  if (message.includes('first-content-timeout')) {
    return {
      code: 'provider_timeout',
      statusText: '\u4e91\u7aef\u6b63\u6587\u8d77\u7b14\u8fc7\u6162\uff0c\u8fd9\u4e00\u56de\u5148\u7531\u672c\u5730\u63a5\u7b14\u7eed\u5199\u3002'
    };
  }
  if (message.includes('idle-timeout')) {
    return {
      code: 'provider_stream_idle',
      statusText: '\u4e91\u7aef\u53d9\u4e8b\u4e2d\u9014\u505c\u987f\u8fc7\u4e45\uff0c\u8fd9\u4e00\u56de\u5148\u7531\u672c\u5730\u63a5\u7b14\u7eed\u5199\u3002'
    };
  }
  if (message.includes('upstream-returned-html')) {
    return {
      code: 'provider_endpoint_invalid',
      statusText: '\u4e91\u7aef\u63a5\u53e3\u8fd4\u56de\u5f02\u5e38\u9875\u9762\uff0c\u672c\u56de\u5408\u5148\u7531\u672c\u5730\u7eed\u5199\u3002'
    };
  }
  return {
    code: 'provider_unavailable',
    statusText: '\u4e91\u7aef\u53d9\u4e8b\u6682\u65f6\u6ca1\u6709\u7ed9\u51fa\u53ef\u7528\u6b63\u6587\uff0c\u672c\u56de\u5408\u5148\u7531\u672c\u5730\u7eed\u5199\u3002'
  };
}

async function streamFromProviderSafe(settings, prompt, onText, onStatus) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const requestBody = createRequestBodySafe(settings, prompt);
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

    const handlePayload = async(payloadText) => {
      if (!payloadText) return false;
      if (payloadText === '[DONE]') return true;

      let parsed;
      try {
        parsed = JSON.parse(payloadText);
      } catch (error) {
        return false;
      }

      const textDelta = extractTextDelta(parsed);
      const reasoningDelta = extractReasoningDelta(parsed);

      if (!textDelta && reasoningDelta) {
        sawReasoningOnly = true;
      }

      if (textDelta) {
        finalText += textDelta;
        await onText(textDelta);
      }

      return false;
    };

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

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const payloads = extractPayloadCandidates(rawLine);
          for (const payloadText of payloads) {
            const doneFlag = await handlePayload(payloadText);
            if (doneFlag) {
              return sanitizeChronicleText(finalText.trim(), finalText.trim());
            }
          }
        }

        if (!finalText && Date.now() > firstContentDeadline) {
          if (sawReasoningOnly && onStatus) {
            await onStatus('\u4e91\u7aef\u6a21\u578b\u5df2\u7ecf\u63a5\u901a\uff0c\u4f46\u5f53\u524d\u53ea\u8fd4\u56de\u4e86\u5185\u90e8\u63a8\u6f14\u7247\u6bb5\uff0c\u6b63\u6587\u9996\u6bb5\u4ecd\u672a\u843d\u4e0b\u3002');
          }
          throw new Error(`first-content-timeout:${firstContentTimeoutMs}`);
        }
      }

      const trailingPayloads = extractPayloadCandidates(buffer);
      for (const payloadText of trailingPayloads) {
        const doneFlag = await handlePayload(payloadText);
        if (doneFlag) break;
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

async function narrateSceneSafe(options) {
  const { settings, prompt, fallbackText, onText, onStatus } = options;
  const providerEnabled = Boolean(
    settings &&
    settings.apiBaseUrl &&
    settings.apiKey &&
    settings.model &&
    settings.model !== DEFAULT_MODEL
  );

  if (onStatus) {
    await onStatus(
      providerEnabled
        ? '\u4e91\u7aef\u53d9\u4e8b\u5df2\u63a5\u901a\uff0c\u6b63\u5728\u7b49\u5f85\u6b63\u6587\u8d77\u7b14\u3002'
        : '\u672a\u542f\u7528\u4e91\u7aef\u53d9\u4e8b\uff0c\u672c\u56de\u5408\u5c06\u76f4\u63a5\u4f7f\u7528\u672c\u5730\u7eed\u5199\u3002'
    );
  }

  try {
    const streamed = await streamFromProviderSafe(settings, prompt, onText, onStatus);
    if (streamed && streamed.trim()) {
      return { text: streamed.trim(), mode: 'provider', reason: 'provider_stream_ok' };
    }
  } catch (error) {
    const reason = mapFallbackReasonSafe(error, providerEnabled);
    if (onStatus) {
      await onStatus(reason.statusText);
    }
    const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
    return { text: fallback.trim(), mode: 'fallback', reason: reason.code };
  }

  const reason = mapFallbackReasonSafe(null, providerEnabled);
  if (onStatus) {
    await onStatus(reason.statusText);
  }
  const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
  return { text: fallback.trim(), mode: 'fallback', reason: reason.code };
}

module.exports = {
  narrateScene: narrateSceneSafe
};

function extractBalancedJsonCandidatesSafe(text) {
  const input = String(text || '');
  const candidates = [];
  let start = -1;
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '{' || char === '[') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === '}' || char === ']') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(input.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates
    .map((item) => item.trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
}

function tryParseJsonLooseSafe(payloadText) {
  const raw = String(payloadText || '').trim();
  if (!raw) return null;

  const normalized = raw.replace(/^data:\s*/i, '').trim();
  if (normalized === '[DONE]') return '[DONE]';

  try {
    return JSON.parse(normalized);
  } catch (error) {
    // Continue with best-effort extraction below.
  }

  const candidates = extractBalancedJsonCandidatesSafe(normalized);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Try next candidate.
    }
  }

  return null;
}

function extractPayloadsFromEventBlockSafe(block) {
  const lines = String(block || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (dataLines.length) {
    return [dataLines.join('\n')];
  }

  const joined = lines.join('\n').trim();
  if (joined.startsWith('{') || joined.startsWith('[')) return [joined];
  return [];
}

function drainTransportBufferSafe(buffer) {
  const source = String(buffer || '');
  if (!source) return { payloads: [], remainder: '' };

  const payloads = [];

  if (/\r?\n\r?\n/.test(source)) {
    const blocks = source.split(/\r?\n\r?\n/);
    const remainder = blocks.pop() || '';
    blocks.forEach((block) => {
      extractPayloadsFromEventBlockSafe(block).forEach((payload) => payloads.push(payload));
    });
    return { payloads, remainder };
  }

  const lines = source.split(/\r?\n/);
  const remainder = lines.pop() || '';
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('data:')) {
      payloads.push(trimmed.slice(5).trim());
      return;
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      payloads.push(trimmed);
    }
  });
  return { payloads, remainder };
}

function extractNarrationTextFromResponseSafe(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';

  const primary = extractTextDelta(parsed);
  if (primary) return primary;

  const candidates = [
    parsed.message && parsed.message.content,
    parsed.message && parsed.message.text,
    parsed.response && parsed.response.content,
    parsed.response && parsed.response.text,
    parsed.data && parsed.data.content,
    parsed.data && parsed.data.text,
    parsed.output_text,
    parsed.text
  ];

  for (const value of candidates) {
    const text = normalizeChunkText(value);
    if (text) return text;
  }

  return '';
}

async function requestNonStreamNarrationSafe(settings, prompt) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return '';
  }

  const requestBody = JSON.stringify({
    model: settings.model,
    stream: false,
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

  const candidates = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions');
  const errors = [];

  for (const url of candidates) {
    const connectTimeout = withTimeoutSignal(Number(settings.connectTimeoutMs) || 15000);
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

    if (!response.ok) {
      errors.push(`${url} -> ${response.status}`);
      continue;
    }

    const rawText = await response.text();
    const parsed = tryParseJsonLooseSafe(rawText);
    if (parsed && parsed !== '[DONE]') {
      const text = sanitizeChronicleText(extractNarrationTextFromResponseSafe(parsed), '');
      if (text) return text;
    }

    const plainText = sanitizeChronicleText(rawText, '');
    if (plainText && !plainText.startsWith('{') && !plainText.startsWith('[')) {
      return plainText;
    }
  }

  throw new Error(`nonstream-unavailable:${errors.join(' | ')}`);
}

async function streamFromProviderUltraSafe(settings, prompt, onText, onStatus) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const requestBody = createRequestBodySafe(settings, prompt);
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
      errors.push(`${url} -> network:${error.message}`);
      continue;
    }
    connectTimeout.clear();

    if (!response.ok || !response.body) {
      errors.push(`${url} -> status:${response.status}`);
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
    let parseMisses = 0;

    const handlePayload = async(payloadText) => {
      if (!payloadText) return false;
      const parsed = tryParseJsonLooseSafe(payloadText);
      if (parsed === '[DONE]') return true;
      if (!parsed) {
        parseMisses += 1;
        return false;
      }

      const textDelta = extractTextDelta(parsed);
      const reasoningDelta = extractReasoningDelta(parsed);
      if (!textDelta && reasoningDelta) {
        sawReasoningOnly = true;
      }
      if (textDelta) {
        finalText += textDelta;
        await onText(textDelta);
      }
      return false;
    };

    try {
      while (true) {
        if (Date.now() - startedAt > maxStreamDurationMs) {
          throw new Error(`stream-timeout:${maxStreamDurationMs}|parse-miss:${parseMisses}`);
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

        const drained = drainTransportBufferSafe(buffer);
        buffer = drained.remainder;

        for (const payloadText of drained.payloads) {
          const doneFlag = await handlePayload(payloadText);
          if (doneFlag) {
            return {
              text: sanitizeChronicleText(finalText.trim(), finalText.trim()),
              reason: 'provider_stream_ok',
              detail: `stream-ok|parse-miss:${parseMisses}`
            };
          }
        }

        if (!finalText && Date.now() > firstContentDeadline) {
          if (sawReasoningOnly && onStatus) {
            await onStatus('\u4e91\u7aef\u6a21\u578b\u5df2\u7ecf\u63a5\u901a\uff0c\u4f46\u9996\u5148\u843d\u4e0b\u7684\u662f\u5185\u90e8\u63a8\u6f14\u7247\u6bb5\uff0c\u6b63\u6587\u4ecd\u5728\u8f6c\u5199\u4e2d\u3002');
          }
          throw new Error(`first-content-timeout:${firstContentTimeoutMs}|parse-miss:${parseMisses}`);
        }
      }

      const trailing = drainTransportBufferSafe(`${buffer}\n`);
      for (const payloadText of trailing.payloads) {
        const doneFlag = await handlePayload(payloadText);
        if (doneFlag) break;
      }
    } catch (error) {
      if (finalText.trim().length >= 80) {
        return {
          text: sanitizeChronicleText(finalText.trim(), finalText.trim()),
          reason: 'provider_partial_stream',
          detail: `partial-stream|${error.message || 'unknown'}|parse-miss:${parseMisses}`
        };
      }
      errors.push(`${url} -> ${error.message || 'stream-error'}|parse-miss:${parseMisses}`);
      try {
        await reader.cancel();
      } catch (cancelError) {
        // Ignore cancel errors.
      }
      continue;
    }

    if (finalText.trim()) {
      return {
        text: sanitizeChronicleText(finalText.trim(), finalText.trim()),
        reason: 'provider_stream_ok',
        detail: `stream-tail-ok|parse-miss:${parseMisses}`
      };
    }
  }

  throw new Error(`upstream-unavailable:${errors.join(' | ') || candidates.join(' | ')}`);
}

async function narrateSceneUltraSafe(options) {
  const { settings, prompt, fallbackText, onText, onStatus } = options;
  const providerEnabled = Boolean(
    settings &&
    settings.apiBaseUrl &&
    settings.apiKey &&
    settings.model &&
    settings.model !== DEFAULT_MODEL
  );

  if (onStatus) {
    await onStatus(
      providerEnabled
        ? '\u4e91\u7aef\u53d9\u4e8b\u5df2\u63a5\u901a\uff0c\u6b63\u5728\u7b49\u5f85\u6b63\u6587\u8d77\u7b14\u3002'
        : '\u672a\u542f\u7528\u4e91\u7aef\u53d9\u4e8b\uff0c\u672c\u56de\u5408\u5c06\u76f4\u63a5\u4f7f\u7528\u672c\u5730\u7eed\u5199\u3002'
    );
  }

  if (!providerEnabled) {
    const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
    return { text: fallback.trim(), mode: 'fallback', reason: 'provider_disabled', detail: 'provider-disabled' };
  }

  let streamError = null;
  try {
    const streamed = await streamFromProviderUltraSafe(settings, prompt, onText, onStatus);
    if (streamed && streamed.text && streamed.text.trim()) {
      return { text: streamed.text.trim(), mode: 'provider', reason: streamed.reason || 'provider_stream_ok', detail: streamed.detail || '' };
    }
  } catch (error) {
    streamError = error;
  }

  if (onStatus) {
    await onStatus('\u6d41\u5f0f\u6b63\u6587\u6ca1\u6709\u987a\u5229\u843d\u4e0b\uff0c\u6b63\u5728\u6539\u7528\u6574\u6bb5\u8865\u53d6\uff0c\u5c3d\u91cf\u628a\u8fd9\u4e00\u56de\u63a5\u4f4f\u3002');
  }

  try {
    const nonStreamText = await requestNonStreamNarrationSafe(settings, prompt);
    if (nonStreamText && nonStreamText.trim()) {
      const normalized = sanitizeChronicleText(nonStreamText, nonStreamText);
      const replayed = await streamFallback(normalized, onText);
      return {
        text: replayed.trim(),
        mode: 'provider',
        reason: 'provider_nonstream_ok',
        detail: `nonstream-after:${streamError ? streamError.message : 'stream-empty'}`
      };
    }
  } catch (error) {
    streamError = streamError || error;
  }

  const reason = mapFallbackReasonSafe(streamError, providerEnabled);
  if (onStatus) {
    await onStatus(reason.statusText);
  }
  const fallback = await streamFallback(sanitizeChronicleText(fallbackText, fallbackText), onText);
  return {
    text: fallback.trim(),
    mode: 'fallback',
    reason: reason.code,
    detail: streamError ? String(streamError.message || streamError) : ''
  };
}

module.exports = {
  narrateScene: narrateSceneUltraSafe
};


