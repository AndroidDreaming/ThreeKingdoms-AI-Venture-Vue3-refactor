const {
  BACKGROUNDS,
  CITIES,
  SECTS,
  clamp,
  createId,
  createDateLabel,
  applyBackgroundSelection,
  applyOriginSelection,
  createActionChoices,
  ensureMainline,
  findCity,
  findSect,
  findCitySects,
  buildTravelPlan,
  evaluateSectEligibility,
  battleAccessInfo,
  syncWorldMap,
  applyMartialSnapshot,
  applyPathSnapshot,
  getMartialPath,
  getStrategyPath,
  stanceForFaction
} = require('./chronicleV5StateFactory');
const {
  STAT_NARRATIVE_RULES,
  STAT_IMPACT_PRIORITY,
  getActionOutcomeRule
} = require('./chronicleV5ActionConfig');
const {
  ensureMemoryState,
  normalizeThreadEntry,
  domainOfAction,
  recordStructuredTurn,
  buildRecallBundle,
  recordSelectedDynamicChoice
} = require('./chronicleV5Memory');
const {
  ensureLifecycleState,
  registerTurnProgress,
  evaluateEnding,
  applyEndingState
} = require('./chronicleV5Endgame');
const {
  ensureHistoricalState,
  applyHistoricalTurn,
  buildHistoricalNarrativeBundle,
  historicalDeviationAccessForRelation
} = require('./chronicleV5HistoricalEventManager');
const {
  ensureEncounterState,
  resolveEncounterOutcome,
  advanceEncounterArcs,
  encounterBreakthroughMarks
} = require('./chronicleV5EncounterSystem');
const {
  startBattleEncounter,
  resolveBattleCommand
} = require('./chronicleV5BattleSystem');
const { MARTIAL_BOTTLENECKS } = require('./chronicleV5ProgressionConfig');
const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCoreSafe');
const { normalizeNarrationText } = require('./chronicleV5NarrationGuard');
const {
  normalizeSkillRecord,
  applySkillScoreBonus,
  applySkillDeltaBonus,
  summarizeSkillFeedback
} = require('./chronicleV5SkillSystem');
const {
  unlockExtraCharactersForTravel,
  unlockExtraCharactersForAction
} = require('./chronicleV5ExtraCharacterPool');
const {
  ensureRetinueState,
  validateRetinueActionAvailability,
  applyRetinuePassiveBonus,
  resolveRetinueAction,
  recruitProbeStage,
  recruitInclination
} = require('./chronicleV5RetinueSystem');
const { TEAM_ACTION_DEFINITIONS } = require('../config/chronicle.retinue.config');
const { syncHistoricalRelationPresence } = require('./chronicleV5HistoricalPresenceConfig');
const {
  buildPromptStateBundle,
  stringifyPromptStateBundle
} = require('./chronicleV5PromptStateBundleFocused');
const {
  buildNarrationContext,
  buildChoiceContext
} = require('./chronicleV5ContextAssembler');
const { findRelationAliasHit } = require('./chronicleV5RelationMatcher');
const {
  isRelationMet,
  relationVisibilityState,
  withRelationVisibility
} = require('./chronicleV5RelationVisibility');
const {
  ensureCityState,
  applyCityTurn,
  historicalRecruitAccess,
  currentCityState,
  markCityCaptured,
  setCityAuthority,
  authorityRank,
  authorityLabel
} = require('./chronicleV5CitySystem');
const { applyWorldFermentation } = require('./chronicleV5WorldFermentation');
const { applyWorldPerception } = require('./chronicleV5WorldPerception');
const {
  FOOD_DEFINITIONS,
  getFoodDefinition,
  cloneFoodItem
} = require('./chronicleV5FoodConfig');
const { buildTurnConsequenceLedger } = require('./chronicleV5TurnConsequences');
const { applyConsequencesToSoftState, ensureSoftState } = require('./chronicleV5SoftState');

