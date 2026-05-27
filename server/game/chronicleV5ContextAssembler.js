const { summarizeSoftStateForContext } = require('./chronicleV5SoftState');
const { buildTurnConsequenceLedger } = require('./chronicleV5TurnConsequences');
const { buildDynamicPlanningBundle } = require('./chronicleV5DynamicPlanning');
const { ensureWorldPerceptionState } = require('./chronicleV5WorldPerception');
const { ensureWorldFermentationState } = require('./chronicleV5WorldFermentation');
const { isRelationMet, relationVisibilityState } = require('./chronicleV5RelationVisibility');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSnippet(value, fallback = '') {
  const text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function clipText(value, maxChars) {
  const text = normalizeSnippet(value, '');
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeSnippet(value, '');
    if (text) return text;
  }
  return '';
}

function compactLabeledLines(list, formatter, limit = 3) {
  return ensureList(list)
    .slice(0, limit)
    .map((item) => normalizeSnippet(formatter(item), ''))
    .filter(Boolean);
}

function compactConsequenceTexts(list, limit = 3) {
  return ensureList(list)
    .slice(0, limit)
    .map((item) => clipText(
      item && (
        item.text
        || item.summary
        || item.note
        || item.title
      ),
      56
    ))
    .filter(Boolean);
}

function joinClipped(parts, maxChars = 110) {
  const merged = ensureList(parts)
    .map((item) => normalizeSnippet(item, ''))
    .filter(Boolean)
    .join(' | ');
  return clipText(merged, maxChars);
}

function topRelations(state, limit = 3) {
  return ensureList(state && state.gameState && state.gameState.relationships)
    .filter((item) => item && item.name && isRelationMet(item))
    .slice()
    .sort((a, b) => (
      (toNumber(b.trust) + toNumber(b.affection) + toNumber(b.loyalty))
      - (toNumber(a.trust) + toNumber(a.affection) + toNumber(a.loyalty))
    ))
    .slice(0, limit)
    .map((item) => ({
      id: normalizeSnippet(item.id || ''),
      name: normalizeSnippet(item.name || ''),
      title: normalizeSnippet(item.title || ''),
      trust: toNumber(item.trust),
      affection: toNumber(item.affection),
      loyalty: toNumber(item.loyalty),
      status: clipText(item.status || item.promptFocus || '', 60)
    }));
}

function rumorRelations(state, limit = 4) {
  return ensureList(state && state.gameState && state.gameState.relationships)
    .filter((item) => item && item.name && !isRelationMet(item))
    .filter((item) => ['rumor', 'scene'].includes(relationVisibilityState(item, 'hidden')))
    .slice(0, limit)
    .map((item) => ({
      name: normalizeSnippet(item.name || ''),
      visibility: relationVisibilityState(item, 'hidden'),
      hint: clipText(item.status || item.promptFocus || item.title || '', 50)
    }));
}

function topFactions(state, limit = 3) {
  return [];
}

