const { CITIES_CONTENT } = require('./chronicleV5ContentConfig');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

const AUTHORITY_ORDER = {
  none: 0,
  reside: 1,
  guest: 2,
  steward: 3,
  control: 4
};

const AUTHORITY_META = {
  none: { label: '无根基', summary: '只是路过此地，还谈不上在城里真正站稳。' },
  reside: { label: '借居', summary: '人已经在城里落脚，但还没有真正能调用的城中权柄。' },
  guest: { label: '有门路', summary: '城里已经有人认得我，能借到一些门路与面子。' },
  steward: { label: '代治', summary: '我已经拿到这座城的一部分实际运转权，可以借城中根基做更大的局。' },
  control: { label: '掌控', summary: '这座城已经真正纳入我的体系，收益、任命与史实人物都会围着它转。' }
};

function authorityRank(value) {
  return AUTHORITY_ORDER[String(value || '').trim()] || 0;
}

function authorityLabel(value) {
  return (AUTHORITY_META[String(value || '').trim()] || AUTHORITY_META.none).label;
}

function authoritySummary(value) {
  return (AUTHORITY_META[String(value || '').trim()] || AUTHORITY_META.none).summary;
}

function hasAuthorityAtLeast(cityState, level) {
  return authorityRank(cityState && cityState.playerAuthority) >= authorityRank(level);
}

function strategicLevelOf(city) {
  const tags = ensureList(city && city.tags);
  let score = 1;
  if (tags.some((tag) => /旧都|中枢|朝局/.test(String(tag)))) score += 3;
  if (tags.some((tag) => /军镇|边军|关隘|锁钥|要冲/.test(String(tag)))) score += 2;
  if (tags.some((tag) => /商路|盐铁|市井|漕运|交通/.test(String(tag)))) score += 1;
  return clamp(score, 1, 5);
}

function baseCityStats(city) {
  const tags = ensureList(city && city.tags).join('|');
  const level = strategicLevelOf(city);
  const militaryBoost = /军镇|关隘|边军|骑军|水军|锁钥/.test(tags) ? 18 : 0;
  const tradeBoost = /商路|盐铁|市井|漕运|交通|港口/.test(tags) ? 12 : 0;
  const grainBoost = /粮道|粮土|屯田|漕运|江淮|沃野/.test(tags) ? 10 : 0;
  const orderBoost = /旧都|门阀|宗室|州府|都县/.test(tags) ? 10 : 0;
  const capitalBoost = /旧都|中枢|朝局/.test(tags) ? 260 : 0;
  return {
    strategicLevel: level,
    order: 52 + orderBoost,
    prosperity: 48 + tradeBoost,
    security: 50 + militaryBoost,
    fortification: 44 + militaryBoost,
    supplyStock: 42 + grainBoost,
    garrison: 280 + (level * 140) + militaryBoost * 12 + capitalBoost,
    agriculture: 44 + grainBoost,
    commercialFlow: 42 + tradeBoost,
    population: 58 + (level * 7),
    levyReserve: 80 + (level * 26) + Math.round((grainBoost + tradeBoost + orderBoost) * 1.4),
    conscriptionPressure: 8,
    warWeariness: 8,
    refugeePressure: 6,
    taxPressure: 10,
    unrest: 8
  };
}

function createCityRuntimeState(city) {
  const base = baseCityStats(city);
  return {
    cityId: city.id,
    cityName: city.name,
    region: city.region,
    ownerFactionId: city.localFactionId || '',
    controllerFactionId: city.localFactionId || '',
    localFactionId: city.localFactionId || '',
    strategicLevel: base.strategicLevel,
    tags: ensureList(city.tags).slice(),
    playerAuthority: 'none',
    playerAuthorityLabel: authorityLabel('none'),
    playerAuthorityScore: 0,
    annexationMode: 'none',
    order: base.order,
    prosperity: base.prosperity,
    security: base.security,
    fortification: base.fortification,
    supplyStock: base.supplyStock,
    garrison: base.garrison,
    agriculture: base.agriculture,
    commercialFlow: base.commercialFlow,
    population: base.population,
    levyReserve: base.levyReserve,
    conscriptionPressure: base.conscriptionPressure,
    warWeariness: base.warWeariness,
    refugeePressure: base.refugeePressure,
    taxPressure: base.taxPressure,
    unrest: base.unrest,
    lastYieldCoins: 0,
    lastYieldSupplies: 0,
    lastYieldTroops: 0,
    notableHistoricalIds: []
  };
}

function buildCityStateIndex() {
  return CITIES_CONTENT.reduce((result, city) => {
    if (!city || !city.id) return result;
    result[city.id] = createCityRuntimeState(city);
    return result;
  }, {});
}

function createEmptyTerritorySummary() {
  return {
    stationedCityIds: [],
    governedCityIds: [],
    controlledCityIds: [],
    currentAuthority: 'none',
    currentAuthorityLabel: authorityLabel('none'),
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
  };
}

