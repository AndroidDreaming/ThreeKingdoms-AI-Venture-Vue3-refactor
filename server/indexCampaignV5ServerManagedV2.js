const http = require('http');
const path = require('path');
const { DEFAULT_MODEL } = require('./game/chronicleV2Constants');
const { classifyIntent } = require('./game/chronicleV5IntentClassifier');
const { processAction } = require('./game/chronicleV5RulesEngine');
const { runDirectorTurn } = require('./game/chronicleV5Director');
const { NARRATION_CONFIG } = require('./game/chronicleV5NarrationConfigSafe');
const { repairScene, normalizeNarrationText, chooseNarrationText, chooseNarrationTextDetailed } = require('./game/chronicleV5NarrationGuard');
const { recordDynamicChoiceSet } = require('./game/chronicleV5Memory');
const { ensureDramaticLayer } = require('./game/chronicleV5DramaticLayer');
const {
  GUEST_TRIAL_TURN_LIMIT,
  createSession,
  findLatestSessionByOwnerUserId,
  loadSession,
  applyPlayerRename,
  resetSession,
  saveSession,
  appendSessionLog,
  summarizeGuestAccess
} = require('./game/chronicleV5SessionStore');
const { CONFIG_FILE, getProviderRuntimeConfig, getPublicRuntimeConfig, isProviderEnabled } = require('./config/runtimeConfig');
const {
  CONTENT_TYPES,
  getContentManifest,
  getDraftPreviewEntityList,
  saveDraftEntity,
  deleteDraftEntity,
  validateContentDraft,
  publishDraftContent
} = require('./game/contentRegistry');
const {
  DEFAULT_TURN_PACK_TURNS,
  DEFAULT_MONTH_CARD_DAYS,
  registerUser,
  loginUser,
  getUserByToken,
  revokeToken,
  grantTurnCredits,
  grantMonthCard,
  updateUserAccess,
  listUsers,
  summarizeAccess,
  canPlayTurn,
  recordTurnUsage,
  applyTrialCarryover,
  getAdminSeedCredentials
} = require('./auth/localAccessV2');
const {
  beginNdjson,
  parseRequest,
  readBody,
  sendJson,
  sendNotFound,
  serveStatic,
  setCors,
  writeStreamChunk
} = require('./lib/httpChronicle');

const PORT = process.env.PORT || 8111;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const STATIC_DIR = path.join(__dirname, '..', 'static');
const MESSAGE_GUEST_TRIAL_EXHAUSTED = '匿名试玩 10 回已用完。注册或登录后可继续试玩至总计 30 回。';
const MESSAGE_SESSION_NOT_FOUND = '会话不存在。';
const MESSAGE_ACTION_REQUIRED = '行动不能为空。';
const MESSAGE_NARRATION_FAILED = '续写失败。';
const MESSAGE_ACCESS_EXHAUSTED = '试玩已用完，且当前无可用回合或月卡，请购买回合包或月卡。';
const GAME_TITLE = '汉末风云录';
const AUTH_COOKIE_NAME = 'tk_refactor_auth_token_v1';

function toSnapshot(session) {
  if (session && session.gameState) ensureDramaticLayer(session.gameState);
  const safeScene = repairScene(session.scene || {}, session.scene && session.scene.text ? session.scene.text : '');
  const playAccess = session.ownerUserId
    ? Object.assign({ isGuest: false }, summarizeAccess(canPlayTurn(session.ownerUserId).access))
    : summarizeGuestAccess(session.guestAccess);
  return {
    sessionId: session.sessionId,
    saveTime: session.saveTime,
    ownerUserId: session.ownerUserId || '',
    playAccess,
    gameState: session.gameState,
    world: session.world,
    pendingThreads: session.memory && Array.isArray(session.memory.openThreads) ? session.memory.openThreads : [],
    scene: safeScene,
    choices: session.choices,
    settings: getPublicRuntimeConfig()
  };
}