function topStats(state, limit = 4) {
  const gs = state && state.gameState ? state.gameState : {};
  const labels = {
    governance: '内政',
    diplomacy: '外交',
    commerce: '经商',
    military: '军略',
    strategy: '谋略',
    charm: '魅力'
  };
  return Object.keys(labels)
    .map((key) => ({
      key,
      label: labels[key],
      value: toNumber(gs[key], 0)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function summarizeOpenThreads(state, limit = 3) {
  return ensureList(state && state.memory && state.memory.threads)
    .slice(0, limit)
    .map((item) => ({
      title: clipText(item && item.title || '', 36),
      domain: normalizeSnippet(item && item.domain || ''),
      urgency: toNumber(item && item.urgency, 0)
    }))
    .filter((item) => item.title);
}

function buildNarrationContext(state, action, outcome, ledger = null) {
  const world = state && state.world ? state.world : {};
  const gs = state && state.gameState ? state.gameState : {};
  const effectiveLedger = ledger || buildTurnConsequenceLedger(state, action, outcome);
  const softSummary = summarizeSoftStateForContext(gs);
  const worldPerception = ensureWorldPerceptionState(gs);
  const worldFermentation = ensureWorldFermentationState(gs);
  const relationFocus = topRelations(state, 3);
  const rumorFocus = rumorRelations(state, 4);
  const factionFocus = [];
  const consequenceBeats = compactConsequenceTexts(effectiveLedger.consequences, 3);
  const previousSceneTail = clipText(state && state.scene && state.scene.text || '', 120);
  const perceptionLine = clipText(worldPerception.hiddenCurrent || worldPerception.summary || worldPerception.headline, 96);
  const fermentationLine = clipText(worldFermentation.summary || worldFermentation.headline, 96);
  const currentMove = clipText(
    firstNonEmpty(
      effectiveLedger && effectiveLedger.action && effectiveLedger.action.actionText,
      effectiveLedger && effectiveLedger.action && effectiveLedger.action.text,
      action && action.actionText,
      action && action.text
    ),
    88
  );
  const outcomeBeat = clipText(
    firstNonEmpty(
      effectiveLedger && effectiveLedger.resolved && effectiveLedger.resolved.changeSummary,
      effectiveLedger && effectiveLedger.resolved && effectiveLedger.resolved.summary,
      consequenceBeats[0]
    ),
    96
  );
  const peopleInFrame = compactLabeledLines(relationFocus, (item) => {
    const name = normalizeSnippet(item && item.name || '');
    const title = normalizeSnippet(item && item.title || '');
    const status = clipText(item && item.status || '', 30);
    if (!name) return '';
    return `${name}${title ? `(${title})` : ''}${status ? `: ${status}` : ''}`;
  });
  const forcesInFrame = [];
  const immediatePressure = joinClipped([
    softSummary.unfinishedMoves[0],
    softSummary.sceneResidues[0],
    perceptionLine
  ], 120);
  const humanTension = joinClipped([
    peopleInFrame[0],
    peopleInFrame[1],
    ''
  ], 120);
  const aftertaste = joinClipped([
    consequenceBeats[0],
    softSummary.recentShockTags[0],
    fermentationLine
  ], 120);

  return {
    task: 'narration',
    role: 'text_adventure_engine',
    actorProfile: {
      name: normalizeSnippet(gs.name || ''),
      title: normalizeSnippet(gs.title || ''),
      identity: normalizeSnippet(gs.identity || gs.backgroundLabel || ''),
      background: normalizeSnippet(gs.backgroundLabel || ''),
      backgroundSummary: clipText(gs.backgroundSummary || gs.originSummary || '', 96),
      age: toNumber(gs.age, 0),
      gender: normalizeSnippet(gs.genderLabel || gs.gender || ''),
      sect: normalizeSnippet(gs.sectName || '无门无派'),
      martialRoute: normalizeSnippet(gs.martialRouteName || ''),
      strategyRoute: normalizeSnippet(gs.strategyRouteName || ''),
      topStats: topStats(state, 4)
    },
    persistentState: {
      resources: {
        coins: toNumber(gs.coins, 0),
        supplies: toNumber(gs.supplies, 0),
        troops: toNumber(gs.troops, 0)
      },
      condition: {
        health: toNumber(gs.health, 0),
        fatigue: toNumber(gs.fatigue, 0),
        morale: toNumber(gs.morale, 0)
      },
      standing: {
        influence: toNumber(gs.influence, 0),
        renown: toNumber(gs.renown, 0)
      }
    },
    relationshipState: relationFocus.map((item) => ({
      name: item.name,
      title: item.title,
      trust: item.trust,
      affection: item.affection,
      loyalty: item.loyalty,
      status: item.status
    })),
    rumorOnlyPeople: rumorFocus,
    factionState: [],
    currentState: {
      turn: Number(world.turn || 0),
      date: normalizeSnippet(world.dateLabel || ''),
      city: normalizeSnippet(world.currentCityName || ''),
      region: normalizeSnippet(world.currentRegion || ''),
      weather: normalizeSnippet(world.weather || ''),
      sceneTitle: normalizeSnippet(state && state.scene && state.scene.title || ''),
      previousBeat: previousSceneTail,
      openThreads: summarizeOpenThreads(state, 3),
      softPressure: {
        unfinishedMoves: softSummary.unfinishedMoves.slice(0, 2),
        sceneResidues: softSummary.sceneResidues.slice(0, 2),
        rumorHeat: softSummary.rumorHeat.slice(0, 2),
        factionWatch: []
      }
    },
    resolvedFacts: {
      actionText: currentMove,
      resultTier: normalizeSnippet(effectiveLedger && effectiveLedger.resolved && effectiveLedger.resolved.tier || ''),
      outcomeBeat,
      consequenceBeats
    },
    sceneCapsule: {
      openingImage: clipText(firstNonEmpty(previousSceneTail, perceptionLine, fermentationLine), 96),
      immediatePressure,
      humanTension,
      aftertaste,
      peopleInFrame,
      rumorOnlyPeople: rumorFocus.map((item) => `${item.name}${item.hint ? `: ${item.hint}` : ''}`),
      forcesInFrame: []
    },
    styleProfile: {
      engineRole: '你负责把既成结果写成可见事件：谁说了什么、谁递了什么、谁拦了路、我怎样应对。',
      narrationVoice: '第一人称现场叙事，以我当下的见闻、判断、动作和承受为中心。',
      wuxiaStyle: '句子要有筋骨，但不要空泛江湖腔；少写暗流、风向、大棋、冷冽，多写人、物、话、动作和阻力。',
      battleStyle: '若涉及交锋，着重写招式、身法、气机、兵势、险意与胜负余韵。',
      numericRule: '数值是演绎约束，不是播报内容。只能化进手头紧松、伤疲、底气和旁人态度里。',
      relationRule: '关系和势力要通过称呼、试探、反应、让步、逼压、榜文、书札或口信进入场景，不要列表复述。',
      writeAsScene: true,
      avoidSettlementTone: true
    }
  };
}

function frontierDigest(frontier) {
  if (!frontier) return null;
  return {
    id: normalizeSnippet(frontier.id || ''),
    type: normalizeSnippet(frontier.type || ''),
    title: normalizeSnippet(frontier.title || ''),
    whyNow: clipText(frontier.reason || frontier.summary || '', 96),
    pressure: Number(frontier.priorityScore || frontier.weight || 0),
    risk: normalizeSnippet(frontier.risk || ''),
    targetName: normalizeSnippet(frontier.targetName || ''),
    targetType: normalizeSnippet(frontier.targetType || ''),
    recommendedKinds: ensureList(frontier.recommendedKinds).slice(0, 4),
    source: normalizeSnippet(frontier.source || ''),
    noveltyKey: normalizeSnippet(frontier.noveltyKey || '')
  };
}

function buildChoiceContext(state, action, outcome, ledger = null, planning = null) {
  const world = state && state.world ? state.world : {};
  const gs = state && state.gameState ? state.gameState : {};
  const effectiveLedger = ledger || buildTurnConsequenceLedger(state, action, outcome);
  const effectivePlanning = planning || buildDynamicPlanningBundle(state, action || {}, { frontierLimit: 8 });
  const softSummary = summarizeSoftStateForContext(gs);
  const selectedDynamicChoice = state && state.memory && state.memory.lastSelectedDynamicChoice
    ? {
      text: normalizeSnippet(state.memory.lastSelectedDynamicChoice.text || ''),
      actionText: normalizeSnippet(state.memory.lastSelectedDynamicChoice.actionText || ''),
      actionKind: normalizeSnippet(state.memory.lastSelectedDynamicChoice.actionKind || ''),
      slotRole: normalizeSnippet(state.memory.lastSelectedDynamicChoice.slotRole || '')
    }
    : null;
  return {
    task: 'choice',
    turn: Number(world.turn || 0),
    location: normalizeSnippet(world.currentCityName || ''),
    action: effectiveLedger.action,
    resolved: effectiveLedger.resolved,
    hardDelta: effectiveLedger.hardDelta,
    consequences: ensureList(effectiveLedger.consequences).slice(0, 4),
    softState: {
      promiseDebt: softSummary.promiseDebt.slice(0, 2),
      moralDebt: softSummary.moralDebt.slice(0, 2),
      factionWatch: [],
      rumorHeat: softSummary.rumorHeat.slice(0, 2),
      unfinishedMoves: softSummary.unfinishedMoves.slice(0, 2),
      personalMomentum: softSummary.personalMomentum.slice(0, 3),
      sceneResidues: softSummary.sceneResidues.slice(0, 2),
      recentShockTags: softSummary.recentShockTags.slice(0, 3)
    },
    frontiers: ensureList(effectivePlanning && effectivePlanning.frontiers).slice(0, 6).map(frontierDigest).filter(Boolean),
    recentSelectedDynamicChoice: selectedDynamicChoice,
    validationHints: {
      mustStayActionable: true,
      mustNotWriteCompletedOutcome: true,
      fixedSlotOrder: ['normal', 'moral', 'wild']
    }
  };
}

module.exports = {
  buildNarrationContext,
  buildChoiceContext
};
