const { isRelationMet } = require('./chronicleV5RelationVisibility');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSnippet(value, fallback = '') {
  const text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function clamp(value, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function uniqueBy(list, keyFn) {
  const seen = new Set();
  return ensureList(list).filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableTextHash(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function pickVariant(seedSource, variants, fallback = '') {
  const list = ensureList(variants).filter(Boolean);
  if (!list.length) return fallback;
  return list[stableTextHash(seedSource || list[0]) % list.length] || fallback || list[0];
}

function createEmptyWorldPerception() {
  return {
    headline: '',
    summary: '',
    publicRumor: '',
    militaryView: '',
    jianghuView: '',
    intimateView: '',
    hiddenCurrent: '',
    intensity: 0,
    lastTurn: 0,
    lastActionKind: '',
    lastActionMode: '',
    actionBias: {},
    relationBeats: [],
    signalLines: [],
    frontierSeeds: []
  };
}

function normalizeActionBias(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.keys(source).reduce((result, key) => {
    const next = Number(source[key] || 0);
    if (!Number.isFinite(next) || !next) return result;
    result[String(key)] = next;
    return result;
  }, {});
}

function normalizeFrontierSeed(seed) {
  if (!seed || typeof seed !== 'object') return null;
  const localChoice = seed.localChoice && typeof seed.localChoice === 'object'
    ? {
      text: normalizeSnippet(seed.localChoice.text || ''),
      actionText: normalizeSnippet(seed.localChoice.actionText || ''),
      hint: normalizeSnippet(seed.localChoice.hint || ''),
      actionKind: normalizeSnippet(seed.localChoice.actionKind || ''),
      actionMode: normalizeSnippet(seed.localChoice.actionMode || ''),
      category: normalizeSnippet(seed.localChoice.category || ''),
      targetId: normalizeSnippet(seed.localChoice.targetId || ''),
      targetName: normalizeSnippet(seed.localChoice.targetName || '')
    }
    : null;
  if (!localChoice || !localChoice.text || !localChoice.actionText) return null;
  return {
    id: normalizeSnippet(seed.id || ''),
    type: normalizeSnippet(seed.type || 'perception'),
    title: normalizeSnippet(seed.title || localChoice.text),
    summary: normalizeSnippet(seed.summary || ''),
    reason: normalizeSnippet(seed.reason || ''),
    domain: normalizeSnippet(seed.domain || '风评'),
    risk: normalizeSnippet(seed.risk || 'medium'),
    recommendedKinds: ensureList(seed.recommendedKinds).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 4),
    targetId: normalizeSnippet(seed.targetId || localChoice.targetId || ''),
    targetName: normalizeSnippet(seed.targetName || localChoice.targetName || ''),
    targetType: normalizeSnippet(seed.targetType || ''),
    cityId: normalizeSnippet(seed.cityId || ''),
    cityName: normalizeSnippet(seed.cityName || ''),
    outcomes: ensureList(seed.outcomes).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 6),
    noveltyKey: normalizeSnippet(seed.noveltyKey || ''),
    source: normalizeSnippet(seed.source || 'perception'),
    weight: Number(seed.weight || 0),
    localChoice
  };
}

function ensureWorldPerceptionState(gameState) {
  if (!gameState || typeof gameState !== 'object') return createEmptyWorldPerception();
  const base = gameState.worldPerception && typeof gameState.worldPerception === 'object'
    ? gameState.worldPerception
    : {};
  const merged = createEmptyWorldPerception();
  merged.headline = normalizeSnippet(base.headline || '');
  merged.summary = normalizeSnippet(base.summary || '');
  merged.publicRumor = normalizeSnippet(base.publicRumor || '');
  merged.militaryView = normalizeSnippet(base.militaryView || '');
  merged.jianghuView = normalizeSnippet(base.jianghuView || '');
  merged.intimateView = normalizeSnippet(base.intimateView || '');
  merged.hiddenCurrent = normalizeSnippet(base.hiddenCurrent || '');
  merged.intensity = clamp(base.intensity, 0, 100);
  merged.lastTurn = Number(base.lastTurn || 0);
  merged.lastActionKind = normalizeSnippet(base.lastActionKind || '');
  merged.lastActionMode = normalizeSnippet(base.lastActionMode || '');
  merged.actionBias = normalizeActionBias(base.actionBias);
  merged.relationBeats = ensureList(base.relationBeats).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 4);
  merged.signalLines = ensureList(base.signalLines).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 6);
  merged.frontierSeeds = ensureList(base.frontierSeeds).map((item) => normalizeFrontierSeed(item)).filter(Boolean).slice(0, 6);
  gameState.worldPerception = merged;
  return merged;
}

