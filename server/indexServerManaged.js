const http = require('http');
const path = require('path');
const { DEFAULT_MODEL } = require('./game/chronicleV2Constants');
const { classifyIntent } = require('./game/chronicleV2IntentClassifier');
const { narrateScene } = require('./game/narratorChronicle');
const { processAction } = require('./game/chronicleV2RulesEngine');
const { createSession, loadSession, resetSession, saveSession } = require('./game/chronicleV2SessionStore');
const { CONFIG_FILE, getProviderRuntimeConfig, getPublicRuntimeConfig } = require('./config/runtimeConfig');
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

function toSnapshot(session) {
  return {
    sessionId: session.sessionId,
    saveTime: session.saveTime,
    gameState: session.gameState,
    world: session.world,
    pendingThreads: session.memory && Array.isArray(session.memory.openThreads) ? session.memory.openThreads : [],
    scene: session.scene,
    choices: session.choices,
    settings: getPublicRuntimeConfig()
  };
}

function handleModels(res) {
  const publicConfig = getPublicRuntimeConfig();
  sendJson(res, 200, {
    managedByServer: true,
    data: [{ id: publicConfig.model || DEFAULT_MODEL }]
  });
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
      settings: getProviderRuntimeConfig(),
      prompt: result.prompt,
      fallbackText: result.fallbackText,
      onStatus: async(message) => writeStreamChunk(res, { type: 'status', message }),
      onText: async(text) => {
        session.scene.text += text;
        writeStreamChunk(res, { type: 'delta', text });
      }
    });

    session.scene.text = narration.text;
    session.scene.statusLine = `${session.world.dateLabel} 路 ${session.world.location} 路 ${session.world.objective}`;
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
      architecture: 'frontend-display-backend-engine',
      settings: getPublicRuntimeConfig()
    });
    return;
  }

  if (pathname === '/api/models' && req.method === 'POST') {
    handleModels(res);
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
    sendJson(res, 403, {
      message: `模型配置已改为服务端统一管理，请修改 ${CONFIG_FILE} 后重启后端服务。`
    });
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
