const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'runtime', 'auth');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

const DEFAULT_TRIAL_TURN_LIMIT = 30;
const DEFAULT_TURN_PACK_TURNS = 30;
const DEFAULT_MONTH_CARD_DAYS = 30;
const PERMANENT_MONTH_CARD_EXPIRES_AT = '2099-12-31T23:59:59.000Z';
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

function toNonNegativeInteger(value, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return Math.max(0, Number(fallback || 0));
  return Math.max(0, Math.floor(next));
}

function normalizeIsoDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function extendExpiry(currentExpiresAt, days) {
  const safeDays = toNonNegativeInteger(days, 0);
  const now = Date.now();
  const current = normalizeIsoDate(currentExpiresAt);
  const baseTime = current && new Date(current).getTime() > now ? new Date(current).getTime() : now;
  return new Date(baseTime + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

function isMonthCardActive(access) {
  const expiresAt = normalizeIsoDate(access && access.monthCardExpiresAt);
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

function buildAccess(overrides) {
  const raw = Object.assign({
    trialTurnLimit: DEFAULT_TRIAL_TURN_LIMIT,
    trialTurnsUsed: 0,
    turnCredits: 0,
    monthCardExpiresAt: '',
    lastPurchaseAt: '',
    purchaseChannel: ''
  }, overrides || {});

  const legacyFull = raw.mode === 'full' || raw.paid === true;
  const monthCardExpiresAt = normalizeIsoDate(raw.monthCardExpiresAt)
    || (legacyFull ? PERMANENT_MONTH_CARD_EXPIRES_AT : '');

  return {
    trialTurnLimit: toNonNegativeInteger(raw.trialTurnLimit, DEFAULT_TRIAL_TURN_LIMIT),
    trialTurnsUsed: toNonNegativeInteger(raw.trialTurnsUsed, 0),
    turnCredits: toNonNegativeInteger(raw.turnCredits, 0),
    monthCardExpiresAt,
    lastPurchaseAt: normalizeIsoDate(raw.lastPurchaseAt || raw.paidAt),
    purchaseChannel: String(raw.purchaseChannel || '').trim()
  };
}

function summarizeAccess(rawAccess) {
  const access = buildAccess(rawAccess);
  const trialRemainingTurns = Math.max(0, access.trialTurnLimit - access.trialTurnsUsed);
  const monthCardActive = isMonthCardActive(access);
  let playMode = 'blocked';

  if (monthCardActive) {
    playMode = 'month_card';
  } else if (trialRemainingTurns > 0) {
    playMode = 'trial';
  } else if (access.turnCredits > 0) {
    playMode = 'credits';
  }

  return Object.assign({}, access, {
    trialRemainingTurns,
    monthCardActive,
    totalPlayableTurns: monthCardActive ? null : trialRemainingTurns + access.turnCredits,
    canPlay: monthCardActive || trialRemainingTurns > 0 || access.turnCredits > 0,
    playMode
  });
}

function applyTrialCarryover(userId, usedTurns) {
  const safeUsedTurns = toNonNegativeInteger(usedTurns, 0);
  const user = requireRawUser(userId);
  const currentAccess = buildAccess(user.access);
  user.access = buildAccess(Object.assign({}, currentAccess, {
    trialTurnsUsed: Math.min(
      currentAccess.trialTurnLimit,
      currentAccess.trialTurnsUsed + safeUsedTurns
    )
  }));
  user.updatedAt = new Date().toISOString();
  persistUser(user);
  return sanitizeUser(user);
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

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    isAdmin: user.isAdmin === true,
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
    access: summarizeAccess(user && user.access)
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

    const normalizedAccess = buildAccess(existing.access);
    const adminAccess = buildAccess(Object.assign({}, normalizedAccess, {
      turnCredits: Math.max(9999, normalizedAccess.turnCredits),
      monthCardExpiresAt: PERMANENT_MONTH_CARD_EXPIRES_AT,
      lastPurchaseAt: normalizedAccess.lastPurchaseAt || new Date().toISOString(),
      purchaseChannel: normalizedAccess.purchaseChannel || 'admin_seed'
    }));

    if (JSON.stringify(existing.access || {}) !== JSON.stringify(adminAccess)) {
      existing.access = adminAccess;
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
    access: buildAccess({
      turnCredits: 9999,
      monthCardExpiresAt: PERMANENT_MONTH_CARD_EXPIRES_AT,
      lastPurchaseAt: now,
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
  const now = new Date().toISOString();
  const token = `tk_auth_${crypto.randomBytes(24).toString('hex')}`;
  tokens[token] = {
    userId,
    createdAt: now,
    lastSeenAt: now
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
    access: buildAccess(),
    createdAt: now,
    updatedAt: now
  };
  users.push(user);
  writeUsers(users);

  return {
    token: issueToken(user.id),
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

  return {
    token: issueToken(user.id),
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

function grantTurnCredits(userId, turns, channel) {
  const safeTurns = toNonNegativeInteger(turns, 0);
  if (safeTurns <= 0) {
    throw new Error('购买回合数必须大于 0。');
  }

  const user = requireRawUser(userId);
  const currentAccess = buildAccess(user.access);
  user.access = buildAccess(Object.assign({}, currentAccess, {
    turnCredits: currentAccess.turnCredits + safeTurns,
    lastPurchaseAt: new Date().toISOString(),
    purchaseChannel: channel || 'mock'
  }));
  user.updatedAt = new Date().toISOString();
  persistUser(user);
  return sanitizeUser(user);
}

function grantMonthCard(userId, days, channel) {
  const safeDays = toNonNegativeInteger(days, 0);
  if (safeDays <= 0) {
    throw new Error('月卡天数必须大于 0。');
  }

  const user = requireRawUser(userId);
  const currentAccess = buildAccess(user.access);
  user.access = buildAccess(Object.assign({}, currentAccess, {
    monthCardExpiresAt: extendExpiry(currentAccess.monthCardExpiresAt, safeDays),
    lastPurchaseAt: new Date().toISOString(),
    purchaseChannel: channel || 'mock'
  }));
  user.updatedAt = new Date().toISOString();
  persistUser(user);
  return sanitizeUser(user);
}

function updateUserAccess(username, payload) {
  const user = findUserByUsername(username);
  if (!user) throw new Error('目标用户不存在。');

  const currentAccess = buildAccess(user.access);
  let nextAccess = buildAccess(Object.assign({}, currentAccess, {
    trialTurnLimit: payload && payload.trialTurnLimit !== undefined ? payload.trialTurnLimit : currentAccess.trialTurnLimit,
    trialTurnsUsed: payload && payload.trialTurnsUsed !== undefined ? payload.trialTurnsUsed : currentAccess.trialTurnsUsed,
    turnCredits: payload && payload.turnCredits !== undefined ? payload.turnCredits : currentAccess.turnCredits,
    monthCardExpiresAt: payload && payload.monthCardExpiresAt !== undefined ? payload.monthCardExpiresAt : currentAccess.monthCardExpiresAt,
    purchaseChannel: payload && payload.purchaseChannel !== undefined ? payload.purchaseChannel : currentAccess.purchaseChannel,
    lastPurchaseAt: currentAccess.lastPurchaseAt
  }));

  if (payload && payload.clearMonthCard === true) {
    nextAccess = buildAccess(Object.assign({}, nextAccess, {
      monthCardExpiresAt: ''
    }));
  }

  const monthCardDays = toNonNegativeInteger(payload && payload.monthCardDays, 0);
  if (monthCardDays > 0) {
    nextAccess = buildAccess(Object.assign({}, nextAccess, {
      monthCardExpiresAt: extendExpiry(nextAccess.monthCardExpiresAt, monthCardDays)
    }));
  }

  if (
    payload
    && (
      payload.turnCredits !== undefined
      || payload.monthCardExpiresAt !== undefined
      || monthCardDays > 0
      || payload.clearMonthCard === true
    )
  ) {
    nextAccess.lastPurchaseAt = new Date().toISOString();
  }

  user.access = buildAccess(nextAccess);
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
  const access = summarizeAccess(user.access);
  return {
    allowed: access.canPlay,
    access
  };
}

function recordTurnUsage(userId) {
  const user = requireRawUser(userId);
  const currentAccess = buildAccess(user.access);
  const summary = summarizeAccess(currentAccess);

  if (summary.monthCardActive) {
    return sanitizeUser(user);
  }

  if (summary.trialRemainingTurns > 0) {
    user.access = buildAccess(Object.assign({}, currentAccess, {
      trialTurnsUsed: currentAccess.trialTurnsUsed + 1
    }));
  } else if (currentAccess.turnCredits > 0) {
    user.access = buildAccess(Object.assign({}, currentAccess, {
      turnCredits: currentAccess.turnCredits - 1
    }));
  } else {
    return sanitizeUser(user);
  }

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
};
