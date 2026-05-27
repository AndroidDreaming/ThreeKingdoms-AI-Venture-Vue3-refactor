const fs = require('fs');
const path = require('path');
const { createId, createSessionState, createPlayerProfile, buildRelationRoster, createActionChoices, createBackgroundChoices, createOriginChoices, applyPathSnapshot, CITIES, SECTS, validatePlayerName } = require('./chronicleV5StateFactory');
const { repairScene } = require('./chronicleV5NarrationGuard');
const { getHistoricalPersona } = require('./chronicleV5HistoricalPersonaLibrary');
const { buildInheritanceCarryover, ensureLifecycleState } = require('./chronicleV5Endgame');
const { ensureMemoryState } = require('./chronicleV5Memory');
const { normalizeSkillList, normalizeSkillRecord } = require('./chronicleV5SkillSystem');
const { ensureRetinueState } = require('./chronicleV5RetinueSystem');
const { ensureDramaticLayer } = require('./chronicleV5DramaticLayer');
const { ensureWorldPerceptionState } = require('./chronicleV5WorldPerception');
const { ensureWorldFermentationState } = require('./chronicleV5WorldFermentation');
const { isRelationMet, withRelationVisibility } = require('./chronicleV5RelationVisibility');
const { ensureCityState, refreshTerritorySummary } = require('./chronicleV5CitySystem');
const { FOOD_DEFINITIONS, cloneFoodItem } = require('./chronicleV5FoodConfig');
const { ensureSoftState } = require('./chronicleV5SoftState');

const DATA_DIR = path.join(__dirname, '..', 'runtime', 'sessions-v5');
const LOG_DIR = path.join(__dirname, '..', 'runtime', 'session-logs-v5');
const GUEST_TRIAL_TURN_LIMIT = 10;
const CITY_NAME_BY_ID = new Map((Array.isArray(CITIES) ? CITIES : []).map((item) => [item.id, item.name]));
const SECT_NAME_BY_ID = new Map((Array.isArray(SECTS) ? SECTS : []).map((item) => [item.id, item.name]));
const RETINUE_SLOT_LABELS = {
  steward: '内务',
  quartermaster: '军需',
  counselor: '参议',
  spymaster: '暗线',
  scout: '耳目',
  escort: '护行',
  drillmaster: '教头',
  vanguard: '先锋'
};
const ACTION_MODE_LABELS = {
  audit: '盘账整饷',
  patrol: '巡地整防',
  granary: '清点粮栈',
  stewardship: '争取城池代治',
  stabilize: '安民肃吏',
  warehouse: '盘货试商路',
  blackmarket: '试探黑市',
  caravan: '打通商队',
  market_town: '整饬市路',
  arms: '整备军械',
  banquet: '投帖会面',
  envoy: '遣使探口风',
  salon: '设宴结社',
  terrain: '踩点探地脉',
  archive: '翻检旧档',
  historical_lead: '追史实人物线索',
  rumor: '放风试口',
  counterspy: '反查暗线',
  solo: '闭门磨武',
  closedoor: '闭关运劲',
  teahouse: '茶楼听书',
  stroll: '沿街散心',
  study: '静室读卷',
  recruit: '招募部曲',
  drill: '操练部曲',
  discipline: '整肃军纪',
  camp: '营中整备',
  lodge: '住店听风声',
  challenge: '登场问招',
  trace: '顺迹追人',
  inner_drill: '深修门内武学',
  inner_network: '打通门中人脉',
  team_logistics: '调度后勤线',
  team_trade: '铺开商路网',
  team_probe: '铺耳目探风向',
  team_layout: '拆线设回钩',
  team_roam: '放队友走江湖',
  team_muster: '整编营中部曲',
  team_parley: '分头游说定站位',
  team_sect_affairs: '整饬门内外缘',
  team_recover: '轮值整补养锐',
  team_martial: '轮番喂招磨武',
  recruit_probe: '试探入队',
  appoint_steward: '任人掌内务',
  appoint_quartermaster: '任人掌军需',
  appoint_counselor: '任人掌参议',
  appoint_spymaster: '任人掌暗线',
  appoint_scout: '任人掌耳目',
  appoint_escort: '任人掌护行',
  appoint_drillmaster: '任人掌教头',
  appoint_vanguard: '任人掌先锋'
};

