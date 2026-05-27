const fs = require('fs');
const path = require('path');
const { createId } = require('./chronicleV2Helpers');
const { createSessionState } = require('./chronicleV3StateFactory');

const DATA_DIR = path.join(__dirname, '..', 'runtime', 'sessions');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getSessionPath(sessionId) {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

function saveSession(session) {
  ensureDataDir();
  fs.writeFileSync(getSessionPath(session.sessionId), JSON.stringify(session, null, 2), 'utf8');
}

function createSession() {
  const session = createSessionState();
  session.sessionId = createId('tk');
  saveSession(session);
  return session;
}

function loadSession(sessionId) {
  ensureDataDir();
  const filePath = getSessionPath(sessionId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resetSession(sessionId) {
  const current = loadSession(sessionId);
  const next = createSessionState();
  next.sessionId = sessionId;
  if (current && current.settings) {
    next.settings = Object.assign({}, next.settings, current.settings);
  }
  saveSession(next);
  return next;
}

module.exports = {
  createSession,
  loadSession,
  saveSession,
  resetSession
};
