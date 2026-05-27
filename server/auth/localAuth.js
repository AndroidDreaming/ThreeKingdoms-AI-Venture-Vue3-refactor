const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'runtime', 'auth');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

const DEFAULT_TRIAL_TURN_LIMIT = 10;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || '测试管理员';
let storageReady = false;

function ensureStorage() {
  if (storageReady) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }

  if (!fs.existsSync(TOKENS_FILE)) {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify({ tokens: {} }, null, 2), 'utf8');
  }
  storageReady = true;
}

function readJson(filePath, fallback) {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureStorage();
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function readUsers() {
  const payload = readJson(USERS_FILE, { users: [] });
  return Array.isArray(payload.users) ? payload.users : [];
}

function writeUsers(users) {
  writeJson(USERS_FILE, { users });
}

function readTokens() {
  const payload = readJson(TOKENS_FILE, { tokens: {} });
  return payload && payload.tokens && typeof payload.tokens === 'object' ? payload.tokens : {};
}

function writeTokens(tokens) {
  writeJson(TOKENS_FILE, { tokens });
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256').toString('hex');
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.passwordSalt || !user.passwordHash) return false;
  const hash = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function buildTrialAccess(overrides) {
  const payload = Object.assign({
    mode: 'trial',
    paid: false,
    trialTurnLimit: DEFAULT_TRIAL_TURN_LIMIT,
    trialTurnsUsed: 0,
    paidAt: '',
    purchaseChannel: ''
  }, overrides || {});

  payload.trialTurnLimit = Math.max(0, Number(payload.trialTurnLimit || DEFAULT_TRIAL_TURN_LIMIT));
  payload.trialTurnsUsed = Math.max(0, Number(payload.trialTurnsUsed || 0));
  return payload;
}

function buildFullAccess(overrides) {
  return Object.assign(buildTrialAccess({
    mode: 'full',
    paid: true,
    trialTurnsUsed: 0
  }), overrides || {}, {
    mode: 'full',
    paid: true
  });
}

function sanitizeUser(user) {
  const access = Object.assign({}, user && user.access ? user.access : buildTrialAccess());
  const remainingTurns = access.mode === 'full'
    ? null
    : Math.max(0, Number(access.trialTurnLimit || 0) - Number(access.trialTurnsUsed || 0));

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    isAdmin: user.isAdmin === true,
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
    access: Object.assign({}, access, {
      remainingTurns
    })
  };
}

function validateUsername(username) {
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    throw new Error('用户名需为 3-24 位字母、数字或下划线。');
  }
}

function validatePassword(password) {
  if (String(password || '').length < 6) {
    throw new Error('密码至少需要 6 位。');
  }
}

function ensureAdminUser() {
  ensureStorage();
  const users = readUsers();
  const adminUsername = normalizeUsername(ADMIN_USERNAME);
  const existing = users.find((item) => item.username === adminUsername);

  if (existing) {
    let changed = false;
    if (existing.isAdmin !== true) {
      existing.isAdmin = true;
      changed = true;
    }
    if (!existing.access || existing.access.mode !== 'full' || existing.access.paid !== true) {
      existing.access = buildFullAccess({
        paidAt: existing.access && existing.access.paidAt ? existing.access.paidAt : new Date().toISOString(),
        purchaseChannel: existing.access && existing.access.purchaseChannel ? existing.access.purchaseChannel : 'admin_seed'
      });
      changed = true;
    }
    if (!existing.displayName) {
      existing.displayName = ADMIN_DISPLAY_NAME;
      changed = true;
    }
    if (changed) {
      existing.updatedAt = new Date().toISOString();
      writeUsers(users);
    }
    return existing;
  }

  const passwordRecord = createPasswordRecord(ADMIN_PASSWORD);
  const now = new Date().toISOString();
  users.push({
    id: createId('user'),
    username: adminUsername,
    displayName: ADMIN_DISPLAY_NAME,
    passwordSalt: passwordRecord.salt,
    passwordHash: passwordRecord.hash,
    isAdmin: true,
    access: buildFullAccess({
      paidAt: now,
      purchaseChannel: 'admin_seed'
    }),
    createdAt: now,
    updatedAt: now
  });
  writeUsers(users);
  return users[users.length - 1];
}

