const { DEFAULT_MODEL } = require('./constants');

async function streamFromProvider(settings, prompt, onText) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const url = settings.apiBaseUrl.replace(/\/$/, '') + '/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: '你负责把结构化导演指令写成沉稳、克制、有推进感的汉末中文叙事。'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(`上游模型调用失败: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
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

  return finalText.trim();
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

  await onStatus(settings.apiKey && settings.apiBaseUrl
    ? '正在连接模型并流式生成叙事...'
    : '未配置外部模型，正在使用本地叙事模板...');

  try {
    const streamed = await streamFromProvider(settings, prompt, onText);
    if (streamed && streamed.trim()) {
      return { text: streamed.trim(), mode: 'provider' };
    }
  } catch (error) {
    await onStatus(`外部模型不可用，已切换到本地叙事模板：${error.message}`);
  }

  const fallback = await streamFallback(fallbackText, onText);
  return { text: fallback.trim(), mode: 'fallback' };
}

module.exports = {
  narrateScene
};
