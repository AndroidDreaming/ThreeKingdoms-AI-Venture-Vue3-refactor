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

function clampPercent(value, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next)) return Math.max(0, Math.min(100, Number(fallback || 0)));
  return Math.max(0, Math.min(100, Math.round(next)));
}

function createEmptyDramaticLayer() {
  return {
    activeQuestion: '',
    latestScenePlan: {
      surfaceGoal: '',
      obstacle: '',
      turnPoint: '',
      emotionalShift: '',
      closingBeat: '',
      tone: '',
      pace: ''
    },
    sceneResidue: [],
    softState: {
      actor: {
        pressure: 0,
        desire: 0,
        composure: 0
      },
      relations: {},
      factions: {}
    },
    lastMeta: {
      turn: 0,
      source: '',
      actionKind: '',
      actionMode: '',
      summary: ''
    }
  };
}

function ensureDramaticLayer(gameState) {
  if (!gameState || typeof gameState !== 'object') return createEmptyDramaticLayer();
  const base = gameState.dramaticLayer && typeof gameState.dramaticLayer === 'object'
    ? gameState.dramaticLayer
    : {};
  const merged = createEmptyDramaticLayer();
  merged.activeQuestion = normalizeSnippet(base.activeQuestion || '');
  merged.latestScenePlan = Object.assign({}, merged.latestScenePlan, base.latestScenePlan || {});
  Object.keys(merged.latestScenePlan).forEach((key) => {
    merged.latestScenePlan[key] = normalizeSnippet(merged.latestScenePlan[key] || '');
  });
  merged.sceneResidue = ensureList(base.sceneResidue).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 8);
  const softState = base.softState && typeof base.softState === 'object' ? base.softState : {};
  const actor = softState.actor && typeof softState.actor === 'object' ? softState.actor : {};
  merged.softState.actor = {
    pressure: clampPercent(actor.pressure, 0),
    desire: clampPercent(actor.desire, 0),
    composure: clampPercent(actor.composure, 0)
  };
  merged.softState.relations = softState.relations && typeof softState.relations === 'object' ? softState.relations : {};
  merged.softState.factions = softState.factions && typeof softState.factions === 'object' ? softState.factions : {};
  merged.lastMeta = Object.assign({}, merged.lastMeta, base.lastMeta || {});
  merged.lastMeta.turn = Number(merged.lastMeta.turn || 0);
  merged.lastMeta.source = normalizeSnippet(merged.lastMeta.source || '');
  merged.lastMeta.actionKind = normalizeSnippet(merged.lastMeta.actionKind || '');
  merged.lastMeta.actionMode = normalizeSnippet(merged.lastMeta.actionMode || '');
  merged.lastMeta.summary = normalizeSnippet(merged.lastMeta.summary || '');
  gameState.dramaticLayer = merged;
  return merged;
}

function normalizeScenePlan(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    surfaceGoal: normalizeSnippet(source.surfaceGoal || source.goal || ''),
    obstacle: normalizeSnippet(source.obstacle || source.block || ''),
    turnPoint: normalizeSnippet(source.turnPoint || source.pivot || ''),
    emotionalShift: normalizeSnippet(source.emotionalShift || source.shift || ''),
    closingBeat: normalizeSnippet(source.closingBeat || source.endingBeat || source.residue || ''),
    tone: normalizeSnippet(source.tone || ''),
    pace: normalizeSnippet(source.pace || '')
  };
}

function resolveRelationIdByName(gameState, targetName) {
  const text = normalizeSnippet(targetName, '');
  if (!text) return '';
  const list = ensureList(gameState && gameState.relationships);
  const matched = list.find((item) => item && item.name === text);
  return matched && matched.id ? matched.id : '';
}

function resolveFactionIdByName(gameState, targetName) {
  const text = normalizeSnippet(targetName, '');
  if (!text) return '';
  const list = ensureList(gameState && gameState.factions);
  const matched = list.find((item) => item && item.name === text);
  return matched && matched.id ? matched.id : '';
}

function normalizeRelationSoftEntry(gameState, entry) {
  if (!entry || typeof entry !== 'object') return null;
  const targetName = normalizeSnippet(entry.targetName || entry.name || '');
  const targetId = normalizeSnippet(entry.targetId || '', '') || resolveRelationIdByName(gameState, targetName);
  if (!targetId && !targetName) return null;
  return {
    targetId,
    targetName,
    guardedness: clampPercent(entry.guardedness, 0),
    curiosity: clampPercent(entry.curiosity, 0),
    warmth: clampPercent(entry.warmth, 0),
    tension: clampPercent(entry.tension, 0),
    respect: clampPercent(entry.respect, 0),
    note: normalizeSnippet(entry.note || '')
  };
}