function summarizeWorldPerceptionForPrompt(gameState) {
  const worldPerception = ensureWorldPerceptionState(gameState || {});
  return {
    headline: worldPerception.headline,
    summary: worldPerception.summary,
    publicRumor: worldPerception.publicRumor,
    militaryView: worldPerception.militaryView,
    jianghuView: worldPerception.jianghuView,
    intimateView: worldPerception.intimateView,
    hiddenCurrent: worldPerception.hiddenCurrent,
    intensity: Number(worldPerception.intensity || 0),
    lastTurn: Number(worldPerception.lastTurn || 0),
    lastActionKind: worldPerception.lastActionKind,
    lastActionMode: worldPerception.lastActionMode,
    actionBias: Object.assign({}, worldPerception.actionBias),
    relationBeats: ensureList(worldPerception.relationBeats).slice(0, 3),
    signalLines: ensureList(worldPerception.signalLines).slice(0, 4),
    frontierSeeds: ensureList(worldPerception.frontierSeeds).slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      reason: item.reason,
      domain: item.domain,
      risk: item.risk,
      recommendedKinds: ensureList(item.recommendedKinds),
      localChoice: item.localChoice ? {
        text: item.localChoice.text,
        actionText: item.localChoice.actionText,
        hint: item.localChoice.hint,
        actionKind: item.localChoice.actionKind,
        actionMode: item.localChoice.actionMode
      } : null
    }))
  };
}

function currentCityIdOf(state) {
  return String(state && state.world && state.world.currentCityId || '');
}

function currentCityNameOf(state) {
  return String(state && state.world && state.world.currentCityName || '');
}

function visibleRelations(state) {
  return ensureList(state && state.gameState && state.gameState.relationships)
    .filter((item) => item && item.id && item.name && isRelationMet(item));
}