function pickOne(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

function isRelationVisible(relation) {
  return !!relation && isRelationMet(relation);
}

function refreshHistoricalRelations(state) {
  const gs = state && state.gameState ? state.gameState : null;
  const world = state && state.world ? state.world : null;
  if (!gs || !world || !Array.isArray(gs.relationships) || !gs.relationships.length) {
    return { unlocked: [] };
  }
  const synced = syncHistoricalRelationPresence(gs.relationships, {
    cityId: world.currentCityId || '',
    year: world.year || 196,
    preserveDiscovery: true
  });
  gs.relationships = synced.relationships;
  return synced;
}

function encounterCharacterPacing(state) {
  const encounters = ensureEncounterState(state);
  if (!encounters.characterPacing || typeof encounters.characterPacing !== 'object') {
    encounters.characterPacing = { lastFormalTurn: 0, lastRumorTurn: 0 };
  }
  if (!Number.isFinite(Number(encounters.characterPacing.lastFormalTurn))) encounters.characterPacing.lastFormalTurn = 0;
  if (!Number.isFinite(Number(encounters.characterPacing.lastRumorTurn))) encounters.characterPacing.lastRumorTurn = 0;
  return encounters.characterPacing;
}

function noteRumorReveal(state) {
  const pacing = encounterCharacterPacing(state);
  pacing.lastRumorTurn = Number(state && state.world && state.world.turn || 0);
}

function canFormalizeRelation(state, relation) {
  if (!relation || isRelationMet(relation)) return false;
  const pacing = encounterCharacterPacing(state);
  const turn = Number(state && state.world && state.world.turn || 0);
  if (!Number(pacing.lastFormalTurn || 0)) return true;
  return (turn - Number(pacing.lastFormalTurn || 0)) >= 3;
}

function noteFormalReveal(state) {
  const pacing = encounterCharacterPacing(state);
  pacing.lastFormalTurn = Number(state && state.world && state.world.turn || 0);
}

function promoteRelationToMet(state, relationId) {
  const gs = state && state.gameState ? state.gameState : null;
  if (!gs || !Array.isArray(gs.relationships)) {
    return { relationships: [], unlocked: [] };
  }
  const relation = gs.relationships.find((item) => item && item.id === relationId);
  if (!relation || isRelationMet(relation) || !canFormalizeRelation(state, relation)) {
    return { relationships: gs.relationships, unlocked: [] };
  }

  if (relation.isExtraCharacter) {
    const promoted = unlockExtraCharactersForAction(
      gs.relationships,
      state && state.world ? state.world.currentCityId || '' : '',
      '',
      1,
      relationId
    );
    if (promoted.unlocked.length) noteFormalReveal(state);
    return promoted;
  }

  const next = gs.relationships.map((item) => {
    if (!item || item.id !== relationId) return item;
    return Object.assign({}, withRelationVisibility(item, 'met'), {
      trust: Math.max(3, Number(item.trust || 0)),
      loyalty: Math.max(1, Number(item.loyalty || 0)),
      intimacyTag: item.intimacyTag || '初识',
      status: item.status || '这次顺线追下去之后，我终于真正和此人接上了头。'
    });
  });
  noteFormalReveal(state);
  return {
    relationships: next,
    unlocked: [{
      id: relation.id,
      name: relation.name || relation.id,
      title: relation.title || '',
      revealState: 'met'
    }]
  };
}

function discoverActionContacts(state, action, tier) {
  const gs = state && state.gameState ? state.gameState : null;
  const world = state && state.world ? state.world : null;
  if (!gs || !world || !Array.isArray(gs.relationships) || tier === 'fail') {
    return { relationships: Array.isArray(gs && gs.relationships) ? gs.relationships : [], unlocked: [] };
  }

  const kind = String(action && action.kind || '').trim();
  const mode = String(action && action.mode || '').trim();
  const allowed = kind === 'jianghu'
    || kind === 'spar'
    || (kind === 'investigate' && mode === 'jianghu_clue');
  if (!allowed) {
    if (action && action.target) {
      return promoteRelationToMet(state, action.target);
    }
    return { relationships: gs.relationships, unlocked: [] };
  }

  if (action && action.target) {
    return promoteRelationToMet(state, action.target);
  }
  return { relationships: gs.relationships, unlocked: [] };
}

function pickBySeed(list, seed) {
  if (!Array.isArray(list) || !list.length) return '';
  const normalized = Math.abs(Number(seed) || 0);
  return list[normalized % list.length];
}

function actionDisplayText(action) {
  const explicit = String(action.raw || '').trim();
  if (explicit.startsWith('battlecmd:')) {
    const command = explicit.split(':')[1] || '';
    return {
      spearhead: '锋矢突进',
      fortify: '方圆固守',
      harry: '雁行游击',
      fire: '火计奇袭',
      rally: '整军鼓舞',
      champion: '主将陷阵',
      strike: '抢攻进手',
      guard: '沉气守势',
      channel: '提气运功',
      footwork: '身法游走',
      finisher: '绝招爆发'
    }[command] || explicit;
  }
  if (explicit && !/^(action|travel|joinsect|origin|background):/.test(explicit)) return explicit;
  if (action.targetName && action.kind === 'background') return `选择${action.targetName}出身`;
  if (action.targetName && action.kind === 'origin') return `选定${action.targetName}为落脚之地`;
  if (action.targetName && action.kind === 'social' && action.mode === 'alliance') return `与${action.targetName}结盟相托`;
  if (action.targetName && action.kind === 'social' && action.mode === 'retinue_talk') return `找${action.targetName}谈事`;
  if (action.targetName && action.kind === 'social' && action.mode === 'retinue_companion') return `与${action.targetName}同行`;
  if (action.targetName && action.kind === 'social') return `拜访${action.targetName}`;
  if (action.targetName && action.kind === 'romance' && action.mode === 'promise') return `向${action.targetName}表明心迹`;
  if (action.targetName && action.kind === 'romance' && action.mode === 'bond') return `与${action.targetName}共担风雨`;
  if (action.targetName && action.kind === 'romance' && action.mode === 'daily') return `与${action.targetName}相伴日常`;
  if (action.targetName && action.kind === 'romance' && action.mode === 'companion') return `携${action.targetName}同行`;
  if (action.targetName && action.kind === 'romance' && action.mode === 'jealousy') return `安抚${action.targetName}吃醋`;
  if (action.targetName && action.kind === 'romance' && action.mode === 'approach') return `借灯靠近${action.targetName}`;
  if (action.targetName && action.kind === 'romance') return `试探${action.targetName}`;
  if (action.targetName && action.kind === 'investigate' && action.mode === 'counsel') return `向${action.targetName}问策`;
  if (action.targetName && action.kind === 'investigate' && action.mode === 'retinue_counsel') return `向${action.targetName}问策`;
  if (action.targetName && action.kind === 'investigate' && action.mode === 'historical_lead') return `顺线接触${action.targetName}`;
  if (action.targetName && action.kind === 'warpath' && action.mode === 'join') return `投向${action.targetName}军中`;
  if (action.targetName && action.kind === 'warpath' && action.mode === 'counsel') return `向${action.targetName}进言献策`;
  if (action.targetName && action.kind === 'warpath' && action.mode === 'assist') return `随${action.targetName}助战`;
  if (action.targetName && action.kind === 'warpath' && action.mode === 'logistics') return `替${action.targetName}押运军需`;
  if (action.targetName && action.kind === 'warpath') return `接近${action.targetName}军中`;
  if (action.targetName && action.kind === 'martial' && action.mode === 'mentor') return `向${action.targetName}讨教武艺`;
  if (action.targetName && action.kind === 'social' && action.mode === 'recruit_probe') return `试探${action.targetName}入队`;
  if (action.targetName && action.kind === 'social' && action.mode === 'recruit') return `延揽${action.targetName}入队`;
  if (action.targetName && action.kind === 'military' && action.mode === 'seize_city') return `攻取${action.targetName}`;
  if (action.targetName && /^appoint_/.test(String(action.mode || ''))) {
    const slotLabel = {
      appoint_steward: '内务',
      appoint_quartermaster: '军需',
      appoint_counselor: '参议',
      appoint_spymaster: '暗线',
      appoint_scout: '耳目',
      appoint_escort: '护行',
      appoint_drillmaster: '教头',
      appoint_vanguard: '先锋'
    }[action.mode] || '职司';
    return `任${action.targetName}掌${slotLabel}`;
  }
  if (action.targetName && action.kind === 'spar') return `与${action.targetName}切磋喂招`;
  if (action.kind === 'investigate' && action.mode === 'jianghu_clue') return '追江湖风声';
  if (action.kind === 'investigate' && action.mode === 'historical_lead') return '追史实人物线索';
  if (action.kind === 'warpath' && action.mode === 'join') return '投军挂名';
  if (action.kind === 'warpath' && action.mode === 'counsel') return '入幕进言';
  if (action.kind === 'warpath' && action.mode === 'assist') return '随军助战';
  if (action.kind === 'warpath' && action.mode === 'logistics') return '押送军需';
  if (action.kind === 'social' && action.mode === 'retinue_talk') return '找幕下某人谈事';
  if (action.kind === 'social' && action.mode === 'retinue_companion') return '点幕下某人同行';
  if (action.kind === 'romance' && action.mode === 'daily') return '陪心上人过一段日常';
  if (action.kind === 'romance' && action.mode === 'companion') return '与心上人同行';
  if (action.kind === 'romance' && action.mode === 'jealousy') return '安抚心上人的酸意';
  if (action.kind === 'investigate' && action.mode === 'retinue_counsel') return '向幕下某人问策';
  if (action.kind === 'sect' && action.mode === 'cipher') return '解门中秘闻';
  if (action.mode === 'audit') return '盘账整饷';
  if (action.mode === 'stewardship') return '争取城池代治';
  if (action.mode === 'stabilize') return '安民肃吏';
  if (action.mode === 'warehouse') return '盘货试商路';
  if (action.mode === 'market_town') return '整饬市路';
  if (action.mode === 'banquet') return '投帖会面';
  if (action.mode === 'notables') return '拜会官署';
  if (action.mode === 'terrain') return '踩点探地脉';
  if (action.mode === 'garrison') return '整顿城防';
  if (action.mode === 'salon') return '设宴结社';
  if (action.mode === 'rumor') return '放风试口';
  if (action.mode === 'solo') return '闭门磨武';
  if (action.mode === 'inn') return '投店安睡';
  if (action.mode === 'medicate') return '药汤调息';
  if (action.mode === 'teahouse') return '茶楼听书';
  if (action.mode === 'team_logistics') return '调度后勤线';
  if (action.mode === 'team_trade') return '铺开商路网';
  if (action.mode === 'team_probe') return '铺耳目探风向';
  if (action.mode === 'team_layout') return '拆线设回钩';
  if (action.mode === 'team_roam') return '放队友走江湖';
  if (action.mode === 'team_muster') return '整编营中部曲';
  if (action.mode === 'team_parley') return '分头游说定站位';
  if (action.mode === 'team_sect_affairs') return '整饬门内外缘';
  if (action.mode === 'team_recover') return '轮值整补养锐';
  if (action.mode === 'team_martial') return '合练拆招磨路数';
  return {
    govern: '经营根基',
    trade: '筹措钱粮',
    diplomacy: '周旋交涉',
    social: '拜访人物',
    romance: '私下相会',
    martial: '打磨武底',
    military: '练兵整军',
    battle: '沙场试锋',
    investigate: '探查风声',
    intrigue: '布设暗局',
    rest: '休整静养',
    warpath: '压向军旅',
    jianghu: '压向江湖',
    sect: '经营门派',
    spar: '切磋喂招',
    travel: action.targetName ? `前往${action.targetName}` : '动身远行',
    joinsect: action.targetName ? `拜访${action.targetName}` : '投身门派'
  }[action.kind] || explicit || action.kind || '这一步';
}

function advanceMonth(world, delta) {
  let year = world.year;
  let month = world.month + delta;
  while (month > 12) {
    year += 1;
    month -= 12;
  }
  world.year = year;
  world.month = month;
  world.dateLabel = createDateLabel(year, month);
}

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function ensureChoices(state) {
  state.choices = ensureList(state.choices).filter((item) => item && item.id && item.text);
  if (state.world && state.world.phase === 'playing') {
    const fixedChoices = createActionChoices(state).map((item) => ({ ...item, source: item.source || 'fixed' }));
    const dynamicChoices = state.choices.filter((item) => item && item.source === 'dynamic');
    state.choices = dynamicChoices.concat(fixedChoices);
  }
  return state;
}

function getCurrentAct(world) {
  ensureMainline(world);
  const acts = world.mainline.acts || [];
  const index = clamp(world.mainline.currentActIndex || 0, 0, Math.max(0, acts.length - 1));
  return acts[index] || acts[0] || {
    title: '未定主线',
    summary: '先让自己活下去。',
    crisis: '局势还没有真正成形。',
    focus: []
  };
}

const THREAD_DOMAIN_ACTIONS = {
  主线: ['investigate', 'diplomacy', 'govern', 'travel', 'intrigue'],
  人物: ['social', 'diplomacy', 'romance', 'investigate'],
  情感: ['romance', 'social', 'diplomacy'],
  武学: ['martial', 'sect', 'jianghu', 'spar'],
  军旅: ['military', 'warpath', 'battle', 'govern'],
  战事: ['battle', 'warpath', 'military'],
  江湖: ['jianghu', 'martial', 'investigate', 'travel'],
  门派: ['sect', 'joinsect', 'martial', 'social'],
  经营: ['govern', 'trade', 'diplomacy'],
  商路: ['trade', 'travel', 'diplomacy'],
  谋略: ['investigate', 'intrigue', 'diplomacy', 'social'],
  内政: ['govern', 'trade', 'diplomacy'],
  行路: ['travel', 'trade', 'investigate'],
  关系: ['social', 'romance', 'diplomacy'],
  编制: ['social', 'military', 'govern']
};

function threadWindowByUrgency(urgency) {
  return { 1: 5, 2: 4, 3: 3 }[clamp(Number(urgency || 1), 1, 3)] || 4;
}

function defaultThreadFailureConsequences(domain, urgency, state) {
  const normalizedUrgency = clamp(Number(urgency || 1), 1, 3);
  if (domain === '主线') return [{ type: 'pressure', value: 3 + normalizedUrgency, note: '局势继续往坏处自行滚动。' }];
  if (domain === '人物') return [{ type: 'renown', value: -1, note: '人脉窗口一凉，别人先一步占住位置。' }];
  if (domain === '情感') return [{ type: 'influence', value: -1, note: '这层情面一拖再拖，话就没刚才那么好说了。' }];
  if (domain === '武学') return [{ type: 'fatigue', value: 1, note: '武学火候没接上，精气先散了一层。' }];
  if (domain === '军旅') return [{ type: 'morale', value: -2, note: '军心最怕拖，口风一散，部曲就先软下去。' }];
  if (domain === '战事') return [{ type: 'morale', value: -2, note: '战局拖久了，先散掉的是士气和先手。' }];
  if (domain === '江湖') return [{ type: 'jianghu_prestige', value: -1, note: '江湖热度最怕冷，别人会先把名头抢走。' }];
  if (domain === '门派') return [{ type: 'sectFavor', value: -2, note: '门中人情窗口不会一直开着。' }];
  if (domain === '经营') return [{ type: 'coins', value: -2, note: '底盘没压实，眼下就先漏钱。' }];
  if (domain === '商路') return [{ type: 'supplies', value: -2, note: '商路一断，最先掉下去的就是粮秣。' }];
  if (domain === '行路') return [{ type: 'coins', value: -1, note: '拖到后来，盘缠和时机都会先被路上吃掉。' }];
  if (domain === '谋略') return [{ type: 'pressure', value: 2, note: '暗线不接，别人就会先一步把局盘死。' }];
  if (domain === '关系') return [{ type: 'influence', value: -1, note: '关系最怕冷，悬着不理就会先被旁人截胡。' }];
  if (domain === '编制') return [{ type: 'influence', value: -1, note: '再拖一会儿，愿意入队的人就会开始摇摆。' }];
  if (state && state.world && Number(state.world.pressure || 0) >= 48) {
    return [{ type: 'pressure', value: 2, note: '眼下局势太紧，拖延本身就是代价。' }];
  }
  return [];
}

function sortOpenThreads(list) {
  return ensureList(list)
    .filter((item) => item && item.title && item.status !== 'resolved')
    .sort((left, right) => {
      if (Number(right.urgency || 0) !== Number(left.urgency || 0)) {
        return Number(right.urgency || 0) - Number(left.urgency || 0);
      }
      return Number(left.deadlineTurn || 0) - Number(right.deadlineTurn || 0);
    })
    .slice(0, 8);
}

function applyThreadConsequences(state, thread, list) {
  ensureList(list).forEach((item) => {
    const value = Number(item && item.value || 0);
    switch (String(item && item.type || '').trim()) {
      case 'pressure':
        state.world.pressure = clamp(Number(state.world.pressure || 0) + value, 0, 100);
        break;
      case 'renown':
        state.gameState.renown = Math.max(0, Number(state.gameState.renown || 0) + value);
        break;
      case 'influence':
        state.gameState.influence = Math.max(0, Number(state.gameState.influence || 0) + value);
        break;
      case 'morale':
        state.gameState.morale = clamp(Number(state.gameState.morale || 0) + value, 0, 100);
        break;
      case 'fatigue':
        state.gameState.fatigue = clamp(Number(state.gameState.fatigue || 0) + value, 0, 100);
        break;
      case 'coins':
        state.gameState.coins = Math.max(0, Number(state.gameState.coins || 0) + value);
        break;
      case 'supplies':
        state.gameState.supplies = Math.max(0, Number(state.gameState.supplies || 0) + value);
        break;
      case 'sectFavor':
        state.gameState.sectFavor = clamp(Number(state.gameState.sectFavor || 0) + value, 0, 100);
        break;
      case 'jianghu_prestige':
        state.gameState.jianghuPrestige = Math.max(0, Number(state.gameState.jianghuPrestige || 0) + value);
        break;
      case 'battlefield_prestige':
        state.gameState.battlefieldPrestige = Math.max(0, Number(state.gameState.battlefieldPrestige || 0) + value);
        break;
      case 'apex_threat':
        ensureLifecycleState(state);
        state.gameState.martialApex.threat = clamp(Number(state.gameState.martialApex.threat || 0) + value, 0, 100);
        break;
      case 'apex_exposure':
        ensureLifecycleState(state);
        state.gameState.martialApex.exposure = clamp(Number(state.gameState.martialApex.exposure || 0) + value, 0, 100);
        break;
      case 'apex_resolve':
        ensureLifecycleState(state);
        if (item.targetId) {
          state.gameState.martialApex.resolvedCrisisKeys = ensureList(state.gameState.martialApex.resolvedCrisisKeys)
            .concat([String(item.targetId || '').trim()])
            .filter(Boolean)
            .filter((entry, index, source) => source.indexOf(entry) === index)
            .slice(0, 16);
        }
        break;
      case 'faction_hostility':
        if (item.targetId) updateFaction(state, item.targetId, { hostility: value });
        break;
      default:
        break;
    }
  });
  if (thread && thread.ownerFactionId && ensureList(list).length) {
    updateFaction(state, thread.ownerFactionId, {
      hostility: 1 + Math.max(0, Math.round(Number(thread.urgency || 1) / 2))
    });
  }
}

function threadMatchesAction(thread, action) {
  if (!thread || !action) return false;
  const domain = String(thread.domain || '').trim();
  const allowed = THREAD_DOMAIN_ACTIONS[domain];
  if (allowed && allowed.includes(String(action.kind || '').trim())) return true;
  return String(domainOfAction(action.kind)).trim() === domain;
}

function resolveThreadByAction(state, action, outcome) {
  if (!state || !state.memory) return [];
  if (!outcome || outcome.tier === 'fail' || !action || action.kind === 'battlecmd') return [];
  const turn = Number(state.world && state.world.turn || 0);
  const threads = sortOpenThreads(ensureList(state.memory.openThreads).map((item) => normalizeThreadEntry(item, { currentTurn: turn })));
  const resolved = [];
  const remaining = [];
  let spent = false;
  threads.forEach((thread) => {
    if (!spent && threadMatchesAction(thread, action)) {
      spent = true;
      resolved.push(thread);
      return;
    }
    remaining.push(thread);
  });
  if (resolved.length) {
    resolved.forEach((thread) => {
      applyThreadConsequences(state, thread, thread.successConsequences);
      appendSummary(state, `${thread.domain}线“${thread.title}”被我顺手接住，眼下总算没有继续往外漏。`);
    });
  }
  state.memory.openThreads = remaining;
  return resolved;
}

function advanceOpenThreads(state, action, outcome) {
  if (!state || !state.memory) return { resolved: [], expired: [] };
  ensureMemoryState(state.memory);
  const turn = Number(state.world && state.world.turn || 0);
  const resolved = resolveThreadByAction(state, action, outcome);
  const resolvedKeys = new Set(resolved.map((item) => item.key));
  const expired = [];
  const next = [];

  sortOpenThreads(ensureList(state.memory.openThreads).map((item) => normalizeThreadEntry(item, { currentTurn: turn })))
    .forEach((thread) => {
      if (!thread || resolvedKeys.has(thread.key)) return;
      let current = { ...thread, lastAdvancedTurn: turn };
      const turnsLeft = Number(current.deadlineTurn || 0) - turn;
      if (turnsLeft <= 0) {
        expired.push(current);
        applyThreadConsequences(state, current, current.failureConsequences.length
          ? current.failureConsequences
          : defaultThreadFailureConsequences(current.domain, current.urgency, state));
        const rivalLine = current.rivalName ? `${current.rivalName}先一步接住了这一线。` : '这一线已经被别人先一步推动。';
        appendSummary(state, `${current.domain}线“${current.title}”被拖过了窗口，${rivalLine}`);
        return;
      }
      if (turnsLeft <= 1) {
        current = { ...current, urgency: 3, escalationStep: Math.max(Number(current.escalationStep || 0), 2) };
      } else if (turnsLeft <= 2) {
        current = { ...current, urgency: Math.max(2, Number(current.urgency || 1)), escalationStep: Math.max(Number(current.escalationStep || 0), 1) };
      }
      next.push(current);
    });

  state.memory.openThreads = sortOpenThreads(next);
  return { resolved, expired };
}

function appendThread(state, title, urgency, domain, options = {}) {
  ensureMemoryState(state.memory);
  const turn = Number(state.world && state.world.turn || 0);
  const opportunityKey = String(options.opportunityKey || '').trim();
  const existingThread = ensureList(state.memory.openThreads)
    .map((item) => normalizeThreadEntry(item, { currentTurn: turn }))
    .find((item) => item && ((opportunityKey && item.opportunityKey === opportunityKey) || item.title === title));
  const next = normalizeThreadEntry({
    ...(existingThread || {}),
    key: existingThread && existingThread.key ? existingThread.key : createId('thread'),
    title,
    urgency: clamp(urgency, 1, 3),
    domain,
    deadlineTurn: Number(options.deadlineTurn || (existingThread && existingThread.deadlineTurn) || (turn + threadWindowByUrgency(urgency))),
    escalationStep: 0,
    ownerFactionId: String(options.ownerFactionId || (existingThread && existingThread.ownerFactionId) || '').trim(),
    rivalActorId: String(options.rivalActorId || (existingThread && existingThread.rivalActorId) || '').trim(),
    rivalName: String(options.rivalName || (existingThread && existingThread.rivalName) || '').trim(),
    opportunityKey,
    source: String(options.source || '').trim(),
    sourceActionKind: String(options.sourceActionKind || '').trim(),
    successConsequences: ensureList(options.successConsequences).length
      ? options.successConsequences
      : (existingThread && existingThread.successConsequences) || [],
    failureConsequences: ensureList(options.failureConsequences).length
      ? options.failureConsequences
      : ((existingThread && existingThread.failureConsequences) || defaultThreadFailureConsequences(domain, urgency, state)),
    notes: ensureList(options.notes).length ? options.notes : (existingThread && existingThread.notes) || []
  }, { currentTurn: turn });
  const existing = ensureList(state.memory.openThreads)
    .map((item) => normalizeThreadEntry(item, { currentTurn: turn }))
    .filter((item) => item && item.key !== next.key && item.title !== title && (!opportunityKey || item.opportunityKey !== opportunityKey));
  state.memory.openThreads = sortOpenThreads([next].concat(existing));
}

function appendSummary(state, text) {
  ensureMemoryState(state.memory);
  state.memory.summaries = [text].concat(ensureList(state.memory.summaries)).slice(0, 10);
}

function rememberAction(state, action) {
  ensureMemoryState(state.memory);
  const dynamicMeta = action && action.dynamicChoiceMeta && typeof action.dynamicChoiceMeta === 'object'
    ? action.dynamicChoiceMeta
    : {};
  state.memory.recentActions = [
    {
      turn: state.world && state.world.turn ? state.world.turn : ensureList(state.memory.recentActions).length + 1,
      kind: action.kind,
      raw: action.raw,
      mode: action && action.mode ? action.mode : '',
      source: String(action && action.source || dynamicMeta.source || ''),
      domain: domainOfAction(action && action.kind),
      frontierId: String(dynamicMeta.frontierId || ''),
      noveltyKey: String(dynamicMeta.noveltyKey || ''),
      slotRole: String(dynamicMeta.slotRole || ''),
      targetId: String(dynamicMeta.targetId || dynamicMeta.target || action && action.target || ''),
      targetName: String(dynamicMeta.targetName || action && action.targetName || '')
    }
  ].concat(ensureList(state.memory.recentActions)).slice(0, 10);
}

function normalizeFactions(state) {
  state.gameState.factions = ensureList(state.gameState.factions).map((item) => {
    const next = Object.assign({}, item);
    next.favor = clamp(next.favor || 0, -100, 100);
    next.hostility = clamp(next.hostility || 0, 0, 100);
    next.leverage = clamp(next.leverage || 0, 0, 100);
    next.power = clamp(next.power || 0, 0, 100);
    next.stance = stanceForFaction(next);
    return next;
  });
}

function getFaction(state, factionId) {
  return ensureList(state.gameState.factions).find((item) => item.id === factionId) || null;
}

function getLocalFaction(state) {
  const city = findCity(state.world.currentCityId);
  return city ? getFaction(state, city.localFactionId) : null;
}

function getMostHostileFaction(state) {
  return ensureList(state.gameState.factions)
    .slice()
    .sort((a, b) => (b.hostility + b.power) - (a.hostility + a.power))[0] || null;
}

function getMostFriendlyFaction(state) {
  return ensureList(state.gameState.factions)
    .slice()
    .sort((a, b) => (b.favor + b.leverage) - (a.favor + a.leverage))[0] || null;
}

function updateFaction(state, factionId, patch) {
  state.gameState.factions = ensureList(state.gameState.factions).map((item) => {
    if (item.id !== factionId) return item;
    return {
      ...item,
      favor: clamp((item.favor || 0) + (patch.favor || 0), -100, 100),
      hostility: clamp((item.hostility || 0) + (patch.hostility || 0), 0, 100),
      leverage: clamp((item.leverage || 0) + (patch.leverage || 0), 0, 100),
      power: clamp((item.power || 0) + (patch.power || 0), 0, 100)
    };
  });
  normalizeFactions(state);
}

function getRelation(state, relationId) {
  return ensureList(state.gameState.relationships).find((item) => item.id === relationId) || null;
}

function relationFavorScore(relation) {
  if (!relation) return 0;
  const trust = Number(relation.trust || 0);
  const affection = Number(relation.affection || 0);
  const loyalty = Number(relation.loyalty || 0);
  const rivalry = Number(relation.rivalry || 0);
  return clamp(Math.round(trust * 0.5 + affection * 1.2 + loyalty * 0.35 - rivalry * 0.85), 0, 100);
}

function relationRomanceStage(relation) {
  const trust = Number(relation && relation.trust || 0);
  const affection = Number(relation && relation.affection || 0);
  const rivalry = Number(relation && relation.rivalry || 0);
  const favor = relationFavorScore(relation);
  if (rivalry >= 45) return '未启';
  if (affection >= 70 && trust >= 48) return '定情';
  if (affection >= 42 && favor >= 58 && trust >= 28) return '暧昧';
  if (favor >= 36 && trust >= 14) return '近身';
  return '未启';
}

function isRomanceCandidate(relation) {
  return !!relation && relationRomanceStage(relation) !== '未启' && Number(relation.rivalry || 0) < 45;
}

function relationGeneralScore(relation) {
  return (relationFavorScore(relation) * 1.35)
    + Number(relation.trust || 0)
    + Number(relation.affection || 0)
    + Number(relation.loyalty || 0)
    - Number(relation.rivalry || 0) * 1.25;
}

function relationRecentAppearancePenalty(state, relation, kind) {
  if (!relation || !relation.id) return 0;
  const recentActions = ensureList(state && state.memory && state.memory.recentActions).slice(0, 5);
  return recentActions.reduce((penalty, item, index) => {
    if (!item || String(item.targetId || '') !== relation.id) return penalty;
    const basePenalty = index === 0 ? 40 : index === 1 ? 24 : 12;
    const sameKindPenalty = String(item.kind || '') === String(kind || '') ? 10 : 0;
    return penalty + basePenalty + sameKindPenalty;
  }, 0);
}

function relationActionAffinityScore(relation, kind, factionId) {
  if (!relation) return -999;
  const tags = ensureList(relation.tags);
  const favor = relationFavorScore(relation);
  const sameFaction = factionId && relation.factionId && relation.factionId === factionId ? 4 : 0;
  const martialRating = Number(relation.martialRating || 0);
  const strategyRating = Number(relation.strategyRating || 0);

  if (kind === 'romance') {
    const stage = relationRomanceStage(relation);
    const stageBonus = stage === '定情' ? 16 : stage === '暧昧' ? 10 : stage === '近身' ? 5 : -8;
    return favor * 1.8 + Number(relation.affection || 0) * 1.6 + Number(relation.trust || 0) + sameFaction + stageBonus;
  }
  if (['martial', 'battle', 'warpath', 'jianghu', 'military'].includes(kind)) {
    return relationGeneralScore(relation) + martialRating * 1.4 + (tags.some((item) => ['martial', 'battle', 'warpath', 'frontier', 'military'].includes(item)) ? 18 : 0);
  }
  if (['govern', 'trade', 'diplomacy', 'investigate', 'intrigue'].includes(kind)) {
    return relationGeneralScore(relation) + strategyRating * 1.35 + (tags.some((item) => ['govern', 'trade', 'strategy', 'diplomacy', 'investigate', 'intrigue'].includes(item)) ? 18 : 0);
  }
  return relationGeneralScore(relation) + (tags.includes(kind) ? 12 : 0) + sameFaction;
}

function chooseRelationForAction(state, kind, factionId) {
  const list = ensureList(state.gameState.relationships).filter((item) => isRelationVisible(item));
  if (!list.length) return null;
  const score = (relation) => relationActionAffinityScore(relation, kind, factionId) - relationRecentAppearancePenalty(state, relation, kind);
  if (kind === 'romance') {
    return list
      .filter((item) => item && item.romanceable !== false)
      .filter((item) => !item || item.bondKey !== 'rival')
      .slice()
      .sort((a, b) => score(b) - score(a))[0];
  }
  const tagged = list
    .filter((item) => ensureList(item.tags).includes(kind))
    .sort((a, b) => score(b) - score(a))[0];
  if (tagged) return tagged;
  const byFaction = factionId
    ? list
      .filter((item) => item.factionId === factionId)
      .sort((a, b) => score(b) - score(a))[0]
    : null;
  return byFaction || list.slice().sort((a, b) => score(b) - score(a))[0];
}

function updateRelation(state, relationId, patch) {
  state.gameState.relationships = ensureList(state.gameState.relationships).map((item) => {
    if (item.id !== relationId) return item;
    const trust = clamp((item.trust || 0) + (patch.trust || 0), 0, 100);
    const affection = clamp((item.affection || 0) + (patch.affection || 0), 0, 100);
    const loyalty = clamp((item.loyalty || 0) + (patch.loyalty || 0), 0, 100);
    const rivalry = clamp((item.rivalry || 0) + (patch.rivalry || 0), 0, 100);
    const total = trust + affection + loyalty;
    let intimacyTag = '初识';
    if (total >= 150) intimacyTag = '死生可托';
    else if (total >= 110) intimacyTag = '深交';
    else if (total >= 70) intimacyTag = '可信';
    else if (total >= 40) intimacyTag = '熟络';
    const favorScore = relationFavorScore({
      ...item,
      trust,
      affection,
      loyalty,
      rivalry
    });
    const romanceStage = relationRomanceStage({
      ...item,
      trust,
      affection,
      loyalty,
      rivalry
    });
    const bond = deriveRelationBond({
      ...item,
      trust,
      affection,
      loyalty,
      rivalry,
      intimacyTag,
      favorScore,
      romanceStage
    });
    return {
      ...item,
      trust,
      affection,
      loyalty,
      rivalry,
      status: patch.status || item.status,
      intimacyTag,
      favorScore,
      romanceStage,
      bondKey: bond.key,
      bondLabel: bond.label,
      bondSummary: bond.summary
    };
  });
}

function deriveRelationBond(relation) {
  const tags = ensureList(relation.tags);
  const favorScore = Number(relation.favorScore || relationFavorScore(relation));
  if ((relation.rivalry || 0) >= 55) {
    return { key: 'rival', label: '宿敌', summary: '恩怨已深，这段关系随时可能反噬，也可能逼着我更快出锋。' };
  }
  if (favorScore >= 62 && (relation.affection || 0) >= 34 && (relation.trust || 0) >= 24) {
    return { key: 'lover', label: '恋人', summary: '不再只是利害往来，这段关系会给我温度，也会给我软肋。' };
  }
  if ((relation.loyalty || 0) >= 60 && (relation.trust || 0) >= 55 && tags.some((item) => ['govern', 'strategy', 'diplomacy', 'military', 'trade'].includes(item))) {
    return { key: 'advisor', label: '幕僚', summary: '对方已经不只是在看我，而是在替我补局、献策，甚至替我扛事。' };
  }
  if ((relation.trust || 0) >= 65) {
    return { key: 'confidant', label: '知己', summary: '这段关系已经有了真正的信任，关键时候能替我稳住人心。' };
  }
  return { key: '', label: '未定', summary: '这段关系还在摇摆，离真正定型还差火候。' };
}

function applyRelationBondActionModifier(relation, actionKind, delta, resolved) {
  if (!relation || !relation.bondKey) return delta;
  const next = { ...delta };
  if (relation.bondKey === 'confidant' && ['social', 'diplomacy', 'investigate'].includes(actionKind) && resolved.tier !== 'fail') {
    next.influence = (next.influence || 0) + 1;
  }
  if (relation.bondKey === 'advisor' && ['govern', 'trade', 'military', 'investigate', 'intrigue'].includes(actionKind) && resolved.tier !== 'fail') {
    next.strategy = (next.strategy || 0) + 1;
    next.influence = (next.influence || 0) + 1;
  }
  if (relation.bondKey === 'lover' && ['romance', 'social', 'rest'].includes(actionKind) && resolved.tier !== 'fail') {
    next.morale = (next.morale || 0) + 2;
    next.charm = (next.charm || 0) + 1;
  }
  if (relation.bondKey === 'rival' && ['battle', 'jianghu', 'intrigue'].includes(actionKind)) {
    next.renown = (next.renown || 0) + 1;
    next.fatigue = (next.fatigue || 0) + 1;
  }
  return next;
}

function applyRelationMilestone(state, previousRelation, nextRelation) {
  if (!nextRelation) return;
  const previousKey = previousRelation && previousRelation.bondKey ? previousRelation.bondKey : '';
  const nextKey = nextRelation.bondKey || '';
  if (!nextKey || previousKey === nextKey) return;
  const lines = {
    confidant: `${nextRelation.name}已经能算我的知己。接下来我在人情和暗线上的很多决定，都会因为这份信任而变得不一样。`,
    advisor: `${nextRelation.name}开始以幕僚的身份站进我的局里。之后我的经营、谋略和军务，都会多一双替我补缝的手。`,
    lover: `${nextRelation.name}和我的关系已经越过普通往来，成了真正会牵动心绪的人。温度来了，软肋也来了。`,
    rival: `${nextRelation.name}和我的恩怨已经成形。以后我们每一次再撞上，都会比现在更容易卷出大动静。`
  };
  if (lines[nextKey]) appendThread(state, lines[nextKey], nextKey === 'rival' ? 3 : 2, '关系');
}

function markRelationRecruitProbe(state, relationId, tier) {
  if (!state || !state.gameState || !Array.isArray(state.gameState.relationships) || !relationId) return;
  const stageGain = tier === 'great' ? 2 : tier === 'good' ? 1 : tier === 'mixed' ? 1 : 0;
  const inclinationGain = tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
  const relationBonus = {
    trust: tier === 'great' ? 2 : tier === 'good' ? 1 : tier === 'mixed' ? 1 : 0,
    loyalty: tier === 'great' ? 1 : tier === 'good' ? 1 : 0,
    affection: tier === 'great' ? 1 : 0
  };
  state.gameState.relationships = state.gameState.relationships.map((item) => {
    if (!item || item.id !== relationId) return item;
    const baseInclination = recruitInclination(item);
    const baseStage = recruitProbeStage(item);
    return Object.assign({}, item, {
      retinueRecruitStage: Math.min(3, baseStage + stageGain),
      retinueRecruitInclination: Math.min(12, baseInclination + inclinationGain),
      trust: Number(item.trust || 0) + relationBonus.trust,
      loyalty: Number(item.loyalty || 0) + relationBonus.loyalty,
      affection: Number(item.affection || 0) + relationBonus.affection
    });
  });
}

function normalizedRelationRecruitJourney(relation) {
  const raw = relation && relation.retinueRecruitJourney && typeof relation.retinueRecruitJourney === 'object'
    ? relation.retinueRecruitJourney
    : {};
  return {
    rapport: Math.max(0, Number(raw.rapport || 0)),
    counsel: Math.max(0, Number(raw.counsel || 0)),
    diplomacy: Math.max(0, Number(raw.diplomacy || 0)),
    trade: Math.max(0, Number(raw.trade || 0)),
    warpath: Math.max(0, Number(raw.warpath || 0)),
    logistics: Math.max(0, Number(raw.logistics || 0)),
    martial: Math.max(0, Number(raw.martial || 0)),
    jianghu: Math.max(0, Number(raw.jianghu || 0)),
    historical: Math.max(0, Number(raw.historical || 0)),
    probe: Math.max(0, Number(raw.probe || 0)),
    promise: Math.max(0, Number(raw.promise || 0)),
    bond: Math.max(0, Number(raw.bond || 0)),
    daily: Math.max(0, Number(raw.daily || 0)),
    companion: Math.max(0, Number(raw.companion || 0)),
    jealousy: Math.max(0, Number(raw.jealousy || 0)),
    teamwork: Math.max(0, Number(raw.teamwork || 0))
  };
}

function buildRelationRecruitJourneyPatch(action, tier) {
  if (!action) return {};
  const success = tier !== 'fail';
  const patch = {};
  const add = (key, amount = 1) => {
    if (!amount) return;
    patch[key] = Number(patch[key] || 0) + amount;
  };

  if (action.kind === 'social') {
    add('rapport');
    if (['visit', 'banquet', 'salon', 'alliance'].includes(String(action.mode || '')) && success) add('diplomacy');
    if (action.mode === 'recruit_probe') add('probe');
    if (action.mode === 'recruit' && success) add('teamwork');
    if (action.mode === 'retinue_talk' && success) add('rapport', 2);
    if (action.mode === 'retinue_companion' && success) {
      add('rapport');
      add('teamwork', 2);
    }
  }

  if (action.kind === 'diplomacy' && success) {
    add('rapport');
    add('diplomacy');
  }

  if (action.kind === 'investigate' && success) {
    add('counsel');
    if (action.mode === 'historical_lead') add('historical');
    if (action.mode === 'retinue_counsel') add('counsel', 2);
  }

  if (action.kind === 'trade' && success) add('trade');
  if (action.kind === 'govern' && success) add('trade');

  if (action.kind === 'romance' && success) {
    add('rapport');
    if (action.mode === 'promise') add('promise');
    if (action.mode === 'bond') add('bond');
    if (action.mode === 'daily') add('daily');
    if (action.mode === 'companion') add('companion');
    if (action.mode === 'jealousy') add('jealousy');
  }

  if (action.kind === 'martial' && success) add('martial');
  if (action.kind === 'jianghu' && success) add('jianghu');

  if (action.kind === 'warpath' && success) {
    add('warpath');
    if (action.mode === 'counsel') add('counsel');
    if (action.mode === 'assist') add('martial');
    if (['logistics', 'outpost'].includes(String(action.mode || ''))) add('logistics');
  }

  return patch;
}

function markRelationRecruitJourney(state, relationId, action, tier) {
  if (!state || !state.gameState || !Array.isArray(state.gameState.relationships) || !relationId) return;
  const patch = buildRelationRecruitJourneyPatch(action, tier);
  if (!Object.keys(patch).length) return;
  state.gameState.relationships = state.gameState.relationships.map((item) => {
    if (!item || item.id !== relationId) return item;
    const current = normalizedRelationRecruitJourney(item);
    const nextJourney = Object.keys(patch).reduce((result, key) => {
      result[key] = Number(result[key] || 0) + Number(patch[key] || 0);
      return result;
    }, { ...current });
    return Object.assign({}, item, {
      retinueRecruitJourney: nextJourney
    });
  });
}

function buildRelationStatus(kind, tier, relation, mode = '') {
  const name = relation && relation.name ? relation.name : '对方';
  const romanceStage = relationRomanceStage(relation);
  if (kind === 'social' && mode === 'alliance') {
    return tier === 'fail'
      ? `${name}没有接下我递过去的筹码，态度反而比先前更谨慎了些。`
      : `${name}开始认真衡量是否把筹码与后手压向我这边，这段关系已经不只是走动而已。`;
  }
  if (kind === 'social' && mode === 'recruit_probe') {
    return tier === 'fail'
      ? `${name}没有把招揽的话头接实，只把分寸重新压回了寻常往来里。`
      : `${name}没有立刻点头，却已经开始认真衡量是否把一部分手脚放到我这边。`;
  }
  if (kind === 'social' && mode === 'retinue_talk') {
    return tier === 'fail'
      ? `${name}这回把话听了，却还没有把真正压心底的那层东西全拿出来。`
      : `${name}愿意把眼前局势和分工同我当面掰开来说，这层幕下关系明显更稳了一些。`;
  }
  if (kind === 'social' && mode === 'retinue_companion') {
    return tier === 'fail'
      ? `${name}没有立刻把同行这一步接实，像是在等我先把眼前局势站稳。`
      : `${name}已经不只是偶尔露面，而是肯贴着我的行程和事务一起进退了。`;
  }
  if (kind === 'investigate' && mode === 'counsel') {
    return tier === 'fail'
      ? `${name}没有把压箱底的判断递给我，只把分寸重新收紧。`
      : `${name}肯把真正有分量的判断说给我听，显然已经把我当成能接得住话的人。`;
  }
  if (kind === 'investigate' && mode === 'retinue_counsel') {
    return tier === 'fail'
      ? `${name}这回没有把真正的判断摊到底，只先替我点到了一层表面风险。`
      : `${name}肯把自己手里的后手、顾虑和看法一并递给我，这已经是幕下问策该有的分量了。`;
  }
  if (kind === 'investigate' && mode === 'historical_lead') {
    return tier === 'fail'
      ? `${name}这条史势线暂时还没被我真正接实，只留下一层更谨慎的门槛。`
      : `${name}这条史势线已经不再只是传闻，我顺着当地门路、落脚处和时势，开始把这层关系往真正可用的往来上接。`;
  }
  if (kind === 'romance' && mode === 'bond') {
    return tier === 'fail'
      ? `${name}没有把这一步真正接住，像是在提醒我，情分要想扛得住风雨，还得再经一次真局。`
      : `${name}已经不只是愿意和我私下靠近，而是开始愿意和我一起担人情、担风险、担后果。`;
  }
  if (kind === 'romance' && mode === 'daily') {
    return tier === 'fail'
      ? `${name}没有拒绝这一日相伴，却也把许多话轻轻留在了分寸之外。`
      : `${name}愿意把寻常日子也分给我，饭食、闲话和并肩走过的路都开始有了私人的温度。`;
  }
  if (kind === 'romance' && mode === 'companion') {
    return tier === 'fail'
      ? `${name}没有把同行这一步接实，像是在等我先证明这份情意能扛住眼前局势。`
      : `${name}已经不只是私下相会，而是肯把行程、风险和选择都贴着我一起走。`;
  }
  if (kind === 'romance' && mode === 'jealousy') {
    return tier === 'fail'
      ? `${name}嘴上没有追问，可那点酸意和不安反而压得更深了一层。`
      : `${name}听懂了我给出的分寸，旁人的目光和旧话暂时没能把这段关系搅乱。`;
  }
  if (kind === 'martial' && mode === 'mentor') {
    return tier === 'fail'
      ? `${name}这回没有真把看家的本事放给我，只让我先回去再磨基本功。`
      : `${name}这回没有再藏手，是真把一段临阵本事或发力门道递到了我手里。`;
  }
  if (tier === 'fail') {
    if (kind === 'romance') return romanceStage === '近身'
      ? `${name}没有把我推远，只是把这次单独靠近重新按回了分寸里。`
      : `${name}把我这次试探轻轻按了回去，话头没有断，但分寸明显重新收紧。`;
    if (kind === 'social') return `${name}记住了我这次没接稳的话头，神情比先前更审慎了一点。`;
    if (['battle', 'military', 'warpath'].includes(kind)) return `${name}看见我这一步没站稳，原本要交给我的信任又往回收了些。`;
    if (['investigate', 'intrigue'].includes(kind)) return `${name}察觉到局面有些失手，于是把态度重新藏回袖里。`;
    return `${name}没有把这一步完全接住，往后的态度自然比先前多了几分保留。`;
  }
  if (kind === 'romance') return romanceStage === '近身'
    ? `${name}已经愿意把我从公事往来里单独拎出来相待，气氛也和从前有些不一样了。`
    : `${name}看我的目光不再只落在利害上，话里已经慢慢留出了私心。`;
  if (kind === 'social') return `${name}愿意把我往更近处放一点，彼此之间终于接上了更顺的语气。`;
  if (['battle', 'military', 'warpath'].includes(kind)) return `${name}开始相信我不只是嘴上有志气，真到顶上去的时候也撑得住场。`;
  if (['investigate', 'intrigue'].includes(kind)) return `${name}意识到我并不只是听风就是雨的人，于是肯把更深的一层消息放给我。`;
  return `${name}对我的分量又重新掂了掂，这一次明显比从前更愿意往我这边靠。`;
}

function buildRelationPatch(kind, tier, mode = '', relation = null) {
  const patch = {
    trust: tier === 'great' ? 6 : tier === 'good' ? 4 : tier === 'mixed' ? 1 : -2,
    affection: kind === 'romance'
      ? (tier === 'great' ? 12 : tier === 'good' ? 8 : tier === 'mixed' ? 4 : -4)
      : kind === 'social' && tier !== 'fail'
        ? (tier === 'great' ? 6 : tier === 'good' ? 4 : 2)
        : 0,
    loyalty: kind === 'romance' && tier === 'great'
      ? 2
      : ['military', 'battle', 'warpath', 'sect', 'joinsect'].includes(kind) && tier !== 'fail'
        ? 3
        : 0,
    rivalry: tier === 'fail'
      ? (kind === 'romance' ? 6 : ['intrigue', 'investigate'].includes(kind) ? 4 : kind === 'social' ? 3 : 2)
      : kind === 'romance'
        ? (tier === 'great' ? -4 : tier === 'good' ? -2 : -1)
        : kind === 'social'
          ? (tier === 'great' ? -2 : tier === 'good' ? -1 : 0)
          : 0
  };
  if (kind === 'social' && mode === 'visit' && tier !== 'fail') patch.trust += 2;
  if (kind === 'social' && mode === 'recruit_probe') {
    patch.trust = tier === 'great' ? 6 : tier === 'good' ? 5 : tier === 'mixed' ? 3 : 1;
    patch.loyalty = tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
    patch.affection = tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
    patch.rivalry = 0;
  }
  if (kind === 'social' && mode === 'retinue_talk') {
    patch.trust += tier === 'fail' ? -1 : 2;
    patch.loyalty += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
    patch.rivalry += tier === 'fail' ? 1 : -1;
  }
  if (kind === 'social' && mode === 'retinue_companion') {
    patch.trust += tier === 'great' ? 4 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : -1;
    patch.loyalty += tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
    patch.rivalry += tier === 'fail' ? 2 : -1;
  }
  if (kind === 'social' && mode === 'alliance') {
    patch.loyalty += tier === 'great' ? 5 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : -1;
    patch.trust += tier === 'fail' ? -1 : 1;
  }
  if (kind === 'romance' && mode === 'approach') patch.affection += tier === 'fail' ? -1 : 2;
  if (kind === 'romance' && mode === 'promise') {
    patch.affection += tier === 'great' ? 6 : tier === 'good' ? 4 : tier === 'mixed' ? 2 : -2;
    patch.loyalty += tier === 'great' ? 3 : tier === 'good' ? 2 : 0;
    patch.rivalry += tier === 'fail' ? 3 : 0;
  }
  if (kind === 'romance' && mode === 'bond') {
    patch.trust += tier === 'great' ? 4 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : -2;
    patch.affection += tier === 'great' ? 5 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : -2;
    patch.loyalty += tier === 'great' ? 5 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : -2;
    patch.rivalry += tier === 'fail' ? 4 : -1;
  }
  if (kind === 'romance' && mode === 'daily') {
    patch.trust += tier === 'great' ? 2 : tier === 'good' ? 1 : tier === 'mixed' ? 0 : -1;
    patch.affection += tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1;
    patch.rivalry += tier === 'fail' ? 2 : -1;
  }
  if (kind === 'romance' && mode === 'companion') {
    patch.trust += tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -2;
    patch.affection += tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -2;
    patch.loyalty += tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1;
    patch.rivalry += tier === 'fail' ? 3 : -1;
  }
  if (kind === 'romance' && mode === 'jealousy') {
    patch.trust += tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -3;
    patch.affection += tier === 'great' ? 2 : tier === 'good' ? 1 : tier === 'mixed' ? 0 : -3;
    patch.rivalry += tier === 'great' ? -8 : tier === 'good' ? -5 : tier === 'mixed' ? -2 : 6;
  }
  if (kind === 'investigate' && mode === 'counsel') {
    patch.trust += tier === 'fail' ? -1 : 2;
    patch.loyalty += tier !== 'fail' && Number(relation && relation.strategyRating || 0) >= 90 ? 1 : 0;
  }
  if (kind === 'investigate' && mode === 'retinue_counsel') {
    patch.trust += tier === 'fail' ? -1 : 3;
    patch.loyalty += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
    patch.rivalry += tier === 'fail' ? 1 : -1;
  }
  if (kind === 'investigate' && mode === 'historical_lead') {
    patch.trust += tier === 'great' ? 4 : tier === 'good' ? 3 : tier === 'mixed' ? 2 : 0;
    patch.loyalty += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
    patch.rivalry = Math.max(-2, Number(patch.rivalry || 0) - (tier === 'fail' ? 0 : 2));
  }
  if (kind === 'martial' && mode === 'mentor') {
    patch.trust += tier === 'fail' ? -1 : 2;
    patch.loyalty += tier !== 'fail' && Number(relation && relation.martialRating || 0) >= 88 ? 2 : (tier !== 'fail' ? 1 : 0);
  }
  return patch;
}

function buildLeadRelationLine(relation, actionKind, tier, worldTurn, mode = '') {
  if (!relation) return '';

  const relevantKinds = ['social', 'romance', 'diplomacy', 'investigate', 'intrigue', 'sect', 'joinsect'];
  if (actionKind === 'martial' && mode === 'mentor') relevantKinds.push('martial');
  if (!relevantKinds.includes(actionKind)) return '';

  const seed = (worldTurn || 0) + String(relation.id || relation.name || '').length + String(actionKind || '').length;
  const name = relation.name || '对方';

  if (actionKind === 'social' && mode === 'alliance') {
    return pickBySeed([
      `${name}没有急着把话说满，但已经开始认真衡量要不要把筹码往我这边压。`,
      `${name}听完后把利害和人情都掂了一遍，这段关系明显已经开始往同盟的方向发力。`,
      `${name}没有再把我当成泛泛之交，那点“是否并肩”的意味已经落到了桌上。`
    ], seed);
  }
  if (actionKind === 'investigate' && mode === 'counsel') {
    return pickBySeed([
      `${name}把原本压在心里的那层判断也说给了我听，这不是寻常交情能换来的话。`,
      `${name}没有再拿表面风声敷衍我，而是把真正该防的后手轻轻点了出来。`,
      `${name}看我的眼神比先前更认真些，像是终于肯承认我接得住这种层级的谋算。`
    ], seed);
  }
  if (actionKind === 'romance' && mode === 'bond') {
    return pickBySeed([
      `${name}没有再只把我放在私下心意的位置，而是真开始把我当成能一起扛事的人。`,
      `${name}听我把话说完后没有退，那种“并肩”而不是“相会”的意味终于真正落了下来。`,
      `${name}接这一步时少了许多试探，多了一点愿意同进同退的决心。`
    ], seed);
  }
  if (actionKind === 'martial' && mode === 'mentor') {
    return pickBySeed([
      `${name}示范时没有再刻意收着，连最要命的发力节点也让我看了个真切。`,
      `${name}出手的那一下把门道说得很少，却让我一下看清自己原先卡在哪一层。`,
      `${name}没有摆架子，只拿真本事压我，让我明白这一身武艺接下来该往哪儿钻。`
    ], seed);
  }

  if (relation.bondKey === 'lover') {
    return pickBySeed([
      `${name}没有把话说满，可那点藏不住的偏心已经从字句间漏了出来。`,
      `${name}应我时声音压得很低，像是连这一步的余波都不愿让旁人听见。`,
      `${name}接我的眼神时没有躲，那点私人的温度已经真真切切落了下来。`
    ], seed);
  }
  if (relation.bondKey === 'advisor') {
    return pickBySeed([
      `${name}顺着我这一步往下补了两句，像是已经习惯替我把局面接稳。`,
      `${name}没有空泛附和，只把最该防的一处轻轻点给了我。`,
      `${name}听完之后先替我拢了拢散开的线，幕僚的分量已经慢慢站出来了。`
    ], seed);
  }
  if (relation.bondKey === 'confidant') {
    return pickBySeed([
      `${name}没有再试探我，只把真正压在心里的那层意思放到了明面上。`,
      `${name}接这一步时少了许多绕弯，那份信任已经开始落到实处。`,
      `${name}听我说完后只点了点头，像是已经默认会陪我把后面的风声一起扛住。`
    ], seed);
  }
  if (relation.bondKey === 'rival') {
    return pickBySeed([
      `${name}没有退远，那股拧着的劲还在，像是在心里替我记下了这一手。`,
      `${name}神色里仍压着不肯松的锋芒，恩怨显然还没到收口的时候。`,
      `${name}听完后没急着表态，只把那点较劲的意味又往深处压了一寸。`
    ], seed);
  }

  const byAction = {
    social: {
      great: [`${name}顺着我的话意多接了好几句，彼此之间的生分已经明显退下去了。`, `${name}把原本留着的半句话也补给了我，这份熟络终于像样地长了出来。`],
      good: [`${name}接话时松了一点，不再像最初那样处处留着分寸。`, `${name}应我的时候语气顺了不少，像是终于肯把我往近处放一放。`],
      mixed: [`${name}没有完全把门打开，但至少没再把话头挡回去。`, `${name}态度还谈不上亲近，可已经愿意让这段往来继续往前挪一小步。`],
      fail: [`${name}把我的来意听进去了，却还是把分寸收得很紧。`, `${name}没有当面驳我，只是语气里那层保留又重新立了起来。`]
    },
    diplomacy: {
      great: [`${name}把我的条件认真掂量了一遍，这回显然已经把我当成能谈的人。`, `${name}没有急着拿官样话堵我，而是真开始衡量和我站在一边值不值得。`],
      good: [`${name}没有立刻点头，却把我提出的筹码记得很清。`, `${name}听完后明显认真了些，像是在重新估我的分量。`],
      mixed: [`${name}态度仍在观望，但已经不把我这一步当成轻飘飘的试探。`, `${name}没有松口太多，只把原先彻底封死的缝留出了一线。`],
      fail: [`${name}没有接住我递过去的条件，场面上那层客气也跟着薄了些。`, `${name}把话听完后仍旧按兵不动，像是在提醒我这点筹码还不够。`]
    },
    investigate: {
      great: [`${name}把原本不该漏出来的那层风声也递给了我，显然已经开始认我的手段。`, `${name}没有再拿空消息敷衍我，而是肯把更深的一层线头放出来。`],
      good: [`${name}把袖里的保留松开了一点，愿意让我摸到更深一层的消息。`, `${name}没有再只给我表面风声，话里已经带出了真正有用的东西。`],
      mixed: [`${name}仍留着后手，但至少不再把所有消息都藏在袖子里。`, `${name}肯给我的还不算多，可已经够我顺着往下再追一层。`],
      fail: [`${name}察觉到我这一步落得不够稳，当下就把更深的消息又收了回去。`, `${name}看我这回没摸准脉，索性把原本能放的话也压住了。`]
    },
    intrigue: {
      great: [`${name}听懂了我没说透的那半句话，反而更愿意陪我往局里深走一层。`, `${name}没有追问太多，只把该懂的都懂了，这种默契比明说更值钱。`],
      good: [`${name}明白我不是胡乱试手的人，于是态度也跟着松动了一些。`, `${name}没有把我的布子拆穿，反而默许我继续往下压。`],
      mixed: [`${name}还在掂量我到底想把这盘局做到哪里，但已经没有立刻抽身。`, `${name}没有完全站进来，却也没把门彻底关死。`],
      fail: [`${name}看出我这一步有些虚，于是立刻把态度藏回去了。`, `${name}没有接我的暗示，反而把彼此之间的距离重新拉开了一层。`]
    },
    sect: {
      great: [`${name}这回没有再只拿门规压我，话里已经多了几分真正认可。`, `${name}看我处理门中事务时不再只是旁观，显然已经开始把我当成自己人。`],
      good: [`${name}对我的态度松了一些，至少愿意让我往门中更深处走半步。`, `${name}没有再把我挡在外圈，像是默认我值得继续栽培。`],
      mixed: [`${name}还在审我这一步能不能站稳，不过门里的冷意已经退了些。`, `${name}没有立刻把信任全交出来，但也没再像最初那样只拿规矩压我。`],
      fail: [`${name}把我的失手看在眼里，门里的态度自然又收紧了一层。`, `${name}没有发作，只是那点本来要松开的门路又重新扣住了。`]
    },
    joinsect: {
      great: [`${name}看我的眼神终于不再像是在打量外人，这扇门算是真开了一道缝。`, `${name}没有再只谈门槛，像是已经愿意把我往自家弟子的位子上挪。`],
      good: [`${name}对我的态度缓了下来，至少不再只把我当成门外来客。`, `${name}虽然还没完全认下我，却已经愿意给我继续往里走的台阶。`],
      mixed: [`${name}仍旧在审我，但语气已经不再那么生硬。`, `${name}没有立刻收我入局，不过至少没有把门当场关死。`],
      fail: [`${name}没有被我这一步打动，那扇门暂时还是只开到这里。`, `${name}把我的来意听完后便重新收住了态度，显然还没到真正放我进来的时候。`]
    },
    romance: {
      great: [`${name}听我说完后没有躲，那点私心已经藏不住了。`, `${name}看向我的时候终于不再只剩克制，话里也慢慢带出了别的意味。`],
      good: [`${name}虽然还留着分寸，可那点心思已经不像最初那样遮得严了。`, `${name}应我时停了停，像是在认真衡量这段情分还能不能再近一点。`],
      mixed: [`${name}没有把这层情分推开，只是仍在给自己留退路。`, `${name}态度柔了些，却还没真的把心门整个打开。`],
      fail: [`${name}把这一步轻轻按了回去，话头没断，可亲近也没能更进一步。`, `${name}没有当场拒绝我，只是那层暧昧又被重新按回了分寸里。`]
    }
  };

  const pool = (((byAction[actionKind] || {})[tier]) || []);
  if (pool.length) return pickBySeed(pool, seed);

  if (actionKind === 'romance' && relationRomanceStage(relation) === '近身') {
    return pickBySeed([
      `${name}和我单独说话时明显比平日多留了半步，已经不是纯粹公事公办的距离。`,
      `${name}没有急着把这层气氛说破，却也没有再像以前那样把话全留在场面上。`,
      `${name}应我时把声音放得更轻了些，像是愿意先让彼此在无人处多看一眼。`
    ], seed);
  }

  const intimacy = relation.intimacyTag || '初识';
  if (intimacy === '死生可托') return `${name}没有多说，只把这一步的余波默默替我记进了心里。`;
  if (intimacy === '深交') return `${name}站在近处听完了我这一步，神色沉静，像是已经习惯替我分担风声。`;
  if (intimacy === '可信') return `${name}对我的那点戒备已经淡了不少，至少愿意继续把话往深处说。`;
  if (intimacy === '熟络') return `${name}接我的话时不再那么生硬，这段往来总算有了点像样的温度。`;
  return '';
}

function addSkill(state, skill) {
  if (!skill || !skill.id) return;
  const normalizedSkill = normalizeSkillRecord(skill);
  if (!normalizedSkill) return;
  const exists = ensureList(state.gameState.skills).find((item) => item.id === skill.id);
  if (exists) return;
  state.gameState.skills = ensureList(state.gameState.skills).concat([normalizedSkill]);
}

function storeSkillFeedback(state, actionText, tier, scoreFeedback, deltaFeedback) {
  const feedback = summarizeSkillFeedback({
    actionText,
    tier,
    score: scoreFeedback,
    delta: deltaFeedback
  });
  state.gameState.lastSkillFeedback = feedback;
  return feedback;
}

function cloneDelta(delta) {
  return Object.keys(delta || {}).reduce((result, key) => {
    const value = Number(delta[key] || 0);
    if (!value) return result;
    result[key] = value;
    return result;
  }, {});
}

function mergeDelta(base, patch) {
  const next = cloneDelta(base || {});
  Object.keys(patch || {}).forEach((key) => {
    const value = Number(patch[key] || 0);
    if (!value) return;
    next[key] = Number(next[key] || 0) + value;
  });
  return next;
}

function fillTemplate(template, context) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(context[key] == null ? '' : context[key]));
}

