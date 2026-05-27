import { requestJson, createRequestOptions, extractError } from './httpClient';

function extractBalancedJson(text) {
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

    if ((char === '}' || char === ']') && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(input.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates.sort((a, b) => a.length - b.length);
}

function parseEventLine(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    const candidates = extractBalancedJson(raw);
    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch (innerError) {
        // Try next candidate.
      }
    }
    return null;
  }
}

async function parseNdjsonStream(response, handlers) {
  if (!response.ok || !response.body) {
    throw new Error(`Stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;

  while (!finished) {
    const { done, value } = await reader.read();
    if (done) {
      finished = true;
      continue;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const event = parseEventLine(trimmed);
      if (!event) continue;
      if (event.type === 'status' && handlers.onStatus) handlers.onStatus(event.message);
      if (event.type === 'delta' && handlers.onDelta) handlers.onDelta(event.text);
      if (event.type === 'narration_done' && handlers.onNarrationDone) handlers.onNarrationDone();
      if (event.type === 'choice_draft' && handlers.onChoiceDraft) handlers.onChoiceDraft(event.draft);
      if (event.type === 'choices_reset' && handlers.onChoicesReset) handlers.onChoicesReset(event.choices || []);
      if (event.type === 'choice' && handlers.onChoice) handlers.onChoice(event.choice);
      if (event.type === 'done' && handlers.onDone) handlers.onDone(event.snapshot);
      if (event.type === 'error') throw new Error(event.message || 'Stream error');
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const event = parseEventLine(tail);
    if (!event) return;
    if (event.type === 'status' && handlers.onStatus) handlers.onStatus(event.message);
    if (event.type === 'delta' && handlers.onDelta) handlers.onDelta(event.text);
    if (event.type === 'narration_done' && handlers.onNarrationDone) handlers.onNarrationDone();
    if (event.type === 'choice_draft' && handlers.onChoiceDraft) handlers.onChoiceDraft(event.draft);
    if (event.type === 'choices_reset' && handlers.onChoicesReset) handlers.onChoicesReset(event.choices || []);
    if (event.type === 'choice' && handlers.onChoice) handlers.onChoice(event.choice);
    if (event.type === 'done' && handlers.onDone) handlers.onDone(event.snapshot);
    if (event.type === 'error') throw new Error(event.message || 'Stream error');
  }
}

export default {
  getConfig() {
    return requestJson('/api/config');
  },

  createSession(payload) {
    return requestJson('/api/session', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  getCurrentSession() {
    return requestJson('/api/session/current');
  },

  getSession(sessionId) {
    return requestJson(`/api/session/${sessionId}`);
  },

  claimSession(sessionId) {
    return requestJson(`/api/session/${sessionId}/claim`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  resetSession(sessionId, payload) {
    return requestJson(`/api/session/${sessionId}/reset`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  renameSession(sessionId, payload) {
    return requestJson(`/api/session/${sessionId}/rename`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },

  advanceSession(sessionId, payload) {
    return requestJson(`/api/session/${sessionId}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    }).catch(async(error) => {
      if (!error || error.status !== 404) throw error;
      let finalSnapshot = null;
      await this.streamTurn(sessionId, payload || {}, {
        onDone: (snapshot) => {
          finalSnapshot = snapshot || null;
        }
      });
      if (finalSnapshot) return finalSnapshot;
      throw error;
    });
  },

  async streamTurn(sessionId, payload, handlers) {
    const response = await fetch(`/api/session/${sessionId}/turn/stream`, createRequestOptions({
      method: 'POST',
      body: JSON.stringify(payload || {})
    }));

    if (!response.ok) {
      return extractError(response, `Stream failed: ${response.status}`);
    }

    await parseNdjsonStream(response, handlers || {});
  }
};