function ensureCityState(state) {
  if (!state || !state.world) return buildCityStateIndex();
  const raw = state.world.cityStates && typeof state.world.cityStates === 'object'
    ? state.world.cityStates
    : {};
  const next = buildCityStateIndex();
  Object.keys(raw).forEach((cityId) => {
    if (!next[cityId]) return;
    next[cityId] = Object.assign({}, next[cityId], raw[cityId] || {});
  });
  Object.keys(next).forEach((cityId) => {
    const cityState = next[cityId];
    cityState.playerAuthorityLabel = authorityLabel(cityState.playerAuthority);
    cityState.playerAuthorityScore = clamp(cityState.playerAuthorityScore, 0, 100);
    cityState.order = clamp(cityState.order, 0, 100);
    cityState.prosperity = clamp(cityState.prosperity, 0, 100);
    cityState.security = clamp(cityState.security, 0, 100);
    cityState.fortification = clamp(cityState.fortification, 0, 100);
    cityState.supplyStock = clamp(cityState.supplyStock, 0, 100);
    cityState.agriculture = clamp(cityState.agriculture, 0, 100);
    cityState.commercialFlow = clamp(cityState.commercialFlow, 0, 100);
    cityState.population = clamp(cityState.population, 0, 100);
    cityState.conscriptionPressure = clamp(cityState.conscriptionPressure, 0, 100);
    cityState.warWeariness = clamp(cityState.warWeariness, 0, 100);
    cityState.refugeePressure = clamp(cityState.refugeePressure, 0, 100);
    cityState.taxPressure = clamp(cityState.taxPressure, 0, 100);
    cityState.unrest = clamp(cityState.unrest, 0, 100);
    cityState.garrison = Math.max(0, Math.round(Number(cityState.garrison || 0)));
    cityState.levyReserve = Math.max(0, Math.round(Number(cityState.levyReserve || 0)));
    cityState.lastYieldCoins = Math.max(0, Math.round(Number(cityState.lastYieldCoins || 0)));
    cityState.lastYieldSupplies = Math.max(0, Math.round(Number(cityState.lastYieldSupplies || 0)));
    cityState.lastYieldTroops = Math.max(0, Math.round(Number(cityState.lastYieldTroops || 0)));
    cityState.notableHistoricalIds = ensureList(cityState.notableHistoricalIds).map((item) => String(item || '').trim()).filter(Boolean);
  });
  state.world.cityStates = next;
  if (!state.world.territory || typeof state.world.territory !== 'object') {
    state.world.territory = createEmptyTerritorySummary();
  }
  return next;
}

function currentCityState(state) {
  const cityStates = ensureCityState(state);
  const cityId = state && state.world ? state.world.currentCityId : '';
  return cityId && cityStates[cityId] ? cityStates[cityId] : null;
}

function adoptOriginCity(state, cityId) {
  const cityStates = ensureCityState(state);
  const cityState = cityStates[cityId];
  if (!cityState) return null;
  if (authorityRank(cityState.playerAuthority) < authorityRank('reside')) {
    cityState.playerAuthority = 'reside';
    cityState.playerAuthorityLabel = authorityLabel('reside');
  }
  cityState.playerAuthorityScore = Math.max(Number(cityState.playerAuthorityScore || 0), 18);
  return cityState;
}

function deriveAuthorityLevel(score, state, cityState) {
  const gs = state && state.gameState ? state.gameState : {};
  const localFaction = ensureList(gs.factions).find((item) => item && item.id === cityState.localFactionId);
  const localFavor = localFaction ? Number(localFaction.favor || 0) : 0;
  if (score >= 72 && (localFavor >= 12 || Number(gs.renown || 0) >= 22 || Number(gs.military || 0) >= 28)) return 'control';
  if (score >= 46 && (localFavor >= 4 || Number(gs.governance || 0) >= 18 || Number(gs.influence || 0) >= 10)) return 'steward';
  if (score >= 24) return 'guest';
  if (score > 0) return 'reside';
  return 'none';
}

function setAuthorityByScore(state, cityState, nextScore) {
  if (!cityState) return cityState;
  cityState.playerAuthorityScore = clamp(nextScore, 0, 100);
  cityState.playerAuthority = deriveAuthorityLevel(cityState.playerAuthorityScore, state, cityState);
  cityState.playerAuthorityLabel = authorityLabel(cityState.playerAuthority);
  return cityState;
}

function boostAuthorityScore(state, cityId, delta) {
  const cityStates = ensureCityState(state);
  const cityState = cityStates[cityId];
  if (!cityState) return null;
  return setAuthorityByScore(state, cityState, Number(cityState.playerAuthorityScore || 0) + Number(delta || 0));
}

function setCityAuthority(state, cityId, level, score = 0) {
  const cityStates = ensureCityState(state);
  const cityState = cityStates[cityId];
  if (!cityState) return null;
  const normalized = String(level || 'none').trim();
  cityState.playerAuthority = normalized;
  cityState.playerAuthorityLabel = authorityLabel(normalized);
  cityState.playerAuthorityScore = clamp(score || ({
    none: 0,
    reside: 12,
    guest: 28,
    steward: 58,
    control: 86
  }[normalized] || 0), 0, 100);
  return cityState;
}

function markCityCaptured(state, cityId, level = 'control') {
  const cityState = setCityAuthority(state, cityId, level);
  if (!cityState) return null;
  cityState.ownerFactionId = 'player_domain';
  cityState.controllerFactionId = 'player_domain';
  return cityState;
}