Object.assign(ACTION_MODE_LABELS, {
  inn: '投店安睡',
  medicate: '药汤调息',
  retinue_talk: '找幕下某人谈事',
  retinue_counsel: '向幕下某人问策',
  retinue_companion: '点幕下某人同行'
});

function toNonNegativeInteger(value, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return Math.max(0, Number(fallback || 0));
  return Math.max(0, Math.floor(next));
}

function normalizeGuestAccess(raw) {
  const payload = Object.assign({
    trialTurnLimit: GUEST_TRIAL_TURN_LIMIT,
    trialTurnsUsed: 0
  }, raw || {});
  return {
    trialTurnLimit: toNonNegativeInteger(payload.trialTurnLimit, GUEST_TRIAL_TURN_LIMIT),
    trialTurnsUsed: toNonNegativeInteger(payload.trialTurnsUsed, 0)
  };
}

function summarizeGuestAccess(raw) {
  const access = normalizeGuestAccess(raw);
  const trialRemainingTurns = Math.max(0, access.trialTurnLimit - access.trialTurnsUsed);
  return Object.assign({}, access, {
    trialRemainingTurns,
    canPlay: trialRemainingTurns > 0,
    playMode: trialRemainingTurns > 0 ? 'guest_trial' : 'guest_exhausted',
    isGuest: true
  });
}

function relationNameById(session, relationId) {
  return (session && session.gameState && Array.isArray(session.gameState.relationships)
    ? session.gameState.relationships
    : []
  ).find((item) => item && item.id === relationId && item.name)
    ? (session.gameState.relationships.find((item) => item && item.id === relationId && item.name).name)
    : String(relationId || '');
}

function normalizedPlayerLabels(gender) {
  return String(gender || '').trim() === 'female'
    ? { gender: 'female', genderLabel: '女', pronoun: '她' }
    : { gender: 'male', genderLabel: '男', pronoun: '他' };
}

function repairAnonymousPlayerProfile(session) {
  if (!session || !session.gameState) return;
  const gs = session.gameState;
  const currentName = String(gs.name || '').trim();
  const missingName = !currentName || currentName === '无名之人';
  const generatedProfile = createPlayerProfile();
  const baseLabels = gs.gender ? normalizedPlayerLabels(gs.gender) : generatedProfile;
  const repairedName = missingName ? generatedProfile.name : currentName;

  gs.name = repairedName;
  gs.gender = String(gs.gender || baseLabels.gender || '').trim();
  gs.genderLabel = String(gs.genderLabel || baseLabels.genderLabel || '').trim();
  gs.pronoun = String(gs.pronoun || baseLabels.pronoun || '').trim();

  if (session.scene) {
    ['text', 'summary', 'statusLine'].forEach((key) => {
      if (!session.scene[key]) return;
      session.scene[key] = String(session.scene[key]).replace(/无名之人/g, repairedName);
    });
  }
  if (session.memory && Array.isArray(session.memory.openThreads)) {
    session.memory.openThreads = session.memory.openThreads.map((item) => {
      if (!item || !item.title) return item;
      return { ...item, title: String(item.title).replace(/无名之人/g, repairedName) };
    });
  }
}

