const {
  HISTORICAL_PERSONA_RULES,
  HISTORICAL_EVENT_CONFIG
} = require('./chronicleV5HistoricalEventConfig');
const { getHistoricalPersona } = require('./chronicleV5HistoricalPersonaLibrary');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tierFactor(tier) {
  return {
    great: 1.4,
    good: 1.1,
    mixed: 0.8,
    fail: 0.55
  }[tier] || 0.8;
}

function relationWeight(relation) {
  if (!relation) return 0;
  return ((relation.trust || 0) + (relation.affection || 0) + (relation.loyalty || 0)) / 30;
}

function createHistoricalState() {
  const eventStates = {};
  HISTORICAL_EVENT_CONFIG.forEach((event) => {
    eventStates[event.id] = {
      id: event.id,
      title: event.title,
      score: 0,
      triggered: false,
      resolved: false,
      active: false,
      branch: 'historical',
      intervention: 0,
      triggerYear: 0,
      triggerTurn: 0,
      lastTurn: 0,
      summary: ''
    };
  });

  return {
    npcScores: {},
    eventStates,
    activeEventIds: [],
    triggeredEventIds: [],
    resolvedEventIds: [],
    lastEventId: '',
    lastEventTitle: '',
    lastEventSummary: '',
    lastEventPrompt: '',
    lastNpcSummary: '',
    historyMomentum: 0
  };
}

function ensureHistoricalState(state) {
  const gs = state.gameState || {};
  if (!gs.historical || typeof gs.historical !== 'object') {
    gs.historical = createHistoricalState();
  }

  const historical = gs.historical;
  if (!historical.npcScores || typeof historical.npcScores !== 'object') historical.npcScores = {};
  if (!historical.eventStates || typeof historical.eventStates !== 'object') historical.eventStates = {};
  if (!Array.isArray(historical.activeEventIds)) historical.activeEventIds = [];
  if (!Array.isArray(historical.triggeredEventIds)) historical.triggeredEventIds = [];
  if (!Array.isArray(historical.resolvedEventIds)) historical.resolvedEventIds = [];
  if (typeof historical.lastEventId !== 'string') historical.lastEventId = '';
  if (typeof historical.lastEventTitle !== 'string') historical.lastEventTitle = '';
  if (typeof historical.lastEventSummary !== 'string') historical.lastEventSummary = '';
  if (typeof historical.lastEventPrompt !== 'string') historical.lastEventPrompt = '';
  if (typeof historical.lastNpcSummary !== 'string') historical.lastNpcSummary = '';
  if (!Number.isFinite(Number(historical.historyMomentum))) historical.historyMomentum = 0;

  HISTORICAL_EVENT_CONFIG.forEach((event) => {
    if (!historical.eventStates[event.id]) {
      historical.eventStates[event.id] = createHistoricalState().eventStates[event.id];
    }
  });

  ensureList(gs.relationships).forEach((relation) => {
    if (!relation || !relation.id) return;
    if (!historical.npcScores[relation.id]) {
      historical.npcScores[relation.id] = {
        id: relation.id,
        name: relation.name || relation.id,
        score: 0,
        lastTurn: 0,
        lastActionKind: ''
      };
    }
  });

  return historical;
}

function pushThread(state, title, urgency, domain) {
  if (!state.memory || typeof state.memory !== 'object') state.memory = {};
  const list = ensureList(state.memory.openThreads).filter((item) => item && item.title !== title);
  state.memory.openThreads = [
    {
      key: `history_${state.world && state.world.turn ? state.world.turn : 0}_${list.length}`,
      title,
      urgency: clamp(Number(urgency) || 2, 1, 3),
      domain: domain || '史势'
    }
  ].concat(list).slice(0, 8);
}

function pushSummary(state, text) {
  if (!state.memory || typeof state.memory !== 'object') state.memory = {};
  const list = ensureList(state.memory.summaries).filter((item) => item && item !== text);
  state.memory.summaries = [text].concat(list).slice(0, 10);
}

