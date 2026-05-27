const { buildHistoricalNarrativeBundle } = require('./chronicleV5HistoricalEventManager');
const { buildEncounterNarrativeBundle, ensureEncounterState } = require('./chronicleV5EncounterSystem');
const { buildPromptDirectorLines } = require('./chronicleV5PromptDirectives');
const { buildDynamicPlanningBundle } = require('./chronicleV5DynamicPlanning');
const { summarizeRetinueForPrompt } = require('./chronicleV5RetinueSystem');
const { ensureDramaticLayer, summarizeDramaticLayerForPrompt } = require('./chronicleV5DramaticLayer');
const { isRelationMet } = require('./chronicleV5RelationVisibility');
const { summarizeWorldFermentationForPrompt } = require('./chronicleV5WorldFermentation');
const { summarizeWorldPerceptionForPrompt } = require('./chronicleV5WorldPerception');

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

function stripNarrationDeltaLeakage(value) {
  return normalizeSnippet(value, '')
    .replace(/数值变动[:：][^。！？]*[。！？]?/g, '')
    .replace(/(?:细数|盘算|想着|记着)?[^。！？]*(?:数值|属性|面板)[^。！？]*[。！？]?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildPromptLocalResolution(outcome, lastRetinueFeedback, mode = 'narration') {
  const summary = stripNarrationDeltaLeakage(outcome && outcome.summary || '');
  const payload = {
    tier: outcome && outcome.tier ? outcome.tier : '',
    summary,
    changeSummary: '',
    deltaLine: ''
  };
  if (mode === 'choice') {
    payload.changeSummary = normalizeSnippet(outcome && outcome.changeSummary || '');
    payload.deltaLine = normalizeSnippet(outcome && outcome.deltaLine || '');
  }
  if (lastRetinueFeedback) {
    payload.retinueFeedback = {
      actionType: lastRetinueFeedback.actionType,
      actionText: lastRetinueFeedback.actionText,
      summaryLine: lastRetinueFeedback.summaryLine,
      summaryTags: lastRetinueFeedback.summaryTags
    };
  }
  return payload;
}

function isRetinueFocusedAction(action) {
  const mode = normalizeSnippet(action && action.mode || '');
  if (mode.startsWith('team_') || mode.startsWith('appoint_')) return true;
  return ['recruit', 'recruit_probe', 'retinue_talk', 'retinue_counsel', 'retinue_companion'].includes(mode);
}

function buildNarrationTask(action, lastRetinueFeedback, retinue) {
  const hasAssignments = Number(retinue && retinue.assignedCount || 0) > 0;
  const companionName = normalizeSnippet(retinue && retinue.companion && retinue.companion.name || '');
  if (lastRetinueFeedback && isRetinueFocusedAction(action)) {
    return '把队伍协同写成具体分工、场面回响与收益来处，但默认通过幕后献策、递消息、压后手和补位来呈现，不要把已任命成员写成无关闲聊或持续抢戏的对话中心。';
  }
  if (companionName) {
    return `把本回已裁定的得失、阻力与局势余波写成现场过程，并让同行的${companionName}顺着眼前事务自然给出一两次判断、提醒、动作或补位；不要让他空转成闲聊，也不要整段抢戏。`;
  }
  if (hasAssignments) {
    return '把本回已经裁定的阻力、得失、人物反应与局势余波真正写成过程，不要只报结果。若幕下已有任命，默认只需让相关人手递上一两句判断、提醒、风声或回报，不要把他们写成无端插话的长段对话。';
  }
  return '把本回已经裁定的阻力、得失、人物反应与局势余波真正写成过程，不要只报结果。';
}

function looksLikeInternalEntityId(value) {
  return /^(?:extra|npc|relation|faction|sect|city)_[\w-]+$/i.test(String(value || '').trim());
}

function resolveActionTargetName(state, action) {
  const direct = normalizeSnippet(action && action.targetName || '');
  if (direct && !looksLikeInternalEntityId(direct)) return direct;

  const targetId = String(action && action.target || '').trim();
  if (!targetId) return '';

  const relations = ensureList(state && state.gameState && state.gameState.relationships);
  const relation = relations.find((item) => item && item.id === targetId);
  if (relation && relation.name) return normalizeSnippet(relation.name);

  const factions = ensureList(state && state.gameState && state.gameState.factions);
  const faction = factions.find((item) => item && item.id === targetId);
  if (faction && faction.name) return normalizeSnippet(faction.name);

  const routes = ensureList(state && state.world && state.world.map && state.world.map.routes);
  const route = routes.find((item) => item && item.cityId === targetId);
  if (route && route.cityName) return normalizeSnippet(route.cityName);

  if (state && state.world && state.world.currentCityId === targetId) {
    return normalizeSnippet(state.world.currentCityName || '');
  }

  return '';
}

function resolveEntityDisplayName(state, targetId, targetName) {
  const direct = normalizeSnippet(targetName, '');
  if (direct && !looksLikeInternalEntityId(direct)) return direct;
  return resolveActionTargetName(state, { target: targetId, targetName: direct });
}

function escapeRegexText(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fallbackEntityLabel(entityId) {
  const id = String(entityId || '').trim();
  if (/^city_/i.test(id)) return '此地';
  if (/^(?:faction|sect)_/i.test(id)) return '此方';
  return '此人';
}

function scrubInternalEntityIds(value, state, preferredName = '') {
  let text = normalizeSnippet(value, '');
  if (!text) return '';
  const matches = text.match(/(?:extra|npc|relation|faction|sect|city)_[\w-]+/gi) || [];
  ensureList(matches).forEach((entityId) => {
    const replacement = resolveEntityDisplayName(state, entityId, preferredName) || fallbackEntityLabel(entityId);
    text = text.replace(new RegExp(escapeRegexText(entityId), 'g'), replacement);
  });
  return text;
}

function collectPromptEntityNameMap(value, map = new Map()) {
  if (!value || typeof value !== 'object') return map;
  if (Array.isArray(value)) {
    value.forEach((item) => collectPromptEntityNameMap(item, map));
    return map;
  }

  if (looksLikeInternalEntityId(value.id) && value.name && !looksLikeInternalEntityId(value.name)) {
    map.set(String(value.id), normalizeSnippet(value.name, ''));
  }
  if (looksLikeInternalEntityId(value.targetId) && value.targetName && !looksLikeInternalEntityId(value.targetName)) {
    map.set(String(value.targetId), normalizeSnippet(value.targetName, ''));
  }
  if (looksLikeInternalEntityId(value.relationId) && value.name && !looksLikeInternalEntityId(value.name)) {
    map.set(String(value.relationId), normalizeSnippet(value.name, ''));
  }
  if (looksLikeInternalEntityId(value.cityId) && value.cityName && !looksLikeInternalEntityId(value.cityName)) {
    map.set(String(value.cityId), normalizeSnippet(value.cityName, ''));
  }

  Object.keys(value).forEach((key) => collectPromptEntityNameMap(value[key], map));
  return map;
}

function scrubSerializedPromptText(text, entityMap) {
  let output = String(text || '');
  const matches = output.match(/(?:extra|npc|relation|faction|sect|city)_[\w-]+/gi) || [];
  ensureList(matches).forEach((entityId) => {
    const replacement = normalizeSnippet(entityMap.get(entityId), '') || fallbackEntityLabel(entityId);
    output = output.replace(new RegExp(escapeRegexText(entityId), 'g'), replacement);
  });
  return output;
}

function relationTypeOf(item) {
  if (item && item.isHistorical) return 'historical';
  if (item && item.isExtraCharacter) return 'extra';
  return 'random';
}

function assignmentTouchesAction(assignment, action) {
  if (!assignment) return false;
  const mode = String(action && action.mode || '').trim();
  const kind = String(action && action.kind || '').trim();
  if (!mode && !kind) return false;
  if (isRetinueFocusedAction(action)) return true;
  const supportedKinds = {
    steward: ['govern', 'trade', 'sect', 'diplomacy', 'rest'],
    quartermaster: ['military', 'battle', 'warpath', 'trade', 'rest', 'martial'],
    counselor: ['investigate', 'intrigue', 'diplomacy', 'sect', 'martial'],
    spymaster: ['investigate', 'intrigue', 'jianghu', 'diplomacy', 'sect'],
    scout: ['jianghu', 'investigate', 'rest', 'diplomacy', 'sect', 'martial'],
    escort: ['martial', 'jianghu', 'travel', 'rest', 'sect'],
    drillmaster: ['military', 'battle', 'warpath', 'martial', 'rest'],
    vanguard: ['battle', 'warpath', 'jianghu', 'martial', 'diplomacy', 'sect']
  };
  return ensureList(supportedKinds[String(assignment.roleId || '')]).includes(kind);
}

function buildRetinuePromptScope(retinue, action, mode = 'narration') {
  const members = ensureList(retinue && retinue.members);
  const assignments = ensureList(retinue && retinue.assignments);
  const memberIds = new Set(members.map((item) => String(item && item.relationId || '')).filter(Boolean));
  const nameToId = new Map(members.map((item) => [String(item && item.name || '').trim(), String(item && item.relationId || '').trim()]).filter((item) => item[0] && item[1]));
  const companionRelationId = String(retinue && retinue.companionRelationId || '').trim();
  const explicitIds = new Set();
  const actionTargetId = String(action && action.target || '').trim();
  const actionTargetName = normalizeSnippet(action && action.targetName || '', '');
  const actionCorpus = [
    action && action.raw,
    action && action.actionText,
    action && action.text,
    actionTargetName
  ].filter(Boolean).join(' ');

  if (actionTargetId && memberIds.has(actionTargetId)) explicitIds.add(actionTargetId);
  if (actionTargetName && nameToId.has(actionTargetName)) explicitIds.add(nameToId.get(actionTargetName));
  members.forEach((item) => {
    const relationId = String(item && item.relationId || '').trim();
    const name = String(item && item.name || '').trim();
    if (!relationId || !name) return;
    if (actionCorpus && actionCorpus.includes(name)) explicitIds.add(relationId);
  });

  if (mode === 'choice') {
    return {
      suppressedRelationIds: new Set(),
      visibleMemberIds: memberIds,
      visibleAssignmentRoleIds: new Set(assignments.map((item) => String(item && item.roleId || '')).filter(Boolean))
    };
  }

  if (isRetinueFocusedAction(action)) {
    return {
      suppressedRelationIds: new Set(),
      visibleMemberIds: memberIds,
      visibleAssignmentRoleIds: new Set(assignments.map((item) => String(item && item.roleId || '')).filter(Boolean))
    };
  }

  const focusedAssignments = assignments.filter((item) => assignmentTouchesAction(item, action));
  const focusedMemberIds = new Set(focusedAssignments.map((item) => String(item && item.relationId || '')).filter(Boolean));
  const visibleMemberIds = new Set([...explicitIds, ...focusedMemberIds]);
  if (companionRelationId && memberIds.has(companionRelationId)) visibleMemberIds.add(companionRelationId);
  const visibleAssignmentRoleIds = new Set(
    focusedAssignments
      .filter((item) => visibleMemberIds.has(String(item && item.relationId || '')))
      .map((item) => String(item && item.roleId || ''))
      .filter(Boolean)
  );
  if (companionRelationId) {
    assignments
      .filter((item) => String(item && item.relationId || '') === companionRelationId)
      .forEach((item) => {
        const roleId = String(item && item.roleId || '').trim();
        if (roleId) visibleAssignmentRoleIds.add(roleId);
      });
  }

  return {
    suppressedRelationIds: memberIds,
    visibleMemberIds,
    visibleAssignmentRoleIds
  };
}

function sanitizeRetinueForPrompt(retinue, scope, mode = 'narration') {
  if (!retinue || typeof retinue !== 'object') return retinue;
  if (mode === 'choice') return retinue;

  const visibleMemberIds = scope && scope.visibleMemberIds instanceof Set ? scope.visibleMemberIds : new Set();
  const visibleAssignmentRoleIds = scope && scope.visibleAssignmentRoleIds instanceof Set ? scope.visibleAssignmentRoleIds : new Set();
  const next = { ...retinue };
  next.members = ensureList(retinue.members).filter((item) => visibleMemberIds.has(String(item && item.relationId || ''))).slice(0, 4);
  next.assignments = ensureList(retinue.assignments).filter((item) => visibleAssignmentRoleIds.has(String(item && item.roleId || ''))).slice(0, 4);
  next.companion = retinue && retinue.companion && visibleMemberIds.has(String(retinue.companion.relationId || ''))
    ? retinue.companion
    : null;
  next.focused = next.members.length > 0 || next.assignments.length > 0 || !!next.companion;
  if (!next.focused) {
    next.narrativeConstraint = '幕下已有班底，但本回若非玩家主动点名、同行，或动作直接命中其职司，不要让已入队人物主动走到台前。';
  }
  return next;
}

function buildRelationPromptCorpus(state, action, outcome) {
  const gs = state.gameState || {};
  const scene = state.scene || {};
  return [
    action && action.kind,
    action && action.mode,
    action && action.target,
    action && action.targetName,
    action && action.raw,
    action && action.actionText,
    action && action.text,
    outcome && outcome.summary,
    outcome && outcome.changeSummary,
    outcome && outcome.relationLine,
    gs.lastResolutionSummary,
    scene.title,
    scene.text
  ].filter(Boolean).join(' ');
}

function relationCanTakeFrontStage(item, action, options = {}) {
  if (!item || !isRelationMet(item)) return false;
  const relationId = String(item.id || '').trim();
  const targetId = String(action && action.target || '').trim();
  const targetName = normalizeSnippet(action && action.targetName || '', '');
  const boostedRelationIds = options && options.boostedRelationIds instanceof Set
    ? options.boostedRelationIds
    : new Set();

  if (relationId && boostedRelationIds.has(relationId)) return true;
  if (relationId && targetId && relationId === targetId) return true;
  if (targetName && item.name && targetName === item.name) return true;
  if (String(item.bondKey || '').trim()) return true;
  if (String(item.romanceStage || '').trim() && String(item.romanceStage || '').trim() !== '未启') return true;
  if (Number(item.trust || 0) >= 18) return true;
  if (Number(item.affection || 0) >= 16) return true;
  if (Number(item.loyalty || 0) >= 10) return true;
  if (Number(item.favorScore || 0) >= 18) return true;
  return false;
}

function buildNarrationRelationScope(state, action, options = {}) {
  const boostedRelationIds = options && options.boostedRelationIds instanceof Set
    ? options.boostedRelationIds
    : new Set();
  const suppressedRelationIds = new Set(
    ensureList(state && state.gameState && state.gameState.relationships)
      .filter((item) => item && isRelationMet(item))
      .filter((item) => !relationCanTakeFrontStage(item, action, { boostedRelationIds }))
      .map((item) => String(item.id || '').trim())
      .filter(Boolean)
  );
  return { suppressedRelationIds, boostedRelationIds };
}

function relationPromptWeight(item, corpus, cityId, options = {}) {
  const base = Number(item && item.trust || 0)
    + Number(item && item.affection || 0)
    + Number(item && item.loyalty || 0)
    + Number(item && item.favorScore || 0)
    - Number(item && item.rivalry || 0);
  const relationId = String(item && item.id || '').trim();
  const suppressedRelationIds = options && options.suppressedRelationIds instanceof Set
    ? options.suppressedRelationIds
    : new Set();
  const boostedRelationIds = options && options.boostedRelationIds instanceof Set
    ? options.boostedRelationIds
    : new Set();
  let score = base;
  if (boostedRelationIds.has(relationId)) score += 180;
  if (suppressedRelationIds.has(relationId) && !boostedRelationIds.has(relationId)) score -= 240;
  if (item && item.name && corpus.includes(item.name)) score += 180;
  if (item && item.id && corpus.includes(item.id)) score += 120;
  if (item && Array.isArray(item.homeCities) && cityId && item.homeCities.includes(cityId)) score += 24;
  if (item && item.isExtraCharacter) score += 6;
  if (item && item.isHistorical) score += 4;
  return score;
}

function relationPersonaSummary(item) {
  if (item && item.isExtraCharacter) {
    return normalizeSnippet(item.personality || item.personaAnchor || item.summary || '');
  }
  return normalizeSnippet(item && (item.personaAnchor || item.summary) || '');
}

function summarizeRelations(state, action, outcome, limit = 6, options = {}) {
  const world = state.world || {};
  const corpus = buildRelationPromptCorpus(state, action || {}, outcome || {});
  const suppressedRelationIds = options && options.suppressedRelationIds instanceof Set
    ? options.suppressedRelationIds
    : new Set();
  const boostedRelationIds = options && options.boostedRelationIds instanceof Set
    ? options.boostedRelationIds
    : new Set();
  return ensureList(state.gameState && state.gameState.relationships)
    .filter((item) => item && isRelationMet(item))
    .filter((item) => {
      const relationId = String(item && item.id || '').trim();
      if (!relationId) return true;
      return !suppressedRelationIds.has(relationId) || boostedRelationIds.has(relationId);
    })
    .slice()
    .sort((a, b) => relationPromptWeight(b, corpus, world.currentCityId || '', options) - relationPromptWeight(a, corpus, world.currentCityId || '', options))
    .slice(0, limit)
    .map((item) => ({
      id: looksLikeInternalEntityId(item.id) ? '' : (item.id || ''),
      name: item.name || '',
      title: item.title || '',
      type: relationTypeOf(item),
      historical: item.isHistorical === true,
      isExtraCharacter: item.isExtraCharacter === true,
      gender: item.genderLabel || '',
      storyDomain: item.storyDomain || '',
      homeCities: ensureList(item.homeCities).slice(0, 4),
      trust: Number(item.trust || 0),
      affection: Number(item.affection || 0),
      loyalty: Number(item.loyalty || 0),
      rivalry: Number(item.rivalry || 0),
      favor: Number(item.favorScore || 0),
      romanceStage: item.romanceStage || '未启',
      bond: item.bondLabel || '未定',
      status: normalizeSnippet(item.status, ''),
      persona: relationPersonaSummary(item),
      personality: normalizeSnippet(item.personality || ''),
      martialProfile: normalizeSnippet(item.martialProfile || ''),
      promptFocus: normalizeSnippet(item.promptFocus || '')
    }));
}

function summarizeFactions(state, limit = 3) {
  return ensureList(state.gameState && state.gameState.factions)
    .slice()
    .sort((a, b) => ((b.hostility || 0) + (b.power || 0) + (b.leverage || 0) + (b.favor || 0)) - ((a.hostility || 0) + (a.power || 0) + (a.leverage || 0) + (a.favor || 0)))
    .slice(0, limit)
    .map((item) => ({
      id: item.id || '',
      name: item.name || '',
      stance: item.stance || '',
      favor: Number(item.favor || 0),
      hostility: Number(item.hostility || 0),
      leverage: Number(item.leverage || 0),
      power: Number(item.power || 0)
    }));
}

function summarizeMap(state, routeLimit = 4) {
  const world = state.world || {};
  const map = world.map || {};
  const atlas = map.atlas || {};
  const territory = world.territory || {};
  return {
    currentCity: world.currentCityName || '',
    originCity: world.originCityName || '',
    territory: {
      currentAuthority: territory.currentAuthorityLabel || '',
      governedCount: Number(territory.governedCount || 0),
      controlledCount: Number(territory.controlledCount || 0),
      incomePerTurn: Number(territory.incomePerTurn || 0),
      supplyPerTurn: Number(territory.supplyPerTurn || 0),
      warningCities: ensureList(territory.cityCards)
        .filter((item) => item && item.warning)
        .slice(0, 4)
        .map((item) => item.cityName || item.cityId || ''),
      cityCards: ensureList(territory.cityCards).slice(0, 6).map((item) => ({
        city: item.cityName || '',
        authority: item.authorityLabel || '',
        order: Number(item.order || 0),
        prosperity: Number(item.prosperity || 0),
        security: Number(item.security || 0),
        yieldCoins: Number(item.yieldCoins || 0),
        yieldSupplies: Number(item.yieldSupplies || 0)
      }))
    },
    nearbyRoutes: ensureList(map.routes).slice(0, routeLimit).map((item) => ({
      city: item.cityName || '',
      region: item.region || '',
      route: item.routeLabel || '',
      type: item.routeTypeLabel || '',
      distance: Number(item.distance || 0),
      coinCost: Number(item.coinCost || 0),
      supplyCost: Number(item.supplyCost || 0),
      risk: item.risk || ''
    })),
    longRoutes: ensureList(map.longRoutes).slice(0, 3).map((item) => ({
      city: item.cityName || '',
      region: item.region || '',
      legs: Number(item.legCount || 0),
      months: Number(item.monthsCost || 0),
      stopovers: ensureList(item.stopovers).slice(0, 4),
      coinCost: Number(item.coinCost || 0),
      supplyCost: Number(item.supplyCost || 0)
    })),
    atlas: ensureList(atlas.regions).slice(0, 8).map((group) => ({
      region: group.region || '',
      cities: ensureList(group.cities).slice(0, 8)
    }))
  };
}

function summarizeFixedActions(state, limit = 24) {
  return ensureList(state && state.choices)
    .filter((item) => item && item.source !== 'dynamic' && item.id && item.text)
    .slice(0, limit)
    .map((item) => ({
      id: item.id || '',
      text: item.text || '',
      category: item.category || '',
      actionKind: item.actionKind || '',
      actionMode: item.actionMode || '',
      direction: item.direction || '',
      group: item.group || '',
      disabled: item.disabled === true,
      hint: normalizeSnippet(item.hint || '')
    }));
}

function cloneNumericRecord(source) {
  return Object.keys(source || {}).reduce((result, key) => {
    const value = Number(source[key] || 0);
    if (!value) return result;
    result[key] = value;
    return result;
  }, {});
}

function summarizeFatigueForPrompt(gameState) {
  const combat = Math.max(0, Number(gameState && gameState.fatigueCombat || 0));
  const travel = Math.max(0, Number(gameState && gameState.fatigueTravel || 0));
  const mental = Math.max(0, Number(gameState && gameState.fatigueMental || 0));
  const entries = [
    { key: 'combat', value: combat, label: '劳战' },
    { key: 'travel', value: travel, label: '奔波' },
    { key: 'mental', value: mental, label: '心神' }
  ].sort((left, right) => right.value - left.value);
  return {
    combat,
    travel,
    mental,
    dominant: entries[0] && entries[0].value > 0 ? entries[0].key : '',
    profile: entries[0] && entries[0].value > 0 ? `${entries[0].label}偏重` : '体气还算安稳'
  };
}

function summarizeRetinueFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object') return null;
  return {
    actionType: normalizeSnippet(feedback.actionType || ''),
    actionText: normalizeSnippet(feedback.actionText || ''),
    tier: normalizeSnippet(feedback.tier || ''),
    summaryLine: normalizeSnippet(feedback.summaryLine || ''),
    summaryTags: ensureList(feedback.summaryTags).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 6),
    participants: ensureList(feedback.participants).slice(0, 6).map((item) => ({
      relationId: normalizeSnippet(item && item.relationId || ''),
      name: normalizeSnippet(item && item.name || ''),
      roleId: normalizeSnippet(item && item.roleId || ''),
      roleName: normalizeSnippet(item && item.roleName || ''),
      slotLabel: normalizeSnippet(item && item.slotLabel || ''),
      contribution: normalizeSnippet(item && item.contribution || '')
    })),
    supportBonuses: ensureList(feedback.supportBonuses).slice(0, 8).map((item) => ({
      sourceRoleId: normalizeSnippet(item && item.sourceRoleId || ''),
      sourceRoleName: normalizeSnippet(item && item.sourceRoleName || ''),
      memberName: normalizeSnippet(item && item.memberName || ''),
      reason: normalizeSnippet(item && item.reason || ''),
      deltaLine: normalizeSnippet(item && item.deltaLine || ''),
      delta: cloneNumericRecord(item && item.delta || {})
    })),
    baseDelta: cloneNumericRecord(feedback.baseDelta || {}),
    synergyDelta: cloneNumericRecord(feedback.synergyDelta || {}),
    totalDelta: cloneNumericRecord(feedback.totalDelta || {})
  };
}

/* Legacy duplicate implementation retained only for history.
function buildPromptStateBundle(state, action, outcome, mode = 'narration') {
  ensureEncounterState(state);
  const gs = state.gameState || {};
  const world = state.world || {};
  const memory = state.memory || {};
  const historical = buildHistoricalNarrativeBundle(state);
  const encounters = buildEncounterNarrativeBundle(state);
  const planning = mode === 'choice' ? buildDynamicPlanningBundle(state, action || {}) : null;
  const activeBattle = gs.activeBattle || null;
  return {
    mode,
    meta: {
      turn: Number(world.turn || 0),
      phase: world.phase || 'playing',
      date: world.dateLabel || '',
      year: Number(world.year || 0),
      month: Number(world.month || 0),
      city: world.currentCityName || '',
      region: world.currentRegion || '',
      weather: world.weather || '',
      sceneTitle: state.scene && state.scene.title ? state.scene.title : '',
      sceneTail: normalizeSnippet(String(state.scene && state.scene.text || '').slice(-220)),
      action: {
        kind: action && action.kind ? action.kind : '',
        mode: action && action.mode ? action.mode : '',
        target: resolveActionTargetName(state, action || {}) || '',
        text: normalizeSnippet(action && (action.raw || action.actionText || action.text || action.kind) || '')
      },
      localResolution: {
        tier: outcome && outcome.tier ? outcome.tier : '',
        summary: normalizeSnippet(outcome && outcome.summary || ''),
        changeSummary: normalizeSnippet(outcome && outcome.changeSummary || ''),
        deltaLine: normalizeSnippet(outcome && outcome.deltaLine || '')
      }
    },
    actor: {
      name: gs.name || '无名之人',
      gender: gs.genderLabel || '未知',
      identity: gs.identity || '',
      background: gs.backgroundLabel || '',
      sect: gs.sectName || '无门无派',
      resources: {
        coins: Number(gs.coins || 0),
        supplies: Number(gs.supplies || 0),
        troops: Number(gs.troops || 0),
        morale: Number(gs.morale || 0),
        health: Number(gs.health || 0),
        fatigue: Number(gs.fatigue || 0),
        renown: Number(gs.renown || 0),
        influence: Number(gs.influence || 0)
      },
      stats: {
        governance: Number(gs.governance || 0),
        commerce: Number(gs.commerce || 0),
        diplomacy: Number(gs.diplomacy || 0),
        charm: Number(gs.charm || 0),
        military: Number(gs.military || 0),
        strategy: Number(gs.strategy || 0)
      },
      martial: {
        level: Number(gs.martialLevel || 0),
        title: gs.martialTitle || '',
        power: Number(gs.martialPower || 0),
        insight: Number(gs.martialInsight || 0),
        route: gs.martialRouteName || '',
        focus: gs.martialFocusName || '',
        limitBroken: gs.martialLimitBroken === true,
        breakthroughHint: gs.martialBreakthroughHint || ''
      },
      strategyRoute: {
        route: gs.strategyRouteName || '',
        level: Number(gs.strategyLevel || 0)
      }
    },
    combat: activeBattle && activeBattle.active
      ? {
        active: true,
        mode: activeBattle.mode === 'duel' ? (activeBattle.variant === 'sparring' ? '切磋' : '江湖对决') : '沙场征战',
        round: Number(activeBattle.round || 0),
        targetName: activeBattle.targetName || '',
        player: activeBattle.mode === 'duel'
          ? { hp: Number(activeBattle.player && activeBattle.player.hp || 0), qi: Number(activeBattle.player && activeBattle.player.qi || 0) }
          : { force: Number(activeBattle.player && activeBattle.player.force || 0), morale: Number(activeBattle.player && activeBattle.player.morale || 0) },
        enemy: activeBattle.mode === 'duel'
          ? { hp: Number(activeBattle.enemy && activeBattle.enemy.hp || 0), qi: Number(activeBattle.enemy && activeBattle.enemy.qi || 0) }
          : { force: Number(activeBattle.enemy && activeBattle.enemy.force || 0), morale: Number(activeBattle.enemy && activeBattle.enemy.morale || 0) },
        logTail: ensureList(activeBattle.log).slice(-3).map((item) => normalizeSnippet(item && item.summary || ''))
      }
      : {
        active: false,
        lastBattleReport: gs.lastBattleReport
          ? {
            scale: gs.lastBattleReport.scaleLabel || '',
            enemy: gs.lastBattleReport.targetFactionName || '',
            playerCommittedTroops: Number(gs.lastBattleReport.playerCommittedTroops || 0),
            enemyTroops: Number(gs.lastBattleReport.enemyTroops || 0)
          }
          : null
      },
    memory: {
      threads: ensureList(memory.openThreads).slice(0, 4).map((item) => ({
        title: normalizeSnippet(item && item.title || ''),
        urgency: Number(item && item.urgency || 0),
        domain: item && item.domain ? item.domain : ''
      })),
      summaries: ensureList(memory.summaries).slice(0, 4).map((item) => normalizeSnippet(item)),
      facts: ensureList(memory.retrievalFacts).slice(0, 4).map((item) => normalizeSnippet(item && item.text ? item.text : item))
    },
    map: summarizeMap(state, 4),
    relations: summarizeRelations(state, action, outcome, 6),
    factions: summarizeFactions(state, 3),
    historical: {
      active: historical.activeText || '暂无',
      near: historical.nearText || '暂无',
      npcs: historical.npcText || '暂无',
      last: historical.lastEventText || '暂无'
    },
    encounters: {
      last: encounters.lastSummary || '暂无',
      progress: encounters.progressText || '暂无',
      romanceArc: encounters.romanceText || '暂无',
      jianghuArc: encounters.jianghuText || '暂无',
      activeLeads: encounters.activeLeads || '暂无'
    },
    retinue: summarizeRetinueForPrompt(state),
    fixedActions: summarizeFixedActions(state, 24),
    planning: planning
      ? {
        frontiers: ensureList(planning.frontiers).slice(0, 8).map((item) => ({
          id: item && item.id ? item.id : '',
          type: item && item.type ? item.type : '',
          title: item && item.title ? item.title : '',
          summary: item && item.summary ? item.summary : '',
          reason: item && item.reason ? item.reason : '',
          domain: item && item.domain ? item.domain : '',
          risk: item && item.risk ? item.risk : '',
          slotBiases: ensureList(item && item.slotBiases),
          recommendedKinds: ensureList(item && item.recommendedKinds),
          targetId: item && item.targetId ? item.targetId : '',
          targetName: item && item.targetName ? item.targetName : '',
          targetType: item && item.targetType ? item.targetType : '',
          cityId: item && item.cityId ? item.cityId : '',
          cityName: item && item.cityName ? item.cityName : '',
          outcomes: ensureList(item && item.outcomes),
          noveltyKey: item && item.noveltyKey ? item.noveltyKey : '',
          source: item && item.source ? item.source : ''
        })),
        recentDynamicChoices: ensureList(planning.recentDynamicChoices).slice(0, 12),
        characterCards: ensureList(planning.characterCards).slice(0, 4)
      }
      : undefined,
    directives: buildPromptDirectorLines(state, action || {}, mode)
  };
}
*/

function buildPromptStateBundle(state, action, outcome, mode = 'narration') {
  ensureEncounterState(state);
  const gs = state.gameState || {};
  const world = state.world || {};
  const memory = state.memory || {};
  const historical = buildHistoricalNarrativeBundle(state);
  const encounters = buildEncounterNarrativeBundle(state);
  const planning = mode === 'choice' ? buildDynamicPlanningBundle(state, action || {}) : null;
  const activeBattle = gs.activeBattle || null;
  ensureDramaticLayer(gs);
  const rawRetinue = summarizeRetinueForPrompt(state);
  const retinueScope = buildRetinuePromptScope(rawRetinue, action || {}, mode);
  const narrationRelationScope = mode === 'narration'
    ? buildNarrationRelationScope(state, action || {}, {
      boostedRelationIds: retinueScope.visibleMemberIds
    })
    : { suppressedRelationIds: new Set(), boostedRelationIds: new Set() };
  const retinue = sanitizeRetinueForPrompt(rawRetinue, retinueScope, mode);
  const dramaticLayer = summarizeDramaticLayerForPrompt(gs);
  const worldPerception = summarizeWorldPerceptionForPrompt(gs);
  const worldFermentation = summarizeWorldFermentationForPrompt(gs);
  const fixedActions = summarizeFixedActions(state, 24);
  const lastRetinueFeedback = summarizeRetinueFeedback(
    (outcome && outcome.retinueFeedback) || gs.lastRetinueFeedback || null
  );
  const localResolution = buildPromptLocalResolution(outcome, lastRetinueFeedback, mode);
  const directives = buildPromptDirectorLines(state, action || {}, mode);
  const fatigue = summarizeFatigueForPrompt(gs);
  const planningPayload = planning
    ? {
      frontiers: ensureList(planning.frontiers).slice(0, 8).map((item) => ({
        id: item && item.id ? item.id : '',
        type: item && item.type ? item.type : '',
        title: scrubInternalEntityIds(item && item.title ? item.title : '', state),
        summary: scrubInternalEntityIds(item && item.summary ? item.summary : '', state),
        reason: scrubInternalEntityIds(item && item.reason ? item.reason : '', state),
        domain: item && item.domain ? item.domain : '',
        risk: item && item.risk ? item.risk : '',
        slotBiases: ensureList(item && item.slotBiases),
        targetId: looksLikeInternalEntityId(item && item.targetId ? item.targetId : '') ? '' : (item && item.targetId ? item.targetId : ''),
        targetName: resolveEntityDisplayName(
          state,
          item && item.targetId ? item.targetId : '',
          item && item.targetName ? item.targetName : ''
        ),
        targetType: item && item.targetType ? item.targetType : '',
        cityId: item && item.cityId ? item.cityId : '',
        cityName: item && item.cityName ? item.cityName : '',
        outcomes: ensureList(item && item.outcomes),
        noveltyKey: item && item.noveltyKey ? item.noveltyKey : '',
        source: item && item.source ? item.source : ''
      })),
      recentDynamicChoices: ensureList(planning.recentDynamicChoices).slice(0, 12),
      selectedDynamicChoices: ensureList(planning.selectedDynamicChoices).slice(0, 6),
      characterCards: ensureList(planning.characterCards).slice(0, 4),
      dramaticCarryover: {
        activeQuestion: dramaticLayer.activeQuestion || '',
        sceneResidue: ensureList(dramaticLayer.sceneResidue).slice(0, 6),
        latestScenePlan: dramaticLayer.latestScenePlan || {},
        lastMeta: dramaticLayer.lastMeta || {}
      },
      worldPerception,
      worldFermentation,
      guardrails: {
        doNotAssumePreference: true,
        avoidFrontierIds: ensureList(planning.recentDynamicChoices).map((item) => item && item.frontierId).filter(Boolean).slice(0, 8),
        avoidNoveltyKeys: ensureList(planning.recentDynamicChoices).map((item) => item && item.noveltyKey).filter(Boolean).slice(0, 8),
        avoidTargetNames: ensureList(planning.recentDynamicChoices).map((item) => item && item.targetName).filter(Boolean).slice(0, 8),
        forbidFixedActionOverlap: true,
        forbidTemplatePhrases: ['续推主线', '探XX', '查XX动静', '顺线', '再访XX', '继续追查'],
        instruction: '不要预设哪条 frontier 更值得走；只需避开重复、越权、固定盘重叠和无上下文支撑的方向。'
      }
    }
    : undefined;

  const bundle = {
    mode,
    meta: {
      turn: Number(world.turn || 0),
      phase: world.phase || 'playing',
      date: world.dateLabel || '',
      year: Number(world.year || 0),
      month: Number(world.month || 0),
      city: world.currentCityName || '',
      region: world.currentRegion || '',
      weather: world.weather || '',
      sceneTitle: state.scene && state.scene.title ? state.scene.title : '',
      sceneTail: normalizeSnippet(String(state.scene && state.scene.text || '').slice(-220)),
      action: {
        kind: action && action.kind ? action.kind : '',
        mode: action && action.mode ? action.mode : '',
        target: resolveActionTargetName(state, action || {}) || '',
        text: normalizeSnippet(action && (action.raw || action.actionText || action.text || action.kind) || '')
      },
      localResolution
    },
    actor: {
      name: gs.name || '无名之人',
      gender: gs.genderLabel || '未知',
      identity: gs.identity || '',
      background: gs.backgroundLabel || '',
      sect: gs.sectName || '无门无派',
      resources: {
        coins: Number(gs.coins || 0),
        supplies: Number(gs.supplies || 0),
        troops: Number(gs.troops || 0),
        morale: Number(gs.morale || 0),
        health: Number(gs.health || 0),
        fatigue: Number(gs.fatigue || 0),
        fatigueCombat: fatigue.combat,
        fatigueTravel: fatigue.travel,
        fatigueMental: fatigue.mental,
        fatigueDominant: fatigue.dominant,
        fatigueProfile: fatigue.profile,
        lastMeal: gs.lastMeal
          ? {
            name: gs.lastMeal.name || '',
            category: gs.lastMeal.category || '',
            flavorText: gs.lastMeal.flavorText || '',
            soulLine: gs.lastMeal.soulLine || ''
          }
          : null,
        foodBuffs: ensureList(gs.foodBuffs).slice(0, 4).map((item) => ({
          foodName: item && item.foodName ? item.foodName : '',
          domain: item && item.domain ? item.domain : '',
          score: Number(item && item.score || 0),
          turns: Number(item && item.turns || 0),
          note: item && item.note ? item.note : ''
        })),
        renown: Number(gs.renown || 0),
        influence: Number(gs.influence || 0)
      },
      stats: {
        governance: Number(gs.governance || 0),
        commerce: Number(gs.commerce || 0),
        diplomacy: Number(gs.diplomacy || 0),
        charm: Number(gs.charm || 0),
        military: Number(gs.military || 0),
        strategy: Number(gs.strategy || 0)
      },
      martial: {
        level: Number(gs.martialLevel || 0),
        title: gs.martialTitle || '',
        power: Number(gs.martialPower || 0),
        insight: Number(gs.martialInsight || 0),
        route: gs.martialRouteName || '',
        focus: gs.martialFocusName || '',
        limitBroken: gs.martialLimitBroken === true,
        breakthroughHint: gs.martialBreakthroughHint || ''
      },
      strategyRoute: {
        route: gs.strategyRouteName || '',
        level: Number(gs.strategyLevel || 0)
      }
    },
    combat: activeBattle && activeBattle.active
      ? {
        active: true,
        mode: activeBattle.mode === 'duel' ? (activeBattle.variant === 'sparring' ? '切磋' : '江湖对决') : '沙场征战',
        round: Number(activeBattle.round || 0),
        targetName: activeBattle.targetName || '',
        player: activeBattle.mode === 'duel'
          ? { hp: Number(activeBattle.player && activeBattle.player.hp || 0), qi: Number(activeBattle.player && activeBattle.player.qi || 0) }
          : { force: Number(activeBattle.player && activeBattle.player.force || 0), morale: Number(activeBattle.player && activeBattle.player.morale || 0) },
        enemy: activeBattle.mode === 'duel'
          ? { hp: Number(activeBattle.enemy && activeBattle.enemy.hp || 0), qi: Number(activeBattle.enemy && activeBattle.enemy.qi || 0) }
          : { force: Number(activeBattle.enemy && activeBattle.enemy.force || 0), morale: Number(activeBattle.enemy && activeBattle.enemy.morale || 0) },
        logTail: ensureList(activeBattle.log).slice(-3).map((item) => normalizeSnippet(item && item.summary || ''))
      }
      : {
        active: false,
        lastBattleReport: gs.lastBattleReport
          ? {
            scale: gs.lastBattleReport.scaleLabel || '',
            enemy: gs.lastBattleReport.targetFactionName || '',
            playerCommittedTroops: Number(gs.lastBattleReport.playerCommittedTroops || 0),
            enemyTroops: Number(gs.lastBattleReport.enemyTroops || 0)
          }
          : null
      },
    memory: {
      threads: ensureList(memory.openThreads).slice(0, 4).map((item) => ({
        title: normalizeSnippet(item && item.title || ''),
        urgency: Number(item && item.urgency || 0),
        domain: item && item.domain ? item.domain : ''
      })),
      summaries: ensureList(memory.summaries).slice(0, 4).map((item) => normalizeSnippet(item)),
      facts: ensureList(memory.retrievalFacts).slice(0, 4).map((item) => normalizeSnippet(item && item.text ? item.text : item)),
      selectedDynamicChoices: ensureList(memory.selectedDynamicChoiceHistory).slice(0, 3).map((item) => ({
        text: scrubInternalEntityIds(item && item.text || '', state, item && item.targetName || ''),
        actionText: scrubInternalEntityIds(item && item.actionText || '', state, item && item.targetName || ''),
        actionKind: normalizeSnippet(item && item.actionKind || ''),
        slotRole: normalizeSnippet(item && item.slotRole || ''),
        frontierId: normalizeSnippet(item && item.frontierId || ''),
        targetName: resolveEntityDisplayName(
          state,
          item && (item.targetId || item.target) || '',
          item && item.targetName || ''
        )
      }))
    },
    worldPerception,
    worldFermentation,
    map: summarizeMap(state, 4),
    relations: summarizeRelations(state, action, outcome, 6, {
      suppressedRelationIds: mode === 'narration'
        ? new Set([].concat(
          Array.from(retinueScope.suppressedRelationIds || []),
          Array.from(narrationRelationScope.suppressedRelationIds || [])
        ))
        : new Set(),
      boostedRelationIds: mode === 'narration'
        ? new Set([].concat(
          Array.from(retinueScope.visibleMemberIds || []),
          Array.from(narrationRelationScope.boostedRelationIds || [])
        ))
        : new Set()
    }),
    factions: summarizeFactions(state, 3),
    historical: {
      active: historical.activeText || '暂无',
      near: historical.nearText || '暂无',
      npcs: historical.npcText || '暂无',
      last: historical.lastEventText || '暂无'
    },
    encounters: {
      last: encounters.lastSummary || '暂无',
      progress: encounters.progressText || '暂无',
      romanceArc: encounters.romanceText || '暂无',
      jianghuArc: encounters.jianghuText || '暂无',
      activeLeads: encounters.activeLeads || '暂无'
    },
    dramatic: dramaticLayer,
    retinue,
    fixedActions,
    planning: planningPayload,
    directives
  };

  bundle.facts = {
    meta: bundle.meta,
    actor: bundle.actor,
    combat: bundle.combat,
    memory: bundle.memory,
    map: bundle.map,
    relations: bundle.relations,
    factions: bundle.factions,
    historical: bundle.historical,
    encounters: bundle.encounters,
    worldPerception: bundle.worldPerception,
    dramatic: bundle.dramatic,
    retinue: bundle.retinue,
    fixedActionsDigest: bundle.fixedActions.map((item) => item.text).filter(Boolean).slice(0, 12),
    lastRetinueFeedback
  };

  bundle.constraints = {
    modelRole: mode === 'choice'
      ? '本地引擎负责状态记录、事实裁定、数值结算、解锁判断与固定玩法；模型只负责在限制内生成真正随剧情变化的动态规划型选项。'
      : '本地引擎负责状态记录、事实裁定与数值结算；模型只负责把既成事实写成有过程、有代价、有时代重量的正文。',
    hardLimits: [
      '不得改写本地已裁定的结果、收益、损失、关系变化与编制状态。',
      '不得输出后世书名、现代制度、现代口吻、穿越式旁白或跳出时代的视角。',
      '不得把固定操作盘已经稳定提供的个人动作、经营、养成、任命、队伍调度重新包装成动态选项。',
      '若条件不足，只能写成试探、铺垫、借势、旁敲或求援，不得直接写成完成态。'
    ],
    dynamicChoicePolicy: mode === 'choice'
      ? '动态选项只给边界，不给推荐；不要假定任何 frontier 天然优先，只需避开重复、越权、固定盘重叠和无上下文支撑的方向。'
      : '正文只负责把已发生的事实写得有代入感，不为生成动态选项服务，不要把正文写成前情提要或系统说明。'
  };

  bundle.dramaticFocus = {
    scenePriority: normalizeSnippet(directives[0] || ''),
    pressure: normalizeSnippet(directives[1] || ''),
    tailAnchor: bundle.meta.sceneTail,
    activeQuestion: dramaticLayer.activeQuestion || '',
    carryoverResidue: ensureList(dramaticLayer.sceneResidue).slice(0, 4),
    previousScenePlan: dramaticLayer.latestScenePlan || {},
    previousMeta: dramaticLayer.lastMeta || {},
    narrationTask: lastRetinueFeedback
      ? '把队伍协同写成具体分工、场面回响与额外收益的来处，不要只播报数值，也不要改写协同是否发生。'
      : '把本回已经裁定的阻力、得失、人物反应与局势余波真正写成过程，不要只报结果。'
  };

  bundle.dramaticFocus = {
    scenePriority: normalizeSnippet(directives[0] || ''),
    pressure: normalizeSnippet(directives[1] || ''),
    tailAnchor: bundle.meta.sceneTail,
    activeQuestion: dramaticLayer.activeQuestion || '',
    carryoverResidue: ensureList(dramaticLayer.sceneResidue).slice(0, 4),
    previousScenePlan: dramaticLayer.latestScenePlan || {},
    previousMeta: dramaticLayer.lastMeta || {},
    narrationTask: buildNarrationTask(action, lastRetinueFeedback, retinue)
  };

  bundle.contextBudget = {
    mode,
    targetChars: mode === 'choice' ? 10500 : 11800,
    strategy: 'stable-window'
  };

  return bundle;
}

function clipText(value, maxChars) {
  const text = normalizeSnippet(value, '');
  if (!maxChars || text.length <= maxChars) return text;
  if (maxChars <= 1) return text.slice(0, Math.max(0, maxChars));
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function shrinkPromptBundle(bundle) {
  const next = JSON.parse(JSON.stringify(bundle || {}));
  const mode = next && next.mode ? next.mode : 'narration';
  const targetChars = Number(next && next.contextBudget && next.contextBudget.targetChars || (mode === 'choice' ? 10500 : 11800));
  delete next.facts;
  if (mode === 'choice') delete next.fixedActions;
  if (next.map && next.map.atlas) delete next.map.atlas;
  if (next.retinue && typeof next.retinue === 'object') {
    if (Array.isArray(next.retinue.members)) next.retinue.members = next.retinue.members.slice(0, 4);
    if (Array.isArray(next.retinue.roster)) next.retinue.roster = next.retinue.roster.slice(0, 4);
    if (Array.isArray(next.retinue.roles)) next.retinue.roles = next.retinue.roles.slice(0, 6);
    if (Array.isArray(next.retinue.recentFeedback)) next.retinue.recentFeedback = next.retinue.recentFeedback.slice(0, 2);
  }
  if (Array.isArray(next.directives)) next.directives = next.directives.slice(0, 4).map((item) => clipText(item, 80));
  const trim = (path, maxChars) => {
    let ref = next;
    for (let index = 0; index < path.length - 1; index += 1) {
      if (!ref || typeof ref !== 'object') return;
      ref = ref[path[index]];
    }
    if (!ref || typeof ref !== 'object') return;
    ref[path[path.length - 1]] = clipText(ref[path[path.length - 1]], maxChars);
  };
  const sliceArray = (path, limit) => {
    let ref = next;
    for (let index = 0; index < path.length - 1; index += 1) {
      if (!ref || typeof ref !== 'object') return;
      ref = ref[path[index]];
    }
    if (!ref || typeof ref !== 'object') return;
    const key = path[path.length - 1];
    if (Array.isArray(ref[key])) ref[key] = ref[key].slice(0, limit);
  };

  trim(['meta', 'sceneTail'], mode === 'choice' ? 180 : 240);
  trim(['dramaticFocus', 'tailAnchor'], 120);
  trim(['dramaticFocus', 'scenePriority'], 72);
  trim(['dramaticFocus', 'pressure'], 72);
  trim(['dramaticFocus', 'narrationTask'], 120);
  sliceArray(['memory', 'threads'], 3);
  sliceArray(['memory', 'summaries'], 3);
  sliceArray(['memory', 'facts'], 3);
  sliceArray(['memory', 'selectedDynamicChoices'], 2);
  sliceArray(['relations'], mode === 'choice' ? 5 : 4);
  sliceArray(['factions'], 3);
  sliceArray(['fixedActions'], 12);
  sliceArray(['map', 'nearbyRoutes'], 3);
  sliceArray(['map', 'longRoutes'], 2);

  if (next.planning) {
    sliceArray(['planning', 'frontiers'], 6);
    sliceArray(['planning', 'recentDynamicChoices'], 8);
    sliceArray(['planning', 'selectedDynamicChoices'], 4);
    sliceArray(['planning', 'characterCards'], 4);
    if (next.planning.guardrails) {
      if (Array.isArray(next.planning.guardrails.avoidFrontierIds)) next.planning.guardrails.avoidFrontierIds = next.planning.guardrails.avoidFrontierIds.slice(0, 4);
      if (Array.isArray(next.planning.guardrails.avoidNoveltyKeys)) next.planning.guardrails.avoidNoveltyKeys = next.planning.guardrails.avoidNoveltyKeys.slice(0, 4);
      if (Array.isArray(next.planning.guardrails.avoidTargetNames)) next.planning.guardrails.avoidTargetNames = next.planning.guardrails.avoidTargetNames.slice(0, 4);
      if (Array.isArray(next.planning.guardrails.forbidTemplatePhrases)) next.planning.guardrails.forbidTemplatePhrases = next.planning.guardrails.forbidTemplatePhrases.slice(0, 4);
      next.planning.guardrails.instruction = clipText(next.planning.guardrails.instruction, 80);
    }
    if (next.planning.dramaticCarryover) {
      next.planning.dramaticCarryover.activeQuestion = clipText(next.planning.dramaticCarryover.activeQuestion, 64);
      if (Array.isArray(next.planning.dramaticCarryover.sceneResidue)) {
        next.planning.dramaticCarryover.sceneResidue = next.planning.dramaticCarryover.sceneResidue
          .slice(0, 4)
          .map((item) => clipText(item, 48));
      }
    }
  }

  let json = JSON.stringify(next);
  if (json.length <= targetChars) return next;

  sliceArray(['planning', 'frontiers'], 4);
  sliceArray(['planning', 'selectedDynamicChoices'], 2);
  sliceArray(['planning', 'characterCards'], 2);
  sliceArray(['fixedActions'], 10);
  sliceArray(['relations'], 4);
  sliceArray(['memory', 'threads'], 2);
  sliceArray(['memory', 'summaries'], 2);
  sliceArray(['memory', 'facts'], 2);
  trim(['meta', 'sceneTail'], 120);
  trim(['dramaticFocus', 'tailAnchor'], 80);

  json = JSON.stringify(next);
  if (json.length <= targetChars) return next;

  if (next.planning) {
    delete next.planning.characterCards;
    delete next.planning.recentDynamicChoices;
    delete next.planning.selectedDynamicChoices;
    delete next.planning.guardrails;
  }
  delete next.retinue;
  sliceArray(['fixedActions'], 8);
  sliceArray(['relations'], 3);
  sliceArray(['factions'], 2);
  sliceArray(['planning', 'frontiers'], 3);
  trim(['dramaticFocus', 'narrationTask'], 80);
  if (Array.isArray(next.directives)) next.directives = next.directives.slice(0, 3);
  return next;
}

function stringifyPromptStateBundle(bundle) {
  const shrunk = shrinkPromptBundle(bundle);
  const entityMap = collectPromptEntityNameMap(bundle);
  return scrubSerializedPromptText(JSON.stringify(shrunk, null, 2), entityMap);
}

module.exports = {
  buildPromptStateBundle,
  stringifyPromptStateBundle
};