function repairPlayerNamingState(session) {
  if (!session || !session.gameState) return;
  const gs = session.gameState;
  const nameSource = String(gs.nameSource || '').trim();
  if (!nameSource) gs.nameSource = 'legacy';
  const renameCount = Number(gs.renameCount);
  const renameLimit = Number(gs.renameLimit);
  if (!Number.isFinite(renameCount) || renameCount < 0) gs.renameCount = 0;
  if (!Number.isFinite(renameLimit) || renameLimit < 0) {
    gs.renameLimit = gs.nameSource === 'custom' ? 0 : 1;
  }
  if (gs.renameCount > gs.renameLimit) gs.renameCount = gs.renameLimit;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePlayerNameText(value, fromName, toName) {
  const text = String(value || '');
  if (!text) return text;
  let next = text;
  if (fromName && fromName !== toName) {
    next = next.replace(new RegExp(escapeRegExp(fromName), 'g'), toName);
  }
  return next.replace(/无名之人/g, toName);
}

function applyPlayerRename(session, nextName) {
  if (!session || !session.gameState) throw new Error('会话不存在。');
  const normalizedName = validatePlayerName(nextName);
  const gs = session.gameState;
  repairPlayerNamingState(session);
  if (Number(gs.renameCount || 0) >= Number(gs.renameLimit || 0)) {
    throw new Error('这个存档的改名次数已经用完。');
  }
  const previousName = String(gs.name || '').trim() || '无名之人';
  if (previousName === normalizedName) {
    throw new Error('新姓名不能和当前姓名相同。');
  }

  gs.name = normalizedName;
  gs.nameSource = 'rename';
  gs.renameCount = Number(gs.renameCount || 0) + 1;

  if (session.scene) {
    ['text', 'summary', 'statusLine'].forEach((key) => {
      if (!session.scene[key]) return;
      session.scene[key] = replacePlayerNameText(session.scene[key], previousName, normalizedName);
    });
  }
  if (Array.isArray(session.choices)) {
    session.choices = session.choices.map((choice) => {
      if (!choice || typeof choice !== 'object') return choice;
      const nextChoice = { ...choice };
      ['text', 'actionText', 'hint'].forEach((key) => {
        if (nextChoice[key]) nextChoice[key] = replacePlayerNameText(nextChoice[key], previousName, normalizedName);
      });
      return nextChoice;
    });
  }
  ['lastResolutionSummary', 'lastRuleSummary', 'lastDeltaLine', 'endingSummary', 'endingBiography', 'endingCommentary', 'inheritanceSummary'].forEach((key) => {
    if (!gs[key]) return;
    gs[key] = replacePlayerNameText(gs[key], previousName, normalizedName);
  });
  if (session.memory) {
    if (Array.isArray(session.memory.openThreads)) {
      session.memory.openThreads = session.memory.openThreads.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const nextItem = { ...item };
        ['title', 'summary', 'note'].forEach((key) => {
          if (nextItem[key]) nextItem[key] = replacePlayerNameText(nextItem[key], previousName, normalizedName);
        });
        return nextItem;
      });
    }
    if (Array.isArray(session.memory.summaries)) {
      session.memory.summaries = session.memory.summaries.map((item) => replacePlayerNameText(item, previousName, normalizedName));
    }
    if (Array.isArray(session.memory.retrievalFacts)) {
      session.memory.retrievalFacts = session.memory.retrievalFacts.map((item) => {
        if (!item) return item;
        if (typeof item === 'string') return replacePlayerNameText(item, previousName, normalizedName);
        if (typeof item === 'object' && item.text) {
          return { ...item, text: replacePlayerNameText(item.text, previousName, normalizedName) };
        }
        return item;
      });
    }
  }

  session.saveTime = new Date().toISOString();
  saveSession(session);
  return session;
}

function normalizeLegacyActionText(session, value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/(^action:|^travel:|^joinsect:|^origin:|^background:|^placeholder:)/.test(text)) return text;

  const appointMatch = text.match(/^action:govern:([^:]+):(appoint_[a-z_]+)$/);
  if (appointMatch) {
    const relationName = relationNameById(session, appointMatch[1]);
    const roleId = String(appointMatch[2] || '').replace(/^appoint_/, '');
    const slotLabel = RETINUE_SLOT_LABELS[roleId] || '职司';
    return relationName ? `任${relationName}掌${slotLabel}` : `任人掌${slotLabel}`;
  }

  const appointStatusMatch = text.match(/^placeholder:appoint:([^:]+):(assigned|vacant)$/);
  if (appointStatusMatch) {
    const slotLabel = RETINUE_SLOT_LABELS[appointStatusMatch[1]] || '职司';
    return appointStatusMatch[2] === 'assigned' ? `${slotLabel}当前有人在任` : `${slotLabel}暂缺人手`;
  }

  const actionWithTargetMatch = text.match(/^action:([a-z_]+):([^:]+):([a-z_]+)$/);
  if (actionWithTargetMatch) {
    const [, kind, targetId, mode] = actionWithTargetMatch;
    if (mode === 'historical_lead' || mode === 'recruit_probe' || mode === 'recruit') {
      const relationName = relationNameById(session, targetId);
      if (mode === 'historical_lead') return relationName ? `顺线接触${relationName}` : ACTION_MODE_LABELS[mode];
      if (mode === 'recruit_probe') return relationName ? `试探${relationName}入队` : ACTION_MODE_LABELS[mode];
      if (mode === 'recruit') return relationName ? `延揽${relationName}入队` : ACTION_MODE_LABELS[mode];
    }
    if (mode === 'retinue_talk') {
      const relationName = relationNameById(session, targetId);
      return relationName ? `找${relationName}谈事` : ACTION_MODE_LABELS[mode];
    }
    if (mode === 'retinue_counsel') {
      const relationName = relationNameById(session, targetId);
      return relationName ? `向${relationName}问策` : ACTION_MODE_LABELS[mode];
    }
    if (mode === 'retinue_companion') {
      const relationName = relationNameById(session, targetId);
      return relationName ? `与${relationName}同行` : ACTION_MODE_LABELS[mode];
    }
    if (kind === 'sect') {
      const sectName = SECT_NAME_BY_ID.get(targetId) || targetId;
      if (mode === 'outer_visit') return `拜山${sectName}`;
      if (mode === 'outer_study') return `借观${sectName}演武`;
    }
  }

  const actionMatch = text.match(/^action:([a-z_]+):([a-z_]+)$/);
  if (actionMatch) {
    const mode = actionMatch[2];
    return ACTION_MODE_LABELS[mode] || text;
  }

  const travelMatch = text.match(/^travel:([^:]+)$/);
  if (travelMatch) {
    return `前往${CITY_NAME_BY_ID.get(travelMatch[1]) || travelMatch[1]}`;
  }

  const joinSectMatch = text.match(/^joinsect:([^:]+)$/);
  if (joinSectMatch) {
    return `投身${SECT_NAME_BY_ID.get(joinSectMatch[1]) || joinSectMatch[1]}`;
  }

  const originMatch = text.match(/^origin:([^:]+)$/);
  if (originMatch) {
    return `选定${CITY_NAME_BY_ID.get(originMatch[1]) || originMatch[1]}为落脚之地`;
  }

  return text;
}