function pickRelation(state, scoreFn, filterFn = null) {
  const ranked = visibleRelations(state)
    .filter((item) => (typeof filterFn === 'function' ? filterFn(item) : true))
    .map((item) => ({ item, score: Number(scoreFn(item) || 0) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return ranked.length ? ranked[0].item : null;
}

function pickMilitaryRelation(state) {
  return pickRelation(
    state,
    (item) => {
      const tags = ensureList(item.tags);
      return Number(item.martialRating || 0)
        + Number(item.strategyRating || 0)
        + Number(item.trust || 0)
        + (item.isHistorical ? 8 : 0)
        + (tags.some((tag) => ['battle', 'military', 'warpath', 'frontier'].includes(tag)) ? 26 : 0);
    },
    (item) => ensureList(item.tags).some((tag) => ['battle', 'military', 'warpath', 'frontier'].includes(tag))
      || item.isHistorical
      || Number(item.martialRating || 0) >= 18
      || Number(item.strategyRating || 0) >= 18
  );
}

function pickJianghuRelation(state) {
  return pickRelation(
    state,
    (item) => {
      const tags = ensureList(item.tags);
      return Number(item.martialRating || 0)
        + Number(item.affection || 0)
        + Number(item.trust || 0)
        + (tags.some((tag) => ['jianghu', 'martial', 'battle'].includes(tag)) ? 24 : 0);
    },
    (item) => ensureList(item.tags).some((tag) => ['jianghu', 'martial', 'battle'].includes(tag))
      || /江湖|武|游侠|豪侠/.test(String(item.storyDomain || ''))
      || Number(item.martialRating || 0) >= 16
  );
}

function pickIntimateRelation(state) {
  return pickRelation(
    state,
    (item) => Number(item.affection || 0) * 2 + Number(item.trust || 0) + Number(item.loyalty || 0) - Number(item.rivalry || 0)
  );
}

function pickPressureFaction(state) {
  return null;
}

function perceptionIntensity(actionKind, outcome, gameState) {
  const actionBase = {
    jianghu: 68,
    spar: 74,
    warpath: 72,
    battle: 82,
    military: 60,
    intrigue: 62,
    investigate: 54,
    social: 46,
    romance: 48,
    govern: 40,
    trade: 42,
    sect: 46,
    martial: 52,
    rest: 28,
    travel: 34
  };
  const tierAdjust = {
    great: 12,
    good: 8,
    mixed: 4,
    fail: 10
  };
  const renown = Math.min(10, Math.round(Number(gameState && gameState.renown || 0) / 12));
  const influence = Math.min(8, Math.round(Number(gameState && gameState.influence || 0) / 15));
  return clamp((actionBase[actionKind] || 42) + (tierAdjust[String(outcome && outcome.tier || 'mixed')] || 0) + renown + influence, 12, 100);
}

function publicIdentityOf(state, actionKind, outcome) {
  const gs = state && state.gameState ? state.gameState : {};
  if (Number(gs.renown || 0) >= 80) return '已经能搅动局面的名字';
  if (Number(gs.influence || 0) >= 65) return '越来越像会带动别人站位的人';
  if (actionKind === 'warpath' || actionKind === 'battle') {
    return String(outcome && outcome.tier || '') === 'fail' ? '敢压军旅却还没完全站稳的人' : '开始像军中会被认真掂量的人';
  }
  if (actionKind === 'jianghu' || actionKind === 'spar') {
    return String(outcome && outcome.tier || '') === 'fail' ? '刚把脚压进江湖的人' : '开始被江湖记住的人';
  }
  if (actionKind === 'intrigue' || actionKind === 'investigate') return '不是只会看热闹的人';
  if (actionKind === 'social' || actionKind === 'romance') return '能把人心挑动起来的人';
  return '已经不再只是路边无名之人';
}

function buildPerceptionSeed(id, title, actionText, actionKind, options = {}) {
  return normalizeFrontierSeed({
    id,
    type: options.type || 'perception',
    title,
    summary: options.summary || '',
    reason: options.reason || '',
    domain: options.domain || '风评',
    risk: options.risk || 'medium',
    recommendedKinds: ensureList(options.recommendedKinds).length ? options.recommendedKinds : [actionKind],
    targetId: options.targetId || '',
    targetName: options.targetName || '',
    targetType: options.targetType || '',
    cityId: options.cityId || '',
    cityName: options.cityName || '',
    outcomes: ensureList(options.outcomes),
    noveltyKey: options.noveltyKey || '',
    source: 'perception',
    weight: Number(options.weight || 80),
    localChoice: {
      text: title,
      actionText,
      hint: options.hint || '',
      actionKind,
      actionMode: options.actionMode || '',
      category: options.category || '风评',
      targetId: options.targetId || '',
      targetName: options.targetName || ''
    }
  });
}

function buildWorldPerception(state, action, outcome) {
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state) || '此地';
  const gs = state && state.gameState ? state.gameState : {};
  const kind = normalizeSnippet(action && action.kind || '');
  const mode = normalizeSnippet(action && action.mode || '');
  const tier = normalizeSnippet(outcome && outcome.tier || 'mixed');
  const intensity = perceptionIntensity(kind, outcome, gs);
  const militaryRelation = pickMilitaryRelation(state);
  const jianghuRelation = pickJianghuRelation(state);
  const intimateRelation = pickIntimateRelation(state);
  const pressureFaction = pickPressureFaction(state);
  const publicIdentity = publicIdentityOf(state, kind, outcome);
  const turn = Number(state && state.world && state.world.turn || 0);
  const publicRumor = `${cityName}里已经有人开始把你看成${publicIdentity}，不再只是路过一遭。`;
  let militaryView = '';
  let jianghuView = '';
  let intimateView = '';
  let hiddenCurrent = '';
  let headline = `${cityName}里外都开始重新掂量你`;
  const actionBias = {};
  const relationBeats = [];
  const seeds = [];

  if (['warpath', 'battle', 'military'].includes(kind)) {
    headline = `${cityName}周边的军中观感已经起了变化`;
    militaryView = militaryRelation
      ? `${militaryRelation.name}这一线会把你记成${tier === 'fail' ? '有胆气却还未完全压稳阵脚的人' : '可以往军中更深处试着压一步的人'}。`
      : '军中会把你这一手记在“敢不敢担事、扛不扛得住后果”上，而不只看一时口风。';
    actionBias.warpath = 12;
    actionBias.investigate = 8;
    actionBias.military = 10;
  } else if (['jianghu', 'spar', 'martial'].includes(kind)) {
    headline = `${cityName}的江湖口风已经朝你这边拐了`;
    jianghuView = jianghuRelation
      ? `${jianghuRelation.name}这一线会觉得你${tier === 'fail' ? '是会露空门的人' : '不是只会摆花架子的人'}，往后递来的未必只有善意。`
      : '江湖不会先问你是谁的人，只会先记你这一手到底有没有分量。';
    actionBias.jianghu = 12;
    actionBias.investigate = 8;
    actionBias.social = 4;
  } else if (['intrigue', 'investigate'].includes(kind)) {
    headline = '旁人已经开始猜你在借哪层暗线发力';
    hiddenCurrent = pressureFaction
      ? `${pressureFaction.name}那边多半会把你这一步理解成在摸它的边界，接下来会更谨慎也更想反试你。`
      : '真正危险的不是当场露面的那一个，而是开始换口风、换站位的人。';
    actionBias.investigate = 12;
    actionBias.intrigue = 10;
    actionBias.social = 4;
  } else if (['social', 'romance'].includes(kind)) {
    headline = '人心已经在替你这一手添上各自的注脚';
    intimateView = intimateRelation
      ? `${intimateRelation.name}会更在意你这一步到底是试探、示好，还是想把关系往更深处推。`
      : '最贴近你的人未必会先表态，但会把这一手默默记到心里。';
    actionBias.social = 10;
    actionBias.investigate = 6;
    actionBias.romance = 6;
  } else {
    hiddenCurrent = pressureFaction
      ? `${pressureFaction.name}已经会顺着这一步重新估价你，哪怕表面上还没把态度摆明。`
      : '哪怕台面上看着平静，旁人也已经开始替你重新排轻重了。';
    actionBias.investigate = 8;
    actionBias.social = 5;
  }

  if (!militaryView && militaryRelation && Number(militaryRelation.strategyRating || militaryRelation.martialRating || 0) >= 18) {
    militaryView = `${militaryRelation.name}会把你最近这几步记成一种站位信号，往后未必只拿你当旁观者。`;
  }
  if (!jianghuView && jianghuRelation && Number(jianghuRelation.martialRating || 0) >= 16) {
    jianghuView = `${jianghuRelation.name}这一线会注意你到底是借势造名，还是真想往江湖深处走。`;
  }
  if (!intimateView && intimateRelation && (Number(intimateRelation.affection || 0) >= 18 || Number(intimateRelation.trust || 0) >= 16)) {
    intimateView = `${intimateRelation.name}会把你这一手看成一种心迹或取舍，并据此重新衡量与你的距离。`;
  }
  if (!hiddenCurrent) {
    hiddenCurrent = pressureFaction
      ? `${pressureFaction.name}那边不会只看成败，而会看你是不是开始有了可借、可防、可压的价值。`
      : '这一步真正会留下的，不是热闹本身，而是别人从中读出了什么。';
  }

  if (militaryRelation) {
    relationBeats.push(`${militaryRelation.name}更在意你扛不扛得住后续，而不是这一手说得多漂亮。`);
  }
  if (jianghuRelation && (!militaryRelation || jianghuRelation.id !== militaryRelation.id)) {
    relationBeats.push(`${jianghuRelation.name}会把你的分量记在真场面里，而不是记在嘴上。`);
  }
  if (intimateRelation && (!militaryRelation || intimateRelation.id !== militaryRelation.id) && (!jianghuRelation || intimateRelation.id !== jianghuRelation.id)) {
    relationBeats.push(`${intimateRelation.name}会开始分辨你这一步到底是野心、真心，还是不得不走。`);
  }

  seeds.push(buildPerceptionSeed(
    `frontier:perception:rumor:${cityId || 'nowhere'}`,
    '听听城里怎么编排我',
    'action:investigate:rumor',
    'investigate',
    {
      actionMode: 'rumor',
      summary: '先去听这一手落下后，城里到底把你编排成了什么样的人，再决定下一步顺势还是拆势。',
      reason: '风评不是旁白，而是别人接近你、试探你、借你或防你的起点。',
      domain: '风评',
      risk: 'low',
      recommendedKinds: ['investigate', 'social', 'intrigue'],
      cityId,
      cityName,
      outcomes: ['rumor', 'plot', 'relation'],
      noveltyKey: `perception:rumor:${cityId}`,
      hint: '先听风评，能知道这一手究竟被谁读偏了、谁读深了。',
      weight: 90
    }
  ));

  seeds.push(buildPerceptionSeed(
    `frontier:perception:hidden:${cityId || 'nowhere'}`,
    '摸清谁在借题发酵',
    'action:intrigue:counterspy',
    'intrigue',
    {
      actionMode: 'counterspy',
      summary: '不是只看表面的热闹，顺着这一步背后开始发酵的人和口风往里拆，看是谁在借势做局。',
      reason: '真正会影响后面的，往往不是眼前的声响，而是借题转势的人。',
      domain: '误读',
      risk: 'medium',
      recommendedKinds: ['intrigue', 'investigate'],
      cityId,
      cityName,
      outcomes: ['plot', 'countermove', 'faction'],
      noveltyKey: `perception:hidden:${cityId}:${kind || 'turn'}`,
      hint: '把谁在借题发酵摸出来，后面就不会一直被动吃风向。',
      weight: 86
    }
  ));

  if (militaryRelation) {
    seeds.push(buildPerceptionSeed(
      `frontier:perception:military:${militaryRelation.id}`,
      `看${militaryRelation.name}把我算成哪路人`,
      `action:warpath:${militaryRelation.id}:counsel`,
      'warpath',
      {
        actionMode: 'counsel',
        summary: `去接${militaryRelation.name}这一线，看军中到底把你当成可用之人、可疑之人，还是一时可借之人。`,
        reason: '军旅线真正值钱的，不只是进场，而是知道自己被放在了哪一格里。',
        domain: '军旅',
        risk: 'medium',
        recommendedKinds: ['warpath', 'investigate', 'military'],
        targetId: militaryRelation.id,
        targetName: militaryRelation.name,
        targetType: 'relation',
        cityId,
        cityName,
        outcomes: ['warpath', 'relation', 'plot'],
        noveltyKey: `perception:military:${militaryRelation.id}:${kind || 'turn'}`,
        hint: '军中如何看你，会直接决定你接下来能被放到多深的位置。',
        weight: 88
      }
    ));
  }

  if (jianghuRelation) {
    seeds.push(buildPerceptionSeed(
      `frontier:perception:jianghu:${jianghuRelation.id}`,
      `顺着${jianghuRelation.name}这一线听江湖口风`,
      'action:jianghu:trace',
      'jianghu',
      {
        actionMode: 'trace',
        summary: `别急着硬碰，先顺着${jianghuRelation.name}这类人所在的门路去听，看看江湖把你记成了什么样的人。`,
        reason: '江湖最先决定的往往不是输赢，而是你将被什么样的人盯上。',
        domain: '江湖',
        risk: 'medium',
        recommendedKinds: ['jianghu', 'investigate', 'social'],
        targetId: jianghuRelation.id,
        targetName: jianghuRelation.name,
        targetType: 'relation',
        cityId,
        cityName,
        outcomes: ['encounter', 'rumor', 'relation'],
        noveltyKey: `perception:jianghu:${jianghuRelation.id}:${kind || 'turn'}`,
        hint: '先听清江湖口风，再决定是接帖、结交还是拔刀。',
        weight: 84
      }
    ));
  }

  if (intimateRelation) {
    seeds.push(buildPerceptionSeed(
      `frontier:perception:intimate:${intimateRelation.id}`,
      `问问${intimateRelation.name}眼里的我`,
      `action:investigate:${intimateRelation.id}:counsel`,
      'investigate',
      {
        actionMode: 'counsel',
        summary: `去听${intimateRelation.name}怎么解你这一手，往往比听全城热闹更能知道自己到底漏出了什么。`,
        reason: '亲近之人的判断，常常比市井传言更准，也更伤人或更动人。',
        domain: '亲近',
        risk: 'low',
        recommendedKinds: ['investigate', 'social', 'romance'],
        targetId: intimateRelation.id,
        targetName: intimateRelation.name,
        targetType: 'relation',
        cityId,
        cityName,
        outcomes: ['relation', 'romance', 'plot'],
        noveltyKey: `perception:intimate:${intimateRelation.id}:${kind || 'turn'}`,
        hint: '有些答案不在街谈巷议里，而在真正靠近你的人眼里。',
        weight: 80
      }
    ));
  }

  const signalLines = uniqueBy([
    publicRumor,
    militaryView,
    jianghuView,
    intimateView,
    hiddenCurrent
  ].filter(Boolean).map((item) => ({ text: item })), (item) => item.text).map((item) => item.text).slice(0, 4);

  const summaryBits = uniqueBy([
    publicRumor,
    militaryView || jianghuView || intimateView,
    hiddenCurrent
  ].filter(Boolean).map((item) => ({ text: item })), (item) => item.text).map((item) => item.text);
  const summary = summaryBits.join('');

  return {
    headline,
    summary,
    publicRumor,
    militaryView,
    jianghuView,
    intimateView,
    hiddenCurrent,
    intensity,
    lastTurn: Number(state && state.world && state.world.turn || 0),
    lastActionKind: kind,
    lastActionMode: mode,
    actionBias,
    relationBeats: uniqueBy(relationBeats.map((item) => ({ text: item })), (item) => item.text).map((item) => item.text).slice(0, 3),
    signalLines,
    frontierSeeds: uniqueBy(seeds.filter(Boolean), (item) => item.id || `${item.title}:${item.localChoice && item.localChoice.actionText}`).slice(0, 5)
  };
}

function applyWorldPerception(state, action, outcome) {
  if (!state || !state.gameState || !state.world || state.world.phase !== 'playing') return null;
  if (!action || !action.kind) return null;
  if (String(action.kind) === 'battlecmd') return ensureWorldPerceptionState(state.gameState);
  const next = buildWorldPerception(state, action, outcome || {});
  state.gameState.worldPerception = ensureWorldPerceptionState(state.gameState);
  Object.assign(state.gameState.worldPerception, next);
  return state.gameState.worldPerception;
}

module.exports = {
  createEmptyWorldPerception,
  ensureWorldPerceptionState,
  summarizeWorldPerceptionForPrompt,
  applyWorldPerception
};