function matchingFactionScore(state, factionIds) {
  const factions = ensureList(state.gameState && state.gameState.factions);
  return factions
    .filter((item) => factionIds.includes(item.id))
    .reduce((total, item) => total + ((item.favor || 0) + (item.leverage || 0) + (item.power || 0) / 2 - (item.hostility || 0) / 2), 0) / 40;
}

function matchingRelationScore(state, relationIds) {
  const relations = ensureList(state.gameState && state.gameState.relationships);
  return relations
    .filter((item) => relationIds.includes(item.id))
    .reduce((total, item) => total + relationWeight(item), 0);
}

function statScore(state, statWeights) {
  const gs = state.gameState || {};
  const caps = {
    health: 100,
    maxHealth: 100,
    fatigue: 60,
    coins: 180,
    supplies: 160,
    troops: 600,
    morale: 120,
    influence: 120,
    renown: 120,
    governance: 100,
    diplomacy: 100,
    commerce: 100,
    military: 100,
    strategy: 100,
    charm: 100,
    martialLevel: 100
  };
  return Object.keys(statWeights || {}).reduce((total, key) => {
    const value = Number(gs[key] || 0);
    const cap = Number(caps[key] || 100);
    return total + (Math.max(0, Math.min(value, cap)) * Number(statWeights[key] || 0));
  }, 0);
}

function formatHistoricalNpcSummary(item) {
  const persona = getHistoricalPersona(item.id);
  const scoreText = `关注度${Math.round(item.score || 0)}`;
  const traitText = persona && persona.personaAnchor ? persona.personaAnchor : '';
  const focusText = persona && persona.promptFocus ? persona.promptFocus : '';
  return [item.name || item.id, scoreText, traitText, focusText]
    .filter(Boolean)
    .join('，');
}

function updateHistoricalNpcScores(state, action, outcome) {
  const historical = ensureHistoricalState(state);
  const currentCityId = state.world && state.world.currentCityId ? state.world.currentCityId : '';
  const factor = tierFactor(outcome && outcome.tier);

  ensureList(state.gameState && state.gameState.relationships).forEach((relation) => {
    if (!relation || !relation.id) return;
    const personaRule = HISTORICAL_PERSONA_RULES[relation.id];
    if (!personaRule) return;

    const bucket = historical.npcScores[relation.id] || {
      id: relation.id,
      name: relation.name || relation.id,
      score: 0,
      lastTurn: 0,
      lastActionKind: ''
    };

    let gain = Number((personaRule.actionWeights || {})[action.kind] || 0);
    if (personaRule.cityIds && personaRule.cityIds.includes(currentCityId)) gain += 1.5;
    if (personaRule.factionIds && personaRule.factionIds.includes(relation.factionId)) gain += 1;
    gain += relationWeight(relation);

    if (gain > 0) {
      bucket.score = Number(bucket.score || 0) + (gain * factor);
      bucket.lastTurn = state.world && state.world.turn ? state.world.turn : 0;
      bucket.lastActionKind = action.kind;
      bucket.name = relation.name || bucket.name;
      historical.npcScores[relation.id] = bucket;
    }
  });

  historical.lastNpcSummary = Object.values(historical.npcScores)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3)
    .map((item) => formatHistoricalNpcSummary(item))
    .join('；');
}

