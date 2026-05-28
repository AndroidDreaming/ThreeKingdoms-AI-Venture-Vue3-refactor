const fs = require('fs');
const path = require('path');
const {
  BACKGROUNDS_CONTENT,
  SECTS_CONTENT,
  CITIES_CONTENT,
  ORIGIN_CITY_IDS,
  CITY_ROUTE_LINES,
  TEXT_MAP_GROUPS_CONTENT,
  FACTIONS_CONTENT,
  HISTORICAL_RELATIONS,
  RANDOM_NPC_TEMPLATES,
  BACKGROUND_RELATION_RULES
} = require('./chronicleV5ContentConfig');
const { FIXED_ACTION_CONFIG } = require('../config/chronicle.fixed-actions.config');

const CONTENT_ROOT = path.join(__dirname, '..', 'data', 'content');
const DRAFT_DIR = path.join(CONTENT_ROOT, 'draft');
const PUBLISHED_DIR = path.join(CONTENT_ROOT, 'published');
const HISTORY_DIR = path.join(CONTENT_ROOT, 'history');
const PUBLISHED_SNAPSHOT_FILE = path.join(PUBLISHED_DIR, 'snapshot.json');
const PUBLISHED_MANIFEST_FILE = path.join(PUBLISHED_DIR, 'manifest.json');

const CONTENT_TYPES = Object.freeze([
  'characters',
  'sects',
  'routes',
  'martialSkills',
  'actions',
  'optionTemplates'
]);

const DRAFT_FILES = Object.freeze({
  characters: 'characters.json',
  sects: 'sects.json',
  routes: 'routes.json',
  martialSkills: 'martial-skills.json',
  actions: 'actions.json',
  optionTemplates: 'option-templates.json'
});

function ensureContentDirs() {
  [CONTENT_ROOT, DRAFT_DIR, PUBLISHED_DIR, HISTORY_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const content = fs.readFileSync(file, 'utf8');
    if (!content.trim()) return fallback;
    return JSON.parse(content);
  } catch (error) {
    const wrapped = new Error(`读取内容配置失败: ${file} - ${error.message}`);
    wrapped.cause = error;
    throw wrapped;
  }
}

