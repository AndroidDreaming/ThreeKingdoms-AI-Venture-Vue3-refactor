const { BACKGROUNDS, INTENT_CONFIG, INTENT_KEYWORDS } = require('./chronicleV2Constants');

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

  if (/夜袭|突袭|伏击|追击|攻城|围城|破城|夺门|截击|出兵|奇袭|守城|粮车/.test(text)) {
    return { actionText: text, intent: 'conquest', target: '' };
  }
  if (/练兵|操练|整军|募兵|军阵|军议|校场/.test(text)) {
    return { actionText: text, intent: 'military', target: '' };
  }
  if (/拜访|拜会|游说|联络|试探|说服|会见|谈判|递话/.test(text)) {
    return { actionText: text, intent: 'diplomacy', target: '' };
  }
  if (/账|商路|行会|粮道|筹饷|转运|货船|盐铁/.test(text)) {
    return { actionText: text, intent: 'trade', target: '' };
  }
  if (/私会|赴约|寄信|表白|相会|灯下/.test(text)) {
    return { actionText: text, intent: 'romance', target: '' };
  }
  if (/查|探|耳目|风声|细作|暗线|密信/.test(text)) {
    return { actionText: text, intent: 'investigate', target: '' };
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
