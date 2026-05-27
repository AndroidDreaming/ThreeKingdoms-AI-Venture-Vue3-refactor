const { INTENT_KEYWORDS } = require('./constants');

function classifyIntent(actionText) {
  const normalized = String(actionText || '').trim();

  if (!normalized) {
    return { intent: 'unknown', actionText: '' };
  }

  if (normalized.startsWith('background:')) {
    return {
      intent: 'background',
      actionText: normalized,
      target: normalized.split(':')[1]
    };
  }

  const matchedIntent = Object.keys(INTENT_KEYWORDS).find((intent) =>
    INTENT_KEYWORDS[intent].some((keyword) => normalized.includes(keyword))
  );

  return {
    intent: matchedIntent || 'unknown',
    actionText: normalized,
    target: normalized
  };
}

module.exports = {
  classifyIntent
};