function syncHistoricalPresenceToCities(state) {
  const cityStates = ensureCityState(state);
  Object.keys(cityStates).forEach((cityId) => {
    cityStates[cityId].notableHistoricalIds = [];
  });
  const relations = ensureList(state && state.gameState && state.gameState.relationships);
  relations.forEach((relation) => {
    if (!relation || relation.isHistorical !== true) return;
    const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
      ? relation.historicalPresence
      : null;
    if (!presence || !presence.active) return;
    ensureList(presence.cityIds).forEach((cityId) => {
      if (!cityStates[cityId]) return;
      if (!cityStates[cityId].notableHistoricalIds.includes(relation.id)) {
        cityStates[cityId].notableHistoricalIds.push(relation.id);
      }
    });
  });
}

function cityYieldForState(cityState) {
  if (!cityState) return { coins: 0, supplies: 0, troops: 0, influence: 0 };
  const rank = authorityRank(cityState.playerAuthority);
  if (rank < authorityRank('steward')) return { coins: 0, supplies: 0, troops: 0, influence: 0 };
  const multiplier = rank >= authorityRank('control') ? 1 : 0.65;
  const stabilityFactor = clamp(
    (
      Number(cityState.order || 0) * 0.24
      + Number(cityState.prosperity || 0) * 0.22
      + Number(cityState.security || 0) * 0.14
      + Number(cityState.commercialFlow || 0) * 0.18
      + Number(cityState.agriculture || 0) * 0.16
      - Number(cityState.unrest || 0) * 0.24
      - Number(cityState.warWeariness || 0) * 0.16
      - Number(cityState.refugeePressure || 0) * 0.1
    ) / 60,
    0.35,
    1.2
  );
  const coins = Math.max(0, Math.round((((cityState.prosperity || 0) + (cityState.commercialFlow || 0)) / 34) * multiplier * stabilityFactor));
  const supplies = Math.max(0, Math.round((((cityState.agriculture || 0) + (cityState.supplyStock || 0)) / 30) * multiplier * stabilityFactor));
  const recruitFactor = clamp(
    (
      Number(cityState.population || 0) * 0.26
      + Number(cityState.order || 0) * 0.18
      + Number(cityState.security || 0) * 0.14
      + Number(cityState.agriculture || 0) * 0.18
      - Number(cityState.unrest || 0) * 0.18
      - Number(cityState.warWeariness || 0) * 0.14
      - Number(cityState.refugeePressure || 0) * 0.1
      - Number(cityState.conscriptionPressure || 0) * 0.22
    ) / 72,
    0.2,
    1.1
  );
  const troops = Math.max(0, Math.round((((cityState.population || 0) + (cityState.security || 0) + (cityState.agriculture || 0)) / 44) * multiplier * recruitFactor));
  const influence = Math.max(0, Math.round((((cityState.order || 0) + (cityState.playerAuthorityScore || 0)) / 88) * multiplier));
  return { coins, supplies, troops, influence };
}

function computeTerritoryMaintenancePreview(state, monthsElapsed = 1) {
  const gs = state && state.gameState ? state.gameState : {};
  const months = Math.max(1, Math.round(Number(monthsElapsed || 1)));
  const cityStates = ensureCityState(state);
  const governedStates = Object.values(cityStates).filter((item) => authorityRank(item && item.playerAuthority) >= authorityRank('steward'));
  let cityCoinCost = 0;
  let citySupplyCost = 0;
  let supportCap = 0;
  let weightedLoad = 0;

  governedStates.forEach((cityState) => {
    const rank = authorityRank(cityState.playerAuthority);
    const strategicLevel = Math.max(1, Number(cityState.strategicLevel || 1));
    const garrison = Math.max(0, Number(cityState.garrison || 0));
    cityCoinCost += (
      strategicLevel * (rank >= authorityRank('control') ? 2.6 : 1.7)
      + Math.round(garrison / 760)
      + Math.round((Number(cityState.fortification || 0) + Number(cityState.security || 0)) / 90)
    ) * months;
    citySupplyCost += (
      strategicLevel * (rank >= authorityRank('control') ? 3.2 : 2.1)
      + Math.round(garrison / 360)
    ) * months;
    supportCap += strategicLevel * (rank >= authorityRank('control') ? 150 : 96)
      + Math.round(garrison / 14)
      + Math.round((Number(cityState.order || 0) + Number(cityState.security || 0)) / 4);
    weightedLoad += rank >= authorityRank('control') ? 1.4 : 1;
  });

  const currentTroops = Math.max(0, Number(gs.troops || 0));
  const overCap = Math.max(0, currentTroops - supportCap);
  const armyCoinCost = (
    Math.ceil(currentTroops / 180)
    + Math.ceil(overCap / 90)
  ) * months;
  const armySupplyCost = (
    Math.ceil(currentTroops / 95)
    + Math.ceil(overCap / 55)
  ) * months;
  const adminCapacity = Math.max(
    1,
    Math.floor(
      (
        Number(gs.governance || 0) * 1.15
        + Number(gs.strategy || 0) * 0.85
        + Number(gs.influence || 0) * 0.55
      ) / 28
    )
  );
  const overload = Math.max(0, Math.ceil(weightedLoad - adminCapacity));
  const overloadCoinCost = overload * 3 * months;
  const overloadSupplyCost = overload * 2 * months;

  return {
    months,
    governedStates,
    cityCoinCost: Math.round(cityCoinCost),
    citySupplyCost: Math.round(citySupplyCost),
    armyCoinCost: Math.round(armyCoinCost),
    armySupplyCost: Math.round(armySupplyCost),
    overloadCoinCost: Math.round(overloadCoinCost),
    overloadSupplyCost: Math.round(overloadSupplyCost),
    totalCoinCost: Math.round(cityCoinCost + armyCoinCost + overloadCoinCost),
    totalSupplyCost: Math.round(citySupplyCost + armySupplyCost + overloadSupplyCost),
    supportCap: Math.max(0, Math.round(supportCap)),
    adminCapacity,
    overload,
    weightedLoad,
    overCap
  };
}

