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

function createEmptyWorldFermentation() {
  return {
    headline: '',
    summary: '',
    directorHint: '',
    heat: 0,
    lastTurn: 0,
    lastActionKind: '',
    lastActionMode: '',
    affectedDomains: [],
    actionBias: {},
    signals: [],
    frontierSeeds: [],
    threadSeeds: []
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
    type: normalizeSnippet(seed.type || 'fermentation'),
    title: normalizeSnippet(seed.title || localChoice.text),
    summary: normalizeSnippet(seed.summary || ''),
    reason: normalizeSnippet(seed.reason || ''),
    domain: normalizeSnippet(seed.domain || '暗潮'),
    risk: normalizeSnippet(seed.risk || 'medium'),
    recommendedKinds: ensureList(seed.recommendedKinds).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 4),
    targetId: normalizeSnippet(seed.targetId || localChoice.targetId || ''),
    targetName: normalizeSnippet(seed.targetName || localChoice.targetName || ''),
    targetType: normalizeSnippet(seed.targetType || ''),
    cityId: normalizeSnippet(seed.cityId || ''),
    cityName: normalizeSnippet(seed.cityName || ''),
    outcomes: ensureList(seed.outcomes).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 6),
    noveltyKey: normalizeSnippet(seed.noveltyKey || ''),
    source: normalizeSnippet(seed.source || 'fermentation'),
    weight: Number(seed.weight || 0),
    localChoice
  };
}

function normalizeThreadSeed(seed) {
  if (!seed || typeof seed !== 'object') return null;
  const title = normalizeSnippet(seed.title || '');
  if (!title) return null;
  return {
    title,
    urgency: clamp(seed.urgency, 1, 3),
    domain: normalizeSnippet(seed.domain || '局势')
  };
}

function ensureWorldFermentationState(gameState) {
  if (!gameState || typeof gameState !== 'object') return createEmptyWorldFermentation();
  const base = gameState.worldFermentation && typeof gameState.worldFermentation === 'object'
    ? gameState.worldFermentation
    : {};
  const merged = createEmptyWorldFermentation();
  merged.headline = normalizeSnippet(base.headline || '');
  merged.summary = normalizeSnippet(base.summary || '');
  merged.directorHint = normalizeSnippet(base.directorHint || '');
  merged.heat = clamp(base.heat, 0, 100);
  merged.lastTurn = Number(base.lastTurn || 0);
  merged.lastActionKind = normalizeSnippet(base.lastActionKind || '');
  merged.lastActionMode = normalizeSnippet(base.lastActionMode || '');
  merged.affectedDomains = ensureList(base.affectedDomains).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 6);
  merged.actionBias = normalizeActionBias(base.actionBias);
  merged.signals = ensureList(base.signals).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 6);
  merged.frontierSeeds = ensureList(base.frontierSeeds).map((item) => normalizeFrontierSeed(item)).filter(Boolean).slice(0, 6);
  merged.threadSeeds = ensureList(base.threadSeeds).map((item) => normalizeThreadSeed(item)).filter(Boolean).slice(0, 6);
  gameState.worldFermentation = merged;
  return merged;
}

