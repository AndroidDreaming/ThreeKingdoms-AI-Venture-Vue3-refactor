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

  for (const url of candidates) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: requestBody
    });

    if (!response.ok || !response.body) {
      errors.push(`${url} -> ${response.status}`);
      continue;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalText = '';
    let checkedFirstChunk = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      buffer += chunkText;

      if (!checkedFirstChunk) {
        checkedFirstChunk = true;
        if (isHtmlResponse(response, chunkText)) {
          errors.push(`${url} -> 返回了 HTML 页面而不是模型流`);
          break;
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
          // Ignore malformed chunks from upstream providers.
        }
      }
    }

    if (finalText.trim()) {
      return finalText.trim();
    }
  }

  throw new Error(`上游模型调用失败，已尝试: ${errors.join(' ; ') || candidates.join(' , ')}`);
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

  await onStatus(
    providerEnabled
      ? `正在连接后端配置的模型 ${settings.model} 并流式生成叙事...`
      : '未启用外部模型，正在使用本地回退叙事模板...'
  );

  try {
    const streamed = await streamFromProvider(settings, prompt, onText);
    if (streamed && streamed.trim()) {
      return { text: streamed.trim(), mode: 'provider' };
    }
  } catch (error) {
    await onStatus(`外部模型不可用，已切换到本地回退叙事模板：${error.message}`);
  }

  const fallback = await streamFallback(fallbackText, onText);
  return { text: fallback.trim(), mode: 'fallback' };
}

module.exports = {
  narrateScene
};
