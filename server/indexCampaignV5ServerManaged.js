const http = require('http');
const path = require('path');
const { DEFAULT_MODEL } = require('./game/chronicleV2Constants');
const { classifyIntent } = require('./game/chronicleV5IntentClassifier');
const { processAction } = require('./game/chronicleV5RulesEngine');
const { narrateScene } = require('./game/narratorChronicleFastV3');
const { generateDynamicChoices, buildLocalDynamicChoices } = require('./game/chronicleV5ChoiceGenerator');
const { NARRATION_CONFIG } = require('./game/chronicleV5NarrationConfigSafe');
const { repairScene, normalizeNarrationText, chooseNarrationText } = require('./game/chronicleV5NarrationGuard');
const { createSession, loadSession, resetSession, saveSession, appendSessionLog } = require('./game/chronicleV5SessionStore');
const { CONFIG_FILE, getProviderRuntimeConfig, getPublicRuntimeConfig } = require('./config/runtimeConfig');
const {
  registerUser,
  loginUser,
  getUserByToken,
  revokeToken,
  upgradeUserToFull,
  updateUserAccess,
  listUsers,
  canPlayTurn,
  recordTurnUsage,
  getAdminSeedCredentials
} = require('./auth/localAuth');
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
const MESSAGE_SESSION_NOT_FOUND = '\u4f1a\u8bdd\u4e0d\u5b58\u5728\u3002';
const MESSAGE_ACTION_REQUIRED = '\u884c\u52a8\u4e0d\u80fd\u4e3a\u7a7a\u3002';
const MESSAGE_NARRATION_FAILED = '\u7eed\u5199\u5931\u8d25\u3002';
const GAME_TITLE = '\u6c49\u672b\u98ce\u4e91\u5f55';