function repairLegacyUiArtifacts(session) {
  if (!session || !session.gameState) return;
  if (session.gameState.lastRetinueFeedback && session.gameState.lastRetinueFeedback.actionText) {
    session.gameState.lastRetinueFeedback.actionText = normalizeLegacyActionText(session, session.gameState.lastRetinueFeedback.actionText);
  }
  if (session.gameState.lastSkillFeedback && session.gameState.lastSkillFeedback.actionText) {
    session.gameState.lastSkillFeedback.actionText = normalizeLegacyActionText(session, session.gameState.lastSkillFeedback.actionText);
  }
  if (session.memory && Array.isArray(session.memory.recentActions)) {
    session.memory.recentActions = session.memory.recentActions.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const next = { ...item };
      if (next.raw) next.raw = normalizeLegacyActionText(session, next.raw);
      return next;
    });
  }
}

function repairGuestAccess(session) {
  if (!session || typeof session !== 'object') return;
  if (session.ownerUserId) {
    session.guestAccess = null;
    return;
  }
  session.guestAccess = normalizeGuestAccess(session.guestAccess);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function sessionPath(sessionId) {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

function logPath(sessionId) {
  return path.join(LOG_DIR, `${sessionId}.jsonl`);
}

function readSessionSummary(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      sessionId: String(parsed && parsed.sessionId || '').trim(),
      ownerUserId: String(parsed && parsed.ownerUserId || '').trim(),
      saveTime: String(parsed && parsed.saveTime || '').trim(),
      phase: String(parsed && parsed.world && parsed.world.phase || '').trim(),
      turn: Number(parsed && parsed.world && parsed.world.turn || 0)
    };
  } catch (error) {
    return null;
  }
}

function repairHistoricalRoster(session) {
  const gs = session && session.gameState;
  if (!gs || !gs.backgroundId) return;

  const currentRelations = Array.isArray(gs.relationships) ? gs.relationships.filter(Boolean) : [];
  const expectedHistorical = buildRelationRoster(gs.backgroundId).filter((item) => item && item.isHistorical);
  if (!expectedHistorical.length) return;

  const currentMap = new Map(currentRelations.filter((item) => item && item.id).map((item) => [item.id, item]));
  const mergedHistorical = expectedHistorical.map((item) => currentMap.get(item.id) || item);
  const historicalIds = new Set(mergedHistorical.map((item) => item.id));
  const defaultHistoricalStatus = '你们已经互相听过名字，但还远没到能托付后背的时候。';
  const hasHistoricalProgress = (relation) => {
    if (!relation || !relation.isHistorical) return false;
    if (Number(relation.trust || 0) > 0 || Number(relation.affection || 0) > 0 || Number(relation.loyalty || 0) > 0 || Number(relation.rivalry || 0) > 0) return true;
    if (relation.bondKey) return true;
    if (relation.intimacyTag && relation.intimacyTag !== '初识') return true;
    if (relation.status && relation.status !== defaultHistoricalStatus) return true;
    return false;
  };
  const others = currentRelations.filter((item) => !historicalIds.has(item.id) && (!item.isHistorical || hasHistoricalProgress(item)));
  gs.relationships = mergedHistorical.concat(others);
}