function applyTerritoryDriftAndShortage(state, maintenance) {
  const gs = state && state.gameState ? state.gameState : {};
  const sortedStates = ensureList(maintenance && maintenance.governedStates)
    .slice()
    .sort((a, b) => Number(a.playerAuthorityScore || 0) - Number(b.playerAuthorityScore || 0));
  const coinShortage = Math.max(0, Number(maintenance && maintenance.coinShortage || 0));
  const supplyShortage = Math.max(0, Number(maintenance && maintenance.supplyShortage || 0));
  const overload = Math.max(0, Number(maintenance && maintenance.overload || 0));
  const shortageStress = Math.ceil(coinShortage / 6) + Math.ceil(supplyShortage / 5);

  sortedStates.forEach((cityState, index) => {
    const structuralStrain = overload > 0 ? Math.max(0, overload - Math.floor(index / 2)) : 0;
    const localStrain = shortageStress + structuralStrain;
    const orderDrift = (Number(cityState.prosperity || 0) >= 62 ? 1 : 0)
      - (Number(cityState.warWeariness || 0) >= 28 ? 1 : 0)
      - (Number(cityState.taxPressure || 0) >= 22 ? 1 : 0)
      - (Number(cityState.refugeePressure || 0) >= 18 ? 1 : 0)
      - (Number(cityState.conscriptionPressure || 0) >= 28 ? 1 : 0);
    const prosperityDrift = (Number(cityState.commercialFlow || 0) >= 58 && Number(cityState.order || 0) >= 55 ? 1 : 0)
      - (Number(cityState.unrest || 0) >= 32 ? 1 : 0)
      - (Number(cityState.warWeariness || 0) >= 36 ? 1 : 0);
    cityState.order = clamp(Number(cityState.order || 0) + orderDrift - localStrain, 0, 100);
    cityState.prosperity = clamp(Number(cityState.prosperity || 0) + prosperityDrift - Math.ceil(localStrain / 2), 0, 100);
    cityState.security = clamp(Number(cityState.security || 0) - Math.ceil(localStrain / 2), 0, 100);
    cityState.unrest = clamp(Number(cityState.unrest || 0) + Math.max(0, localStrain - 1) - (Number(cityState.order || 0) >= 64 ? 1 : 0), 0, 100);
    cityState.warWeariness = clamp(Number(cityState.warWeariness || 0) + (localStrain > 0 ? 1 : -1), 0, 100);
    cityState.taxPressure = clamp(Number(cityState.taxPressure || 0) + (overload > 0 ? 1 : 0) - (Number(cityState.order || 0) >= 58 ? 1 : 0), 0, 100);
    cityState.conscriptionPressure = clamp(Number(cityState.conscriptionPressure || 0) + (localStrain > 0 ? 1 : -1), 0, 100);
    if (localStrain > 0) {
      const garrisonDrift = Math.min(
        Math.max(0, Math.round(Number(cityState.garrison || 0))),
        Math.max(0, Math.ceil(localStrain * 10 + supplyShortage / 3) - Math.floor(Number(cityState.security || 0) / 18))
      );
      const levyDrift = Math.min(
        Math.max(0, Math.round(Number(cityState.levyReserve || 0))),
        Math.max(0, Math.ceil(localStrain * 5 + coinShortage / 4))
      );
      cityState.garrison = Math.max(0, Math.round(Number(cityState.garrison || 0) - garrisonDrift));
      cityState.levyReserve = Math.max(0, Math.round(Number(cityState.levyReserve || 0) - levyDrift));
    }
    if (localStrain > 0) {
      cityState.playerAuthorityScore = clamp(Number(cityState.playerAuthorityScore || 0) - Math.max(1, localStrain), 0, 100);
      if (authorityRank(cityState.playerAuthority) >= authorityRank('control') && Number(cityState.playerAuthorityScore || 0) < 58) {
        cityState.playerAuthority = 'steward';
      } else if (authorityRank(cityState.playerAuthority) >= authorityRank('steward') && Number(cityState.playerAuthorityScore || 0) < 24) {
        cityState.playerAuthority = 'guest';
      }
      cityState.playerAuthorityLabel = authorityLabel(cityState.playerAuthority);
    }
  });

  const moralePenalty = overload * 2 + Math.ceil(coinShortage / 4) + Math.ceil(supplyShortage / 3) + (Number(maintenance && maintenance.overCap || 0) > 0 ? Math.ceil(Number(maintenance.overCap || 0) / 80) : 0);
  const troopPenalty = Math.ceil(supplyShortage * 1.2) + Math.ceil(coinShortage * 0.6) + overload * 3;
  if (moralePenalty > 0) gs.morale = clamp(Number(gs.morale || 0) - moralePenalty, 0, 100);
  if (troopPenalty > 0) gs.troops = Math.max(0, Number(gs.troops || 0) - troopPenalty);
  if (overload > 0) gs.influence = clamp(Number(gs.influence || 0) - Math.ceil(overload / 2), 0, 100);
  if (Number(maintenance && maintenance.overCap || 0) > 0) gs.fatigue = clamp(Number(gs.fatigue || 0) + Math.min(4, Math.ceil(Number(maintenance.overCap || 0) / 140)), 0, 100);

  return {
    moralePenalty,
    troopPenalty
  };
}

