const http = require('http');
const path = require('path');
const { DEFAULT_MODEL } = require('./game/constants');
const { classifyIntent } = require('./game/intentClassifier');
const { narrateScene } = require('./game/narrator');
const { processAction } = require('./game/rulesEngine');
const { createSession, loadSession, resetSession, saveSession, updateSession } = require('./game/sessionStore');
const {
  beginNdjson,
  parseRequest,
  readBody,
  sendJson,
  sendNotFound,
  serveStatic,
  setCors,
  writeStreamChunk
} = require('./lib/http');

const PORT = process.env.PORT || 8111;
const DIST_DIR = path.join(__dirname, '..', 'dist');

function toSnapshot(session) {
  return {
    sessionId: session.sessionId,
    saveTime: session.saveTime,
    gameState: session.gameState,
    world: session.world,
    pendingThreads: session.memory && Array.isArray(session.memory.openThreads) ? session.memory.openThreads : [],
    scene: session.scene,
    choices: session.choices,
    settings: {
      apiBaseUrl: session.settings.apiBaseUrl,
      model: session.settings.model || DEFAULT_MODEL,
      hasApiKey: Boolean(session.settings.apiKey)
    }
  };
}

async function handleModels(res, body) {
  const settings = {
    apiBaseUrl: body.apiBaseUrl || '',
    apiKey: body.apiKey || ''
  };

  if (!settings.apiBaseUrl || !settings.apiKey) {
    sendJson(res, 200, {
      data: [{ id: DEFAULT_MODEL }, { id: 'deepseek-chat' }, { id: 'gpt-4o-mini' }]
    });
    return;
  }

  try {
    const response = await fetch(settings.apiBaseUrl.replace(/\/$/, '') + '/models', {
      headers: { Authorization: `Bearer ${settings.apiKey}` }
    });
    const data = await response.json();
    const remoteModels = Array.isArray(data.data) ? data.data : [];
    const models = [{ id: DEFAULT_MODEL }].concat(
      remoteModels.filter((item) => item && item.id && item.id !== DEFAULT_MODEL)
    );
    sendJson(res, 200, { data: models });
  } catch (error) {
    sendJson(res, 200, {
      data: [{ id: DEFAULT_MODEL }],
      warning: error.message
    });
  }
}

async function handleTurnStream(res, sessionId, body) {
  const session = loadSession(sessionId);
  if (!session) {
    sendJson(res, 404, { message: '会话不存在' });
    return;
  }

  const actionText = String(body.actionText || '').trim();
  if (!actionText) {
    sendJson(res, 400, { message: '动作不能为空' });
    return;
  }

  const classified = classifyIntent(actionText);
  beginNdjson(res);
  writeStreamChunk(res, { type: 'status', message: '已接收动作，正在推进世界状态...' });

  try {
    const result = processAction(session, classified);
    writeStreamChunk(res, { type: 'status', message: '世界状态已推进，正在生成叙事文本...' });

    const narration = await narrateScene({
      settings: session.settings,
      prompt: result.prompt,
      fallbackText: result.fallbackText,
      onStatus: async(message) => writeStreamChunk(res, { type: 'status', message }),
      onText: async(text) => {
        session.scene.text += text;
        writeStreamChunk(res, { type: 'delta', text });
      }
    });

    session.scene.text = narration.text;
    session.scene.statusLine = `${session.world.dateLabel} · ${session.world.location} · ${session.world.objective}`;
    session.scene.mode = narration.mode;
    saveSession(session);

    writeStreamChunk(res, { type: 'done', snapshot: toSnapshot(session) });
    res.end();
  } catch (error) {
    writeStreamChunk(res, { type: 'error', message: error.message || '生成失败' });
    res.end();
  }
}

async function routeApi(req, res) {
  const { pathname } = parseRequest(req);

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      defaultModel: DEFAULT_MODEL,
      streaming: true,
      architecture: 'frontend-display-backend-engine'
    });
    return;
  }

  if (pathname === '/api/models' && req.method === 'POST') {
    const body = await readBody(req);
    await handleModels(res, body);
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
      sendJson(res, 404, { message: '会话不存在' });
      return;
    }
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  if (action === 'settings' && req.method === 'PUT') {
    const body = await readBody(req);
    const session = updateSession(sessionId, (draft) => {
      draft.settings.apiBaseUrl = body.apiBaseUrl || '';
      draft.settings.apiKey = body.apiKey || '';
      draft.settings.model = body.model || DEFAULT_MODEL;
      draft.saveTime = new Date().toISOString();
    });
    if (!session) {
      sendJson(res, 404, { message: '会话不存在' });
      return;
    }
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  if (action === 'reset' && req.method === 'POST') {
    const session = resetSession(sessionId);
    sendJson(res, 200, toSnapshot(session));
    return;
  }

  if (action === 'turn/stream' && req.method === 'POST') {
    const body = await readBody(req);
    await handleTurnStream(res, sessionId, body);
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
    serveStatic(req, res, DIST_DIR);
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Server Error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`ThreeKingdoms backend running at http://localhost:${PORT}`);
  });
}

module.exports = {
  server
};