function writeJsonFile(file, payload) {
  ensureContentDirs();
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEntity(entity) {
  if (!entity || typeof entity !== 'object') return null;
  const id = String(entity.id || '').trim();
  if (!id) return null;
  return Object.assign({}, entity, { id });
}

function mergeById(baseList, overlayList) {
  const order = [];
  const map = new Map();

  asArray(baseList).forEach((item) => {
    const entity = normalizeEntity(item);
    if (!entity || entity.disabled === true) return;
    order.push(entity.id);
    map.set(entity.id, entity);
  });

  asArray(overlayList).forEach((item) => {
    const entity = normalizeEntity(item);
    if (!entity) return;
    if (entity.disabled === true) {
      map.delete(entity.id);
      return;
    }
    if (!map.has(entity.id)) order.push(entity.id);
    map.set(entity.id, entity);
  });

  return order.map((id) => map.get(id)).filter(Boolean);
}

function getBuiltinSnapshot() {
  return {
    version: 'builtin',
    publishedAt: '',
    characters: clone(HISTORICAL_RELATIONS),
    sects: clone(SECTS_CONTENT),
    cities: clone(CITIES_CONTENT),
    routes: clone(CITY_ROUTE_LINES),
    backgrounds: clone(BACKGROUNDS_CONTENT),
    factions: clone(FACTIONS_CONTENT),
    randomNpcTemplates: clone(RANDOM_NPC_TEMPLATES),
    backgroundRelationRules: clone(BACKGROUND_RELATION_RULES),
    originCityIds: clone(ORIGIN_CITY_IDS),
    textMapGroups: clone(TEXT_MAP_GROUPS_CONTENT),
    martialSkills: [],
    actions: clone(FIXED_ACTION_CONFIG),
    optionTemplates: []
  };
}

function getPublishedOverlay() {
  const payload = readJsonFile(PUBLISHED_SNAPSHOT_FILE, null);
  return payload && typeof payload === 'object' ? payload : {};
}

function getDraftContent() {
  ensureContentDirs();
  return CONTENT_TYPES.reduce((bag, type) => {
    bag[type] = readJsonFile(path.join(DRAFT_DIR, DRAFT_FILES[type]), []);
    return bag;
  }, {});
}

function writeDraftType(type, items) {
  assertContentType(type);
  writeJsonFile(path.join(DRAFT_DIR, DRAFT_FILES[type]), asArray(items));
}

function buildSnapshotFromOverlay(overlay) {
  const builtin = getBuiltinSnapshot();
  const source = overlay && typeof overlay === 'object' ? overlay : {};
  const snapshot = {
    version: source.version || builtin.version,
    publishedAt: source.publishedAt || '',
    characters: mergeById(builtin.characters, source.characters),
    sects: mergeById(builtin.sects, source.sects),
    cities: mergeById(builtin.cities, source.cities),
    routes: mergeById(builtin.routes, source.routes),
    backgrounds: mergeById(builtin.backgrounds, source.backgrounds),
    factions: mergeById(builtin.factions, source.factions),
    randomNpcTemplates: mergeById(builtin.randomNpcTemplates, source.randomNpcTemplates),
    backgroundRelationRules: Object.assign({}, builtin.backgroundRelationRules, source.backgroundRelationRules || {}),
    originCityIds: asArray(source.originCityIds).length ? clone(source.originCityIds) : builtin.originCityIds,
    textMapGroups: asArray(source.textMapGroups).length ? clone(source.textMapGroups) : builtin.textMapGroups,
    martialSkills: mergeById(builtin.martialSkills, source.martialSkills),
    actions: mergeById(builtin.actions, source.actions),
    optionTemplates: mergeById(builtin.optionTemplates, source.optionTemplates)
  };

  snapshot.entityCounts = buildEntityCounts(snapshot);
  return snapshot;
}

function getContentSnapshot() {
  return buildSnapshotFromOverlay(getPublishedOverlay());
}

function getDraftPreviewSnapshot() {
  return buildSnapshotFromOverlay(getDraftContent());
}

function buildEntityCounts(snapshot) {
  return {
    characters: asArray(snapshot.characters).length,
    sects: asArray(snapshot.sects).length,
    cities: asArray(snapshot.cities).length,
    routes: asArray(snapshot.routes).length,
    martialSkills: asArray(snapshot.martialSkills).length,
    actions: asArray(snapshot.actions).length,
    optionTemplates: asArray(snapshot.optionTemplates).length
  };
}

function getContentManifest() {
  const snapshot = getContentSnapshot();
  return {
    version: snapshot.version || 'builtin',
    publishedAt: snapshot.publishedAt || '',
    entityCounts: buildEntityCounts(snapshot),
    types: CONTENT_TYPES.slice()
  };
}

function getEntityList(type) {
  const snapshot = getContentSnapshot();
  return asArray(snapshot[type]);
}

function getDraftPreviewEntityList(type) {
  const snapshot = getDraftPreviewSnapshot();
  return asArray(snapshot[type]);
}

function findEntity(type, id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return getEntityList(type).find((item) => item && item.id === key) || null;
}

function assertContentType(type) {
  if (!CONTENT_TYPES.includes(type)) {
    const error = new Error(`未知内容类型: ${type}`);
    error.code = 'INVALID_CONTENT_TYPE';
    throw error;
  }
}

function normalizeDraftEntityPayload(type, payload) {
  assertContentType(type);
  const entity = normalizeEntity(payload);
  if (!entity) {
    const error = new Error('配置项必须包含有效 id。');
    error.code = 'INVALID_CONTENT_ENTITY';
    throw error;
  }
  return entity;
}

function saveDraftEntity(type, payload) {
  const entity = normalizeDraftEntityPayload(type, payload);
  const draft = getDraftContent();
  const list = asArray(draft[type]).filter((item) => item && item.id !== entity.id);
  list.push(entity);
  writeDraftType(type, list);
  return entity;
}

function deleteDraftEntity(type, id) {
  assertContentType(type);
  const key = String(id || '').trim();
  if (!key) {
    const error = new Error('删除配置项时必须提供 id。');
    error.code = 'INVALID_CONTENT_ENTITY';
    throw error;
  }

  const draft = getDraftContent();
  const list = asArray(draft[type]).filter((item) => item && item.id !== key);
  const existsInBuiltinOrPublished = !!findEntity(type, key);
  if (existsInBuiltinOrPublished) {
    list.push({ id: key, disabled: true });
  }
  writeDraftType(type, list);
  return { id: key, disabled: existsInBuiltinOrPublished };
}

function validateEntityIds(type, list, issues) {
  const seen = new Set();
  asArray(list).forEach((item, index) => {
    const id = item && item.id ? String(item.id).trim() : '';
    if (!id) {
      issues.push({ level: 'error', type, path: `${type}[${index}].id`, message: '缺少 id。' });
      return;
    }
    if (seen.has(id)) issues.push({ level: 'error', type, path: `${type}.${id}`, message: 'id 重复。' });
    seen.add(id);
  });
}

function validateContentDraft() {
  const draft = getDraftContent();
  const merged = buildSnapshotFromOverlay(draft);
  const issues = [];

  CONTENT_TYPES.forEach((type) => validateEntityIds(type, draft[type], issues));

  const cityIds = new Set(asArray(merged.cities).map((item) => item && item.id).filter(Boolean));
  const sectIds = new Set(asArray(merged.sects).map((item) => item && item.id).filter(Boolean));

  asArray(draft.routes).forEach((route) => {
    if (!route || !route.id) return;
    if (route.from && !cityIds.has(route.from)) issues.push({ level: 'error', type: 'routes', path: route.id, message: `起点城市不存在: ${route.from}` });
    if (route.to && !cityIds.has(route.to)) issues.push({ level: 'error', type: 'routes', path: route.id, message: `终点城市不存在: ${route.to}` });
  });

  asArray(draft.sects).forEach((sect) => {
    asArray(sect && sect.cityIds).forEach((cityId) => {
      if (!cityIds.has(cityId)) issues.push({ level: 'error', type: 'sects', path: sect.id, message: `门派关联城市不存在: ${cityId}` });
    });
  });

  asArray(draft.actions).forEach((action) => {
    const targetSect = action && action.targetType === 'sect' ? action.target : '';
    if (targetSect && !sectIds.has(targetSect)) issues.push({ level: 'error', type: 'actions', path: action.id, message: `行动关联门派不存在: ${targetSect}` });
  });

  return {
    ok: !issues.some((item) => item.level === 'error'),
    issues,
    entityCounts: buildEntityCounts(merged)
  };
}

function publishDraftContent() {
  const validation = validateContentDraft();
  if (!validation.ok) {
    const error = new Error('草稿校验未通过，不能发布。');
    error.validation = validation;
    throw error;
  }

  const draft = getDraftContent();
  const now = new Date();
  const version = `content-${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
  const snapshot = Object.assign({ version, publishedAt: now.toISOString() }, draft);
  const merged = buildSnapshotFromOverlay(snapshot);
  const manifest = {
    version,
    publishedAt: snapshot.publishedAt,
    entityCounts: buildEntityCounts(merged),
    types: CONTENT_TYPES.slice()
  };

  writeJsonFile(PUBLISHED_SNAPSHOT_FILE, snapshot);
  writeJsonFile(PUBLISHED_MANIFEST_FILE, manifest);
  writeJsonFile(path.join(HISTORY_DIR, `${version}.json`), snapshot);
  return { manifest, validation };
}

module.exports = {
  CONTENT_TYPES,
  CONTENT_ROOT,
  getContentSnapshot,
  getDraftPreviewSnapshot,
  getContentManifest,
  getEntityList,
  getDraftPreviewEntityList,
  findEntity,
  getDraftContent,
  saveDraftEntity,
  deleteDraftEntity,
  validateContentDraft,
  publishDraftContent
};
