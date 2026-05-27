const { INTENT_CONFIG } = require('./chronicleV2Constants');
const { clamp } = require('./chronicleV2Helpers');

function average(values) {
  return Math.round(values.reduce((sum, item) => sum + item, 0) / values.length);
}

function getResolutionType(intent) {
  if (['diplomacy', 'romance', 'guidance', 'trade'].includes(intent)) return 'social';
  if (['conquest', 'military'].includes(intent)) return 'war';
  if (['intrigue', 'investigate'].includes(intent)) return 'scheme';
  if (['domestic', 'travel', 'recover'].includes(intent)) return 'governance';
  return 'general';
}

function getPrimaryScore(state, intent) {
  const stats = state.gameState;
  switch (intent) {
    case 'domestic':
      return average([stats.domestic, stats.defense, Math.floor(stats.supplies / 10)]);
    case 'diplomacy':
      return average([stats.diplomacy, stats.charm, Math.floor((stats.renown + 6) / 3)]);
    case 'military':
      return average([stats.military, stats.attack, Math.floor(stats.morale / 10)]);
    case 'conquest':
      return average([stats.conquest, stats.attack, stats.military]);
    case 'romance':
      return average([stats.romance + 2, stats.charm, Math.floor((stats.renown + 3) / 4)]);
    case 'trade':
      return average([stats.diplomacy, Math.floor(stats.coins / 12), Math.floor(stats.supplies / 10)]);
    case 'intrigue':
    case 'investigate':
      return average([stats.diplomacy, stats.defense, stats.agility]);
    case 'travel':
      return average([stats.agility, stats.conquest + 1, Math.floor(stats.morale / 12)]);
    case 'recover':
      return average([Math.floor(stats.health / 10), Math.floor((100 - stats.fatigue) / 10), Math.floor(stats.supplies / 12)]);
    case 'guidance':
      return average([stats.diplomacy, stats.defense, stats.charm]);
    default:
      return average([stats.attack, stats.defense, stats.agility]);
  }
}

function getContextModifier(state, intent) {
  let modifier = 0;
  const { mainline, pressure } = state.world;
  const stats = state.gameState;

  if (mainline && Array.isArray(mainline.focus) && mainline.focus.includes(intent)) modifier += 2;
  if (pressure >= 3 && ['conquest', 'military', 'intrigue'].includes(intent)) modifier += 1;
  if (stats.health < 45 && ['military', 'conquest', 'travel'].includes(intent)) modifier -= 2;
  if (stats.fatigue > 50 && ['military', 'conquest', 'intrigue', 'travel'].includes(intent)) modifier -= 2;
  if (stats.morale < 35 && ['military', 'conquest'].includes(intent)) modifier -= 2;
  if (stats.coins < 12 && ['domestic', 'trade', 'diplomacy'].includes(intent)) modifier -= 1;
  if (stats.supplies < 20 && ['domestic', 'military', 'conquest', 'travel'].includes(intent)) modifier -= 2;
  if (stats.renown >= 10 && ['diplomacy', 'romance', 'trade'].includes(intent)) modifier += 1;

  return modifier;
}

function getVariance(roll) {
  if (roll >= 19) return { delta: 3, label: '超常发挥' };
  if (roll >= 15) return { delta: 1, label: '把握住了节奏' };
  if (roll <= 2) return { delta: -3, label: '失了手' };
  if (roll <= 6) return { delta: -1, label: '有些迟滞' };
  return { delta: 0, label: '常态发挥' };
}

function resolveTier(total) {
  if (total >= 15) return 'great';
  if (total >= 11) return 'good';
  if (total >= 8) return 'mixed';
  return 'fail';
}

function buildSummary(intent, tier, varianceLabel) {
  const label = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const map = {
    great: `这一步“${label}”压得很稳，局势被你掰出了一道口子。`,
    good: `这一步“${label}”落得不差，局势开始朝你偏转。`,
    mixed: `这一步“${label}”勉强撑住，但裂缝并没有真正合上。`,
    fail: `这一步“${label}”没有落稳，反而让暗处多了一层压力。`
  };
  return `${map[tier]}这回属于“${varianceLabel}”。`;
}