function settleCityTurn(state, monthsElapsed = 1) {
  const gs = state && state.gameState ? state.gameState : null;
  if (!gs) return null;
  const cityStates = ensureCityState(state);
  const months = Math.max(1, Math.round(Number(monthsElapsed || 1)));
  const maintenance = computeTerritoryMaintenancePreview(state, months);
  let totalCoins = 0;
  let totalSupplies = 0;
  let totalTroops = 0;
  let totalInfluence = 0;
  Object.keys(cityStates).forEach((cityId) => {
    const cityState = cityStates[cityId];
    const baseYield = cityYieldForState(cityState);
    const yieldData = {
      coins: Math.round(Number(baseYield.coins || 0) * months),
      supplies: Math.round(Number(baseYield.supplies || 0) * months),
      troops: Math.round(Number(baseYield.troops || 0) * months),
      influence: Math.round(Number(baseYield.influence || 0) * months)
    };
    cityState.lastYieldCoins = yieldData.coins;
    cityState.lastYieldSupplies = yieldData.supplies;
    cityState.lastYieldTroops = yieldData.troops;
    cityState.levyReserve = Math.max(0, Math.round(Number(cityState.levyReserve || 0) + yieldData.troops));
    cityState.conscriptionPressure = clamp(Number(cityState.conscriptionPressure || 0) - Math.max(1, Math.floor(months / 2)), 0, 100);
    totalCoins += yieldData.coins;
    totalSupplies += yieldData.supplies;
    totalTroops += yieldData.troops;
    totalInfluence += yieldData.influence;
  });
  const projectedCoins = Number(gs.coins || 0) + totalCoins - Number(maintenance.totalCoinCost || 0);
  const projectedSupplies = Number(gs.supplies || 0) + totalSupplies - Number(maintenance.totalSupplyCost || 0);
  maintenance.coinShortage = Math.max(0, -projectedCoins);
  maintenance.supplyShortage = Math.max(0, -projectedSupplies);
  gs.coins = Math.max(0, projectedCoins);
  gs.supplies = Math.max(0, projectedSupplies);
  gs.influence = Number(gs.influence || 0) + totalInfluence;
  maintenance.overCap = Math.max(0, Number(gs.troops || 0) - Number(maintenance.supportCap || 0));
  const penalties = applyTerritoryDriftAndShortage(state, maintenance);
  return {
    coins: totalCoins - Number(maintenance.totalCoinCost || 0),
    supplies: totalSupplies - Number(maintenance.totalSupplyCost || 0),
    troops: totalTroops,
    influence: totalInfluence,
    gross: {
      coins: totalCoins,
      supplies: totalSupplies,
      troops: totalTroops,
      influence: totalInfluence
    },
    upkeep: {
      coins: Number(maintenance.totalCoinCost || 0),
      supplies: Number(maintenance.totalSupplyCost || 0)
    },
    shortages: {
      coins: Number(maintenance.coinShortage || 0),
      supplies: Number(maintenance.supplyShortage || 0)
    },
    supportCap: Number(maintenance.supportCap || 0),
    adminCapacity: Number(maintenance.adminCapacity || 0),
    overload: Number(maintenance.overload || 0),
    penalties
  };
}

