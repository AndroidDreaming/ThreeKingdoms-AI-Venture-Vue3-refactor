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

function clamp(value, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function createEmptySoftState() {
  return {
    promiseDebt: [],
    moralDebt: [],
    factionWatch: [],
    rumorHeat: [],
    unfinishedMoves: [],
    personalMomentum: [],
    sceneResidues: [],
    recentShockTags: [],
    lastConsequences: []
  };
}

function normalizeDebtEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const label = normalizeSnippet(entry.label || entry.note || '');
  if (!label) return null;
  return {
    id: normalizeSnippet(entry.id || label),
    label,
    targetId: normalizeSnippet(entry.targetId || ''),
    targetName: normalizeSnippet(entry.targetName || ''),
    value: clamp(entry.value, 0, 100),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0))
  };
}

function normalizeHeatEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const label = normalizeSnippet(entry.label || '');
  if (!label) return null;
  return {
    id: normalizeSnippet(entry.id || label),
    label,
    cityId: normalizeSnippet(entry.cityId || ''),
    cityName: normalizeSnippet(entry.cityName || ''),
    value: clamp(entry.value, 0, 100),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0))
  };
}

function normalizeWatchEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const targetName = normalizeSnippet(entry.targetName || entry.label || '');
  const targetId = normalizeSnippet(entry.targetId || '');
  if (!targetName && !targetId) return null;
  return {
    id: normalizeSnippet(entry.id || targetId || targetName),
    targetId,
    targetName,
    value: clamp(entry.value, 0, 100),
    note: normalizeSnippet(entry.note || ''),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0))
  };
}

function normalizeMomentumEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const domain = normalizeSnippet(entry.domain || '');
  if (!domain) return null;
  return {
    domain,
    value: clamp(entry.value, -100, 100),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0)),
    note: normalizeSnippet(entry.note || '')
  };
}

function normalizeUnfinishedMove(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const label = normalizeSnippet(entry.label || entry.title || '');
  if (!label) return null;
  return {
    id: normalizeSnippet(entry.id || label),
    label,
    actionKind: normalizeSnippet(entry.actionKind || ''),
    targetId: normalizeSnippet(entry.targetId || ''),
    targetName: normalizeSnippet(entry.targetName || ''),
    urgency: clamp(entry.urgency, 1, 3),
    heat: clamp(entry.heat, 0, 100),
    deadlineTurn: Math.max(0, Number(entry.deadlineTurn || 0)),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0))
  };
}

function normalizeResidueEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const label = normalizeSnippet(entry.label || entry.text || '');
  if (!label) return null;
  return {
    id: normalizeSnippet(entry.id || label),
    label,
    domain: normalizeSnippet(entry.domain || ''),
    heat: clamp(entry.heat, 0, 100),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0))
  };
}

function normalizeShockTag(value) {
  const tag = normalizeSnippet(value || '');
  return tag || '';
}

function normalizeConsequenceEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const text = normalizeSnippet(entry.text || entry.summary || '');
  if (!text) return null;
  return {
    type: normalizeSnippet(entry.type || 'scene'),
    text,
    intensity: clamp(entry.intensity, 0, 100),
    sourceTurn: Math.max(0, Number(entry.sourceTurn || 0))
  };
}

function ensureSoftState(gameState) {
  if (!gameState || typeof gameState !== 'object') return createEmptySoftState();
  const base = gameState.softState && typeof gameState.softState === 'object'
    ? gameState.softState
    : {};
  const next = createEmptySoftState();
  next.promiseDebt = ensureList(base.promiseDebt).map(normalizeDebtEntry).filter(Boolean).slice(0, 8);
  next.moralDebt = ensureList(base.moralDebt).map(normalizeDebtEntry).filter(Boolean).slice(0, 8);
  next.factionWatch = ensureList(base.factionWatch).map(normalizeWatchEntry).filter(Boolean).slice(0, 8);
  next.rumorHeat = ensureList(base.rumorHeat).map(normalizeHeatEntry).filter(Boolean).slice(0, 8);
  next.unfinishedMoves = ensureList(base.unfinishedMoves).map(normalizeUnfinishedMove).filter(Boolean).slice(0, 8);
  next.personalMomentum = ensureList(base.personalMomentum).map(normalizeMomentumEntry).filter(Boolean).slice(0, 8);
  next.sceneResidues = ensureList(base.sceneResidues).map(normalizeResidueEntry).filter(Boolean).slice(0, 8);
  next.recentShockTags = ensureList(base.recentShockTags).map(normalizeShockTag).filter(Boolean).slice(0, 8);
  next.lastConsequences = ensureList(base.lastConsequences).map(normalizeConsequenceEntry).filter(Boolean).slice(0, 8);
  gameState.softState = next;
  return next;
}

