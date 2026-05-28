const GAME_TITLE = '汉末往事之卷';

const {
  BACKGROUND_RULES,
  SECT_RULES,
  getMartialPath,
  getMartialFocus,
  getStrategyPath,
  MARTIAL_PATHS,
  MARTIAL_BOTTLENECKS,
  STRATEGY_PATHS
} = require('./chronicleV5ProgressionConfig');
const { getContentSnapshot } = require('./contentRegistry');
let BACKGROUNDS_CONTENT = [];
let SECTS_CONTENT = [];
let CITIES_CONTENT = [];
let ORIGIN_CITY_IDS = [];
let CITY_ROUTE_LINES = [];
let TEXT_MAP_GROUPS_CONTENT = [];
let FACTIONS_CONTENT = [];
let HISTORICAL_RELATIONS = [];
let RANDOM_NPC_TEMPLATES = [];
let BACKGROUND_RELATION_RULES = {};
let FIXED_ACTION_CONFIG = [];
const { getHistoricalPersona } = require('./chronicleV5HistoricalPersonaLibrary');
const { createMemoryState } = require('./chronicleV5Memory');
const {
  createHistoricalState,
  historicalDeviationAccessForRelation
} = require('./chronicleV5HistoricalEventManager');
const {
  createEncounterState,
  ensureEncounterState
} = require('./chronicleV5EncounterSystem');
const {
  normalizeSkillRecord,
  normalizeSkillList
} = require('./chronicleV5SkillSystem');
const {
  ensureRetinueState,
  buildRetinueChoiceGroups
} = require('./chronicleV5RetinueSystem');
const { createEmptyDramaticLayer } = require('./chronicleV5DramaticLayer');
const { createEmptyWorldPerception } = require('./chronicleV5WorldPerception');
const { buildExtraCharacterSeeds } = require('./chronicleV5ExtraCharacterPool');
const { syncHistoricalRelationPresence } = require('./chronicleV5HistoricalPresenceConfig');
const { isRelationMet } = require('./chronicleV5RelationVisibility');
const {
  FOOD_DEFINITIONS,
  cloneFoodItem,
  getFoodDefinition
} = require('./chronicleV5FoodConfig');
const {
  ensureCityState,
  currentCityState,
  adoptOriginCity,
  refreshTerritorySummary,
  authorityRank,
  authorityLabel
} = require('./chronicleV5CitySystem');
const { createEmptySoftState } = require('./chronicleV5SoftState');

const BACKGROUNDS = [];

const SECTS = [];

const CITIES = [];

const FACTIONS = [];

const RELATION_SEEDS = [];

const MAINLINE_ACTS = [
  {
    id: 'foothold',
    title: '立足',
    summary: '乱世里没有空白地带。我得先有一座城、一批人和一层不会立刻塌掉的根基。',
    crisis: '若钱粮和人心一并松动，我连继续往下走的资格都没有。',
    focus: ['govern', 'trade', 'social', 'martial']
  },
  {
    id: 'network',
    title: '织网',
    summary: '单枪匹马走不远。我需要人脉、盟友、门派和一批肯在关键时刻站出来的人。',
    crisis: '若所有关系都只停在表面，下一次风向一变，第一个被丢下的人就是我。',
    focus: ['diplomacy', 'social', 'sect', 'investigate']
  },
  {
    id: 'rise',
    title: '起势',
    summary: '走到这一步，光活着已经不够。我必须把自己的名字压进局势里，让别人绕不开我。',
    crisis: '若关键胜负始终落不到手里，我积下的一切都会成为别人的垫脚石。',
    focus: ['battle', 'military', 'intrigue', 'travel']
  }
];

function applyLoadedContent(snapshot) {
  const source = snapshot || getContentSnapshot();
  BACKGROUNDS_CONTENT = source.backgrounds || [];
  SECTS_CONTENT = source.sects || [];
  CITIES_CONTENT = source.cities || [];
  ORIGIN_CITY_IDS = source.originCityIds || [];
  CITY_ROUTE_LINES = source.routes || [];
  TEXT_MAP_GROUPS_CONTENT = source.textMapGroups || [];
  FACTIONS_CONTENT = source.factions || [];
  HISTORICAL_RELATIONS = source.characters || [];
  RANDOM_NPC_TEMPLATES = source.randomNpcTemplates || [];
  BACKGROUND_RELATION_RULES = source.backgroundRelationRules || {};
  FIXED_ACTION_CONFIG = source.actions || [];

  BACKGROUNDS.splice(0, BACKGROUNDS.length, ...BACKGROUNDS_CONTENT);
  SECTS.splice(0, SECTS.length, ...SECTS_CONTENT);
  CITIES.splice(0, CITIES.length, ...CITIES_CONTENT);
  FACTIONS.splice(0, FACTIONS.length, ...FACTIONS_CONTENT);

  BACKGROUNDS.forEach((item) => {
    const patch = BACKGROUND_RULES[item.id];
    if (patch) Object.assign(item, patch);
  });

  SECTS.forEach((item) => {
    const patch = SECT_RULES[item.id];
    if (patch) Object.assign(item, patch);
  });
}

applyLoadedContent(getContentSnapshot());

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const PLAYER_GENDER_POOL = [
  { key: 'male', label: '男', pronoun: '他' },
  { key: 'female', label: '女', pronoun: '她' }
];

const PLAYER_SURNAMES = ['赵', '顾', '陆', '谢', '沈', '霍', '裴', '苏', '程', '乔', '萧', '吕', '尹', '纪'];
const PLAYER_GIVEN_NAMES = {
  male: ['承岳', '景行', '子衿', '怀瑾', '行川', '长风', '临渊', '砚秋', '玄策', '昭明', '知野', '闻铎'],
  female: ['闻筝', '云蘅', '知雪', '清漪', '明昭', '令仪', '疏月', '南乔', '照微', '栖梧', '景宁', '织秋']
};

function pickRandom(list) {
  if (!Array.isArray(list) || !list.length) return '';
  return list[Math.floor(Math.random() * list.length)];
}

function pickRandomItems(list, count) {
  const pool = Array.isArray(list) ? list.slice() : [];
  const result = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function normalizePlayerName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\u4e00-\u9fffA-Za-z0-9·]/g, '');
}

function validatePlayerName(value, options = {}) {
  const allowEmpty = options && options.allowEmpty === true;
  const normalized = normalizePlayerName(value);
  if (!normalized) {
    if (allowEmpty) return '';
    throw new Error('姓名不能为空。');
  }
  if (normalized.length < 2 || normalized.length > 12) {
    throw new Error('姓名需为 2 到 12 个字符。');
  }
  return normalized;
}

function createPlayerProfile(options = {}) {
  const gender = pickRandom(PLAYER_GENDER_POOL) || PLAYER_GENDER_POOL[0];
  const surname = pickRandom(PLAYER_SURNAMES) || '沈';
  const givenName = pickRandom(PLAYER_GIVEN_NAMES[gender.key]) || '知微';
  const customName = validatePlayerName(options && options.name, { allowEmpty: true });
  return {
    name: customName || `${surname}${givenName}`,
    nameSource: customName ? 'custom' : 'generated',
    gender: gender.key,
    genderLabel: gender.label,
    pronoun: gender.pronoun
  };
}

function monthName(month) {
  const names = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  return names[Math.max(0, Math.min(11, month - 1))];
}

function seasonName(month) {
  if (month <= 3) return '春';
  if (month <= 6) return '夏';
  if (month <= 9) return '秋';
  return '冬';
}

function eraOf(year) {
  if (year >= 184 && year <= 189) return { title: '中平', start: 184 };
  if (year >= 190 && year <= 193) return { title: '初平', start: 190 };
  if (year >= 194 && year <= 195) return { title: '兴平', start: 194 };
  if (year >= 196 && year <= 219) return { title: '建安', start: 196 };
  if (year >= 220 && year <= 226) return { title: '黄初', start: 220 };
  return { title: '太和', start: 227 };
}

function createDateLabel(year, month) {
  const era = eraOf(year);
  const eraYear = year - era.start + 1;
  const eraYearText = eraYear === 1 ? '元年' : `${eraYear}年`;
  return `${era.title}${eraYearText}${seasonName(month)}${monthName(month)}`;
}

function distanceBetween(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy)));
}

function routeTypeLabel(type) {
  return {
    official: '官道',
    land: '陆路',
    river: '水路',
    canal: '漕运',
    coast: '海道',
    mountain: '山道'
  }[type] || '路线';
}

function routeCostProfile(route) {
  const weight = Math.max(1, Number(route && route.weight || 1));
  const type = route && route.type ? route.type : 'land';
  if (type === 'official') {
    return { coinCost: 1 + weight, supplyCost: Math.max(0, Math.floor(weight / 3)), risk: '低' };
  }
  if (type === 'river' || type === 'canal' || type === 'coast') {
    return { coinCost: 2 + weight, supplyCost: Math.max(0, Math.floor(weight / 4)), risk: '中' };
  }
  if (type === 'mountain') {
    return { coinCost: 2 + Math.ceil(weight * 1.5), supplyCost: Math.max(1, Math.floor(weight / 2)), risk: '高' };
  }
  return { coinCost: 2 + Math.ceil(weight * 1.2), supplyCost: Math.max(1, Math.floor(weight / 3) + 1), risk: '中' };
}

function buildCityRouteIndex() {
  const index = {};
  CITY_ROUTE_LINES.forEach((route) => {
    if (!route || !route.from || !route.to) return;
    if (!index[route.from]) index[route.from] = [];
    if (!index[route.to]) index[route.to] = [];
    index[route.from].push(Object.assign({}, route, { otherCityId: route.to }));
    index[route.to].push(Object.assign({}, route, { otherCityId: route.from }));
  });
  return index;
}

let CITY_ROUTE_INDEX = buildCityRouteIndex();

function refreshContentSnapshot() {
  applyLoadedContent(getContentSnapshot());
  CITY_ROUTE_INDEX = buildCityRouteIndex();
  return {
    backgrounds: BACKGROUNDS.length,
    sects: SECTS.length,
    cities: CITIES.length,
    routes: CITY_ROUTE_LINES.length,
    actions: FIXED_ACTION_CONFIG.length
  };
}

