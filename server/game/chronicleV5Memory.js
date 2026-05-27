const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCleanSafe');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(list) {
  return Array.from(new Set(ensureList(list).filter(Boolean).map((item) => String(item))));
}

function normalizeThreadConsequences(list) {
  return ensureList(list)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        type: String(item.type || '').trim(),
        targetId: String(item.targetId || '').trim(),
        value: Number.isFinite(Number(item.value)) ? Number(item.value) : 0,
        note: String(item.note || '').trim()
      };
    })
    .filter((item) => item && (item.type || item.note));
}

function normalizeThreadEntry(thread, options = {}) {
  const source = thread && typeof thread === 'object' ? thread : {};
  const currentTurn = Math.max(0, Number(options.currentTurn || 0));
  const urgency = Math.max(1, Math.min(3, Number(source.urgency || 1) || 1));
  const fallbackWindow = { 1: 5, 2: 4, 3: 3 }[urgency] || 4;
  const deadlineTurn = Number(source.deadlineTurn || 0) > 0
    ? Number(source.deadlineTurn || 0)
    : (currentTurn > 0 ? currentTurn + fallbackWindow : 0);
  return {
    key: String(source.key || '').trim(),
    title: String(source.title || '').trim(),
    urgency,
    domain: String(source.domain || '').trim() || '局势',
    status: String(source.status || 'open').trim() || 'open',
    deadlineTurn,
    escalationStep: Math.max(0, Number(source.escalationStep || 0) || 0),
    ownerFactionId: String(source.ownerFactionId || '').trim(),
    rivalActorId: String(source.rivalActorId || '').trim(),
    rivalName: String(source.rivalName || '').trim(),
    opportunityKey: String(source.opportunityKey || '').trim(),
    source: String(source.source || '').trim(),
    sourceActionKind: String(source.sourceActionKind || '').trim(),
    lastAdvancedTurn: Math.max(0, Number(source.lastAdvancedTurn || 0) || 0),
    resolvedTurn: Math.max(0, Number(source.resolvedTurn || 0) || 0),
    successConsequences: normalizeThreadConsequences(source.successConsequences),
    failureConsequences: normalizeThreadConsequences(source.failureConsequences),
    notes: ensureList(source.notes).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4)
  };
}

function domainOfAction(kind) {
  if (['battle', 'military', 'warpath'].includes(kind)) return '战事';
  if (['martial', 'jianghu', 'sect', 'joinsect'].includes(kind)) return '武学';
  if (['govern', 'trade'].includes(kind)) return '经营';
  if (['social', 'diplomacy'].includes(kind)) return '人物';
  if (['investigate', 'intrigue'].includes(kind)) return '谋略';
  if (kind === 'travel') return '行路';
  if (kind === 'rest') return '养息';
  return '局势';
}

function cloneDelta(delta) {
  return Object.keys(delta || {}).reduce((result, key) => {
    const value = Number(delta[key] || 0);
    if (!value) return result;
    result[key] = value;
    return result;
  }, {});
}

function ensureMemoryState(memory) {
  if (!memory || typeof memory !== 'object') return createMemoryState();
  memory.recentActions = ensureList(memory.recentActions);
  memory.dynamicChoiceHistory = ensureList(memory.dynamicChoiceHistory);
  memory.selectedDynamicChoiceHistory = ensureList(memory.selectedDynamicChoiceHistory);
  memory.summaries = ensureList(memory.summaries);
  const currentTurn = Math.max(0, Number(memory.currentTurn || 0));
  memory.openThreads = ensureList(memory.openThreads)
    .map((item) => normalizeThreadEntry(item, { currentTurn }))
    .filter((item) => item && item.title);
  memory.majorEvents = ensureList(memory.majorEvents);
  memory.turnLogs = ensureList(memory.turnLogs);
  memory.chapterMemories = ensureList(memory.chapterMemories);
  memory.retrievalFacts = ensureList(memory.retrievalFacts);
  memory.knowledgeGraph = memory.knowledgeGraph && typeof memory.knowledgeGraph === 'object'
    ? memory.knowledgeGraph
    : { nodes: [], edges: [], updatedAt: '' };
  if (!Array.isArray(memory.knowledgeGraph.nodes)) memory.knowledgeGraph.nodes = [];
  if (!Array.isArray(memory.knowledgeGraph.edges)) memory.knowledgeGraph.edges = [];
  if (!memory.lastStructuredLog || typeof memory.lastStructuredLog !== 'object') memory.lastStructuredLog = null;
  if (!memory.lastSelectedDynamicChoice || typeof memory.lastSelectedDynamicChoice !== 'object') memory.lastSelectedDynamicChoice = null;
  memory.lastPersistedLogKey = memory.lastPersistedLogKey || '';
  return memory;
}