function computeEventGain(state, action, outcome, event) {
  const currentYear = Number(state.world && state.world.year) || 0;
  if (currentYear < Number(event.year || 0)) return 0;

  const actionScore = Number((event.actionWeights || {})[action.kind] || 0);
  const cityMatched = ensureList(event.cityIds).includes(state.world && state.world.currentCityId);
  const travelPlan = outcome && outcome.travelPlan ? outcome.travelPlan : null;
  const routeMatched = action.kind === 'travel'
    && ensureList(event.routeIds).some((routeId) => ensureList(travelPlan && travelPlan.routeIds).includes(routeId));
  const corridorCityMatched = action.kind === 'travel'
    && ensureList(event.cityIds).some((cityId) => ensureList(travelPlan && travelPlan.cityIds).includes(cityId));
  const relationScore = matchingRelationScore(state, ensureList(event.relationIds));
  if (!actionScore && !cityMatched && !routeMatched && !corridorCityMatched && relationScore <= 0) return 0;

  let gain = 0;
  gain += actionScore;
  gain += statScore(state, event.statWeights || {});

  if (cityMatched) gain += 2;
  if (routeMatched) gain += 2.5;
  if (corridorCityMatched) gain += 1.5;
  gain += matchingFactionScore(state, ensureList(event.factionIds));
  gain += relationScore;
  gain += Math.max(0, ((state.world && state.world.pressure) || 0) / 30);

  return Math.max(0, gain * tierFactor(outcome && outcome.tier));
}

function eventBranchLabel(eventState, event) {
  if (Number(eventState.intervention || 0) >= Number(event.rewriteThreshold || 30)) return 'rewrite';
  if (Number(eventState.intervention || 0) >= Math.round(Number(event.rewriteThreshold || 30) * 0.65)) return 'shifting';
  return 'historical';
}

function eventBranchSummary(eventState) {
  if (eventState.branch === 'rewrite') return '你已经深度插入这场事局，后续走向开始偏离原本史势。';
  if (eventState.branch === 'shifting') return '你的落子正在撬动原本的史势，这场大事已经不再完全照旧路走。';
  return '这场事局仍以原本史势为主，但你已经摸到了边缘。';
}

function applyHistoricalTurn(state, action, outcome) {
  const historical = ensureHistoricalState(state);
  updateHistoricalNpcScores(state, action, outcome);

  const currentYear = Number(state.world && state.world.year) || 0;
  const turn = Number(state.world && state.world.turn) || 0;
  const triggeredThisTurn = [];

  HISTORICAL_EVENT_CONFIG.forEach((event) => {
    const eventState = historical.eventStates[event.id];
    if (!eventState || eventState.resolved) return;

    const gain = computeEventGain(state, action, outcome, event);
    if (gain > 0) {
      eventState.score = Number(eventState.score || 0) + gain;
      eventState.lastTurn = turn;
    }

    if (!eventState.triggered && currentYear >= event.year && eventState.score >= event.threshold) {
      eventState.triggered = true;
      eventState.active = true;
      eventState.triggerYear = currentYear;
      eventState.triggerTurn = turn;
      eventState.summary = event.triggerSummary;
      historical.activeEventIds = Array.from(new Set([event.id].concat(historical.activeEventIds)));
      historical.triggeredEventIds = Array.from(new Set([event.id].concat(historical.triggeredEventIds)));
      historical.lastEventId = event.id;
      historical.lastEventTitle = event.title;
      historical.lastEventSummary = event.triggerSummary;
      historical.lastEventPrompt = event.promptFocus || event.triggerSummary;
      historical.historyMomentum = Number(historical.historyMomentum || 0) + 2;
      triggeredThisTurn.push(event);
      pushThread(state, event.threadTitle, 3, '史势');
      pushSummary(state, event.triggerSummary);
    }

    if (eventState.triggered && eventState.active) {
      eventState.intervention = Number(eventState.intervention || 0) + Math.max(1, Math.round(gain));
      if (ensureList(event.cityIds).includes(state.world && state.world.currentCityId)) {
        eventState.intervention += 1;
      }
      if (action.kind === 'travel' && outcome && outcome.travelPlan) {
        if (ensureList(event.routeIds).some((routeId) => ensureList(outcome.travelPlan.routeIds).includes(routeId))) {
          eventState.intervention += 2;
        }
        if (ensureList(event.cityIds).some((cityId) => ensureList(outcome.travelPlan.cityIds).includes(cityId))) {
          eventState.intervention += 1;
        }
      }
      eventState.branch = eventBranchLabel(eventState, event);

      if (currentYear > Number(event.latestYear || event.year) + 1 || Number(eventState.intervention || 0) >= Number(event.rewriteThreshold || 30) + 8) {
        eventState.active = false;
        eventState.resolved = true;
        historical.activeEventIds = historical.activeEventIds.filter((id) => id !== event.id);
        historical.resolvedEventIds = Array.from(new Set([event.id].concat(historical.resolvedEventIds)));
        historical.lastEventId = event.id;
        historical.lastEventTitle = event.title;
        historical.lastEventSummary = `${event.title}暂时收束。${eventBranchSummary(eventState)}`;
        historical.lastEventPrompt = historical.lastEventSummary;
        pushSummary(state, historical.lastEventSummary);
      }
    }
  });

  if (triggeredThisTurn.length) {
    const lines = triggeredThisTurn.map((item) => `${item.title}被正式推上桌面`);
    outcome.summary = `${outcome.summary}${lines.length ? ` ${lines.join('，')}。` : ''}`;
    outcome.locationHook = triggeredThisTurn[0].title;
  }

  const activeStates = historical.activeEventIds
    .map((id) => ({ config: HISTORICAL_EVENT_CONFIG.find((item) => item.id === id), state: historical.eventStates[id] }))
    .filter((item) => item.config && item.state)
    .slice(0, 2)
    .map((item) => `${item.config.title}（势${Math.round(item.state.score || 0)}，${item.state.branch === 'rewrite' ? '改史中' : item.state.branch === 'shifting' ? '偏转中' : '沿史势'}）`);

  if (!historical.lastEventSummary && activeStates.length) {
    historical.lastEventSummary = `当前起势事件：${activeStates.join('；')}`;
    historical.lastEventPrompt = historical.lastEventSummary;
  }

  return {
    triggeredThisTurn,
    activeSummary: activeStates.join('；'),
    npcSummary: historical.lastNpcSummary || '',
    eventSummary: historical.lastEventSummary || ''
  };
}