function mergeMaxById(list, entry, normalizer) {
  const normalized = normalizer(entry);
  if (!normalized) return ensureList(list);
  const existing = ensureList(list);
  const found = existing.find((item) => item && item.id === normalized.id);
  if (found) {
    found.value = Math.max(Number(found.value || 0), Number(normalized.value || 0));
    found.sourceTurn = Math.max(Number(found.sourceTurn || 0), Number(normalized.sourceTurn || 0));
    if (normalized.note) found.note = normalized.note;
    if (normalized.label) found.label = normalized.label;
    if (normalized.targetName) found.targetName = normalized.targetName;
    return existing;
  }
  return [normalized].concat(existing);
}

function mergeLatestById(list, entry, normalizer) {
  const normalized = normalizer(entry);
  if (!normalized) return ensureList(list);
  const filtered = ensureList(list).filter((item) => item && item.id !== normalized.id);
  return [normalized].concat(filtered);
}

function updateMomentum(list, domain, deltaValue, sourceTurn, note = '') {
  const normalizedDomain = normalizeSnippet(domain || '');
  if (!normalizedDomain || !deltaValue) return ensureList(list);
  const existing = ensureList(list);
  const found = existing.find((item) => item && item.domain === normalizedDomain);
  if (found) {
    found.value = clamp(Number(found.value || 0) + Number(deltaValue || 0), -100, 100);
    found.sourceTurn = Math.max(Number(found.sourceTurn || 0), Number(sourceTurn || 0));
    if (note) found.note = note;
    return existing;
  }
  return [{
    domain: normalizedDomain,
    value: clamp(deltaValue, -100, 100),
    sourceTurn: Math.max(0, Number(sourceTurn || 0)),
    note: normalizeSnippet(note || '')
  }].concat(existing);
}

function applyConsequencesToSoftState(gameState, ledger) {
  const softState = ensureSoftState(gameState);
  const turn = Number(ledger && ledger.turn || 0);

  ensureList(ledger && ledger.promiseDebt).forEach((item) => {
    softState.promiseDebt = mergeLatestById(softState.promiseDebt, Object.assign({}, item, { sourceTurn: turn }), normalizeDebtEntry).slice(0, 8);
  });
  ensureList(ledger && ledger.moralDebt).forEach((item) => {
    softState.moralDebt = mergeLatestById(softState.moralDebt, Object.assign({}, item, { sourceTurn: turn }), normalizeDebtEntry).slice(0, 8);
  });
  ensureList(ledger && ledger.factionWatch).forEach((item) => {
    softState.factionWatch = mergeMaxById(softState.factionWatch, Object.assign({}, item, { sourceTurn: turn }), normalizeWatchEntry).slice(0, 8);
  });
  ensureList(ledger && ledger.rumorHeat).forEach((item) => {
    softState.rumorHeat = mergeMaxById(softState.rumorHeat, Object.assign({}, item, { sourceTurn: turn }), normalizeHeatEntry).slice(0, 8);
  });
  ensureList(ledger && ledger.unfinishedMoves).forEach((item) => {
    softState.unfinishedMoves = mergeLatestById(softState.unfinishedMoves, Object.assign({}, item, { sourceTurn: turn }), normalizeUnfinishedMove).slice(0, 8);
  });
  ensureList(ledger && ledger.sceneResidues).forEach((item) => {
    softState.sceneResidues = mergeLatestById(softState.sceneResidues, Object.assign({}, item, { sourceTurn: turn }), normalizeResidueEntry).slice(0, 8);
  });
  ensureList(ledger && ledger.recentShockTags).forEach((item) => {
    const normalized = normalizeShockTag(item);
    if (!normalized) return;
    softState.recentShockTags = [normalized].concat(softState.recentShockTags.filter((tag) => tag !== normalized)).slice(0, 8);
  });
  ensureList(ledger && ledger.personalMomentum).forEach((item) => {
    softState.personalMomentum = updateMomentum(
      softState.personalMomentum,
      item && item.domain,
      Number(item && item.value || 0),
      turn,
      item && item.note
    ).slice(0, 8);
  });
  softState.lastConsequences = ensureList(ledger && ledger.consequences)
    .map((item) => normalizeConsequenceEntry(Object.assign({}, item, { sourceTurn: turn })))
    .filter(Boolean)
    .slice(0, 8);

  gameState.softState = softState;
  return softState;
}

function summarizeSoftStateForContext(gameState) {
  const softState = ensureSoftState(gameState || {});
  return {
    promiseDebt: softState.promiseDebt.slice(0, 3),
    moralDebt: softState.moralDebt.slice(0, 3),
    factionWatch: softState.factionWatch.slice(0, 3),
    rumorHeat: softState.rumorHeat.slice(0, 3),
    unfinishedMoves: softState.unfinishedMoves.slice(0, 3),
    personalMomentum: softState.personalMomentum.slice(0, 4),
    sceneResidues: softState.sceneResidues.slice(0, 3),
    recentShockTags: softState.recentShockTags.slice(0, 4),
    lastConsequences: softState.lastConsequences.slice(0, 4)
  };
}

module.exports = {
  createEmptySoftState,
  ensureSoftState,
  applyConsequencesToSoftState,
  summarizeSoftStateForContext
};