function createMemoryState() {
  return ensureMemoryState({
    recentActions: [],
    dynamicChoiceHistory: [],
    selectedDynamicChoiceHistory: [],
    summaries: [],
    openThreads: [],
    majorEvents: [],
    turnLogs: [],
    chapterMemories: [],
    retrievalFacts: [],
    knowledgeGraph: {
      nodes: [],
      edges: [],
      updatedAt: ''
    },
    lastStructuredLog: null,
    lastSelectedDynamicChoice: null,
    lastPersistedLogKey: ''
  });
}

function recordDynamicChoiceSet(state, choices, meta = {}) {
  if (!state || typeof state !== 'object') return [];
  const memory = ensureMemoryState(state.memory);
  const turn = Number(state.world && state.world.turn || 0);
  const source = String(meta.source || '');
  const nextEntries = ensureList(choices)
    .filter((item) => item && item.text && item.actionText)
    .slice(0, 6)
    .map((item, index) => ({
      turn,
      id: String(item.id || ''),
      text: String(item.text || ''),
      actionText: String(item.actionText || ''),
      actionKind: String(item.actionKind || ''),
      slotRole: String(item.slotRole || ''),
      targetId: String(item.target || item.targetId || ''),
      targetName: String(item.targetName || ''),
      frontierId: String(item.frontierId || ''),
      noveltyKey: String(item.noveltyKey || ''),
      outcomes: ensureList(item.outcomes).map((entry) => String(entry || '')).filter(Boolean),
      source: source || String(item.source || ''),
      order: Number(item.order !== undefined ? item.order : index)
    }));
  const merged = nextEntries.concat(memory.dynamicChoiceHistory)
    .filter((item) => item && item.text && item.actionText)
    .filter((item, index, list) => list.findIndex((entry) => (
      entry.turn === item.turn
      && entry.slotRole === item.slotRole
      && entry.text === item.text
      && entry.actionText === item.actionText
    )) === index)
    .slice(0, 24);
  memory.dynamicChoiceHistory = merged;
  return merged;
}

function normalizeSelectedDynamicChoiceEntry(state, action, meta = {}) {
  const world = state && state.world ? state.world : {};
  const actionMeta = action && action.dynamicChoiceMeta && typeof action.dynamicChoiceMeta === 'object'
    ? action.dynamicChoiceMeta
    : {};
  const targetId = String(
    meta.targetId
    || actionMeta.targetId
    || actionMeta.target
    || action.target
    || ''
  ).trim();
  const targetName = String(
    meta.targetName
    || actionMeta.targetName
    || action.targetName
    || ''
  ).trim();
  const actionText = String(action && (action.raw || action.actionText || action.text) || '').trim();
  if (!actionText) return null;
  return {
    turn: Number(world.turn || 0),
    id: String(meta.choiceId || actionMeta.choiceId || action.id || '').trim(),
    text: String(meta.text || actionMeta.text || '').trim(),
    actionText,
    actionKind: String(meta.actionKind || actionMeta.actionKind || action.kind || '').trim(),
    slotRole: String(meta.slotRole || actionMeta.slotRole || '').trim(),
    targetId,
    targetName,
    frontierId: String(meta.frontierId || actionMeta.frontierId || '').trim(),
    noveltyKey: String(meta.noveltyKey || actionMeta.noveltyKey || '').trim(),
    outcomes: ensureList(meta.outcomes || actionMeta.outcomes).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6),
    effect: (meta.effect && typeof meta.effect === 'object') ? meta.effect : ((actionMeta.effect && typeof actionMeta.effect === 'object') ? actionMeta.effect : null),
    source: String(meta.source || actionMeta.source || action.source || '').trim() || 'dynamic',
    mode: String(meta.mode || actionMeta.mode || action.mode || '').trim(),
    order: Number(meta.order !== undefined ? meta.order : (actionMeta.order !== undefined ? actionMeta.order : -1)),
    selectedAt: new Date().toISOString()
  };
}