function buildTextMapAtlas() {
  const fallbackRegions = [];
  CITIES.forEach((city) => {
    const regionName = city.region || '未定';
    let bucket = fallbackRegions.find((item) => item.region === regionName);
    if (!bucket) {
      bucket = { region: regionName, cities: [] };
      fallbackRegions.push(bucket);
    }
    bucket.cities.push(city.name);
  });
  const regions = (Array.isArray(TEXT_MAP_GROUPS_CONTENT) && TEXT_MAP_GROUPS_CONTENT.length
    ? TEXT_MAP_GROUPS_CONTENT.map((group) => ({
      region: group.region,
      cities: (group.cityIds || [])
        .map((cityId) => findCity(cityId))
        .filter(Boolean)
        .map((city) => city.name)
    })).filter((group) => group.cities.length)
    : fallbackRegions);
  return {
    totalCities: CITIES.length,
    originCities: ORIGIN_CITY_IDS
      .map((cityId) => findCity(cityId))
      .filter(Boolean)
      .map((city) => ({ id: city.id, name: city.name, region: city.region })),
    regions,
    corridors: CITY_ROUTE_LINES.slice(0, 12).map((route) => {
      const from = findCity(route.from);
      const to = findCity(route.to);
      return {
        id: route.id,
        label: route.label || `${from ? from.name : route.from}鑷${to ? to.name : route.to}`,
        type: routeTypeLabel(route.type),
        from: from ? from.name : route.from,
        to: to ? to.name : route.to
      };
    })
  };
}

function canonicalRouteBetween(fromCityId, toCityId) {
  const edges = CITY_ROUTE_INDEX[fromCityId] || [];
  return edges.find((item) => item && item.otherCityId === toCityId) || null;
}

function travelPlanEdgeScore(route) {
  if (!route) return Number.POSITIVE_INFINITY;
  const weight = Math.max(1, Number(route.weight || 1));
  const typeFactor = {
    official: 0.9,
    land: 1,
    river: 1.05,
    canal: 1.02,
    coast: 1.1,
    mountain: 1.4
  }[route.type] || 1;
  return Math.round(weight * 10 * typeFactor);
}

function buildTravelPlan(fromCityId, targetCityId) {
  const start = findCity(fromCityId);
  const target = findCity(targetCityId);
  if (!start || !target || start.id === target.id) return null;

  const dist = {};
  const prev = {};
  const visited = new Set();
  CITIES.forEach((city) => {
    dist[city.id] = Number.POSITIVE_INFINITY;
    prev[city.id] = null;
  });
  dist[start.id] = 0;

  while (visited.size < CITIES.length) {
    let currentId = '';
    let currentScore = Number.POSITIVE_INFINITY;
    CITIES.forEach((city) => {
      if (visited.has(city.id)) return;
      if (dist[city.id] < currentScore) {
        currentScore = dist[city.id];
        currentId = city.id;
      }
    });
    if (!currentId || !Number.isFinite(currentScore)) break;
    if (currentId === target.id) break;
    visited.add(currentId);

    (CITY_ROUTE_INDEX[currentId] || []).forEach((edge) => {
      const nextId = edge.otherCityId;
      if (!nextId || visited.has(nextId)) return;
      const candidate = currentScore + travelPlanEdgeScore(edge);
      if (candidate < dist[nextId]) {
        dist[nextId] = candidate;
        prev[nextId] = currentId;
      }
    });
  }

  if (!Number.isFinite(dist[target.id])) return null;

  const nodeIds = [];
  let cursor = target.id;
  while (cursor) {
    nodeIds.unshift(cursor);
    cursor = prev[cursor];
  }
  if (nodeIds[0] !== start.id || nodeIds.length < 2) return null;

  const legs = [];
  let totalDistance = 0;
  let totalCoinCost = 0;
  let totalSupplyCost = 0;
  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const from = findCity(nodeIds[index]);
    const to = findCity(nodeIds[index + 1]);
    const route = canonicalRouteBetween(from.id, to.id);
    if (!from || !to || !route) return null;
    const costs = routeCostProfile(route);
    const leg = {
      routeId: route.id,
      routeLabel: route.label || `${from.name}至${to.name}`,
      routeType: route.type,
      routeTypeLabel: routeTypeLabel(route.type),
      fromCityId: from.id,
      fromCityName: from.name,
      toCityId: to.id,
      toCityName: to.name,
      region: to.region,
      distance: Math.max(1, Number(route.weight || distanceBetween(from, to))),
      coinCost: costs.coinCost,
      supplyCost: costs.supplyCost,
      risk: costs.risk
    };
    totalDistance += leg.distance;
    totalCoinCost += leg.coinCost;
    totalSupplyCost += leg.supplyCost;
    legs.push(leg);
  }

  return {
    fromCityId: start.id,
    fromCityName: start.name,
    targetCityId: target.id,
    targetCityName: target.name,
    targetRegion: target.region,
    cityIds: nodeIds.slice(),
    routeIds: legs.map((item) => item.routeId),
    stopoverCityIds: nodeIds.slice(1, -1),
    stopoverNames: nodeIds.slice(1, -1).map((cityId) => {
      const city = findCity(cityId);
      return city ? city.name : cityId;
    }),
    legs,
    legCount: legs.length,
    totalDistance,
    totalCoinCost,
    totalSupplyCost,
    monthsCost: Math.max(1, Math.min(4, Math.ceil(totalDistance / 5))),
    displayLabel: legs.map((leg) => leg.toCityName).join(' → ')
  };
}

function buildLongTravelPlans(cityId, limit = 4) {
  const start = findCity(cityId);
  if (!start) return [];
  const nearbyIds = new Set((CITY_ROUTE_INDEX[cityId] || []).map((item) => item.otherCityId));
  const preferredHubs = new Set(['hanzhong', 'guangling', 'wan', 'hefei', 'chaisang', 'beiping'].concat(ORIGIN_CITY_IDS));
  const plans = CITIES
    .filter((city) => city.id !== cityId && !nearbyIds.has(city.id))
    .map((city) => buildTravelPlan(cityId, city.id))
    .filter((plan) => plan && plan.legCount >= 2)
    .sort((a, b) => {
      const aHub = preferredHubs.has(a.targetCityId) ? 0 : 1;
      const bHub = preferredHubs.has(b.targetCityId) ? 0 : 1;
      if (aHub !== bHub) return aHub - bHub;
      if (a.totalDistance !== b.totalDistance) return a.totalDistance - b.totalDistance;
      return a.totalCoinCost - b.totalCoinCost;
    });

  const picked = [];
  const seenRegions = new Set();
  plans.forEach((plan) => {
    if (picked.length >= limit) return;
    const region = plan.targetRegion || '';
    if (region && seenRegions.has(region) && picked.length + 1 < limit) return;
    picked.push({
      cityId: plan.targetCityId,
      cityName: plan.targetCityName,
      region: plan.targetRegion,
      distance: plan.totalDistance,
      coinCost: plan.totalCoinCost,
      supplyCost: plan.totalSupplyCost,
      monthsCost: plan.monthsCost,
      legCount: plan.legCount,
      stopovers: plan.stopoverNames.slice(),
      routeLabel: plan.displayLabel,
      routeTypeLabel: '远行规划',
      risk: plan.legs.some((item) => item.risk === '高') ? '高' : (plan.legs.some((item) => item.risk === '中') ? '中' : '低')
    });
    if (region) seenRegions.add(region);
  });
  return picked;
}

function findCity(cityId) {
  return CITIES.find((item) => item.id === cityId) || null;
}

function findSect(sectId) {
  return SECTS.find((item) => item.id === sectId) || null;
}

function findCitySects(cityId) {
  const city = findCity(cityId);
  if (!city) return [];
  const ids = Array.isArray(city.sectIds) && city.sectIds.length
    ? city.sectIds
    : (city.sectId ? [city.sectId] : []);
  return ids.map((id) => findSect(id)).filter(Boolean);
}

function evaluateSectEligibility(state, sect) {
  const gs = state.gameState || {};
  const requirements = sect && sect.joinRequirements ? sect.joinRequirements : {};
  const unmet = [];
  if (Array.isArray(requirements.backgrounds) && requirements.backgrounds.length && !requirements.backgrounds.includes(gs.backgroundId)) {
    unmet.push(`出身需为${requirements.backgrounds.map((id) => {
      const background = BACKGROUNDS.find((item) => item.id === id);
      return background ? background.label : id;
    }).join('、')}`);
  }
  if (requirements.minRenown && Number(gs.renown || 0) < Number(requirements.minRenown || 0)) {
    unmet.push(`名望需达到${requirements.minRenown}`);
  }
  Object.keys(requirements.minStats || {}).forEach((key) => {
    const need = Number(requirements.minStats[key] || 0);
    const current = Number(gs[key] || 0);
    if (current < need) {
      const labelMap = {
        health: '身骨',
        martialLevel: '武艺',
        strategy: '谋略',
        diplomacy: '外交',
        charm: '魅力',
        influence: '影响',
        renown: '名望'
      };
      unmet.push(`${labelMap[key] || key}需达到${need}`);
    }
  });
  return {
    eligible: unmet.length === 0,
    unmet,
    requirementText: requirements.requirementText || unmet.join('、') || '暂无额外门槛'
  };
}

function martialRealmOf(level) {
  const lv = Math.max(0, Number(level || 0));
  const interpolateTroops = (startLevel, startPower, endLevel, endPower) => {
    if (lv <= startLevel) return startPower;
    if (lv >= endLevel) return endPower;
    const ratio = (lv - startLevel) / Math.max(1, endLevel - startLevel);
    return Math.round(startPower * Math.pow(endPower / startPower, ratio));
  };

  let troopEquivalent = 2;
  let name = '未入流';

  if (lv >= 100) {
    troopEquivalent = 100000;
    name = '十万人敌';
  } else if (lv >= 96) {
    troopEquivalent = interpolateTroops(96, 5000, 100, 100000);
    name = '万人敌';
  } else if (lv >= 90) {
    troopEquivalent = interpolateTroops(90, 1200, 96, 5000);
    name = '万人敌';
  } else if (lv >= 78) {
    troopEquivalent = interpolateTroops(78, 240, 90, 1200);
    name = '千人敌';
  } else if (lv >= 64) {
    troopEquivalent = interpolateTroops(64, 60, 78, 240);
    name = '百人敌';
  } else if (lv >= 55) {
    troopEquivalent = interpolateTroops(55, 32, 64, 60);
    name = '一流高手';
  } else if (lv >= 40) {
    troopEquivalent = interpolateTroops(40, 18, 55, 32);
    name = '登堂入室';
  } else if (lv >= 25) {
    troopEquivalent = interpolateTroops(25, 9, 40, 18);
    name = '初窥门径';
  } else if (lv >= 10) {
    troopEquivalent = interpolateTroops(10, 4, 25, 9);
    name = '略通拳脚';
  } else {
    troopEquivalent = 2 + Math.floor(lv / 2);
  }

  return { name, troopEquivalent };
}