function applyCurrentCityAction(state, action, outcome) {
  const cityState = currentCityState(state);
  if (!cityState || !action) return null;
  const gs = state && state.gameState ? state.gameState : {};
  const tier = String(outcome && outcome.tier || 'mixed');
  const tierFactor = {
    great: 1.2,
    good: 1,
    mixed: 0.65,
    fail: 0.3
  }[tier] || 0.65;
  const score = {
    govern: 10,
    trade: 7,
    diplomacy: 4,
    social: 3,
    investigate: 2,
    intrigue: 2,
    military: 5,
    battle: -6,
    warpath: -2,
    martial: 1,
    joinsect: 1,
    sect: 1,
    rest: 1
  }[String(action.kind || '').trim()] || 0;
  const mode = String(action.mode || '').trim();
  const authorityBonus = mode === 'stewardship'
    ? 18
    : mode === 'stabilize'
      ? 8
    : mode === 'patrol'
      ? 8
      : mode === 'granary'
        ? 7
        : mode === 'notables'
          ? 6
        : mode === 'warehouse'
          ? 5
          : mode === 'market_town'
            ? 5
          : mode === 'banquet'
            ? 3
            : mode === 'garrison'
              ? 4
            : 0;
  const authorityDelta = Math.round((score + authorityBonus) * tierFactor);
  if (authorityDelta) {
    setAuthorityByScore(state, cityState, Number(cityState.playerAuthorityScore || 0) + authorityDelta);
  }

  const applyDelta = (key, value) => {
    cityState[key] = clamp(Number(cityState[key] || 0) + Number(value || 0), 0, 100);
  };

  if (action.kind === 'govern') {
    applyDelta('order', 6 * tierFactor);
    applyDelta('security', 5 * tierFactor);
    applyDelta('prosperity', 3 * tierFactor);
    applyDelta('unrest', -5 * tierFactor);
    if (mode === 'granary') {
      applyDelta('supplyStock', 8 * tierFactor);
      applyDelta('agriculture', 4 * tierFactor);
    }
    if (mode === 'stewardship') {
      applyDelta('order', 4 * tierFactor);
      applyDelta('fortification', 3 * tierFactor);
    }
    if (mode === 'stabilize') {
      applyDelta('order', 8 * tierFactor);
      applyDelta('security', 6 * tierFactor);
      applyDelta('unrest', -8 * tierFactor);
      applyDelta('warWeariness', -3 * tierFactor);
    }
  }

  if (action.kind === 'trade') {
    applyDelta('prosperity', 6 * tierFactor);
    applyDelta('commercialFlow', 7 * tierFactor);
    applyDelta('taxPressure', 2 * tierFactor);
    if (mode === 'arms') applyDelta('security', 3 * tierFactor);
    if (mode === 'market_town') {
      applyDelta('prosperity', 4 * tierFactor);
      applyDelta('commercialFlow', 5 * tierFactor);
      applyDelta('order', 2 * tierFactor);
    }
  }

  if (action.kind === 'diplomacy' || action.kind === 'social') {
    applyDelta('order', 2 * tierFactor);
    applyDelta('prosperity', 2 * tierFactor);
    if (mode === 'notables') {
      applyDelta('order', 4 * tierFactor);
      applyDelta('prosperity', 3 * tierFactor);
      applyDelta('taxPressure', -2 * tierFactor);
      applyDelta('unrest', -3 * tierFactor);
    }
  }

  if (action.kind === 'intrigue') {
    applyDelta('security', 1 * tierFactor);
    applyDelta('unrest', tier === 'fail' ? 3 : -1);
  }

  if (action.kind === 'military' || action.kind === 'battle' || action.kind === 'warpath') {
    applyDelta('security', 3 * tierFactor);
    applyDelta('fortification', 2 * tierFactor);
    applyDelta('warWeariness', action.kind === 'battle' ? 6 : 2);
    if (action.kind === 'military') {
      cityState.conscriptionPressure = clamp(Number(cityState.conscriptionPressure || 0) + (mode === 'recruit' ? 4 : mode === 'garrison' ? 2 : 1), 0, 100);
    }
    if (mode === 'garrison') {
      applyDelta('security', 5 * tierFactor);
      applyDelta('fortification', 6 * tierFactor);
      const levyToGarrison = Math.min(
        Math.max(0, Math.round(Number(cityState.levyReserve || 0))),
        tier === 'great' ? 18 : tier === 'good' ? 12 : tier === 'mixed' ? 8 : 3
      );
      const fieldTransfer = Math.min(
        Math.max(0, Math.round(Number(gs.troops || 0) - 120)),
        tier === 'great' ? 14 : tier === 'good' ? 10 : tier === 'mixed' ? 6 : 0
      );
      cityState.levyReserve = Math.max(0, Math.round(Number(cityState.levyReserve || 0) - levyToGarrison));
      cityState.garrison = Math.max(0, Math.round(Number(cityState.garrison || 0) + (30 * tierFactor) + levyToGarrison + fieldTransfer));
      gs.troops = Math.max(0, Number(gs.troops || 0) - fieldTransfer);
    }
    if (mode === 'recruit') {
      const desiredPull = Math.max(0, (
        (tier === 'great' ? 34 : tier === 'good' ? 24 : tier === 'mixed' ? 14 : 5)
        + Math.max(0, Math.floor((Number(gs.military || 0) - 18) / 12))
        + Math.max(0, Math.floor((Number(gs.governance || 0) - 14) / 16))
        + Math.max(0, Math.floor(Number(cityState.order || 0) / 26))
        - Math.floor(Number(cityState.unrest || 0) / 18)
        - Math.floor(Number(cityState.conscriptionPressure || 0) / 20)
      ));
      let levySpent = Math.min(
        Math.max(0, Math.round(Number(cityState.levyReserve || 0))),
        desiredPull
      );
      while (levySpent > 0) {
        const extraCoinCost = Math.max(1, Math.ceil(levySpent / 7));
        const extraSupplyCost = Math.max(1, Math.ceil(levySpent / 6));
        if (Number(gs.coins || 0) >= extraCoinCost && Number(gs.supplies || 0) >= extraSupplyCost) break;
        levySpent -= 1;
      }
      if (levySpent > 0) {
        const qualityRate = tier === 'great' ? 0.82 : tier === 'good' ? 0.74 : tier === 'mixed' ? 0.62 : 0.38;
        const fieldTroops = Math.max(0, Math.round(levySpent * qualityRate));
        const garrisonTroops = Math.max(0, levySpent - fieldTroops);
        const extraCoinCost = Math.max(1, Math.ceil(levySpent / 7));
        const extraSupplyCost = Math.max(1, Math.ceil(levySpent / 6));
        gs.coins = Math.max(0, Number(gs.coins || 0) - extraCoinCost);
        gs.supplies = Math.max(0, Number(gs.supplies || 0) - extraSupplyCost);
        gs.troops = Math.max(0, Math.round(Number(gs.troops || 0) + fieldTroops));
        cityState.garrison = Math.max(0, Math.round(Number(cityState.garrison || 0) + garrisonTroops));
        cityState.levyReserve = Math.max(0, Math.round(Number(cityState.levyReserve || 0) - levySpent));
        cityState.conscriptionPressure = clamp(Number(cityState.conscriptionPressure || 0) + Math.ceil(levySpent / 8), 0, 100);
        cityState.order = clamp(Number(cityState.order || 0) - Math.ceil(levySpent / 14), 0, 100);
        cityState.prosperity = clamp(Number(cityState.prosperity || 0) - Math.ceil(levySpent / 20), 0, 100);
        cityState.population = clamp(Number(cityState.population || 0) - Math.ceil(levySpent / 18), 0, 100);
        cityState.unrest = clamp(Number(cityState.unrest || 0) + (tier === 'fail' ? 2 : 1), 0, 100);
      }
    }
    if (mode === 'discipline') {
      cityState.conscriptionPressure = clamp(Number(cityState.conscriptionPressure || 0) - (tier === 'great' ? 5 : tier === 'good' ? 4 : tier === 'mixed' ? 2 : 0), 0, 100);
    }
    if (mode === 'camp') {
      cityState.levyReserve = Math.max(0, Math.round(Number(cityState.levyReserve || 0) + (tier === 'great' ? 4 : tier === 'good' ? 2 : 0)));
      cityState.garrison = Math.max(0, Math.round(Number(cityState.garrison || 0) + (tier === 'great' ? 12 : tier === 'good' ? 8 : tier === 'mixed' ? 4 : 0)));
    }
  }

  if (action.kind === 'travel') {
    const targetState = state && state.world && state.world.cityStates
      ? state.world.cityStates[String(action.target || '').trim()]
      : null;
    if (targetState && authorityRank(targetState.playerAuthority) < authorityRank('reside')) {
      setAuthorityByScore(state, targetState, Math.max(10, Number(targetState.playerAuthorityScore || 0)));
    }
  }

  return cityState;
}