function recordSelectedDynamicChoice(state, action, meta = {}) {
  if (!state || typeof state !== 'object') return null;
  const memory = ensureMemoryState(state.memory);
  const entry = normalizeSelectedDynamicChoiceEntry(state, action, meta);
  if (!entry) return null;
  memory.lastSelectedDynamicChoice = entry;
  memory.selectedDynamicChoiceHistory = [entry]
    .concat(memory.selectedDynamicChoiceHistory)
    .filter((item) => item && item.actionText)
    .filter((item, index, list) => list.findIndex((candidate) => (
      candidate.turn === item.turn
      && candidate.actionText === item.actionText
      && candidate.slotRole === item.slotRole
    )) === index)
    .slice(0, 20);
  return entry;
}

function topRelations(state, limit) {
  return ensureList(state.gameState && state.gameState.relationships)
    .slice()
    .sort((a, b) => ((b.trust || 0) + (b.affection || 0) + (b.loyalty || 0)) - ((a.trust || 0) + (a.affection || 0) + (a.loyalty || 0)))
    .slice(0, limit || 3);
}

function topFactions(state, limit) {
  return [];
}

function buildKnowledgeGraph(state) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const nodes = [
    { id: 'player', type: 'player', label: gs.name || '无名之人' }
  ];
  const edges = [];

  if (world.currentCityId) {
    nodes.push({ id: `city:${world.currentCityId}`, type: 'city', label: world.currentCityName });
    edges.push({
      from: 'player',
      to: `city:${world.currentCityId}`,
      type: 'active_in',
      weight: 1,
      summary: `你眼下把局落在${world.currentCityName || '未知城池'}。`
    });
  }

  if (gs.sectId) {
    nodes.push({ id: `sect:${gs.sectId}`, type: 'sect', label: gs.sectName });
    edges.push({
      from: 'player',
      to: `sect:${gs.sectId}`,
      type: 'belongs_to',
      weight: Math.round(((gs.sectFavor || 0) + (gs.sectPower || 0)) / 2),
      summary: `你与${gs.sectName}的牵连仍在继续加深。`
    });
  }

  topRelations(state, 4).forEach((relation) => {
    nodes.push({ id: `person:${relation.id || relation.name}`, type: 'person', label: relation.name });
    edges.push({
      from: 'player',
      to: `person:${relation.id || relation.name}`,
      type: 'relation',
      weight: (relation.trust || 0) + (relation.affection || 0) + (relation.loyalty || 0),
      summary: `${relation.name}：信${relation.trust || 0}/情${relation.affection || 0}/义${relation.loyalty || 0}，${relation.status || '关系尚浅。'}`
    });
  });

  topFactions(state, 4).forEach((faction) => {
    nodes.push({ id: `faction:${faction.id}`, type: 'faction', label: faction.name });
    edges.push({
      from: 'player',
      to: `faction:${faction.id}`,
      type: faction.hostility >= faction.favor ? 'friction' : 'alignment',
      weight: Math.max(faction.hostility || 0, faction.favor || 0, faction.leverage || 0),
      summary: `${faction.name}：好感${faction.favor || 0}，敌意${faction.hostility || 0}，筹码${faction.leverage || 0}。`
    });
  });

  return {
    nodes,
    edges,
    updatedAt: new Date().toISOString()
  };
}

function buildRetrievalFacts(state) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const historical = gs.historical || {};
  const facts = [
    {
      key: 'profile',
      text: `主角名为${gs.name || '无名之人'}，性别${gs.genderLabel || '未知'}，今年${gs.age || 22}岁。`,
      tags: uniqueStrings(['profile', gs.name, gs.gender, gs.genderLabel])
    },
    {
      key: 'identity',
      text: `你当前身份是${gs.identity || '布衣'}，出身为${gs.backgroundLabel || '未定'}。`,
      tags: uniqueStrings(['identity', gs.backgroundId, gs.identity])
    },
    {
      key: 'clock',
      text: `当前是${world.dateLabel || '未定时节'}，第${world.turn || 0}回合，年纪约${gs.age || 22}岁。`,
      tags: ['clock']
    },
    {
      key: 'martial',
      text: `武学路数是${gs.martialRouteName || '乱世野修'}，当前志向偏向${gs.martialFocusName || '未定志向'}。`,
      tags: uniqueStrings(['martial', gs.martialRouteId, gs.martialFocusId])
    },
    {
      key: 'strategy',
      text: `经营谋略路线是${gs.strategyRouteName || '乱世求生'}。`,
      tags: uniqueStrings(['strategy', gs.strategyRouteId])
    }
  ];

  if (gs.sectId) {
    facts.push({
      key: 'sect',
      text: `你已归入${gs.sectName}，门中好感${gs.sectFavor || 0}，可借势力${gs.sectPower || 0}。`,
      tags: uniqueStrings(['sect', gs.sectId, gs.sectName])
    });
  }

  if (historical.lastEventTitle || historical.lastEventSummary) {
    facts.push({
      key: 'historical_event',
      text: `最近被推上台面的史势是${historical.lastEventTitle || '未定'}。${historical.lastEventSummary || ''}`,
      tags: uniqueStrings(['history', historical.lastEventId, historical.lastEventTitle])
    });
  }

  if (historical.lastNpcSummary) {
    facts.push({
      key: 'historical_people',
      text: `当前被牵动的历史人物：${historical.lastNpcSummary}`,
      tags: ['history', 'people']
    });
  }

  return facts.slice(0, 8);
}

