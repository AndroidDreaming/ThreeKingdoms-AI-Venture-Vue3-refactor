const { isRelationMet } = require('./chronicleV5RelationVisibility');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function looksLikeInternalEntityId(value) {
  return /^(?:extra|npc|relation|faction|sect|city)_[\w-]+$/i.test(String(value || '').trim());
}

function encounterDisplayName(first) {
  const name = String(first && first.name || '').trim();
  if (name && !looksLikeInternalEntityId(name)) return name;
  const title = String(first && first.title || '').trim();
  if (title && !looksLikeInternalEntityId(title)) return title;
  return '这号人物';
}

function normalizeEncounterName(name, fallback = '这号人物') {
  const value = String(name || '').trim();
  if (!value || looksLikeInternalEntityId(value)) return fallback;
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneDelta(delta) {
  return Object.keys(delta || {}).reduce((result, key) => {
    const value = Number(delta[key] || 0);
    if (!value) return result;
    result[key] = value;
    return result;
  }, {});
}

function mergeDelta(base, patch) {
  const next = cloneDelta(base || {});
  Object.keys(patch || {}).forEach((key) => {
    const value = Number(patch[key] || 0);
    if (!value) return;
    next[key] = Number(next[key] || 0) + value;
  });
  return next;
}

function createEncounterState() {
  return {
    progress: {
      travelDiscovery: 0,
      contactDiscovery: 0,
      historyIntervention: 0,
      masterGuidance: 0,
      desperateBreakthrough: 0,
      sectCipher: 0
    },
    breakthroughMarks: 0,
    cooldowns: {},
    activeLeads: [],
    history: [],
    characterPacing: {
      lastFormalTurn: 0,
      lastRumorTurn: 0
    },
    lastEncounterId: '',
    lastEncounterTitle: '',
    lastEncounterSummary: '',
    romanceArc: {
      targetId: '',
      targetName: '',
      stage: '未启',
      momentum: 0,
      vowCount: 0,
      sharedTrials: 0,
      dailyCount: 0,
      jealousyResolved: 0,
      supportLevel: 0,
      lastTurn: 0,
      lastSummary: ''
    },
    jianghuArc: {
      rank: '初入江湖',
      momentum: 0,
      rumor: 0,
      clueCount: 0,
      rivalId: '',
      rivalName: '',
      lastTurn: 0,
      lastSummary: ''
    }
  };
}

function ensureEncounterState(state) {
  const gs = state.gameState || {};
  if (!gs.encounters || typeof gs.encounters !== 'object') {
    gs.encounters = createEncounterState();
  }
  const encounters = gs.encounters;
  if (!encounters.progress || typeof encounters.progress !== 'object') encounters.progress = createEncounterState().progress;
  if (!Number.isFinite(Number(encounters.breakthroughMarks))) encounters.breakthroughMarks = 0;
  if (!encounters.cooldowns || typeof encounters.cooldowns !== 'object') encounters.cooldowns = {};
  if (!Array.isArray(encounters.activeLeads)) encounters.activeLeads = [];
  if (!Array.isArray(encounters.history)) encounters.history = [];
  if (!encounters.characterPacing || typeof encounters.characterPacing !== 'object') {
    encounters.characterPacing = createEncounterState().characterPacing;
  }
  if (!Number.isFinite(Number(encounters.characterPacing.lastFormalTurn))) encounters.characterPacing.lastFormalTurn = 0;
  if (!Number.isFinite(Number(encounters.characterPacing.lastRumorTurn))) encounters.characterPacing.lastRumorTurn = 0;
  if (typeof encounters.lastEncounterId !== 'string') encounters.lastEncounterId = '';
  if (typeof encounters.lastEncounterTitle !== 'string') encounters.lastEncounterTitle = '';
  if (typeof encounters.lastEncounterSummary !== 'string') encounters.lastEncounterSummary = '';
  if (!encounters.romanceArc || typeof encounters.romanceArc !== 'object') encounters.romanceArc = createEncounterState().romanceArc;
  if (!Number.isFinite(Number(encounters.romanceArc.dailyCount))) encounters.romanceArc.dailyCount = 0;
  if (!Number.isFinite(Number(encounters.romanceArc.jealousyResolved))) encounters.romanceArc.jealousyResolved = 0;
  if (!encounters.jianghuArc || typeof encounters.jianghuArc !== 'object') encounters.jianghuArc = createEncounterState().jianghuArc;
  return encounters;
}

function touchCooldown(encounters, key, turn) {
  encounters.cooldowns[key] = Number(turn || 0);
}

function cooldownReady(encounters, key, turn, gap) {
  return Number(turn || 0) - Number(encounters.cooldowns[key] || 0) >= Number(gap || 0);
}

function recordEncounter(encounters, entry, turn) {
  encounters.lastEncounterId = entry.id || '';
  encounters.lastEncounterTitle = entry.title || '';
  encounters.lastEncounterSummary = entry.summary || '';
  encounters.history = [{
    turn: Number(turn || 0),
    id: entry.id || '',
    title: entry.title || '',
    summary: entry.summary || '',
    domain: entry.domain || ''
  }].concat(ensureList(encounters.history).filter((item) => item && item.summary !== entry.summary)).slice(0, 8);
}

function upsertLead(state, lead) {
  if (!lead || !lead.text || !lead.actionText) return;
  const encounters = ensureEncounterState(state);
  const turn = Number(state.world && state.world.turn) || 0;
  const entry = {
    ...lead,
    id: lead.id || `encounter:${encodeURIComponent(lead.text)}`,
    expiresTurn: Number(lead.expiresTurn || (turn + 3)),
    source: 'dynamic',
    category: lead.category || '奇遇'
  };
  encounters.activeLeads = [entry]
    .concat(ensureList(encounters.activeLeads).filter((item) => item && item.id !== entry.id && Number(item.expiresTurn || 0) >= turn))
    .slice(0, 6);
}

function rankOfJianghuArc(gs, arc) {
  const score = Number(gs.jianghuPrestige || 0) + Number(arc.momentum || 0) * 4 + Number(arc.clueCount || 0) * 3;
  if (score >= 160) return '天下闻名';
  if (score >= 100) return '名动一方';
  if (score >= 56) return '江湖成名';
  if (score >= 24) return '小有风声';
  return '初入江湖';
}

function relationFavorScore(relation) {
  if (!relation) return 0;
  const trust = Number(relation.trust || 0);
  const affection = Number(relation.affection || 0);
  const loyalty = Number(relation.loyalty || 0);
  const rivalry = Number(relation.rivalry || 0);
  return clamp(Math.round(trust * 0.5 + affection * 1.2 + loyalty * 0.35 - rivalry * 0.85), 0, 100);
}

function visibleMartialRelations(state) {
  return ensureList(state.gameState && state.gameState.relationships)
    .filter((item) => item && isRelationMet(item))
    .filter((item) => Number(item.martialRating || 0) > 0 || ensureList(item.tags).some((tag) => ['martial', 'battle', 'warpath', 'frontier'].includes(tag)));
}

function pickJianghuRival(state, preferredRelation) {
  if (preferredRelation && preferredRelation.name) {
    return {
      id: preferredRelation.id || '',
      name: normalizeEncounterName(preferredRelation.name, encounterDisplayName(preferredRelation))
    };
  }
  const list = visibleMartialRelations(state)
    .filter((item) => item && item.bondKey !== 'lover')
    .slice()
    .sort((a, b) => Number(b.rivalry || 0) - Number(a.rivalry || 0));
  if (list.length) {
    return {
      id: list[0].id || '',
      name: normalizeEncounterName(list[0].name, encounterDisplayName(list[0]))
    };
  }
  return {
    id: '',
    name: `${(state.world && state.world.currentCityName) || '此地'}一名成名高手`
  };
}

function buildEncounterNarrativeBundle(state) {
  const encounters = ensureEncounterState(state);
  const romanceArc = encounters.romanceArc || {};
  const jianghuArc = encounters.jianghuArc || {};
  return {
    lastSummary: encounters.lastEncounterSummary || '暂时还没有新的奇遇回响。',
    progressText: [
      `旅行奇遇${Number(encounters.progress.travelDiscovery || 0)}`,
      `人物照面${Number(encounters.progress.contactDiscovery || 0)}`,
      `历史接入${Number(encounters.progress.historyIntervention || 0)}`,
      `宗师点拨${Number(encounters.progress.masterGuidance || 0)}`,
      `绝境破限${Number(encounters.progress.desperateBreakthrough || 0)}`,
      `门派秘闻${Number(encounters.progress.sectCipher || 0)}`,
      `破限记号${Number(encounters.breakthroughMarks || 0)}`
    ].join('，'),
    romanceText: romanceArc.targetName
      ? `${romanceArc.targetName}：阶段${romanceArc.stage || '未启'}，势能${Number(romanceArc.momentum || 0)}，共历${Number(romanceArc.sharedTrials || 0)}次，日常${Number(romanceArc.dailyCount || 0)}次，安抚${Number(romanceArc.jealousyResolved || 0)}次。`
      : '情感线暂时还没有固定对象或成形支点。',
    jianghuText: `当前江湖段位${jianghuArc.rank || '初入江湖'}，声势${Number(jianghuArc.momentum || 0)}，线索${Number(jianghuArc.clueCount || 0)}${jianghuArc.rivalName ? `，当前咬住的对手是${jianghuArc.rivalName}` : ''}。`,
    activeLeads: ensureList(encounters.activeLeads)
      .slice(0, 4)
      .map((item) => `${item.text}(${item.hint || '顺着奇遇继续推进'})`)
      .join('，') || '暂时没有挂在眼前的奇遇后手。'
  };
}

function buildEncounterChoiceLeads(state) {
  const encounters = ensureEncounterState(state);
  const turn = Number(state.world && state.world.turn) || 0;
  return ensureList(encounters.activeLeads)
    .filter((item) => item && item.text && item.actionText && Number(item.expiresTurn || 0) >= turn)
    .slice(0, 4)
    .map((item, index) => ({
      ...item,
      id: item.id || `encounter:${index}`,
      order: index,
      source: 'dynamic'
    }));
}

function buildUnlockedCharacterEncounterBundle(action, world, first, context = {}) {
  const name = encounterDisplayName(first);
  const revealState = String(first && first.revealState || 'met').trim();
  const rumorReveal = revealState === 'rumor';
  const relationTarget = first && first.id ? {
    target: first.id,
    targetName: name,
    targetType: 'relation'
  } : {};
  const martialLean = ensureList(first && first.tags).some((tag) => ['martial', 'jianghu'].includes(tag));

  if (rumorReveal) {
    const rumorLead = {
      id: `encounter:rumor:${first.id || encodeURIComponent(name)}`,
      text: `把${name}从风闻里请出来`,
      actionText: `先去收拢关于${name}的零碎说法，把来历、落脚处和真实立场拼成一张能用的人物面目，再决定要不要亲自接近。`,
      actionKind: 'investigate',
      actionMode: 'follow_relation_lead',
      relationScope: 'general',
      hint: '名字已经传开了，真正值钱的是把传闻收成可落手的那一面。',
      ...relationTarget
    };

    if (action.kind === 'travel') {
      return {
        progressKey: 'travelDiscovery',
        delta: { influence: 1, diplomacy: 1 },
        title: '行路风闻',
        domain: '行路',
        summary: `${world.currentCityName || '此地'}这一趟没有白走。我在城中与路上的人声里第一次听见了${name}，眼下还隔着传闻，却已经露出一条能继续追下去的门路。`,
        lead: rumorLead
      };
    }

    if (['jianghu', 'spar', 'martial'].includes(action.kind)) {
      return {
        progressKey: 'contactDiscovery',
        delta: { renown: 1, influence: 1 },
        title: '江湖风闻',
        domain: '江湖',
        summary: `${name}先是顺着江湖口风飘进了我的耳朵。我还没有真正和此人照面，但这股风声已经足够把下一步追查、试探或拜会逼到眼前。`,
        lead: Object.assign({}, rumorLead, {
          text: `循名去找${name}`,
          hint: martialLean ? '江湖上既然有人提起他，多半已经留下招牌和去处。' : rumorLead.hint
        })
      };
    }

    if (['military', 'warpath', 'battle'].includes(action.kind)) {
      return {
        progressKey: 'contactDiscovery',
        delta: { influence: 1, military: 1 },
        title: '军中风闻',
        domain: '军旅',
        summary: `军中这一手没有白落。有人提起了${name}，可如今还只是营里和市井之间的风声，得继续摸清此人的落点、门路和能量。`,
        lead: Object.assign({}, rumorLead, {
          text: `把${name}的底细掂明`,
          hint: '军中的名字不能只听半句，摸清门路之后再接近才不会扑空。'
        })
      };
    }

    if (['sect', 'joinsect'].includes(action.kind)) {
      const sectName = context.sectName || '门中';
      return {
        progressKey: 'contactDiscovery',
        delta: { influence: 1, sectFavor: 1 },
        title: '门中风闻',
        domain: '门派',
        summary: `${sectName}这一线刚松动，${name}也随之在门中口风里浮了出来。如今还只是传闻，但已经足够顺着这条线继续摸人。`,
        lead: Object.assign({}, rumorLead, {
          text: `顺门中旧话找${name}`,
          hint: '门中的旧话最会藏人，先找到脉络，再决定往哪边靠。'
        })
      };
    }
  }

  if (action.kind === 'travel') {
    return {
      progressKey: 'travelDiscovery',
      delta: { influence: 1, diplomacy: 1 },
      title: '旅途奇遇',
      domain: '行路',
      summary: `${world.currentCityName || '此地'}这一程没有白走。我在路上撞见了新的门路，连带着人物、人情与暗面的入口一起露了出来。`,
      lead: {
        id: `encounter:travel:${first.id || encodeURIComponent(name)}`,
        text: `趁旅途余温去见${name}`,
        actionText: `趁着路上这层缘分还热，主动去见${name}，把刚撞出来的人情和门路接成真正的往来。`,
        actionKind: 'social',
        actionMode: 'visit',
        relationScope: 'general',
        hint: '旅行奇遇已经把人和门路送到眼前，最好的做法就是立刻承接。',
        ...relationTarget
      }
    };
  }

  if (['jianghu', 'spar', 'martial'].includes(action.kind)) {
    return {
      progressKey: 'contactDiscovery',
      delta: { renown: 1, influence: 1 },
      title: '江湖照面',
      domain: '江湖',
      summary: `这一回江湖上的动静没有白起。${name}顺着风声走进了我的视线，我也终于有机会亲手去碰这条新露出来的门路。`,
      lead: {
        id: `encounter:contact:${first.id || encodeURIComponent(name)}`,
        text: martialLean ? `去接${name}这一手` : `把${name}请到台前`,
        actionText: martialLean ? `去找${name}碰一碰，看他是要与你试手，还是肯把更深一层的江湖门路递出来。` : `去见${name}，把这个名字背后的来路、站位与能量当面看清。`,
        actionKind: martialLean ? 'spar' : 'social',
        actionMode: martialLean ? 'spar' : 'visit',
        relationScope: martialLean ? 'martial' : 'general',
        hint: '人已经浮到台前，此时接上，最容易长出对手、盟友或新的门路。',
        ...relationTarget
      }
    };
  }

  if (['military', 'warpath', 'battle'].includes(action.kind)) {
    return {
      progressKey: 'contactDiscovery',
      delta: { influence: 1, military: 1 },
      title: '军中照面',
      domain: '军旅',
      summary: `这一回的兵气和锋芒也没有白落。${name}被这一手牵进了我的视线，军中的门路终于开始对我有了回声。`,
      lead: {
        id: `encounter:contact:${first.id || encodeURIComponent(name)}`,
        text: `见${name}`,
        actionText: `去见${name}，看看能不能把军中的门路、人手或前哨差事从他手里接过来`,
        actionKind: 'social',
        actionMode: 'visit',
        relationScope: 'general',
        hint: '军旅线刚开口，先把认得我的那个人扣住，后面才有战功和部曲。',
        ...relationTarget
      }
    };
  }

  if (['sect', 'joinsect'].includes(action.kind)) {
    const sectName = context.sectName || '门中';
    return {
      progressKey: 'contactDiscovery',
      delta: { influence: 1, sectFavor: 1 },
      title: '门中照面',
      domain: '门派',
      summary: `${sectName}这一线刚一松动，${name}也跟着走进了我的关系谱。门里门外终于有了可以继续顺下去的人。`,
      lead: {
        id: `encounter:contact:${first.id || encodeURIComponent(name)}`,
        text: `借门中口风去见${name}`,
        actionText: `借着门中刚松开的口风去见${name}，把这层来路、人情和立场当面坐实。`,
        actionKind: 'social',
        actionMode: 'visit',
        relationScope: 'general',
        hint: '新开的门派门路最该立刻接住，晚了就可能被别人先占掉位置。',
        ...relationTarget
      }
    };
  }

  return {
    progressKey: 'contactDiscovery',
    delta: { influence: 1 },
    title: '人物照面',
    domain: '人物',
    summary: `${name}在这一手之后被牵进了我的视线。人既然已经露面，就该趁热把这层关系往前接实。`,
    lead: {
      id: `encounter:contact:${first.id || encodeURIComponent(name)}`,
      text: `顺势再见${name}`,
      actionText: `立刻再去见${name}，把这次碰出来的口风、筹码和人情压成一层真正能用的关系。`,
      actionKind: 'social',
      actionMode: 'visit',
      relationScope: 'general',
      hint: '新人已经露面，这时接上最容易把人情变成真正站位。',
      ...relationTarget
    }
  };
}

function resolveEncounterOutcome(state, context = {}) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const turn = Number(world.turn || 0);
  const action = context.action || {};
  const outcome = context.outcome || {};
  const relation = context.relation || null;
  const encounters = ensureEncounterState(state);
  let delta = {};
  const lines = [];

  if (
    outcome.tier !== 'fail'
    && Array.isArray(context.unlockedCharacters)
    && context.unlockedCharacters.length
  ) {
    const bundle = buildUnlockedCharacterEncounterBundle(action, world, context.unlockedCharacters[0], context);
    encounters.progress[bundle.progressKey] = Number(encounters.progress[bundle.progressKey] || 0) + 1;
    delta = mergeDelta(delta, bundle.delta || {});
    recordEncounter(encounters, {
      id: action.kind === 'travel' ? 'travel_discovery' : 'contact_discovery',
      title: bundle.title,
      summary: bundle.summary,
      domain: bundle.domain
    }, turn);
    upsertLead(state, bundle.lead);
    lines.push(bundle.summary);
  } else if (
    action.kind === 'travel'
    && outcome.tier !== 'fail'
    && cooldownReady(encounters, `travel:${world.currentCityId}`, turn, 3)
  ) {
    touchCooldown(encounters, `travel:${world.currentCityId}`, turn);
    upsertLead(state, {
      id: `encounter:travel:clue:${world.currentCityId || 'city'}`,
      text: '先摸这座城的暗面',
      actionText: `去把${world.currentCityName || '此地'}新露出来的人情、旧怨和暗面入口看清，找出这座城真正藏着机会的地方。`,
      actionKind: 'investigate',
      actionMode: 'city_clue',
      hint: '一座城最值钱的从来不只在街面上，先认清暗面，后手才会自己冒头。'
    });
  }

  if (
    ensureList(gs.historical && gs.historical.activeEventIds).length
    && outcome.tier !== 'fail'
    && ['diplomacy', 'social', 'investigate', 'intrigue', 'travel', 'warpath', 'govern'].includes(action.kind)
    && cooldownReady(encounters, 'history_intervention', turn, 1)
  ) {
    touchCooldown(encounters, 'history_intervention', turn);
    encounters.progress.historyIntervention = Number(encounters.progress.historyIntervention || 0) + 1;
    delta = mergeDelta(delta, { influence: 1, strategy: 1, renown: action.kind === 'warpath' ? 1 : 0 });
    const summary = '这一手已经不只是顺着眼前局势往前挪，我是真把手伸进了正在起势的大事里。史势开始记住我这一落。';
    recordEncounter(encounters, {
      id: 'history_intervention',
      title: '史势接入',
      summary,
      domain: '史势'
    }, turn);
    lines.push(summary);
  }

  if (
    relation
    && outcome.tier !== 'fail'
    && (
      (action.kind === 'martial' && action.mode === 'mentor' && Number(relation.martialRating || 0) >= 88)
      || (action.kind === 'investigate' && action.mode === 'counsel' && Number(relation.strategyRating || 0) >= 88)
    )
    && cooldownReady(encounters, `guidance:${relation.id}:${action.kind}`, turn, 2)
  ) {
    touchCooldown(encounters, `guidance:${relation.id}:${action.kind}`, turn);
    encounters.progress.masterGuidance = Number(encounters.progress.masterGuidance || 0) + 1;
    const martialGuidance = action.kind === 'martial';
    delta = mergeDelta(delta, martialGuidance
      ? { martialInsight: Number(relation.martialRating || 0) >= 95 ? 3 : 2, renown: relation.isHistorical ? 1 : 0 }
      : { strategy: Number(relation.strategyRating || 0) >= 95 ? 2 : 1, influence: 1 });
    if (martialGuidance) {
      encounters.breakthroughMarks = Number(encounters.breakthroughMarks || 0) + 1;
    }
    const summary = martialGuidance
      ? `${relation.name}这一回给我的不再只是表面招式，而是一段真正能让我少走弯路的宗师点拨。`
      : `${relation.name}把藏得更深的一层判断递给了我，这已经算得上真正的宗师点拨。`;
    recordEncounter(encounters, {
      id: martialGuidance ? 'master_guidance_martial' : 'master_guidance_strategy',
      title: '宗师点拨',
      summary,
      domain: martialGuidance ? '武学' : '谋略'
    }, turn);
    lines.push(summary);
  }

  if (
    ['battle', 'jianghu', 'warpath', 'martial'].includes(action.kind)
    && Number(gs.martialLevel || 0) >= 76
    && (Number(gs.health || 0) <= 38 || Number(gs.fatigue || 0) >= 24 || outcome.tier === 'fail')
    && cooldownReady(encounters, 'desperate_breakthrough', turn, 1)
  ) {
    touchCooldown(encounters, 'desperate_breakthrough', turn);
    encounters.progress.desperateBreakthrough = Number(encounters.progress.desperateBreakthrough || 0) + 1;
    encounters.breakthroughMarks = Number(encounters.breakthroughMarks || 0) + (outcome.tier === 'fail' ? 1 : 2);
    delta = mergeDelta(delta, { martialInsight: 1, morale: outcome.tier === 'fail' ? 0 : 1 });
    const summary = '我这一步是顶着真实的伤、疲与险硬撑出来的。也正因如此，那层原本摸不着的更高门槛反而被我撞出了一道细缝。';
    recordEncounter(encounters, {
      id: 'desperate_breakthrough',
      title: '绝境破限',
      summary,
      domain: '武学'
    }, turn);
    lines.push(summary);
  }

  if (
    ['sect', 'joinsect'].includes(action.kind)
    && (gs.sectId || context.sectId)
    && outcome.tier !== 'fail'
    && ((Number(gs.sectFavor || 0) >= 12) || (Number(gs.sectPower || 0) >= 8) || action.kind === 'joinsect')
    && cooldownReady(encounters, `sect_cipher:${gs.sectId || context.sectId}`, turn, 2)
  ) {
    const sectId = gs.sectId || context.sectId || '';
    const sectName = gs.sectName || context.sectName || '门中';
    touchCooldown(encounters, `sect_cipher:${sectId}`, turn);
    encounters.progress.sectCipher = Number(encounters.progress.sectCipher || 0) + 1;
    delta = mergeDelta(delta, { strategy: 1, martialInsight: 1, sectPower: 1 });
    const summary = `${sectName}这一回像是终于肯让我摸到一点真正压箱底的门派秘闻。师承、旧账和传承的路数，都开始露出更深的一层。`;
    recordEncounter(encounters, {
      id: 'sect_cipher',
      title: '门派秘闻',
      summary,
      domain: '门派'
    }, turn);
    upsertLead(state, {
      id: `encounter:sect:cipher:${sectId || 'unknown'}`,
      text: `翻开${sectName}旧账`,
      actionText: `沿着${sectName}刚露出来的秘闻与旧账继续往里翻，看看真正的传承、旧怨和可借之势到底压在何处。`,
      actionKind: 'sect',
      actionMode: 'cipher',
      hint: '压箱底的东西既然露出一角，再翻一页，往往就能见到真骨头。'
    });
    lines.push(summary);
  }

  if (
    action.kind !== 'romance'
    && encounters.romanceArc
    && encounters.romanceArc.targetName
    && Number(encounters.romanceArc.sharedTrials || 0) >= 1
    && outcome.tier !== 'fail'
    && ['battle', 'warpath', 'jianghu', 'investigate', 'travel', 'social', 'diplomacy'].includes(action.kind)
  ) {
    const support = Number(encounters.romanceArc.sharedTrials || 0) >= 2 ? 2 : 1;
    delta = mergeDelta(delta, { morale: support, influence: support >= 2 ? 1 : 0 });
  }

  return {
    delta,
    lines
  };
}