function currentMartialBottleneck(gameState) {
  const level = Number(gameState.martialLevel || 0);
  const insight = Number(gameState.martialInsight || 0);
  return MARTIAL_BOTTLENECKS.find((item) => level >= item.level && insight < item.insight) || null;
}

function applyMartialSnapshot(gameState) {
  const realm = martialRealmOf(gameState.martialLevel || 0);
  gameState.martialRealm = realm.name;
  gameState.martialPower = realm.troopEquivalent;
  gameState.martialInsight = Math.max(0, Number(gameState.martialInsight || 0));
  const bottleneck = currentMartialBottleneck(gameState);
  gameState.martialBottleneckName = bottleneck ? bottleneck.name : '';
  gameState.martialBottleneckHint = bottleneck ? bottleneck.hint : '';
  return gameState;
}

function martialTitleOf(gameState) {
  const focusId = gameState.martialFocusId || 'unbound';
  const battlefieldPrestige = Number(gameState.battlefieldPrestige || 0);
  const jianghuPrestige = Number(gameState.jianghuPrestige || 0);
  const martialPower = Number(gameState.martialPower || 0);
  const martialLevel = Number(gameState.martialLevel || 0);

  if (focusId === 'battlefield') {
    if (martialLevel >= 100) return '十万人敌';
    if (battlefieldPrestige >= 150 && martialLevel >= 96) return '万人敌';
    if (battlefieldPrestige >= 105 && martialLevel >= 88) return '陷阵先登';
    if (battlefieldPrestige >= 52 && martialLevel >= 70) return '军前骁锐';
    return '行伍新锐';
  }

  if (focusId === 'jianghu') {
    if (martialLevel >= 100) return '武林神话';
    if (jianghuPrestige >= 150 && martialLevel >= 96) return '天下第一';
    if (jianghuPrestige >= 100 && martialLevel >= 86) return '名震江湖';
    if (jianghuPrestige >= 48 && martialLevel >= 64) return '一方名手';
    return '初入江湖';
  }

  if (martialLevel >= 100) return '十万人敌';
  if (martialLevel >= 96) return '万人敌';
  if (martialLevel >= 90) return '千人敌';
  if (martialLevel >= 78) return '百人敌';
  if (martialLevel >= 25) return '练家子';
  return gameState.martialRealm || '未入流';
}

function applyMartialFocusSnapshot(gameState) {
  const martialFocus = getMartialFocus(gameState.martialFocusId);
  gameState.martialFocusId = martialFocus.id;
  gameState.martialFocusName = martialFocus.name;
  gameState.martialFocusSummary = martialFocus.description;
  gameState.battlefieldPrestige = Math.max(0, Number(gameState.battlefieldPrestige || 0));
  gameState.jianghuPrestige = Math.max(0, Number(gameState.jianghuPrestige || 0));
  gameState.martialTitle = martialTitleOf(gameState);
  gameState.martialLimitBroken = gameState.martialLimitBroken === true;
  gameState.martialTrainingCap = gameState.martialLimitBroken ? 100 : 90;
  gameState.martialBreakthroughState = gameState.martialLimitBroken ? '已破限' : '未破限';
  gameState.martialBreakthroughHint = gameState.martialLimitBroken
    ? '奇遇已经打破极限，这身武学还能继续往十万人敌的路上冲。'
    : '常规修炼最高止于 90。想再往上，不只要练，还得把名势、悟性、绝境与真正的点拨凑齐。';
  return gameState;
}

function applyPathSnapshot(gameState) {
  const martialPath = getMartialPath(gameState.martialRouteId);
  const strategyPath = getStrategyPath(gameState.strategyRouteId);
  gameState.martialRouteId = martialPath.id;
  gameState.martialRouteName = martialPath.name;
  gameState.martialRouteSummary = martialPath.description;
  gameState.strategyRouteId = strategyPath.id;
  gameState.strategyRouteName = strategyPath.name;
  gameState.strategyRouteSummary = strategyPath.description;
  gameState.strategyLevel = clamp(Number(gameState.strategyLevel || 0), 0, 100);
  gameState.strategyExp = Math.max(0, Number(gameState.strategyExp || 0));
  applyMartialSnapshot(gameState);
  return applyMartialFocusSnapshot(gameState);
}

function stanceForFaction(faction) {
  if (faction.hostility >= 60) return '敌视';
  if (faction.favor >= 35 && faction.hostility <= 20) return '可深交';
  if (faction.favor >= 18) return '可接近';
  if (faction.leverage >= 25) return '彼此试探';
  if (faction.hostility >= 35) return '戒备';
  return '观望';
}

function cloneFactionList() {
  return FACTIONS.map((item) => Object.assign({}, item, { stance: stanceForFaction(item) }));
}

function createGeneratedNpcPersona(template, backgroundId, index) {
  const backgroundFlavor = {
    imperial_kin: '见惯礼数与门第轻重',
    local_gentry: '熟悉乡里豪强和地面规矩',
    fallen_scholar: '说话里常带审势与分寸',
    merchant_heir: '天生会算人情往来与利害轻重',
    refugee: '对危险、饥饿和人心冷暖都更敏感'
  }[backgroundId] || '对乱世里的风向格外敏感';
  const variants = [
    { speech: '说话偏稳，先看人心，再把话慢慢放出来。', conduct: '做事喜欢先留后手，不轻易把底牌摊开。', values: ['分寸', '自保', '识人'], dislikes: ['轻率失言', '无端树敌'] },
    { speech: '言辞利落，不喜欢来回试探。', conduct: '重效率，见势不对会立刻换手。', values: ['效率', '结果', '时机'], dislikes: ['拖沓', '空话'] },
    { speech: '表面客气，心里一直在掂量局势和人心。', conduct: '不轻易站边，但一旦下注就会押得很深。', values: ['判断', '筹码', '退路'], dislikes: ['盲目冒进', '看不清局'] }
  ];
  const variant = variants[index % variants.length];
  const tagSet = new Set(Array.isArray(template.tags) ? template.tags : []);
  const roleAnchor = tagSet.has('trade')
    ? '久在钱粮、货路和账面之间打滚，对得失极敏感。'
    : tagSet.has('military') || tagSet.has('battle')
      ? '久看营伍、军纪和人手调度，天然更信真本事和硬执行。'
      : tagSet.has('martial')
        ? '在江湖和实战里磨出过眼力，先看手底下有没有真功夫。'
        : tagSet.has('diplomacy') || tagSet.has('social')
          ? '擅长看脸色、听弦外之音，也会借话头拿捏距离。'
          : '在乱局里练出了看人和自处的本能。';
  return {
    personaAnchor: `${template.summary || '此人自有底色。'}${roleAnchor}${backgroundFlavor}。`,
    speechStyle: variant.speech,
    conductStyle: variant.conduct,
    values: variant.values.slice(),
    dislikes: variant.dislikes.slice(),
    promptFocus: `出场时保持“${template.title}”这一类人物的稳定气口与处事方式，不要写成万能工具人。`
  };
}

function createNpcSeed(template, backgroundId, index) {
  const names = Array.isArray(template.baseName) ? template.baseName : ['无名氏'];
  const name = names[index % names.length];
  const persona = createGeneratedNpcPersona(template, backgroundId, index);
  return {
    id: `${template.id}_${backgroundId}_${index}`,
    name,
    title: template.title,
    factionId: template.factionId,
    summary: template.summary,
    personaAnchor: persona.personaAnchor,
    speechStyle: persona.speechStyle,
    conductStyle: persona.conductStyle,
    values: persona.values,
    dislikes: persona.dislikes,
    promptFocus: persona.promptFocus,
    trust: 2 + (index % 3),
    affection: 0,
    loyalty: 1 + (index % 2),
    rivalry: 0,
    tags: template.tags || [],
    isHistorical: false,
    visibilityState: 'hidden',
    discovered: false,
    bondKey: '',
    bondLabel: '未定',
    bondSummary: '',
    favorScore: 0,
    romanceStage: '未启'
  };
}

function nonHistoricalPersonaAnchorOf(relation) {
  if (!relation) return '';
  if (relation.personaAnchor) return relation.personaAnchor;
  const personality = String(relation.personality || '').trim();
  const martialProfile = String(relation.martialProfile || '').trim();
  const summary = String(relation.summary || '').trim();
  if (personality || martialProfile) {
    return [summary, personality, martialProfile].filter(Boolean).join('，');
  }
  return summary;
}

function nonHistoricalPromptFocusOf(relation) {
  if (!relation) return '';
  if (relation.promptFocus) return relation.promptFocus;
  if (relation.isExtraCharacter) {
    return '此人是追加人物，必须沿用既有性格描写、武学特征、性别和关系温度，不要临时变口；其人属于江湖人物线，若无主角主动介入，不会自行卷入军旅、战阵或朝堂动向。';
  }
  return '此人是本地生成的随机角色，必须沿用当前给定的性格底色、说话方式和处事取向。';
}

function relationFavorScore(relation) {
  if (!relation) return 0;
  const trust = Number(relation.trust || 0);
  const affection = Number(relation.affection || 0);
  const loyalty = Number(relation.loyalty || 0);
  const rivalry = Number(relation.rivalry || 0);
  return clamp(Math.round(trust * 0.5 + affection * 1.2 + loyalty * 0.35 - rivalry * 0.85), 0, 100);
}

function romanceStageOf(relation) {
  const trust = Number(relation && relation.trust || 0);
  const affection = Number(relation && relation.affection || 0);
  const favorScore = relationFavorScore(relation);
  const rivalry = Number(relation && relation.rivalry || 0);
  if (rivalry >= 45) return '未启';
  if (affection >= 70 && trust >= 48) return '定情';
  if (affection >= 42 && favorScore >= 58 && trust >= 28) return '暧昧';
  if (favorScore >= 36 && trust >= 14) return '近身';
  return '未启';
}

function isRomanceCandidate(relation) {
  return !!relation && romanceStageOf(relation) !== '未启';
}

function isRelationVisible(relation) {
  return !!relation && isRelationMet(relation);
}

