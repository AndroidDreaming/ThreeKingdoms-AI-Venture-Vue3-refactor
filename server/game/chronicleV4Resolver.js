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

function findFactionByText(state, actionText) {
  const text = String(actionText || '');
  return (state.gameState.factions || []).find((item) => text.includes(item.name) || item.tags.some((tag) => text.includes(tag))) || null;
}

function getLeadFaction(state) {
  return (state.gameState.factions || []).slice().sort((a, b) => (b.power + b.leverage) - (a.power + a.leverage))[0] || null;
}

function getMostHostileFaction(state) {
  return (state.gameState.factions || []).slice().sort((a, b) => b.hostility - a.hostility)[0] || null;
}

function getMostPromisingFaction(state) {
  return (state.gameState.factions || []).slice().sort((a, b) => (b.favor + b.leverage) - (a.favor + a.leverage))[0] || null;
}

function detectBattleMode(actionText, intent) {
  const text = String(actionText || '');
  if (intent === 'military' && /练兵|操练|整军|募兵|军务/.test(text)) return 'drill';
  if (/攻城|围城|夺门|破城|坚城|寨门/.test(text)) return 'siege';
  if (/夜袭|突袭|伏击|追击|偷袭|截击|奇袭/.test(text)) return 'skirmish';
  if (/守城|拒守|坚守|固守/.test(text)) return 'defense';
  if (intent === 'military') return 'drill';
  return 'field';
}

function getVariance(roll) {
  if (roll >= 19) return { delta: 3, label: '超常发挥' };
  if (roll >= 15) return { delta: 1, label: '把住了节奏' };
  if (roll <= 2) return { delta: -3, label: '失了手' };
  if (roll <= 6) return { delta: -1, label: '节奏迟滞' };
  return { delta: 0, label: '常态发挥' };
}

function resolveTier(total) {
  if (total >= 16) return 'great';
  if (total >= 11) return 'good';
  if (total >= 8) return 'mixed';
  return 'fail';
}

function buildBattleNumbers(state, mode, targetFaction) {
  const stats = state.gameState;
  const factionPressure = targetFaction ? Math.floor(targetFaction.power / 14) + Math.floor(targetFaction.hostility / 18) : 4;
  const enemyBase = 6 + state.world.mainline.currentActIndex * 2 + state.world.pressure + factionPressure;
  const playerBase = average([
    stats.attack,
    stats.military,
    stats.conquest + 1,
    Math.floor(stats.troops / 10) + 1,
    Math.floor(stats.morale / 10),
    Math.floor(stats.supplies / 12)
  ]);

  const modeModifier = {
    drill: { player: 2, enemy: -2 },
    skirmish: { player: Math.floor(stats.agility / 4), enemy: 0 },
    field: { player: Math.floor(stats.morale / 12), enemy: 2 },
    siege: { player: Math.floor(stats.supplies / 15) - 1, enemy: 4 },
    defense: { player: Math.floor(stats.defense / 3), enemy: 1 }
  }[mode] || { player: 0, enemy: 0 };

  return {
    playerStrength: playerBase + modeModifier.player,
    enemyStrength: enemyBase + modeModifier.enemy,
    mode
  };
}

function createBattleEffects(mode, tier) {
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
    supplies: 0,
    influence: 0
  };

  const base = {
    drill: {
      great: { military: 2, morale: 8, fatigue: 5, troops: 10, supplies: -4, influence: 1 },
      good: { military: 1, morale: 5, fatigue: 6, troops: 4, supplies: -5, influence: 0 },
      mixed: { military: 1, morale: 1, fatigue: 8, troops: 0, supplies: -6, influence: 0 },
      fail: { morale: -5, fatigue: 10, troops: -3, supplies: -6, influence: -1 }
    },
    skirmish: {
      great: { conquest: 1, morale: 10, fatigue: 8, troops: 4, renown: 3, supplies: -5, influence: 2 },
      good: { conquest: 1, morale: 4, fatigue: 10, troops: -1, renown: 1, supplies: -6, influence: 1 },
      mixed: { morale: -2, fatigue: 12, troops: -6, health: -6, supplies: -7, influence: 0 },
      fail: { morale: -10, fatigue: 16, troops: -12, health: -10, supplies: -9, renown: -1, influence: -1 }
    },
    field: {
      great: { conquest: 2, military: 1, morale: 12, fatigue: 12, troops: 8, renown: 4, supplies: -8, influence: 2 },
      good: { conquest: 1, morale: 6, fatigue: 13, troops: -2, renown: 2, supplies: -9, influence: 1 },
      mixed: { morale: -4, fatigue: 15, troops: -10, health: -8, supplies: -10, renown: 0, influence: 0 },
      fail: { morale: -14, fatigue: 18, troops: -20, health: -14, supplies: -12, renown: -2, influence: -2 }
    },
    siege: {
      great: { conquest: 2, military: 1, morale: 10, fatigue: 15, troops: -4, renown: 5, supplies: -12, influence: 3 },
      good: { conquest: 1, morale: 3, fatigue: 16, troops: -10, renown: 2, supplies: -13, influence: 1 },
      mixed: { morale: -6, fatigue: 18, troops: -16, health: -10, supplies: -15, renown: -1, influence: 0 },
      fail: { morale: -16, fatigue: 22, troops: -28, health: -16, supplies: -18, renown: -3, influence: -2 }
    },
    defense: {
      great: { military: 1, morale: 10, fatigue: 10, troops: 2, renown: 3, supplies: -6, influence: 2 },
      good: { morale: 5, fatigue: 12, troops: -2, renown: 1, supplies: -7, influence: 1 },
      mixed: { morale: -3, fatigue: 14, troops: -8, health: -6, supplies: -8, influence: 0 },
      fail: { morale: -12, fatigue: 17, troops: -18, health: -12, supplies: -10, renown: -2, influence: -1 }
    }
  };

  return Object.assign(effects, base[mode][tier]);
}

