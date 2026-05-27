const { domainOfAction } = require('./chronicleV5Memory');

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

function cloneDelta(delta) {
  return Object.keys(delta || {}).reduce((result, key) => {
    const value = Number(delta[key] || 0);
    if (!value) return result;
    result[key] = value;
    return result;
  }, {});
}

function topDeltaKeys(delta, limit = 4) {
  return Object.keys(delta || {})
    .map((key) => ({ key, value: Number(delta[key] || 0) }))
    .filter((item) => item.value)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, limit);
}

function buildResourceConsequence(deltaItem) {
  const key = String(deltaItem && deltaItem.key || '');
  const value = Number(deltaItem && deltaItem.value || 0);
  const labelMap = {
    coins: '钱财',
    supplies: '粮秣',
    morale: '士气',
    health: '伤势',
    fatigue: '疲惫',
    troops: '部曲',
    renown: '名望',
    influence: '影响',
    military: '军务',
    governance: '内政',
    commerce: '经营',
    diplomacy: '交际',
    martialLevel: '武艺',
    strategyLevel: '谋略'
  };
  if (!key || !value) return null;
  const label = labelMap[key] || key;
  return {
    type: 'resource',
    text: value > 0 ? `${label}明显被推高了` : `${label}被这一手压薄了`,
    intensity: clamp(Math.abs(value) * 8, 8, 92)
  };
}

function buildOutcomeConsequences(state, action, outcome, delta) {
  const consequences = [];
  const summary = normalizeSnippet(outcome && outcome.summary || '');
  const changeSummary = normalizeSnippet(outcome && outcome.changeSummary || '');
  const relationLine = normalizeSnippet(outcome && outcome.relationLine || '');
  if (summary) consequences.push({ type: 'scene', text: summary, intensity: 80 });
  if (changeSummary && !summary.includes(changeSummary)) consequences.push({ type: 'change', text: changeSummary, intensity: 70 });
  if (relationLine) consequences.push({ type: 'human', text: relationLine, intensity: 68 });
  topDeltaKeys(delta, 4).forEach((item) => {
    const built = buildResourceConsequence(item);
    if (built) consequences.push(built);
  });
  return consequences.slice(0, 8);
}

function buildPromiseDebt(state, action, outcome) {
  const text = `${normalizeSnippet(action && action.raw || action && action.actionText || action && action.text || '')} ${normalizeSnippet(outcome && outcome.summary || '')}`;
  if (!/(答应|许诺|应下|担保|替.*出头|请托|托付)/.test(text)) return [];
  return [{
    id: `promise:${normalizeSnippet(action && action.target || action && action.targetName || action && action.kind || 'turn')}`,
    label: '这回应下的事还等着兑现',
    targetId: normalizeSnippet(action && action.target || ''),
    targetName: normalizeSnippet(action && action.targetName || ''),
    value: 58
  }];
}

function buildMoralDebt(state, action, outcome) {
  const text = `${normalizeSnippet(action && action.raw || action && action.actionText || action && action.text || '')} ${normalizeSnippet(outcome && outcome.summary || '')}`;
  if (!/(骗|诈|借刀|牺牲|出卖|压人情|拿.*换|逼.*失手|连累)/.test(text)) return [];
  return [{
    id: `moral:${normalizeSnippet(action && action.kind || 'turn')}:${normalizeSnippet(action && action.target || action && action.targetName || '')}`,
    label: '这一步带着洗不干净的人情账',
    targetId: normalizeSnippet(action && action.target || ''),
    targetName: normalizeSnippet(action && action.targetName || ''),
    value: 64
  }];
}

function buildFactionWatch(state, action, outcome) {
  return [];
  const factions = ensureList(state && state.gameState && state.gameState.factions)
    .slice()
    .sort((a, b) => Math.max(Number(b.hostility || 0), Number(b.leverage || 0), Number(b.power || 0)) - Math.max(Number(a.hostility || 0), Number(a.leverage || 0), Number(a.power || 0)))
    .slice(0, 2);
  const text = normalizeSnippet(outcome && outcome.summary || '');
  return factions.map((item, index) => ({
    id: `watch:${item.id || item.name || index}`,
    targetId: normalizeSnippet(item.id || ''),
    targetName: normalizeSnippet(item.name || ''),
    value: clamp(Math.max(Number(item.hostility || 0), Number(item.leverage || 0)) + (text.includes(item.name || '') ? 12 : 0), 12, 95),
    note: '这一手已经开始被人盯上'
  }));
}

function buildRumorHeat(state, action, outcome) {
  const cityId = normalizeSnippet(state && state.world && state.world.currentCityId || '');
  const cityName = normalizeSnippet(state && state.world && state.world.currentCityName || '');
  const lines = [];
  const summary = normalizeSnippet(outcome && outcome.summary || '');
  const eventTag = normalizeSnippet(state && state.gameState && state.gameState.lastEventTag || '');
  if (summary) {
    lines.push({
      id: `rumor:${cityId || cityName}:turn`,
      label: eventTag || '这一手的风声还在发热',
      cityId,
      cityName,
      value: /(great|good)/.test(normalizeSnippet(outcome && outcome.tier || '')) ? 62 : 48
    });
  }
  return lines.slice(0, 2);
}