function repairHistoricalRelations(session) {
  const relations = session && session.gameState && Array.isArray(session.gameState.relationships)
    ? session.gameState.relationships
    : null;
  if (!relations) return;

  session.gameState.relationships = relations.map((relation) => {
    if (!relation || !relation.id) return relation;
    const persona = getHistoricalPersona(relation.id);
    if (!persona) return relation;
    return {
      ...relation,
      isHistorical: true,
      summary: persona.personaAnchor || relation.summary || '',
      personaAnchor: persona.personaAnchor || relation.personaAnchor || '',
      speechStyle: persona.speechStyle || relation.speechStyle || '',
      conductStyle: persona.conductStyle || relation.conductStyle || '',
      martialRating: Number(persona.martialRating || relation.martialRating || 0),
      strategyRating: Number(persona.strategyRating || relation.strategyRating || 0),
      signatureSkills: Array.isArray(persona.signatureSkills) ? persona.signatureSkills.slice() : (relation.signatureSkills || []),
      values: Array.isArray(persona.values) ? persona.values.slice() : (relation.values || []),
      dislikes: Array.isArray(persona.dislikes) ? persona.dislikes.slice() : (relation.dislikes || []),
      promptFocus: persona.promptFocus || relation.promptFocus || ''
    };
  });
}

function repairExtraRoster(session) {
  const gs = session && session.gameState;
  if (!gs || !gs.backgroundId) return;

  const currentRelations = Array.isArray(gs.relationships) ? gs.relationships.filter(Boolean) : [];
  const expectedExtra = buildRelationRoster(gs.backgroundId).filter((item) => item && item.isExtraCharacter);
  if (!expectedExtra.length) return;

  const currentMap = new Map(currentRelations.filter((item) => item && item.id).map((item) => [item.id, item]));
  const historicalIds = new Set(currentRelations.filter((item) => item && item.isHistorical).map((item) => item.id));
  const mergedExtra = expectedExtra.map((item) => currentMap.get(item.id) || item);
  const hasVisibleExtra = mergedExtra.some((item) => item && isRelationMet(item));
  if (!hasVisibleExtra) {
    const starter = mergedExtra[0];
    if (starter) {
      Object.assign(starter, withRelationVisibility(starter, 'met'));
      starter.trust = Math.max(4, Number(starter.trust || 0));
      starter.loyalty = Math.max(1, Number(starter.loyalty || 0));
    }
  }

  const others = currentRelations.filter((item) => item && !historicalIds.has(item.id) && !item.isExtraCharacter);
  const historical = currentRelations.filter((item) => item && historicalIds.has(item.id));
  gs.relationships = historical.concat(others).concat(mergedExtra);
}

function repairHistoricalSummary(session) {
  const historical = session && session.gameState && session.gameState.historical;
  if (!historical || !historical.npcScores || typeof historical.npcScores !== 'object') return;

  const summary = Object.values(historical.npcScores)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 3)
    .map((item) => {
      const persona = getHistoricalPersona(item.id);
      if (!persona) return '';
      return [
        item.name || persona.name || item.id,
        `关注度${Math.round(item.score || 0)}`,
        persona.personaAnchor || '',
        persona.promptFocus || ''
      ].filter(Boolean).join('：');
    })
    .filter(Boolean)
    .join('；');

  if (summary) {
    historical.lastNpcSummary = summary;
  }
}