function summarizeWorldFermentationForPrompt(gameState) {
  const worldFermentation = ensureWorldFermentationState(gameState || {});
  return {
    headline: worldFermentation.headline,
    summary: worldFermentation.summary,
    directorHint: worldFermentation.directorHint,
    heat: Number(worldFermentation.heat || 0),
    lastTurn: Number(worldFermentation.lastTurn || 0),
    lastActionKind: worldFermentation.lastActionKind,
    lastActionMode: worldFermentation.lastActionMode,
    affectedDomains: ensureList(worldFermentation.affectedDomains).slice(0, 6),
    actionBias: Object.assign({}, worldFermentation.actionBias),
    signals: ensureList(worldFermentation.signals).slice(0, 4),
    frontierSeeds: ensureList(worldFermentation.frontierSeeds).slice(0, 4).map((item) => ({
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

function recentActionKinds(state, limit = 4) {
  return ensureList(state && state.memory && state.memory.recentActions)
    .slice(0, limit)
    .map((item) => String(item && item.kind || '').trim())
    .filter(Boolean);
}

function pickMartialRelation(state) {
  const relations = ensureList(state && state.gameState && state.gameState.relationships);
  const ranked = relations
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      item,
      score: Number(item.martialRating || 0)
        + Number(item.trust || 0)
        + Number(item.affection || 0)
        + Number(item.loyalty || 0)
        - Number(item.rivalry || 0)
    }))
    .sort((a, b) => b.score - a.score);
  return ranked.length ? ranked[0].item : null;
}

function pickPressureFaction(state) {
  return null;
}

function baseHeat(actionKind, tier) {
  const actionHeat = {
    jianghu: 66,
    warpath: 72,
    battle: 80,
    military: 58,
    intrigue: 62,
    investigate: 56,
    diplomacy: 52,
    social: 50,
    govern: 44,
    trade: 46,
    sect: 48,
    martial: 50,
    romance: 45,
    rest: 34,
    travel: 40
  };
  const tierAdjust = {
    great: 12,
    good: 8,
    mixed: 4,
    fail: 10
  };
  return clamp((actionHeat[actionKind] || 42) + (tierAdjust[tier] || 0), 12, 100);
}

function buildSeed(id, title, actionText, actionKind, options = {}) {
  return normalizeFrontierSeed({
    id,
    type: options.type || 'fermentation',
    title,
    summary: options.summary || '',
    reason: options.reason || '',
    domain: options.domain || '暗潮',
    risk: options.risk || 'medium',
    recommendedKinds: ensureList(options.recommendedKinds).length ? options.recommendedKinds : [actionKind],
    targetId: options.targetId || '',
    targetName: options.targetName || '',
    targetType: options.targetType || '',
    cityId: options.cityId || '',
    cityName: options.cityName || '',
    outcomes: ensureList(options.outcomes),
    noveltyKey: options.noveltyKey || '',
    source: 'fermentation',
    weight: Number(options.weight || 70),
    localChoice: {
      text: title,
      actionText,
      hint: options.hint || '',
      actionKind,
      actionMode: options.actionMode || '',
      category: options.category || '暗潮',
      targetId: options.targetId || '',
      targetName: options.targetName || ''
    }
  });
}

function buildGenericFermentation(state, action, outcome) {
  const cityName = currentCityNameOf(state) || '此地';
  const cityId = currentCityIdOf(state);
  const kind = String(action && action.kind || '').trim();
  const tier = String(outcome && outcome.tier || 'mixed').trim();
  const heat = baseHeat(kind, tier);
  const martialTarget = pickMartialRelation(state);
  const faction = pickPressureFaction(state);
  const recentKinds = recentActionKinds(state);
  const recentJianghu = recentKinds.filter((item) => item === 'jianghu').length;
  const seeds = [];
  const threads = [];
  const signals = [];
  let headline = `${cityName}里有人开始重新估量你`;
  let summary = '你刚落下去的这一手没有停在表面。人情、风声和利益会替你继续发酵，下一回的门路也会因此偏转。';
  let directorHint = '把这层余波写成会继续作用于人物判断与后续门路的暗潮，不要只作一句背景说明。';
  const actionBias = {};
  const affectedDomains = [];

  if (kind === 'jianghu') {
    headline = `${cityName}的江湖开始记住你`;
    summary = tier === 'fail'
      ? `你压进江湖之后，并没有立刻站稳，反而让茶肆、武馆和镖路上多了几道试探你的目光。有人想踩你，有人想借你，也有人在等你先露出下一手。`
      : `你压进江湖之后，${cityName}的茶肆、武馆和行脚路数都开始拿你的名号试口风。名声未必全是好事，它会带来邀约、试手帖、借势者和盯上你的暗门。`;
    directorHint = '若本回是压向江湖，正文默认写成风声、试探、递帖、邀约、摸门路与暗中起意；只有明确遭遇切磋、敌袭或围杀时，才切入即时交锋。';
    signals.push(
      '茶肆和武馆开始拿你的名号试口风。',
      '已经有人在等一个合适的由头，把帖子或邀约送到你门前。',
      martialTarget ? `${martialTarget.name}这一类会动手的人，很可能会顺着风声来试你。` : '真正会动手的人，还没有正式站到你面前。'
    );
    affectedDomains.push('江湖', '人物');
    actionBias.jianghu = 16;
    actionBias.investigate = 12;
    actionBias.social = 8;
    if (martialTarget) actionBias.spar = 7;
    seeds.push(buildSeed(
      `frontier:ferment:jianghu_clue:${cityId || 'nowhere'}`,
      '追谁在借我名号放风',
      'action:investigate:jianghu_clue',
      'investigate',
      {
        actionMode: 'jianghu_clue',
        summary: '先顺着城里的试探与风声摸下去，查清是谁在借你的名号放话、递帖或埋钩。',
        reason: '江湖线真正值钱的不是立刻动手，而是看清谁先把你当成筹码。',
        domain: '江湖',
        risk: 'medium',
        recommendedKinds: ['investigate', 'jianghu', 'intrigue'],
        cityId,
        cityName,
        outcomes: ['rumor', 'plot', 'encounter'],
        noveltyKey: `ferment:jianghu_clue:${cityId}`,
        hint: '先查谁在放风，后面无论结交还是开打都更有底。',
        weight: 92
      }
    ));
    seeds.push(buildSeed(
      `frontier:ferment:jianghu_trace:${cityId || 'nowhere'}`,
      '顺着名号再压半步',
      'action:jianghu:trace',
      'jianghu',
      {
        actionMode: 'trace',
        summary: '继续沿着刚起的名号和风声追过去，看等着你的是高人、仇家、黑市门路还是另一层江湖旧账。',
        reason: '刚起的名号最容易把真正的门路与麻烦一并逼出来。',
        domain: '江湖',
        risk: recentJianghu >= 2 ? 'high' : 'medium',
        recommendedKinds: ['jianghu', 'investigate'],
        cityId,
        cityName,
        outcomes: ['encounter', 'new_relation', 'plot'],
        noveltyKey: `ferment:jianghu_trace:${cityId}`,
        hint: '这不是立刻开打，而是顺着风波把真正的人和门路逼出来。',
        weight: 88
      }
    ));
    seeds.push(buildSeed(
      `frontier:ferment:jianghu_invitation:${cityId || 'nowhere'}`,
      '赴那封送到门前的帖子',
      'action:social:salon',
      'social',
      {
        type: 'invitation',
        actionMode: 'salon',
        summary: '江湖风声已经热到会有人主动递帖。你可以顺着这封送到门前的帖子去见人，看看对方是想结交、借势，还是拿你试水。',
        reason: '当名号开始发酵，江湖不会一直等你去找它，它会先把一封帖子送上门。',
        domain: '人物',
        risk: 'medium',
        recommendedKinds: ['social', 'jianghu', 'investigate'],
        cityId,
        cityName,
        outcomes: ['new_relation', 'encounter', 'plot'],
        noveltyKey: `ferment:jianghu_invitation:${cityId}`,
        hint: '这一步不是闲逛，而是去接住别人主动抛来的门路。',
        weight: 87
      }
    ));
    if (martialTarget) {
      seeds.push(buildSeed(
        `frontier:ferment:jianghu_spar:${martialTarget.id}`,
        `接下${martialTarget.name}的试手帖`,
        `action:spar:${martialTarget.id}:`,
        'spar',
        {
          summary: `${martialTarget.name}这一类会动手的人，很可能把试探写成切磋。你可以主动接帖，把暗潮逼成明局。`,
          reason: '江湖发酵到一定程度，切磋往往不是偶发，而是别人对你发出的判断。',
          domain: '江湖',
          risk: 'high',
          recommendedKinds: ['spar', 'jianghu'],
          targetId: martialTarget.id,
          targetName: martialTarget.name,
          cityId,
          cityName,
          outcomes: ['battle', 'relation', 'renown'],
          noveltyKey: `ferment:jianghu_spar:${martialTarget.id}`,
          hint: '这会正式进入切磋，而不是普通剧情推进。',
          weight: 82
        }
      ));
    }
    threads.push(
      { title: '江湖上已经有人借我的名号放风；若不顺线查清，后面来的未必全是朋友。', urgency: 3, domain: '江湖' },
      { title: '压进江湖之后，真正会站出来试我、借我或踩我的人，很快就会浮出水面。', urgency: 2, domain: '江湖' }
    );
  } else if (['warpath', 'battle', 'military'].includes(kind)) {
    headline = `${cityName}周边的军情开始围着你转`;
    summary = '兵势一动，旁人就会重新计算站位。敌方探子、地方豪强、粮道和观望者都会顺着你这一手重新下注。';
    directorHint = '把军务余波写成兵、粮、风向和人心的再分配，不要只停在一句打完了。';
    signals.push('你的动作已经逼得周边势力重新计算兵势和粮道。', '来探口风、递军情和试底的人，很快会顺着营门找上来。');
    affectedDomains.push('军旅', '势力');
    actionBias.military = 12;
    actionBias.investigate = 9;
    actionBias.diplomacy = 7;
    if (faction) {
      seeds.push(buildSeed(
        `frontier:ferment:military_probe:${faction.id}`,
        `盯住${faction.name}的回手`,
        'action:investigate:terrain',
        'investigate',
        {
          actionMode: 'terrain',
          summary: `顺着这场军情去盯${faction.name}的粮道、前哨和补线，看对方会不会抢在你前面补后手。`,
          reason: '真正吃人的不是正面一击，而是战后谁先把后手补齐。',
          domain: '军旅',
          risk: 'medium',
          recommendedKinds: ['investigate', 'military', 'warpath'],
          targetId: faction.id,
          targetName: faction.name,
          cityId,
          cityName,
          outcomes: ['plot', 'battle', 'territory'],
          noveltyKey: `ferment:military_probe:${faction.id}`,
          hint: '先查后手，能避免下一回被人反拿先手。',
          weight: 86
        }
      ));
      seeds.push(buildSeed(
        `frontier:ferment:military_envoy:${faction.id}`,
        `先见${faction.name}派来探口风的人`,
        'action:diplomacy:salon',
        'diplomacy',
        {
          type: 'visit',
          actionMode: 'salon',
          summary: `${faction.name}多半不会只在远处看着，探口风、递条件或试你边界的人很快就会先一步找来。`,
          reason: '军情一起，最先上门的往往不是敌军，而是来试你价码的人。',
          domain: '势力',
          risk: 'medium',
          recommendedKinds: ['diplomacy', 'investigate', 'military'],
          targetId: faction.id,
          targetName: faction.name,
          cityId,
          cityName,
          outcomes: ['faction', 'plot', 'warpath'],
          noveltyKey: `ferment:military_envoy:${faction.id}`,
          hint: '先见来人，可以比等下一封军报更早摸到对方意图。',
          weight: 89
        }
      ));
    }
    seeds.push(buildSeed(
      `frontier:ferment:military_stabilize:${cityId || 'nowhere'}`,
      '把这一手军情压实',
      'action:military:garrison',
      'military',
      {
        actionMode: 'garrison',
        summary: '先把城防、哨位和部曲秩序压实，免得眼前赢了声势，下一回却输在空档。',
        reason: '大战后的空档最容易被人钻。',
        domain: '军旅',
        risk: 'medium',
        recommendedKinds: ['military', 'govern'],
        cityId,
        cityName,
        outcomes: ['military', 'territory', 'stability'],
        noveltyKey: `ferment:military_stabilize:${cityId}`,
        hint: '让余波变成可用兵势，而不是只涨一阵声势。',
        weight: 79
      }
    ));
    threads.push({ title: '军情既起，真正决定后面战局的会是粮道、站位和谁先补上回手。', urgency: 3, domain: '军旅' });
  } else if (['intrigue', 'investigate'].includes(kind)) {
    headline = '暗线已经开始自己生长';
    summary = '你掀开的不再只是一个结果，而是一串会继续寻找出口的人和事。有人会灭口，有人会递话，也有人会反过来借你试探别家。';
    directorHint = '把暗线写成会继续长出新入口和反制手的链条，不要只把线索当一次性结果。';
    signals.push('这层暗线不会自己冷掉，反而会逼更多人表态。', '会有人先递密话、先遮旧账，也会有人夜里来探你到底知道了多少。');
    affectedDomains.push('谋略', '人物');
    actionBias.investigate = 14;
    actionBias.intrigue = 12;
    actionBias.social = 7;
    seeds.push(buildSeed(
      `frontier:ferment:shadow_followup:${cityId || 'nowhere'}`,
      '顺暗线追下一层人',
      'action:intrigue:counterspy',
      'intrigue',
      {
        actionMode: 'counterspy',
        summary: '先看谁开始急着收口、灭痕或反放消息，把暗线从结果重新追回到背后的人。',
        reason: '真正的幕后往往在你以为已经查到结果之后才开始露形。',
        domain: '谋略',
        risk: 'high',
        recommendedKinds: ['intrigue', 'investigate'],
        cityId,
        cityName,
        outcomes: ['plot', 'faction', 'countermove'],
        noveltyKey: `ferment:shadow_followup:${cityId}`,
        hint: '这一步会让暗线继续往深处长，而不是停在一句知道了。',
        weight: 90
      }
    ));
    seeds.push(buildSeed(
      `frontier:ferment:shadow_contact:${cityId || 'nowhere'}`,
      '等递话的人自己上门',
      'action:social:salon',
      'social',
      {
        actionMode: 'salon',
        summary: '你可以故意把风声放在半明半暗的位置，等真正有意的人先递一句能落地的话。',
        reason: '暗线摸到一定程度，人情往往会主动来找缝。',
        domain: '人物',
        risk: 'medium',
        recommendedKinds: ['social', 'intrigue'],
        cityId,
        cityName,
        outcomes: ['new_relation', 'plot', 'diplomacy'],
        noveltyKey: `ferment:shadow_contact:${cityId}`,
        hint: '不是散场，而是等对方先暴露站位。',
        weight: 78
      }
    ));
    seeds.push(buildSeed(
      `frontier:ferment:shadow_visit:${cityId || 'nowhere'}`,
      '见那个夜里来递话的人',
      'action:investigate:rumor',
      'investigate',
      {
        type: 'request',
        actionMode: 'rumor',
        summary: '这类暗线一热，真正知道点东西的人常常不会公开露面，而会挑夜里、偏门或第三方先来递一句话。',
        reason: '不是所有情报都要你主动去找，有些人会先来试你到底听到了多少。',
        domain: '谋略',
        risk: 'medium',
        recommendedKinds: ['investigate', 'social', 'intrigue'],
        cityId,
        cityName,
        outcomes: ['plot', 'countermove', 'new_relation'],
        noveltyKey: `ferment:shadow_visit:${cityId}`,
        hint: '先见来人，往往比继续在明面追风声更快摸到真口。',
        weight: 84
      }
    ));
    threads.push({ title: '暗线已经把几方人都逼得开始补口和试探，再不往下追，很快会被新烟幕盖住。', urgency: 3, domain: '谋略' });
  } else {
    affectedDomains.push('局势');
    actionBias.investigate = 6;
    actionBias.social = 5;
    seeds.push(buildSeed(
      `frontier:ferment:general_followup:${cityId || 'nowhere'}`,
      '看看谁先对这一手起反应',
      'action:investigate:archive',
      'investigate',
      {
        actionMode: 'archive',
        summary: '别急着换题，先看这一手落下去后，是谁先松口、递话、加价，或开始绕路试探你。',
        reason: '世界真正有趣的地方，往往在别人如何解读你刚才的动作。',
        domain: '局势',
        risk: 'low',
        recommendedKinds: ['investigate', 'social'],
        cityId,
        cityName,
        outcomes: ['plot', 'new_relation'],
        noveltyKey: `ferment:general_followup:${cityId}`,
        hint: '先接住余波，再决定下一回朝哪一层用力。',
        weight: 72
      }
    ));
    seeds.push(buildSeed(
      `frontier:ferment:general_visit:${cityId || 'nowhere'}`,
      '先去见那个主动找上门的人',
      'action:social:salon',
      'social',
      {
        type: 'visit',
        actionMode: 'salon',
        summary: '这一手落下后，最先有动作的未必是大势，而可能是某个识时务的人抢先来找你试一句口风。',
        reason: '世界会先把人推到你门前，再看你肯不肯接这只手。',
        domain: '人物',
        risk: 'low',
        recommendedKinds: ['social', 'investigate'],
        cityId,
        cityName,
        outcomes: ['new_relation', 'plot'],
        noveltyKey: `ferment:general_visit:${cityId}`,
        hint: '有人主动来找，说明这一手已经开始在别人心里生效。',
        weight: 76
      }
    ));
    threads.push({ title: '这一手不会只停在表面，接下来谁先递话、谁先躲开，本身就是局势的一部分。', urgency: 2, domain: '局势' });
  }

  if (Number(outcome && outcome.delta && outcome.delta.fatigue || 0) >= 8 || Number(state && state.gameState && state.gameState.fatigue || 0) >= 70) {
    signals.push('你这几回的消耗已经被旁人看在眼里，迟一点补气，别人就会把那点疲态当成可钻的缝。');
    threads.push({ title: '消耗已经挂在脸上了；若不及时调匀气力，后面的试探会更凶。', urgency: 2, domain: '养息' });
    actionBias.rest = Math.max(Number(actionBias.rest || 0), 7);
  }

  return {
    headline,
    summary,
    directorHint,
    heat,
    lastTurn: Number(state && state.world && state.world.turn || 0),
    lastActionKind: kind,
    lastActionMode: normalizeSnippet(action && action.mode || ''),
    affectedDomains: uniqueBy(affectedDomains.map((item) => ({ id: item })), (item) => item.id).map((item) => item.id),
    actionBias,
    signals: uniqueBy(signals.map((item) => ({ id: item })), (item) => item.id).map((item) => item.id).slice(0, 4),
    frontierSeeds: uniqueBy(seeds.filter(Boolean), (item) => item.id || `${item.title}:${item.localChoice && item.localChoice.actionText}`).slice(0, 5),
    threadSeeds: uniqueBy(threads.map((item) => normalizeThreadSeed(item)).filter(Boolean), (item) => item.title).slice(0, 4)
  };
}

function mergeOpenThreads(state, threadSeeds) {
  if (!state || !state.memory || !Array.isArray(state.memory.openThreads)) return;
  const existing = ensureList(state.memory.openThreads);
  const injected = ensureList(threadSeeds).map((item, index) => ({
    key: `ferment_${Number(state && state.world && state.world.turn || 0)}_${index}`,
    title: item.title,
    urgency: clamp(item.urgency, 1, 3),
    domain: item.domain || '局势'
  }));
  state.memory.openThreads = injected.concat(existing)
    .filter((item) => item && item.title)
    .filter((item, index, list) => list.findIndex((candidate) => candidate && candidate.title === item.title) === index)
    .slice(0, 8);
}

function applyWorldFermentation(state, action, outcome) {
  if (!state || !state.gameState || !state.world || state.world.phase !== 'playing') return null;
  if (!action || !action.kind) return null;
  if (String(action.kind) === 'battlecmd') return ensureWorldFermentationState(state.gameState);
  const next = buildGenericFermentation(state, action, outcome || {});
  state.gameState.worldFermentation = ensureWorldFermentationState(state.gameState);
  Object.assign(state.gameState.worldFermentation, next);
  mergeOpenThreads(state, next.threadSeeds);
  return state.gameState.worldFermentation;
}

module.exports = {
  ensureWorldFermentationState,
  summarizeWorldFermentationForPrompt,
  applyWorldFermentation
};