function issueToken(userId) {
  const tokens = readTokens();
  const token = `tk_auth_${crypto.randomBytes(24).toString('hex')}`;
  tokens[token] = {
    userId,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
  writeTokens(tokens);
  return token;
}

function touchToken(token) {
  const tokens = readTokens();
  if (!tokens[token]) return;
  tokens[token].lastSeenAt = new Date().toISOString();
  writeTokens(tokens);
}

function revokeToken(token) {
  const tokens = readTokens();
  if (!tokens[token]) return;
  delete tokens[token];
  writeTokens(tokens);
}

function findUserByUsername(username) {
  const normalized = normalizeUsername(username);
  return readUsers().find((item) => item.username === normalized) || null;
}

function findUserById(userId) {
  return readUsers().find((item) => item.id === userId) || null;
}

function persistUser(nextUser) {
  const users = readUsers();
  const index = users.findIndex((item) => item.id === nextUser.id);
  if (index === -1) throw new Error('用户不存在。');
  users[index] = nextUser;
  writeUsers(users);
  return nextUser;
}

function registerUser(payload) {
  const username = normalizeUsername(payload && payload.username);
  const password = String(payload && payload.password ? payload.password : '');
  const displayName = String(payload && payload.displayName ? payload.displayName : username).trim() || username;

  validateUsername(username);
  validatePassword(password);

  if (findUserByUsername(username)) {
    throw new Error('用户名已存在。');
  }

  const passwordRecord = createPasswordRecord(password);
  const now = new Date().toISOString();
  const users = readUsers();
  const user = {
    id: createId('user'),
    username,
    displayName,
    passwordSalt: passwordRecord.salt,
    passwordHash: passwordRecord.hash,
    isAdmin: false,
    access: buildTrialAccess(),
    createdAt: now,
    updatedAt: now
  };
  users.push(user);
  writeUsers(users);

  const token = issueToken(user.id);
  return {
    token,
    user: sanitizeUser(user)
  };
}

function loginUser(payload) {
  const username = normalizeUsername(payload && payload.username);
  const password = String(payload && payload.password ? payload.password : '');
  const user = findUserByUsername(username);

  if (!user || !verifyPassword(password, user)) {
    throw new Error('用户名或密码不正确。');
  }

  const token = issueToken(user.id);
  return {
    token,
    user: sanitizeUser(user)
  };
}

function getUserByToken(token) {
  if (!token) return null;
  const tokens = readTokens();
  const record = tokens[token];
  if (!record || !record.userId) return null;
  const user = findUserById(record.userId);
  if (!user) {
    revokeToken(token);
    return null;
  }
  touchToken(token);
  return sanitizeUser(user);
}

function requireRawUser(userId) {
  const user = findUserById(userId);
  if (!user) throw new Error('用户不存在。');
  return user;
}

function upgradeUserToFull(userId, channel) {
  const user = requireRawUser(userId);
  user.access = buildFullAccess({
    trialTurnLimit: Number(user.access && user.access.trialTurnLimit || DEFAULT_TRIAL_TURN_LIMIT),
    trialTurnsUsed: Number(user.access && user.access.trialTurnsUsed || 0),
    paidAt: new Date().toISOString(),
    purchaseChannel: channel || 'mock'
  });
  user.updatedAt = new Date().toISOString();
  persistUser(user);
  return sanitizeUser(user);
}

function updateUserAccess(username, payload) {
  const user = findUserByUsername(username);
  if (!user) throw new Error('目标用户不存在。');

  const mode = String(payload && payload.mode ? payload.mode : '').trim();
  if (!['trial', 'full'].includes(mode)) {
    throw new Error('权限模式必须是 trial 或 full。');
  }

  if (mode === 'full') {
    user.access = buildFullAccess({
      trialTurnLimit: Number(payload && payload.trialTurnLimit || user.access && user.access.trialTurnLimit || DEFAULT_TRIAL_TURN_LIMIT),
      trialTurnsUsed: Number(payload && payload.trialTurnsUsed !== undefined ? payload.trialTurnsUsed : user.access && user.access.trialTurnsUsed || 0),
      paidAt: payload && payload.paidAt ? payload.paidAt : new Date().toISOString(),
      purchaseChannel: payload && payload.purchaseChannel ? payload.purchaseChannel : 'admin'
    });
  } else {
    user.access = buildTrialAccess({
      trialTurnLimit: Number(payload && payload.trialTurnLimit !== undefined ? payload.trialTurnLimit : user.access && user.access.trialTurnLimit || DEFAULT_TRIAL_TURN_LIMIT),
      trialTurnsUsed: Number(payload && payload.trialTurnsUsed !== undefined ? payload.trialTurnsUsed : user.access && user.access.trialTurnsUsed || 0),
      purchaseChannel: '',
      paidAt: ''
    });
  }

  user.updatedAt = new Date().toISOString();
  persistUser(user);
  return sanitizeUser(user);
}

function listUsers() {
  return readUsers()
    .slice()
    .sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')))
    .map(sanitizeUser);
}

function canPlayTurn(userId) {
  const user = requireRawUser(userId);
  const access = sanitizeUser(user).access;
  if (access.mode === 'full') {
    return { allowed: true, access };
  }
  if (Number(access.remainingTurns || 0) <= 0) {
    return { allowed: false, access };
  }
  return { allowed: true, access };
}

function recordTurnUsage(userId) {
  const user = requireRawUser(userId);
  if (!user.access || user.access.mode === 'full') {
    return sanitizeUser(user);
  }
  user.access = buildTrialAccess(Object.assign({}, user.access, {
    trialTurnsUsed: Number(user.access.trialTurnsUsed || 0) + 1
  }));
  user.updatedAt = new Date().toISOString();
  persistUser(user);
  return sanitizeUser(user);
}

function getAdminSeedCredentials() {
  ensureAdminUser();
  return {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD
  };
}

ensureAdminUser();

module.exports = {
  DEFAULT_TRIAL_TURN_LIMIT,
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
};