function repairFatigueChannels(session) {
  const gs = session && session.gameState;
  if (!gs || typeof gs !== 'object') return;
  ['fatigueCombat', 'fatigueTravel', 'fatigueMental'].forEach((key) => {
    if (!Number.isFinite(Number(gs[key]))) gs[key] = 0;
    gs[key] = Math.max(0, Math.round(Number(gs[key] || 0)));
  });
  gs.fatigue = Math.max(0, Math.min(100, Math.round(Number(gs.fatigue || 0))));

  const sum = Number(gs.fatigueCombat || 0) + Number(gs.fatigueTravel || 0) + Number(gs.fatigueMental || 0);
  if (gs.fatigue <= 0) {
    gs.fatigueCombat = 0;
    gs.fatigueTravel = 0;
    gs.fatigueMental = 0;
    return;
  }
  if (sum <= 0) {
    gs.fatigueCombat = 0;
    gs.fatigueTravel = 0;
    gs.fatigueMental = gs.fatigue;
    return;
  }

  const scale = gs.fatigue / sum;
  const buckets = [
    { key: 'fatigueCombat', exact: Number(gs.fatigueCombat || 0) * scale },
    { key: 'fatigueTravel', exact: Number(gs.fatigueTravel || 0) * scale },
    { key: 'fatigueMental', exact: Number(gs.fatigueMental || 0) * scale }
  ];
  let assigned = 0;
  buckets.forEach((item) => {
    item.base = Math.floor(item.exact);
    item.remainder = item.exact - item.base;
    assigned += item.base;
  });
  buckets
    .slice()
    .sort((left, right) => right.remainder - left.remainder)
    .slice(0, Math.max(0, gs.fatigue - assigned))
    .forEach((item) => {
      item.base += 1;
    });
  buckets.forEach((item) => {
    gs[item.key] = item.base;
  });
}

function repairPlayingChoices(session) {
  if (!session || !session.world || session.world.phase !== 'playing') return;
  if (!session.gameState || typeof session.gameState !== 'object') return;
  applyPathSnapshot(session.gameState);
  ensureRetinueState(session);
  ensureDramaticLayer(session.gameState);
  ensureWorldPerceptionState(session.gameState);
  ensureWorldFermentationState(session.gameState);
  ensureSoftState(session.gameState);
  repairFatigueChannels(session);
  ensureCityState(session);
  refreshTerritorySummary(session);
  if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastCityReport')) {
    session.gameState.lastCityReport = null;
  }
  if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastNarrativeEcho')) {
    session.gameState.lastNarrativeEcho = null;
  }

  const currentChoices = Array.isArray(session.choices) ? session.choices.filter(Boolean) : [];
  const fixedChoices = createActionChoices(session).map((item) => ({
    ...item,
    source: item.source || 'fixed'
  }));
  const dynamicChoices = currentChoices
    .filter((item) => item && item.source === 'dynamic' && item.id && item.text)
    .slice(0, 3)
    .map((item) => ({ ...item, source: 'dynamic' }));
  session.choices = dynamicChoices.concat(fixedChoices);
}

function repairSetupChoices(session) {
  if (!session || !session.world) return;
  const phase = String(session.world.phase || '').trim();
  if (phase === 'choose_background') {
    session.choices = createBackgroundChoices();
    return;
  }
  if (phase === 'choose_origin') {
    session.choices = createOriginChoices();
  }
}

function repairLegacyFoodSupply(session) {
  if (!session || !session.gameState) return;
  const gs = session.gameState;
  if (!Array.isArray(gs.items)) gs.items = [];
  if (!Array.isArray(gs.foodDiscovery)) gs.foodDiscovery = [];
  if (Object.prototype.hasOwnProperty.call(gs, 'foodSupplyMigration')) return;

  const hasFoodItem = gs.items.some((item) => item && String(item.itemType || '') === 'food' && Number(item.count || 0) > 0);
  const hasFoodDiscovery = gs.foodDiscovery.length > 0;
  if (hasFoodItem || hasFoodDiscovery) {
    gs.foodSupplyMigration = 'skipped_existing_food_state_v1';
    return;
  }

  const starterFoods = FOOD_DEFINITIONS
    .filter((item) => item && item.rarity === 'common')
    .slice(0, 2)
    .map((item) => cloneFoodItem(item.id, 1))
    .filter(Boolean);
  if (starterFoods.length) {
    gs.items = gs.items.concat(starterFoods);
    gs.foodDiscovery = starterFoods.map((item) => item.foodId);
  }
  gs.foodSupplyMigration = 'granted_starter_food_v1';
}

