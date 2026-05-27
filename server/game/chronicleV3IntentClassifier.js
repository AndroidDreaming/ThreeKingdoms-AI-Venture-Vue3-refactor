const { BACKGROUNDS, INTENT_KEYWORDS, INTENT_CONFIG } = require('./chronicleV2Constants');

function normalizeIntent(intent) {
  return INTENT_CONFIG[intent] ? intent : 'unknown';
}

function classifyIntent(actionText) {
  const text = String(actionText || '').trim();
  if (!text) return { actionText: '', intent: 'unknown', target: '' };

  if (text.startsWith('background:')) {
    return { actionText: text, intent: 'background', target: text.split(':')[1] || '' };
  }

  if (text.startsWith('thread:')) {
    const domain = text.split(':')[1] || 'investigate';
    return { actionText: text, intent: normalizeIntent(domain), target: domain };
  }

  if (INTENT_CONFIG[text]) {
    return { actionText: text, intent: text, target: '' };
  }

  const normalized = text.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'background') continue;
    if (keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()))) {
      return { actionText: text, intent, target: '' };
    }
  }

  const matchedBackground = BACKGROUNDS.find((item) => text.includes(item.label));
  if (matchedBackground) {
    return { actionText: text, intent: 'background', target: matchedBackground.id };
  }

  return { actionText: text, intent: 'unknown', target: '' };
}

module.exports = {
  classifyIntent
};