function advanceEncounterArcs(state, context = {}) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const action = context.action || {};
  const tier = context.tier || 'mixed';
  const relation = context.relation || null;
  const encounters = ensureEncounterState(state);
  const lines = [];

  if (action.kind === 'romance' && relation) {
    const arc = encounters.romanceArc;
    if (arc.targetId && arc.targetId !== relation.id && Number(arc.sharedTrials || 0) < 2) {
      arc.momentum = Math.max(0, Number(arc.momentum || 0) - 2);
    }
    arc.targetId = relation.id || '';
    arc.targetName = relation.name || '';
    arc.lastTurn = Number(world.turn || 0);
    arc.momentum = clamp(Number(arc.momentum || 0) + (tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1), 0, 12);
    if (action.mode === 'promise' && tier !== 'fail') arc.vowCount = Number(arc.vowCount || 0) + 1;
    if (['bond', 'companion'].includes(action.mode) && tier !== 'fail') arc.sharedTrials = Number(arc.sharedTrials || 0) + 1;
    if (action.mode === 'daily' && tier !== 'fail') arc.dailyCount = Number(arc.dailyCount || 0) + 1;
    if (action.mode === 'jealousy' && tier !== 'fail') arc.jealousyResolved = Number(arc.jealousyResolved || 0) + 1;
    arc.supportLevel = clamp(Number(arc.vowCount || 0) + Number(arc.sharedTrials || 0) + Math.floor(Number(arc.dailyCount || 0) / 2), 0, 8);
    const nextStage = relation.bondKey === 'lover'
      ? (Number(arc.jealousyResolved || 0) >= 1 && Number(arc.sharedTrials || 0) >= 2 ? '风波已稳' : Number(arc.sharedTrials || 0) >= 2 ? '共担风雨' : Number(arc.dailyCount || 0) >= 2 ? '甜蜜日常' : '定情')
      : (relation.romanceStage || '未启');
    if ((arc.stage || '未启') !== nextStage) {
      lines.push(nextStage === '共担风雨'
        ? `${relation.name}不再只是让我心动的人，也开始成了能和我一起扛事的人。情感线真正走进了“共担风雨”的阶段。`
        : `${relation.name}这条情分的火候已经推到“${nextStage}”。它之后牵动的，就不只是一两句夜谈，而是整盘局里的站位与取舍。`);
    }
    arc.stage = nextStage;
    arc.lastSummary = arc.targetName
      ? `${arc.targetName}：阶段${arc.stage}，势能${arc.momentum}，共历${arc.sharedTrials}次，日常${Number(arc.dailyCount || 0)}次，安抚${Number(arc.jealousyResolved || 0)}次。`
      : '';
    if (arc.targetId && ['暧昧', '定情', '共担风雨'].includes(arc.stage)) {
      upsertLead(state, {
        id: `encounter:romance:${arc.targetId}:bond`,
        text: `与${arc.targetName}共担`,
        actionText: `找机会与${arc.targetName}把这段情分从私下靠近，推到真正能一起担事、一起扛风雨的方向`,
        actionKind: 'romance',
        actionMode: 'bond',
        target: arc.targetId,
        targetName: arc.targetName,
        targetType: 'relation',
        relationScope: 'romance',
        hint: '这条情感线已经不只是试探，可以把它推进成真正影响局势的关系支点。'
      });
    }
    if (arc.targetId && ['定情', '甜蜜日常', '共担风雨', '风波已稳'].includes(arc.stage)) {
      upsertLead(state, {
        id: `encounter:romance:${arc.targetId}:daily`,
        text: `陪${arc.targetName}过一段日常`,
        actionText: `陪${arc.targetName}把饭食、闲话、归途和小事认真过完，让这段关系不只靠大事推进，也能在日常里变稳`,
        actionKind: 'romance',
        actionMode: 'daily',
        target: arc.targetId,
        targetName: arc.targetName,
        targetType: 'relation',
        relationScope: 'romance',
        hint: '恋爱线进入稳定段后，日常相处会继续积累温度并降低疲惫。'
      });
      upsertLead(state, {
        id: `encounter:romance:${arc.targetId}:jealousy`,
        text: `安抚${arc.targetName}的酸意`,
        actionText: `把旁人的目光、旧情和争宠的酸意摊开说清，先稳住${arc.targetName}心里的不安`,
        actionKind: 'romance',
        actionMode: 'jealousy',
        target: arc.targetId,
        targetName: arc.targetName,
        targetType: 'relation',
        relationScope: 'romance',
        hint: '关系越深，旁人的目光越会成为支线压力，及时安抚能压低怨怼。'
      });
    }
  }

  if (['jianghu', 'spar', 'investigate', 'travel', 'battle'].includes(action.kind)) {
    const arc = encounters.jianghuArc;
    if (action.kind === 'jianghu' || action.kind === 'spar') {
      arc.momentum = clamp(Number(arc.momentum || 0) + (tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0), 0, 20);
      arc.rumor = clamp(Number(arc.rumor || 0) + (tier === 'great' ? 2 : 1), 0, 20);
      arc.lastTurn = Number(world.turn || 0);
      if (!arc.rivalName && (action.kind === 'spar' || Number(arc.momentum || 0) >= 4)) {
        const rival = pickJianghuRival(state, relation);
        arc.rivalId = rival.id || '';
        arc.rivalName = rival.name || '';
        if (arc.rivalName) {
          lines.push(`江湖线不再只是我一个人往前走了。${arc.rivalName}已经开始把我当成需要认真掂量的对手。`);
          upsertLead(state, {
            id: arc.rivalId ? `encounter:jianghu:rival:${arc.rivalId}` : `encounter:jianghu:rival:${encodeURIComponent(arc.rivalName)}`,
            text: arc.rivalId ? `把${arc.rivalName}逼上台面` : '循风声赴那场局',
            actionText: arc.rivalId
              ? `去找${arc.rivalName}，把这条已经起势的江湖较量真正推到台面上。`
              : `沿着${arc.rivalName}留下的风声继续追，看这条江湖线会把你带去哪里。`,
            actionKind: arc.rivalId ? 'spar' : 'investigate',
            actionMode: arc.rivalId ? 'spar' : 'jianghu_clue',
            target: arc.rivalId || '',
            targetName: arc.rivalName || '',
            targetType: arc.rivalId ? 'relation' : '',
            relationScope: arc.rivalId ? 'martial' : '',
            hint: '江湖线上已经长出明确对手或名号，顺势追上去，才容易形成完整闭环。'
          });
        }
      }
    }
    if (action.kind === 'investigate' && action.mode === 'jianghu_clue' && tier !== 'fail') {
      arc.clueCount = clamp(Number(arc.clueCount || 0) + 1, 0, 12);
      if (arc.rivalName) {
        upsertLead(state, {
          id: arc.rivalId ? `encounter:jianghu:clue:${arc.rivalId}` : `encounter:jianghu:clue:${encodeURIComponent(arc.rivalName)}`,
          text: arc.rivalId ? `约${arc.rivalName}出手` : '照着线索赴会',
          actionText: arc.rivalId
            ? `去和${arc.rivalName}把这场迟早要打的江湖较量摆到明面上。`
            : '照着刚摸清的江湖线索赴会，把名声、对手和后续风波一并推开。',
          actionKind: arc.rivalId ? 'spar' : 'jianghu',
          actionMode: arc.rivalId ? 'spar' : '',
          target: arc.rivalId || '',
          targetName: arc.rivalName || '',
          targetType: arc.rivalId ? 'relation' : '',
          relationScope: arc.rivalId ? 'martial' : '',
          hint: '江湖线索已经摸到手里，最好立刻承接，不然风头很快就散。'
        });
      }
    }
    if (action.kind === 'travel' && gs.martialFocusId === 'jianghu' && tier !== 'fail') {
      arc.rumor = clamp(Number(arc.rumor || 0) + 1, 0, 20);
    }
    const nextRank = rankOfJianghuArc(gs, arc);
    if ((arc.rank || '初入江湖') !== nextRank) {
      lines.push(`江湖上的回声已经换了一层。我现在不再只是“${arc.rank || '初入江湖'}”，而是开始被人看作“${nextRank}”。`);
    }
    arc.rank = nextRank;
    arc.lastSummary = `${arc.rank}，声势${arc.momentum}，线索${arc.clueCount}${arc.rivalName ? `，对手${arc.rivalName}` : ''}。`;
  }

  return {
    lines
  };
}

function encounterBreakthroughMarks(state) {
  const encounters = ensureEncounterState(state);
  return Number(encounters.breakthroughMarks || 0);
}

module.exports = {
  createEncounterState,
  ensureEncounterState,
  resolveEncounterOutcome,
  advanceEncounterArcs,
  buildEncounterChoiceLeads,
  buildEncounterNarrativeBundle,
  encounterBreakthroughMarks
};