function saveSession(session) {
  ensureDataDir();
  if (session && session.memory) session.memory = ensureMemoryState(session.memory);
  if (session && session.world && session.gameState) ensureLifecycleState(session);
  if (session && session.gameState) {
    ensureDramaticLayer(session.gameState);
    ensureWorldPerceptionState(session.gameState);
    ensureWorldFermentationState(session.gameState);
    ensureSoftState(session.gameState);
  }
  if (session && session.world) {
    ensureCityState(session);
    refreshTerritorySummary(session);
  }
  if (session && session.gameState) {
    session.gameState.skills = ensureBaseSkills(session.gameState.skills);
    repairFatigueChannels(session);
    ensureSoftState(session.gameState);
    repairLegacyFoodSupply(session);
    if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastSkillFeedback')) {
      session.gameState.lastSkillFeedback = null;
    }
    if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastCityReport')) {
      session.gameState.lastCityReport = null;
    }
    if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastNarrativeEcho')) {
      session.gameState.lastNarrativeEcho = null;
    }
  }
  repairGuestAccess(session);
  repairAnonymousPlayerProfile(session);
  repairPlayerNamingState(session);
  repairHistoricalRoster(session);
  repairHistoricalRelations(session);
  repairExtraRoster(session);
  repairHistoricalSummary(session);
  repairSetupChoices(session);
  repairPlayingChoices(session);
  repairLegacyUiArtifacts(session);
  if (session && session.scene) {
    session.scene = repairScene(session.scene, session.scene.text || '');
  }
  session.saveTime = new Date().toISOString();
  fs.writeFileSync(sessionPath(session.sessionId), JSON.stringify(session, null, 2), 'utf8');
}

function loadSession(sessionId) {
  ensureDataDir();
  const filePath = sessionPath(sessionId);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  let session = null;
  try {
    session = JSON.parse(raw);
  } catch (error) {
    console.warn(`[session-store] failed to parse session ${sessionId}: ${error.message}`);
    return null;
  }
  session.memory = ensureMemoryState(session.memory);
  if (session && session.world && session.gameState) ensureLifecycleState(session);
  if (session && session.gameState) {
    ensureDramaticLayer(session.gameState);
    ensureWorldPerceptionState(session.gameState);
    ensureWorldFermentationState(session.gameState);
    ensureSoftState(session.gameState);
  }
  if (session && session.world) {
    ensureCityState(session);
    refreshTerritorySummary(session);
  }
  if (session && session.gameState) {
    session.gameState.skills = ensureBaseSkills(session.gameState.skills);
    repairFatigueChannels(session);
    ensureSoftState(session.gameState);
    repairLegacyFoodSupply(session);
    if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastSkillFeedback')) {
      session.gameState.lastSkillFeedback = null;
    }
    if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastCityReport')) {
      session.gameState.lastCityReport = null;
    }
    if (!Object.prototype.hasOwnProperty.call(session.gameState, 'lastNarrativeEcho')) {
      session.gameState.lastNarrativeEcho = null;
    }
  }
  repairGuestAccess(session);
  repairAnonymousPlayerProfile(session);
  repairPlayerNamingState(session);
  repairHistoricalRoster(session);
  repairHistoricalRelations(session);
  repairExtraRoster(session);
  repairHistoricalSummary(session);
  repairSetupChoices(session);
  repairPlayingChoices(session);
  repairLegacyUiArtifacts(session);
  if (session && session.scene) {
    session.scene = repairScene(session.scene, session.scene.text || '');
  }
  const repairedRaw = JSON.stringify(session, null, 2);
  if (repairedRaw !== raw) {
    session.saveTime = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  }
  return session;
}

function createSession(ownerUserId, options = {}) {
  const session = createSessionState(options || {});
  session.sessionId = createId('tk');
  session.ownerUserId = ownerUserId || '';
  session.guestAccess = session.ownerUserId ? null : normalizeGuestAccess();
  saveSession(session);
  return session;
}