function buildHistoricalNarrativeBundle(state) {
  const historical = ensureHistoricalState(state);
  const activeEvents = historical.activeEventIds
    .map((id) => ({ config: HISTORICAL_EVENT_CONFIG.find((item) => item.id === id), state: historical.eventStates[id] }))
    .filter((item) => item.config && item.state)
    .sort((a, b) => Number(b.state.score || 0) - Number(a.state.score || 0));

  const nearEvents = HISTORICAL_EVENT_CONFIG
    .map((config) => ({ config, state: historical.eventStates[config.id] }))
    .filter((item) => item.state && !item.state.triggered && Number(state.world && state.world.year) >= Number(item.config.year) - 1)
    .sort((a, b) => Number(b.state.score || 0) - Number(a.state.score || 0))
    .slice(0, 2);

  const activeText = activeEvents.length
    ? activeEvents
      .slice(0, 2)
      .map((item) => `${item.config.title}：势能${Math.round(item.state.score || 0)}，${eventBranchSummary(item.state)}`)
      .join('；')
    : '暂时没有已经正式起势的历史事件。';

  const nearText = nearEvents.length
    ? nearEvents
      .map((item) => `${item.config.title}：当前积力${Math.round(item.state.score || 0)}/${item.config.threshold}`)
      .join('；')
    : '暂时没有逼近触发阈值的历史事件。';

  return {
    activeText,
    nearText,
    npcText: historical.lastNpcSummary || '暂时没有被明显牵动的历史人物。',
    lastEventText: historical.lastEventSummary || '暂时还没有新的历史事件被推上桌面。'
  };
}