function summarizeTerritory(state) {
  const cityStates = ensureCityState(state);
  syncHistoricalPresenceToCities(state);
  const maintenancePreview = computeTerritoryMaintenancePreview(state, 1);
  const current = currentCityState(state);
  const cards = Object.values(cityStates)
    .filter((item) => authorityRank(item.playerAuthority) >= authorityRank('reside'))
    .sort((a, b) => authorityRank(b.playerAuthority) - authorityRank(a.playerAuthority) || Number(b.playerAuthorityScore || 0) - Number(a.playerAuthorityScore || 0))
    .map((item) => {
      const yieldData = cityYieldForState(item);
      return {
        cityId: item.cityId,
        cityName: item.cityName,
        region: item.region,
        authority: item.playerAuthority,
        authorityLabel: authorityLabel(item.playerAuthority),
        authorityScore: Number(item.playerAuthorityScore || 0),
        ownerFactionId: item.ownerFactionId || '',
        order: Number(item.order || 0),
        prosperity: Number(item.prosperity || 0),
        security: Number(item.security || 0),
        fortification: Number(item.fortification || 0),
        supplyStock: Number(item.supplyStock || 0),
        garrison: Number(item.garrison || 0),
        levyReserve: Number(item.levyReserve || 0),
        notableHistoricalCount: ensureList(item.notableHistoricalIds).length,
        yieldCoins: yieldData.coins,
        yieldSupplies: yieldData.supplies,
        yieldTroops: yieldData.troops,
        warning: Number(item.order || 0) < 42 || Number(item.security || 0) < 42 || Number(item.unrest || 0) >= 28
      };
    });
  const stationed = cards.map((item) => item.cityId);
  const governed = cards.filter((item) => authorityRank(item.authority) >= authorityRank('steward')).map((item) => item.cityId);
  const controlled = cards.filter((item) => authorityRank(item.authority) >= authorityRank('control')).map((item) => item.cityId);
  const incomePerTurn = cards.reduce((total, item) => total + Number(item.yieldCoins || 0), 0);
  const supplyPerTurn = cards.reduce((total, item) => total + Number(item.yieldSupplies || 0), 0);
  const troopSupportPerTurn = cards.reduce((total, item) => total + Number(item.yieldTroops || 0), 0);
  const totalGarrison = cards.reduce((total, item) => total + Number(item.garrison || 0), 0);
  const totalLevyReserve = cards.reduce((total, item) => total + Number(item.levyReserve || 0), 0);
  const maintenanceCoinsPerTurn = Number(maintenancePreview.totalCoinCost || 0);
  const maintenanceSuppliesPerTurn = Number(maintenancePreview.totalSupplyCost || 0);
  const warningCityIds = cards.filter((item) => item.warning).map((item) => item.cityId);
  const currentAuthority = current ? current.playerAuthority : 'none';
  const netCoinsPerTurn = incomePerTurn - maintenanceCoinsPerTurn;
  const netSuppliesPerTurn = supplyPerTurn - maintenanceSuppliesPerTurn;
  const fieldTroops = Math.max(0, Math.round(Number(state && state.gameState && state.gameState.troops || 0)));
  const summaryLine = governed.length
    ? `眼下名下共有 ${governed.length} 座在运转的城池，每回合约入 ${incomePerTurn} 钱、${supplyPerTurn} 粮，可回补 ${troopSupportPerTurn} 兵源；维持军政要吃掉 ${maintenanceCoinsPerTurn} 钱、${maintenanceSuppliesPerTurn} 粮。现有野战部曲 ${fieldTroops}、城防守军 ${totalGarrison}、待募兵源 ${totalLevyReserve}。${netCoinsPerTurn < 0 || netSuppliesPerTurn < 0 || Number(maintenancePreview.overload || 0) > 0 ? '这套盘子已经开始吃紧，再扩张就会先从财政、军需和治权缝隙里漏血。' : '账面还能撑住，但继续外压之前，最好先看好钱粮与治权容量。'}`
    : (stationed.length
      ? `眼下我只是先在${current ? current.cityName : '此地'}落住脚，还没真正把城池运转和持续出产收进手里。`
      : '眼下还没有真正纳入名下的城池。');
  return {
    stationedCityIds: stationed,
    governedCityIds: governed,
    controlledCityIds: controlled,
    currentAuthority,
    currentAuthorityLabel: authorityLabel(currentAuthority),
    currentAuthoritySummary: authoritySummary(currentAuthority),
    currentAuthorityScore: current ? Number(current.playerAuthorityScore || 0) : 0,
    cityCount: stationed.length,
    governedCount: governed.length,
    controlledCount: controlled.length,
    incomePerTurn,
    supplyPerTurn,
    troopSupportPerTurn,
    maintenanceCoinsPerTurn,
    maintenanceSuppliesPerTurn,
    netCoinsPerTurn,
    netSuppliesPerTurn,
    fieldTroops,
    totalGarrison,
    totalLevyReserve,
    supportCap: Number(maintenancePreview.supportCap || 0),
    adminCapacity: Number(maintenancePreview.adminCapacity || 0),
    overload: Number(maintenancePreview.overload || 0),
    warningCityIds,
    cityCards: cards.slice(0, 8),
    summaryLine
  };
}