function buildEffectsByIntent(intent, tier) {
  const effects = {
    health: 0,
    attack: 0,
    defense: 0,
    agility: 0,
    charm: 0,
    coins: 0,
    troops: 0,
    renown: 0,
    domestic: 0,
    diplomacy: 0,
    military: 0,
    conquest: 0,
    romance: 0,
    morale: 0,
    fatigue: 0,
    supplies: 0
  };

  const tierDelta = { great: 2, good: 1, mixed: 0, fail: -1 }[tier];

  switch (intent) {
    case 'domestic':
      effects.domestic = tier === 'great' ? 2 : 1;
      effects.coins = tier === 'great' ? 18 : tier === 'good' ? 10 : tier === 'mixed' ? 3 : -8;
      effects.supplies = tier === 'great' ? 12 : tier === 'good' ? 6 : tier === 'mixed' ? 2 : -6;
      effects.renown = Math.max(0, tierDelta);
      break;
    case 'diplomacy':
      effects.diplomacy = tier === 'great' ? 2 : 1;
      effects.charm = tier === 'fail' ? 0 : 1;
      effects.renown = tier === 'great' ? 3 : tier === 'good' ? 1 : 0;
      break;
    case 'military':
      effects.military = tier === 'great' ? 2 : 1;
      effects.troops = tier === 'great' ? 14 : tier === 'good' ? 7 : tier === 'mixed' ? 2 : -5;
      effects.morale = tier === 'great' ? 8 : tier === 'good' ? 5 : tier === 'mixed' ? 1 : -7;
      effects.fatigue = tier === 'great' ? 6 : tier === 'good' ? 8 : 10;
      break;
    case 'conquest':
      effects.conquest = tier === 'great' ? 2 : 1;
      effects.troops = tier === 'great' ? 10 : tier === 'good' ? 2 : tier === 'mixed' ? -8 : -18;
      effects.morale = tier === 'great' ? 10 : tier === 'good' ? 4 : tier === 'mixed' ? -4 : -12;
      effects.health = tier === 'great' ? -5 : tier === 'good' ? -8 : tier === 'mixed' ? -14 : -22;
      effects.supplies = tier === 'great' ? -6 : tier === 'good' ? -10 : -14;
      effects.renown = tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1;
      break;
    case 'romance':
      effects.romance = tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
      effects.charm = tier === 'great' ? 1 : 0;
      break;
    case 'trade':
      effects.coins = tier === 'great' ? 30 : tier === 'good' ? 16 : tier === 'mixed' ? 5 : -10;
      effects.supplies = tier === 'great' ? 10 : tier === 'good' ? 6 : tier === 'mixed' ? 2 : -5;
      effects.domestic = tier === 'great' ? 1 : 0;
      break;
    case 'intrigue':
      effects.diplomacy = tier === 'great' ? 1 : 0;
      effects.defense = tier === 'great' ? 1 : 0;
      effects.fatigue = tier === 'great' ? 4 : 6;
      break;
    case 'investigate':
      effects.defense = tier === 'great' ? 1 : 0;
      effects.fatigue = tier === 'fail' ? 5 : 2;
      break;
    case 'travel':
      effects.health = tier === 'fail' ? -8 : -3;
      effects.agility = tier === 'great' ? 1 : 0;
      effects.supplies = tier === 'great' ? -2 : -6;
      effects.fatigue = tier === 'great' ? 4 : 7;
      break;
    case 'recover':
      effects.health = tier === 'great' ? 18 : tier === 'good' ? 10 : 6;
      effects.fatigue = tier === 'great' ? -16 : tier === 'good' ? -10 : -6;
      effects.morale = tier === 'great' ? 6 : tier === 'good' ? 3 : 1;
      break;
    case 'guidance':
      effects.defense = 1;
      effects.diplomacy = 1;
      effects.fatigue = -4;
      break;
    default:
      effects.renown = Math.max(0, tierDelta);
      break;
  }

  return effects;
}

function resolveAction(state, intent, actionText) {
  const roll = 1 + Math.floor(Math.random() * 20);
  const type = getResolutionType(intent);
  const primary = getPrimaryScore(state, intent);
  const contextModifier = getContextModifier(state, intent);
  const variance = getVariance(roll);
  const total = primary + contextModifier + variance.delta;
  const tier = resolveTier(total);
  const effects = buildEffectsByIntent(intent, tier);

  return {
    type,
    roll,
    primary,
    contextModifier,
    variance,
    total,
    tier,
    effects,
    summary: buildSummary(intent, tier, variance.label),
    promptLine: `行动“${actionText}”由本地规则先行裁定：类型=${type}，基础值=${primary}，环境修正=${contextModifier}，波动=${variance.label}，最终总值=${total}，结果=${tier}。`
  };
}

function applyResolution(state, resolution) {
  const effects = resolution.effects;
  const stats = state.gameState;

  stats.health = clamp(stats.health + effects.health, 0, stats.maxHealth);
  stats.attack = clamp(stats.attack + effects.attack, 1, 99);
  stats.defense = clamp(stats.defense + effects.defense, 1, 99);
  stats.agility = clamp(stats.agility + effects.agility, 1, 99);
  stats.charm = clamp(stats.charm + effects.charm, 1, 99);
  stats.coins = Math.max(0, stats.coins + effects.coins);
  stats.troops = Math.max(0, stats.troops + effects.troops);
  stats.renown = Math.max(0, stats.renown + effects.renown);
  stats.domestic = clamp(stats.domestic + effects.domestic, 1, 99);
  stats.diplomacy = clamp(stats.diplomacy + effects.diplomacy, 1, 99);
  stats.military = clamp(stats.military + effects.military, 1, 99);
  stats.conquest = clamp(stats.conquest + effects.conquest, 1, 99);
  stats.romance = clamp(stats.romance + effects.romance, 0, 99);
  stats.morale = clamp(stats.morale + effects.morale, 0, 100);
  stats.fatigue = clamp(stats.fatigue + effects.fatigue, 0, 100);
  stats.supplies = clamp(stats.supplies + effects.supplies, 0, 100);
}

module.exports = {
  resolveAction,
  applyResolution
};