function findLatestSessionByOwnerUserId(ownerUserId) {
  ensureDataDir();
  const normalizedOwnerUserId = String(ownerUserId || '').trim();
  if (!normalizedOwnerUserId) return null;

  const files = fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((entry) => entry && entry.isFile() && /\.json$/i.test(entry.name))
    .map((entry) => path.join(DATA_DIR, entry.name));

  const summaries = files
    .map((filePath) => {
      const summary = readSessionSummary(filePath);
      if (!summary || summary.ownerUserId !== normalizedOwnerUserId || !summary.sessionId) return null;
      const stats = fs.statSync(filePath);
      const saveTimeValue = summary.saveTime ? Date.parse(summary.saveTime) : NaN;
      const phase = String(summary.phase || '').trim();
      const turn = Number(summary.turn || 0);
      return {
        sessionId: summary.sessionId,
        phase,
        turn,
        isEstablished: phase === 'playing' || phase === 'ended' || turn > 0,
        saveTimeValue: Number.isFinite(saveTimeValue) ? saveTimeValue : 0,
        mtimeValue: stats.mtimeMs || 0
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (Number(right.isEstablished) !== Number(left.isEstablished)) {
        return Number(right.isEstablished) - Number(left.isEstablished);
      }
      if (right.saveTimeValue !== left.saveTimeValue) return right.saveTimeValue - left.saveTimeValue;
      return right.mtimeValue - left.mtimeValue;
    });

  if (!summaries.length) return null;
  return loadSession(summaries[0].sessionId);
}

function applyInheritanceRestart(session, previous) {
  if (!previous || !previous.gameState || previous.world.phase !== 'ended') return session;
  const carryover = buildInheritanceCarryover(previous);
  const profile = carryover.profile || {};

  session.gameState.name = profile.name || session.gameState.name;
  session.gameState.gender = profile.gender || session.gameState.gender;
  session.gameState.genderLabel = profile.genderLabel || session.gameState.genderLabel;
  session.gameState.pronoun = profile.pronoun || session.gameState.pronoun;

  Object.keys(carryover.bonus || {}).forEach((key) => {
    session.gameState[key] = Number(session.gameState[key] || 0) + Number(carryover.bonus[key] || 0);
  });

  session.gameState.canInherit = false;
  session.gameState.inheritancePreview = carryover;
  session.gameState.inheritanceSummary = carryover.summary || '';
  session.gameState.skills = normalizeSkillList(ensureBaseSkills(session.gameState.skills).concat([normalizeSkillRecord(carryover.skill)]).filter(Boolean));
  applyPathSnapshot(session.gameState);

  session.scene.text = `我又回到了${session.world.dateLabel}。名字还是${session.gameState.name}，只是骨子里还留着上一局没散尽的手感。${carryover.summary || '一些说不清的余韵还在。'}现在这一生重新开始，仍得先替自己挑一条来路。`;
  session.scene.summary = `已继承部分余韵：${carryover.summary || '上一局留下了一点模糊手感'}。一切记忆与局势都已回到建安元年，请重新选择出身。`;
  session.scene.statusLine = `前尘余韵已续 · ${session.gameState.name}请先选择出身`;
  return session;
}

function ensureBaseSkills(list) {
  const skills = normalizeSkillList(Array.isArray(list) ? list.filter(Boolean) : []);
  const hasBase = skills.some((item) => item && item.id === 'bare_survival');
  if (hasBase) return skills;
  return normalizeSkillList(skills.concat([
    normalizeSkillRecord({ id: 'bare_survival', name: '乱世自保', type: '基础', level: '熟练', effect: '资源不足时仍能维持最低行动效率。' })
  ]));
}

function appendSessionLog(sessionId, entry) {
  if (!sessionId || !entry) return;
  ensureDataDir();
  fs.appendFileSync(logPath(sessionId), `${JSON.stringify(entry)}\n`, 'utf8');
}

function resetSession(sessionId, options) {
  const previous = loadSession(sessionId);
  const resetOptions = options || {};
  const session = createSessionState(resetOptions);
  session.sessionId = sessionId;
  session.ownerUserId = previous && previous.ownerUserId ? previous.ownerUserId : '';
  session.guestAccess = session.ownerUserId ? null : normalizeGuestAccess(previous && previous.guestAccess);
  if (previous && previous.settings) {
    session.settings = Object.assign({}, session.settings, previous.settings);
  }
  if (resetOptions && resetOptions.inherit) {
    applyInheritanceRestart(session, previous);
  }
  const existingLog = logPath(sessionId);
  if (fs.existsSync(existingLog)) fs.unlinkSync(existingLog);
  saveSession(session);
  return session;
}

module.exports = {
  GUEST_TRIAL_TURN_LIMIT,
  createSession,
  findLatestSessionByOwnerUserId,
  loadSession,
  applyPlayerRename,
  saveSession,
  resetSession,
  appendSessionLog,
  summarizeGuestAccess
};