function buildTags(state, action, outcome) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const locationHook = outcome && outcome.locationHook ? outcome.locationHook : '';
  const historical = gs.historical || {};
  return uniqueStrings([
    action.kind,
    domainOfAction(action.kind),
    world.currentCityId,
    world.currentCityName,
    world.currentRegion,
    gs.martialRouteId,
    gs.strategyRouteId,
    gs.martialFocusId,
    gs.sectId,
    historical.lastEventId,
    locationHook
  ]);
}

function eventImportance(action, outcome) {
  let score = 1;
  if (['battle', 'joinsect', 'travel', 'warpath', 'jianghu'].includes(action.kind)) score += 2;
  if (['great', 'fail'].includes(outcome.tier)) score += 1;
  if ((outcome.deltaLine || '').length > 24) score += 1;
  if (outcome.ending) score += 3;
  return score;
}

function buildTurnLog(state, action, outcome) {
  const gs = state.gameState || {};
  const topRelationList = topRelations(state, 2);
  const topFactionList = topFactions(state, 2);
  const delta = cloneDelta(outcome.delta || {});
  return {
    key: `turn_${state.world.turn || 0}_${action.kind}_${state.world.currentCityId || 'nowhere'}`,
    turn: state.world.turn || 0,
    dateLabel: state.world.dateLabel || '',
    locationId: state.world.currentCityId || '',
    location: state.world.currentCityName || '',
    action: {
      kind: action.kind,
      raw: action.raw || action.kind,
      target: action.target || '',
      targetName: action.targetName || ''
    },
    domain: domainOfAction(action.kind),
    tier: outcome.tier || 'mixed',
    importance: eventImportance(action, outcome),
    summary: outcome.summary || '',
    ruleSummary: outcome.changeSummary || gs.lastRuleSummary || '',
    deltaLine: outcome.deltaLine || gs.lastDeltaLine || '',
    delta,
    entities: {
      cityId: state.world.currentCityId || '',
      cityName: state.world.currentCityName || '',
      sectId: gs.sectId || '',
      sectName: gs.sectName || '',
      relationIds: topRelationList.map((item) => item.id || item.name),
      relationNames: topRelationList.map((item) => item.name),
      factionIds: topFactionList.map((item) => item.id),
      factionNames: topFactionList.map((item) => item.name)
    },
    tags: buildTags(state, action, outcome),
    narrativeSummary: outcome.summary || gs.lastResolutionSummary || ''
  };
}

function buildChapterMemory(logs) {
  if (!logs.length) return null;
  const oldest = logs[0];
  const newest = logs[logs.length - 1];
  const places = uniqueStrings(logs.map((item) => item.location)).slice(0, 3);
  const domains = uniqueStrings(logs.map((item) => item.domain)).slice(0, 3);
  return {
    key: `chapter_${newest.turn}`,
    turnRange: `${oldest.turn}-${newest.turn}`,
    title: `${oldest.dateLabel}至${newest.dateLabel}`,
    summary: `这一段里，你主要在${places.join('、') || '乱世各地'}之间推进${domains.join('、') || '局势'}，最近的收束点是：${newest.narrativeSummary}`,
    tags: uniqueStrings(logs.flatMap((item) => item.tags || [])).slice(0, 8)
  };
}