function dedupeChoices(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((item) => item && item.id && item.text)
    .filter((item) => {
      const key = `${item.id}::${item.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function selectDynamicChoiceBackfill(existingChoices, fallbackChoices, limit = 3) {
  const current = dedupeChoices(existingChoices).slice(0, limit);
  const occupiedOrders = new Set(
    current
      .map((item) => Number(item && item.order))
      .filter((value) => Number.isFinite(value))
  );
  const missingOrders = Array.from({ length: limit }, (_, index) => index).filter((index) => !occupiedOrders.has(index));
  const usedKeys = new Set(current.map((item) => `${item.id}::${item.text}`));
  const pool = dedupeChoices(fallbackChoices)
    .filter((item) => item && item.id && item.text && !usedKeys.has(`${item.id}::${item.text}`));
  const selected = [];

  missingOrders.forEach((order) => {
    if (!pool.length) return;
    const exactIndex = pool.findIndex((item) => Number(item.order) === order);
    const index = exactIndex >= 0 ? exactIndex : 0;
    const choice = pool.splice(index, 1)[0];
    if (!choice) return;
    selected.push({
      ...choice,
      source: 'dynamic',
      order
    });
    usedKeys.add(`${choice.id}::${choice.text}`);
  });

  return selected;
}

function normalizeChoiceMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const outcomes = Array.isArray(meta.outcomes)
    ? meta.outcomes.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : [];
  const effect = meta.effect && typeof meta.effect === 'object' && !Array.isArray(meta.effect)
    ? meta.effect
    : null;
  const normalized = {
    choiceId: String(meta.choiceId || meta.id || '').trim(),
    text: String(meta.text || '').trim(),
    actionKind: String(meta.actionKind || '').trim(),
    slotRole: String(meta.slotRole || '').trim(),
    source: String(meta.source || 'dynamic').trim() || 'dynamic',
    frontierId: String(meta.frontierId || '').trim(),
    noveltyKey: String(meta.noveltyKey || '').trim(),
    target: String(meta.target || '').trim(),
    targetId: String(meta.targetId || '').trim(),
    targetName: String(meta.targetName || '').trim(),
    outcomes,
    effect,
    order: meta.order !== undefined && meta.order !== null ? Number(meta.order) : -1
  };
  return Object.values(normalized).some((item) => item && (!(Array.isArray(item)) || item.length))
    ? normalized
    : null;
}

function mergeChoices(fixedChoices, dynamicChoices) {
  const fixed = dedupeChoices(fixedChoices).map((item) => ({ ...item, source: item.source || 'fixed' }));
  const dynamic = dedupeChoices(dynamicChoices)
    .filter((item) => !fixed.some((fixedItem) => fixedItem.id === item.id || fixedItem.text === item.text))
    .slice(0, 3)
    .map((item) => ({ ...item, source: 'dynamic' }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return dynamic.concat(fixed);
}

async function streamPlainText(res, text) {
  const normalized = normalizeNarrationText(text, '');
  const chunks = String(normalized || '').match(/.{1,24}/g) || [''];
  for (const chunk of chunks) {
    writeStreamChunk(res, { type: 'delta', text: chunk });
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  return normalized;
}

function emitChoicesReset(res, choices) {
  writeStreamChunk(res, {
    type: 'choices_reset',
    choices: dedupeChoices(choices).map((item) => ({
      ...item,
      source: item.source || 'fixed'
    }))
  });
}

function canEmitNarrativeDynamicChoices(session) {
  return !!(session && session.world && session.world.phase === 'playing');
}

function clearNarrativeDynamicChoices(session) {
  if (!session) return;
  session.choices = Array.isArray(session.choices)
    ? session.choices.filter((item) => item && item.source !== 'dynamic')
    : [];
}

function setDynamicChoiceTelemetry(session, meta) {
  if (!session) return;
  if (!session.scene || typeof session.scene !== 'object') session.scene = {};
  session.scene.dynamicChoicesMode = meta && meta.mode ? meta.mode : '';
  session.scene.dynamicChoicesReason = meta && meta.reason ? meta.reason : '';
  session.scene.dynamicChoicesDetail = meta && meta.detail ? meta.detail : '';
}

function setNarrationDiagnostics(session, diagnostics) {
  if (!session) return;
  if (!session.scene || typeof session.scene !== 'object') session.scene = {};
  session.scene.narrationDiagnostics = diagnostics && typeof diagnostics === 'object'
    ? JSON.parse(JSON.stringify(diagnostics))
    : null;
}

function logTurnNarrationDiagnostics(session, directedTurn) {
  const diagnostics = directedTurn && directedTurn.directorMeta && directedTurn.directorMeta.diagnostics;
  if (!diagnostics || typeof diagnostics !== 'object') return;
  const sessionId = session && session.sessionId ? session.sessionId : 'unknown';
  const endpoint = diagnostics.endpoint || (Array.isArray(diagnostics.endpointCandidates) ? diagnostics.endpointCandidates[0] : '');
  const summary = [
    `session=${sessionId}`,
    `status=${diagnostics.status || 'unknown'}`,
    endpoint ? `endpoint=${endpoint}` : '',
    diagnostics.httpStatus !== undefined ? `http=${diagnostics.httpStatus}` : '',
    diagnostics.connectMs !== undefined ? `connectMs=${diagnostics.connectMs}` : '',
    diagnostics.firstChunkAtMs !== undefined ? `firstChunkAt=${diagnostics.firstChunkAtMs}` : '',
    diagnostics.firstPayloadAtMs !== undefined ? `firstPayloadAt=${diagnostics.firstPayloadAtMs}` : '',
    diagnostics.firstTextDeltaAtMs !== undefined ? `firstTextAt=${diagnostics.firstTextDeltaAtMs}` : '',
    diagnostics.chunkCount !== undefined ? `chunks=${diagnostics.chunkCount}` : '',
    diagnostics.payloadCount !== undefined ? `payloads=${diagnostics.payloadCount}` : '',
    diagnostics.parseMissCount !== undefined ? `parseMiss=${diagnostics.parseMissCount}` : '',
    diagnostics.reasoningOnlyCount !== undefined ? `reasoningOnly=${diagnostics.reasoningOnlyCount}` : '',
    diagnostics.markerSeen !== undefined ? `marker=${diagnostics.markerSeen ? 1 : 0}` : '',
    diagnostics.proposalParsed !== undefined ? `proposal=${diagnostics.proposalParsed ? 1 : 0}` : '',
    diagnostics.proposalChoiceCount !== undefined ? `choices=${diagnostics.proposalChoiceCount}` : '',
    diagnostics.error ? `error=${diagnostics.error}` : ''
  ].filter(Boolean).join(' ');
  console.log(`[turn-narration] ${summary}`);
}

function estimateChoiceDraftRevealMs(choice) {
  const textLength = String((choice && choice.text) || '').length;
  const hintLength = String((choice && choice.hint) || '').length;
  const total = textLength + hintLength;
  return Math.max(320, Math.min(1100, 180 + total * 24));
}

async function emitDynamicChoices(res, session, dynamicChoices) {
  const list = dedupeChoices(dynamicChoices)
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      source: 'dynamic',
      order: item.order !== undefined && item.order !== null ? Number(item.order) : index
    }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  for (const choice of list) {
    writeStreamChunk(res, {
      type: 'choice_draft',
      draft: {
        slot: Number(choice.order || 0),
        source: 'dynamic',
        slotRole: choice.slotRole || '',
        slotRoleLabel: choice.slotRoleLabel || '',
        text: choice.text || '',
        hint: choice.hint || ''
      }
    });
    await new Promise((resolve) => setTimeout(resolve, estimateChoiceDraftRevealMs(choice)));
    session.choices = mergeChoices(session.choices, [choice]);
    writeStreamChunk(res, { type: 'choice', choice });
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
}

function getAuthToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const headerToken = String(req.headers['x-auth-token'] || '').trim();
  if (headerToken) return headerToken;
  return getCookieValue(req, AUTH_COOKIE_NAME);
}

function getCookieValue(req, name) {
  const cookieHeader = String(req.headers.cookie || '');
  if (!cookieHeader || !name) return '';
  const prefix = `${name}=`;
  const pair = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : '';
}

function setAuthCookie(res, token) {
  const safeToken = String(token || '').trim();
  const maxAge = safeToken ? 60 * 60 * 24 * 30 : 0;
  const value = safeToken ? encodeURIComponent(safeToken) : '';
  res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`);
}

function getCurrentUser(req) {
  return getUserByToken(getAuthToken(req));
}

function sendUnauthorized(res, message) {
  sendJson(res, 401, {
    message: message || '请先登录后再进入游戏。'
  });
}

function sendForbidden(res, message, extra) {
  sendJson(res, 403, Object.assign({
    message: message || '当前没有访问权限。'
  }, extra || {}));
}

function requireUser(res, user, message) {
  if (user) return true;
  sendUnauthorized(res, message);
  return false;
}

function requireAdmin(res, user) {
  if (!requireUser(res, user)) return false;
  if (user.isAdmin === true) return true;
  sendForbidden(res, '需要管理员权限。');
  return false;
}

function loadAccessibleSession(res, sessionId, user) {
  const session = loadSession(sessionId);
  if (!session) {
    sendJson(res, 404, { message: MESSAGE_SESSION_NOT_FOUND });
    return null;
  }
  if (session.ownerUserId && !user) {
    sendUnauthorized(res, '该存档已绑定账号，请先登录。');
    return null;
  }
  if (session.ownerUserId && session.ownerUserId !== user.id) {
    sendForbidden(res, '这个存档不属于当前账号。');
    return null;
  }
  return session;
}

function sendAuthPayload(res, payload) {
  if (payload && payload.token) setAuthCookie(res, payload.token);
  sendJson(res, 200, Object.assign({}, payload, {
    adminSeed: getAdminSeedCredentials()
  }));
}

function sendAccessExhausted(res, access) {
  sendForbidden(res, MESSAGE_ACCESS_EXHAUSTED, {
    code: 'ACCESS_EXHAUSTED',
    access
  });
}

function sendGuestTrialExhausted(res, access) {
  sendForbidden(res, MESSAGE_GUEST_TRIAL_EXHAUSTED, {
    code: 'GUEST_TRIAL_EXHAUSTED',
    access
  });
}

function consumeGuestTurn(session) {
  const access = summarizeGuestAccess(session && session.guestAccess);
  if (!access.canPlay) return access;
  session.guestAccess = {
    trialTurnLimit: access.trialTurnLimit,
    trialTurnsUsed: access.trialTurnsUsed + 1
  };
  return summarizeGuestAccess(session.guestAccess);
}

async function handleTurnStreamSafe(res, session, body) {
  if (!session) {
    sendJson(res, 404, { message: MESSAGE_SESSION_NOT_FOUND });
    return;
  }

  session.scene = repairScene(session.scene || {}, session.scene && session.scene.text ? session.scene.text : '');

  const actionText = String(body && body.actionText ? body.actionText : '').trim();
  if (!actionText) {
    sendJson(res, 400, { message: MESSAGE_ACTION_REQUIRED });
    return;
  }

  if (session.ownerUserId) {
    const accessCheck = canPlayTurn(session.ownerUserId);
    if (!accessCheck.allowed) {
      sendAccessExhausted(res, accessCheck.access);
      return;
    }
  } else {
    const guestAccess = summarizeGuestAccess(session.guestAccess);
    if (!guestAccess.canPlay) {
      sendGuestTrialExhausted(res, guestAccess);
      return;
    }
  }

  const action = classifyIntent(actionText);
  const choiceMeta = normalizeChoiceMeta(body && body.choiceMeta);
  if (choiceMeta) {
    action.source = choiceMeta.source || 'dynamic';
    action.dynamicChoiceMeta = choiceMeta;
    if (!action.target && choiceMeta.targetId) action.target = choiceMeta.targetId;
    if (!action.targetName && choiceMeta.targetName) action.targetName = choiceMeta.targetName;
    if (!action.mode && choiceMeta.slotRole) action.mode = choiceMeta.slotRole;
  }
  beginNdjson(res);
  writeStreamChunk(res, { type: 'status', message: NARRATION_CONFIG.status.turnAccepted });

  try {
    const result = processAction(session, action);
    if (
      session.memory
      && session.memory.lastStructuredLog
      && session.memory.lastStructuredLog.key
      && session.memory.lastPersistedLogKey !== session.memory.lastStructuredLog.key
    ) {
      appendSessionLog(session.sessionId, session.memory.lastStructuredLog);
      session.memory.lastPersistedLogKey = session.memory.lastStructuredLog.key;
    }

    let storyText = '';

    if (result.interactiveOnly) {
      if (result.statusMessage) {
        writeStreamChunk(res, { type: 'status', message: result.statusMessage });
      }
      emitChoicesReset(res, session.choices || []);
      if (!session.ownerUserId) consumeGuestTurn(session);
      saveSession(session);
      if (session.ownerUserId) {
        recordTurnUsage(session.ownerUserId);
      }
      writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
      res.end();
      return;
    }

    if (!result.prompt) {
      const ruleOnlyText = normalizeNarrationText(result.fallbackText, session.scene.text || '');
      await streamPlainText(res, ruleOnlyText);
      storyText += ruleOnlyText;
      session.scene.text = storyText;
      session.scene.mode = 'fallback';
      session.scene.narrationReason = 'rule_only';
      session.scene.narrationDetail = 'rule-only';
      setNarrationDiagnostics(session, {
        status: 'rule_only',
        source: 'rules_engine'
      });
      writeStreamChunk(res, { type: 'narration_done' });
      clearNarrativeDynamicChoices(session);
      emitChoicesReset(res, session.choices);
      const disabledMeta = { mode: 'disabled', reason: 'rule_only_dynamic_hidden', detail: 'rule-only-no-dynamic-choices' };
      setDynamicChoiceTelemetry(session, disabledMeta);
      recordDynamicChoiceSet(session, [], { source: 'disabled' });
      if (!session.ownerUserId) consumeGuestTurn(session);
      saveSession(session);
      if (session.ownerUserId) {
        recordTurnUsage(session.ownerUserId);
      }
      writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
      res.end();
      return;
    }

    const runtimeSettings = getProviderRuntimeConfig();
    if (canEmitNarrativeDynamicChoices(session) && session.world.phase !== 'ended') {
      clearNarrativeDynamicChoices(session);
      emitChoicesReset(res, session.choices);
    }
    const directedTurn = await runDirectorTurn({
      session,
      action,
      turnResult: result,
      runtimeSettings,
      onStatus: async(message) => writeStreamChunk(res, { type: 'status', message }),
      onText: async(text) => {
        storyText += text;
        session.scene.text = storyText;
        writeStreamChunk(res, { type: 'delta', text });
      },
      onDraft: async(draft) => writeStreamChunk(res, { type: 'choice_draft', draft }),
      onChoice: async(choice) => {
        session.choices = mergeChoices(session.choices, [choice]);
        writeStreamChunk(res, { type: 'choice', choice });
      }
    });
    const narration = directedTurn && directedTurn.narration ? directedTurn.narration : {
      text: result.fallbackText,
      mode: 'fallback',
      reason: 'director_missing',
      detail: 'director-missing-response'
    };
    if (narration && narration.mode === 'fallback') {
      const fallbackReason = narration.reason
        ? `本回模型演绎已回退：${narration.reason}`
        : '本回模型演绎已回退到本地导演兜底。';
      writeStreamChunk(res, { type: 'status', message: fallbackReason });
    }

    const finalNarration = chooseNarrationTextDetailed(storyText, narration.text, result.fallbackText);
    session.scene.text = finalNarration.text;
    session.scene = repairScene(session.scene, result.fallbackText);
    session.scene.mode = narration.mode || 'fallback';
    session.scene.narrationReason = narration.reason || '';
    session.scene.finalNarrationSource = finalNarration.source || '';
    session.scene.narrationDetail = [
      narration.detail || '',
      finalNarration && finalNarration.source ? `final-source:${finalNarration.source}` : '',
      directedTurn && directedTurn.directorMeta && directedTurn.directorMeta.detail
        ? directedTurn.directorMeta.detail
        : ''
    ].filter(Boolean).join(' || ');
    setNarrationDiagnostics(session, directedTurn && directedTurn.directorMeta ? directedTurn.directorMeta.diagnostics : null);
    logTurnNarrationDiagnostics(session, directedTurn);
    writeStreamChunk(res, { type: 'narration_done' });

    let dynamicChoiceMeta = directedTurn && directedTurn.dynamicChoiceMeta
      ? directedTurn.dynamicChoiceMeta
      : {
        mode: 'disabled',
        reason: 'dynamic_skipped',
        detail: 'dynamic-choices-skipped'
      };

    if (canEmitNarrativeDynamicChoices(session) && session.world.phase !== 'ended') {
      let dynamicChoices = Array.isArray(directedTurn && directedTurn.dynamicChoices)
        ? dedupeChoices(directedTurn.dynamicChoices).slice(0, 3)
        : [];

      session.choices = mergeChoices(session.choices, dynamicChoices);
      setDynamicChoiceTelemetry(session, dynamicChoiceMeta);
      recordDynamicChoiceSet(session, dynamicChoices, {
        source: dynamicChoiceMeta && dynamicChoiceMeta.mode ? dynamicChoiceMeta.mode : 'dynamic'
      });
    } else {
      session.choices = Array.isArray(session.choices)
        ? session.choices.filter((item) => item && item.source !== 'dynamic')
        : [];
      setDynamicChoiceTelemetry(session, dynamicChoiceMeta);
    }

    if (!session.ownerUserId) consumeGuestTurn(session);
    saveSession(session);
    if (session.ownerUserId) {
      recordTurnUsage(session.ownerUserId);
    }
    writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
    res.end();
  } catch (error) {
    writeStreamChunk(res, { type: 'error', message: error.message || MESSAGE_NARRATION_FAILED });
    res.end();
  }
}

async function routeApi(req, res) {
  const { pathname } = parseRequest(req);
  const currentUser = getCurrentUser(req);

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      sendAuthPayload(res, registerUser(body || {}));
    } catch (error) {
      sendJson(res, 400, { message: error.message || '注册失败。' });
    }
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      sendAuthPayload(res, loginUser(body || {}));
    } catch (error) {
      sendJson(res, 400, { message: error.message || '登录失败。' });
    }
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getAuthToken(req);
    if (token) revokeToken(token);
    setAuthCookie(res, '');
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    if (!requireUser(res, currentUser)) return;
    sendAuthPayload(res, { token: getAuthToken(req), user: currentUser });
    return;
  }

  if (pathname === '/api/session/current' && req.method === 'GET') {
    if (!requireUser(res, currentUser)) return;
    const session = findLatestSessionByOwnerUserId(currentUser.id);
    sendJson(res, 200, session ? toSnapshot(session) : null);
    return;
  }

  if (pathname === '/api/purchase/mock' && req.method === 'POST') {
    if (!requireUser(res, currentUser)) return;
    try {
      const body = await readBody(req);
      const channel = body && body.channel ? String(body.channel).trim() : 'mock';
      const productType = body && body.productType ? String(body.productType).trim() : 'turn_pack';
      let user = null;

      if (productType === 'month_card') {
        user = grantMonthCard(currentUser.id, body && body.days ? body.days : DEFAULT_MONTH_CARD_DAYS, channel);
      } else {
        user = grantTurnCredits(currentUser.id, body && body.turns ? body.turns : DEFAULT_TURN_PACK_TURNS, channel);
      }

      sendJson(res, 200, { user });
    } catch (error) {
      sendJson(res, 400, { message: error.message || '模拟购买失败。' });
    }
    return;
  }

  if (pathname === '/api/admin/users' && req.method === 'GET') {
    if (!requireAdmin(res, currentUser)) return;
    sendJson(res, 200, { users: listUsers() });
    return;
  }

  if (pathname === '/api/admin/access' && req.method === 'POST') {
    if (!requireAdmin(res, currentUser)) return;
    try {
      const body = await readBody(req);
      const user = updateUserAccess(body && body.username, body || {});
      sendJson(res, 200, { user });
    } catch (error) {
      sendJson(res, 400, { message: error.message || '权限更新失败。' });
    }
    return;
  }

  if (pathname === '/api/admin/content/manifest' && req.method === 'GET') {
    if (!requireAdmin(res, currentUser)) return;
    try {
      sendJson(res, 200, { manifest: getContentManifest() });
    } catch (error) {
      sendJson(res, 500, { message: error.message || '读取内容配置状态失败。' });
    }
    return;
  }

  if (pathname === '/api/admin/content/validate' && req.method === 'POST') {
    if (!requireAdmin(res, currentUser)) return;
    try {
      sendJson(res, 200, { validation: validateContentDraft() });
    } catch (error) {
      sendJson(res, 500, { message: error.message || '校验内容配置失败。' });
    }
    return;
  }

  if (pathname === '/api/admin/content/publish' && req.method === 'POST') {
    if (!requireAdmin(res, currentUser)) return;
    try {
      const result = publishDraftContent();
      const refreshed = require('./game/chronicleV5StateFactory').refreshContentSnapshot();
      sendJson(res, 200, Object.assign({}, result, { refreshed }));
    } catch (error) {
      sendJson(res, 400, {
        message: error.message || '发布内容配置失败。',
        validation: error.validation || null
      });
    }
    return;
  }

  const adminContentMatch = pathname.match(/^\/api\/admin\/content\/([a-zA-Z-]+)(?:\/([^/]+))?$/);
  if (adminContentMatch && ['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    if (!requireAdmin(res, currentUser)) return;
    const type = adminContentMatch[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const entityId = adminContentMatch[2] ? decodeURIComponent(adminContentMatch[2]) : '';
    if (!CONTENT_TYPES.includes(type)) {
      sendJson(res, 404, { message: '未知内容类型。' });
      return;
    }
    try {
      if (req.method === 'GET' && !entityId) {
        sendJson(res, 200, { type, items: getDraftPreviewEntityList(type) });
        return;
      }
      if (req.method === 'POST' && !entityId) {
        const body = await readBody(req);
        const item = saveDraftEntity(type, body || {});
        sendJson(res, 200, { type, item, validation: validateContentDraft() });
        return;
      }
      if (req.method === 'PUT' && entityId) {
        const body = await readBody(req);
        const item = saveDraftEntity(type, Object.assign({}, body || {}, { id: entityId }));
        sendJson(res, 200, { type, item, validation: validateContentDraft() });
        return;
      }
      if (req.method === 'DELETE' && entityId) {
        const item = deleteDraftEntity(type, entityId);
        sendJson(res, 200, { type, item, validation: validateContentDraft() });
        return;
      }
      sendJson(res, 405, { message: '不支持的内容配置操作。' });
    } catch (error) {
      sendJson(res, 400, { message: error.message || '内容配置操作失败。' });
    }
    return;
  }

  if (pathname === '/api/session' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      sendJson(res, 200, toSnapshot(createSession(currentUser ? currentUser.id : '', body || {})));
    } catch (error) {
      sendJson(res, 400, { message: error.message || '创建存档失败。' });
    }
    return;
  }

  const ownedSessionMatch = pathname.match(/^\/api\/session\/([^/]+)(?:\/(claim|settings|reset|rename|advance|turn\/stream))?$/);
  if (ownedSessionMatch) {
    const sessionId = ownedSessionMatch[1];
    const action = ownedSessionMatch[2];
    const session = loadAccessibleSession(res, sessionId, currentUser);
    if (!session) return;

    if (!action && req.method === 'GET') {
      sendJson(res, 200, toSnapshot(session));
      return;
    }

    if (action === 'claim' && req.method === 'POST') {
      if (!requireUser(res, currentUser)) return;
      if (session.ownerUserId && session.ownerUserId !== currentUser.id) {
        sendForbidden(res, '该存档已绑定其他账号。');
        return;
      }
      const guestUsedTurns = summarizeGuestAccess(session.guestAccess).trialTurnsUsed;
      if (guestUsedTurns > 0) {
        applyTrialCarryover(currentUser.id, guestUsedTurns);
      }
      session.ownerUserId = currentUser.id;
      session.guestAccess = null;
      saveSession(session);
      sendJson(res, 200, toSnapshot(session));
      return;
    }

    if (action === 'settings' && req.method === 'PUT') {
      sendJson(res, 403, {
        message: `模型配置由服务端统一管理，请修改 ${CONFIG_FILE} 后重启后端。`
      });
      return;
    }

    if (action === 'reset' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        sendJson(res, 200, toSnapshot(resetSession(session.sessionId, body || {})));
      } catch (error) {
        sendJson(res, 400, { message: error.message || '重开失败。' });
      }
      return;
    }

    if (action === 'rename' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        sendJson(res, 200, toSnapshot(applyPlayerRename(session, body && body.playerName)));
      } catch (error) {
        sendJson(res, 400, { message: error.message || '改名失败。' });
      }
      return;
    }

    if (action === 'advance' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const actionText = String(body && body.actionText ? body.actionText : '').trim();
        if (!actionText) {
          sendJson(res, 400, { message: MESSAGE_ACTION_REQUIRED });
          return;
        }
        const action = classifyIntent(actionText);
        const result = processAction(session, action);
        if (result && result.interactiveOnly && result.statusMessage) {
          session.scene.statusLine = result.statusMessage;
        }
        saveSession(session);
        if (session.ownerUserId) {
          recordTurnUsage(session.ownerUserId);
        } else {
          consumeGuestTurn(session);
          saveSession(session);
        }
        sendJson(res, 200, toSnapshot(session));
      } catch (error) {
        sendJson(res, 400, { message: error.message || '推进失败。' });
      }
      return;
    }

    if (action === 'turn/stream' && req.method === 'POST') {
      const body = await readBody(req);
      await handleTurnStreamSafe(res, session, body);
      return;
    }

    sendNotFound(res);
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      defaultModel: DEFAULT_MODEL,
      streaming: true,
      architecture: 'frontend-display-backend-engine',
      settings: getPublicRuntimeConfig(),
      content: getContentManifest(),
      gameTitle: GAME_TITLE,
      monetization: {
        mode: 'trial_turns_and_month_card',
        guestTrialTurnLimit: GUEST_TRIAL_TURN_LIMIT,
        accountTrialTurnLimit: 30,
        turnPackTurns: DEFAULT_TURN_PACK_TURNS,
        monthCardDays: DEFAULT_MONTH_CARD_DAYS
      }
    });
    return;
  }

  if (pathname === '/api/models' && req.method === 'POST') {
    const publicConfig = getPublicRuntimeConfig();
    sendJson(res, 200, {
      managedByServer: true,
      data: [{ id: publicConfig.model || DEFAULT_MODEL }]
    });
    return;
  }

  sendNotFound(res);
}

