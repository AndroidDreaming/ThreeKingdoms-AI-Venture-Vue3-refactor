const {
  buildPromptStateBundle: buildLegacyPromptStateBundle
} = require('./chronicleV5PromptStateBundle');

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

function clipText(value, maxChars) {
  const text = normalizeSnippet(value, '');
  if (!maxChars || text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, Math.max(0, maxChars));
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function buildStyleProfile(mode, actionKind, combat) {
  const battleRelated = !!(combat && (combat.active || combat.lastBattleReport))
    || ['battle', 'continuebattle', 'spar'].includes(String(actionKind || '').trim());
  const profile = {
    language: '简体中文',
    shared: {
      priorities: [
        '信息要准，不要贪多，只保留当回真正影响体验与选择的内容。',
        '时代感来自身份、秩序、风声、器物和人物口气，不来自现代解释。',
        '不要把状态字段翻成系统播报，也不要用空话代替具体处境。'
      ]
    },
    narration: {
      voice: '第一人称亲历，只写我此刻能见、能想、能做、能承受的东西。',
      prose: '句子要有旧时代叙事的筋骨与留白，克制而有重量，不要泛滥抒情。',
      sceneFocus: '优先写动作、阻力、判断、代价和回声，少写世界观导游式说明。',
      dialogue: '对白必须贴身份与场面，多试探、少解释，不写现代聊天感。',
      sensory: '环境细节要能落地，见风、潮气、灯火、泥水、甲叶、纸墨或人声。'
    },
    choice: {
      titleRule: '标题必须像玩家真的会点的行动，不能只剩抽象方向词。',
      differentiation: '三个选项要在玩法功能上明显不同，而不是同题换说法。',
      actionText: 'actionText 必须比标题更具体，直接说明这一步到底怎么做。',
      hint: 'hint 只补风险、代价、切口或预期阻力，不复述标题。',
      antiTemplate: '禁止把顺势、余波、落点、落账、压实、破局之类框架词直接写成标题骨架。'
    }
  };
  if (battleRelated) {
    profile.narration.battle = '若涉及交锋，笔力要写出招式、身法、气机、兵势与胜负余韵，带一点旧派武侠的劲道，但不要模仿名句。';
  }
  if (mode === 'choice') delete profile.narration.battle;
  return profile;
}

function cleanActor(actor) {
  const next = JSON.parse(JSON.stringify(actor || {}));
  const resources = next.resources || {};
  const dominant = String(resources.fatigueDominant || '').trim();
  const labels = {
    combat: '劳战',
    travel: '奔波',
    mental: '心神'
  };
  next.name = next.name || '无名之人';
  next.gender = next.gender || '未明';
  next.sect = next.sect || '无门无派';
  resources.fatigueProfile = dominant && labels[dominant] ? `${labels[dominant]}偏重` : '体气尚稳';
  next.resources = resources;
  return next;
}

function topActorStats(stats, limit = 3) {
  const labels = {
    governance: '内政',
    commerce: '经商',
    diplomacy: '外交',
    charm: '魅力',
    military: '军务',
    strategy: '谋略'
  };
  return Object.entries(stats || {})
    .map(([key, value]) => ({ key, label: labels[key] || key, value: Number(value || 0) }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit);
}

function buildAssetSummary(actor) {
  const resources = actor && actor.resources ? actor.resources : {};
  return [
    resources.troops > 0 ? `部曲${resources.troops}` : '',
    resources.coins > 0 ? `钱财${resources.coins}` : '',
    resources.supplies > 0 ? `粮秣${resources.supplies}` : '',
    resources.influence > 0 ? `影响${resources.influence}` : '',
    resources.renown > 0 ? `名望${resources.renown}` : ''
  ].filter(Boolean).slice(0, 5);
}

function buildVulnerabilitySummary(actor, map, localResolution) {
  const resources = actor && actor.resources ? actor.resources : {};
  const territory = map && map.territory ? map.territory : {};
  const tags = [];
  if (resources.morale > 0 && resources.morale <= 30) tags.push('士气偏低');
  if (resources.health > 0 && resources.health <= 45) tags.push('伤势不轻');
  if (resources.fatigueProfile) tags.push(resources.fatigueProfile);
  if (['fail', 'mixed'].includes(String(localResolution && localResolution.tier || '').trim())) tags.push('上一手未曾落稳');
  if (Number(territory.controlledCount || 0) <= 0 && Number(territory.governedCount || 0) <= 0) tags.push('尚无实控城池');
  return Array.from(new Set(tags)).slice(0, 4);
}

function summarizeRelationHooks(relations, limit = 4) {
  return ensureList(relations).slice(0, limit).map((item) => ({
    name: item && item.name ? item.name : '',
    title: item && item.title ? item.title : '',
    focus: clipText(item && (item.promptFocus || item.status || item.persona || ''), 40)
  }));
}

function summarizeFactionHooks(factions, limit = 3) {
  return [];
}

function buildNarrationTask(raw, action) {
  const retinue = raw && raw.retinue ? raw.retinue : {};
  const hasAssignments = Number(retinue.assignedCount || 0) > 0;
  const companionName = normalizeSnippet(retinue && retinue.companion && retinue.companion.name || '');
  const feedback = raw && raw.facts && raw.facts.lastRetinueFeedback ? raw.facts.lastRetinueFeedback : null;
  const mode = normalizeSnippet(action && action.mode || '');
  const retinueFocused = mode.startsWith('team_')
    || mode.startsWith('appoint_')
    || ['recruit', 'recruit_probe', 'retinue_talk', 'retinue_counsel', 'retinue_companion'].includes(mode);

  if (feedback && retinueFocused) {
    return '把队伍协同写成具体分工、场面回响与收益来处，但默认通过幕后献策、递消息、压后手和补位呈现，不要写成无关闲聊或整段抢戏。';
  }
  if (companionName) {
    return `把本回既成的得失、阻力与局势余波写成现场过程，并让同行的${companionName}顺着眼前事务自然给出一两次判断、提醒、动作或补位，不要让其空转成闲聊，更不要整段抢戏。`;
  }
  if (hasAssignments) {
    return '把本回已经裁定的阻力、得失、人物反应与局势余波真正写成过程，不要只报结果。若幕下已有任命，默认只让相关人手递上一两句判断、提醒、风声或回报，不要写成无端插话的长段对话。';
  }
  return '把本回已经裁定的阻力、得失、人物反应与局势余波真正写成过程，不要只报结果。';
}

function buildSharedFacts(raw, actor) {
  return {
    meta: {
      turn: Number(raw && raw.meta && raw.meta.turn || 0),
      phase: raw && raw.meta && raw.meta.phase ? raw.meta.phase : 'playing',
      date: raw && raw.meta && raw.meta.date ? raw.meta.date : '',
      year: Number(raw && raw.meta && raw.meta.year || 0),
      month: Number(raw && raw.meta && raw.meta.month || 0),
      city: raw && raw.meta && raw.meta.city ? raw.meta.city : '',
      region: raw && raw.meta && raw.meta.region ? raw.meta.region : '',
      weather: raw && raw.meta && raw.meta.weather ? raw.meta.weather : '',
      sceneTitle: raw && raw.meta && raw.meta.sceneTitle ? raw.meta.sceneTitle : '',
      sceneTail: normalizeSnippet(raw && raw.meta && raw.meta.sceneTail || '')
    },
    actor,
    action: {
      kind: raw && raw.meta && raw.meta.action && raw.meta.action.kind ? raw.meta.action.kind : '',
      mode: raw && raw.meta && raw.meta.action && raw.meta.action.mode ? raw.meta.action.mode : '',
      target: raw && raw.meta && raw.meta.action && raw.meta.action.target ? raw.meta.action.target : '',
      text: normalizeSnippet(raw && raw.meta && raw.meta.action && raw.meta.action.text || '')
    },
    localResolution: raw && raw.meta && raw.meta.localResolution ? raw.meta.localResolution : {},
    combat: raw && raw.combat ? raw.combat : { active: false, lastBattleReport: null },
    openThreads: ensureList(raw && raw.memory && raw.memory.threads).slice(0, 3).map((item) => ({
      title: normalizeSnippet(item && item.title || ''),
      urgency: Number(item && item.urgency || 0),
      domain: normalizeSnippet(item && item.domain || '')
    })),
    memoryFacts: ensureList(raw && raw.memory && raw.memory.facts).slice(0, 3).map((item) => normalizeSnippet(item)),
    location: {
      currentAuthority: raw && raw.map && raw.map.territory ? raw.map.territory.currentAuthority : '',
      governedCount: Number(raw && raw.map && raw.map.territory && raw.map.territory.governedCount || 0),
      controlledCount: Number(raw && raw.map && raw.map.territory && raw.map.territory.controlledCount || 0),
      cityCard: ensureList(raw && raw.map && raw.map.territory && raw.map.territory.cityCards).slice(0, 1)[0] || null,
      nearbyRoutes: ensureList(raw && raw.map && raw.map.nearbyRoutes).slice(0, 3)
    },
    relations: summarizeRelationHooks(raw && raw.relations, 4),
    factions: summarizeFactionHooks(raw && raw.factions, 3),
    historical: {
      active: raw && raw.historical && raw.historical.active ? raw.historical.active : '暂无正式起势的史势事件。',
      near: raw && raw.historical && raw.historical.near ? raw.historical.near : '',
      notableNpcs: clipText(raw && raw.historical && raw.historical.npcs || '', 120),
      last: raw && raw.historical && raw.historical.last ? raw.historical.last : ''
    },
    encounters: {
      last: raw && raw.encounters && raw.encounters.last ? raw.encounters.last : '',
      progress: raw && raw.encounters && raw.encounters.progress ? raw.encounters.progress : '',
      activeLeads: raw && raw.encounters && raw.encounters.activeLeads ? raw.encounters.activeLeads : ''
    },
    retinue: {
      readiness: normalizeSnippet(raw && raw.retinue && raw.retinue.readiness || ''),
      memberCount: Number(raw && raw.retinue && raw.retinue.memberCount || 0),
      assignedCount: Number(raw && raw.retinue && raw.retinue.assignedCount || 0),
      companion: raw && raw.retinue && raw.retinue.companion
        ? {
          name: raw.retinue.companion.name || '',
          roleName: raw.retinue.companion.roleName || ''
        }
        : null
    },
    worldSignals: {
      perception: {
        headline: normalizeSnippet(raw && raw.worldPerception && raw.worldPerception.headline || ''),
        summary: clipText(raw && raw.worldPerception && (raw.worldPerception.hiddenCurrent || raw.worldPerception.summary || ''), 120)
      },
      fermentation: {
        headline: normalizeSnippet(raw && raw.worldFermentation && raw.worldFermentation.headline || ''),
        summary: clipText(raw && raw.worldFermentation && raw.worldFermentation.summary || '', 120)
      },
      dramatic: {
        activeQuestion: normalizeSnippet(raw && raw.dramatic && raw.dramatic.activeQuestion || ''),
        latestResidue: ensureList(raw && raw.dramatic && raw.dramatic.sceneResidue).slice(0, 2).map((item) => clipText(item, 40))
      },
      directives: ensureList(raw && raw.directives).slice(0, 3).map((item) => clipText(item, 90))
    }
    // */
  };
}

function buildChoiceCapsule(raw, sharedFacts, actor) {
  const planning = raw && raw.planning ? raw.planning : { frontiers: [] };
  return {
    purpose: '只生成本回最值得点击的三个动态动作，让玩家感觉是在真正左右局势，而不是领取模板任务。',
    sceneConflict: clipText(
      sharedFacts.worldSignals.directives[0]
      || sharedFacts.localResolution.summary
      || sharedFacts.worldSignals.perception.headline
      || sharedFacts.worldSignals.fermentation.headline,
      120
    ),
    scenePressure: clipText(
      sharedFacts.worldSignals.directives[1]
      || sharedFacts.worldSignals.fermentation.summary
      || sharedFacts.historical.near
      || '',
      120
    ),
    aftermath: clipText(sharedFacts.meta.sceneTail || sharedFacts.localResolution.summary || '', 140),
    levers: {
      strengths: topActorStats(actor.stats, 3).map((item) => `${item.label}${item.value}`),
      assets: buildAssetSummary(actor),
      vulnerabilities: buildVulnerabilitySummary(actor, raw && raw.map, sharedFacts.localResolution),
      relationHooks: summarizeRelationHooks(raw && raw.relations, 3),
      factionHooks: summarizeFactionHooks(raw && raw.factions, 3),
      routeHooks: ensureList(raw && raw.map && raw.map.nearbyRoutes).slice(0, 3).map((item) => ({
        city: item && item.city ? item.city : '',
        route: item && item.route ? item.route : '',
        risk: item && item.risk ? item.risk : ''
      }))
    },
    worldSignals: {
      perception: clipText(sharedFacts.worldSignals.perception.summary || sharedFacts.worldSignals.perception.headline, 120),
      fermentation: clipText(sharedFacts.worldSignals.fermentation.summary, 120),
      historicalPressure: clipText(sharedFacts.historical.near || sharedFacts.historical.active, 90)
    },
    /*
      frontiers: ensureList(planning.frontiers).slice(0, 6).map((item) => ({
        id: item && item.id ? item.id : '',
        title: item && item.title ? item.title : '',
        summary: item && item.summary ? item.summary : '',
        reason: item && item.reason ? item.reason : '',
        domain: item && item.domain ? item.domain : '',
        risk: item && item.risk ? item.risk : '',
        slotBiases: ensureList(item && item.slotBiases),
        recommendedKinds: ensureList(item && item.recommendedKinds),
        targetName: item && item.targetName ? item.targetName : '',
        targetType: item && item.targetType ? item.targetType : '',
        source: item && item.source ? item.source : '',
        noveltyKey: item && item.noveltyKey ? item.noveltyKey : ''
      })),
      recentChoices: ensureList(planning.recentDynamicChoices).slice(0, 6).map((item) => ({
        text: item && item.text ? item.text : '',
        actionKind: item && item.actionKind ? item.actionKind : '',
        slotRole: item && item.slotRole ? item.slotRole : '',
        frontierId: item && item.frontierId ? item.frontierId : '',
        targetName: item && item.targetName ? item.targetName : '',
        noveltyKey: item && item.noveltyKey ? item.noveltyKey : ''
      })),
      selectedChoices: ensureList(planning.selectedDynamicChoices).slice(0, 4).map((item) => ({
        text: item && item.text ? item.text : '',
        actionKind: item && item.actionKind ? item.actionKind : '',
        slotRole: item && item.slotRole ? item.slotRole : '',
        targetName: item && item.targetName ? item.targetName : ''
      })),
      characterCards: ensureList(planning.characterCards).slice(0, 3).map((item) => ({
        name: normalizeSnippet(item && item.name || ''),
        title: normalizeSnippet(item && item.title || ''),
        summary: clipText(item && (item.summary || item.reason || ''), 48)
      }))
    },
    boundaries: {
      fixedActionDigest: ensureList(raw && raw.fixedActions).map((item) => `${item.category}:${item.text}`).slice(0, 10),
      avoidTemplatePhrases: ['接住余波', '寻某某落点', '把某事落账', '把某线压实', '借某类破局', '换条路撬开局'],
      remind: '若条件还不够，只能写成试探、铺垫、借势、旁敲或求援，不得把未完成条件直接写成完成态。'
    }
    */
  };
}

function buildNarrationCapsule(raw, sharedFacts) {
  return {
    purpose: '只把这一手已经裁定的事实写成正文过程，不替引擎补结算，不替未来预支结果。',
    task: buildNarrationTask(raw, sharedFacts.action),
    sceneConflict: clipText(sharedFacts.worldSignals.directives[0] || sharedFacts.localResolution.summary || '', 120),
    outcomeFrame: {
      tier: normalizeSnippet(sharedFacts.localResolution.tier || ''),
      summary: clipText(sharedFacts.localResolution.summary || '', 140),
      changeSummary: clipText(sharedFacts.localResolution.changeSummary || '', 100)
    },
    processFocus: ensureList([
      sharedFacts.worldSignals.directives[0],
      sharedFacts.worldSignals.directives[1],
      raw && raw.worldPerception && (raw.worldPerception.hiddenCurrent || raw.worldPerception.summary),
      raw && raw.worldFermentation && raw.worldFermentation.summary
    ]).filter(Boolean).map((item) => clipText(item, 110)).slice(0, 4),
    immediateRipple: {
      perceptionHeadline: normalizeSnippet(raw && raw.worldPerception && raw.worldPerception.headline || ''),
      perceptionSummary: clipText(raw && raw.worldPerception && (raw.worldPerception.hiddenCurrent || raw.worldPerception.summary || ''), 120),
      fermentationHeadline: normalizeSnippet(raw && raw.worldFermentation && raw.worldFermentation.headline || ''),
      fermentationSummary: clipText(raw && raw.worldFermentation && raw.worldFermentation.summary || '', 120),
      historicalPressure: clipText(sharedFacts.historical.near || sharedFacts.historical.active, 100)
    },
    sceneAnchors: {
      tail: clipText(sharedFacts.meta.sceneTail || '', 140),
      location: `${sharedFacts.meta.city || '此地'} / ${sharedFacts.meta.weather || '天气未明'}`,
      dramaticQuestion: normalizeSnippet(raw && raw.dramatic && raw.dramatic.activeQuestion || '')
    },
    involvedSides: {
      relations: summarizeRelationHooks(raw && raw.relations, 4),
      factions: summarizeFactionHooks(raw && raw.factions, 3)
    },
    battle: raw && raw.combat && raw.combat.active ? raw.combat : null,
    retinue: {
      readiness: normalizeSnippet(raw && raw.retinue && raw.retinue.readiness || ''),
      memberCount: Number(raw && raw.retinue && raw.retinue.memberCount || 0),
      assignedCount: Number(raw && raw.retinue && raw.retinue.assignedCount || 0),
      companion: raw && raw.retinue && raw.retinue.companion
        ? { name: raw.retinue.companion.name || '', roleName: raw.retinue.companion.roleName || '' }
        : null
    }
  };
}

function buildPromptStateBundle(state, action, outcome, mode = 'narration') {
  const raw = buildLegacyPromptStateBundle(state, action || {}, outcome || null, mode);
  const actor = cleanActor(raw && raw.actor);
  const sharedFacts = buildSharedFacts(raw, actor);
  const bundle = {
    mode,
    styleProfile: buildStyleProfile(mode, sharedFacts.action.kind, sharedFacts.combat),
    sharedFacts,
    constraints: {
      modelRole: mode === 'choice'
        ? '本地引擎负责状态记录、事实裁定、数值结算、解锁判断与固定玩法；模型只负责在限制内生成真正随剧情变化的动态规划型选项。'
        : '本地引擎负责状态记录、事实裁定与数值结算；模型只负责把既成事实写成有过程、有代价、有时代重量的正文。',
      hardLimits: [
        '不得改写本地已裁定的结果、收益、损失、关系变化与编制状态。',
        '不得输出后世书名、现代制度、现代口吻、穿越式旁白或跳出时代的视角。',
        '不得把固定操作盘已经稳定提供的个人动作、经营、养成、任命、队伍调度重新包装成动态选项。',
        '若条件不足，只能写成试探、铺垫、借势、旁敲或求援，不得直接写成完成态。'
      ],
      dynamicChoicePolicy: mode === 'choice'
        ? '动态选项只给边界，不给推荐；只需避开重复、越权、固定盘重叠和无上下文支撑的方向。'
        : '正文只负责把已发生的事实写得有代入感，不为生成动态选项服务，不要把正文写成前情提要或系统说明。'
    },
    contextBudget: {
      mode,
      targetChars: mode === 'choice' ? 6400 : 8200,
      strategy: 'focused-capsule'
    }
  };

  if (mode === 'choice') {
    bundle.choiceCapsule = buildChoiceCapsule(raw, sharedFacts, actor);
  } else {
    bundle.narrationCapsule = buildNarrationCapsule(raw, sharedFacts);
  }
  return bundle;
}

function shrinkPromptBundle(bundle) {
  const next = JSON.parse(JSON.stringify(bundle || {}));
  const mode = next && next.mode ? next.mode : 'narration';
  const targetChars = Number(next && next.contextBudget && next.contextBudget.targetChars || (mode === 'choice' ? 6400 : 8200));

  const trim = (path, maxChars) => {
    let ref = next;
    for (let index = 0; index < path.length - 1; index += 1) {
      if (!ref || typeof ref !== 'object') return;
      ref = ref[path[index]];
    }
    if (!ref || typeof ref !== 'object') return;
    ref[path[path.length - 1]] = clipText(ref[path[path.length - 1]], maxChars);
  };

  const sliceArray = (path, limit) => {
    let ref = next;
    for (let index = 0; index < path.length - 1; index += 1) {
      if (!ref || typeof ref !== 'object') return;
      ref = ref[path[index]];
    }
    if (!ref || typeof ref !== 'object') return;
    const key = path[path.length - 1];
    if (Array.isArray(ref[key])) ref[key] = ref[key].slice(0, limit);
  };

  if (mode === 'choice') {
    delete next.styleProfile.narration;
  } else {
    delete next.styleProfile.choice;
  }

  trim(['sharedFacts', 'meta', 'sceneTail'], mode === 'choice' ? 140 : 180);
  trim(['sharedFacts', 'historical', 'notableNpcs'], 90);
  trim(['sharedFacts', 'worldSignals', 'perception', 'summary'], 90);
  trim(['sharedFacts', 'worldSignals', 'fermentation', 'summary'], 90);
  sliceArray(['sharedFacts', 'openThreads'], 2);
  sliceArray(['sharedFacts', 'memoryFacts'], 2);
  sliceArray(['sharedFacts', 'relations'], mode === 'choice' ? 3 : 4);
  sliceArray(['sharedFacts', 'factions'], 3);
  sliceArray(['sharedFacts', 'location', 'nearbyRoutes'], 2);

  if (next.choiceCapsule) {
    trim(['choiceCapsule', 'sceneConflict'], 96);
    trim(['choiceCapsule', 'scenePressure'], 96);
    trim(['choiceCapsule', 'aftermath'], 120);
    trim(['choiceCapsule', 'worldSignals', 'perception'], 96);
    trim(['choiceCapsule', 'worldSignals', 'fermentation'], 96);
    trim(['choiceCapsule', 'worldSignals', 'historicalPressure'], 72);
    sliceArray(['choiceCapsule', 'levers', 'strengths'], 3);
    sliceArray(['choiceCapsule', 'levers', 'assets'], 4);
    sliceArray(['choiceCapsule', 'levers', 'vulnerabilities'], 3);
    sliceArray(['choiceCapsule', 'levers', 'relationHooks'], 3);
    sliceArray(['choiceCapsule', 'levers', 'factionHooks'], 3);
    sliceArray(['choiceCapsule', 'levers', 'routeHooks'], 2);
    delete next.choiceCapsule.planning;
    delete next.choiceCapsule.boundaries;
    delete next.choiceCapsule.frontiers;
    delete next.choiceCapsule.recentChoices;
    delete next.choiceCapsule.selectedChoices;
    delete next.choiceCapsule.characterCards;
  }

  if (next.narrationCapsule) {
    trim(['narrationCapsule', 'task'], 96);
    trim(['narrationCapsule', 'sceneConflict'], 96);
    trim(['narrationCapsule', 'outcomeFrame', 'summary'], 120);
    trim(['narrationCapsule', 'outcomeFrame', 'changeSummary'], 80);
    sliceArray(['narrationCapsule', 'processFocus'], 3);
    trim(['narrationCapsule', 'immediateRipple', 'perceptionSummary'], 100);
    trim(['narrationCapsule', 'immediateRipple', 'fermentationSummary'], 100);
    trim(['narrationCapsule', 'immediateRipple', 'historicalPressure'], 80);
    trim(['narrationCapsule', 'sceneAnchors', 'tail'], 120);
    sliceArray(['narrationCapsule', 'involvedSides', 'relations'], 3);
    sliceArray(['narrationCapsule', 'involvedSides', 'factions'], 3);
  }

  let json = JSON.stringify(next);
  if (json.length <= targetChars) return next;

  sliceArray(['sharedFacts', 'relations'], 2);
  sliceArray(['sharedFacts', 'factions'], 2);
  sliceArray(['sharedFacts', 'openThreads'], 1);
  if (next.narrationCapsule) {
    sliceArray(['narrationCapsule', 'processFocus'], 2);
    delete next.narrationCapsule.retinue;
  }

  json = JSON.stringify(next);
  if (json.length <= targetChars) return next;

  delete next.sharedFacts.encounters;
  delete next.sharedFacts.memoryFacts;
  if (next.narrationCapsule) {
    delete next.narrationCapsule.battle;
    delete next.narrationCapsule.involvedSides;
  }
  return next;
}

function stringifyPromptStateBundle(bundle) {
  return JSON.stringify(shrinkPromptBundle(bundle), null, 2);
}

module.exports = {
  buildPromptStateBundle,
  stringifyPromptStateBundle
};