function buildUnfinishedMoves(state, action, outcome) {
  const targetName = normalizeSnippet(action && action.targetName || '');
  const raw = normalizeSnippet(action && (action.raw || action.actionText || action.text) || '');
  if (!raw && !targetName) return [];
  return [{
    id: `unfinished:${normalizeSnippet(action && action.kind || 'turn')}:${normalizeSnippet(action && action.target || targetName || raw)}`,
    label: targetName ? `${targetName}这条线还没收口` : '这一手刚撬开的口子还没收口',
    actionKind: normalizeSnippet(action && action.kind || ''),
    targetId: normalizeSnippet(action && action.target || ''),
    targetName,
    urgency: /(fail|mixed)/.test(normalizeSnippet(outcome && outcome.tier || '')) ? 2 : 3,
    heat: /(great|good)/.test(normalizeSnippet(outcome && outcome.tier || '')) ? 74 : 56,
    deadlineTurn: Math.max(0, Number(state && state.world && state.world.turn || 0) + 2)
  }];
}

function buildPersonalMomentum(state, action, outcome, delta) {
  const actionKind = normalizeSnippet(action && action.kind || '');
  const domain = domainOfAction(actionKind);
  let value = 0;
  if (/(great)/.test(normalizeSnippet(outcome && outcome.tier || ''))) value += 18;
  else if (/(good)/.test(normalizeSnippet(outcome && outcome.tier || ''))) value += 12;
  else if (/(mixed)/.test(normalizeSnippet(outcome && outcome.tier || ''))) value += 4;
  else value -= 10;
  value += topDeltaKeys(delta, 2).reduce((sum, item) => sum + Math.sign(Number(item.value || 0)) * 2, 0);
  return [{
    domain,
    value,
    note: '这一回的走势会继续影响后面两三手'
  }];
}

function buildSceneResidues(state, action, outcome) {
  const eventTag = normalizeSnippet(state && state.gameState && state.gameState.lastEventTag || '');
  const domain = domainOfAction(action && action.kind || '');
  const summary = normalizeSnippet(outcome && outcome.summary || '');
  const relationLine = normalizeSnippet(outcome && outcome.relationLine || '');
  const items = [];
  if (eventTag) {
    items.push({
      id: `residue:event:${eventTag}`,
      label: eventTag,
      domain,
      heat: 70
    });
  }
  if (relationLine) {
    items.push({
      id: `residue:relation:${normalizeSnippet(action && action.targetName || action && action.target || 'turn')}`,
      label: relationLine,
      domain: '人物',
      heat: 64
    });
  } else if (summary) {
    items.push({
      id: `residue:summary:${normalizeSnippet(action && action.kind || 'turn')}`,
      label: summary.slice(0, 42),
      domain,
      heat: 58
    });
  }
  return items.slice(0, 3);
}

function buildRecentShockTags(state, action, outcome, delta) {
  const tags = [];
  const kind = normalizeSnippet(action && action.kind || '');
  if (/(battle|military|warpath)/.test(kind)) tags.push('military_pressure');
  if (/(investigate|intrigue)/.test(kind)) tags.push('hidden_tension');
  if (/(social|diplomacy|romance)/.test(kind)) tags.push('human_pressure');
  if (Number(delta && delta.fatigue || 0) >= 4 || Number(delta && delta.health || 0) <= -3) tags.push('body_cost');
  if (/(fail)/.test(normalizeSnippet(outcome && outcome.tier || ''))) tags.push('failed_push');
  if (/(great)/.test(normalizeSnippet(outcome && outcome.tier || ''))) tags.push('strong_turn');
  return tags.slice(0, 4);
}

function buildTurnConsequenceLedger(state, action, outcome) {
  const delta = cloneDelta(outcome && outcome.delta || {});
  const ledger = {
    turn: Number(state && state.world && state.world.turn || 0),
    action: {
      kind: normalizeSnippet(action && action.kind || ''),
      mode: normalizeSnippet(action && action.mode || ''),
      text: normalizeSnippet(action && (action.raw || action.actionText || action.text) || ''),
      targetId: normalizeSnippet(action && action.target || ''),
      targetName: normalizeSnippet(action && action.targetName || '')
    },
    resolved: {
      tier: normalizeSnippet(outcome && outcome.tier || ''),
      summary: normalizeSnippet(outcome && outcome.summary || ''),
      changeSummary: normalizeSnippet(outcome && outcome.changeSummary || ''),
      relationLine: normalizeSnippet(outcome && outcome.relationLine || ''),
      locationHook: normalizeSnippet(outcome && outcome.locationHook || '')
    },
    hardDelta: delta,
    consequences: buildOutcomeConsequences(state, action, outcome, delta),
    promiseDebt: buildPromiseDebt(state, action, outcome),
    moralDebt: buildMoralDebt(state, action, outcome),
    factionWatch: buildFactionWatch(state, action, outcome),
    rumorHeat: buildRumorHeat(state, action, outcome),
    unfinishedMoves: buildUnfinishedMoves(state, action, outcome),
    personalMomentum: buildPersonalMomentum(state, action, outcome, delta),
    sceneResidues: buildSceneResidues(state, action, outcome),
    recentShockTags: buildRecentShockTags(state, action, outcome, delta)
  };
  return ledger;
}

module.exports = {
  buildTurnConsequenceLedger
};