function refreshTerritorySummary(state) {
  if (!state || !state.world) return createEmptyTerritorySummary();
  const summary = summarizeTerritory(state);
  state.world.territory = summary;
  return summary;
}

function applyCityTurn(state, action, outcome) {
  ensureCityState(state);
  const impactedCity = applyCurrentCityAction(state, action, outcome);
  const monthsElapsed = action && action.kind === 'travel' && outcome && outcome.travelPlan
    ? Math.max(1, Number(outcome.travelPlan.monthsCost || 1))
    : 1;
  const yields = settleCityTurn(state, monthsElapsed);
  const territory = refreshTerritorySummary(state);
  if (state && state.gameState) {
    state.gameState.lastCityReport = {
      cityName: impactedCity ? impactedCity.cityName : (state.world.currentCityName || ''),
      authorityLabel: impactedCity ? authorityLabel(impactedCity.playerAuthority) : authorityLabel('none'),
      authorityScore: impactedCity ? Number(impactedCity.playerAuthorityScore || 0) : 0,
      summary: territory.summaryLine,
      yields,
      maintenance: yields && yields.upkeep ? { ...yields.upkeep } : { coins: 0, supplies: 0 },
      shortages: yields && yields.shortages ? { ...yields.shortages } : { coins: 0, supplies: 0 },
      supportCap: Number(yields && yields.supportCap || 0),
      adminCapacity: Number(yields && yields.adminCapacity || 0),
      overload: Number(yields && yields.overload || 0),
      fieldTroops: Number(territory.fieldTroops || 0),
      totalGarrison: Number(territory.totalGarrison || 0),
      totalLevyReserve: Number(territory.totalLevyReserve || 0),
      governedCount: Number(territory.governedCount || 0),
      controlledCount: Number(territory.controlledCount || 0),
      warningCityIds: ensureList(territory.warningCityIds).slice()
    };
  }
  return {
    impactedCity,
    yields,
    territory
  };
}

function historicalRecruitAccess(state, relation) {
  if (!relation || relation.isHistorical !== true) {
    return {
      unlocked: true,
      cityId: '',
      cityName: '',
      requiresAuthority: false,
      stage: Number(relation && relation.retinueRecruitStage || 0)
    };
  }
  const presence = relation.historicalPresence && typeof relation.historicalPresence === 'object'
    ? relation.historicalPresence
    : null;
  const activeCityIds = ensureList(presence && presence.cityIds).length
    ? ensureList(presence.cityIds)
    : ensureList(relation.homeCities);
  const currentCityId = state && state.world ? String(state.world.currentCityId || '') : '';
  const currentCity = currentCityId && state && state.world && state.world.cityStates
    ? state.world.cityStates[currentCityId]
    : currentCityState(state);
  const inRequiredCity = !!(currentCityId && activeCityIds.includes(currentCityId));
  const authorityMet = hasAuthorityAtLeast(currentCity, 'steward');
  const stage = Math.max(0, Number(relation.retinueRecruitStage || 0));
  return {
    unlocked: inRequiredCity && authorityMet,
    cityId: currentCityId,
    cityName: currentCity ? currentCity.cityName : '',
    activeCityIds,
    inRequiredCity,
    authorityMet,
    requiresAuthority: true,
    requiredAuthority: 'steward',
    requiredAuthorityLabel: authorityLabel('steward'),
    stage
  };
}

module.exports = {
  AUTHORITY_ORDER,
  authorityRank,
  authorityLabel,
  authoritySummary,
  hasAuthorityAtLeast,
  ensureCityState,
  currentCityState,
  adoptOriginCity,
  boostAuthorityScore,
  setCityAuthority,
  markCityCaptured,
  refreshTerritorySummary,
  applyCityTurn,
  historicalRecruitAccess,
  cityYieldForState
};