function normalizeNarrativeSnippet(value, fallback = '') {
  return sanitizeChronicleText(value, fallback);
}

function hasEffectivePromptText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return !/^(暂无|当前无|当前没有|无[。.]?$|未定[。.]?$)/.test(text);
}

function resolveConfiguredHook(rule, state) {
  if (!rule || !rule.hook) return '';
  if (rule.hook === 'city_event' || rule.hook === '城中事务') {
    const city = findCity(state.world.currentCityId);
    return city ? pickOne(city.eventHooks) : '';
  }
  if (rule.hook === 'martial_hook' || rule.hook === '武道进境') {
    return state.gameState.sectId ? `${state.gameState.sectName}演武` : '独自苦练';
  }
  if (rule.hook === 'sect_rule' || rule.hook === '门中规矩') {
    return `${state.gameState.sectName || '门派'}门规`;
  }
  return normalizeNarrativeSnippet(rule.hook);
}

function buildDeltaLine(delta) {
  const parts = STAT_IMPACT_PRIORITY
    .filter((key) => Number(delta[key] || 0) !== 0)
    .map((key) => {
      const config = STAT_NARRATIVE_RULES[key];
      const value = Number(delta[key] || 0);
      const label = config ? config.label : key;
      return `${label}${value > 0 ? '+' : ''}${value}`;
    });
  return parts.length ? `数值变动：${parts.join('，')}。` : '';
}

function buildImpactSummary(delta) {
  const parts = STAT_IMPACT_PRIORITY
    .filter((key) => Number(delta[key] || 0) !== 0)
    .sort((a, b) => Math.abs(Number(delta[b] || 0)) - Math.abs(Number(delta[a] || 0)))
    .slice(0, 3)
    .map((key) => {
      const config = STAT_NARRATIVE_RULES[key];
      if (!config) return '';
      const value = Number(delta[key] || 0);
      const isPositive = config.betterWhenNegative ? value < 0 : value > 0;
      return isPositive ? config.positive : config.negative;
    })
    .filter(Boolean);
  return parts.length ? `这一步里，${parts.join('，')}。` : '';
}

function mergeOutcomeText(base, patch, separator = '') {
  const left = String(base || '').trim();
  const right = String(patch || '').trim();
  if (!left) return right;
  if (!right) return left;
  return `${left}${separator}${right}`;
}

function compactNarrationEchoText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

function includesAnyKeyword(source, keywords) {
  const text = String(source || '');
  return ensureList(keywords).some((item) => item && text.includes(item));
}

function includesKeywordGroups(source, groups) {
  const text = String(source || '');
  return ensureList(groups).every((group) => includesAnyKeyword(text, group));
}

function parseNarrativeOutcomeEcho(action, text) {
  const source = compactNarrationEchoText(text) || compactNarrationEchoText(normalizeNarrationText(text, ''));
  if (!source) return { delta: {}, summary: '' };

  const kind = String(action && action.kind || '').trim();
  const delta = {};
  const notes = [];
  const add = (key, amount) => {
    if (!amount) return;
    delta[key] = Number(delta[key] || 0) + Number(amount || 0);
  };
  const note = (textLine) => {
    const line = String(textLine || '').trim();
    if (line && !notes.includes(line)) notes.push(line);
  };

  const gotSupplies = includesKeywordGroups(source, [
    ['缴获', '截获', '夺下', '夺得', '抄出', '抢下', '收得', '搬回', '劫下', '截下', '卷走', '带回'],
    ['粮草', '粮秣', '辎重', '军需', '粮车', '粮船', '粮道', '粮仓']
  ]) || includesAnyKeyword(source, ['缴获粮草', '截获粮草', '劫了粮草', '夺得辎重', '搬回军需']);
  if (gotSupplies && ['intrigue', 'investigate', 'warpath', 'battle', 'military', 'trade', 'govern'].includes(kind)) {
    add('supplies', 4);
    note('剧情里确实把粮草或军需拿到了手，转成了一小笔可用粮秣。');
  }

  const gotTroops = includesKeywordGroups(source, [
    ['起兵', '聚兵', '募得', '募起', '拉起', '收拢', '招聚', '纠合', '招来', '聚起'],
    ['兵', '部曲', '人手', '乡勇', '兵丁', '健儿']
  ]) || includesAnyKeyword(source, ['拉起一支人手', '聚起一批乡勇', '募得部曲', '招聚乡勇']);
  if (gotTroops && ['warpath', 'military', 'govern', 'social'].includes(kind)) {
    add('troops', 4);
    add('morale', 1);
    note('剧情里已经把新的人手聚了起来，转成了一小股可调度的部曲。');
  }

  const breakthrough = includesAnyKeyword(source, [
    '突破', '破关', '悟透', '顿悟', '关隘松动', '瓶颈松动', '窍关大开', '豁然贯通', '更进一步', '打通关窍'
  ]) || includesKeywordGroups(source, [
    ['瓶颈', '关隘', '关口', '窍关'],
    ['松动', '打通', '贯通', '破开', '破掉']
  ]);
  if (breakthrough && ['martial', 'jianghu', 'warpath', 'battle', 'sect'].includes(kind)) {
    add('martialInsight', 1);
    if (kind === 'jianghu' || kind === 'battle' || kind === 'warpath') add('renown', 1);
    note('剧情里明确写出了武学或实战上的突破，转成了一点真实进境。');
  }

  const gotCoins = includesKeywordGroups(source, [
    ['赏银', '赏钱', '银钱', '钱货', '现钱', '盘缠', '货款', '银两', '赏赐'],
    ['到手', '入手', '入袋', '落袋', '得手', '收下']
  ]) || includesAnyKeyword(source, ['赏银到手', '现钱入袋', '钱货得手']);
  if (gotCoins && ['trade', 'social', 'diplomacy', 'jianghu', 'intrigue'].includes(kind)) {
    add('coins', 4);
    note('剧情里到手的钱货被折成了一小笔现钱。');
  }

  const moraleSurge = includesAnyKeyword(source, ['士气大振', '军心大振', '精神一振', '人人振奋', '众心归附']);
  if (moraleSurge && ['battle', 'warpath', 'military', 'social', 'romance'].includes(kind)) {
    add('morale', 1);
    note('剧情里的振奋与回响，折成了一点可见的士气。');
  }

  return {
    delta,
    summary: notes.join('')
  };
}

function ensureFatigueChannels(gameState) {
  if (!gameState || typeof gameState !== 'object') return;
  ['fatigueCombat', 'fatigueTravel', 'fatigueMental'].forEach((key) => {
    if (!Number.isFinite(Number(gameState[key]))) gameState[key] = 0;
    gameState[key] = Math.max(0, Number(gameState[key] || 0));
  });
}

function distributeIntegerByWeights(total, weights) {
  const amount = Math.max(0, Math.round(Number(total || 0)));
  const normalized = {
    fatigueCombat: Math.max(0, Number(weights && weights.fatigueCombat || 0)),
    fatigueTravel: Math.max(0, Number(weights && weights.fatigueTravel || 0)),
    fatigueMental: Math.max(0, Number(weights && weights.fatigueMental || 0))
  };
  const keys = Object.keys(normalized);
  const weightSum = keys.reduce((sum, key) => sum + normalized[key], 0);
  if (!amount) {
    return { fatigueCombat: 0, fatigueTravel: 0, fatigueMental: 0 };
  }
  if (weightSum <= 0) {
    return { fatigueCombat: 0, fatigueTravel: 0, fatigueMental: amount };
  }

  const base = {};
  const remainders = [];
  let assigned = 0;
  keys.forEach((key) => {
    const exact = amount * (normalized[key] / weightSum);
    const floorValue = Math.floor(exact);
    base[key] = floorValue;
    assigned += floorValue;
    remainders.push({ key, remainder: exact - floorValue });
  });
  remainders
    .sort((left, right) => right.remainder - left.remainder)
    .slice(0, Math.max(0, amount - assigned))
    .forEach((item) => {
      base[item.key] += 1;
    });
  return base;
}

function fatigueWeightsForAction(action, mode = 'gain') {
  const kind = String(action && action.kind || '').trim();
  const actionMode = String(action && action.mode || '').trim();
  if (mode === 'recover') {
    if (actionMode === 'inn') return { fatigueCombat: 0.5, fatigueTravel: 0.35, fatigueMental: 0.15 };
    if (actionMode === 'medicate') return { fatigueCombat: 0.55, fatigueTravel: 0.1, fatigueMental: 0.35 };
    if (actionMode === 'teahouse' || actionMode === 'study' || actionMode === 'stroll') {
      return { fatigueCombat: 0.1, fatigueTravel: 0.15, fatigueMental: 0.75 };
    }
    if (actionMode === 'team_recover') return { fatigueCombat: 0.45, fatigueTravel: 0.2, fatigueMental: 0.35 };
    if (kind === 'rest') return { fatigueCombat: 0.35, fatigueTravel: 0.25, fatigueMental: 0.4 };
  }

  if (kind === 'travel') return { fatigueCombat: 0.1, fatigueTravel: 0.7, fatigueMental: 0.2 };
  if (['battle', 'warpath', 'military', 'martial', 'jianghu', 'spar'].includes(kind)) {
    return { fatigueCombat: 0.7, fatigueTravel: 0.1, fatigueMental: 0.2 };
  }
  if (['investigate', 'intrigue', 'diplomacy', 'social', 'romance'].includes(kind)) {
    return { fatigueCombat: 0.1, fatigueTravel: 0.1, fatigueMental: 0.8 };
  }
  if (['govern', 'trade', 'sect'].includes(kind)) {
    return { fatigueCombat: 0.15, fatigueTravel: 0.2, fatigueMental: 0.65 };
  }
  return { fatigueCombat: 0.25, fatigueTravel: 0.2, fatigueMental: 0.55 };
}

function normalizeFatigueChannels(gameState) {
  ensureFatigueChannels(gameState);
  const fatigue = clamp(Number(gameState && gameState.fatigue || 0), 0, 100);
  if (fatigue <= 0) {
    gameState.fatigueCombat = 0;
    gameState.fatigueTravel = 0;
    gameState.fatigueMental = 0;
    return;
  }

  const raw = {
    fatigueCombat: Math.max(0, Number(gameState.fatigueCombat || 0)),
    fatigueTravel: Math.max(0, Number(gameState.fatigueTravel || 0)),
    fatigueMental: Math.max(0, Number(gameState.fatigueMental || 0))
  };
  const rawSum = raw.fatigueCombat + raw.fatigueTravel + raw.fatigueMental;
  if (rawSum <= 0) {
    gameState.fatigueCombat = 0;
    gameState.fatigueTravel = 0;
    gameState.fatigueMental = fatigue;
    return;
  }

  const scaled = distributeIntegerByWeights(fatigue, raw);
  gameState.fatigueCombat = scaled.fatigueCombat;
  gameState.fatigueTravel = scaled.fatigueTravel;
  gameState.fatigueMental = scaled.fatigueMental;
}

function relieveFatigueChannels(gameState, amount, action) {
  ensureFatigueChannels(gameState);
  let remaining = Math.max(0, Math.round(Number(amount || 0)));
  if (!remaining) return;

  const primary = distributeIntegerByWeights(remaining, fatigueWeightsForAction(action, 'recover'));
  ['fatigueCombat', 'fatigueTravel', 'fatigueMental'].forEach((key) => {
    if (!remaining) return;
    const relief = Math.min(remaining, Math.min(Number(gameState[key] || 0), Number(primary[key] || 0)));
    gameState[key] = Math.max(0, Number(gameState[key] || 0) - relief);
    remaining -= relief;
  });

  while (remaining > 0) {
    const key = ['fatigueCombat', 'fatigueTravel', 'fatigueMental']
      .sort((left, right) => Number(gameState[right] || 0) - Number(gameState[left] || 0))[0];
    if (!key || Number(gameState[key] || 0) <= 0) break;
    gameState[key] = Math.max(0, Number(gameState[key] || 0) - 1);
    remaining -= 1;
  }
}

function applyFatigueChannelDelta(gameState, fatigueDelta, action) {
  ensureFatigueChannels(gameState);
  const amount = Math.round(Number(fatigueDelta || 0));
  if (!amount) {
    normalizeFatigueChannels(gameState);
    return;
  }
  if (amount > 0) {
    const allocated = distributeIntegerByWeights(amount, fatigueWeightsForAction(action, 'gain'));
    gameState.fatigueCombat += allocated.fatigueCombat;
    gameState.fatigueTravel += allocated.fatigueTravel;
    gameState.fatigueMental += allocated.fatigueMental;
  } else {
    relieveFatigueChannels(gameState, Math.abs(amount), action);
  }
  normalizeFatigueChannels(gameState);
}

function fatigueDominantChannel(gameState) {
  ensureFatigueChannels(gameState);
  const entries = [
    ['combat', Number(gameState.fatigueCombat || 0)],
    ['travel', Number(gameState.fatigueTravel || 0)],
    ['mental', Number(gameState.fatigueMental || 0)]
  ].sort((left, right) => right[1] - left[1]);
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : '';
}

function fatigueProfileSummary(gameState) {
  const total = Number(gameState && gameState.fatigue || 0);
  if (total <= 0) return '体气还算安稳';
  const dominant = fatigueDominantChannel(gameState);
  if (dominant === 'combat') return '劳战偏重';
  if (dominant === 'travel') return '奔波偏重';
  if (dominant === 'mental') return '心神偏重';
  return '疲态混杂';
}

function applyNarrativeOutcomeEcho(state, action, narrationText) {
  if (!state || !state.gameState) return null;
  const parsed = parseNarrativeOutcomeEcho(action, narrationText);
  if (!parsed || !Object.keys(parsed.delta || {}).length) return null;

  applyStatDelta(state.gameState, parsed.delta, { action });
  const impactSummary = buildImpactSummary(parsed.delta);
  const deltaLine = buildDeltaLine(parsed.delta);
  const echoSummary = [parsed.summary, impactSummary].filter(Boolean).join('');
  state.gameState.lastRuleSummary = mergeOutcomeText(state.gameState.lastRuleSummary, echoSummary);
  state.gameState.lastDeltaLine = mergeOutcomeText(state.gameState.lastDeltaLine, deltaLine, ' ');
  state.gameState.lastNarrativeEcho = {
    summary: echoSummary,
    deltaLine,
    fatigueProfile: fatigueProfileSummary(state.gameState)
  };
  return {
    delta: cloneDelta(parsed.delta),
    summary: echoSummary,
    deltaLine
  };
}

function buildModeSummaryBase(action, resolved, relation, fallbackSummaryBase) {
  const name = relation && relation.name ? relation.name : (action.targetName || '对方');
  const tier = tierText(resolved.tier);
  if (action.kind === 'social' && action.mode === 'visit') return `我去拜访${name}，这一回结果是“${tier}”。`;
  if (action.kind === 'social' && action.mode === 'alliance') return `我把筹码和话头压向${name}，试着把这段关系往结盟相托的方向推进，这一回结果是“${tier}”。`;
  if (action.kind === 'social' && action.mode === 'retinue_talk') return `我把${name}叫到近前，把眼前的人情、分工和局势一并摊开谈，这一回结果是“${tier}”。`;
  if (action.kind === 'social' && action.mode === 'retinue_companion') return `我点名让${name}同行，想让这一路不再只是我一个人硬顶，这一回结果是“${tier}”。`;
  if (action.kind === 'romance' && action.mode === 'approach') return `我借着夜色与空隙去试探${name}的心意，这一回结果是“${tier}”。`;
  if (action.kind === 'romance' && action.mode === 'promise') return `我试着向${name}把心意说得更明白些，这一回结果是“${tier}”。`;
  if (action.kind === 'romance' && action.mode === 'bond') return `我试着和${name}把这段情分推到真正能并肩担事的层次，这一回结果是“${tier}”。`;
  if (action.kind === 'romance' && action.mode === 'daily') return `我陪${name}把这一日的饭食、闲话和琐碎小事慢慢过完，这一回结果是“${tier}”。`;
  if (action.kind === 'romance' && action.mode === 'companion') return `我邀${name}同走这一程，想让陪伴不只停在私下相会，这一回结果是“${tier}”。`;
  if (action.kind === 'romance' && action.mode === 'jealousy') return `我把旁人的目光、旧话和那点酸意摊开安抚${name}，这一回结果是“${tier}”。`;
  if (action.kind === 'investigate' && action.mode === 'counsel') return `我去向${name}问策，想把眼下局势和暗线掰得更透，这一回结果是“${tier}”。`;
  if (action.kind === 'investigate' && action.mode === 'retinue_counsel') return `我把${name}叫来问策，想把眼前局势、后手和风险都听个明白，这一回结果是“${tier}”。`;
  if (action.kind === 'investigate' && action.mode === 'jianghu_clue') return `我顺着江湖风声、比武余波和名号暗线继续往下摸，这一回结果是“${tier}”。`;
  if (action.kind === 'investigate' && action.mode === 'historical_lead') return `我顺着${name}的史势线索继续摸门路与落脚处，试着把只停在风闻里的人真正接出来，这一回结果是“${tier}”。`;
  if (action.kind === 'warpath' && action.mode === 'join') return `我去投向${name}军中，争一个能随军立功、在阵前站住脚的位置，这一回结果是“${tier}”。`;
  if (action.kind === 'warpath' && action.mode === 'counsel') return `我当面把战局、粮道和站位掰给${name}看，试着让自己的判断真正落到军令里，这一回结果是“${tier}”。`;
  if (action.kind === 'warpath' && action.mode === 'assist') return `我贴着${name}这一线战事去补阵脚、顶空当，想把自己的身位真正打进军中，这一回结果是“${tier}”。`;
  if (action.kind === 'warpath' && action.mode === 'logistics') return `我沿着${name}军中的粮道和后路去接军需，试着把真正能决定胜负的后手抓进手里，这一回结果是“${tier}”。`;
  if (action.kind === 'martial' && action.mode === 'mentor') return `我登门向${name}讨教武艺，想借这一回把本事和见识都再往上顶一层，这一回结果是“${tier}”。`;
  if (action.kind === 'sect' && action.mode === 'cipher') return `我顺着门中的旧账、暗规和传承秘闻继续往里翻，这一回结果是“${tier}”。`;
  return fallbackSummaryBase;
}

function addHistoricalTeachingSkill(state, relation, prefix, rating) {
  if (!relation || !relation.isHistorical) return;
  const names = ensureList(relation.signatureSkills);
  if (!names.length) return;
  const best = String(names[0] || '').trim();
  if (!best) return;
  addSkill(state, {
    id: `${prefix}_${relation.id}_${rating >= 95 ? 'legend' : rating >= 88 ? 'master' : 'guide'}`,
    name: `${relation.name}点拨·${best}`,
    type: prefix === 'martial' ? '武学' : '谋略',
    level: rating >= 95 ? '传奇' : rating >= 88 ? '宗师' : '精熟',
    effect: prefix === 'martial'
      ? `我从${relation.name}那里摸到一段更接近真传的发力与临阵门道。`
      : `我从${relation.name}那里摸到一段更接近核心的局势判断与后手路数。`
  });
}