function decorateHistoricalLead(event, eventState, item, mode, state) {
  const currentCityId = String(state && state.world && state.world.currentCityId || '');
  const currentCityName = String(state && state.world && state.world.currentCityName || '此地');
  const inScene = ensureList(event.cityIds).includes(currentCityId);
  const branch = eventState && eventState.branch ? eventState.branch : 'historical';
  const branchHint = branch === 'rewrite'
    ? '这条史势已经被你撬开，再落一子就可能把它彻底带偏。'
    : branch === 'shifting'
      ? '局势已经开始偏转，这时候继续压上去，最容易留下你的痕迹。'
      : '史势还没有完全偏转，谁先抓住关节，谁就能先被这股大势记住。';
  const locationHint = inScene ? `你人就在${currentCityName}，这股风向已经贴到眼前。` : '';
  const prepHint = mode === 'prep' ? `眼下还没到掀桌的时候，这一手贵在先把${event.title}的关节摸到手里。` : '';
  const prepAction = mode === 'prep'
    ? `${item.actionText} 这一回不必急着求成，先把能承接后续史势的人、路或把柄握住。`
    : item.actionText;

  return {
    id: `${mode === 'prep' ? 'history-prep' : 'history'}:${event.id}:${item.actionKind}:${encodeURIComponent(item.text)}`,
    text: item.text,
    actionText: prepAction,
    hint: [item.hint, branchHint, locationHint, prepHint].filter(Boolean).join(' '),
    actionKind: item.actionKind,
    eventId: event.id,
    eventTitle: event.title
  };
}

function buildHistoricalChoiceLeads(state) {
  const historical = ensureHistoricalState(state);
  const activeEvents = historical.activeEventIds
    .map((id) => ({
      config: HISTORICAL_EVENT_CONFIG.find((item) => item.id === id),
      state: historical.eventStates[id]
    }))
    .filter((item) => item.config && item.state)
    .sort((a, b) => Number(b.state.score || 0) - Number(a.state.score || 0));

  if (activeEvents.length) {
    const primary = activeEvents[0];
    return ensureList(primary.config.dynamicActions)
      .slice(0, 2)
      .map((item) => decorateHistoricalLead(primary.config, primary.state, item, 'active', state));
  }

  const nearEvent = HISTORICAL_EVENT_CONFIG
    .map((config) => ({ config, state: historical.eventStates[config.id] }))
    .filter((item) => item.state && !item.state.triggered && Number(state.world && state.world.year) >= Number(item.config.year) - 1)
    .sort((a, b) => Number(b.state.score || 0) - Number(a.state.score || 0))[0];

  if (nearEvent) {
    return ensureList(nearEvent.config.dynamicActions)
      .slice(0, 1)
      .map((item) => decorateHistoricalLead(nearEvent.config, nearEvent.state, item, 'prep', state));
  }

  return [];
}

function hasHistoricalDeviation(state) {
  const historical = ensureHistoricalState(state);
  return Object.values(historical.eventStates || {}).some((eventState) => {
    if (!eventState || !eventState.triggered) return false;
    return eventState.branch === 'shifting' || eventState.branch === 'rewrite';
  });
}

function historicalDeviationAccessForRelation(state, relation, purpose = 'general') {
  if (!relation || relation.isHistorical !== true) {
    return {
      unlocked: true,
      reason: '',
      requirements: []
    };
  }

  if (hasHistoricalDeviation(state)) {
    return {
      unlocked: true,
      reason: '',
      requirements: [
        { label: '史势已被撬动', met: true }
      ]
    };
  }

  const purposeText = {
    romance: '在私情上突然越过原有分际',
    spar: '暂时脱离原本行止来与你切磋问手',
    jianghu: '脱离原本的史势牵引陪你走江湖',
    travel: '轻易放下既定去向与你同行'
  }[purpose] || '做出明显偏离原史轨迹的举动';

  return {
    unlocked: false,
    reason: `${relation.name}此时仍被原有史势牵着，在你真正撬动历史走向之前，还不会${purposeText}。`,
    requirements: [
      { label: '先触发一次明确的历史偏转', met: false }
    ]
  };
}

module.exports = {
  createHistoricalState,
  ensureHistoricalState,
  applyHistoricalTurn,
  buildHistoricalNarrativeBundle,
  buildHistoricalChoiceLeads,
  hasHistoricalDeviation,
  historicalDeviationAccessForRelation
};