function normalizeFactionSoftEntry(gameState, entry) {
  if (!entry || typeof entry !== 'object') return null;
  const targetName = normalizeSnippet(entry.targetName || entry.name || '');
  const targetId = normalizeSnippet(entry.targetId || '', '') || resolveFactionIdByName(gameState, targetName);
  if (!targetId && !targetName) return null;
  return {
    targetId,
    targetName,
    watchfulness: clampPercent(entry.watchfulness, 0),
    respect: clampPercent(entry.respect, 0),
    hostility: clampPercent(entry.hostility, 0),
    leverageFear: clampPercent(entry.leverageFear, 0),
    note: normalizeSnippet(entry.note || '')
  };
}

function mergeSoftStateMap(baseMap, entries, idKey = 'targetId') {
  const next = Object.assign({}, baseMap || {});
  ensureList(entries).forEach((entry) => {
    if (!entry) return;
    const key = normalizeSnippet(entry[idKey] || entry.targetName || '');
    if (!key) return;
    const previous = next[key] && typeof next[key] === 'object' ? next[key] : {};
    next[key] = Object.assign({}, previous, entry);
  });
  return next;
}

function normalizeDramaticMeta(gameState, meta) {
  if (!meta || typeof meta !== 'object') return null;
  const residues = ensureList(meta.sceneResidue || meta.residues || meta.residue)
    .map((item) => normalizeSnippet(item, ''))
    .filter(Boolean)
    .slice(0, 6);
  const softPatch = meta.softStatePatch && typeof meta.softStatePatch === 'object' ? meta.softStatePatch : {};
  return {
    dramaticQuestion: normalizeSnippet(meta.dramaticQuestion || meta.question || ''),
    scenePlan: normalizeScenePlan(meta.scenePlan || meta.plan || {}),
    sceneResidue: residues,
    summary: normalizeSnippet(meta.summary || ''),
    softStatePatch: {
      actor: {
        pressure: clampPercent(softPatch.actor && softPatch.actor.pressure, 0),
        desire: clampPercent(softPatch.actor && softPatch.actor.desire, 0),
        composure: clampPercent(softPatch.actor && softPatch.actor.composure, 0)
      },
      relations: ensureList(softPatch.relations).map((entry) => normalizeRelationSoftEntry(gameState, entry)).filter(Boolean).slice(0, 6),
      factions: ensureList(softPatch.factions).map((entry) => normalizeFactionSoftEntry(gameState, entry)).filter(Boolean).slice(0, 6)
    }
  };
}

function summarizeSoftMap(map, limit = 4) {
  return Object.keys(map || {})
    .slice(0, limit)
    .map((key) => map[key])
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const copy = Object.assign({}, item);
      Object.keys(copy).forEach((field) => {
        if (typeof copy[field] === 'string') copy[field] = normalizeSnippet(copy[field], '');
      });
      return copy;
    });
}

function summarizeDramaticLayerForPrompt(gameState) {
  const layer = ensureDramaticLayer(gameState || {});
  return {
    activeQuestion: layer.activeQuestion,
    latestScenePlan: Object.assign({}, layer.latestScenePlan),
    sceneResidue: ensureList(layer.sceneResidue).slice(0, 6),
    softState: {
      actor: Object.assign({}, layer.softState.actor),
      relations: summarizeSoftMap(layer.softState.relations, 4),
      factions: summarizeSoftMap(layer.softState.factions, 4)
    },
    lastMeta: Object.assign({}, layer.lastMeta)
  };
}

function applyDramaticMeta(gameState, meta, context = {}) {
  const layer = ensureDramaticLayer(gameState);
  const normalized = normalizeDramaticMeta(gameState, meta);
  if (!normalized) return layer;

  if (normalized.dramaticQuestion) layer.activeQuestion = normalized.dramaticQuestion;
  layer.latestScenePlan = Object.assign({}, layer.latestScenePlan, normalized.scenePlan);
  if (normalized.sceneResidue.length) {
    layer.sceneResidue = normalized.sceneResidue.concat(layer.sceneResidue)
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, 8);
  }
  layer.softState.actor = Object.assign({}, layer.softState.actor, normalized.softStatePatch.actor || {});
  layer.softState.relations = mergeSoftStateMap(layer.softState.relations, normalized.softStatePatch.relations);
  layer.softState.factions = mergeSoftStateMap(layer.softState.factions, normalized.softStatePatch.factions);
  layer.lastMeta = {
    turn: Number(context.turn || 0),
    source: normalizeSnippet(context.source || ''),
    actionKind: normalizeSnippet(context.actionKind || ''),
    actionMode: normalizeSnippet(context.actionMode || ''),
    summary: normalized.summary || normalizeSnippet(context.summary || '')
  };
  gameState.dramaticLayer = layer;
  return layer;
}

module.exports = {
  createEmptyDramaticLayer,
  ensureDramaticLayer,
  summarizeDramaticLayerForPrompt,
  normalizeDramaticMeta,
  applyDramaticMeta
};