function applyRelationModeDelta(state, action, relation, resolved, delta) {
  const next = cloneDelta(delta || {});
  const tier = resolved && resolved.tier ? resolved.tier : 'mixed';
  const martialRating = Number(relation && relation.martialRating || 0);
  const strategyRating = Number(relation && relation.strategyRating || 0);

  if (action.kind === 'social' && action.mode === 'visit') {
    if (tier !== 'fail') {
      next.diplomacy = (next.diplomacy || 0) + 1;
      if (relation && relation.isHistorical) next.renown = (next.renown || 0) + 1;
    } else {
      next.fatigue = (next.fatigue || 0) + 1;
    }
  }

  if (action.kind === 'social' && action.mode === 'alliance') {
    next.influence = (next.influence || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    next.coins = (next.coins || 0) - 2;
    if (tier !== 'fail') {
      next.strategy = (next.strategy || 0) + (strategyRating >= 88 ? 1 : 0);
      next.morale = (next.morale || 0) + (martialRating >= 82 ? 1 : 0);
    } else {
      next.influence = (next.influence || 0) - 1;
    }
  }

  if (action.kind === 'social' && action.mode === 'retinue_talk') {
    next.morale = (next.morale || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    next.diplomacy = (next.diplomacy || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    if (tier === 'fail') next.fatigue = (next.fatigue || 0) + 1;
  }

  if (action.kind === 'social' && action.mode === 'retinue_companion') {
    if (tier !== 'fail') {
      next.morale = (next.morale || 0) + (tier === 'great' ? 2 : 1);
      next.fatigue = (next.fatigue || 0) - 1;
      next.influence = (next.influence || 0) + (tier === 'great' ? 1 : 0);
    } else {
      next.morale = (next.morale || 0) - 1;
    }
  }

  if (action.kind === 'romance' && action.mode === 'approach') {
    next.charm = (next.charm || 0) + (tier === 'great' ? 1 : 0);
    next.coins = (next.coins || 0) - 1;
  }

  if (action.kind === 'romance' && action.mode === 'promise') {
    next.morale = (next.morale || 0) + (tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -2);
    next.coins = (next.coins || 0) - 2;
    if (tier === 'fail') next.influence = (next.influence || 0) - 1;
  }

  if (action.kind === 'romance' && action.mode === 'bond') {
    next.morale = (next.morale || 0) + (tier === 'great' ? 4 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : -2);
    next.influence = (next.influence || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    next.coins = (next.coins || 0) - 2;
    if (tier !== 'fail') next.renown = (next.renown || 0) + 1;
  }

  if (action.kind === 'romance' && action.mode === 'daily') {
    next.morale = (next.morale || 0) + (tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1);
    next.fatigue = (next.fatigue || 0) - (tier === 'fail' ? 0 : 2);
    next.coins = (next.coins || 0) - 1;
  }

  if (action.kind === 'romance' && action.mode === 'companion') {
    next.morale = (next.morale || 0) + (tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -2);
    next.influence = (next.influence || 0) + (tier === 'great' ? 1 : 0);
    next.fatigue = (next.fatigue || 0) - (tier === 'fail' ? 0 : 1);
    if (tier !== 'fail' && martialRating >= 70) next.martialInsight = (next.martialInsight || 0) + 1;
    if (tier !== 'fail' && strategyRating >= 70) next.strategy = (next.strategy || 0) + 1;
  }

  if (action.kind === 'romance' && action.mode === 'jealousy') {
    next.morale = (next.morale || 0) + (tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 0 : -3);
    next.influence = (next.influence || 0) + (tier === 'fail' ? -1 : 0);
    next.diplomacy = (next.diplomacy || 0) + (tier === 'great' ? 1 : 0);
  }

  if (action.kind === 'investigate' && action.mode === 'counsel') {
    if (tier !== 'fail') {
      next.strategy = (next.strategy || 0) + (strategyRating >= 99 ? 3 : strategyRating >= 95 ? 2 : strategyRating >= 88 ? 1 : 0);
      next.influence = (next.influence || 0) + (strategyRating >= 90 ? 1 : 0);
      next.fatigue = (next.fatigue || 0) - 1;
      if (tier === 'great' && strategyRating >= 88) addHistoricalTeachingSkill(state, relation, 'strategy', strategyRating);
    } else {
      next.fatigue = (next.fatigue || 0) + 1;
    }
  }

  if (action.kind === 'investigate' && action.mode === 'retinue_counsel') {
    if (tier !== 'fail') {
      next.strategy = (next.strategy || 0) + (strategyRating >= 95 ? 2 : 1);
      next.influence = (next.influence || 0) + 1;
      next.fatigue = (next.fatigue || 0) - 1;
    } else {
      next.fatigue = (next.fatigue || 0) + 1;
    }
  }

  if (action.kind === 'investigate' && action.mode === 'jianghu_clue') {
    next.strategy = (next.strategy || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    next.jianghuPrestige = (next.jianghuPrestige || 0) + (tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0);
    if (tier === 'fail') next.fatigue = (next.fatigue || 0) + 1;
  }

  if (action.kind === 'investigate' && action.mode === 'historical_lead') {
    next.strategy = (next.strategy || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    next.influence = (next.influence || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    if (relation && relation.isHistorical) {
      next.renown = (next.renown || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    }
    if (tier === 'fail') next.fatigue = (next.fatigue || 0) + 1;
  }

  if (action.kind === 'warpath' && action.mode === 'join') {
    if (tier !== 'fail') {
      next.loyalty = (next.loyalty || 0) + 1;
      next.renown = (next.renown || 0) + (relation && relation.isHistorical ? 1 : 0);
    } else {
      next.morale = (next.morale || 0) - 1;
    }
  }

  if (action.kind === 'warpath' && action.mode === 'counsel') {
    if (tier !== 'fail') {
      next.strategy = (next.strategy || 0) + (strategyRating >= 95 ? 2 : strategyRating >= 88 ? 1 : 0);
      next.influence = (next.influence || 0) + 1;
      if (tier === 'great' && strategyRating >= 88) addHistoricalTeachingSkill(state, relation, 'strategy', strategyRating);
    } else {
      next.influence = (next.influence || 0) - 1;
    }
  }

  if (action.kind === 'warpath' && action.mode === 'assist') {
    if (tier !== 'fail') {
      next.martialLevel = (next.martialLevel || 0) + (martialRating >= 88 ? 1 : 0);
      next.morale = (next.morale || 0) + 1;
      if (tier === 'great' && martialRating >= 88) addHistoricalTeachingSkill(state, relation, 'martial', martialRating);
    } else {
      next.health = (next.health || 0) - 1;
    }
  }

  if (action.kind === 'warpath' && action.mode === 'logistics') {
    if (tier !== 'fail') {
      next.strategy = (next.strategy || 0) + 1;
      next.supplies = (next.supplies || 0) + (tier === 'great' ? 2 : 1);
    } else {
      next.supplies = (next.supplies || 0) - 2;
    }
  }

  if (action.kind === 'martial' && action.mode === 'mentor') {
    if (tier !== 'fail') {
      next.martialLevel = (next.martialLevel || 0) + (martialRating >= 90 ? 2 : martialRating >= 88 ? 1 : martialRating >= 80 ? 1 : 0);
      next.martialInsight = (next.martialInsight || 0) + (martialRating >= 90 ? 3 : martialRating >= 88 ? 2 : martialRating >= 80 ? 1 : 0);
      next.renown = (next.renown || 0) + (relation && relation.isHistorical ? 1 : 0);
      if (ensureList(relation && relation.tags).includes('qingnang')) next.health = (next.health || 0) + 2;
      if (tier === 'great' && martialRating >= 88) addHistoricalTeachingSkill(state, relation, 'martial', martialRating);
    } else {
      next.health = (next.health || 0) - 1;
    }
  }

  if (action.kind === 'sect' && action.mode === 'cipher') {
    next.strategy = (next.strategy || 0) + (tier === 'great' ? 2 : 1);
    next.martialInsight = (next.martialInsight || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
    next.sectFavor = (next.sectFavor || 0) + (tier === 'great' ? 2 : tier === 'good' ? 1 : 0);
  }

  if (['battle', 'warpath'].includes(action.kind) && relation && relation.isHistorical && tier !== 'fail') {
    if (martialRating >= 88) {
      next.morale = (next.morale || 0) + 1;
      next.renown = (next.renown || 0) + 1;
    }
    if (strategyRating >= 95) {
      next.strategy = (next.strategy || 0) + 1;
    }
  }

  return next;
}

function getTeamActionDefinitionByMode(mode) {
  const key = String(mode || '').trim();
  return (Array.isArray(TEAM_ACTION_DEFINITIONS) ? TEAM_ACTION_DEFINITIONS : []).find((item) => item && item.id === key) || null;
}

function regularOutcomeAction(action) {
  if (!action || !action.kind) return false;
  if (action.kind === 'battlecmd') return false;
  if (action.kind === 'battle') return false;
  if (action.kind === 'travel') return false;
  if (action.kind === 'spar') return false;
  if (action.kind === 'joinsect') return false;
  if (action.kind === 'military' && action.mode === 'seize_city') return false;
  return true;
}

function isHighPressureFatigueAction(kind) {
  return ['martial', 'warpath', 'jianghu', 'battle', 'military', 'travel', 'spar'].includes(String(kind || ''));
}

function isGeneralFatigueAction(kind) {
  return isHighPressureFatigueAction(kind)
    || ['trade', 'diplomacy', 'social', 'romance', 'intrigue', 'investigate', 'sect', 'govern'].includes(String(kind || ''));
}

function fatigueHardBlockedReason(gameState, action) {
  if (!action || action.kind === 'rest') return '';
  const fatigue = Number(gameState && gameState.fatigue || 0);
  if (fatigue >= 88 && isHighPressureFatigueAction(action.kind)) {
    return '疲惫已经逼近极限，这一步再硬压只会先把自己拖垮。先休整，再谈动身、交锋或军旅推进。';
  }
  if (fatigue >= 82 && ['trade', 'diplomacy', 'social', 'romance', 'intrigue', 'investigate', 'sect', 'govern'].includes(String(action.kind || ''))) {
    return '心神和体力都已经太钝了，眼下再去周旋、问策或经营，多半只会把局做坏。先把疲惫压下来。';
  }
  return '';
}

function addNegativeResourceCost(target, delta) {
  if (!target || !delta) return target;
  if (Number(delta.coins || 0) < 0) target.coins += Math.abs(Number(delta.coins || 0));
  if (Number(delta.supplies || 0) < 0) target.supplies += Math.abs(Number(delta.supplies || 0));
  return target;
}

function previewActionResourceCosts(action, tier) {
  const costs = { coins: 0, supplies: 0 };
  if (!action) return costs;

  const teamDefinition = getTeamActionDefinitionByMode(action.mode || '');
  if (teamDefinition) {
    addNegativeResourceCost(costs, teamDefinition.baseDelta || {});
    return costs;
  }

  const rule = getActionOutcomeRule(action.kind, action && action.mode ? action.mode : '');
  if (rule && rule.tierEffects) {
    addNegativeResourceCost(costs, (rule.tierEffects || {})[tier] || {});
  }

  if (action.kind === 'social' && action.mode === 'alliance') {
    costs.coins += 2;
  }
  if (action.kind === 'romance' && action.mode === 'approach') {
    costs.coins += 1;
  }
  if (action.kind === 'romance' && ['promise', 'bond'].includes(String(action.mode || ''))) {
    costs.coins += 2;
  }

  return costs;
}

function validateActionPreflight(state, action, resolved = null) {
  const gs = state && state.gameState ? state.gameState : {};
  const fatigueReason = fatigueHardBlockedReason(gs, action);
  if (fatigueReason) return fatigueReason;
  if (action && action.kind === 'travel' && action.target) {
    const targetCity = findCity(action.target);
    const plan = targetCity ? buildTravelPlan(state.world.currentCityId, targetCity.id) : null;
    if (!plan || !targetCity) return '这条去路眼下还接不实，先换一条能真正走通的路线。';
    const shortages = [];
    if (Number(gs.coins || 0) < Number(plan.totalCoinCost || 0)) {
      shortages.push(`钱财需 ${Number(plan.totalCoinCost || 0)}，当前 ${Number(gs.coins || 0)}`);
    }
    if (Number(gs.supplies || 0) < Number(plan.totalSupplyCost || 0)) {
      shortages.push(`粮秣需 ${Number(plan.totalSupplyCost || 0)}，当前 ${Number(gs.supplies || 0)}`);
    }
    if (shortages.length) {
      return `去${targetCity.name}这条路眼下还走不起：${shortages.join('；')}。先把盘缠和口粮备齐。`;
    }
  }
  if (!resolved) return '';
  if (!regularOutcomeAction(action)) return '';

  const costs = previewActionResourceCosts(action, resolved.tier || 'mixed');
  const shortages = [];
  if (Number(costs.coins || 0) > 0 && Number(gs.coins || 0) < Number(costs.coins || 0)) {
    shortages.push(`钱财需 ${Number(costs.coins || 0)}，当前 ${Number(gs.coins || 0)}`);
  }
  if (Number(costs.supplies || 0) > 0 && Number(gs.supplies || 0) < Number(costs.supplies || 0)) {
    shortages.push(`粮秣需 ${Number(costs.supplies || 0)}，当前 ${Number(gs.supplies || 0)}`);
  }
  if (!shortages.length) return '';

  return `${actionDisplayText(action)}这一步眼下还压不下去：${shortages.join('；')}。先把钱粮补够，再来动这手。`;
}

function applyFatigueStateModifier(gameState, action, resolved, delta) {
  const next = cloneDelta(delta || {});
  const fatigue = Number(gameState && gameState.fatigue || 0);
  const tier = resolved && resolved.tier ? resolved.tier : 'mixed';
  const kind = String(action && action.kind || '');

  if (kind === 'rest') {
    if (fatigue >= 85) {
      next.fatigue = Number(next.fatigue || 0) - 8;
      next.health = Number(next.health || 0) + (tier === 'fail' ? 0 : 2);
      next.morale = Number(next.morale || 0) + (tier === 'fail' ? 0 : 2);
    } else if (fatigue >= 70) {
      next.fatigue = Number(next.fatigue || 0) - 5;
      next.health = Number(next.health || 0) + (tier === 'fail' ? 0 : 1);
      next.morale = Number(next.morale || 0) + (tier === 'fail' ? 0 : 1);
    } else if (fatigue >= 55) {
      next.fatigue = Number(next.fatigue || 0) - 3;
    } else if (fatigue >= 35) {
      next.fatigue = Number(next.fatigue || 0) - 1;
    }
    return next;
  }

  if (!isGeneralFatigueAction(kind)) return next;

  if (fatigue >= 85) {
    next.fatigue = Number(next.fatigue || 0) + (isHighPressureFatigueAction(kind) ? 2 : 1);
    if (isHighPressureFatigueAction(kind) && tier === 'fail') {
      next.health = Number(next.health || 0) - 1;
      next.morale = Number(next.morale || 0) - 1;
    }
    return next;
  }

  if (fatigue >= 70) {
    next.fatigue = Number(next.fatigue || 0) + 1;
    return next;
  }

  if (fatigue >= 55) {
    next.fatigue = Number(next.fatigue || 0) + (isHighPressureFatigueAction(kind) ? 1 : 0);
  }

  return next;
}

function buildConfiguredActionOutcome(state, action, resolved) {
  const rule = getActionOutcomeRule(action.kind, action && action.mode ? action.mode : '');
  if (!rule) return null;
  const delta = cloneDelta((rule.tierEffects || {})[resolved.tier] || {});
  const hook = resolveConfiguredHook(rule, state);
  return {
    delta,
    hook,
    summaryBase: fillTemplate(rule.summaryTemplate, {
      city: state.world.currentCityName,
      tierText: tierText(resolved.tier),
      sectName: state.gameState.sectName || '无门无派'
    })
  };
}

function clearOutcomeArtifacts(state) {
  state.gameState.lastRuleSummary = '';
  state.gameState.lastDeltaLine = '';
  state.gameState.lastCityReport = null;
  state.gameState.lastBattleReport = null;
  state.gameState.lastRetinueFeedback = null;
  state.gameState.lastSkillFeedback = null;
  state.gameState.lastNarrativeEcho = null;
  state.gameState.lastEventTag = '';
}

function ensureFoodState(gameState) {
  if (!gameState || typeof gameState !== 'object') return;
  if (!Array.isArray(gameState.items)) gameState.items = [];
  if (!Array.isArray(gameState.foodBuffs)) gameState.foodBuffs = [];
  if (!Array.isArray(gameState.foodDiscovery)) gameState.foodDiscovery = [];
  if (!gameState.lastMeal || typeof gameState.lastMeal !== 'object') gameState.lastMeal = null;
}

function findFoodItem(gameState, foodId) {
  ensureFoodState(gameState);
  return (gameState.items || []).find((item) => item && String(item.itemType || '') === 'food' && String(item.foodId || item.id).replace(/^food:/, '') === String(foodId || '').trim()) || null;
}

function consumeFoodItem(gameState, foodId) {
  ensureFoodState(gameState);
  const target = findFoodItem(gameState, foodId);
  if (!target) return false;
  target.count = Math.max(0, Number(target.count || 0) - 1);
  if (target.count <= 0) {
    gameState.items = gameState.items.filter((item) => item !== target);
  }
  return true;
}

function ensureFoodDiscovered(gameState, foodId) {
  ensureFoodState(gameState);
  const normalized = String(foodId || '').trim();
  if (!normalized) return;
  if (!gameState.foodDiscovery.includes(normalized)) gameState.foodDiscovery.push(normalized);
}

function grantFoodItem(gameState, foodId, count = 1) {
  ensureFoodState(gameState);
  const normalizedFoodId = String(foodId || '').trim();
  const amount = Math.max(1, Number(count || 1));
  if (!normalizedFoodId) return null;
  const existing = findFoodItem(gameState, normalizedFoodId);
  if (existing) {
    existing.count = Math.max(1, Number(existing.count || 0) + amount);
    ensureFoodDiscovered(gameState, normalizedFoodId);
    return existing;
  }
  const granted = cloneFoodItem(normalizedFoodId, amount);
  if (!granted) return null;
  gameState.items.push(granted);
  ensureFoodDiscovered(gameState, normalizedFoodId);
  return granted;
}

function decayFoodBuffs(gameState) {
  ensureFoodState(gameState);
  gameState.foodBuffs = (gameState.foodBuffs || [])
    .map((item) => Object.assign({}, item, { turns: Math.max(0, Number(item.turns || 0) - 1) }))
    .filter((item) => Number(item.turns || 0) > 0);
}

function foodBuffScore(gameState, action) {
  ensureFoodState(gameState);
  const domain = String(action && action.kind || '').trim();
  return (gameState.foodBuffs || []).reduce((sum, item) => {
    if (!item || String(item.domain || '').trim() !== domain) return sum;
    return sum + Number(item.score || 0);
  }, 0);
}

function maybeGrantFoodFind(state, action, resolved) {
  const gs = state && state.gameState ? state.gameState : null;
  if (!gs || resolved.tier === 'fail') return null;
  const allowedKinds = ['trade', 'travel', 'social', 'diplomacy', 'govern', 'rest'];
  if (!allowedKinds.includes(String(action && action.kind || '').trim())) return null;
  const chanceBase = resolved.tier === 'great' ? 0.55 : resolved.tier === 'good' ? 0.35 : 0.18;
  if (Math.random() > chanceBase) return null;

  const region = String(state && state.world && state.world.currentRegion || '').trim();
  const discovered = new Set(Array.isArray(gs.foodDiscovery) ? gs.foodDiscovery : []);
  const pool = FOOD_DEFINITIONS.filter((item) => {
    if (!item) return false;
    if (Array.isArray(item.regions) && item.regions.length && !item.regions.includes(region)) return false;
    if (resolved.tier !== 'great' && item.rarity === 'rare') return false;
    return !discovered.has(item.id) || Math.random() < 0.35;
  });
  if (!pool.length) return null;
  const selected = pool[Math.floor(Math.random() * pool.length)];
  const granted = grantFoodItem(gs, selected.id, 1);
  if (!granted) return null;
  return selected;
}

function resolveFoodSupplyRestAction(state) {
  const gs = state && state.gameState ? state.gameState : {};
  ensureFoodState(gs);
  const roughFoodPool = FOOD_DEFINITIONS.filter((item) => item && item.rarity === 'common');
  if (!roughFoodPool.length) {
    return {
      kind: 'rest',
      tier: 'fail',
      summary: '我本想先备点粗食，可这一带连最平常的口粮都一时没处着落。',
      changeSummary: '',
      deltaLine: '',
      delta: {}
    };
  }
  if (Number(gs.coins || 0) < 2) {
    return {
      kind: 'rest',
      tier: 'fail',
      summary: `我摸了摸钱袋，连备一份粗食的2钱都凑不出来，只能先把这口打算按下去。`,
      changeSummary: '',
      deltaLine: '',
      delta: {}
    };
  }
  const selected = roughFoodPool[Math.floor(Math.random() * roughFoodPool.length)];
  const granted = grantFoodItem(gs, selected.id, 1);
  if (!granted) {
    return {
      kind: 'rest',
      tier: 'fail',
      summary: '我本想先备点粗食，可临到手上还是没真正把这一口收进囊中。',
      changeSummary: '',
      deltaLine: '',
      delta: {}
    };
  }
  const delta = { coins: -2 };
  applyStatDelta(gs, delta, { action: { kind: 'rest', mode: 'stock_food' } });
  const changeSummary = buildImpactSummary(delta);
  const deltaLine = buildDeltaLine(delta);
  const summary = [
    `我先从市井脚店备下一份${selected.name}。${selected.flavorText}`,
    '这种粗食不为排场，只为在真要缓口气的时候，行囊里别是空的。',
    changeSummary
  ].filter(Boolean).join('');
  state.gameState.lastResolutionSummary = summary;
  state.gameState.lastRuleSummary = changeSummary;
  state.gameState.lastDeltaLine = deltaLine;
  state.gameState.lastEventTag = '粗食入囊';
  return {
    kind: 'rest',
    tier: 'good',
    summary,
    locationHook: '粗食入囊',
    changeSummary,
    deltaLine,
    delta
  };
}

function validateRelationActionAvailability(state, action) {
  const retinueBlockedReason = validateRetinueActionAvailability(state, action);
  if (retinueBlockedReason) return retinueBlockedReason;
  if (!action) return '';
  if (action.kind === 'warpath' && !action.target) {
    return '压向军旅线前，得先指定一位已经结识过的史实军旅人物。';
  }
  if (!action.target) return '';
  const relation = getRelation(state, action.target);
  if (action.kind === 'warpath' && !relation) {
    return '要投向的人物没有找到，重新从关系簿里指定一位史实军旅人物。';
  }
  if (!relation) return '';

  if (action.kind === 'warpath') {
    const tags = Array.isArray(relation.tags) ? relation.tags : [];
    const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
      ? relation.historicalPresence
      : null;
    if (relation.isHistorical !== true) {
      return '压向军旅线只能投向史实人物军中，普通人物不能作为军旅入口。';
    }
    if (!isRelationMet(relation) || relationVisibilityState(relation, 'hidden') !== 'met') {
      return `风闻和露面都不算真正交集。想投向${relation.name}军中，得先把这条线做到“已结识”。`;
    }
    if (!tags.some((item) => ['battle', 'military', 'warpath', 'frontier'].includes(item))) {
      return `${relation.name}并不是当前可投的史实军旅人物，得换一位真正带兵或走军旅线的人物。`;
    }
    if (presence && presence.active !== true) {
      return `${relation.name}眼下不在当前接触面里，暂时还没法直接投向其军中。`;
    }
  }

  if (action.kind === 'romance') {
    const access = historicalDeviationAccessForRelation(state, relation, 'romance');
    if (!access.unlocked) return access.reason;
  }

  if (action.kind === 'social' && ['recruit_probe', 'recruit'].includes(String(action.mode || '')) && relation.isHistorical === true) {
    const access = historicalRecruitAccess(state, relation);
    if (!access.unlocked) {
      const cityName = access.cityName || (state.world && state.world.currentCityName) || '此地';
      return access.inRequiredCity
        ? `${relation.name}这条线还只能停在结识与往来。想把人真正收进幕下，得先在${cityName}拿到“${access.requiredAuthorityLabel}”级别的城池权柄。`
        : `${relation.name}眼下不在我当前所在城的正式接触面里。先去对应城池，并在当地拿到“${access.requiredAuthorityLabel}”级别的城池权柄，再谈真正延揽。`;
    }
  }

  if (action.kind === 'spar') {
    const access = historicalDeviationAccessForRelation(state, relation, 'spar');
    if (!access.unlocked) return access.reason;
  }

  return '';
}

function composeOutcomeSummary(summaryBase, delta) {
  const changeSummary = buildImpactSummary(delta);
  return {
    summary: changeSummary ? `${summaryBase}${changeSummary}` : summaryBase,
    changeSummary,
    deltaLine: buildDeltaLine(delta)
  };
}

function fallbackRegularOutcome(action, resolved) {
  const delta = cloneDelta(
    resolved.tier === 'great'
      ? { health: 10, fatigue: -16, morale: 5 }
      : resolved.tier === 'good'
        ? { health: 6, fatigue: -10, morale: 2 }
        : resolved.tier === 'mixed'
          ? { health: 3, fatigue: -6 }
          : { health: 1, fatigue: -2 }
  );
  const label = actionDisplayText(action);
  return {
    delta,
    hook: '短暂喘息',
    summaryBase: `${label}落下去之后，这一回结果是“${tierText(resolved.tier)}”。`
  };
}

function resolveFoodRestAction(state, action) {
  const gs = state && state.gameState ? state.gameState : {};
  ensureFoodState(gs);
  const foodId = String(action && action.target || '').trim();
  const food = getFoodDefinition(foodId);
  if (!food) {
    return {
      kind: 'rest',
      tier: 'fail',
      summary: '我原本想借一口吃食把状态稳一稳，可行囊里并没有这东西。',
      changeSummary: '',
      deltaLine: '',
      delta: {}
    };
  }
  const inventoryItem = findFoodItem(gs, food.id);
  if (!inventoryItem || Number(inventoryItem.count || 0) <= 0) {
    return {
      kind: 'rest',
      tier: 'fail',
      summary: `我记得${food.name}的味道，可它眼下并不在行囊里。`,
      changeSummary: '',
      deltaLine: '',
      delta: {}
    };
  }

  const delta = cloneDelta(food.instantDelta || {});
  const consumed = consumeFoodItem(gs, food.id);
  if (!consumed) {
    return {
      kind: 'rest',
      tier: 'fail',
      summary: `我本想动${food.name}，结果手边还是空的。`,
      changeSummary: '',
      deltaLine: '',
      delta: {}
    };
  }
  applyStatDelta(gs, delta, { action: { kind: 'rest', mode: 'eat' } });
  if (food.tempBuff && food.tempBuff.domain) {
    gs.foodBuffs.push({
      id: `buff:${food.id}:${Date.now()}`,
      foodId: food.id,
      foodName: food.name,
      domain: food.tempBuff.domain,
      score: Number(food.tempBuff.score || 0),
      turns: Math.max(1, Number(food.tempBuff.turns || 1)),
      note: String(food.tempBuff.note || '').trim()
    });
  }
  ensureFoodDiscovered(gs, food.id);
  gs.lastMeal = {
    foodId: food.id,
    name: food.name,
    category: food.category,
    flavorText: food.flavorText,
    soulLine: food.soulLine,
    turn: Number(state && state.world && state.world.turn || 0)
  };
  const changeSummary = buildImpactSummary(delta);
  const deltaLine = buildDeltaLine(delta);
  const summary = [
    `我把${food.name}慢慢吃下去。${food.flavorText}`,
    food.soulLine ? `脑子里忽然冒出来一句：${food.soulLine}` : '',
    food.tempBuff && food.tempBuff.note ? food.tempBuff.note : '',
    changeSummary
  ].filter(Boolean).join('');
  state.gameState.lastResolutionSummary = summary;
  state.gameState.lastRuleSummary = changeSummary;
  state.gameState.lastDeltaLine = deltaLine;
  state.gameState.lastEventTag = '食味入局';
  return {
    kind: 'rest',
    tier: 'good',
    summary,
    locationHook: '食味入局',
    changeSummary,
    deltaLine,
    delta
  };
}

function applyStatDelta(gameState, delta, options = {}) {
  ensureFatigueChannels(gameState);
  const previousMartialLevel = clamp(Number(gameState.martialLevel || 0), 0, 100);
  const previousFatigue = clamp(Number(gameState.fatigue || 0), 0, 100);
  Object.keys(delta).forEach((key) => {
    gameState[key] = (gameState[key] || 0) + delta[key];
  });
  gameState.health = clamp(gameState.health || 0, 0, gameState.maxHealth || 100);
  gameState.maxHealth = clamp(gameState.maxHealth || 100, 40, 180);
  gameState.fatigue = clamp(gameState.fatigue || 0, 0, 100);
  applyFatigueChannelDelta(gameState, Number(gameState.fatigue || 0) - previousFatigue, options && options.action ? options.action : null);
  gameState.coins = Math.max(0, gameState.coins || 0);
  gameState.supplies = Math.max(0, gameState.supplies || 0);
  gameState.troops = Math.max(0, gameState.troops || 0);
  gameState.morale = clamp(gameState.morale || 0, 0, 100);
  gameState.influence = clamp(gameState.influence || 0, 0, 100);
  gameState.renown = clamp(gameState.renown || 0, 0, 100);
  gameState.governance = clamp(gameState.governance || 0, 0, 100);
  gameState.diplomacy = clamp(gameState.diplomacy || 0, 0, 100);
  gameState.commerce = clamp(gameState.commerce || 0, 0, 100);
  gameState.military = clamp(gameState.military || 0, 0, 100);
  gameState.strategy = clamp(gameState.strategy || 0, 0, 100);
  gameState.charm = clamp(gameState.charm || 0, 0, 100);
  gameState.martialLevel = clamp(gameState.martialLevel || 0, 0, 100);
  gameState.martialExp = Math.max(0, gameState.martialExp || 0);
  gameState.martialInsight = Math.max(0, gameState.martialInsight || 0);
  gameState.battlefieldPrestige = Math.max(0, gameState.battlefieldPrestige || 0);
  gameState.jianghuPrestige = Math.max(0, gameState.jianghuPrestige || 0);
  gameState.strategyLevel = clamp(gameState.strategyLevel || 0, 0, 100);
  gameState.strategyExp = Math.max(0, gameState.strategyExp || 0);
  gameState.sectFavor = clamp(gameState.sectFavor || 0, 0, 100);
  gameState.sectPower = clamp(gameState.sectPower || 0, 0, 100);
  if (Number(delta && delta.martialLevel) > 0) {
    const martialCap = martialLevelCap(gameState);
    gameState.martialLevel = Math.min(gameState.martialLevel || 0, Math.max(previousMartialLevel, martialCap));
  }
  applyPathSnapshot(gameState);
}

function tierOf(score) {
  if (score >= 12) return 'great';
  if (score >= 8) return 'good';
  if (score >= 5) return 'mixed';
  return 'fail';
}

function tierText(tier) {
  return {
    great: '大成',
    good: '得手',
    mixed: '勉强',
    fail: '失手'
  }[tier] || '未定';
}

function outcomeConstraintText(outcome) {
  const tier = outcome && outcome.tier ? outcome.tier : 'mixed';
  return `这一步的本地判定已经定死为“${tierText(tier)}”。只能围绕这个结果展开，不得把失手写成得手，也不得把勉强写成大成。`;
}

function actFocusBonus(state, kind) {
  const act = getCurrentAct(state.world);
  return ensureList(act.focus).includes(kind) ? 2 : 0;
}

function rollVariance() {
  const roll = 1 + Math.floor(Math.random() * 20);
  let bonus = 0;
  let label = '平常发挥';
  if (roll >= 19) {
    bonus = 3;
    label = '超常发挥';
  } else if (roll >= 15) {
    bonus = 1;
    label = '抓住了节奏';
  } else if (roll <= 2) {
    bonus = -3;
    label = '寸步失衡';
  } else if (roll <= 6) {
    bonus = -1;
    label = '气势稍滞';
  }
  return { roll, bonus, label };
}

function levelThreshold(level, kind) {
  if (kind === 'martial') {
    return 18 + Math.floor(level / 4) * 3 + Math.floor(level / 12) * 5 + Math.floor(level / 30) * 8;
  }
  return 20 + Math.floor(level / 5) * 3 + Math.floor(level / 15) * 4;
}

function martialTrainingCap(gs) {
  return gs && gs.martialLimitBroken ? 100 : 90;
}

function currentMartialBottleneck(gs) {
  const level = Number(gs.martialLevel || 0);
  const insight = Number(gs.martialInsight || 0);
  return MARTIAL_BOTTLENECKS.find((item) => level >= item.level && insight < item.insight) || null;
}

function nextMartialBottleneck(gs) {
  const level = Number(gs.martialLevel || 0);
  const insight = Number(gs.martialInsight || 0);
  return MARTIAL_BOTTLENECKS.find((item) => level < item.level && insight < item.insight) || null;
}

function martialLevelCap(gs) {
  const trainingCap = martialTrainingCap(gs);
  const currentLevel = clamp(Number(gs.martialLevel || 0), 0, 100);
  if (currentLevel >= trainingCap) return trainingCap;
  const active = currentMartialBottleneck(gs);
  if (active) return clamp(Number(gs.martialLevel || 0), 0, 100);
  const next = nextMartialBottleneck(gs);
  return Math.min(next ? next.level : trainingCap, trainingCap);
}

function constrainMartialDelta(gs, delta) {
  const normalized = cloneDelta(delta || {});
  const gain = Number(normalized.martialLevel || 0);
  if (gain <= 0) {
    return { delta: normalized, blockedBy: null, blockedGain: 0 };
  }

  const currentLevel = clamp(Number(gs.martialLevel || 0), 0, 100);
  const cap = martialLevelCap(gs);
  const allowedGain = Math.max(0, cap - currentLevel);
  if (gain <= allowedGain) {
    return { delta: normalized, blockedBy: null, blockedGain: 0 };
  }

  normalized.martialLevel = allowedGain;
  return {
    delta: normalized,
    blockedBy: (!gs.martialLimitBroken && cap >= 90 && currentLevel >= 90)
      ? { name: '万人敌之门', hint: '常规修炼已经走到吕布这一档的极限。若想再往上，只能靠真正奇遇破限。' }
      : (currentMartialBottleneck(gs) || nextMartialBottleneck(gs)),
    blockedGain: gain - allowedGain
  };
}

function martialBottleneckSummary(blockedBy, blockedGain) {
  if (!blockedBy || blockedGain <= 0) return '';
  return `我的武艺撞上了“${blockedBy.name}”，被卡下来的那一截还得靠名师点拨、险局实战或真正的奇遇才能硬生生顶开。`;
}

function martialBattleScaleValue(martialPower) {
  const power = Math.max(0, Number(martialPower || 0));
  if (power >= 100000) return 900;
  if (power >= 10000) return 420;
  if (power >= 1000) return 160;
  if (power >= 100) return 70;
  return Math.round(power * 0.6);
}

function martialBattleStrengthValue(martialPower) {
  const power = Math.max(0, Number(martialPower || 0));
  if (power >= 100000) return 30;
  if (power >= 10000) return 20;
  if (power >= 1000) return 12;
  if (power >= 100) return 6;
  return power / 20;
}

function martialInsightGain(state, actionKind, tier) {
  const gs = state.gameState || {};
  let gain = 0;
  if (actionKind === 'joinsect') gain += tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
  if (actionKind === 'sect') gain += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
  if (actionKind === 'jianghu') gain += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
  if (['battle', 'warpath'].includes(actionKind)) gain += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
  if (actionKind === 'martial' && gs.sectId) gain += tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
  if (actionKind === 'investigate' && tier === 'great') gain += 1;
  return gain;
}

function pathExpBase(actionKind) {
  return {
    martial: { martial: 4, strategy: 1 },
    battle: { martial: 5, strategy: 2 },
    warpath: { martial: 4, strategy: 3 },
    jianghu: { martial: 4, strategy: 1 },
    sect: { martial: 3, strategy: 2 },
    joinsect: { martial: 4, strategy: 2 },
    military: { martial: 1, strategy: 4 },
    govern: { martial: 0, strategy: 4 },
    trade: { martial: 0, strategy: 4 },
    diplomacy: { martial: 0, strategy: 4 },
    social: { martial: 0, strategy: 3 },
    romance: { martial: 0, strategy: 3 },
    investigate: { martial: 1, strategy: 5 },
    intrigue: { martial: 0, strategy: 5 },
    rest: { martial: 1, strategy: 1 },
    travel: { martial: 1, strategy: 2 },
    unknown: { martial: 0, strategy: 1 }
  }[actionKind] || { martial: 0, strategy: 1 };
}

function tierExpBonus(tier) {
  return {
    great: 4,
    good: 3,
    mixed: 2,
    fail: 1
  }[tier] || 1;
}

function applyPathUnlocks(state) {
  const gs = state.gameState;
  const martialPath = getMartialPath(gs.martialRouteId);
  const strategyPath = getStrategyPath(gs.strategyRouteId);

  ensureList(martialPath.unlocks).forEach((unlock) => {
    if ((gs.martialLevel || 0) >= unlock.level) addSkill(state, unlock.skill);
  });
  ensureList(strategyPath.unlocks).forEach((unlock) => {
    if ((gs.strategyLevel || 0) >= unlock.level) addSkill(state, unlock.skill);
  });
}

function advancePathExperience(state, actionKind, tier) {
  const gs = state.gameState;
  const martialPath = getMartialPath(gs.martialRouteId);
  const strategyPath = getStrategyPath(gs.strategyRouteId);
  const base = pathExpBase(actionKind);
  const bonus = tierExpBonus(tier);
  const relatedActionKinds = [actionKind];
  if (actionKind === 'warpath') relatedActionKinds.push('battle', 'military');
  if (actionKind === 'jianghu') relatedActionKinds.push('martial', 'travel', 'sect');

  let martialGain = base.martial + bonus;
  let strategyGain = base.strategy + bonus;
  const insightGain = martialInsightGain(state, actionKind, tier);

  if (relatedActionKinds.some((kind) => ensureList(martialPath.preferredActions).includes(kind))) martialGain += 2;
  if (relatedActionKinds.some((kind) => ensureList(strategyPath.preferredActions).includes(kind))) strategyGain += 2;
  if (!['martial', 'battle', 'warpath', 'jianghu', 'sect', 'joinsect', 'travel', 'military'].includes(actionKind)) martialGain = Math.max(0, martialGain - 2);

  gs.martialExp = Math.max(0, (gs.martialExp || 0) + martialGain);
  gs.strategyExp = Math.max(0, (gs.strategyExp || 0) + strategyGain);
  gs.martialInsight = Math.max(0, Number(gs.martialInsight || 0) + insightGain);

  const levelDelta = {};
  let martialUps = 0;
  let strategyUps = 0;

  while (gs.martialExp >= levelThreshold(gs.martialLevel || 0, 'martial') && (gs.martialLevel || 0) < martialLevelCap(gs)) {
    if (currentMartialBottleneck(gs)) break;
    gs.martialExp -= levelThreshold(gs.martialLevel || 0, 'martial');
    gs.martialLevel += 1;
    martialUps += 1;
  }

  while (gs.strategyExp >= levelThreshold(gs.strategyLevel || 0, 'strategy') && (gs.strategyLevel || 0) < 100) {
    gs.strategyExp -= levelThreshold(gs.strategyLevel || 0, 'strategy');
    gs.strategyLevel += 1;
    strategyUps += 1;
  }

  if (martialUps > 0) {
    Object.keys(martialPath.levelUpDelta || {}).forEach((key) => {
      levelDelta[key] = (levelDelta[key] || 0) + (martialPath.levelUpDelta[key] * martialUps);
    });
  }

  if (strategyUps > 0) {
    Object.keys(strategyPath.levelUpDelta || {}).forEach((key) => {
      levelDelta[key] = (levelDelta[key] || 0) + (strategyPath.levelUpDelta[key] * strategyUps);
    });
  }

  if (martialUps > 0 || strategyUps > 0) {
    applyStatDelta(gs, levelDelta, { action: { kind: 'martial', mode: 'levelup' } });
  } else {
    applyPathSnapshot(gs);
  }

  applyPathUnlocks(state);
}

function maybeTriggerMartialBreakthrough(state, actionKind, tier, relation) {
  const gs = state.gameState || {};
  if (gs.martialLimitBroken) return '';
  if (!['martial', 'battle', 'warpath', 'jianghu', 'sect', 'joinsect'].includes(actionKind)) return '';
  if ((gs.martialLevel || 0) < 89) return '';

  const marks = Number(encounterBreakthroughMarks(state) || 0);
  const battlefieldPrestige = Number(gs.battlefieldPrestige || 0);
  const jianghuPrestige = Number(gs.jianghuPrestige || 0);
  const masterSeal = !!(
    (relation && Number(relation.martialRating || 0) >= 90)
    || ((gs.sectId || '') && Number(gs.sectFavor || 0) >= 18 && Number(gs.sectPower || 0) >= 12)
  );
  const fameSeal = battlefieldPrestige >= 95 || jianghuPrestige >= 95;
  const ordealSeal = Number(gs.health || 0) <= 46
    || Number(gs.fatigue || 0) >= 58
    || (['battle', 'warpath', 'jianghu'].includes(actionKind) && tier === 'great');
  const insightSeal = Number(gs.martialInsight || 0) >= 24;
  const marksSeal = marks >= 5;
  const greatSeal = tier === 'great';
  const seals = [masterSeal, fameSeal, ordealSeal, insightSeal, marksSeal, greatSeal].filter(Boolean).length;

  if (seals < 5) return '';

  gs.martialLimitBroken = true;
  gs.martialInsight = Math.max(0, Number(gs.martialInsight || 0) + 4);
  if ((gs.martialLevel || 0) >= 90 && (gs.martialLevel || 0) < 100) {
    gs.martialLevel += 1;
  }
  const encounters = ensureEncounterState(state);
  encounters.breakthroughMarks = Math.max(0, Number(encounters.breakthroughMarks || 0) - 4);
  addSkill(state, {
    id: 'martial_destiny_break',
    name: '奇遇破限',
    type: '武学',
    level: '传奇',
    effect: '常规武学极限被打穿，此后可继续把武艺推向十万人敌。'
  });
  applyPathSnapshot(gs);
  const line = relation && relation.name
    ? `这一回里，${relation.name}、眼前这一局和我之前积下的名势终于同时扣在了一处。原本止于九十的武艺上限被硬生生撞开，我终于能从万人敌继续往十万人敌走。`
    : '这一回里，我之前积下的名势、悟性与险局终于在同一刻扣死。原本止于九十的武艺上限被硬生生撞开，我终于能从万人敌继续往十万人敌走。';
  appendThread(state, '武学已经破限。以后再想往上，不只是继续练，而是要拿真正的大局、大敌和大机缘去换。', 3, '武学');
  return line;
}

function applyMartialRouteBattleModifier(state, score, delta) {
  const routeId = state.gameState.martialRouteId;
  if (routeId === 'taibai_sword') {
    score += 2;
    delta.renown += 1;
  } else if (routeId === 'canglang_blade') {
    score += 1;
    delta.morale += 2;
  } else if (routeId === 'qingnang_body') {
    delta.health += 2;
    delta.fatigue -= 2;
  } else if (routeId === 'xuanfeng_lance') {
    score += state.world.pressure >= 35 ? 3 : 1;
    delta.strategy += 1;
  } else if (routeId === 'wild') {
    delta.morale += Math.max(1, Math.min(4, Math.round((state.gameState.martialPower || 0) / 260)));
    delta.renown += (state.gameState.martialPower || 0) >= 1000 ? 1 : 0;
  }
  return { score, delta };
}

function applyStrategyRouteActionModifier(state, actionKind, resolved, delta) {
  const routeId = state.gameState.strategyRouteId;
  if (routeId === 'courtcraft' && ['diplomacy', 'social', 'romance', 'govern'].includes(actionKind)) {
    delta.influence = (delta.influence || 0) + 1;
    if (resolved.tier !== 'fail') delta.renown = (delta.renown || 0) + 1;
  } else if (routeId === 'mercantile' && ['trade', 'travel', 'diplomacy'].includes(actionKind)) {
    delta.coins = (delta.coins || 0) + 2;
    delta.supplies = (delta.supplies || 0) + (actionKind === 'trade' ? 2 : 0);
  } else if (routeId === 'frontier_command' && ['military', 'govern', 'battle', 'warpath'].includes(actionKind)) {
    delta.morale = (delta.morale || 0) + 2;
    if (actionKind === 'military' || actionKind === 'warpath') delta.influence = (delta.influence || 0) + 1;
  } else if (routeId === 'shadow_scheme' && ['investigate', 'intrigue', 'social'].includes(actionKind)) {
    delta.strategy = (delta.strategy || 0) + 1;
    delta.influence = (delta.influence || 0) + 1;
  } else if (routeId === 'survival' && ['rest', 'travel', 'investigate'].includes(actionKind)) {
    delta.health = (delta.health || 0) + 1;
    delta.fatigue = (delta.fatigue || 0) - 1;
  }
  return delta;
}

function lineIdentityScoreBonus(state, actionKind) {
  const gs = state && state.gameState ? state.gameState : {};
  const territory = state && state.world && state.world.territory ? state.world.territory : {};
  let score = 0;
  if (gs.martialFocusId === 'battlefield' && ['military', 'warpath', 'battle'].includes(actionKind)) score += 2;
  if (gs.martialFocusId === 'jianghu' && ['jianghu', 'martial', 'spar'].includes(actionKind)) score += 2;
  if ((gs.sectId || '') && ['sect', 'joinsect', 'martial'].includes(actionKind)) score += 1;
  if (Number(territory.governedCount || 0) > 0 && ['govern', 'trade', 'diplomacy'].includes(actionKind)) score += 2;
  if (Number(territory.controlledCount || 0) > 0 && ['military', 'battle', 'warpath'].includes(actionKind)) score += 1;
  return score;
}

function applyLineIdentityActionModifier(state, actionKind, resolved, delta) {
  const gs = state && state.gameState ? state.gameState : {};
  const territory = state && state.world && state.world.territory ? state.world.territory : {};
  const tier = String(resolved && resolved.tier || '').trim();
  const success = tier && tier !== 'fail';

  if (gs.martialFocusId === 'battlefield' && ['military', 'warpath', 'battle'].includes(actionKind)) {
    delta.morale = (delta.morale || 0) + 1;
    if (success) delta.battlefieldPrestige = (delta.battlefieldPrestige || 0) + 1;
  }
  if (gs.martialFocusId === 'jianghu' && ['jianghu', 'martial', 'spar'].includes(actionKind)) {
    delta.renown = (delta.renown || 0) + 1;
    if (success) delta.jianghuPrestige = (delta.jianghuPrestige || 0) + 1;
  }
  if ((gs.sectId || '') && ['sect', 'joinsect', 'martial'].includes(actionKind) && success) {
    delta.sectFavor = (delta.sectFavor || 0) + 1;
  }
  if (Number(territory.governedCount || 0) > 0 && ['govern', 'trade'].includes(actionKind)) {
    delta.coins = (delta.coins || 0) + 1;
    if (success) delta.supplies = (delta.supplies || 0) + 1;
  }
  if (Number(territory.governedCount || 0) > 0 && actionKind === 'diplomacy' && success) {
    delta.influence = (delta.influence || 0) + 1;
  }
  if (Number(territory.controlledCount || 0) > 0 && ['military', 'battle', 'warpath'].includes(actionKind) && success) {
    delta.troops = (delta.troops || 0) + 1;
  }
  return delta;
}

function martialApexState(gameState) {
  ensureLifecycleState({ world: { turn: 0, maxTurns: 144, endYear: 220 }, gameState });
  return gameState.martialApex;
}

function martialApexRoute(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const territory = state && state.world && state.world.territory ? state.world.territory : {};
  const battlefieldScore = Number(gs.battlefieldPrestige || 0) * 1.5 + Number(gs.military || 0) + Number(territory.controlledCount || 0) * 28;
  const jianghuScore = Number(gs.jianghuPrestige || 0) * 1.55 + Number(gs.renown || 0) + Number(gs.martialLevel || 0);
  const sectScore = ((gs.sectId || '') ? 24 : 0) + Number(gs.sectFavor || 0) + Number(gs.sectPower || 0) + Number(gs.diplomacy || 0) * 0.4;
  const territoryScore = Number(gs.governance || 0) + Number(gs.strategy || 0) + Number(gs.diplomacy || 0) * 0.75 + Number(territory.governedCount || 0) * 22 + Number(territory.controlledCount || 0) * 30;

  const ranked = [
    { key: 'battlefield', score: battlefieldScore },
    { key: 'jianghu', score: jianghuScore },
    { key: 'sect', score: sectScore },
    { key: 'territory', score: territoryScore }
  ].sort((left, right) => right.score - left.score);

  if (gs.martialFocusId === 'battlefield') return 'battlefield';
  if (gs.martialFocusId === 'jianghu') return 'jianghu';
  if ((gs.sectId || '') && ranked[0] && ranked[0].score <= sectScore + 8) return 'sect';
  return ranked[0] ? ranked[0].key : 'territory';
}

function martialApexExposureShift(actionKind, tier) {
  const base = {
    battle: 14,
    warpath: 13,
    military: 11,
    jianghu: 10,
    spar: 9,
    martial: 8,
    sect: 6,
    joinsect: 5,
    investigate: 4,
    intrigue: 4,
    diplomacy: 4,
    social: 3,
    govern: 3,
    trade: 3,
    travel: 2,
    romance: 2,
    rest: -7
  }[String(actionKind || '').trim()] || 3;
  const tierBonus = {
    great: 3,
    good: 2,
    mixed: 1,
    fail: 1
  }[String(tier || '').trim()] || 1;
  return base + tierBonus;
}

function applyMartialApexSideEffects(state, action, outcome) {
  ensureLifecycleState(state);
  const gs = state && state.gameState ? state.gameState : {};
  const world = state && state.world ? state.world : {};
  const territory = world.territory && typeof world.territory === 'object' ? world.territory : {};
  if (Number(gs.martialLevel || 0) < 100) return '';

  const apex = martialApexState(gs);
  const turn = Number(world.turn || 0);
  if (apex.lastSideEffectTurn === turn) return '';
  if (!apex.unlockedAtTurn) apex.unlockedAtTurn = turn;

  const actionKind = String(action && action.kind || '').trim();
  const tier = String(outcome && outcome.tier || 'mixed').trim();
  const violent = ['battle', 'warpath', 'military', 'jianghu', 'spar', 'martial'].includes(actionKind);
  const stateful = ['govern', 'trade', 'diplomacy', 'investigate', 'intrigue', 'social'].includes(actionKind);
  let exposureShift = martialApexExposureShift(actionKind, tier);
  let threatShift = violent ? 3 : 1;

  if (actionKind === 'rest') {
    threatShift = -4;
  } else if (stateful && tier !== 'fail') {
    exposureShift -= 4;
    threatShift -= 2;
  } else if (stateful) {
    threatShift += 1;
  }
  if (Number(territory.governedCount || 0) > 0 && ['govern', 'trade', 'diplomacy'].includes(actionKind) && tier !== 'fail') {
    threatShift -= 1;
  }
  if (Number(world.pressure || 0) >= 55) threatShift += 1;
  if (violent && tier === 'great') threatShift += 1;

  apex.exposure = clamp(Number(apex.exposure || 0) + exposureShift, 0, 100);
  apex.threat = clamp(Number(apex.threat || 0) + threatShift, 0, 100);
  apex.burden = clamp(Math.round(apex.exposure * 0.45 + apex.threat * 0.75), 0, 100);
  apex.sideEffectStage = apex.threat >= 70 || apex.exposure >= 80
    ? 3
    : (apex.threat >= 38 || apex.exposure >= 55 ? 2 : (apex.threat >= 16 || apex.exposure >= 28 ? 1 : 0));
  apex.lastSideEffectTurn = turn;

  const delta = {};
  let worldPressureDelta = 0;
  if (apex.sideEffectStage >= 1 && actionKind !== 'rest') {
    worldPressureDelta += 1;
  }
  if (apex.sideEffectStage >= 2) {
    if (violent) {
      delta.fatigue = (delta.fatigue || 0) + 2;
      delta.supplies = (delta.supplies || 0) - 1;
    } else if (stateful) {
      delta.influence = (delta.influence || 0) - 1;
    }
  }
  if (apex.sideEffectStage >= 3) {
    worldPressureDelta += 1;
    if (violent) {
      delta.fatigue = (delta.fatigue || 0) + 2;
      delta.supplies = (delta.supplies || 0) - 2;
      delta.morale = (delta.morale || 0) - 2;
    } else {
      delta.coins = (delta.coins || 0) - 1;
      delta.influence = (delta.influence || 0) - 1;
    }
  }

  if (worldPressureDelta) {
    world.pressure = clamp(Number(world.pressure || 0) + worldPressureDelta, 0, 100);
  }
  if (Object.keys(delta).length) {
    applyStatDelta(gs, delta, { action: { kind: 'martial', mode: 'apex_backlash' } });
  }
  gs.martialApex = apex;

  let note = '';
  if (actionKind === 'rest') {
    note = '我把锋芒暂时按住，武名压出来的那层紧张只松开了一线。';
  } else if (apex.sideEffectStage >= 3 && violent) {
    note = '武名越重，每一次出手就越像点火；这一回连粮秣、军心和周围人的站位都被顺手烧掉了一层。';
  } else if (apex.sideEffectStage >= 2 && stateful) {
    note = '我这回明明没想靠蛮压，旁人却先按最坏的路数防我，许多该谈的话因此更难落地。';
  } else if (apex.sideEffectStage >= 1) {
    note = '自从武艺踏过顶点，局势就开始先防我会不会动手，平白又绷紧了一层。';
  }
  apex.lastBurdenNote = note;
  return note;
}

function martialApexThreadPayload(route, kind) {
  if (kind === 'probe') {
    return {
      key: 'apex:exposure_probe',
      title: '我的武名已经把太多人逼到一起，他们开始借我的名头并线试探，我得先把谁在背后搅局查清。',
      domain: '谋略',
      urgency: 2,
      rivalName: '各路试探者',
      successConsequences: [
        { type: 'apex_resolve', targetId: 'apex:exposure_probe', note: '我先把这波试探拆开了。' },
        { type: 'apex_threat', value: -6, note: '武名带来的外部试探暂时退了一截。' },
        { type: 'influence', value: 1, note: '我反而借机稳了一层人心。' }
      ],
      failureConsequences: [
        { type: 'pressure', value: 4, note: '别人开始借我的名头布自己的局。' },
        { type: 'influence', value: -2, note: '不少人开始躲着表态。' },
        { type: 'apex_threat', value: 6, note: '武名的外溢反而更凶。' }
      ]
    };
  }
  if (kind === 'route' && route === 'battlefield') {
    return {
      key: 'apex:battlefield:crisis',
      title: '军中已经开始只认我的锋头不认军令，若不把粮、令、赏罚重新压实，这支人马迟早先乱。',
      domain: '经营',
      urgency: 3,
      rivalName: '营中旧将',
      successConsequences: [
        { type: 'apex_resolve', targetId: 'apex:battlefield:crisis', note: '我把军政重新按紧了。' },
        { type: 'apex_threat', value: -8, note: '军中失衡被按回去一截。' },
        { type: 'morale', value: 2, note: '军心被重新稳住。' }
      ],
      failureConsequences: [
        { type: 'morale', value: -4, note: '只认个人威势的军伍最先散心。' },
        { type: 'supplies', value: -6, note: '军需开始漏。' },
        { type: 'pressure', value: 5, note: '局势对外更紧。' },
        { type: 'apex_threat', value: 8, note: '武名反而压坏了军内秩序。' }
      ]
    };
  }
  if (kind === 'route' && route === 'jianghu') {
    return {
      key: 'apex:jianghu:crisis',
      title: '江湖上已经有人借我的名头抢徒、截帖、夺人，我得先把受我牵连的人心稳住。',
      domain: '人物',
      urgency: 3,
      rivalName: '借名搅局者',
      successConsequences: [
        { type: 'apex_resolve', targetId: 'apex:jianghu:crisis', note: '我把人心和门面先稳住了。' },
        { type: 'apex_threat', value: -8, note: '江湖反噬被压住一层。' },
        { type: 'renown', value: 1, note: '名声没有被人白借走。' }
      ],
      failureConsequences: [
        { type: 'jianghu_prestige', value: -3, note: '名头开始被人挪用。' },
        { type: 'influence', value: -2, note: '真正愿意站出来的人变少了。' },
        { type: 'pressure', value: 4, note: '仇家和跟风者一起变多。' },
        { type: 'apex_threat', value: 8, note: '武名继续倒灌回来。' }
      ]
    };
  }
  if (kind === 'route' && route === 'sect') {
    return {
      key: 'apex:sect:crisis',
      title: '门中已经有人拿我的武名做旗号争承夺位，我若不先定规矩，传承会先裂。',
      domain: '人物',
      urgency: 3,
      rivalName: '门中争承者',
      successConsequences: [
        { type: 'apex_resolve', targetId: 'apex:sect:crisis', note: '我先把门中规矩按住了。' },
        { type: 'apex_threat', value: -8, note: '门派反噬暂时退潮。' },
        { type: 'sectFavor', value: 2, note: '门中人心重新向我收拢。' }
      ],
      failureConsequences: [
        { type: 'sectFavor', value: -5, note: '门中人心先裂。' },
        { type: 'influence', value: -2, note: '外界开始看低这脉传承。' },
        { type: 'pressure', value: 4, note: '门内外的风声一起变坏。' },
        { type: 'apex_threat', value: 8, note: '这身武名开始拖裂门内秩序。' }
      ]
    };
  }
  if (kind === 'route') {
    return {
      key: 'apex:territory:crisis',
      title: '地盘里的人已经把我的强横当作默认秩序，税、粮和征发开始一并失真，我得先把规矩立住。',
      domain: '经营',
      urgency: 3,
      rivalName: '地面盘剥者',
      successConsequences: [
        { type: 'apex_resolve', targetId: 'apex:territory:crisis', note: '我把规矩重新立出来了。' },
        { type: 'apex_threat', value: -8, note: '地盘对武名的误读退下去一层。' },
        { type: 'coins', value: 2, note: '漏掉的账被收回来一截。' }
      ],
      failureConsequences: [
        { type: 'coins', value: -4, note: '账面开始漏。' },
        { type: 'supplies', value: -4, note: '粮秣也跟着失真。' },
        { type: 'morale', value: -3, note: '部下对秩序的信心下降。' },
        { type: 'pressure', value: 5, note: '地盘内部的暗流更紧。' },
        { type: 'apex_threat', value: 8, note: '武名的副作用开始直接咬地盘。' }
      ]
    };
  }
  return {
    key: 'apex:conversion',
    title: '光靠我能打已经不够了。若不能把这身武名换成真正能长期运转的秩序、盟约或传承，这股势头迟早会先把自己烧空。',
    domain: route === 'battlefield' || route === 'territory' ? '经营' : '谋略',
    urgency: 3,
    rivalName: '被武名催出来的新局',
    successConsequences: [
      { type: 'apex_resolve', targetId: 'apex:conversion', note: '我终于把这身武名往别的东西上换过去了。' },
      { type: 'apex_threat', value: -12, note: '那股压在身后的反噬终于松了一大截。' },
      { type: 'pressure', value: -2, note: '局势终于不是只被锋头顶着走。' },
      { type: 'influence', value: 2, note: '别人开始把我当成秩序，而不只是凶名。' }
    ],
    failureConsequences: [
      { type: 'pressure', value: 8, note: '这股势头开始反噬整盘局。' },
      { type: 'influence', value: -4, note: '旁人开始只怕我，不再真心跟我。' },
      { type: 'morale', value: -4, note: '连自己人都会开始心浮。' },
      { type: 'apex_threat', value: 10, note: '武名失控地继续往外烧。' }
    ]
  };
}

function spawnMartialApexCrises(state) {
  ensureLifecycleState(state);
  const gs = state && state.gameState ? state.gameState : {};
  if (Number(gs.martialLevel || 0) < 100) return [];

  const apex = martialApexState(gs);
  const triggered = new Set(ensureList(apex.triggeredCrisisKeys).map((item) => String(item || '').trim()).filter(Boolean));
  const route = martialApexRoute(state);
  const lines = [];
  const turn = Number(state && state.world && state.world.turn || 0);

  const maybeSpawn = (kind, threshold) => {
    const payload = martialApexThreadPayload(route, kind);
    if (Number(apex.threat || 0) < threshold || !payload || triggered.has(payload.key)) return;
    appendThread(state, payload.title, payload.urgency, payload.domain, {
      opportunityKey: payload.key,
      rivalName: payload.rivalName,
      successConsequences: payload.successConsequences,
      failureConsequences: payload.failureConsequences,
      notes: ['武力巅峰专属危机']
    });
    triggered.add(payload.key);
    lines.push(payload.title);
  };

  maybeSpawn('probe', 22);
  maybeSpawn('route', 46);
  maybeSpawn('conversion', 72);

  apex.triggeredCrisisKeys = Array.from(triggered).slice(0, 16);
  if (lines.length) apex.lastCrisisTurn = turn;
  gs.martialApex = apex;
  return lines;
}

function applyMartialFocusUnlocks(state) {
  const gs = state.gameState;
  if ((gs.battlefieldPrestige || 0) >= 40) {
    addSkill(state, { id: 'battlefield_vanguard', name: '阵前骁锐', type: '武学志向', level: '小成', effect: '军旅线稳定成型，统兵试锋与战场争锋更容易滚起威名。' });
  }
  if ((gs.battlefieldPrestige || 0) >= 100) {
    addSkill(state, { id: 'battlefield_legend', name: '陷阵万人敌', type: '武学志向', level: '大成', effect: '军阵威名足以压住大片战局，军旅与大战结算会更能吃满个人武学加成。' });
  }
  if ((gs.jianghuPrestige || 0) >= 40) {
    addSkill(state, { id: 'jianghu_duelist', name: '名动江湖', type: '武学志向', level: '小成', effect: '江湖线已经成形，问剑群雄时更容易滚起声望与追随者。' });
  }
  if ((gs.jianghuPrestige || 0) >= 100) {
    addSkill(state, { id: 'jianghu_supreme', name: '天下第一候', type: '武学志向', level: '大成', effect: '不必入官场，也能凭一身武学与江湖威名压到绝顶。' });
  }
}

function relationActionScoreBonus(actionKind, relation) {
  if (!relation) return 0;
  const trust = Number(relation.trust || 0);
  const affection = Number(relation.affection || 0);
  const loyalty = Number(relation.loyalty || 0);
  const rivalry = Number(relation.rivalry || 0);
  const tags = ensureList(relation.tags);
  const martialRating = Number(relation.martialRating || 0);
  const strategyRating = Number(relation.strategyRating || 0);

  if (actionKind === 'social') {
    return Math.round((trust + affection * 0.6 + loyalty * 0.3 - rivalry * 0.5) / 22) + (tags.includes('social') ? 1 : 0);
  }
  if (actionKind === 'romance') {
    return Math.round((affection * 1.4 + trust * 0.8 + loyalty * 0.5 - rivalry) / 24) + (relation.bondKey === 'lover' ? 2 : 0) + (tags.includes('romance') ? 1 : 0);
  }
  if (actionKind === 'diplomacy') {
    return Math.round((trust + loyalty + affection * 0.4) / 30)
      + (relation.bondKey === 'advisor' ? 2 : 0)
      + Math.max(0, Math.floor((strategyRating - 68) / 12))
      + (tags.some((item) => ['diplomacy', 'govern', 'strategy'].includes(item)) ? 1 : 0);
  }
  if (['govern', 'trade', 'investigate', 'intrigue'].includes(actionKind)) {
    return Math.round((trust + loyalty + affection * 0.35 - rivalry * 0.25) / 32)
      + Math.max(0, Math.floor((strategyRating - 65) / 12))
      + (tags.some((item) => ['govern', 'trade', 'strategy', 'investigate', 'intrigue'].includes(item)) ? 1 : 0);
  }
  if (['martial', 'battle', 'warpath', 'jianghu', 'military'].includes(actionKind)) {
    return Math.round((trust + loyalty - rivalry * 0.4) / 34) + Math.max(0, Math.floor((martialRating - 60) / 12)) + (tags.some((item) => ['martial', 'battle', 'warpath', 'frontier', 'military'].includes(item)) ? 1 : 0);
  }
  return 0;
}

function factionActionScoreBonus(actionKind, faction) {
  if (!faction) return 0;
  const favor = Number(faction.favor || 0);
  const leverage = Number(faction.leverage || 0);
  const hostility = Number(faction.hostility || 0);

  if (actionKind === 'govern') return Math.round((favor + leverage - hostility * 0.6) / 24);
  if (actionKind === 'trade') return Math.round((favor * 0.6 + leverage * 1.1 - hostility * 0.5) / 22);
  if (actionKind === 'diplomacy') return Math.round((favor + leverage - hostility * 0.4) / 26);
  if (actionKind === 'intrigue') return Math.round((leverage - hostility * 0.3) / 28);
  return 0;
}

function totalBondScore(state, bondKey) {
  return ensureList(state.gameState && state.gameState.relationships)
    .filter((item) => item && item.bondKey === bondKey)
    .reduce((sum, item) => sum + Number(item.trust || 0) + Number(item.affection || 0) + Number(item.loyalty || 0), 0);
}

function applyCivilianMilestones(state) {
  const gs = state.gameState;
  if ((gs.governance || 0) >= 38) {
    addSkill(state, { id: 'civil_admin_pillar', name: '吏治成序', type: '经营', level: '小成', effect: '内政治理已经开始真正转化为根基与影响。' });
  }
  if ((gs.commerce || 0) >= 38) {
    addSkill(state, { id: 'commerce_route_open', name: '商路开盘', type: '经营', level: '小成', effect: '经商不再只是补钱，而是逐渐形成自己的钱粮网络。' });
  }
  if ((gs.strategy || 0) >= 42 || (gs.strategyLevel || 0) >= 24) {
    addSkill(state, { id: 'strategy_board_sense', name: '局盘有眼', type: '谋略', level: '小成', effect: '谋略路线已经成形，调查、交涉和设局会越来越像同一套手法。' });
  }
  if (totalBondScore(state, 'advisor') >= 170) {
    addSkill(state, { id: 'retinue_of_minds', name: '幕下成班', type: '人物', level: '成局', effect: '我已经能把真正懂事的人留在身边，经营与谋略两线因此更稳。' });
  }
  if (totalBondScore(state, 'lover') >= 130) {
    addSkill(state, { id: 'heart_anchor', name: '心有所系', type: '情感', level: '成局', effect: '恋爱线不再只是温度，它会反过来稳住士气、人物与关键选择。' });
  }
}

function resolveGenericAction(state, action) {
  const gs = state.gameState;
  const localFaction = getLocalFaction(state);
  const relationTag = action.kind === 'warpath' ? 'battle' : action.kind === 'jianghu' ? 'martial' : action.kind;
  const relation = action.target
    ? (getRelation(state, action.target) || chooseRelationForAction(state, relationTag, localFaction ? localFaction.id : ''))
    : chooseRelationForAction(state, relationTag, localFaction ? localFaction.id : '');
  const variance = rollVariance();
  const fatigue = Number(gs.fatigue || 0);
  const health = Number(gs.health || 0);
  const recoveryNeed = Math.round(Math.max(0, fatigue - 35) / 10);
  const healthNeed = Math.round(Math.max(0, 70 - health) / 12);
  const baseTable = {
    govern: (gs.governance + gs.strategy + Math.floor(gs.supplies / 2)) / 10,
    trade: (gs.commerce + gs.diplomacy + Math.floor(gs.coins / 4)) / 10,
    diplomacy: (gs.diplomacy + gs.charm + gs.influence) / 10,
    social: (gs.charm + gs.diplomacy + gs.renown) / 10,
    romance: (gs.charm + gs.diplomacy + gs.influence / 2 + gs.renown / 2) / 10,
    martial: (gs.martialLevel + gs.health / 3 + (100 - gs.fatigue) / 4) / 10,
    warpath: (gs.martialLevel + gs.military + gs.morale / 2 + gs.troops / 10 + gs.renown / 2) / 10,
    jianghu: (gs.martialLevel + gs.charm / 2 + gs.renown + gs.influence / 2 + gs.health / 3) / 10,
    military: (gs.military + gs.strategy + gs.morale / 2 + gs.troops / 8) / 10,
    investigate: (gs.strategy + gs.diplomacy + gs.charm / 2) / 10,
    intrigue: (gs.strategy + gs.diplomacy + gs.influence / 2) / 10,
    rest: (health / 5 + recoveryNeed * 6 + healthNeed * 5 + gs.supplies / 4 + gs.morale / 8) / 10,
    sect: (gs.martialLevel + gs.sectFavor + gs.sectPower) / 10,
    unknown: (gs.governance + gs.diplomacy + gs.strategy) / 12
  };

  let score = Math.round(baseTable[action.kind] || baseTable.unknown);
  if (['govern', 'trade', 'diplomacy', 'social', 'romance', 'martial', 'military', 'investigate', 'intrigue', 'rest', 'warpath', 'jianghu', 'sect'].includes(action.kind)) {
    score += 2;
  }
  score += actFocusBonus(state, action.kind);
  score += relationActionScoreBonus(action.kind, relation);
  score += factionActionScoreBonus(action.kind, localFaction);
  score += lineIdentityScoreBonus(state, action.kind);
  score += variance.bonus;

  if (gs.health <= 35 && ['martial', 'warpath', 'jianghu', 'battle', 'military', 'travel'].includes(action.kind)) score -= 2;
  if (gs.fatigue >= 85 && isGeneralFatigueAction(action.kind)) score -= isHighPressureFatigueAction(action.kind) ? 3 : 2;
  else if (gs.fatigue >= 70 && isGeneralFatigueAction(action.kind)) score -= 2;
  else if (gs.fatigue >= 55 && isGeneralFatigueAction(action.kind)) score -= 1;
  if (gs.supplies <= 20 && ['govern', 'warpath', 'military', 'battle', 'travel'].includes(action.kind)) score -= 2;
  if (gs.coins <= 12 && ['trade', 'diplomacy', 'social', 'romance', 'travel'].includes(action.kind)) score -= 1;

  const skillScoreFeedback = applySkillScoreBonus(state, {
    kind: action.kind,
    mode: action.mode || '',
    relation,
    localFaction,
    pressure: state.world.pressure || 0
  });
  score += Number(skillScoreFeedback.bonus || 0);
  score += foodBuffScore(gs, action);

  const tier = tierOf(score);
  return { score, tier, variance, skillScoreFeedback };
}

function progressMainline(state, actionKind, tier) {
  ensureMainline(state.world);
  const act = getCurrentAct(state.world);
  let step = 8;
  if (ensureList(act.focus).includes(actionKind)) step += 12;
  if (tier === 'great') step += 12;
  else if (tier === 'good') step += 6;
  else if (tier === 'fail') step -= 6;

  state.world.mainline.progress = clamp((state.world.mainline.progress || 0) + step, 0, 100);
  if (tier === 'fail') {
    state.world.pressure = clamp((state.world.pressure || 0) + 4, 0, 100);
  } else {
    state.world.pressure = clamp((state.world.pressure || 0) - (tier === 'great' ? 2 : 1), 0, 100);
  }

  if (state.world.mainline.progress >= 100 && state.world.mainline.currentActIndex < state.world.mainline.acts.length - 1) {
    state.world.mainline.currentActIndex += 1;
    state.world.mainline.progress = 18;
  }

  ensureMainline(state.world);
}

function battleTarget(state) {
  return getMostHostileFaction(state) || getLocalFaction(state) || getMostFriendlyFaction(state);
}

function battleScaleLabel(size) {
  const total = Number(size || 0);
  if (total >= 1000000) return '百万人大战';
  if (total >= 100000) return '十万级大战';
  if (total >= 10000) return '万人大战';
  if (total >= 1000) return '千人战';
  if (total >= 100) return '百人战';
  if (total >= 20) return '数十人冲突';
  return '十人小斗';
}

function computeBattleScale(state, target) {
  const gs = state.gameState || {};
  const actIndex = Number(state.world && state.world.mainline && state.world.mainline.currentActIndex) || 0;
  const pressure = Number(state.world && state.world.pressure) || 0;
  const troopPool = Math.max(0, Number(gs.troops || 0));
  const prestige = Number(gs.battlefieldPrestige || 0);
  const renown = Number(gs.renown || 0);
  const martialPower = Number(gs.martialPower || 0);
  const martialScale = martialBattleScaleValue(martialPower);

  const commandReach = Math.round(
    troopPool * 0.48 +
    prestige * 18 +
    renown * 25 +
    actIndex * 800 +
    martialScale +
    12
  );
  const playerCommittedTroops = troopPool > 0
    ? Math.max(10, Math.min(troopPool, commandReach))
    : Math.max(8, Math.min(320, Math.round(Math.sqrt(Math.max(1, martialScale)) * 4.2)));
  const enemyTroops = Math.max(
    10,
    Math.round(
      playerCommittedTroops * (0.92 + pressure / 180) +
      Number((target && target.power) || 0) * 0.35 +
      actIndex * Math.max(40, playerCommittedTroops * 0.08) +
      18
    )
  );
  const scaleValue = Math.max(playerCommittedTroops, enemyTroops);

  return {
    playerCommittedTroops,
    enemyTroops,
    scaleValue,
    scaleLabel: battleScaleLabel(scaleValue)
  };
}

function resolveBattle(state) {
  const gs = state.gameState;
  if ((gs.troops || 0) <= 0 && (gs.martialPower || 0) < 220) {
    const summary = '我手里既没有能真正压上去的部曲，个人武艺也还没到能独撑战场的地步，这一仗根本打不起来。';
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    appendSummary(state, summary);
    appendThread(state, '想要沙场试锋，先解决部曲、军需，或者把个人武艺再练得更硬一些。', 2, '战事');
    return {
      kind: 'battle',
      tier: 'fail',
      variance: { roll: 0, bonus: -3, label: '条件不足' },
      targetFactionName: '未能成战',
      locationHook: '',
      summary,
      delta: {}
    };
  }
  if ((gs.supplies || 0) <= 0 || (gs.morale || 0) <= 0) {
    const summary = '军需或士气已经见底，再强行出手只会先把自己拖垮，这一仗被迫搁下。';
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    appendSummary(state, summary);
    appendThread(state, '大战之前先补军需、稳士气，否则每一次起兵都会在半路散掉。', 3, '战事');
    return {
      kind: 'battle',
      tier: 'fail',
      variance: { roll: 0, bonus: -3, label: '后勤崩缺' },
      targetFactionName: '未能成战',
      locationHook: '',
      summary,
      delta: {}
    };
  }

  const target = battleTarget(state);
  const variance = rollVariance();
  const enemyPressure = target ? Math.round((target.power + target.hostility) / 10) : 10;
  const battleScale = computeBattleScale(state, target);
  const martialStrength = martialBattleStrengthValue(gs.martialPower || 0);
  const playerStrength = Math.round(
    gs.military / 2 +
    gs.strategy / 3 +
    gs.morale / 4 +
    Math.log10(battleScale.playerCommittedTroops + 10) * 9 +
    martialStrength +
    gs.renown / 4 +
    (gs.battlefieldPrestige || 0) / 25 +
    (gs.martialFocusId === 'battlefield' ? 2 : 0) +
    (gs.martialFocusId === 'jianghu' ? (gs.jianghuPrestige || 0) / 45 : 0)
  );
  const enemyStrength = Math.round(
    Math.log10(battleScale.enemyTroops + 10) * 10 +
    enemyPressure +
    (state.world.pressure || 0) / 4 +
    8 +
    (state.world.mainline.currentActIndex || 0) * 2
  );
  let score = playerStrength - enemyStrength + 10 + variance.bonus + actFocusBonus(state, 'battle');

  let troopLoss = 0;
  let supplyCost = 0;
  let delta = { renown: 0, morale: 0, supplies: 0, troops: 0, military: 0, strategy: 0, influence: 0, health: 0, fatigue: 0, battlefieldPrestige: 0, jianghuPrestige: 0 };
  const routeAdjustedBattle = applyMartialRouteBattleModifier(state, score, delta);
  score = routeAdjustedBattle.score;
  const skillScoreFeedback = applySkillScoreBonus(state, {
    kind: 'battle',
    mode: '',
    relation: null,
    localFaction: target,
    pressure: state.world.pressure || 0
  });
  score += Number(skillScoreFeedback.bonus || 0);
  const tier = tierOf(score);

  if (tier === 'great') {
    troopLoss = gs.troops > 0 ? Math.min(gs.troops, Math.max(3, Math.round(battleScale.playerCommittedTroops * 0.02))) : 0;
    supplyCost = Math.max(10, Math.round(battleScale.playerCommittedTroops / 140));
    Object.assign(delta, { renown: 8, morale: 12, supplies: -supplyCost, troops: -troopLoss, military: 2, influence: 4, fatigue: 12 });
  } else if (tier === 'good') {
    troopLoss = gs.troops > 0 ? Math.min(gs.troops, Math.max(6, Math.round(battleScale.playerCommittedTroops * 0.05))) : 0;
    supplyCost = Math.max(12, Math.round(battleScale.playerCommittedTroops / 120));
    Object.assign(delta, { renown: 4, morale: 6, supplies: -supplyCost, troops: -troopLoss, military: 1, influence: 2, fatigue: 14 });
  } else if (tier === 'mixed') {
    troopLoss = gs.troops > 0 ? Math.min(gs.troops, Math.max(12, Math.round(battleScale.playerCommittedTroops * 0.1))) : 0;
    supplyCost = Math.max(16, Math.round(battleScale.playerCommittedTroops / 100));
    Object.assign(delta, { renown: 1, morale: -3, supplies: -supplyCost, troops: -troopLoss, influence: 0, health: -6, fatigue: 18 });
  } else {
    troopLoss = gs.troops > 0 ? Math.min(gs.troops, Math.max(20, Math.round(battleScale.playerCommittedTroops * 0.18))) : 0;
    supplyCost = Math.max(20, Math.round(battleScale.playerCommittedTroops / 82));
    Object.assign(delta, { renown: -2, morale: -10, supplies: -supplyCost, troops: -troopLoss, influence: -2, health: -10, fatigue: 22 });
  }

  if (gs.martialPower >= 1000) delta.renown += 1;
  if (gs.martialPower >= 10000) delta.renown += 2;
  if (gs.martialPower >= 100000) delta.renown += 4;
  delta.battlefieldPrestige += tier === 'great' ? 12 : tier === 'good' ? 8 : tier === 'mixed' ? 4 : 1;
  if (gs.martialFocusId === 'battlefield') delta.battlefieldPrestige += 4;
  if (gs.martialFocusId === 'jianghu' && gs.martialPower >= 100) delta.jianghuPrestige += tier === 'fail' ? 1 : 4;
  const relation = chooseRelationForAction(state, 'battle', target ? target.id : '');
  const battleEncounter = resolveEncounterOutcome(state, {
    action: { kind: 'battle', mode: '', target: target ? target.id : '', targetName: target ? target.name : '' },
    outcome: { tier, summary: '' },
    relation
  });
  delta = mergeDelta(delta, battleEncounter.delta || {});
  const skillDeltaFeedback = applySkillDeltaBonus(state, {
    kind: 'battle',
    mode: '',
    tier,
    relation,
    localFaction: target,
    delta,
    pressure: state.world.pressure || 0
  });
  delta = cloneDelta(skillDeltaFeedback.delta || delta);

  applyStatDelta(gs, delta, { action: { kind: 'battle', mode: '' } });
  applyMartialFocusUnlocks(state);
  advancePathExperience(state, 'battle', tier);
  const breakthroughLine = maybeTriggerMartialBreakthrough(state, 'battle', tier, relation);
  progressMainline(state, 'battle', tier);

  if (target) {
    if (tier === 'great') updateFaction(state, target.id, { hostility: 8, favor: -4, leverage: -2, power: -4 });
    else if (tier === 'good') updateFaction(state, target.id, { hostility: 5, favor: -2, power: -2 });
    else if (tier === 'mixed') updateFaction(state, target.id, { hostility: 3, favor: -1 });
    else updateFaction(state, target.id, { hostility: 8, leverage: 2, favor: -4 });
  }

  if (relation) {
    const previousRelation = { ...relation };
    const patch = buildRelationPatch('battle', tier);
    patch.trust = tier === 'great' ? 8 : tier === 'good' ? 5 : tier === 'mixed' ? 1 : -3;
    patch.loyalty = tier === 'great' ? 6 : tier === 'good' ? 3 : 0;
    patch.rivalry = tier === 'fail' ? 3 : 0;
    patch.status = buildRelationStatus('battle', tier, relation);
    updateRelation(state, relation.id, patch);
    applyRelationMilestone(state, previousRelation, getRelation(state, relation.id));
  }
  const battleArc = advanceEncounterArcs(state, {
    action: { kind: 'battle', mode: '', target: target ? target.id : '', targetName: target ? target.name : '' },
    tier,
    relation: relation ? getRelation(state, relation.id) : null
  });

  const city = findCity(state.world.currentCityId);
  const hook = city ? pickOne(city.eventHooks) : '兵锋又起';
  state.gameState.lastBattleReport = {
    mode: gs.martialPower >= 100000 ? '十万人敌破军' : gs.martialPower >= 10000 ? '万人敌踏阵' : gs.martialPower >= 1000 ? '千人敌破阵' : gs.martialPower >= 100 ? '百人敌试锋' : '阵前试锋',
    scaleLabel: battleScale.scaleLabel,
    playerCommittedTroops: battleScale.playerCommittedTroops,
    enemyTroops: battleScale.enemyTroops,
    playerStrength,
    enemyStrength,
    casualties: troopLoss,
    supplyCost,
    targetFactionName: target ? target.name : '未知对手'
  };
  state.gameState.lastEventTag = hook;
  storeSkillFeedback(state, actionDisplayText({ kind: 'battle', raw: '起兵试锋' }), tier, skillScoreFeedback, skillDeltaFeedback);
  const summary = `我向${target ? target.name : '对手'}压上了一场${battleScale.scaleLabel}，结果为“${tierText(tier)}”。这一回里，${hook}成了真正牵动局面的暗线。`;
  const encounterLine = ensureList(battleEncounter.lines).concat(ensureList(battleArc.lines)).join('');
  const finalSummary = `${summary}${encounterLine}${breakthroughLine || ''}`;
  state.gameState.lastResolutionSummary = finalSummary;
  state.gameState.lastRuleSummary = buildImpactSummary(delta);
  state.gameState.lastDeltaLine = buildDeltaLine(delta);
  appendSummary(state, finalSummary);
  appendThread(state, `战后的余波还在扩散，${target ? target.name : '对手'}不会把这次交锋当作无事发生。`, tier === 'fail' ? 3 : 2, '战事');

  return {
    kind: 'battle',
    tier,
    variance,
    targetFactionName: target ? target.name : '未知对手',
    locationHook: hook,
    summary: finalSummary,
    changeSummary: state.gameState.lastRuleSummary || '',
    deltaLine: state.gameState.lastDeltaLine || '',
    delta: cloneDelta(delta)
  };
}

function activeBattleLocationHook(state) {
  const battle = state.gameState && state.gameState.activeBattle ? state.gameState.activeBattle : null;
  if (!battle) return state.world.currentCityName || '战局未定';
  if (battle.mode === 'duel') return `${battle.targetName || '对手'}的出手路数`;
  return `${battle.targetName || '对手'}的军阵动向`;
}

function resolveBattleStartOutcome(state, mode, options = {}) {
  const gs = state.gameState || {};
  if (mode === 'duel') gs.martialFocusId = 'jianghu';
  else gs.martialFocusId = 'battlefield';
  applyPathSnapshot(gs);

  const outcome = startBattleEncounter(state, mode, options);
  const sparring = mode === 'duel' && options.variant === 'sparring';
  state.gameState.lastEventTag = activeBattleLocationHook(state);
  appendSummary(state, outcome.summary);
  appendThread(
    state,
    mode === 'duel'
      ? sparring
        ? `这一场切磋已经摆开架势。先用几手低风险过招把攻守、真气与绝招节奏摸熟。`
        : `这一场江湖对决已经摆开架势。接下来每一手的气机、步点和绝招都会直接决定高下。`
      : `这场${state.gameState.activeBattle && state.gameState.activeBattle.scaleLabel ? state.gameState.activeBattle.scaleLabel : '战局'}已经真正拉开，阵型、军令与主将动作会一步步把胜负顶出来。`,
    3,
    mode === 'duel' ? '江湖' : '战事'
  );
  return Object.assign({}, outcome, {
    locationHook: state.gameState.lastEventTag || '',
    interactiveOnly: true,
    statusMessage: mode === 'duel'
      ? sparring
        ? '切磋已经摆开，请直接选择攻守、运功、身法或绝招。'
        : '江湖对决已经摆开，请直接选择攻守、运功、身法或绝招。'
      : '沙场战局已经铺开，请直接选择阵型、军令、计策或主将动作。'
  });
}

function resolveBattleCommandOutcome(state, action) {
  const previousBattle = state.gameState.activeBattle;
  const outcome = resolveBattleCommand(state, action.target);
  if (!previousBattle || !previousBattle.active) {
    return outcome;
  }
  const battleEnded = previousBattle && previousBattle.active && !(state.gameState.activeBattle && state.gameState.activeBattle.active);

  if (!battleEnded) {
    state.gameState.lastResolutionSummary = outcome.summary;
    state.gameState.lastRuleSummary = '';
    state.gameState.lastDeltaLine = '';
    state.gameState.lastEventTag = activeBattleLocationHook(state);
    appendSummary(state, outcome.summary);
    return Object.assign({}, outcome, {
      locationHook: state.gameState.lastEventTag || '',
      interactiveOnly: true,
      statusMessage: previousBattle && previousBattle.mode === 'duel'
        ? '这一手已经结算，继续选择下一招。'
        : '这一道军令已经落地，继续下达下一手战场指令。'
    });
  }

  const kind = previousBattle && previousBattle.mode === 'duel' ? 'jianghu' : 'battle';
  const delta = cloneDelta(outcome.delta || {});
  const battleEncounter = resolveEncounterOutcome(state, {
    action: {
      kind,
      mode: previousBattle && previousBattle.variant === 'sparring' ? 'spar' : '',
      target: previousBattle && previousBattle.targetId ? previousBattle.targetId : '',
      targetName: previousBattle && previousBattle.targetName ? previousBattle.targetName : ''
    },
    outcome,
    relation: previousBattle && previousBattle.targetId ? getRelation(state, previousBattle.targetId) : null
  });
  const combinedDelta = mergeDelta(delta, battleEncounter.delta || {});
  const skillDeltaFeedback = applySkillDeltaBonus(state, {
    kind,
    mode: previousBattle && previousBattle.variant === 'sparring' ? 'spar' : '',
    tier: outcome.tier,
    relation: previousBattle && previousBattle.targetId ? getRelation(state, previousBattle.targetId) : null,
    delta: combinedDelta,
    pressure: state.world.pressure || 0
  });
  const combinedWithSkill = cloneDelta(skillDeltaFeedback.delta || combinedDelta);
  const constrainedDelta = constrainMartialDelta(state.gameState, combinedWithSkill);
  const safeDelta = constrainedDelta.delta;
  const composed = composeOutcomeSummary(outcome.summary, safeDelta);
  const bottleneckLine = martialBottleneckSummary(constrainedDelta.blockedBy, constrainedDelta.blockedGain);

  applyStatDelta(state.gameState, safeDelta, {
    action: {
      kind,
      mode: previousBattle && previousBattle.variant === 'sparring' ? 'spar' : ''
    }
  });
  applyMartialFocusUnlocks(state);
  advancePathExperience(state, kind, outcome.tier);
  const breakthroughLine = maybeTriggerMartialBreakthrough(state, kind, outcome.tier, null);
  applyCivilianMilestones(state);
  progressMainline(state, kind === 'jianghu' ? 'martial' : 'battle', outcome.tier);
  const battleArc = advanceEncounterArcs(state, {
    action: {
      kind,
      mode: previousBattle && previousBattle.variant === 'sparring' ? 'spar' : '',
      target: previousBattle && previousBattle.targetId ? previousBattle.targetId : '',
      targetName: previousBattle && previousBattle.targetName ? previousBattle.targetName : ''
    },
    tier: outcome.tier,
    relation: previousBattle && previousBattle.targetId ? getRelation(state, previousBattle.targetId) : null
  });

  const encounterLine = ensureList(battleEncounter.lines).concat(ensureList(battleArc.lines)).join('');
  const finalSummary = `${composed.summary}${bottleneckLine}${encounterLine}${breakthroughLine || ''}`;
  state.gameState.lastResolutionSummary = finalSummary;
  state.gameState.lastRuleSummary = composed.changeSummary || '';
  state.gameState.lastDeltaLine = composed.deltaLine || '';
  state.gameState.lastEventTag = previousBattle && previousBattle.targetName ? previousBattle.targetName : (state.world.currentCityName || '');
  storeSkillFeedback(state, actionDisplayText({
    kind,
    mode: previousBattle && previousBattle.variant === 'sparring' ? 'spar' : '',
    raw: previousBattle && previousBattle.mode === 'duel'
      ? (previousBattle && previousBattle.variant === 'sparring' ? '切磋收束' : '江湖对决')
      : '战场收束'
  }), outcome.tier, null, skillDeltaFeedback);
  appendSummary(state, finalSummary);
  appendThread(
    state,
    kind === 'jianghu'
      ? '这一战之后，江湖上的风评、追逐与仇怨都会跟着我接下来的出手继续发酵。'
      : '这一仗打完之后，敌我双方都不会当作无事发生，战后的余波迟早还会往回卷。',
    outcome.tier === 'fail' ? 3 : 2,
    kind === 'jianghu' ? '江湖' : '战事'
  );

  return {
    kind,
    tier: outcome.tier,
    summary: finalSummary,
    locationHook: state.gameState.lastEventTag || '',
    changeSummary: composed.changeSummary || '',
    deltaLine: composed.deltaLine || '',
    delta: safeDelta
  };
}

function resolveTravel(state, action) {
  const targetCity = findCity(action.target);
  const plan = targetCity ? buildTravelPlan(state.world.currentCityId, targetCity.id) : null;
  if (!plan || !targetCity) {
    const summary = '我没有找准真正能走通的路，这一步没能落下去。';
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    return {
      kind: 'travel',
      tier: 'fail',
      summary,
      locationHook: '',
      delta: {}
    };
  }

  const gs = state.gameState;
  if ((gs.coins || 0) < plan.totalCoinCost || (gs.supplies || 0) < plan.totalSupplyCost) {
    const summary = `从${state.world.currentCityName}去${targetCity.name}这趟路要过${plan.legCount}段、耗${plan.totalCoinCost}钱与${plan.totalSupplyCost}粮，我眼下还撑不起。`;
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    appendSummary(state, summary);
    appendThread(state, `想去${targetCity.name}，先把盘缠与口粮补足，再决定是不是走这条${plan.displayLabel}。`, 2, '行路');
    return {
      kind: 'travel',
      tier: 'fail',
      summary,
      locationHook: '',
      delta: {}
    };
  }

  const travelTier = plan.totalDistance >= 9 || plan.legCount >= 3 ? 'good' : 'mixed';
  const travelDelta = applyStrategyRouteActionModifier(state, 'travel', { tier: travelTier }, {
    coins: -plan.totalCoinCost,
    supplies: -plan.totalSupplyCost,
    fatigue: 8 + plan.totalDistance + Math.max(0, plan.legCount - 1) * 3,
    health: -Math.max(1, Math.floor(plan.totalDistance / 3)),
    strategy: 1
  });
  applyStatDelta(gs, travelDelta, { action });
  advancePathExperience(state, 'travel', travelTier);

  state.world.currentCityId = targetCity.id;
  syncWorldMap(state);
  advanceMonth(state.world, plan.monthsCost);
  progressMainline(state, 'travel', travelTier);

  const discovery = unlockExtraCharactersForTravel(gs.relationships, targetCity.id, 1);
  if (discovery.unlocked.length) {
    gs.relationships = discovery.relationships;
    noteRumorReveal(state);
  }
  const historicalDiscovery = refreshHistoricalRelations(state);
  if (historicalDiscovery.unlocked.length) {
    noteRumorReveal(state);
  }
  const travelEncounter = resolveEncounterOutcome(state, {
    action,
    outcome: { tier: travelTier, summary: '', travelPlan: plan },
    unlockedCharacters: discovery.unlocked.concat(historicalDiscovery.unlocked)
  });
  const travelWithEncounterDelta = mergeDelta(travelDelta, travelEncounter.delta || {});
  if (Object.keys(travelWithEncounterDelta).length !== Object.keys(travelDelta).length || JSON.stringify(travelWithEncounterDelta) !== JSON.stringify(travelDelta)) {
    applyStatDelta(gs, travelEncounter.delta || {}, { action });
  }
  const skillDeltaFeedback = applySkillDeltaBonus(state, {
    kind: 'travel',
    mode: action.mode || '',
    tier: travelTier,
    delta: travelWithEncounterDelta,
    pressure: state.world.pressure || 0
  });
  const skillTravelDelta = cloneDelta(skillDeltaFeedback.totalDelta || {});
  if (Object.keys(skillTravelDelta).length) {
    applyStatDelta(gs, skillTravelDelta, { action });
  }
  const finalTravelDelta = cloneDelta(skillDeltaFeedback.delta || travelWithEncounterDelta);
  const travelArc = advanceEncounterArcs(state, {
    action,
    tier: travelTier,
    relation: null
  });

  const city = findCity(targetCity.id);
  const hook = city ? pickOne(city.eventHooks) : '远路风尘';
  const unlockedNames = discovery.unlocked.concat(historicalDiscovery.unlocked).map((item) => item.name).filter(Boolean);
  const pathLine = plan.stopoverNames.length
    ? `我沿着${plan.displayLabel}这一线辗转而下，途中先后掠过${plan.stopoverNames.join('、')}。`
    : `我沿着${plan.legs[0] && plan.legs[0].routeLabel ? plan.legs[0].routeLabel : '通路'}一路赶去。`;
  const discoveryLine = unlockedNames.length ? `我还在${targetCity.name}听见了${unlockedNames.join('、')}这些名字，城里的人脉与门路也随之往我面前掀开了一角。` : '';
  const encounterLine = ensureList(travelEncounter.lines).concat(ensureList(travelArc.lines)).join('');
  const summary = `我动身去了${targetCity.name}。${pathLine}这趟路一共过了${plan.legCount}段，耗去${plan.totalCoinCost}钱、${plan.totalSupplyCost}粮与整整${plan.monthsCost}个月，盘缠、口粮和气力都被路途磨下去了一截，但新的地界也终于在眼前铺开。${discoveryLine}${encounterLine}`;
  state.gameState.lastResolutionSummary = summary;
  state.gameState.lastRuleSummary = buildImpactSummary(finalTravelDelta);
  state.gameState.lastDeltaLine = buildDeltaLine(finalTravelDelta);
  state.gameState.lastBattleReport = null;
  state.gameState.lastEventTag = hook;
  storeSkillFeedback(state, actionDisplayText(action), travelTier, null, skillDeltaFeedback);
  appendSummary(state, summary);
  appendThread(state, unlockedNames.length ? `${targetCity.name}的人物、势力和门路已经摆在眼前，我也刚从风闻里摸到了${unlockedNames.join('、')}这些名字，接下来怎么落脚，很快就会见真章。` : `${targetCity.name}的人物、势力和门路已经摆在眼前，接下来怎么落脚，很快就会见真章。`, 2, '行路');

  return {
    kind: 'travel',
    tier: travelTier,
    summary,
    locationHook: hook,
    changeSummary: state.gameState.lastRuleSummary || '',
    deltaLine: state.gameState.lastDeltaLine || '',
    travelPlan: {
      cityIds: plan.cityIds.slice(),
      routeIds: plan.routeIds.slice(),
      legCount: plan.legCount,
      monthsCost: plan.monthsCost,
      totalDistance: plan.totalDistance,
      targetCityId: plan.targetCityId,
      targetCityName: plan.targetCityName
    },
    delta: cloneDelta(finalTravelDelta)
  };
}

function resolveCitySiege(state, action) {
  const targetCity = findCity(action.target);
  const sourceCity = findCity(state.world.currentCityId);
  const gs = state.gameState;
  const originState = currentCityState(state);
  const targetState = state.world && state.world.cityStates ? state.world.cityStates[String(action.target || '')] : null;
  const route = targetCity && sourceCity ? buildTravelPlan(sourceCity.id, targetCity.id) : null;

  if (!targetCity || !targetState || !route) {
    const summary = '我没有找到真正能压过去的城池线，这一步攻取没法落下。';
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    return {
      kind: 'military',
      tier: 'fail',
      summary,
      locationHook: '',
      delta: {}
    };
  }

  if (!originState || authorityRank(originState.playerAuthority) < authorityRank('control')) {
    const summary = `我在${sourceCity ? sourceCity.name : '此地'}还没真正坐实掌控，贸然去攻${targetCity.name}只会把后路先打空。`;
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    return {
      kind: 'military',
      tier: 'fail',
      summary,
      locationHook: targetCity.name,
      delta: {}
    };
  }

  const strategicLevel = Math.max(1, Number(targetState.strategicLevel || 1));
  const currentGarrison = Math.max(0, Math.round(Number(targetState.garrison || 0)));
  const requiredTroops = Math.max(260, Math.round(currentGarrison * 0.55 + strategicLevel * 80 + Number(targetState.fortification || 0) * 2.2));
  const requiredSupplies = Math.max(24, Math.round(18 + strategicLevel * 6 + currentGarrison / 170));
  const requiredMorale = 42 + strategicLevel * 4;

  if (Number(gs.troops || 0) < requiredTroops || Number(gs.supplies || 0) < requiredSupplies || Number(gs.morale || 0) < requiredMorale) {
    const summary = `想压向${targetCity.name}，至少得先备出约${requiredTroops}可动部曲、${requiredSupplies}粮秣，并把士气稳到${requiredMorale}上下。以我眼下的兵粮与军心，还不够真正开打攻城战。`;
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    return {
      kind: 'military',
      tier: 'fail',
      summary,
      locationHook: targetCity.name,
      delta: {}
    };
  }

  const committedTroops = Math.min(
    Math.max(0, Math.round(Number(gs.troops || 0))),
    Math.max(
      220,
      Math.round(
        Number(gs.troops || 0) * (0.52 + Number(gs.military || 0) * 0.0025 + Number(gs.strategy || 0) * 0.0018)
      )
    )
  );
  const troopRatio = committedTroops / Math.max(1, currentGarrison);
  const martialEdge = Math.min(16, martialBattleStrengthValue(Number(gs.martialPower || 0)) * 0.8);
  const playerPower = (Number(gs.military || 0) * 2.05)
    + (Number(gs.strategy || 0) * 1.72)
    + (Number(gs.morale || 0) * 1.08)
    + Math.log10(committedTroops + 10) * 28
    + Math.min(22, Number(gs.supplies || 0) * 0.28)
    + Math.min(16, Number(gs.renown || 0) * 0.18)
    + martialEdge
    + (authorityRank(originState.playerAuthority) * 12);
  const defense = (Number(targetState.security || 0) * 1.32)
    + (Number(targetState.fortification || 0) * 1.56)
    + (Number(targetState.order || 0) * 0.84)
    + (Math.log10(currentGarrison + 10) * 33)
    + (strategicLevel * 16);
  const ratioShift = troopRatio >= 1.45 ? 12 : troopRatio >= 1.15 ? 5 : troopRatio >= 0.92 ? 0 : troopRatio >= 0.75 ? -7 : -14;
  const margin = playerPower - defense + ratioShift;
  const tier = margin >= 26 ? 'great' : margin >= 10 ? 'good' : margin >= -4 ? 'mixed' : 'fail';

  const baseTroopLoss = {
    great: Math.max(26, Math.round(committedTroops * 0.08)),
    good: Math.max(42, Math.round(committedTroops * 0.12)),
    mixed: Math.max(64, Math.round(committedTroops * 0.18)),
    fail: Math.max(96, Math.round(committedTroops * 0.26))
  }[tier];
  const baseSupplyCost = {
    great: Math.max(18, Math.round(committedTroops / 58)),
    good: Math.max(24, Math.round(committedTroops / 46)),
    mixed: Math.max(30, Math.round(committedTroops / 38)),
    fail: Math.max(36, Math.round(committedTroops / 30))
  }[tier];
  const baseDelta = {
    great: { troops: -baseTroopLoss, supplies: -baseSupplyCost, morale: 2, renown: 4, influence: 3, military: 2, strategy: 1 },
    good: { troops: -baseTroopLoss, supplies: -baseSupplyCost, morale: -1, renown: 2, influence: 2, military: 2, strategy: 1 },
    mixed: { troops: -baseTroopLoss, supplies: -baseSupplyCost, morale: -5, renown: 0, influence: 1, military: 1 },
    fail: { troops: -baseTroopLoss, supplies: -baseSupplyCost, morale: -10, renown: -2, influence: -1, military: 1, health: -4 }
  }[tier];

  const skillDeltaFeedback = applySkillDeltaBonus(state, {
    kind: 'military',
    mode: action.mode || '',
    tier,
    delta: baseDelta,
    pressure: state.world.pressure || 0
  });
  const safeDelta = cloneDelta(skillDeltaFeedback.delta || baseDelta);
  applyStatDelta(gs, safeDelta, { action: { kind: 'military', mode: action.mode || '' } });
  advancePathExperience(state, 'military', tier);
  progressMainline(state, 'battle', tier);

  targetState.security = clamp(Number(targetState.security || 0) - (tier === 'great' ? 14 : tier === 'good' ? 9 : tier === 'mixed' ? 4 : 0), 0, 100);
  targetState.fortification = clamp(Number(targetState.fortification || 0) - (tier === 'great' ? 16 : tier === 'good' ? 10 : tier === 'mixed' ? 5 : 0), 0, 100);
  targetState.order = clamp(Number(targetState.order || 0) - (tier === 'great' ? 9 : tier === 'good' ? 5 : tier === 'mixed' ? 2 : 0), 0, 100);
  targetState.warWeariness = clamp(Number(targetState.warWeariness || 0) + (tier === 'fail' ? 4 : 8), 0, 100);
  targetState.unrest = clamp(Number(targetState.unrest || 0) + (tier === 'great' ? 12 : tier === 'good' ? 14 : tier === 'mixed' ? 10 : 4), 0, 100);
  const garrisonLoss = tier === 'great'
    ? Math.max(140, Math.round(currentGarrison * 0.18))
    : tier === 'good'
      ? Math.max(90, Math.round(currentGarrison * 0.12))
      : tier === 'mixed'
        ? Math.max(45, Math.round(currentGarrison * 0.07))
        : Math.max(18, Math.round(currentGarrison * 0.03));
  targetState.garrison = Math.max(0, Math.round(currentGarrison - garrisonLoss));

  const footholdGain = tier === 'great' ? 24 : tier === 'good' ? 15 : tier === 'mixed' ? 8 : 0;
  if (footholdGain > 0) {
    targetState.playerAuthorityScore = clamp(Number(targetState.playerAuthorityScore || 0) + footholdGain, 0, 100);
    targetState.playerAuthority = targetState.playerAuthorityScore >= 24 ? 'guest' : 'reside';
    targetState.playerAuthorityLabel = authorityLabel(targetState.playerAuthority);
    targetState.annexationMode = 'siege';
  }

  const controlThreshold = 66 + strategicLevel * 5;
  const stewardThreshold = 46 + strategicLevel * 4;
  const canTakeControl = tier === 'great'
    && Number(targetState.playerAuthorityScore || 0) >= controlThreshold
    && Number(targetState.garrison || 0) <= Math.max(220, strategicLevel * 150);
  const canTakeSteward = !canTakeControl
    && (tier === 'great' || tier === 'good')
    && Number(targetState.playerAuthorityScore || 0) >= stewardThreshold
    && Number(targetState.garrison || 0) <= Math.max(360, strategicLevel * 230);

  let occupationLine = '';
  if (canTakeControl) {
    markCityCaptured(state, targetCity.id, 'control');
    state.world.currentCityId = targetCity.id;
    occupationLine = `我把${targetCity.name}的守备、城门和仓口一并打穿，终于把这座城真正收进了自己的版图。`;
  } else if (canTakeSteward) {
    markCityCaptured(state, targetCity.id, 'steward');
    state.world.currentCityId = targetCity.id;
    occupationLine = `我攻进${targetCity.name}之后先把军务、仓口和几处要害按在手里，眼下已算拿住了这座城的代治权。`;
  } else if (tier === 'great' || tier === 'good' || tier === 'mixed') {
    occupationLine = `我虽然还没能把${targetCity.name}一口吞下，却已经在城下啃出了一层真正的据点、门路和攻城缺口。下次再压过来，就不是白撞城墙了。`;
  } else {
    occupationLine = `我在${targetCity.name}城下吃了硬钉子，只能先把人马收回来，等后手再补。`;
  }

  syncWorldMap(state);
  const changeSummary = buildImpactSummary(safeDelta);
  const deltaLine = buildDeltaLine(safeDelta);
  const routeLine = route.stopoverNames && route.stopoverNames.length
    ? `我沿着${route.displayLabel}压向${targetCity.name}，途中掠过${route.stopoverNames.join('、')}。`
    : `我沿着${route.displayLabel || '近线'}压向${targetCity.name}。`;
  const summary = `${routeLine}${occupationLine}`;

  state.gameState.lastResolutionSummary = changeSummary ? `${summary}${changeSummary}` : summary;
  state.gameState.lastRuleSummary = changeSummary || '';
  state.gameState.lastDeltaLine = deltaLine || '';
  state.gameState.lastBattleReport = {
    mode: '攻城',
    scaleLabel: '城池攻取',
    playerCommittedTroops: committedTroops,
    enemyTroops: Math.max(0, Math.round(Number(targetState.garrison || 0))),
    playerStrength: Math.round(playerPower),
    enemyStrength: Math.round(defense),
    casualties: Math.abs(Number(safeDelta.troops || 0)),
    supplyCost: Math.abs(Number(safeDelta.supplies || 0))
  };
  state.gameState.lastEventTag = targetCity.name;
  storeSkillFeedback(state, actionDisplayText(action), tier, null, skillDeltaFeedback);
  appendSummary(state, state.gameState.lastResolutionSummary);
  appendThread(
    state,
    tier === 'fail'
      ? `${targetCity.name}这块地还没被我啃下来。下次再压过去，得先把兵、粮、军心和攻城前置一起补齐。`
      : `${targetCity.name}已经被我撬开。接下来是继续蚕食守备、坐稳秩序，还是沿近线再往外压，都会直接改写版图。`,
    tier === 'fail' ? 3 : 2,
    '版图'
  );

  return {
    kind: 'military',
    tier,
    summary: state.gameState.lastResolutionSummary,
    locationHook: targetCity.name,
    changeSummary,
    deltaLine,
    delta: safeDelta
  };
}

function resolveJoinSect(state, action) {
  const city = findCity(state.world.currentCityId);
  const citySects = findCitySects(state.world.currentCityId);
  const targetSect = action.target ? findSect(action.target) : null;
  if (targetSect && citySects.length && !citySects.some((item) => item.id === targetSect.id)) {
    const summary = `${city ? city.name : '此地'}眼下并没有${targetSect.name}的门路，我就算想投过去，也得先换个地方。`;
    state.gameState.lastResolutionSummary = summary;
    state.gameState.lastRuleSummary = '';
    state.gameState.lastDeltaLine = '';
    state.gameState.lastBattleReport = null;
    state.gameState.lastEventTag = city ? city.name : '';
    appendSummary(state, summary);
    return {
      kind: 'joinsect',
      tier: 'fail',
      summary,
      locationHook: city ? city.name : '',
      delta: {}
    };
  }
  const sect = targetSect || citySects[0] || null;
  if (!sect) {
    const summary = '我暂时还找不到值得投身的门派门路。';
    state.gameState.lastResolutionSummary = summary;
    clearOutcomeArtifacts(state);
    return {
      kind: 'joinsect',
      tier: 'fail',
      summary,
      locationHook: '',
      delta: {}
    };
  }

  if (state.gameState.sectId === sect.id) {
    const summary = `我本就在${sect.name}门下，这一步更适合去经营门中关系或继续打磨传承。`;
    state.gameState.lastResolutionSummary = summary;
    state.gameState.lastRuleSummary = '';
    state.gameState.lastDeltaLine = '';
    state.gameState.lastBattleReport = null;
    state.gameState.lastEventTag = sect.style;
    appendSummary(state, summary);
    return {
      kind: 'joinsect',
      tier: 'fail',
      summary,
      locationHook: sect.style,
      delta: {}
    };
  }

  if (state.gameState.sectId && state.gameState.sectId !== sect.id) {
    const summary = `我已有${state.gameState.sectName}这层师承，想改换门庭不是一句话就能成的，得先把旧线理干净。`;
    state.gameState.lastResolutionSummary = summary;
    state.gameState.lastRuleSummary = '';
    state.gameState.lastDeltaLine = '';
    state.gameState.lastBattleReport = null;
    state.gameState.lastEventTag = sect.style;
    appendSummary(state, summary);
    appendThread(state, '门派之间的师承、旧谊和恩怨都不是小事。真要改投他门，迟早得先处理清楚旧账。', 2, '门派');
    return {
      kind: 'joinsect',
      tier: 'fail',
      summary,
      locationHook: sect.style,
      delta: {}
    };
  }

  const access = evaluateSectEligibility(state, sect);
  if (!access.eligible) {
    const requirementText = access.unmet.length ? access.unmet.join('，') : access.requirementText;
    const summary = `我去叩${sect.name}的门，却发现火候还没到。${requirementText}`;
    state.gameState.lastResolutionSummary = summary;
    state.gameState.lastRuleSummary = access.requirementText || '';
    state.gameState.lastDeltaLine = '';
    state.gameState.lastBattleReport = null;
    state.gameState.lastEventTag = sect.style;
    appendSummary(state, summary);
    appendThread(state, `${sect.name}的门槛已经摆在眼前。先补足条件，再来敲这扇门，才不会白白耗掉一次露脸的机会。`, 2, '门派');
    return {
      kind: 'joinsect',
      tier: 'fail',
      summary,
      locationHook: sect.style,
      changeSummary: access.requirementText || '',
      deltaLine: '',
      delta: {}
    };
  }

  let sectDelta = Object.assign({
    sectFavor: 8,
    sectPower: 4,
    martialLevel: 2,
    influence: 1,
    renown: 1
  }, cloneDelta(sect.joinDelta || {}));
  const discovery = discoverActionContacts(state, { ...action, kind: 'joinsect' }, 'good');
  if (discovery.unlocked.length) {
    state.gameState.relationships = discovery.relationships;
  }
  const sectEncounter = resolveEncounterOutcome(state, {
    action: { ...action, kind: 'joinsect' },
    outcome: { tier: 'good', summary: '' },
    relation: null,
    sectId: sect.id,
    sectName: sect.name,
    unlockedCharacters: discovery.unlocked
  });
  sectDelta = mergeDelta(sectDelta, sectEncounter.delta || {});
  const skillScoreFeedback = applySkillScoreBonus(state, {
    kind: 'joinsect',
    mode: action.mode || '',
    relation: null,
    localFaction: null,
    pressure: state.world.pressure || 0
  });
  const skillDeltaFeedback = applySkillDeltaBonus(state, {
    kind: 'joinsect',
    mode: action.mode || '',
    tier: 'good',
    relation: null,
    delta: sectDelta,
    pressure: state.world.pressure || 0
  });
  sectDelta = cloneDelta(skillDeltaFeedback.delta || sectDelta);
  const constrainedSect = constrainMartialDelta(state.gameState, sectDelta);
  sectDelta = constrainedSect.delta;
  const bottleneckLine = martialBottleneckSummary(constrainedSect.blockedBy, constrainedSect.blockedGain);
  applyStatDelta(state.gameState, sectDelta, { action: { kind: 'joinsect', mode: action.mode || '' } });
  state.gameState.sectId = sect.id;
  state.gameState.sectName = sect.name;
  state.gameState.sectStyle = sect.style;
  if (sect.martialRouteId) state.gameState.martialRouteId = sect.martialRouteId;
  if (sect.strategyRouteId) state.gameState.strategyRouteId = sect.strategyRouteId;
  addSkill(state, {
    id: `${sect.id}_init_skill`,
    name: `${sect.name}传承`,
    type: '门派',
    level: '入门',
    effect: `${sect.style}路线开始生效，门派经营与习武的成长会更稳。`
  });
  if (sect.uniqueSkill) addSkill(state, sect.uniqueSkill);
  advancePathExperience(state, 'joinsect', 'good');
  const breakthroughLine = maybeTriggerMartialBreakthrough(state, 'joinsect', 'good', null);
  progressMainline(state, 'sect', 'good');
  const sectArc = advanceEncounterArcs(state, {
    action: { ...action, kind: 'joinsect' },
    tier: 'good',
    relation: null
  });
  const summary = `我敲开了${sect.name}的门。门里的人没有立刻把我当自己人，但已经愿意给我一条能继续往里走的阶梯。${sect.summary || ''}${bottleneckLine}`;
  const encounterLine = ensureList(sectEncounter.lines).concat(ensureList(sectArc.lines)).join('');
  const finalSummary = `${summary}${encounterLine}${breakthroughLine || ''}`;
  state.gameState.lastResolutionSummary = finalSummary;
  state.gameState.lastRuleSummary = buildImpactSummary(sectDelta);
  state.gameState.lastDeltaLine = buildDeltaLine(sectDelta);
  state.gameState.lastBattleReport = null;
  state.gameState.lastEventTag = sect.style;
  storeSkillFeedback(state, actionDisplayText({ kind: 'joinsect', targetName: sect.name, raw: `投身${sect.name}` }), 'good', skillScoreFeedback, skillDeltaFeedback);
  appendSummary(state, finalSummary);
  appendThread(state, `${sect.name}的人情与规矩都得慢慢经营，别刚入门就把线断了。`, 2, '门派');

  return {
    kind: 'joinsect',
    tier: 'good',
    summary: finalSummary,
    locationHook: sect.style,
    changeSummary: state.gameState.lastRuleSummary || '',
    deltaLine: state.gameState.lastDeltaLine || '',
    delta: cloneDelta(sectDelta)
  };
}

function resolveRegularOutcome(state, action, preResolved = null) {
  const resolved = preResolved || resolveGenericAction(state, action);
  const gs = state.gameState;
  const localFaction = getLocalFaction(state);
  const relationTag = action.kind === 'warpath' ? 'battle' : action.kind === 'jianghu' ? 'martial' : action.kind;
  const relation = action.target
    ? (getRelation(state, action.target) || chooseRelationForAction(state, relationTag, localFaction ? localFaction.id : ''))
    : chooseRelationForAction(state, relationTag, localFaction ? localFaction.id : '');
  const previousRelation = relation ? { ...relation } : null;
  const configuredOutcome = buildConfiguredActionOutcome(state, action, resolved) || fallbackRegularOutcome(action, resolved);
  let hook = configuredOutcome.hook;
  let delta = cloneDelta(configuredOutcome.delta || {});
  let summaryBase = buildModeSummaryBase(action, resolved, relation, configuredOutcome.summaryBase || `${action.kind}这一回结果是“${tierText(resolved.tier)}”。`);
  const retinueOutcome = resolveRetinueAction(state, action, resolved, relation);
  const retinueFeedback = retinueOutcome && retinueOutcome.retinueFeedback
    ? { ...retinueOutcome.retinueFeedback }
    : null;
  if (retinueOutcome && retinueOutcome.overrideBase) {
    hook = retinueOutcome.hook || hook;
    delta = cloneDelta(retinueOutcome.delta || {});
    summaryBase = retinueOutcome.summaryBase || summaryBase;
  } else {
    const passiveSupport = applyRetinuePassiveBonus(state, action, delta);
    delta = passiveSupport.delta;
    if (passiveSupport.line) summaryBase = `${summaryBase}${passiveSupport.line}`;
    if (retinueOutcome) {
      hook = retinueOutcome.hook || hook;
      delta = mergeDelta(delta, retinueOutcome.delta || {});
      if (retinueOutcome.summaryBase) summaryBase = `${summaryBase}${retinueOutcome.summaryBase}`;
    }
  }
  state.gameState.lastRetinueFeedback = retinueFeedback;
  const discovery = discoverActionContacts(state, action, resolved.tier);
  if (discovery.unlocked.length) {
    gs.relationships = discovery.relationships;
  }
  const enrichedEncounterOutcome = resolveEncounterOutcome(state, {
    action,
    outcome: { tier: resolved.tier, summary: summaryBase },
    relation,
    unlockedCharacters: discovery.unlocked
  });

  if (action.kind === 'govern' && localFaction) {
    updateFaction(state, localFaction.id, { favor: resolved.tier === 'fail' ? -2 : 4, leverage: 1 });
  }

  if (action.kind === 'trade') {
    updateFaction(state, 'river_merchants', { favor: resolved.tier === 'fail' ? -3 : 5, leverage: 3 });
  }

  if (action.kind === 'diplomacy' && localFaction) {
    updateFaction(state, localFaction.id, {
      favor: resolved.tier === 'great' ? 8 : resolved.tier === 'good' ? 4 : resolved.tier === 'mixed' ? 1 : -3,
      hostility: resolved.tier === 'fail' ? 4 : -2
    });
  }

  if (action.kind === 'intrigue' && localFaction) {
    updateFaction(state, localFaction.id, { leverage: resolved.tier === 'fail' ? 0 : 4, hostility: resolved.tier === 'fail' ? 4 : 2 });
  }

  if (action.kind === 'romance' && relation && relation.factionId) {
    updateFaction(state, relation.factionId, {
      favor: resolved.tier === 'great' ? 2 : resolved.tier === 'good' ? 1 : 0,
      hostility: resolved.tier === 'fail' ? 2 : 0
    });
  }

  if (action.kind === 'warpath') {
    gs.martialFocusId = 'battlefield';
    if ((gs.troops || 0) <= 0) {
      delta.troops = (delta.troops || 0) + (resolved.tier === 'fail' ? 4 : 3);
      delta.morale = (delta.morale || 0) + 2;
      delta.renown = (delta.renown || 0) + 1;
    }
  }

  if (action.kind === 'jianghu') {
    gs.martialFocusId = 'jianghu';
    if ((gs.sectId || '') && resolved.tier !== 'fail') {
      delta.sectFavor = (delta.sectFavor || 0) + 2;
    }
    if ((gs.renown || 0) < 5) delta.renown = (delta.renown || 0) + 1;
  }

  if (action.kind === 'martial') {
    if ((gs.martialLevel || 0) + (delta.martialLevel || 0) >= 30) {
      addSkill(state, { id: 'martial_first_gate', name: '发劲入骨', type: '武学', level: '小成', effect: '个人武力开始真正影响战场强度。' });
    }
    if ((gs.martialLevel || 0) + (delta.martialLevel || 0) >= 60) {
      addSkill(state, { id: 'martial_master', name: '临阵破锋', type: '武学', level: '一流', effect: '战斗中额外获得威名与战力加成。' });
    }
  }

  delta = applyRelationBondActionModifier(relation, action.kind, delta, resolved);
  delta = applyRelationModeDelta(state, action, relation, resolved, delta);
  delta = applyFatigueStateModifier(gs, action, resolved, delta);
  delta = applyStrategyRouteActionModifier(state, action.kind, resolved, delta);
  delta = applyLineIdentityActionModifier(state, action.kind, resolved, delta);
  delta = mergeDelta(delta, enrichedEncounterOutcome.delta || {});
  const skillDeltaFeedback = applySkillDeltaBonus(state, {
    kind: action.kind,
    mode: action.mode || '',
    tier: resolved.tier,
    relation,
    localFaction,
    delta,
    pressure: state.world.pressure || 0
  });
  delta = cloneDelta(skillDeltaFeedback.delta || delta);
  const constrainedDelta = constrainMartialDelta(gs, delta);
  delta = constrainedDelta.delta;
  const composed = composeOutcomeSummary(summaryBase, delta);
  const bottleneckLine = martialBottleneckSummary(constrainedDelta.blockedBy, constrainedDelta.blockedGain);
  const summary = `${composed.summary}${bottleneckLine}`;
  applyStatDelta(gs, delta, { action });
  applyMartialFocusUnlocks(state);
  advancePathExperience(state, action.kind, resolved.tier);
  const breakthroughLine = maybeTriggerMartialBreakthrough(state, action.kind, resolved.tier, relation);
  applyCivilianMilestones(state);
  progressMainline(state, action.kind === 'warpath' ? 'battle' : action.kind === 'jianghu' ? 'martial' : action.kind, resolved.tier);

  let nextRelation = relation ? getRelation(state, relation.id) : null;

  if (relation) {
    updateRelation(state, relation.id, Object.assign(
      buildRelationPatch(action.kind, resolved.tier, action.mode || '', relation),
      { status: buildRelationStatus(action.kind, resolved.tier, relation, action.mode || '') }
    ));
    markRelationRecruitJourney(state, relation.id, action, resolved.tier);
    if (action.kind === 'social' && action.mode === 'recruit_probe') {
      markRelationRecruitProbe(state, relation.id, resolved.tier);
    }
    if (action.kind === 'investigate' && action.mode === 'historical_lead') {
      markRelationRecruitProbe(state, relation.id, resolved.tier);
    }
    nextRelation = getRelation(state, relation.id);
    applyRelationMilestone(state, previousRelation, nextRelation);
  }
  const encounterArc = advanceEncounterArcs(state, {
    action,
    tier: resolved.tier,
    relation: nextRelation
  });

  if (action.kind === 'govern') appendThread(state, `${state.world.currentCityName}的粮、税和根基还得慢慢压实，站稳这里之后，后面的路才会真的好走。`, resolved.tier === 'fail' ? 3 : 2, '内政', { opportunityKey: `govern:${state.world.currentCityId || state.world.currentCityName}`, rivalName: '城中豪强' });
  if (action.kind === 'trade') appendThread(state, '商路一旦真正走顺，跟着来的不只是钱粮，还有更多人愿意把筹码往我这里放。', 2, '商路', { opportunityKey: 'trade:route', rivalName: '别家商路' });
  if (action.kind === 'social') appendThread(state, '我身边的人情网已经有了回声，继续走近谁、疏远谁，都会很快反映到后面的局势里。', 2, '人物', { opportunityKey: 'social:network', rivalName: '别家门客' });
  if (action.kind === 'romance') appendThread(state, '有些关系已经不只是普通往来。再往前一步，可能是助力、牵挂，也可能是新的软肋。', resolved.tier === 'fail' ? 2 : 1, '情感', { opportunityKey: 'romance:bond', rivalName: '旁人闲话' });
  if (action.kind === 'martial') appendThread(state, '我的武艺已经开始影响别人看我的方式，接下来是继续苦练，还是拿它去换名声和局面，都很快会见分晓。', 1, '武学', { opportunityKey: 'martial:focus', rivalName: '更强的对手' });
  if (action.kind === 'warpath') appendThread(state, '军旅线已经打开口子，接下来是继续滚战功、部曲和阵前威名，还是转去江湖，都会改变我这一身武艺的终点。', 2, '军旅', { opportunityKey: 'warpath:career', rivalName: '别营军功' });
  if (action.kind === 'jianghu') appendThread(state, '江湖线已经起势，接下来是继续问剑群雄，还是回头借战阵做大声势，会把我的武名推向完全不同的地方。', 2, '江湖', { opportunityKey: 'jianghu:fame', rivalName: '别家成名客' });
  if (action.kind === 'sect' && /^outer_/.test(String(action.mode || ''))) {
    appendThread(state, `${action.targetName || '别家山门'}这层外缘已经搭上。接下来是继续借观、借人情，还是转回自己门中消化这一手，都能再生变数。`, 2, '门派');
  } else if (action.kind === 'sect' || action.kind === 'joinsect') {
    appendThread(state, `${gs.sectName}内部的人情和资源并不会自己向我倾斜，还得继续磨。`, 2, '门派');
  }
  if (action.kind === 'investigate' || action.kind === 'intrigue') appendThread(state, '暗线已经动起来了，不顺着追下去，迟早会被别人的布子盖过去。', 2, '谋略', { opportunityKey: 'scheme:active', rivalName: '另一手暗线' });
  if (action.kind === 'social' && action.mode === 'recruit_probe') appendThread(state, '有人已经开始认真听我谈招揽与后路。接下来是继续把话做热，还是正式延揽入队，很快就会见分晓。', 2, '编制', { opportunityKey: `retinue:probe:${action.target || 'any'}`, rivalName: '别家幕府' });
  if (action.kind === 'social' && action.mode === 'recruit') appendThread(state, '幕下开始真正聚人了。接下来谁入队、谁任事，会逐步把我的局从单人局变成班底局。', 2, '编制', { opportunityKey: `retinue:recruit:${action.target || 'any'}`, rivalName: '别家幕府' });
  if (/^appoint_/.test(String(action.mode || ''))) appendThread(state, '职司一旦落定，队伍就不再只是认识几个人，而是开始有了真正能分担事务的骨架。', 2, '编制', { opportunityKey: `retinue:appoint:${action.mode}`, rivalName: '旁人揣测' });
  if (/^team_/.test(String(action.mode || ''))) appendThread(state, '队伍协同已经开始成形。以后很多经营、谋略、江湖和军旅动作，都会更像是在调度班底，而不是单人硬扛。', 2, '编制', { opportunityKey: `retinue:team:${action.mode}`, rivalName: '别家班底' });

  const encounterLine = ensureList(enrichedEncounterOutcome.lines).concat(ensureList(encounterArc.lines)).join('');
  const finalSummary = `${summary}${encounterLine}${breakthroughLine || ''}`;
  const foundFood = maybeGrantFoodFind(state, action, resolved);
  const foodLine = foundFood
    ? `忙完这一手之后，我顺手得了${foundFood.name}。${foundFood.flavorText}${foundFood.soulLine ? `“${foundFood.soulLine}”` : ''}`
    : '';
  const finalNarration = `${finalSummary}${foodLine}`;
  state.gameState.lastResolutionSummary = finalNarration;
  state.gameState.lastRuleSummary = composed.changeSummary || '';
  state.gameState.lastDeltaLine = composed.deltaLine || '';
  state.gameState.lastBattleReport = null;
  state.gameState.lastEventTag = hook;
  storeSkillFeedback(state, actionDisplayText(action), resolved.tier, resolved.skillScoreFeedback || null, skillDeltaFeedback);
  appendSummary(state, finalNarration);

  return {
    kind: action.kind,
    tier: resolved.tier,
    variance: resolved.variance,
    locationHook: hook,
    summary: finalNarration,
    retinueFeedback,
    relationLine: buildLeadRelationLine(nextRelation, action.kind, resolved.tier, state.world.turn, action.mode || ''),
    changeSummary: composed.changeSummary || '',
    deltaLine: composed.deltaLine || '',
    delta: cloneDelta(delta)
  };
}

function buildAdvisory(state) {
  const gs = state.gameState;
  if (state.world.phase === 'ended') {
    state.gameState.advisory = ['此局已经收束。若想试另一条路，可以直接重开此卷。'];
    return;
  }
  if (gs.activeBattle && gs.activeBattle.active) {
    if (gs.activeBattle.mode === 'duel') {
      state.gameState.advisory = [
        '江湖对决中，真气和血线比平时更重要。',
        '若对手提气过多，下一手多半会抢绝招。'
      ];
      return;
    }
    state.gameState.advisory = [
      '沙场中，士气和兵势会一起决定还能不能继续压阵。',
      '方圆克锋矢，雁行克方圆，锋矢克游击。'
    ];
    return;
  }
  const items = [];
  if (gs.supplies <= 20) items.push('军需吃紧，再拖会影响远行、练兵与战斗。');
  if (gs.coins <= 15) items.push('盘缠偏少，交游和转移会被卡住。');
  if (gs.fatigue >= 70) items.push('疲惫过高，再硬撑很容易连续失手。');
  if (gs.morale <= 35) items.push('士气偏低，军务和征战都会明显变钝。');
  if ((gs.martialLevel || 0) < 25) items.push('个人武艺还没真正成形，目前更适合继续打磨根底。');
  if (gs.martialBottleneckName) items.push(`武学卡在“${gs.martialBottleneckName}”，单靠苦练很难再硬顶上去。`);
  if (!gs.sectId) items.push('尚未归入门派，武学成长会更慢。');
  if ((gs.strategyLevel || 0) < 12) items.push('经营与谋略路线还没完全成形，目前仍在攒底子。');
  if ((gs.martialFocusId || 'unbound') === 'unbound') items.push('武学志向还没定死，接下来可以压向军旅，也可以压向江湖。');
  if (state.world && state.world.territory) {
    if (Number(state.world.territory.governedCount || 0) <= 0) {
      items.push('眼下还没真正拿到任何城池的治权，史实人物多半只能先结识，谈不上正式纳入。');
    }
    if (Number(state.world.territory.fieldTroops || 0) > Number(state.world.territory.supportCap || 0)) {
      items.push('野战部曲已经压过当前地盘供养上限，再硬养下去会先从军需、逃散和地方秩序上吃亏。');
    }
    if (Number(state.world.territory.totalLevyReserve || 0) <= 16 && Number(gs.troops || 0) <= 120) {
      items.push('眼下名下可调兵源偏薄，真要扩军，得先养城池人口、秩序与兵源，而不是只堆几次军务。');
    }
    const currentAuthority = String(state.world.territory.currentAuthority || '');
    const hasHistoricalLead = ensureList(gs.relationships).some((relation) => {
      if (!relation || relation.isHistorical !== true) return false;
      const visibilityState = String(relation.visibilityState || '').trim().toLowerCase();
      if (!['rumor', 'met'].includes(visibilityState)) return false;
      const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
        ? relation.historicalPresence
        : null;
      return !!(presence && presence.active);
    });
    if (hasHistoricalLead && !['steward', 'control'].includes(currentAuthority)) {
      items.push('本城已经有史实人物线索浮出水面，但还没拿到代治级权柄；先把城中治权争下来，再谈正式延揽。');
    }
    if (Array.isArray(state.world.territory.warningCityIds) && state.world.territory.warningCityIds.length) {
      items.push('名下已有城池出现秩序或治安隐患，继续拖着会直接影响收益与招募稳定度。');
    }
  }
  state.gameState.advisory = items.slice(0, 4);
}

function buildLeadText(state, outcome) {
  const city = state.world.currentCityName || '无名城池';
  const date = state.world.dateLabel || '';
  const opening = [
    `${date}，${city}。`,
    `风从${state.world.currentRegion || '乱世'}吹过来，屋檐下的尘土都是轻的。`,
    `${outcome.summary}`
  ];
  return opening.join('');
}

function relationPersonaConstraintLine(item) {
  if (!item) return '';
  const values = ensureList(item.values).slice(0, 4).join('、');
  const dislikes = ensureList(item.dislikes).slice(0, 4).join('、');
  const promptFocus = normalizeNarrativeSnippet(item.promptFocus, '');
  if (item.isHistorical) {
    return [
      `${item.name}(史实人物)`,
      item.personaAnchor ? `底色：${normalizeNarrativeSnippet(item.personaAnchor, '')}` : '',
      item.speechStyle ? `说话：${normalizeNarrativeSnippet(item.speechStyle, '')}` : '',
      item.conductStyle ? `行事：${normalizeNarrativeSnippet(item.conductStyle, '')}` : '',
      values ? `重视：${values}` : '',
      dislikes ? `厌恶：${dislikes}` : '',
      promptFocus ? `本回保持：${promptFocus}` : ''
    ].filter(Boolean).join('；');
  }
  if (item.isExtraCharacter) {
    return [
      `${item.name}(追加人物)`,
      item.genderLabel ? `性别：${normalizeNarrativeSnippet(item.genderLabel, '')}` : '',
      item.personaAnchor ? `性格设定：${normalizeNarrativeSnippet(item.personaAnchor, '')}` : '',
      item.personality ? `人物小传：${normalizeNarrativeSnippet(item.personality, '')}` : '',
      item.martialProfile ? `武学设定：${normalizeNarrativeSnippet(item.martialProfile, '')}` : '',
      promptFocus ? `本回保持：${promptFocus}` : '本回保持：严格沿用其既有性格、武学、性别和关系温度，不得突然改口；作为江湖人物，不会自行卷入军旅或朝堂。'
    ].filter(Boolean).join('；');
  }
  return [
    `${item.name}(随机角色)`,
    item.personaAnchor ? `底色：${normalizeNarrativeSnippet(item.personaAnchor, '')}` : '',
    item.speechStyle ? `说话：${normalizeNarrativeSnippet(item.speechStyle, '')}` : '',
    item.conductStyle ? `行事：${normalizeNarrativeSnippet(item.conductStyle, '')}` : '',
    values ? `重视：${values}` : '',
    dislikes ? `厌恶：${dislikes}` : '',
    promptFocus ? `本回保持：${promptFocus}` : ''
  ].filter(Boolean).join('；');
}

function collectPromptRelations(state, action, outcome) {
  const activeBattle = state && state.gameState ? state.gameState.activeBattle : null;
  const corpus = [
    action && action.raw,
    actionDisplayText(action || {}),
    action && action.targetName,
    outcome && outcome.summary,
    outcome && outcome.relationLine,
    state && state.gameState && state.gameState.lastResolutionSummary,
    state && state.scene && state.scene.text,
    state && state.scene && state.scene.title,
    state && state.gameState && state.gameState.lastEventTag,
    activeBattle && activeBattle.targetName
  ].filter(Boolean).join('\n');

  return ensureList(state.gameState && state.gameState.relationships)
    .filter((item) => isRelationVisible(item))
    .map((item) => {
      let score = 0;
      const aliasHit = findRelationAliasHit(item, corpus);
      if (action && action.target && action.target === item.id) score += 120;
      if (action && action.targetName && action.targetName === item.name) score += 100;
      if (activeBattle && activeBattle.targetName && activeBattle.targetName === item.name) score += 95;
      if (aliasHit) score += aliasHit.weight;
      if (corpus && item.title && corpus.includes(item.title) && !(aliasHit && aliasHit.alias === item.title)) score += item.isHistorical ? 26 : 12;
      if (item.isHistorical) score += 5;
      score += Math.min(30, Math.round(((Number(item.trust || 0) + Number(item.affection || 0) + Number(item.loyalty || 0)) / 3)));
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.item);
}

function buildPrompt(state, action, outcome) {
  ensureEncounterState(state);
  const previousNarrationMode = normalizeNarrativeSnippet(state.scene && state.scene.mode, '');
  const previousNarrationReason = normalizeNarrativeSnippet(state.scene && state.scene.narrationReason, '');
  const isEnding = state.world.phase === 'ended';
  const activeBattle = state.gameState.activeBattle || null;
  const battleModeLabel = activeBattle && activeBattle.active
    ? (
      activeBattle.mode === 'duel'
        ? (activeBattle.variant === 'sparring' ? '江湖切磋' : '江湖对决')
        : '沙场征战'
    )
    : (
      action.kind === 'spar'
        ? '江湖切磋'
        : (['battle', 'continuebattle'].includes(action.kind) ? '沙场征战' : '')
    );
  const activeBattleSummary = activeBattle && activeBattle.active
    ? `当前战斗：${battleModeLabel}，第${activeBattle.round}回合，对手是${activeBattle.targetName || '未知对手'}。`
    : '';
  const activeBattleDetail = activeBattle && activeBattle.active
    ? (
      activeBattle.mode === 'duel'
        ? `我方气血${activeBattle.player.hp} / 真气${activeBattle.player.qi}；对手气血${activeBattle.enemy.hp} / 真气${activeBattle.enemy.qi}。`
        : `我方兵势${activeBattle.player.force} / 士气${activeBattle.player.morale}；对手兵势${activeBattle.enemy.force} / 士气${activeBattle.enemy.morale}。`
    )
    : '';
  const activeBattleLog = activeBattle && activeBattle.active
    ? ensureList(activeBattle.log).slice(-3).map((item) => item.summary).join('；')
    : '';
  const battleRelated = !!(activeBattle && activeBattle.active)
    || ['battle', 'continuebattle', 'spar'].includes(action.kind)
    || (state.gameState.lastBattleReport && ['martial', 'military'].includes(action.kind));
  const battleStyleLine = battleRelated
    ? `战斗文风约束：本回按“${battleModeLabel || '战斗场面'}”处理，战斗总结与收束段请取金庸式笔法，写出招式、身法、气机、兵势与胜负余韵，但不要照搬现成名句。`
    : '';
  const bundle = buildPromptStateBundle(state, action, outcome, 'narration');

  const lines = [
    '直接输出本回正文，不要解释任务，不要复述规则，不要输出思维链、JSON、标题或系统说明。',
    `第一人称叙事；主角姓名“${state.gameState.name || '无名之人'}”只可出现在他人称呼、文书或旁人口中，不可当作旁白主语。`,
    `时地固定在${state.world.dateLabel || '建安年间'}、${state.world.currentCityName || '此地'}与其周边局势。`,
    '不要出现后世书名、后见之明评语、现代聊天口吻、属性播报或数值结算句。',
    `回合性质：${isEnding ? '终局收束' : '常规推进'}`,
    `回合约束：${isEnding ? '终局既定，不得反转结局裁定。写出归宿、余波与收束。' : outcomeConstraintText(outcome)}`,
    '把这一手已经发生的经过、阻力、代价、得失与局势回声写出来，不能只报结论。',
    '读取状态包中的 `styleProfile.shared` 与 `styleProfile.narration`，直接写正文，不要先分析再作答。',
    previousNarrationMode === 'fallback'
      ? `续写衔接：上一回正文由本地兜底接住，原因标记为${previousNarrationReason || 'fallback'}。必须把上一回已经显示给玩家的内容视为真实既成事实，在这一回自然顺接推进，不得解释系统、模型、兜底、网络、注解或任何元信息。`
      : '续写衔接：把上一回已经显示给玩家的正文视为真实既成事实，直接顺着人物、局势与余波往下写，不解释生成过程。',
    '结构化状态包(JSON)：',
    stringifyPromptStateBundle(bundle)
  ];

  if (battleStyleLine) lines.push(battleStyleLine);
  lines.push(isEnding ? `终局裁定：${state.gameState.endingTitle || '此局已尽'}。${state.gameState.endingSummary || ''}` : '只续写这一手带来的新变化，不要大段回顾旧设定。');

  return lines.join('\n');
}

function buildFallbackText(state, action, outcome) {
  const historicalBundle = buildHistoricalNarrativeBundle(state);
  if (state.world.phase === 'ended') {
    return [
      `${state.world.dateLabel}，${state.world.currentCityName}。`,
      `${state.gameState.endingTitle || '此局已尽'}。${state.gameState.endingSummary || ''}`,
      `我这一局留下的余波不会立刻散掉。人物、势力、门派和旧账都会带着我的痕迹继续往后流，只是这卷故事到这里该先收住了。`
    ].join('');
  }
  const city = findCity(state.world.currentCityId);
  const cityName = city ? city.name : state.world.currentCityName;
  const hook = normalizeNarrativeSnippet(outcome.locationHook || (city ? pickOne(city.eventHooks) : '旧风又起'), '旧风又起');
  const ruleSummary = outcome.changeSummary || state.gameState.lastRuleSummary || '';
  const appendedRuleSummary = ruleSummary && !String(outcome.summary || '').includes(ruleSummary) ? ruleSummary : '';
  const relationLine = normalizeNarrativeSnippet(outcome.relationLine || '', '');
  const historyLine = normalizeNarrativeSnippet(historicalBundle.lastEventText, '');
  const openingMap = {
    govern: '府廨里的灯火还没有灭，案上的竹简、封泥和算盘都带着白日里压下来的热气。',
    trade: '市廛虽已收摊，牙人与脚夫留下的脚印还压在街泥里，连风都带着钱粮流转的味道。',
    diplomacy: '宾舍与府门之间的人声刚散，几句没说透的话还留在风里打转。',
    social: '檐下的灯影轻轻晃着，席间散去的人情余温还挂在门前。',
    romance: '回廊深处的灯火还亮着，衣香、晚风和没说尽的话一起停在帘下。',
    martial: '演武场的土腥与汗气没有散尽，木桩上的新痕还在夜里发白。',
    military: '校场边的号角才歇，枪杆与皮甲挤出来的汗味仍压在夜风里。',
    battle: '营垒外的更鼓一下一下敲着，甲叶、泥水和血腥气还没有彻底沉下去。',
    investigate: '坊巷里的低语还在暗处游走，几盏故意留着的灯把影子拉得很长。',
    intrigue: '更鼓声里夹着压低的耳语，几处门缝后的灯还故意亮着，像是在等谁先露口风。',
    rest: '夜里终于安静了一些，药气、热水和松下来的筋骨把这一回的疲态慢慢拢住。',
    warpath: '营中火盆烧得正旺，军吏、老卒和新附部曲都在悄悄看这一手会把我推到哪里。',
    jianghu: '渡口和客舍的杂声渐歇，刀鞘、酒气和江风混在一处，还没有完全散开。',
    sect: '山门暮鼓刚过，石阶上的潮气、松脂和香火味仍缠在夜风里。',
    travel: '城门外查验路引的差役还未散去，驿卒牵着瘦马从门洞旁经过，泥点甩在靴面上。',
    joinsect: '山门前的风带着松脂与香灰，守门弟子的目光比夜色还稳。'
  };
  const tierLeadMap = {
    fail: '事情没照我想的走，眼前的人和路却都露了几分真相。',
    mixed: '事情只成了一半，剩下的阻力也跟着露了出来。',
    good: '这一步总算站稳，眼前能走的门路多了一条。',
    great: '这一步压得准，对面原本不肯松口的人也不得不让出一点余地。'
  };
  const opening = openingMap[action.kind] || `夜色落在${cityName}的街巷与屋脊之间，风里还带着${hook}留下的余味。`;
  const tierLead = tierLeadMap[outcome.tier] || tierLeadMap.mixed;
  const actionText = actionDisplayText(action);
  const processMap = {
    govern: `我没有急着拍案，只先把${actionText}压到案头，一条条问人、一笔笔核账。吏员起初还想拿旧例搪塞，听到后面，声音便低了下去。`,
    trade: `我顺着市廛留下的账脚往下查，先问脚夫，再问牙人，最后才让掌柜把藏着的那一页摊出来。钱粮的路子不肯直来，我便绕着它走。`,
    diplomacy: `我把话说得不满，只留三分余地给对面猜。席上杯盏轻响了几次，谁也没有先把底牌翻净。`,
    social: `我没有把话递得太直，只借一盏酒、一句旧闻，试了试席间人心的冷热。有人装作没听见，有人却把目光挪了过来。`,
    romance: `帘外风声轻得很，我却不敢把话说满。那一点进退之间的分寸，比刀剑相交还难拿。`,
    martial: `我照着心中那点不服气再试一遍，脚下泥土被踏得发紧，掌心热意一路顶到指节。到第三次换气时，旧路终于裂开一线。`,
    military: `我让老卒先走一遍阵脚，再让新附部曲跟上。枪杆参差，号令也不齐，可几轮下来，营中那股散气总算被拢住了些。`,
    battle: `我没有给对面喘息的空当，先借阵脚压住来势，再从最乱的一处切进去。甲叶相撞的声音贴着耳边滚过，胜负就在一口气里摇晃。`,
    investigate: `我没有顺着明面上的话走，而是绕去灯照不到的地方问。卖浆的、守门的、递帖的，各自只肯吐半句，拼起来却正好露出一条缝。`,
    intrigue: `我把明话留在门外，只让暗线去碰暗线。更鼓过后，有人灭灯，有人换路，也有人终于忍不住露了口风。`,
    rest: `我把热水、药气和一口慢下来的呼吸都按住，让绷了许久的筋骨一点点松开。不是退，是为了下一步还能站稳。`,
    warpath: `我沿着营火走了一圈，听老卒报怨，也听新兵吞声。军心不是喊出来的，得让他们看见我这一手到底压在哪里。`,
    jianghu: `我没有一头撞进风声里，只先在客舍、渡口和酒肆之间绕了一圈。刀鞘碰桌的轻响、旁人忽然收住的话头，都比明信更有用。`,
    sect: `我在山门石阶前站了片刻，等守门弟子的目光先落下来。门规、人情、旧怨都在那一眼里，不是递一句话便能过关。`,
    travel: `我先把路引递给城门差役，又在茶棚里向驿卒买了一碗浑茶。有人提到官署新贴的榜文，有人压低声音说起刚入城的名士，话没说全，店家便拿抹布敲了敲桌沿，示意我别问得太直。`,
    joinsect: `山门里的钟声压得人心发沉。我没有急着显本事，只先按规矩递话、行礼，等对方看清我不是一阵路过的风。`
  };
  const processLine = processMap[action.kind] || `我顺着${hook}留下的痕迹往前压了半步，没有急着求成，只看这局面会先在哪一处露出破绽。`;
  const consequenceLine = appendedRuleSummary
    ? normalizeNarrativeSnippet(appendedRuleSummary, '')
    : '人情、气力和局面都跟着挪了位置，只是轻重还得等下一阵风吹过来才看得真切。';
  const historyNarration = historyLine
    ? `更大的史势并没有离远，${historyLine}`
    : '眼下没有哪桩大事当场翻到我面前，只有门房递来的眼色、街口停住的话头和客舍里忽然压低的声音，提醒我这里并不清净。';
  const closeMap = {
    social: `我把这一点新撬开的缝隙先按在心里，记住${hook}留给我的分寸，转身往灯影更深处走。`,
    romance: `我把袖口拢紧，借着回廊尽头那点未灭的灯火往前走，准备看清这段情分还能不能再逼近一步。`,
    martial: '我收住呼吸，把掌心那点余热压回骨节里，照着今夜刚摸到的门路继续往下打磨。',
    battle: '我踩着还没凉透的泥与血往营里回去，把这一仗留下的轻重都一笔笔记进心里。',
    investigate: '我把听来的话重新捋过一遍，顺着最不对劲的那根线头继续往暗处摸去。',
    intrigue: '我不再多留，只把今夜露出来的口风逐一记下，准备换个角度再把这局撬开。',
    govern: '我把案上的竹简重新拢齐，压着心里那点起伏继续把眼前能稳住的根基一寸寸按实。',
    warpath: '我把这口气压回胸腔，沿着军中还没散尽的火光往前走，准备把这条路再探深一层。',
    jianghu: '我按住刀鞘边沿，记下今夜人群里每一道看过来的目光，转身继续往江湖更深处去。',
    sect: `我在${state.gameState.sectName || '山门'}门前停了片刻，随后顺着石阶继续往里走，准备把这层关系再磨实一些。`,
    joinsect: `我看着${state.gameState.sectName || '山门'}里外的灯火与人影，把这条刚打开的门路牢牢记下，抬脚往前。`,
    travel: '我把路引收回怀里，只把榜文和茶棚里的几句传闻暂且记下。真要接上哪条人物线，还得先找到递话的人，不能凭一个名字就当作相识。',
    rest: '我把呼吸放慢，让今夜好不容易按下去的疲态再沉一沉，免得下一手一抬就散。'
  };
  const closeLine = closeMap[action.kind] || `我把${hook}里露出的那点异样记下，先退半步，等下一次开口能问得更准。`;
  return [
    `${state.world.dateLabel}，${cityName}。${opening}`,
    processLine,
    `${tierLead}${outcome.summary}${relationLine ? relationLine : ''}`,
    consequenceLine,
    historyNarration,
    `更鼓敲过以后，客舍门前还剩两盏灯。有人从街角快步过去，袖中像藏着文书；守夜的老卒看了我一眼，又把目光移开。${closeLine}`
  ].join('');
}

function buildDirectorFixedChoiceDigest(state) {
  return ensureList(state && state.choices)
    .filter((item) => item && item.source !== 'dynamic')
    .slice(0, 8)
    .map((item) => ({
      id: String(item.id || '').trim(),
      text: String(item.text || '').trim(),
      kind: String(item.kind || item.actionKind || '').trim(),
      category: String(item.category || '').trim()
    }))
    .filter((item) => item.text);
}

function buildDirectorTurnPacket(state, action, outcome, sceneTitle) {
  const consequenceLedger = state && state.gameState ? state.gameState.lastConsequenceLedger : null;
  const planning = require('./chronicleV5DynamicPlanning').buildDynamicPlanningBundle(state, action || {}, { frontierLimit: 8 });
  return {
    version: 'director_turn_v1',
    sceneTitle: String(sceneTitle || '').trim(),
    action: {
      kind: String(action && action.kind || '').trim(),
      mode: String(action && action.mode || '').trim(),
      raw: String(action && (action.raw || action.actionText || action.text || action.kind) || '').trim(),
      target: String(action && action.target || '').trim(),
      targetName: String(action && action.targetName || '').trim()
    },
    adjudication: {
      tier: String(outcome && outcome.tier || '').trim(),
      summary: String(outcome && outcome.summary || '').trim(),
      changeSummary: String(outcome && outcome.changeSummary || '').trim(),
      deltaLine: String(outcome && outcome.deltaLine || '').trim(),
      delta: cloneDelta(outcome && outcome.delta || {}),
      endingTitle: String(outcome && outcome.ending && outcome.ending.title || state && state.gameState && state.gameState.endingTitle || '').trim(),
      endingSummary: String(outcome && outcome.ending && outcome.ending.summary || state && state.gameState && state.gameState.endingSummary || '').trim()
    },
    narrationContext: buildNarrationContext(state, action, outcome, consequenceLedger),
    choiceContext: buildChoiceContext(state, action, outcome, consequenceLedger, planning)
  };
}

function buildDirectorFallbackPacket(state, action, outcome, sceneTitle, fallbackText) {
  return {
    version: 'director_fallback_v1',
    sceneTitle: String(sceneTitle || '').trim(),
    action: {
      kind: String(action && action.kind || '').trim(),
      mode: String(action && action.mode || '').trim(),
      raw: String(action && (action.raw || action.actionText || action.text || action.kind) || '').trim()
    },
    adjudication: {
      tier: String(outcome && outcome.tier || '').trim(),
      summary: String(outcome && outcome.summary || '').trim(),
      changeSummary: String(outcome && outcome.changeSummary || '').trim(),
      deltaLine: String(outcome && outcome.deltaLine || '').trim()
    },
    fallbackNarration: String(fallbackText || '').trim()
  };
}

function buildOpeningPrompt(state, action) {
  const bundle = buildPromptStateBundle(state, action || {}, null, 'narration');
  const cityName = state.world.currentCityName || '此地';
  const background = state.gameState.backgroundLabel || state.gameState.identity || '布衣';
  const relationNames = ensureList(state.gameState.relationships)
    .filter((item) => item && isRelationMet(item) && item.name)
    .slice(0, 4)
    .map((item) => item.name)
    .join('、');
  const nearbyRoutes = ensureList((((state.world || {}).map || {}).routes || []))
    .slice(0, 3)
    .map((item) => item && item.cityName)
    .filter(Boolean)
    .join('、');
  const pendingThreads = ensureList((state.memory || {}).openThreads)
    .slice(0, 3)
    .map((item) => normalizeNarrativeSnippet(item && item.title, ''))
    .filter(Boolean)
    .join('；');

  return [
    '以下内容不是总结，也不是设定说明，而是这卷故事正式开始后的开局首段正文。',
    `叙事视角：第一人称。主角已选定出身“${background}”，并在${cityName}落脚。`,
    `时代锁定：此段严格发生在${state.world.dateLabel || '建安年间'}的${cityName}。`,
    '时代禁令：禁止出现后世成书书名、现代口语、现代行业称呼与后见之明式评述；人物说话必须像当下此地的人会说的话。',
    '写作目标：把我刚在此地站稳脚跟时立刻撞上的人、风声、利益、危险与机会真正写出来，让故事从这一刻开始滚动。',
    '文风补充：读取状态包中的 `styleProfile.shared` 与 `styleProfile.narration`。开局要有地方气、时代压迫感和未说透的人情试探，不要写成设定导语。',
    `必须写出${cityName}此刻的街巷、气味、秩序、压迫感和机会口，不要空泛报地名。`,
    '必须让至少一名人物、势力、门派消息或历史风向真正进入场景，让我必须马上判断下一步。',
    '必须让正文自然分出多个后续方向，例如追人物、碰势力、探暗线、换地点、投门派、压进军旅或江湖，但不要直接列成选项。',
    '不要写成大纲、导语或系统播报，不要解释生成过程。',
    relationNames ? `优先利用这批开局人物：${relationNames}。` : '',
    nearbyRoutes ? `附近可牵出的去向包括：${nearbyRoutes}。` : '',
    pendingThreads ? `当前最值得点燃的局势压力：${pendingThreads}。` : '',
    '结尾要求：停在局势真正被点燃、我必须立刻落下一手的位置，为后续动态规划留出空间。',
    '结构化状态包(JSON)：',
    stringifyPromptStateBundle(bundle)
  ].filter(Boolean).join('\n');
}

function buildOpeningFallbackText(state) {
  const cityName = state.world.currentCityName || '此地';
  const background = state.gameState.backgroundLabel || state.gameState.identity || '布衣';
  const relationNames = ensureList(state.gameState.relationships)
    .filter((item) => item && isRelationMet(item) && item.name)
    .slice(0, 2)
    .map((item) => item.name)
    .join('、');
  const threadText = ensureList((state.memory || {}).openThreads)
    .map((item) => normalizeNarrativeSnippet(item && item.title, ''))
    .find(Boolean);
  const routeName = ensureList((((state.world || {}).map || {}).routes || []))
    .map((item) => item && item.cityName)
    .find(Boolean);

  return [
    `${state.world.dateLabel}，${cityName}。我以“${background}”这层出身在这里落下第一根桩，街市、人情与各家门路都还没认熟，风里却已经带着乱世要把人往前推的催劲。`,
    relationNames
      ? `眼下最先会撞进我命里的，多半是${relationNames}这样的人物；他们背后牵着谁、又愿意把我往哪边带，都还没真正掀开。`
      : '眼下最先撞进我命里的，未必是刀兵，也可能是人情、风声和城里那些不肯摆到明面上的手。',
    threadText
      ? `更麻烦的是，“${threadText}”这条线已经压到眼前，我不可能只在城里站着看风向。`
      : '更麻烦的是，这座城不会让我安安静静地站稳脚跟，总会有人先找上门，也总会有事逼我先动。',
    routeName
      ? `我抬眼记下通往${routeName}的去路，再把城里的灯火、人声和未说透的试探一并收入心里，准备顺着最先裂开的缝隙往前走。`
      : '我把这座城今夜露出来的灯火、人声和试探一并记下，随后收束心神，准备顺着最先裂开的那道缝往前走。'
  ].join('');
}

function finalizeStateAfterAction(state, title) {
  refreshHistoricalRelations(state);
  if (state.world.phase !== 'ended') {
    state.scene.title = title;
    state.scene.summary = state.gameState.lastResolutionSummary || state.scene.summary;
    state.scene.statusLine = `${state.world.dateLabel} · 第${state.world.turn || 0}回 · ${state.world.currentCityName}`;
    state.scene.imagePrompt = '';
    state.choices = createActionChoices(state);
  } else {
    state.scene.summary = state.gameState.endingSummary || state.scene.summary;
    state.scene.statusLine = `${state.world.dateLabel} · 第${state.world.turn || 0}回 · ${state.gameState.endingTitle || '结局已定'}`;
    state.scene.imagePrompt = '';
    state.choices = [];
  }
  syncWorldMap(state);
  buildAdvisory(state);
  ensureChoices(state);
}

function processAction(state, action) {
  ensureLifecycleState(state);
  ensureMemoryState(state.memory);
  ensureMainline(state.world);
  ensureHistoricalState(state);
  ensureEncounterState(state);
  ensureRetinueState(state);
  ensureCityState(state);
  syncWorldMap(state);
  refreshHistoricalRelations(state);
  ensureChoices(state);
  state.gameState.lastRetinueFeedback = null;
  state.gameState.lastSkillFeedback = null;
  const normalizedAction = Object.assign({}, action);
  if (normalizedAction.kind === 'jianghu' && !String(normalizedAction.mode || '').trim()) {
    normalizedAction.mode = normalizedAction.target ? 'trace' : 'lodge';
  }
  if (state.world.phase === 'choose_origin' && normalizedAction.kind === 'travel') {
    normalizedAction.kind = 'origin';
  }
  if (state.world.phase === 'playing' && normalizedAction.kind === 'origin' && normalizedAction.target) {
    normalizedAction.kind = 'travel';
  }
  if (normalizedAction.target && !normalizedAction.targetName) {
    const targetedRelation = getRelation(state, normalizedAction.target);
    if (targetedRelation) normalizedAction.targetName = targetedRelation.name || '';
    if (!normalizedAction.targetName) {
      const targetedSect = findSect(normalizedAction.target);
      if (targetedSect) normalizedAction.targetName = targetedSect.name || '';
    }
    if (!normalizedAction.targetName) {
      const targetedCity = findCity(normalizedAction.target);
      if (targetedCity) normalizedAction.targetName = targetedCity.name || '';
    }
  }

  if (state.world.phase === 'choose_background') {
    rememberAction(state, normalizedAction);
    const ok = normalizedAction.kind === 'background' && applyBackgroundSelection(state, normalizedAction.target);
    if (!ok) {
      return {
        leadText: '',
        prompt: '',
        fallbackText: '我的出身还没定下来，故事没法往前走。得先替自己选一条来路。',
        title: '请选择出身'
      };
    }
    return {
      leadText: '',
      prompt: '',
      fallbackText: normalizeNarrationText(state.scene.text, '我先把出身定了下来，接下来该替自己选定落脚的城。'),
      title: state.scene.title
    };
  }

  if (state.world.phase === 'choose_origin') {
    rememberAction(state, normalizedAction);
    const ok = normalizedAction.kind === 'origin' && applyOriginSelection(state, normalizedAction.target);
    if (!ok) {
      return {
        leadText: '',
        prompt: '',
        fallbackText: '籍贯还没定下来。先选一座我要把故事落下去的城。',
        title: '请选择籍贯'
      };
    }
    return {
      leadText: '',
      prompt: buildOpeningPrompt(state, normalizedAction),
      fallbackText: buildOpeningFallbackText(state),
      title: state.scene.title
    };
  }

  if (state.world.phase === 'ended') {
    return {
      leadText: '',
      prompt: '',
      fallbackText: `此局已经收束为“${state.gameState.endingTitle || '结局已定'}”。若想继续试别的路，请直接重开此卷。`,
      title: state.scene.title || '结局已定'
    };
  }

  if (normalizedAction.kind === 'rest' && String(normalizedAction.mode || '').trim() === 'eat') {
    rememberAction(state, normalizedAction);
    const foodOutcome = resolveFoodRestAction(state, normalizedAction);
    decayFoodBuffs(state.gameState);
    finalizeStateAfterAction(state, state.scene.title || '食味稍定');
    return {
      leadText: '',
      prompt: buildPrompt(state, normalizedAction, foodOutcome),
      fallbackText: buildFallbackText(state, normalizedAction, foodOutcome),
      title: state.scene.title || '食味稍定'
    };
  }

  if (normalizedAction.kind === 'rest' && String(normalizedAction.mode || '').trim() === 'stock_food') {
    rememberAction(state, normalizedAction);
    const foodSupplyOutcome = resolveFoodSupplyRestAction(state, normalizedAction);
    decayFoodBuffs(state.gameState);
    finalizeStateAfterAction(state, state.scene.title || '粗食备下');
    return {
      leadText: '',
      prompt: buildPrompt(state, normalizedAction, foodSupplyOutcome),
      fallbackText: buildFallbackText(state, normalizedAction, foodSupplyOutcome),
      title: state.scene.title || '粗食备下'
    };
  }

  if (state.gameState.activeBattle && state.gameState.activeBattle.active && normalizedAction.kind !== 'battlecmd') {
    return {
      leadText: '',
      prompt: '',
      fallbackText: state.gameState.activeBattle.mode === 'duel'
        ? '这场江湖对决还没分出高下。先接住眼前这一手，再谈别的。'
        : '眼前战局还没打完。先把这场仗分出高下，再谈别的动作。',
      title: state.scene.title || '战局未决'
    };
  }

  if (normalizedAction.kind === 'battlecmd' && !(state.gameState.activeBattle && state.gameState.activeBattle.active)) {
    return {
      leadText: '',
      prompt: '',
      fallbackText: '眼下并没有真正展开的战斗，先通过剧情推进进入战局，再下战斗指令。',
      title: state.scene.title || '战局未起'
    };
  }

  if (normalizedAction.kind === 'warpath') {
    const access = battleAccessInfo(state, 'warpath');
    if (!access.unlocked) {
      return {
        leadText: '',
        prompt: '',
        fallbackText: access.reason || '眼下还不到真正把脚压进军旅的时候，得先把剧情和底子再往前推一步。',
        title: state.scene.title || '军旅未开'
      };
    }
  }

  if (normalizedAction.kind === 'jianghu') {
    const access = battleAccessInfo(state, 'duel');
    if (!access.unlocked) {
      return {
        leadText: '',
        prompt: '',
        fallbackText: access.reason || '眼下还不到真正压进江湖的时候，得先把人物、门路或武学底子铺开。',
        title: state.scene.title || '江湖未开'
      };
    }
  }

  if (normalizedAction.kind === 'spar' && normalizedAction.target && !getRelation(state, normalizedAction.target)) {
    return {
      leadText: '',
      prompt: '',
      fallbackText: '想切磋的人物没有找到，先在关系簿里指定一位能过手的人。',
      title: state.scene.title || '人物未定'
    };
  }

  const relationActionBlockedReason = validateRelationActionAvailability(state, normalizedAction);
  if (relationActionBlockedReason) {
    return {
      leadText: '',
      prompt: '',
      fallbackText: relationActionBlockedReason,
      title: state.scene.title || '时机未到'
    };
  }

  const preResolvedRegularOutcome = regularOutcomeAction(normalizedAction)
    ? resolveGenericAction(state, normalizedAction)
    : null;
  const preflightBlockedReason = validateActionPreflight(state, normalizedAction, preResolvedRegularOutcome);
  if (preflightBlockedReason) {
    return {
      leadText: '',
      prompt: '',
      fallbackText: preflightBlockedReason,
      title: state.scene.title || '时机未到'
    };
  }

  let effectiveAction = Object.assign({}, normalizedAction);
  if (normalizedAction.kind === 'battlecmd' && state.gameState.activeBattle && state.gameState.activeBattle.active) {
    effectiveAction = Object.assign({}, normalizedAction, {
      raw: actionDisplayText(normalizedAction),
      kind: state.gameState.activeBattle.mode === 'duel' ? 'jianghu' : 'battle'
    });
  }

  registerTurnProgress(state);
  if (String(normalizedAction.source || '').trim() === 'dynamic' || normalizedAction.dynamicChoiceMeta) {
    recordSelectedDynamicChoice(state, normalizedAction, normalizedAction.dynamicChoiceMeta || {});
  }
  rememberAction(state, effectiveAction);

  let outcome;
  if (normalizedAction.kind === 'battlecmd') {
    outcome = resolveBattleCommandOutcome(state, normalizedAction);
  } else if (normalizedAction.kind === 'warpath') {
    advanceMonth(state.world, 1);
    outcome = resolveRegularOutcome(state, normalizedAction, preResolvedRegularOutcome);
  } else if (normalizedAction.kind === 'jianghu') {
    advanceMonth(state.world, 1);
    outcome = resolveRegularOutcome(state, normalizedAction, preResolvedRegularOutcome);
  } else if (normalizedAction.kind === 'spar') {
    outcome = resolveBattleStartOutcome(state, 'duel', { variant: 'sparring', target: normalizedAction.target || '' });
  } else if (normalizedAction.kind === 'battle') {
    advanceMonth(state.world, 1);
    outcome = resolveBattle(state);
  } else if (normalizedAction.kind === 'travel') {
    outcome = resolveTravel(state, normalizedAction);
  } else if (normalizedAction.kind === 'joinsect') {
    advanceMonth(state.world, 1);
    outcome = resolveJoinSect(state, normalizedAction);
  } else if (normalizedAction.kind === 'military' && normalizedAction.mode === 'seize_city') {
    advanceMonth(state.world, 1);
    outcome = resolveCitySiege(state, normalizedAction);
  } else {
    advanceMonth(state.world, 1);
    outcome = resolveRegularOutcome(state, normalizedAction, preResolvedRegularOutcome);
  }

  if (state.world.phase === 'playing' && normalizedAction.kind !== 'battlecmd') {
    applyCityTurn(state, effectiveAction, outcome);
  }
  applyHistoricalTurn(state, effectiveAction, outcome);
  applyWorldPerception(state, effectiveAction, outcome);
  applyWorldFermentation(state, effectiveAction, outcome);
  ensureSoftState(state.gameState);
  const martialApexSideEffectLine = applyMartialApexSideEffects(state, effectiveAction, outcome);
  if (martialApexSideEffectLine) {
    outcome.summary = `${outcome.summary || ''}${martialApexSideEffectLine}`;
  }
  const martialApexCrisisLines = spawnMartialApexCrises(state);
  if (martialApexCrisisLines.length) {
    outcome.summary = `${outcome.summary || ''}${martialApexCrisisLines.slice(0, 2).join('')}`;
  }
  const threadAdvance = advanceOpenThreads(state, effectiveAction, outcome);
  if (threadAdvance.expired.length) {
    const expiredLine = threadAdvance.expired
      .slice(0, 2)
      .map((item) => `${item.domain}线“${item.title}”已经被拖过时机`)
      .join('；');
    if (expiredLine) {
      outcome.summary = `${outcome.summary || ''}${expiredLine}。`;
    }
  }
  if (state && state.gameState && outcome && outcome.summary) {
    state.gameState.lastResolutionSummary = outcome.summary;
  }
  const ending = evaluateEnding(state);
  if (ending) {
    outcome.ending = ending;
    applyEndingState(state, ending);
  }
  const consequenceLedger = buildTurnConsequenceLedger(state, effectiveAction, outcome);
  state.gameState.lastConsequenceLedger = consequenceLedger;
  applyConsequencesToSoftState(state.gameState, consequenceLedger);
  recordStructuredTurn(state, effectiveAction, outcome);

  const sceneTitle = `${state.world.currentCityName} · ${['battle', 'battlecmd', 'spar'].includes(normalizedAction.kind) ? '战局回合' : '新的一回'}`;
  finalizeStateAfterAction(state, sceneTitle);
  const fallbackText = buildFallbackText(state, effectiveAction, outcome);
  const directorPacket = buildDirectorTurnPacket(state, effectiveAction, outcome, sceneTitle);
  const fallbackPacket = buildDirectorFallbackPacket(state, effectiveAction, outcome, sceneTitle, fallbackText);

  if (outcome && outcome.interactiveOnly) {
    return {
      leadText: '',
      prompt: '',
      fallbackText: '',
      title: sceneTitle,
      effectiveAction,
      outcome,
      directorPacket,
      fallbackPacket,
      interactiveOnly: true,
      statusMessage: outcome.statusMessage || outcome.summary || ''
    };
  }

  return {
    leadText: buildLeadText(state, outcome),
    prompt: buildPrompt(state, effectiveAction, outcome),
    fallbackText,
    title: sceneTitle,
    effectiveAction,
    outcome,
    directorPacket,
    fallbackPacket
  };
}

module.exports = {
  processAction,
  applyNarrativeOutcomeEcho
};