function recordStructuredTurn(state, action, outcome) {
  const memory = ensureMemoryState(state.memory);
  const log = buildTurnLog(state, action, outcome);
  memory.lastStructuredLog = log;
  memory.turnLogs = [log].concat(memory.turnLogs).slice(0, 60);
  state.gameState.adventureLog = [
    { turn: log.turn, dateLabel: log.dateLabel, entry: log.narrativeSummary, domain: log.domain, tier: log.tier }
  ].concat(ensureList(state.gameState.adventureLog)).slice(0, 40);

  if (log.importance >= 4) {
    memory.majorEvents = [
      {
        key: `major_${log.turn}_${action.kind}`,
        turn: log.turn,
        title: `${log.dateLabel} · ${log.location || '局中'}`,
        summary: log.narrativeSummary,
        domain: log.domain,
        tags: log.tags,
        entities: log.entities
      }
    ].concat(memory.majorEvents).slice(0, 20);
  }

  if ((log.turn || 0) % 5 === 0 || log.importance >= 5 || outcome.ending) {
    const chapter = buildChapterMemory(memory.turnLogs.slice(0, 5).slice().reverse());
    if (chapter) {
      memory.chapterMemories = [chapter].concat(memory.chapterMemories.filter((item) => item && item.key !== chapter.key)).slice(0, 12);
    }
  }

  memory.knowledgeGraph = buildKnowledgeGraph(state);
  memory.retrievalFacts = buildRetrievalFacts(state);
  memory.summaries = []
    .concat(memory.chapterMemories.slice(0, 2).map((item) => item.summary))
    .concat(memory.majorEvents.slice(0, 3).map((item) => item.summary))
    .slice(0, 6);

  return log;
}

function scoreRelevance(log, query) {
  let score = 0;
  if (!log) return score;
  const tags = ensureList(log.tags);
  const entities = log.entities || {};
  query.tags.forEach((tag) => {
    if (tags.includes(tag)) score += 4;
  });
  if (log.locationId && log.locationId === query.cityId) score += 5;
  if (ensureList(entities.factionIds).some((item) => query.factionIds.includes(item))) score += 3;
  if (ensureList(entities.relationIds).some((item) => query.relationIds.includes(item))) score += 2;
  return score + (log.importance || 0);
}

function buildGraphSummary(graph) {
  return ensureList(graph && graph.edges)
    .slice()
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, 4)
    .map((item) => item.summary)
    .join('；');
}

function buildRecallBundle(state, action) {
  const memory = ensureMemoryState(state.memory);
  const topRelationList = topRelations(state, 3);
  const topFactionList = topFactions(state, 3);
  const query = {
    cityId: state.world.currentCityId || '',
    relationIds: topRelationList.map((item) => item.id || item.name),
    factionIds: topFactionList.map((item) => item.id),
    tags: uniqueStrings([
      action.kind,
      domainOfAction(action.kind),
      state.world.currentRegion,
      state.gameState.martialFocusId,
      state.gameState.sectId
    ])
  };

  const recentLogs = memory.turnLogs.slice(0, 4);
  const recalledLogs = memory.turnLogs
    .slice(4)
    .map((item) => ({ item, score: scoreRelevance(item, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.item);

  const chapterMemories = memory.chapterMemories
    .map((item) => ({
      item,
      score: ensureList(item.tags).some((tag) => query.tags.includes(tag)) ? 4 : 1
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.item);

  const facts = memory.retrievalFacts
    .filter((item) => ensureList(item.tags).some((tag) => query.tags.includes(tag)) || item.key === 'clock' || item.key === 'identity')
    .slice(0, 6);

  return {
    recentText: recentLogs.map((item) => `第${item.turn}回合${item.location ? `@${item.location}` : ''}：${item.narrativeSummary}`).join('；'),
    recalledText: recalledLogs.map((item) => `第${item.turn}回合：${item.narrativeSummary}`).join('；'),
    chapterText: chapterMemories.map((item) => item.summary).join('；'),
    factText: facts.map((item) => item.text).join('；'),
    threadText: ensureList(memory.openThreads).slice(0, 4).map((item) => `${item.domain || '局势'}：${item.title}`).join('；'),
    graphText: buildGraphSummary(memory.knowledgeGraph)
  };
}

module.exports = {
  createMemoryState,
  ensureMemoryState,
  normalizeThreadEntry,
  domainOfAction,
  recordStructuredTurn,
  buildRecallBundle,
  recordDynamicChoiceSet,
  recordSelectedDynamicChoice
};