function buildRelationRoster(options = {}) {
  const normalized = typeof options === 'string'
    ? { backgroundId: options }
    : (options && typeof options === 'object' ? options : {});
  const backgroundId = normalized.backgroundId || '';
  const cityId = normalized.cityId || '';
  const year = Number(normalized.year || 196);
  const rule = backgroundId ? (BACKGROUND_RELATION_RULES[backgroundId] || {}) : { historical: [], npc: [] };
  const historical = HISTORICAL_RELATIONS
    .filter((item) => !Array.isArray(rule.historical) || rule.historical.includes(item.id))
    .map((item) => {
      const persona = getHistoricalPersona(item.id);
      const baseSummary = persona && persona.personaAnchor ? persona.personaAnchor : item.summary;
      return Object.assign({}, item, {
        isHistorical: true,
        trust: Number(item.trust || 5),
        affection: Number(item.affection || 0),
        loyalty: Number(item.loyalty || 2),
        rivalry: Number(item.rivalry || 0),
        summary: baseSummary,
        historicalBaseTitle: item.title,
        historicalBaseSummary: baseSummary,
        personaAnchor: persona ? persona.personaAnchor : '',
        speechStyle: persona ? persona.speechStyle : '',
        conductStyle: persona ? persona.conductStyle : '',
        martialRating: persona ? Number(persona.martialRating || 0) : 0,
        strategyRating: persona ? Number(persona.strategyRating || 0) : 0,
        signatureSkills: persona && Array.isArray(persona.signatureSkills) ? persona.signatureSkills.slice() : [],
        values: persona ? persona.values : [],
        dislikes: persona ? persona.dislikes : [],
        promptFocus: persona ? persona.promptFocus : ''
      });
    });
  const npcSeeds = (rule.npc || [])
    .map((id) => RANDOM_NPC_TEMPLATES.find((item) => item.id === id))
    .filter(Boolean)
    .map((item, index) => createNpcSeed(item, backgroundId || 'default', index));
  const extraSeeds = buildExtraCharacterSeeds(backgroundId, cityId);

  const roster = historical.concat(npcSeeds).concat(extraSeeds).map((item) => Object.assign({}, item, {
    personaAnchor: item.isHistorical ? item.personaAnchor : nonHistoricalPersonaAnchorOf(item),
    speechStyle: item.speechStyle || '',
    conductStyle: item.conductStyle || '',
    values: Array.isArray(item.values) ? item.values.slice() : [],
    dislikes: Array.isArray(item.dislikes) ? item.dislikes.slice() : [],
    promptFocus: item.isHistorical ? item.promptFocus : nonHistoricalPromptFocusOf(item),
    status: item.isHistorical ? '我们已经互相听过名字，但还远没到能托付后背的时候。' : '这人暂时还在观望，我值不值得继续接触。', 
    intimacyTag: '初识',
    rivalry: Number(item.rivalry || 0),
    bondKey: item.bondKey || '',
    bondLabel: item.bondLabel || '未定',
    bondSummary: item.bondSummary || '',
    favorScore: relationFavorScore(item),
    romanceStage: romanceStageOf(item)
  }));

  return syncHistoricalRelationPresence(roster, {
    cityId,
    year,
    preserveDiscovery: false
  }).relationships;
}

function cloneRelationList() {
  return RELATION_SEEDS.map((item) => Object.assign({}, item, {
    status: '还在观察我。',
    intimacyTag: '初识',
    rivalry: Number(item.rivalry || 0),
    bondKey: item.bondKey || '',
    bondLabel: item.bondLabel || '未定',
    bondSummary: item.bondSummary || '',
    favorScore: relationFavorScore(item),
    romanceStage: romanceStageOf(item)
  }));
}

function createBackgroundChoices() {
  return BACKGROUNDS.map((item) => ({
    id: `background:${item.id}`,
    text: item.label,
    hint: item.description,
    category: '出身'
  }));
}

function createOriginChoices() {
  return ORIGIN_CITY_IDS
    .map((cityId) => findCity(cityId))
    .filter(Boolean)
    .map((city) => ({
    id: `origin:${city.id}`,
    text: city.name,
    hint: `${city.region} · ${city.description}。初始人脉与史实人物接触面会在这里定下来。`,
    category: '籍贯'
    }));
}