const server = http.createServer(async(req, res) => {
  try {
    const { pathname } = parseRequest(req);
    if (pathname.startsWith('/api/')) {
      await routeApi(req, res);
      return;
    }
    if (pathname.startsWith('/donation/')) {
      serveStatic(req, res, STATIC_DIR);
      return;
    }
    serveStatic(req, res, DIST_DIR);
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Server Error' });
  }
});

if (require.main === module) {
  const runtimeConfig = getProviderRuntimeConfig();
  const providerEnabled = isProviderEnabled(runtimeConfig);
  server.listen(PORT, () => {
    const primaryProvider = Array.isArray(runtimeConfig.providers) && runtimeConfig.providers.length
      ? runtimeConfig.providers[0]
      : runtimeConfig;
    const startupRuntimeLines = [
      `[provider] enabled=${providerEnabled ? 'yes' : 'no'} count=${Number(runtimeConfig.providerCount || 0)} active=${Array.isArray(runtimeConfig.activeProviderNames) ? runtimeConfig.activeProviderNames.join(',') || '(none)' : '(none)'}`,
      `[provider] primary=${runtimeConfig.providerName || 'Local Fallback'} model=${runtimeConfig.model || DEFAULT_MODEL} strategy=${runtimeConfig.endpointStrategy || 'auto'} choiceMode=${runtimeConfig.dynamicChoiceMode || 'batch_first'}`,
      `[provider] base=${runtimeConfig.apiBaseUrl || '(empty)'} firstConfigured=${primaryProvider && primaryProvider.apiBaseUrl ? primaryProvider.apiBaseUrl : '(empty)'}`
    ];
    if (runtimeConfig.source) {
      startupRuntimeLines.push(`[provider] source apiBaseUrl=${runtimeConfig.source.apiBaseUrl || 'default'} model=${runtimeConfig.source.model || 'default'} apiKey=${runtimeConfig.source.apiKey || 'default'}`);
    }
    startupRuntimeLines.forEach((line) => console.log(line));
    console.log(`汉末·往昔之影 v0.2 backend running at http://localhost:${PORT}`);
  });
}

module.exports = {
  server
};