function createNonWarEffects(intent, tier) {
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
    supplies: 0,
    influence: 0
  };

  switch (intent) {
    case 'domestic':
      effects.domestic = tier === 'great' ? 2 : 1;
      effects.coins = tier === 'great' ? 18 : tier === 'good' ? 10 : tier === 'mixed' ? 4 : -8;
      effects.supplies = tier === 'great' ? 10 : tier === 'good' ? 6 : tier === 'mixed' ? 2 : -6;
      effects.renown = tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
      effects.influence = tier === 'fail' ? -1 : 1;
      break;
    case 'diplomacy':
      effects.diplomacy = tier === 'great' ? 2 : 1;
      effects.charm = tier === 'great' ? 1 : 0;
      effects.renown = tier === 'great' ? 3 : tier === 'good' ? 1 : 0;
      effects.influence = tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
      break;
    case 'romance':
      effects.romance = tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
      effects.charm = tier === 'great' ? 1 : 0;
      break;
    case 'trade':
      effects.coins = tier === 'great' ? 28 : tier === 'good' ? 14 : tier === 'mixed' ? 6 : -10;
      effects.supplies = tier === 'great' ? 10 : tier === 'good' ? 5 : tier === 'mixed' ? 2 : -4;
      effects.domestic = tier === 'great' ? 1 : 0;
      effects.influence = tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
      break;
    case 'intrigue':
      effects.defense = tier === 'great' ? 1 : 0;
      effects.diplomacy = tier === 'great' ? 1 : 0;
      effects.fatigue = tier === 'fail' ? 8 : 5;
      effects.influence = tier === 'great' ? 1 : 0;
      break;
    case 'investigate':
      effects.defense = tier === 'great' ? 1 : 0;
      effects.fatigue = tier === 'fail' ? 5 : 2;
      break;
    case 'travel':
      effects.health = tier === 'fail' ? -8 : -3;
      effects.agility = tier === 'great' ? 1 : 0;
      effects.supplies = tier === 'great' ? -2 : -5;
      effects.fatigue = tier === 'great' ? 4 : 7;
      break;
    case 'recover':
      effects.health = tier === 'great' ? 18 : tier === 'good' ? 10 : 6;
      effects.fatigue = tier === 'great' ? -18 : tier === 'good' ? -12 : -6;
      effects.morale = tier === 'great' ? 8 : tier === 'good' ? 4 : 1;
      break;
    case 'guidance':
      effects.defense = 1;
      effects.diplomacy = 1;
      effects.fatigue = -4;
      break;
    default:
      effects.renown = tier === 'great' ? 1 : 0;
      break;
  }

  return effects;
}

function buildWarSummary(mode, tier, varianceLabel, targetFaction) {
  const modeLabel = {
    drill: '整军操练',
    skirmish: '遭遇战',
    field: '野战',
    siege: '攻坚战',
    defense: '守御战'
  }[mode] || '战事';
  const enemy = targetFaction ? `对手是“${targetFaction.name}”` : '对手的旗号尚未完全看清';
  const map = {
    great: `${modeLabel}被你打成了可供扩势的一手，${enemy}也不得不正眼看你。`,
    good: `${modeLabel}落得不差，${enemy}这一回没能把你压回去。`,
    mixed: `${modeLabel}只算勉强撑住，${enemy}的压力并没有真正散开。`,
    fail: `${modeLabel}失了先手，${enemy}趁势把局面又压低了一层。`
  };
  return `${map[tier]}这回属于“${varianceLabel}”。`;
}

function buildGeneralSummary(intent, tier, varianceLabel) {
  const label = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const map = {
    great: `这一步“${label}”压得很稳，局势被你掰出了一道口子。`,
    good: `这一步“${label}”落得不差，局势开始朝你偏转。`,
    mixed: `这一步“${label}”勉强撑住，但裂缝并没有真正合上。`,
    fail: `这一步“${label}”没有落稳，反而让暗处多了一层压力。`
  };
  return `${map[tier]}这回属于“${varianceLabel}”。`;
}