function toSnapshot(session) {
  const safeScene = repairScene(session.scene || {}, session.scene && session.scene.text ? session.scene.text : '');
  return {
    sessionId: session.sessionId,
    saveTime: session.saveTime,
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

async function emitDynamicChoices(res, session, dynamicChoices) {
  const list = dedupeChoices(dynamicChoices)
    .slice(0, 3)
    .map((item) => ({ ...item, source: 'dynamic' }));
  for (const choice of list) {
    session.choices = mergeChoices(session.choices, [choice]);
    writeStreamChunk(res, { type: 'choice', choice });
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
}

async function emitInstantFallbackChoices(res, session, action, statusMessage) {
  if (!canEmitNarrativeDynamicChoices(session) || session.world.phase === 'ended') {
    session.choices = Array.isArray(session.choices)
      ? session.choices.filter((item) => item && item.source !== 'dynamic')
      : [];
    emitChoicesReset(res, session.choices);
    return [];
  }

  emitChoicesReset(res, session.choices);
  const dynamicChoices = buildLocalDynamicChoices(session, action || {});
  if (statusMessage) {
    writeStreamChunk(res, { type: 'status', message: statusMessage });
  }
  await emitDynamicChoices(res, session, dynamicChoices);
  session.choices = mergeChoices(session.choices, dynamicChoices);
  return dynamicChoices;
}

function getAuthToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return String(req.headers['x-auth-token'] || '').trim();
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

function loadOwnedSession(res, sessionId, user) {
  if (!requireUser(res, user)) return null;
  const session = loadSession(sessionId);
  if (!session) {
    sendJson(res, 404, { message: MESSAGE_SESSION_NOT_FOUND });
    return null;
  }
  if (session.ownerUserId && session.ownerUserId !== user.id) {
    sendForbidden(res, '这个存档不属于当前账号。');
    return null;
  }
  return session;
}

function sendAuthPayload(res, payload) {
  sendJson(res, 200, Object.assign({}, payload, {
    adminSeed: getAdminSeedCredentials()
  }));
}

async function handleTurnStreamManaged(res, sessionId, body) {
  const session = loadSession(sessionId);
  if (!session) {
    sendJson(res, 404, { message: '会话不存在。' });
    return;
  }

  const actionText = String(body.actionText || '').trim();
  if (!actionText) {
    sendJson(res, 400, { message: '行动不能为空。' });
    return;
  }

  const action = classifyIntent(actionText);
  beginNdjson(res);
  writeStreamChunk(res, { type: 'status', message: NARRATION_CONFIG.status.turnAccepted });

  try {
    const result = processAction(session, action);
    if (
      session.memory &&
      session.memory.lastStructuredLog &&
      session.memory.lastStructuredLog.key &&
      session.memory.lastPersistedLogKey !== session.memory.lastStructuredLog.key
    ) {
      appendSessionLog(session.sessionId, session.memory.lastStructuredLog);
      session.memory.lastPersistedLogKey = session.memory.lastStructuredLog.key;
    }

    let storyText = '';

    if (!result.prompt) {
      await streamPlainText(res, result.fallbackText);
      storyText += result.fallbackText;
      session.scene.text = storyText;
      session.scene.mode = 'fallback';
      session.scene.narrationReason = 'rule_only';
      session.scene.narrationDetail = 'rule-only';
      writeStreamChunk(res, { type: 'narration_done' });
      await emitInstantFallbackChoices(res, session, action, '这一回先由本地规则接住，后续落子已按当前局势即时排出。');
      saveSession(session);
      writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
      res.end();
      return;
    }

    const narration = await narrateScene({
      settings: getProviderRuntimeConfig(),
      prompt: result.prompt,
      fallbackText: result.fallbackText,
      onStatus: async(message) => writeStreamChunk(res, { type: 'status', message }),
      onText: async(text) => {
        storyText += text;
        session.scene.text = storyText;
        writeStreamChunk(res, { type: 'delta', text });
      }
    });

    session.scene.text = storyText || narration.text || result.fallbackText;
    session.scene.mode = narration.mode || 'fallback';
    session.scene.narrationReason = narration.reason || '';
    session.scene.narrationDetail = narration.detail || '';
    writeStreamChunk(res, { type: 'narration_done' });
    if (session.scene.mode === 'fallback') {
      await emitInstantFallbackChoices(res, session, action, '正文这一步由本地兜底续上，后续落子已经按这一回的新局势即时整理出来。');
    } else if (canEmitNarrativeDynamicChoices(session) && session.world.phase !== 'ended') {
      writeStreamChunk(res, { type: 'status', message: NARRATION_CONFIG.status.choicesReady });
      const dynamicChoices = await generateDynamicChoices(session, action, getProviderRuntimeConfig(), {
        onDraft: async(draft) => writeStreamChunk(res, { type: 'choice_draft', draft }),
        onChoice: async(choice) => {
          session.choices = mergeChoices(session.choices, [choice]);
          writeStreamChunk(res, { type: 'choice', choice });
        }
      });
      session.choices = mergeChoices(session.choices, dynamicChoices);
    } else {
      session.choices = Array.isArray(session.choices)
        ? session.choices.filter((item) => item && item.source !== 'dynamic')
        : [];
    }

    saveSession(session);
    writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
    res.end();
  } catch (error) {
    writeStreamChunk(res, { type: 'error', message: error.message || '续写失败。' });
    res.end();
  }
}

async function handleTurnStream(res, sessionId, body) {
  const session = loadSession(sessionId);
  if (!session) {
    sendJson(res, 404, { message: '会话不存在。' });
    return;
  }

  const actionText = String(body.actionText || '').trim();
  if (!actionText) {
    sendJson(res, 400, { message: '行动不能为空。' });
    return;
  }

  const action = classifyIntent(actionText);
  beginNdjson(res);
  writeStreamChunk(res, { type: 'status', message: '这一手已经落下，正在续写新的回合。' });
  writeStreamChunk(res, { type: 'status', message: '局势已接住这一步，正在续写新的回合……' });

  try {
    const result = processAction(session, action);
    if (session.memory && session.memory.lastStructuredLog && session.memory.lastStructuredLog.key && session.memory.lastPersistedLogKey !== session.memory.lastStructuredLog.key) {
      appendSessionLog(session.sessionId, session.memory.lastStructuredLog);
      session.memory.lastPersistedLogKey = session.memory.lastStructuredLog.key;
    }
    let storyText = '';

    if (!result.prompt) {
      await streamPlainText(res, result.fallbackText);
      storyText += result.fallbackText;
      session.scene.text = storyText;
      session.scene.mode = 'fallback';
      session.scene.narrationReason = 'rule_only';
      session.scene.narrationDetail = 'rule-only';
      writeStreamChunk(res, { type: 'narration_done' });
      await emitInstantFallbackChoices(res, session, action, '这一回先由本地规则接住，后续落子已按当前局势即时排出。');
      saveSession(session);
      writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
      res.end();
      return;
    }

    const narration = await narrateScene({
      settings: getProviderRuntimeConfig(),
      prompt: result.prompt,
      fallbackText: result.fallbackText,
      onStatus: async(message) => writeStreamChunk(res, { type: 'status', message }),
      onText: async(text) => {
        storyText += text;
        session.scene.text = storyText;
        writeStreamChunk(res, { type: 'delta', text });
      }
    });

    session.scene.text = storyText || narration.text || result.fallbackText;
    session.scene.mode = narration.mode || 'fallback';
    session.scene.narrationReason = narration.reason || '';
    session.scene.narrationDetail = narration.detail || '';
    writeStreamChunk(res, { type: 'narration_done' });
    if (session.scene.mode === 'fallback') {
      await emitInstantFallbackChoices(res, session, action, '正文这一步由本地兜底续上，后续落子已经按这一回的新局势即时整理出来。');
    } else if (canEmitNarrativeDynamicChoices(session) && session.world.phase !== 'ended') {
      writeStreamChunk(res, { type: 'status', message: '正文已经写定，正在整理后续可选行动。' });
      writeStreamChunk(res, { type: 'status', message: '正文已经写定，正在整理后续可选行动。' });
      writeStreamChunk(res, { type: 'status', message: '正文已落下，正在整理后续可行动作…' });
      const dynamicChoices = await generateDynamicChoices(session, action, getProviderRuntimeConfig(), {
        onDraft: async(draft) => writeStreamChunk(res, { type: 'choice_draft', draft }),
        onChoice: async(choice) => {
          session.choices = mergeChoices(session.choices, [choice]);
          writeStreamChunk(res, { type: 'choice', choice });
        }
      });
      session.choices = mergeChoices(session.choices, dynamicChoices);
    } else {
      session.choices = Array.isArray(session.choices)
        ? session.choices.filter((item) => item && item.source !== 'dynamic')
        : [];
    }
    saveSession(session);
    writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
    res.end();
  } catch (error) {
    writeStreamChunk(res, { type: 'error', message: error.message || '续写失败。' });
    res.end();
  }
}

async function routeApi(req, res) {
  const handleTurnStreamSafe = async(turnRes, sessionId, body) => {
    const session = loadSession(sessionId);
    if (!session) {
      sendJson(turnRes, 404, { message: MESSAGE_SESSION_NOT_FOUND });
      return;
    }
    session.scene = repairScene(session.scene || {}, session.scene && session.scene.text ? session.scene.text : '');

    const actionText = String(body.actionText || '').trim();
    if (!actionText) {
      sendJson(turnRes, 400, { message: MESSAGE_ACTION_REQUIRED });
      return;
    }

    if (session.ownerUserId) {
      const accessCheck = canPlayTurn(session.ownerUserId);
      if (!accessCheck.allowed) {
        sendForbidden(turnRes, '试玩次数已用完，请购买完整版后继续游玩。', {
          code: 'TRIAL_EXHAUSTED',
          access: accessCheck.access
        });
        return;
      }
    }

    const action = classifyIntent(actionText);
    beginNdjson(turnRes);
    writeStreamChunk(turnRes, { type: 'status', message: NARRATION_CONFIG.status.turnAccepted });

    try {
      const result = processAction(session, action);
      if (
        session.memory &&
        session.memory.lastStructuredLog &&
        session.memory.lastStructuredLog.key &&
        session.memory.lastPersistedLogKey !== session.memory.lastStructuredLog.key
      ) {
        appendSessionLog(session.sessionId, session.memory.lastStructuredLog);
        session.memory.lastPersistedLogKey = session.memory.lastStructuredLog.key;
      }

      let storyText = '';

      if (!result.prompt) {
        const ruleOnlyText = normalizeNarrationText(result.fallbackText, session.scene.text || '');
        await streamPlainText(turnRes, ruleOnlyText);
        storyText += ruleOnlyText;
        session.scene.text = storyText;
        session.scene.mode = 'fallback';
        session.scene.narrationReason = 'rule_only';
        session.scene.narrationDetail = 'rule-only';
        writeStreamChunk(turnRes, { type: 'narration_done' });
        await emitInstantFallbackChoices(turnRes, session, action, '这一回先由本地规则接住，后续落子已按当前局势即时排出。');
        saveSession(session);
        if (session.ownerUserId) {
          recordTurnUsage(session.ownerUserId);
        }
        writeStreamChunk(turnRes, { type: 'done', snapshot: toSnapshot(session) });
        turnRes.end();
        return;
      }

      const narration = await narrateScene({
        settings: getProviderRuntimeConfig(),
        prompt: result.prompt,
        fallbackText: result.fallbackText,
        onStatus: async(message) => writeStreamChunk(turnRes, { type: 'status', message }),
        onText: async(text) => {
          storyText += text;
          session.scene.text = storyText;
          writeStreamChunk(turnRes, { type: 'delta', text });
        }
      });

      session.scene.text = chooseNarrationText(storyText, narration.text, result.fallbackText);
      session.scene = repairScene(session.scene, result.fallbackText);
      session.scene.mode = narration.mode || 'fallback';
      session.scene.narrationReason = narration.reason || '';
      session.scene.narrationDetail = narration.detail || '';
      writeStreamChunk(turnRes, { type: 'narration_done' });
      if (session.scene.mode === 'fallback') {
        await emitInstantFallbackChoices(turnRes, session, action, '正文这一步由本地兜底续上，后续落子已经按这一回的新局势即时整理出来。');
      } else if (canEmitNarrativeDynamicChoices(session) && session.world.phase !== 'ended') {
        emitChoicesReset(turnRes, session.choices);
        writeStreamChunk(turnRes, { type: 'status', message: NARRATION_CONFIG.status.choicesReady });
        const dynamicChoices = await generateDynamicChoices(session, action, getProviderRuntimeConfig(), {
          onDraft: async(draft) => writeStreamChunk(turnRes, { type: 'choice_draft', draft }),
          onChoice: async(choice) => {
            session.choices = mergeChoices(session.choices, [choice]);
            writeStreamChunk(turnRes, { type: 'choice', choice });
          }
        });
        session.choices = mergeChoices(session.choices, dynamicChoices);
      } else {
        session.choices = Array.isArray(session.choices)
          ? session.choices.filter((item) => item && item.source !== 'dynamic')
          : [];
      }

      saveSession(session);
      if (session.ownerUserId) {
        recordTurnUsage(session.ownerUserId);
      }
      writeStreamChunk(turnRes, { type: 'done', snapshot: toSnapshot(session) });
      turnRes.end();
    } catch (error) {
      writeStreamChunk(turnRes, { type: 'error', message: error.message || MESSAGE_NARRATION_FAILED });
      turnRes.end();
    }
  };

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
      const payload = registerUser(body || {});
      sendAuthPayload(res, payload);
    } catch (error) {
      sendJson(res, 400, { message: error.message || '注册失败。' });
    }
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const payload = loginUser(body || {});
      sendAuthPayload(res, payload);
    } catch (error) {
      sendJson(res, 400, { message: error.message || '登录失败。' });
    }
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = getAuthToken(req);
    if (token) revokeToken(token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    if (!requireUser(res, currentUser)) return;
    sendAuthPayload(res, { user: currentUser });
    return;
  }

  if (pathname === '/api/purchase/mock' && req.method === 'POST') {
    if (!requireUser(res, currentUser)) return;
    try {
      const body = await readBody(req);
      const channel = body && body.channel ? String(body.channel).trim() : 'mock';
      const user = upgradeUserToFull(currentUser.id, channel);
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

  if (pathname === '/api/session' && req.method === 'POST') {
    if (!requireUser(res, currentUser)) return;
    const session = createSession(currentUser.id);
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  const ownedSessionMatch = pathname.match(/^\/api\/session\/([^/]+)(?:\/(settings|reset|turn\/stream))?$/);
  if (ownedSessionMatch) {
    const sessionId = ownedSessionMatch[1];
    const action = ownedSessionMatch[2];
    const session = loadOwnedSession(res, sessionId, currentUser);
    if (!session) return;

    if (!action && req.method === 'GET') {
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
      const body = await readBody(req);
      const nextSession = resetSession(session.sessionId, body || {});
      sendJson(res, 200, toSnapshot(nextSession));
      return;
    }

    if (action === 'turn/stream' && req.method === 'POST') {
      if (session.ownerUserId) {
        const accessCheck = canPlayTurn(session.ownerUserId);
        if (!accessCheck.allowed) {
          sendForbidden(res, '试玩次数已用完，请购买完整版后继续游玩。', {
            code: 'TRIAL_EXHAUSTED',
            access: accessCheck.access
          });
          return;
        }
      }
      const body = await readBody(req);
      await handleTurnStreamSafe(res, session.sessionId, body);
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
      gameTitle: GAME_TITLE
    });
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      defaultModel: DEFAULT_MODEL,
      streaming: true,
      architecture: 'frontend-display-backend-engine',
      settings: getPublicRuntimeConfig(),
      gameTitle: '汉末风云录'
    });
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      defaultModel: DEFAULT_MODEL,
      streaming: true,
      architecture: 'frontend-display-backend-engine',
      settings: getPublicRuntimeConfig(),
      gameTitle: '汉末往昔之影'
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

  if (pathname === '/api/session' && req.method === 'POST') {
    const session = createSession();
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  const match = pathname.match(/^\/api\/session\/([^/]+)(?:\/(settings|reset|turn\/stream))?$/);
  if (!match) {
    sendNotFound(res);
    return;
  }

  const sessionId = match[1];
  const action = match[2];

  if (!action && req.method === 'GET') {
    const session = loadSession(sessionId);
    if (!session) {
      sendJson(res, 404, { message: MESSAGE_SESSION_NOT_FOUND });
      return;
    }
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  if (action === 'settings' && req.method === 'PUT') {
    sendJson(res, 403, {
      message: `\u6a21\u578b\u914d\u7f6e\u7531\u670d\u52a1\u7aef\u7edf\u4e00\u7ba1\u7406\uff0c\u8bf7\u4fee\u6539 ${CONFIG_FILE} \u540e\u91cd\u542f\u540e\u7aef\u3002`
    });
    return;
  }

  if (!action && req.method === 'GET') {
    const session = loadSession(sessionId);
    if (!session) {
      sendJson(res, 404, { message: '会话不存在。' });
      return;
    }
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  if (action === 'settings' && req.method === 'PUT') {
    sendJson(res, 403, {
      message: `模型配置由服务端统一管理，请修改 ${CONFIG_FILE} 后重启后端。`
    });
    return;
  }

  if (!action && req.method === 'GET') {
    const session = loadSession(sessionId);
    if (!session) {
      sendJson(res, 404, { message: '会话不存在。' });
      return;
    }
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
    const body = await readBody(req);
    const session = resetSession(sessionId, body || {});
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  if (action === 'turn/stream' && req.method === 'POST') {
    const body = await readBody(req);
    await handleTurnStreamSafe(res, sessionId, body);
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
  server.listen(PORT, () => {
    console.log(`汉末往昔之影 v5 backend running at http://localhost:${PORT}`);
  });
}

module.exports = {
  server
};