function buildNearbyRoutes(cityId) {
  const city = findCity(cityId);
  if (!city) return [];
  return (CITY_ROUTE_INDEX[city.id] || [])
    .map((route) => {
      const target = findCity(route.otherCityId);
      if (!target) return null;
      const costs = routeCostProfile(route);
      return {
        cityId: target.id,
        cityName: target.name,
        region: target.region,
        distance: Math.max(1, Number(route.weight || distanceBetween(city, target))),
        coinCost: costs.coinCost,
        supplyCost: costs.supplyCost,
        routeType: route.type,
        routeTypeLabel: routeTypeLabel(route.type),
        routeLabel: route.label || `${city.name}至${target.name}`,
        risk: costs.risk
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || a.cityName.localeCompare(b.cityName, 'zh-Hans-CN'))
    .slice(0, 6);
}

function createLocalSectChoices(state) {
  return findCitySects(state.world.currentCityId)
    .slice(0, 2)
    .map((sect) => {
      const access = evaluateSectEligibility(state, sect);
      return {
        id: `joinsect:${sect.id}`,
        text: `拜访${sect.name}`,
        actionText: `前去拜访${sect.name}的山门，试探门中人物对我有没有收留与栽培的意思`,
        hint: access.eligible
          ? `${sect.summary} 收徒门槛：${access.requirementText}`
          : `${sect.summary} 当前未达成：${access.unmet.join('、') || access.requirementText}`,
        category: '门派',
        actionKind: 'joinsect',
        actionMode: 'joinsect',
        source: 'fixed',
        group: 'sect_outer',
        direction: 'martial',
        disabled: !access.eligible
      };
    });
}

function battleAccessInfo(state, mode) {
  const gs = state && state.gameState ? state.gameState : {};
  const world = state && state.world ? state.world : {};
  const actProgress = Number(world.mainline && world.mainline.progress || 0);
  const turn = Number(world.turn || 0);

  if (mode === 'warpath') {
    const unlocked = turn >= 2 && (
      actProgress >= 16
      || Number(gs.military || 0) >= 12
      || Number(gs.martialLevel || 0) >= 10
      || Number(gs.troops || 0) >= 20
      || Number(gs.renown || 0) >= 8
    );
    return {
      unlocked,
      reason: unlocked ? '' : '至少推进到第 2 回合，并且要先有一点军务、武艺、部曲或名望底子，才适合真正把脚伸进军旅线。'
    };
  }

  if (mode === 'battlefield') {
    const unlocked = turn >= 3 && (actProgress >= 22 || Number(gs.troops || 0) >= 60 || Number(gs.military || 0) >= 18);
    return {
      unlocked,
      reason: unlocked ? '' : '至少推进到第 3 回合，并且要有一定主线进度，或先攒出部曲/军务底子，才适合真正起兵。'
    };
  }

  const unlocked = turn >= 2 && (actProgress >= 16 || Number(gs.martialLevel || 0) >= 10 || !!gs.sectId || Number(gs.renown || 0) >= 8);
  return {
    unlocked,
    reason: unlocked ? '' : '至少推进到第 2 回合，并且要有一点武学、门派或名望底子，才适合正式问剑。'
  };
}

function topRelationForChoice(state, predicate) {
  return (state.gameState.relationships || [])
    .filter((item) => isRelationVisible(item) && (!predicate || predicate(item)))
    .slice()
    .sort((a, b) => ((b.trust || 0) + (b.affection || 0) + (b.loyalty || 0)) - ((a.trust || 0) + (a.affection || 0) + (a.loyalty || 0)))[0] || null;
}

function relationTagsOf(relation) {
  return Array.isArray(relation && relation.tags) ? relation.tags : [];
}

function relationHasAnyTag(relation, tags) {
  const bag = relationTagsOf(relation);
  return (Array.isArray(tags) ? tags : []).some((tag) => bag.includes(tag));
}

function relationScore(relation) {
  if (!relation) return -999;
  return Number(relation.trust || 0) + Number(relation.affection || 0) * 1.25 + Number(relation.loyalty || 0) - Number(relation.rivalry || 0) * 1.5;
}

function topTaggedRelation(state, tags) {
  return (state.gameState.relationships || [])
    .filter((item) => isRelationVisible(item) && relationHasAnyTag(item, tags))
    .slice()
    .sort((a, b) => relationScore(b) - relationScore(a))[0] || null;
}

function topHistoricalTaggedRelation(state, tags) {
  return (state.gameState.relationships || [])
    .filter((item) => item && item.isHistorical === true && isRelationVisible(item) && relationHasAnyTag(item, tags))
    .slice()
    .sort((a, b) => relationScore(b) - relationScore(a))[0] || null;
}

function statRequirement(label, current, minimum) {
  const value = Number(current || 0);
  const need = Number(minimum || 0);
  return {
    type: 'stat',
    label,
    current: value,
    minimum: need,
    met: value >= need
  };
}

function stateRequirement(label, met) {
  return {
    type: 'state',
    label,
    met: !!met
  };
}

function formatRequirementText(requirement) {
  if (!requirement) return '';
  if (requirement.type === 'stat') {
    return `${requirement.label}${requirement.current}/${requirement.minimum}`;
  }
  return requirement.label || '';
}

function buildChoiceAccess(requirements, fallbackReason) {
  const list = Array.isArray(requirements) ? requirements.filter(Boolean) : [];
  const unmet = list.filter((item) => item.met !== true);
  return {
    unlocked: unmet.length === 0,
    reason: unmet.length
      ? (fallbackReason || `条件不足，继续推进相关人物、属性或线索后再尝试。当前缺少：${unmet.map((item) => formatRequirementText(item)).filter(Boolean).join('、')}`)
      : '',
    requirements: list
  };
}

function applyChoiceAccess(choice, access) {
  if (!choice) return choice;
  const next = Object.assign({}, choice, {
    baseHint: choice.baseHint || choice.hint || '',
    requirements: access && Array.isArray(access.requirements) ? access.requirements : (choice.requirements || []),
    lockedReason: access && access.unlocked === false ? (access.reason || '') : ''
  });
  if (access && access.unlocked === false) {
    next.disabled = true;
    next.hint = access.reason || next.baseHint;
  }
  return next;
}

const FIXED_ACTION_STAT_LABELS = {
  governance: '内政',
  commerce: '经商',
  diplomacy: '外交',
  military: '军务',
  strategy: '谋略',
  martialLevel: '武艺',
  martialInsight: '武学领悟',
  charm: '魅力',
  morale: '士气',
  health: '身骨',
  fatigue: '疲惫',
  renown: '名望',
  influence: '影响',
  coins: '钱财',
  supplies: '粮秣',
  troops: '部曲',
  jianghuPrestige: '江湖名望',
  sectFavor: '门中好感',
  sectPower: '门派势力'
};

function hasSkillById(state, skillId) {
  if (!skillId) return false;
  const skills = normalizeSkillList((((state || {}).gameState || {}).skills || []));
  return skills.some((item) => item && item.id === skillId);
}

function buildConfiguredChoiceAccess(state, action) {
  const gs = state && state.gameState ? state.gameState : {};
  const unlock = action && action.unlock ? action.unlock : {};
  const requirements = [];

  Object.keys(unlock.stats || {}).forEach((key) => {
    requirements.push(statRequirement(
      FIXED_ACTION_STAT_LABELS[key] || key,
      Number(gs[key] || 0),
      Number(unlock.stats[key] || 0)
    ));
  });

  if (unlock.requiresSect) {
    requirements.push(stateRequirement('已经有门派根基', !!gs.sectId));
  }

  if (unlock.requiresCityAuthority) {
    const cityState = currentCityState(state);
    const required = String(unlock.requiresCityAuthority || '').trim();
    requirements.push(stateRequirement(
      `当前城池权柄达到“${authorityLabel(required)}”`,
      authorityRank(cityState && cityState.playerAuthority) >= authorityRank(required)
    ));
  }

  if (unlock.maxCityAuthorityBelow) {
    const cityState = currentCityState(state);
    const ceiling = String(unlock.maxCityAuthorityBelow || '').trim();
    requirements.push(stateRequirement(
      `当前城池权柄尚未达到“${authorityLabel(ceiling)}”`,
      authorityRank(cityState && cityState.playerAuthority) < authorityRank(ceiling)
    ));
  }

  if (Array.isArray(unlock.skillsAnyOf) && unlock.skillsAnyOf.length) {
    const labels = unlock.skillsAnyOf.map((item) => item.label || item.id).filter(Boolean);
    const matched = unlock.skillsAnyOf.some((item) => hasSkillById(state, item && item.id));
    requirements.push(stateRequirement(`掌握${labels.join(' / ')}之一`, matched));
  }

  if (unlock.requiresHistoricalRumorInCity) {
    const hasHistoricalRumorInCity = (gs.relationships || []).some((relation) => {
      if (!relation || relation.isHistorical !== true) return false;
      const visibilityState = String(relation.visibilityState || '').trim().toLowerCase();
      if (!['rumor', 'met'].includes(visibilityState)) return false;
      const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
        ? relation.historicalPresence
        : null;
      return !!(presence && presence.active);
    });
    requirements.push(stateRequirement('本城已有可继续推进的史实人物线索', hasHistoricalRumorInCity));
  }

  return buildChoiceAccess(requirements, action && action.lockedHint ? action.lockedHint : '');
}

function createConfiguredFixedActions(state) {
  return (Array.isArray(FIXED_ACTION_CONFIG) ? FIXED_ACTION_CONFIG : []).map((item) => {
    const choice = {
      id: item.id,
      text: item.text,
      actionText: item.actionText || item.id,
      hint: item.hint,
      category: item.category,
      actionKind: item.actionKind,
      actionMode: item.actionMode || '',
      source: 'fixed',
      group: item.group || 'personal',
      groupLabel: item.groupLabel || '',
      direction: item.direction || '',
      targetType: item.targetType || '',
      relationScope: item.relationScope || ''
    };
    const decorated = applyChoiceAccess(choice, buildConfiguredChoiceAccess(state, item));
    const scope = String(item.relationScope || '').trim();
    if (!scope || decorated.disabled) return decorated;
    const scopeOptions = {
      mode: item.actionMode || '',
      purpose: item.actionKind === 'martial' && item.actionMode === 'spar' ? 'spar' : ''
    };
    if (relationCountForChoice(state, scope, scopeOptions) > 0) return decorated;
    const lockedReason = item.lockedHint
      || (scope === 'romance'
        ? '眼下还没有已经热到能推进情感的人物。先把人物线做近，甜味才会真正落地。'
        : scope === 'warpath'
          ? '眼下还没有已结识、且当前能接上线的史实军旅人物可投。先把人物线做深，再来压军旅。'
          : `眼下还没有能承接这一步的${fixedGroupLabel(scope)}对象。`);
    return Object.assign({}, decorated, {
      disabled: true,
      lockedReason,
      hint: lockedReason
    });
  });
}

function buildFoodActionChoices(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const items = Array.isArray(gs.items) ? gs.items : [];
  const foodItems = items
    .filter((item) => item && String(item.itemType || '') === 'food' && Number(item.count || 0) > 0)
    .slice(0, 4);
  if (!foodItems.length) {
    return [{
      id: 'placeholder:food:none',
      text: '行囊里暂无可用食物',
      actionText: 'placeholder:food:none',
      hint: '还没真正把地方风味收进手里。继续经商、行路、设席或推进人物线，才会慢慢遇到值得入口的东西。',
      category: '养成',
      actionKind: 'rest',
      actionMode: 'food_none',
      source: 'fixed',
      group: 'personal',
      direction: 'growth',
      disabled: true
    }];
  }

  return foodItems.map((item) => {
    const def = getFoodDefinition(item.foodId || String(item.id || '').replace(/^food:/, ''));
    const soulLine = def && def.soulLine ? `“${def.soulLine}”` : '';
    const instantDelta = def && def.instantDelta ? def.instantDelta : {};
    const parts = [];
    if (Number(instantDelta.health || 0) > 0) parts.push(`回身骨${Number(instantDelta.health || 0)}`);
    if (Number(instantDelta.fatigue || 0) < 0) parts.push(`减疲惫${Math.abs(Number(instantDelta.fatigue || 0))}`);
    if (Number(instantDelta.morale || 0) > 0) parts.push(`提士气${Number(instantDelta.morale || 0)}`);
    if (Number(instantDelta.supplies || 0) > 0) parts.push(`补粮秣${Number(instantDelta.supplies || 0)}`);
    return {
      id: `action:rest:${def ? def.id : String(item.foodId || '').trim()}:eat`,
      text: `吃${item.name}`,
      actionText: `action:rest:${def ? def.id : String(item.foodId || '').trim()}:eat`,
      hint: [
        def && def.flavorText ? def.flavorText : '',
        parts.length ? `效果：${parts.join('、')}` : '',
        def && def.tempBuff && def.tempBuff.note ? def.tempBuff.note : '',
        soulLine
      ].filter(Boolean).join(' · '),
      category: '养成',
      actionKind: 'rest',
      actionMode: 'eat',
      target: def ? def.id : '',
      targetName: item.name,
      targetType: 'food',
      source: 'fixed',
      group: 'personal',
      direction: 'growth'
    };
  });
}

function buildFoodSupplyChoice(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const currentFoodCount = (Array.isArray(gs.items) ? gs.items : [])
    .filter((item) => item && String(item.itemType || '') === 'food')
    .reduce((sum, item) => sum + Math.max(0, Number(item.count || 0)), 0);
  const access = buildChoiceAccess([
    statRequirement('钱财', Number(gs.coins || 0), 2)
  ], `手头至少得留出2钱，才能先买点粗粮垫住下一程。当前钱财${Number(gs.coins || 0)}。`);
  return applyChoiceAccess({
    id: 'action:rest:rough_rations:stock',
    text: '备点粗食',
    actionText: 'action:rest:rough_rations:stock',
    hint: currentFoodCount > 0
      ? `花2钱补一份最常见的粗食，先把行囊垫住，免得后面真要回气时完全断口。当前口粮${currentFoodCount}份。`
      : '花2钱先买一份最常见的粗食。粗粮不讲究，但至少能保证行囊里一直有口能顶事的东西。',
    category: '养成',
    actionKind: 'rest',
    actionMode: 'stock_food',
    target: 'rough_rations',
    targetName: '粗食',
    targetType: 'food_supply',
    source: 'fixed',
    group: 'personal',
    direction: 'growth'
  }, access);
}

function fixedDirectionForChoice(choice) {
  const explicit = String(choice && choice.direction || '').trim();
  if (explicit) return explicit;
  const kind = String(choice && choice.actionKind || '').trim();
  if (['govern', 'trade'].includes(kind)) return 'governance';
  if (['social', 'romance', 'diplomacy'].includes(kind)) return 'network';
  if (['investigate', 'intrigue'].includes(kind)) return 'strategy';
  if (['martial', 'sect', 'joinsect'].includes(kind)) return 'martial';
  if (['military', 'warpath', 'battle'].includes(kind)) return 'military';
  if (['jianghu', 'spar'].includes(kind)) return 'jianghu';
  if (kind === 'travel') return 'world';
  return 'growth';
}

function fixedGroupLabel(group) {
  return {
    personal: '个人动作',
    recruit: '招募',
    appoint: '任命',
    team: '队伍动作',
    sect_outer: '门派外缘',
    sect_inner: '门派内修',
    travel: '行路'
  }[String(group || '').trim()] || '个人动作';
}

function fixedGroupForChoice(choice) {
  const explicit = String(choice && choice.group || '').trim();
  if (explicit) return explicit;
  const id = String(choice && choice.id || '').trim();
  const mode = String(choice && choice.actionMode || '').trim();
  const kind = String(choice && choice.actionKind || '').trim();
  if (id.startsWith('joinsect:')) return 'sect_outer';
  if (kind === 'sect') {
    if (mode.startsWith('outer_') || id.includes(':outer_')) return 'sect_outer';
    return 'sect_inner';
  }
  if (kind === 'travel') return 'travel';
  return 'personal';
}

function decorateFixedChoice(choice) {
  if (!choice) return choice;
  const group = fixedGroupForChoice(choice);
  return Object.assign({}, choice, {
    source: 'fixed',
    direction: fixedDirectionForChoice(choice),
    group,
    groupLabel: choice.groupLabel || fixedGroupLabel(group)
  });
}

function buildTravelActionChoices(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const currentCityId = state && state.world ? state.world.currentCityId : '';
  const nearChoices = buildNearbyRoutes(currentCityId).slice(0, 2).map((item) => applyChoiceAccess({
    id: `travel:${item.cityId}`,
    text: `前往${item.cityName}`,
    actionText: `travel:${item.cityId}`,
    hint: `${item.routeLabel || '就近道路'}可直达${item.cityName}，路程${item.distance}，需${item.coinCost}钱、${item.supplyCost}粮，风险${item.risk}。`,
    category: '行路',
    actionKind: 'travel',
    actionMode: 'travel',
    group: 'travel',
    direction: 'world'
  }, buildChoiceAccess([
    statRequirement('钱财', Number(gs.coins || 0), Number(item.coinCost || 0)),
    statRequirement('粮秣', Number(gs.supplies || 0), Number(item.supplyCost || 0))
  ], `去${item.cityName}至少要备齐${item.coinCost}钱、${item.supplyCost}粮。当前只有钱财${Number(gs.coins || 0)}、粮秣${Number(gs.supplies || 0)}。`)));
  const longChoices = buildLongTravelPlans(currentCityId, 1).map((item) => applyChoiceAccess({
    id: `travel:${item.cityId}`,
    text: `远行${item.cityName}`,
    actionText: `travel:${item.cityId}`,
    hint: `这是一条${item.legCount}段路的远行，需${item.monthsCost}个月，耗${item.coinCost}钱、${item.supplyCost}粮，途中会经过${(item.stopovers || []).join('、') || '数处驿点'}。`,
    category: '行路',
    actionKind: 'travel',
    actionMode: 'travel',
    group: 'travel',
    direction: 'world'
  }, buildChoiceAccess([
    statRequirement('钱财', Number(gs.coins || 0), Number(item.coinCost || 0)),
    statRequirement('粮秣', Number(gs.supplies || 0), Number(item.supplyCost || 0))
  ], `远行到${item.cityName}至少要备齐${item.coinCost}钱、${item.supplyCost}粮。当前只有钱财${Number(gs.coins || 0)}、粮秣${Number(gs.supplies || 0)}。`)));
  return nearChoices.concat(longChoices);
}

function buildTerritorySiegeChoices(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const cityState = currentCityState(state);
  if (!cityState || authorityRank(cityState.playerAuthority) < authorityRank('control')) return [];
  if (Number(gs.troops || 0) < 260 || Number(gs.supplies || 0) < 24 || Number(gs.morale || 0) < 46) return [];

  return buildNearbyRoutes(state.world.currentCityId)
    .filter((item) => item && item.cityId)
    .map((item) => {
      const targetCityState = state.world && state.world.cityStates ? state.world.cityStates[item.cityId] : null;
      if (!targetCityState) return null;
      if (authorityRank(targetCityState.playerAuthority) >= authorityRank('steward')) return null;
      return {
        id: `action:military:${item.cityId}:seize_city`,
        text: `攻取${item.cityName}`,
        actionText: `action:military:${item.cityId}:seize_city`,
        hint: `${item.cityName}就在近线。若想把版图往外推，这一手会直接进入压服、攻取与接管。对方当前治安${targetCityState.security}、城防${targetCityState.fortification}、守军约${targetCityState.garrison}。`,
        category: '军旅',
        actionKind: 'military',
        actionMode: 'seize_city',
        target: item.cityId,
        targetName: item.cityName,
        targetType: 'city',
        group: 'personal',
        direction: 'military'
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}

function buildSectOuterChoices(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const citySects = findCitySects(state && state.world ? state.world.currentCityId : '');
  if (!citySects.length) return [];
  if (!gs.sectId) return createLocalSectChoices(state);

  return citySects
    .filter((sect) => sect && sect.id !== gs.sectId)
    .slice(0, 2)
    .flatMap((sect) => {
      const visitAccess = buildChoiceAccess([
        statRequirement('名望', Number(gs.renown || 0), 6)
      ], `眼下还没到${sect.name}愿意让我近前试口风的时候。`);
      const studyAccess = buildChoiceAccess([
        statRequirement('武艺', Number(gs.martialLevel || 0), 12),
        statRequirement('名望', Number(gs.renown || 0), 8)
      ], `${sect.name}不会轻易让外人看深处门道，得先拿出些分量。`);
      return [
        applyChoiceAccess({
          id: `action:sect:${sect.id}:outer_visit`,
          text: `拜山${sect.name}`,
          actionText: `action:sect:${sect.id}:outer_visit`,
          hint: `不急着改投门庭，只先去${sect.name}门外走动人情、试探口风，借一层外缘。`,
          category: '门派',
          actionKind: 'sect',
          actionMode: 'outer_visit',
          target: sect.id,
          targetName: sect.name,
          targetType: 'sect',
          group: 'sect_outer',
          direction: 'martial'
        }, visitAccess),
        applyChoiceAccess({
          id: `action:sect:${sect.id}:outer_study`,
          text: `借观${sect.name}演武`,
          actionText: `action:sect:${sect.id}:outer_study`,
          hint: `不急着投门，先借着观礼、旁听和演武试着摸一层${sect.name}的路数。`,
          category: '门派',
          actionKind: 'sect',
          actionMode: 'outer_study',
          target: sect.id,
          targetName: sect.name,
          targetType: 'sect',
          group: 'sect_outer',
          direction: 'martial'
        }, studyAccess)
      ];
    });
}

function buildStructuredFixedChoicesRich(state, battlefieldAccess, jianghuAccess) {
  ensureRetinueState(state);
  const choices = [];
  createConfiguredFixedActions(state).forEach((item) => appendUniqueChoice(choices, item));
  appendUniqueChoice(choices, buildFoodSupplyChoice(state));
  buildFoodActionChoices(state).forEach((item) => appendUniqueChoice(choices, item));
  buildPersonalActionChoicesV3(state, battlefieldAccess, jianghuAccess).forEach((item) => appendUniqueChoice(choices, item));
  buildSectOuterChoices(state).forEach((item) => appendUniqueChoice(choices, item));
  buildTravelActionChoices(state).forEach((item) => appendUniqueChoice(choices, item));
  buildTerritorySiegeChoices(state).forEach((item) => appendUniqueChoice(choices, item));

  const retinueChoices = buildRetinueChoiceGroups(state);
  [].concat(
    retinueChoices.recruitChoices || [],
    retinueChoices.appointmentChoices || [],
    retinueChoices.interactionChoices || [],
    retinueChoices.teamChoices || []
  ).forEach((item) => appendUniqueChoice(choices, item));

  return choices
    .map((item) => decorateFixedChoice(item))
    .slice(0, 72);
}

function relationAvailableForChoice(state, relation, scope, options = {}) {
  if (!relation || !isRelationVisible(relation)) return false;
  const tags = Array.isArray(relation.tags) ? relation.tags : [];
  const mode = options.mode || '';

  if (scope === 'romance') {
    if (relation.romanceable === false) return false;
    if (Number(relation.rivalry || 0) >= 45) return false;
    if (!historicalDeviationAccessForRelation(state, relation, 'romance').unlocked && relation.isHistorical) return false;
    const romanceStage = romanceStageOf(relation);
    const isLover = (relation.bondKey || '') === 'lover';
    if (mode === 'promise') {
      return ['近身', '暧昧', '定情'].includes(romanceStage) || isLover;
    }
    if (mode === 'bond' || mode === 'companion') {
      return ['暧昧', '定情'].includes(romanceStage) || isLover;
    }
    if (mode === 'daily') {
      return ['近身', '暧昧', '定情'].includes(romanceStage) || isLover;
    }
    if (mode === 'jealousy') {
      return romanceStage === '定情' || isLover;
    }
    return relationFavorScore(relation) >= 26
      || Number(relation.trust || 0) >= 10
      || Number(relation.affection || 0) >= 6
      || romanceStage !== '未启';
  }

  if (scope === 'martial') {
    const allowed = Number(relation.martialRating || 0) > 0
      || tags.some((tag) => ['martial', 'battle', 'warpath', 'frontier', 'military'].includes(tag));
    if (!allowed) return false;
    if (options.purpose === 'spar' && relation.isHistorical && !historicalDeviationAccessForRelation(state, relation, 'spar').unlocked) {
      return false;
    }
    return true;
  }

  if (scope === 'strategy') {
    return Number(relation.strategyRating || 0) > 0
      || tags.some((tag) => ['strategy', 'govern', 'trade', 'diplomacy', 'investigate', 'intrigue'].includes(tag));
  }

  if (scope === 'historical') {
    const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
      ? relation.historicalPresence
      : null;
    return relation.isHistorical === true
      && ['rumor', 'met'].includes(String(relation.visibilityState || '').trim().toLowerCase())
      && (!presence || presence.active === true);
  }

  if (scope === 'warpath') {
    const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
      ? relation.historicalPresence
      : null;
    return relation.isHistorical === true
      && isRelationMet(relation)
      && tags.some((tag) => ['battle', 'military', 'warpath', 'frontier'].includes(tag))
      && (!presence || presence.active === true);
  }

  return true;
}

function relationCountForChoice(state, scope, options = {}) {
  return (state.gameState.relationships || [])
    .filter((item) => relationAvailableForChoice(state, item, scope, options))
    .length;
}

function buildWarpathRelationChoice(state, choice, access, emptyReason) {
  const next = applyChoiceAccess(Object.assign({}, choice, {
    targetType: 'relation',
    relationScope: 'warpath'
  }), access || { unlocked: false, reason: '眼下还不到正式把脚压进军旅的时候。', requirements: [] });
  if (!next.disabled && relationCountForChoice(state, 'warpath') <= 0) {
    next.disabled = true;
    next.lockedReason = emptyReason || '眼下还没有能接得上的史实军旅人物。';
    next.hint = next.lockedReason;
  }
  return next;
}

function appendUniqueChoice(list, choice) {
  if (!choice || !choice.id) return;
  if (list.some((item) => item && item.id === choice.id)) return;
  list.push(choice);
}

function syncWorldMap(state) {
  ensureCityState(state);
  const city = findCity(state.world.currentCityId);
  state.world.currentCityName = city ? city.name : '未定';
  state.world.currentRegion = city ? city.region : '未定';
  state.world.locationTag = city ? city.tags[0] : '';
  state.world.map = {
    currentCityId: state.world.currentCityId,
    currentCityName: state.world.currentCityName,
    originCityId: state.world.originCityId,
    originCityName: state.world.originCityName,
    routes: buildNearbyRoutes(state.world.currentCityId),
    longRoutes: buildLongTravelPlans(state.world.currentCityId, 4),
    atlas: buildTextMapAtlas()
  };
  refreshTerritorySummary(state);
  return state;
}

function ensureMainline(world) {
  const acts = Array.isArray(world.mainline && world.mainline.acts) && world.mainline.acts.length
    ? world.mainline.acts
    : MAINLINE_ACTS.slice();
  const currentActIndex = clamp(Number(world.mainline && world.mainline.currentActIndex) || 0, 0, acts.length - 1);
  const act = acts[currentActIndex] || acts[0];
  world.mainline = {
    acts,
    currentActIndex,
    progress: clamp(Number(world.mainline && world.mainline.progress) || 0, 0, 100),
    title: act.title,
    summary: act.summary,
    crisis: act.crisis,
    focus: act.focus.slice()
  };
  world.objective = act.summary;
  return world;
}

function createSessionState(options = {}) {
  const year = 196;
  const month = 2;
  const player = createPlayerProfile(options);
  const baseState = {
    sessionId: '',
    saveTime: new Date().toISOString(),
    settings: {
      apiBaseUrl: '',
      apiKey: '',
      model: 'local-fallback'
    },
    world: {
      gameTitle: GAME_TITLE,
      phase: 'choose_background',
      year,
      month,
      dateLabel: createDateLabel(year, month),
      currentCityId: '',
      currentCityName: '未定',
      currentRegion: '未定',
      originCityId: '',
      originCityName: '',
      locationTag: '',
      weather: '薄阴',
      turn: 0,
      maxTurns: 144,
      endYear: 220,
      pressure: 8,
      objective: MAINLINE_ACTS[0].summary,
      mainline: {
        acts: MAINLINE_ACTS.slice(),
        currentActIndex: 0,
        progress: 0,
        title: MAINLINE_ACTS[0].title,
        summary: MAINLINE_ACTS[0].summary,
        crisis: MAINLINE_ACTS[0].crisis,
        focus: MAINLINE_ACTS[0].focus.slice()
      },
      map: {
        currentCityId: '',
        currentCityName: '未定',
        originCityId: '',
        originCityName: '',
        routes: [],
        longRoutes: [],
        atlas: buildTextMapAtlas()
      },
      cityStates: {},
      territory: {
        stationedCityIds: [],
        governedCityIds: [],
        controlledCityIds: [],
        currentAuthority: 'none',
        currentAuthorityLabel: '无根基',
        currentAuthorityScore: 0,
        cityCount: 0,
        governedCount: 0,
        controlledCount: 0,
        incomePerTurn: 0,
        supplyPerTurn: 0,
        troopSupportPerTurn: 0,
        maintenanceCoinsPerTurn: 0,
        maintenanceSuppliesPerTurn: 0,
        netCoinsPerTurn: 0,
        netSuppliesPerTurn: 0,
        fieldTroops: 0,
        totalGarrison: 0,
        totalLevyReserve: 0,
        supportCap: 0,
        adminCapacity: 0,
        overload: 0,
        warningCityIds: [],
        cityCards: [],
        summaryLine: '眼下还没有真正纳入名下的城池。'
      }
    },
    gameState: applyPathSnapshot({
      name: player.name,
      nameSource: player.nameSource || 'generated',
      renameCount: 0,
      renameLimit: player.nameSource === 'custom' ? 0 : 1,
      title: '布衣',
      identity: '未定',
      age: 22,
      alive: true,
      endingReason: '',
      endingTier: '',
      endingTitle: '',
      endingSummary: '',
      endingBiography: '',
      endingCommentary: '',
      endingTree: [],
      endingTags: [],
      canInherit: false,
      inheritancePreview: null,
      inheritanceSummary: '',
      backgroundId: '',
      backgroundLabel: '',
      backgroundSummary: '',
      originSummary: '',
      health: 100,
      maxHealth: 100,
      fatigue: 0,
      fatigueCombat: 0,
      fatigueTravel: 0,
      fatigueMental: 0,
      coins: 0,
      supplies: 0,
      troops: 0,
      morale: 0,
      influence: 0,
      renown: 0,
      governance: 8,
      diplomacy: 8,
      commerce: 8,
      military: 8,
      strategy: 8,
      charm: 8,
      martialLevel: 0,
      martialExp: 0,
      martialInsight: 0,
      martialLimitBroken: false,
      martialTrainingCap: 90,
      martialBreakthroughState: '未破限',
      martialBreakthroughHint: '常规修炼最高止于 90。想再往上，不只要练，还得把名势、悟性、绝境与真正的点拨凑齐。',
      martialRouteId: 'wild',
      martialRouteName: '',
      martialRouteSummary: '',
      martialFocusId: 'unbound',
      martialFocusName: '',
      martialFocusSummary: '',
      martialTitle: '',
      battlefieldPrestige: 0,
      jianghuPrestige: 0,
      strategyRouteId: 'survival',
      strategyRouteName: '',
      strategyRouteSummary: '',
      strategyLevel: 0,
      strategyExp: 0,
      sectId: '',
      sectName: '无门无派',
      gender: player.gender,
      genderLabel: player.genderLabel,
      pronoun: player.pronoun,
      sectFavor: 0,
      sectPower: 0,
      adventureLog: [],
      relationships: [],
      factions: cloneFactionList(),
      skills: [
        normalizeSkillRecord({ id: 'bare_survival', name: '乱世自保', type: '基础', level: '熟练', effect: '资源不足时仍能维持最低行动效率。' })
      ],
      historical: createHistoricalState(),
      encounters: createEncounterState(),
      items: [],
      foodBuffs: [],
      lastMeal: null,
      foodDiscovery: [],
      lastResolutionSummary: '',
      lastRuleSummary: '',
      lastDeltaLine: '',
      softState: createEmptySoftState(),
      lastCityReport: null,
      lastRetinueFeedback: null,
      lastSkillFeedback: null,
      lastNarrativeEcho: null,
      lastBattleReport: null,
      activeBattle: null,
      lastEventTag: '',
      advisory: [],
      dramaticLayer: createEmptyDramaticLayer(),
      worldPerception: createEmptyWorldPerception(),
      retinue: {
        capacity: 6,
        members: [],
        assignments: {},
        actionTracks: {},
        companionRelationId: '',
        companionSinceTurn: 0
      }
    }),
    memory: Object.assign(createMemoryState(), {
      openThreads: [
        {
          key: createId('thread'),
          title: '旧朝余烬与新起强人都在抢地盘，我得先决定自己站在哪一层地面上。',
          urgency: 2,
          domain: '主线',
          deadlineTurn: 4,
          opportunityKey: 'opening:stance',
          ownerFactionId: 'local_power',
          rivalName: '本地豪强',
          failureConsequences: [
            { type: 'pressure', value: 5, note: '再拖下去，本地格局会先被别人定下。' }
          ]
        },
        {
          key: createId('thread'),
          title: '我的名字还没被任何真正重要的人记住，这既是安全，也是贫瘠。',
          urgency: 1,
          domain: '人物',
          deadlineTurn: 5,
          opportunityKey: 'opening:network',
          rivalName: '别家门客',
          failureConsequences: [
            { type: 'renown', value: -1, note: '人情和门路若一直不接，别人就会先一步占住位置。' }
          ]
        }
      ]
    }),
    scene: {
      title: GAME_TITLE,
      text: '门外风紧，屋内灯昏。我的名字还没有被天下记住，但乱世已经走到门槛前，只等我先替自己挑一个来处。',
      summary: '先定出身，再定籍贯，故事才会真正开始。',
      imagePrompt: '',
      imageUrl: '',
      statusLine: '请选择出身',
      mode: 'fallback'
    },
    choices: createBackgroundChoices()
  };

  Object.assign(baseState.world, {
    currentCityName: '未定',
    currentRegion: '未定',
    weather: '薄阴'
  });
  Object.assign(baseState.world.map, {
    currentCityName: '未定'
  });
  Object.assign(baseState.gameState, {
    name: player.name,
    nameSource: player.nameSource || 'generated',
    renameCount: 0,
    renameLimit: player.nameSource === 'custom' ? 0 : 1,
    gender: player.gender,
    genderLabel: player.genderLabel,
    pronoun: player.pronoun,
    title: '布衣',
    identity: '未定',
    sectName: '无门无派'
  });
  baseState.gameState.skills = [
    normalizeSkillRecord({ id: 'bare_survival', name: '乱世自保', type: '基础', level: '熟练', effect: '资源不足时仍能维持最低行动效率。' })
  ];
  const starterFoods = pickRandomItems(FOOD_DEFINITIONS.filter((item) => ['common', 'uncommon'].includes(item.rarity)), 2);
  baseState.gameState.items = starterFoods
    .map((item) => cloneFoodItem(item.id, 1))
    .filter(Boolean);
  baseState.gameState.foodDiscovery = starterFoods.map((item) => item.id);
  baseState.memory.openThreads = [
    {
      key: createId('thread'),
      title: '旧朝余烬与新起强人都在抢地盘，我得先决定自己站在哪一层地面上。',
      urgency: 2,
      domain: '主线',
      deadlineTurn: 4,
      opportunityKey: 'opening:stance',
      ownerFactionId: 'local_power',
      rivalName: '本地豪强',
      failureConsequences: [
        { type: 'pressure', value: 5, note: '再拖下去，本地格局会先被别人定下。' }
      ]
    },
    {
      key: createId('thread'),
      title: `${player.name}这个名字还没被真正重要的人记住，这既是眼下的安全，也是眼下的贫瘠。`,
      urgency: 1,
      domain: '人物',
      deadlineTurn: 5,
      opportunityKey: 'opening:network',
      rivalName: '别家门客',
      failureConsequences: [
        { type: 'renown', value: -1, note: '人情和门路若一直不接，别人就会先一步占住位置。' }
      ]
    }
  ];
  Object.assign(baseState.scene, {
    text: `我叫${player.name}，${player.genderLabel}，二十二岁。门外风紧，屋内灯昏，天下还没有真正记住我的名字，但乱世已经走到门槛前，只等我先替自己挑一条来路。`,
    summary: `主角档案已经落定：${player.name}，${player.genderLabel}。先定出身，再定籍贯，这卷故事才会真正开始。`,
    statusLine: `我是${player.name}，${player.genderLabel}。请先选择出身`
  });

  ensureMainline(baseState.world);
  ensureCityState(baseState);
  refreshTerritorySummary(baseState);
  return baseState;
}

function applyBackgroundSelection(state, backgroundId) {
  const background = BACKGROUNDS.find((item) => item.id === backgroundId);
  if (!background) return false;

  const gameState = state.gameState;
  gameState.backgroundId = background.id;
  gameState.backgroundLabel = background.label;
  gameState.identity = background.identity;
  gameState.title = background.identity;
  gameState.backgroundSummary = background.description;
  gameState.relationships = [];

  Object.keys(background.statDelta || {}).forEach((key) => {
    gameState[key] = (gameState[key] || 0) + background.statDelta[key];
  });

  if (background.martialRouteId) gameState.martialRouteId = background.martialRouteId;
  if (background.strategyRouteId) gameState.strategyRouteId = background.strategyRouteId;

  if (background.skill && !gameState.skills.find((item) => item.id === background.skill.id)) {
    gameState.skills = normalizeSkillList(gameState.skills.concat([normalizeSkillRecord(background.skill)]));
  }

  applyPathSnapshot(gameState);
  state.world.phase = 'choose_origin';
  state.scene.title = '籍贯未定';
  state.scene.text = `我先把自己的来路定成了“${background.label}”。这层出身替我压上一道旧影子，也逼着我尽快选一座真正能落脚、能起局的城。`;
  state.scene.summary = `${gameState.name}如今的身份是${background.identity}。接下来请选择籍贯，它会决定我的开局城池、周边路线、当地势力与门派氛围，也会正式固定我能先接触到哪些本地人物与史实人物。`;
  state.scene.statusLine = `${gameState.name}已定出身，请选择籍贯`;
  state.choices = createOriginChoices();
  return true;
}

function applyOriginSelection(state, cityId) {
  const city = findCity(cityId);
  if (!city) return false;
  const backgroundId = state.gameState.backgroundId || '';

  state.world.phase = 'playing';
  state.world.currentCityId = city.id;
  state.world.originCityId = city.id;
  state.world.originCityName = city.name;
  state.world.currentCityName = city.name;
  state.world.currentRegion = city.region;
  state.gameState.originSummary = city.description;
  state.gameState.skills = normalizeSkillList(state.gameState.skills);
  state.gameState.relationships = buildRelationRoster({
    backgroundId,
    cityId: city.id,
    year: state.world.year
  });
  state.world.weather = city.region === '江东' || city.region === '荆州' ? '潮湿微暖' : '风寒带尘';
  state.scene.title = `${city.name}开局`;
  state.scene.text = `我把第一根钉子钉在了${city.name}。${city.description}从这一刻起，钱粮、人脉、武艺与战事都会围着这座城慢慢生长。`;
  state.scene.summary = `籍贯已定：${city.name}。${state.gameState.name}现在可以开始经营、交游、习武、练兵、投身军旅，或者闯入江湖；初始人脉和史实人物接触面也已按出身、籍贯与当年时局固定。`;
  state.scene.statusLine = `${state.world.dateLabel} · ${city.name} · ${state.gameState.name}入局`;
  adoptOriginCity(state, city.id);
  syncWorldMap(state);
  state.choices = createActionChoicesRefinedV2(state);
  return true;
}

function buildPersonalActionChoicesV3(state, battlefieldAccess, jianghuAccess) {
  const gs = state && state.gameState ? state.gameState : {};
  const cityId = state && state.world ? state.world.currentCityId : '';
  const warpathAccess = battleAccessInfo(state, 'warpath');
  const localSectChoices = !gs.sectId ? createLocalSectChoices(state).slice(0, 1) : [];
  const sectChoice = gs.sectId
    ? {
      id: 'action:sect',
      text: `打理${gs.sectName || '门中'}事务`,
      actionText: 'action:sect',
      hint: '回门中经营人情、资源和旧规矩，让门派线继续变成稳定靠山。',
      category: '个人动作',
      actionKind: 'sect',
      source: 'fixed'
    }
    : (localSectChoices[0]
      ? {
        id: localSectChoices[0].id,
        text: localSectChoices[0].text,
        actionText: localSectChoices[0].id,
        hint: localSectChoices[0].hint || '先把山门口风摸熟，再谈正式入门。',
        category: '个人动作',
        actionKind: 'joinsect',
        source: 'fixed'
      }
      : null);

  const items = [
    sectChoice,
    buildWarpathRelationChoice(state, {
      id: 'action:warpath:outpost',
      text: '探前哨与粮道',
      actionText: 'action:warpath:outpost',
      hint: '顺着一位已结识的史实军旅人物，先摸清前哨、粮道、斥候线和军情火候，再决定接下来往军中哪一层压。',
      category: '个人动作',
      actionKind: 'warpath',
      actionMode: 'outpost',
      source: 'fixed'
    }, warpathAccess || { unlocked: false, reason: '眼下还不到正式探军情火候的时候。', requirements: [] }, '眼下还没有能让我顺着军情往下压的史实军旅人物。先把交集做出来，再去探前哨与粮道。'),
    applyChoiceAccess({
      id: 'action:military:recruit',
      text: '募兵蓄卒',
      actionText: 'action:military:recruit',
      hint: '先把可用的新血、人心和军中名头攥进自己手里。',
      category: '个人动作',
      actionKind: 'military',
      source: 'fixed'
    }, warpathAccess || { unlocked: false, reason: '眼下还拉不起真正像样的人手。', requirements: [] }),
    applyChoiceAccess({
      id: 'action:military:drill',
      text: '夜校操练',
      actionText: 'action:military:drill',
      hint: '先练队列、脚步和号令，把人手从散勇练成可用部曲。',
      category: '个人动作',
      actionKind: 'military',
      source: 'fixed'
    }, warpathAccess || { unlocked: false, reason: '眼下还不到能稳稳压住营中操练的时候。', requirements: [] }),
    applyChoiceAccess({
      id: 'action:military:discipline',
      text: '整肃军纪',
      actionText: 'action:military:discipline',
      hint: '先把营里最散、最滑、最容易坏事的地方抓出来按住。',
      category: '个人动作',
      actionKind: 'military',
      source: 'fixed'
    }, warpathAccess || { unlocked: false, reason: '眼下军中还没有值得我去压军纪的盘子。', requirements: [] }),
    applyChoiceAccess({
      id: 'action:military:camp',
      text: '修整营垒',
      actionText: 'action:military:camp',
      hint: '不急着立刻开仗，先把营寨、哨位、退路和补给线收稳。',
      category: '个人动作',
      actionKind: 'military',
      source: 'fixed'
    }, warpathAccess || { unlocked: false, reason: '眼下还没有真正需要我收稳的军中盘面。', requirements: [] }),
    {
      id: 'action:jianghu',
      text: '压向江湖线',
      actionText: 'action:jianghu',
      hint: jianghuAccess && jianghuAccess.unlocked
        ? '先把脚步压进江湖风声、递帖与奇遇里，后面才会慢慢逼出真正的对手。'
        : ((jianghuAccess && jianghuAccess.reason) || '眼下还不到正式问剑的时候。'),
      category: '个人动作',
      actionKind: 'jianghu',
      disabled: !(jianghuAccess && jianghuAccess.unlocked),
      source: 'fixed'
    }
  ];

  return items.filter(Boolean).filter((item) => {
    if (item.actionKind === 'joinsect') return !!cityId;
    return true;
  });
}

function createActionChoicesRefinedV2(state) {
  const activeBattle = state && state.gameState ? state.gameState.activeBattle : null;
  if (activeBattle && activeBattle.active) {
    if (activeBattle.mode === 'battlefield') {
      return [
        { id: 'battlecmd:spearhead', text: '正面突击', hint: '压强攻势，适合抢先手，但若被守稳会吃反震。', category: '阵型', actionKind: 'battle' },
        { id: 'battlecmd:fortify', text: '稳住阵线', hint: '先稳住阵脚，削弱敌方正面冲锋，适合先顶一波。', category: '阵型', actionKind: 'battle' },
        { id: 'battlecmd:harry', text: '游击骚扰', hint: '绕侧牵制，克制死守，但对正面硬冲较吃亏。', category: '阵型', actionKind: 'battle' },
        { id: 'battlecmd:fire', text: '放火扰阵', hint: '看谋略与时机，打中后能直接撕开阵势。', category: '计策', actionKind: 'battle' },
        { id: 'battlecmd:rally', text: '号令整队', hint: '回稳士气与军心，适合被压制时缓一口气。', category: '军令', actionKind: 'battle' },
        { id: 'battlecmd:champion', text: '亲自斩将', hint: '以个人武勇强行破局，风险高，但上限也最高。', category: '主将', actionKind: 'battle' }
      ];
    }

    return [
      { id: 'battlecmd:strike', text: '强攻', hint: '主动压近，逼对手先交破绽。', category: '攻势', actionKind: 'jianghu' },
      { id: 'battlecmd:guard', text: '守势', hint: '先守中线，降低对手这一手的伤害。', category: '守势', actionKind: 'jianghu' },
      { id: 'battlecmd:channel', text: '运气', hint: '回一口真气，为下一手绝招做准备。', category: '运功', actionKind: 'jianghu' },
      { id: 'battlecmd:footwork', text: '走位', hint: '拉开步点，适合拆解对手重手与绝招。', category: '身法', actionKind: 'jianghu' },
      { id: 'battlecmd:finisher', text: '收招定胜', hint: '消耗真气一锤定音，若被看穿也会露空门。', category: '绝招', actionKind: 'jianghu' }
    ];
  }

  const battlefieldAccess = battleAccessInfo(state, 'battlefield');
  const jianghuAccess = battleAccessInfo(state, 'duel');
  return buildStructuredFixedChoicesRich(state, battlefieldAccess, jianghuAccess);
}

module.exports = {
  GAME_TITLE,
  BACKGROUNDS,
  SECTS,
  CITIES,
  FACTIONS,
  MAINLINE_ACTS,
  MARTIAL_PATHS,
  STRATEGY_PATHS,
  clamp,
  createId,
  normalizePlayerName,
  validatePlayerName,
  createPlayerProfile,
  createDateLabel,
  createBackgroundChoices,
  createOriginChoices,
  createSessionState,
  applyBackgroundSelection,
  applyOriginSelection,
  createActionChoices: createActionChoicesRefinedV2,
  buildRelationRoster,
  ensureMainline,
  findCity,
  findSect,
  findCitySects,
  buildTravelPlan,
  buildLongTravelPlans,
  evaluateSectEligibility,
  battleAccessInfo,
  syncWorldMap,
  martialRealmOf,
  applyMartialSnapshot,
  applyPathSnapshot,
  refreshContentSnapshot,
  getMartialPath,
  getStrategyPath,
  stanceForFaction
};