function resolveWarAction(state, intent, actionText) {
  const targetFaction = findFactionByText(state, actionText) || getMostHostileFaction(state) || getLeadFaction(state);
  const mode = detectBattleMode(actionText, intent);
  const battle = buildBattleNumbers(state, mode, targetFaction);
  const roll = 1 + Math.floor(Math.random() * 20);
  const variance = getVariance(roll);
  const total = battle.playerStrength - battle.enemyStrength + variance.delta + (state.world.mainline.focus.includes(intent) ? 1 : 0);
  const tier = resolveTier(total + 10);
  const effects = createBattleEffects(mode, tier);
  const casualties = Math.max(0, -effects.troops);
  const supplyCost = Math.max(0, -effects.supplies);

  return {
    type: 'war',
    mode,
    roll,
    variance,
    tier,
    total,
    effects,
    targetFactionId: targetFaction ? targetFaction.id : '',
    battle,
    casualties,
    supplyCost,
    summary: buildWarSummary(mode, tier, variance.label, targetFaction),
    promptLine: `本地军略裁定：模式=${mode}，我方战力=${battle.playerStrength}，敌方战力=${battle.enemyStrength}，波动=${variance.label}，最终压差=${total}，结果=${tier}，折损兵力=${casualties}，消耗军需=${supplyCost}。`
  };
}

function resolveSocialTarget(state, intent, actionText) {
  if (intent === 'diplomacy' || intent === 'trade') {
    return findFactionByText(state, actionText) || getMostPromisingFaction(state) || getLeadFaction(state);
  }
  if (intent === 'intrigue' || intent === 'investigate') {
    return findFactionByText(state, actionText) || getMostHostileFaction(state) || getLeadFaction(state);
  }
  return findFactionByText(state, actionText) || null;
}

function resolveGeneralAction(state, intent, actionText) {
  const targetFaction = resolveSocialTarget(state, intent, actionText);
  const roll = 1 + Math.floor(Math.random() * 20);
  const variance = getVariance(roll);
  const stats = state.gameState;
  const base = {
    domestic: average([stats.domestic, stats.defense, Math.floor(stats.supplies / 10)]),
    diplomacy: average([stats.diplomacy, stats.charm, Math.floor((stats.renown + stats.influence) / 3)]),
    romance: average([stats.romance + 2, stats.charm, Math.floor((stats.influence + 4) / 3)]),
    trade: average([stats.diplomacy, Math.floor(stats.coins / 12), Math.floor(stats.supplies / 10)]),
    intrigue: average([stats.diplomacy, stats.defense, stats.agility]),
    investigate: average([stats.defense, stats.agility, Math.floor(stats.influence / 3) + 2]),
    travel: average([stats.agility, stats.conquest + 1, Math.floor(stats.morale / 12)]),
    recover: average([Math.floor(stats.health / 10), Math.floor((100 - stats.fatigue) / 10), Math.floor(stats.supplies / 12)]),
    guidance: average([stats.diplomacy, stats.defense, stats.charm]),
    unknown: average([stats.attack, stats.defense, stats.agility])
  }[intent] || average([stats.attack, stats.defense, stats.agility]);

  let modifier = 0;
  if (state.world.mainline.focus.includes(intent)) modifier += 2;
  if (stats.health < 45 && ['travel', 'intrigue'].includes(intent)) modifier -= 1;
  if (stats.fatigue > 55 && ['travel', 'intrigue', 'diplomacy'].includes(intent)) modifier -= 2;
  if (targetFaction && targetFaction.favor > 20 && ['diplomacy', 'trade'].includes(intent)) modifier += 1;
  if (targetFaction && targetFaction.hostility > 55 && ['diplomacy', 'trade'].includes(intent)) modifier -= 2;

  const total = base + modifier + variance.delta;
  const tier = resolveTier(total);
  const effects = createNonWarEffects(intent, tier);

  return {
    type: getResolutionType(intent),
    mode: '',
    roll,
    variance,
    tier,
    total,
    effects,
    targetFactionId: targetFaction ? targetFaction.id : '',
    battle: null,
    casualties: 0,
    supplyCost: 0,
    summary: buildGeneralSummary(intent, tier, variance.label),
    promptLine: `本地规则裁定：基础值=${base}，环境修正=${modifier}，波动=${variance.label}，最终总值=${total}，结果=${tier}${targetFaction ? `，主要牵动势力=${targetFaction.name}` : ''}。`
  };
}

function resolveAction(state, intent, actionText) {
  if (['military', 'conquest'].includes(intent)) {
    return resolveWarAction(state, intent, actionText);
  }
  return resolveGeneralAction(state, intent, actionText);
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
  stats.influence = clamp(stats.influence + effects.influence, 0, 100);
}

module.exports = {
  resolveAction,
  applyResolution
};
