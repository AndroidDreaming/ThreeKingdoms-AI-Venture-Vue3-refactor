const { BACKGROUNDS, INTENT_CONFIG, SCRIPTS } = require('./chronicleV2Constants');
const {
  advanceMonth,
  clamp,
  formatDateLabel,
  mergeItems,
  pickRandom,
  uniqBy,
  upsertRelationship
} = require('./chronicleV2Helpers');
const { applyBackground } = require('./chronicleV4StateFactory');
const { resolveAction, applyResolution } = require('./chronicleV4Resolver');

function nextStage(world) {
  const script = SCRIPTS.find((item) => item.id === world.scriptId);
  if (!script) return;
  const stageIndex = Math.min(script.stages.length - 1, Math.floor(world.turn / 4));
  world.stageIndex = stageIndex;
  world.stageName = script.stages[stageIndex];
}

function detectLoop(memory, intent) {
  const recent = memory.recentIntents.slice(-3);
  if (recent.length < 3) return false;
  return recent.every((item) => item.intent === intent);
}

function selectRomanceTarget(state) {
  const romanceables = state.gameState.relationships.filter((item) => item.romanceable);
  const current = romanceables.find((item) => item.id === state.memory.romanceTargetId);
  return current || romanceables[0] || null;
}

function getFaction(state, factionId) {
  return (state.gameState.factions || []).find((item) => item.id === factionId) || null;
}

function updateFaction(state, factionId, patch) {
  state.gameState.factions = (state.gameState.factions || []).map((item) => {
    if (item.id !== factionId) return item;
    const next = Object.assign({}, item);
    if (typeof patch.favor === 'number') next.favor = clamp(next.favor + patch.favor, -100, 100);
    if (typeof patch.hostility === 'number') next.hostility = clamp(next.hostility + patch.hostility, 0, 100);
    if (typeof patch.leverage === 'number') next.leverage = clamp(next.leverage + patch.leverage, 0, 100);
    if (typeof patch.power === 'number') next.power = clamp(next.power + patch.power, 0, 100);
    if (patch.stance) next.stance = patch.stance;
    return next;
  });
}

function refreshFactionStances(state) {
  state.gameState.factions = (state.gameState.factions || []).map((item) => {
    let stance = '中立';
    if (item.hostility >= 65) stance = '敌视';
    else if (item.favor >= 30 && item.hostility <= 20) stance = '倾向你';
    else if (item.favor >= 12) stance = '可接近';
    else if (item.hostility >= 40) stance = '戒备';
    else if (item.leverage >= 18) stance = '试探';
    return Object.assign({}, item, { stance });
  });
}

function mostImportantFaction(state) {
  return (state.gameState.factions || []).slice().sort((a, b) => (b.hostility + b.power + b.leverage) - (a.hostility + a.power + a.leverage))[0] || null;
}

function updateMainline(state, intent, resolution) {
  const mainline = state.world.mainline;
  if (!mainline || !Array.isArray(mainline.acts) || !mainline.acts.length) return;

  const currentAct = mainline.acts[mainline.currentActIndex];
  let gain = resolution.tier === 'great' ? 2 : resolution.tier === 'good' ? 1 : resolution.tier === 'mixed' ? 0 : -1;
  if (currentAct.focus.includes(intent)) gain += 1;
  if (resolution.type === 'war' && currentAct.focus.includes('conquest')) gain += 1;
  if (resolution.mode === 'siege' && resolution.tier === 'great') gain += 1;

  if (resolution.tier === 'fail') {
    state.world.pressure += 1;
  } else if (resolution.tier === 'great' && state.world.pressure > 0) {
    state.world.pressure -= 1;
  }

  mainline.progress = Math.max(0, mainline.progress + gain);
  if (mainline.progress >= 4 && mainline.currentActIndex < mainline.acts.length - 1) {
    mainline.currentActIndex += 1;
    mainline.progress = 0;
  }

  const active = mainline.acts[mainline.currentActIndex];
  mainline.title = active.title;
  mainline.summary = active.summary;
  mainline.crisis = active.crisis;
  mainline.focus = active.focus;
  state.world.objective = active.summary;
}

function buildBattleLocation(mode) {
  const map = {
    drill: ['校场军营', '河岸操练场', '营外旷地'],
    skirmish: ['山道隘口', '夜雾渡口', '林间伏道'],
    field: ['前线旷野', '两军阵前', '河畔平野'],
    siege: ['城下壕沟', '寨门外坡', '北门箭楼下'],
    defense: ['残垒城头', '河关拒马后', '营寨木墙前']
  };
  return pickRandom(map[mode] || ['乱军之间']);
}

function buildOutcomeObjective(state, resolution, targetFaction) {
  const target = targetFaction ? targetFaction.name : '眼前的对手';
  if (resolution.type === 'war') {
    if (resolution.tier === 'great') return `趁着${target}还没重新稳住阵脚，决定是继续压上去，还是借这一口胜势转向更大的布局。`;
    if (resolution.tier === 'good') return `你已经在${target}面前立住了一截，但下一步要不要继续追打，还得看人心和军需能不能跟上。`;
    if (resolution.tier === 'mixed') return `${target}没有被你彻底压垮，接下来必须先稳住士气和军需，否则这一线会反咬回来。`;
    return `${target}已经察觉到你的薄处，若不尽快补上缺口，主线会先从这里塌一块。`;
  }
  if (resolution.tier === 'great') return '趁局面开始向你偏转，把这点势能尽快换成更稳的根基。';
  if (resolution.tier === 'good') return '把这一点松动接住，不要让刚开出来的缝又被人合上。';
  if (resolution.tier === 'mixed') return '局面只是暂时没有继续坏下去，你得马上补第二手。';
  return '裂缝已经露出来了，得先想办法止血，再谈下一步。';
}

function applyFactionConsequences(state, intent, resolution) {
  const targetFaction = getFaction(state, resolution.targetFactionId);
  if (!targetFaction) return;

  if (resolution.type === 'war') {
    if (resolution.tier === 'great') {
      updateFaction(state, targetFaction.id, { hostility: 8, favor: -6, leverage: -2, power: -2 });
    } else if (resolution.tier === 'good') {
      updateFaction(state, targetFaction.id, { hostility: 5, favor: -3, leverage: -1 });
    } else if (resolution.tier === 'mixed') {
      updateFaction(state, targetFaction.id, { hostility: 3, favor: -1 });
    } else {
      updateFaction(state, targetFaction.id, { hostility: 10, favor: -5, leverage: 1 });
    }
    return;
  }

  if (intent === 'diplomacy') {
    if (resolution.tier === 'great') updateFaction(state, targetFaction.id, { favor: 10, hostility: -4, leverage: 2 });
    else if (resolution.tier === 'good') updateFaction(state, targetFaction.id, { favor: 5, hostility: -2, leverage: 1 });
    else if (resolution.tier === 'mixed') updateFaction(state, targetFaction.id, { favor: 1 });
    else updateFaction(state, targetFaction.id, { favor: -4, hostility: 4 });
  } else if (intent === 'trade') {
    if (resolution.tier === 'great') updateFaction(state, targetFaction.id, { favor: 6, leverage: 4 });
    else if (resolution.tier === 'good') updateFaction(state, targetFaction.id, { favor: 3, leverage: 2 });
    else if (resolution.tier === 'fail') updateFaction(state, targetFaction.id, { favor: -3, hostility: 2 });
  } else if (intent === 'intrigue') {
    if (resolution.tier === 'great') updateFaction(state, targetFaction.id, { leverage: 4, hostility: 3 });
    else if (resolution.tier === 'good') updateFaction(state, targetFaction.id, { leverage: 2, hostility: 1 });
    else if (resolution.tier === 'fail') updateFaction(state, targetFaction.id, { hostility: 6, favor: -2 });
  } else if (intent === 'investigate' && resolution.tier === 'great') {
    updateFaction(state, targetFaction.id, { leverage: 2 });
  }
}

function createThreadFromIntent(intent, state, resolution) {
  const importantFaction = getFaction(state, resolution.targetFactionId) || mostImportantFaction(state);
  const factionText = importantFaction ? importantFaction.name : '那一方势力';
  const map = {
    domestic: { title: '粮秣和民心还在摇摆，再拖下去，根基会先松。', urgency: 1, domain: 'domestic' },
    diplomacy: { title: `${factionText}已经开始松口，但谁先给价码，谁就先露底。`, urgency: 2, domain: 'diplomacy' },
    military: { title: '军中眼下算是压住了，但真正能不能久用，还得看下一道军令。', urgency: 1, domain: 'military' },
    conquest: { title: `${factionText}留下的裂口还没彻底站稳，这一口气不能乱用。`, urgency: 2, domain: 'conquest' },
    romance: { title: '一封没说尽的话还压在灯下，拖久了，它会先变味。', urgency: 1, domain: 'romance' },
    intrigue: { title: `${factionText}已经察觉到什么了，真正的回响还在后面。`, urgency: 2, domain: 'intrigue' },
    investigate: { title: '风声比先前更多，但真正致命的那一条还没完全露出来。', urgency: 2, domain: 'investigate' },
    trade: { title: '钱粮刚刚被你拨动，接下来总会有人想来分这一杯。', urgency: 1, domain: 'trade' },
    travel: { title: '你换了路，也意味着旧地方的尾巴有可能正跟上来。', urgency: 1, domain: 'travel' },
    recover: { title: '伤与疲惫压下去一点了，但真正的账还没清。', urgency: 1, domain: 'recover' }
  };
  const thread = Object.assign({ title: '新的裂缝在暗处继续张开。', urgency: 1, domain: 'unknown' }, map[intent]);
  if (resolution.tier === 'fail') thread.urgency += 1;
  return { key: `${thread.domain}_${state.world.turn}`, title: thread.title, urgency: thread.urgency, domain: thread.domain };
}

function buildNarrativeOutcome(state, intent, actionText, resolution) {
  const romanceTarget = selectRomanceTarget(state);
  const targetFaction = getFaction(state, resolution.targetFactionId);
  const actionLabel = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const location = resolution.type === 'war' ? buildBattleLocation(resolution.mode) : pickRandom({
    domestic: ['郡县公廨', '仓廪前院'],
    diplomacy: ['会客偏厅', '廊下茶席'],
    trade: ['市集渡口', '盐栈账房'],
    intrigue: ['暗巷酒肆', '破庙背巷'],
    investigate: ['市坊巷陌', '城门影下'],
    romance: [romanceTarget ? `${romanceTarget.name}常去的后园` : '灯下回廊'],
    travel: ['官道驿站', '河港码头'],
    recover: ['临时歇脚处', '旧宅侧院'],
    guidance: ['溪边旧亭'],
    unknown: [state.world.location]
  }[intent] || [state.world.location]);
  const mood = resolution.type === 'war'
    ? ({
      drill: '肃军',
      skirmish: '逼杀',
      field: '鏖战',
      siege: '焦灼',
      defense: '苦守'
    }[resolution.mode] || '绷紧')
    : ({
      domestic: '整饬',
      diplomacy: '周旋',
      trade: '盘算',
      intrigue: '伏线',
      investigate: '窥伺',
      romance: '低回',
      travel: '奔波',
      recover: '回稳',
      guidance: '沉静'
    }[intent] || '未定');

  const outcome = {
    location,
    mood,
    objective: buildOutcomeObjective(state, resolution, targetFaction),
    addItems: [],
    addSkills: [],
    relationships: [],
    achievements: [],
    leadText: '',
    targetFactionName: targetFaction ? targetFaction.name : '',
    uiTag: resolution.type === 'war' ? `战况：${resolution.mode}` : `局面：${resolution.type}`
  };

  if (intent === 'diplomacy') {
    outcome.relationships.push({
      id: 'shen_zhiwei',
      name: '沈知微',
      title: '郡府书吏',
      status: resolution.tier === 'fail' ? '重新收紧了话口' : '开始愿意替你递话',
      trustDelta: resolution.tier === 'great' ? 10 : resolution.tier === 'good' ? 6 : 2,
      loyalty: resolution.tier === 'great' ? 4 : resolution.tier === 'good' ? 2 : 0,
      description: '她会先记住一个人说话时露不露怯，再决定要不要替这个人开门。'
    });
  }

  if (intent === 'military') {
    outcome.relationships.push({
      id: 'huo_qinglan',
      name: '霍青岚',
      title: '营中偏将',
      status: resolution.tier === 'fail' ? '仍在等你下一回能不能稳住' : '开始认你的军令',
      trustDelta: resolution.tier === 'great' ? 10 : resolution.tier === 'good' ? 6 : 2,
      loyalty: resolution.tier === 'great' ? 4 : resolution.tier === 'good' ? 2 : 0,
      description: '她并不轻易服谁，但会记住谁能把军心压成一线。'
    });
  }

  if (intent === 'romance' && romanceTarget) {
    outcome.relationships.push({
      id: romanceTarget.id,
      name: romanceTarget.name,
      title: romanceTarget.title,
      status: resolution.tier === 'fail' ? '话头到了嘴边，又各自按回去了' : '心意比从前更近了一层',
      affectionDelta: resolution.tier === 'great' ? 14 : resolution.tier === 'good' ? 8 : resolution.tier === 'mixed' ? 4 : 1,
      trustDelta: resolution.tier === 'great' ? 5 : 2,
      loyalty: resolution.tier === 'great' ? 2 : 0,
      romanceable: romanceTarget.romanceable,
      description: `这一回过后，${romanceTarget.name}开始认真记住你的目光、停顿和没有说出口的那半句。`
    });
    outcome.achievements.push('romance_seed');
  }

  if (intent === 'trade') {
    outcome.relationships.push({
      id: 'lu_yunyao',
      name: '陆云瑶',
      title: '盐铁商会管事',
      status: resolution.tier === 'fail' ? '还在掂量你值不值得冒险' : '开始认真拿你当可以下注的人',
      trustDelta: resolution.tier === 'great' ? 8 : 4,
      loyalty: resolution.tier === 'great' ? 2 : 0,
      description: '她未必会喜欢你，但会记住谁能把账算清，谁又能把货路保住。'
    });
  }

  if (intent === 'intrigue') {
    outcome.addItems.push(resolution.tier === 'great' ? { name: '密信', count: 1 } : { name: '耳报', count: 1 });
  }

  if (intent === 'guidance') {
    outcome.relationships.push({
      id: 'qulige',
      name: '曲离歌',
      title: '江湖隐士',
      status: '又给你留下一句点拨',
      trustDelta: 6,
      loyalty: 1,
      description: '他从不替你做决定，但总能让你看见局里那一道最容易被忽略的裂缝。'
    });
  }

  if (resolution.type === 'war' && resolution.mode === 'siege' && resolution.tier === 'great') {
    outcome.addItems.push({ name: '军报', count: 1 });
  }

  if (intent === 'conquest' && resolution.tier !== 'fail') {
    outcome.achievements.push('war_banner');
    if (resolution.tier === 'great') outcome.achievements.push('first_victory');
  }

  const actTitle = state.world.mainline ? state.world.mainline.title : state.world.stageName;
  const actionTextLine = actionText && !String(actionText).startsWith('thread:') && !String(actionText).startsWith('background:')
    ? `你这一回明着做的是“${actionText}”。`
    : '';
  const factionLine = targetFaction ? `被你真正牵动的是“${targetFaction.name}”。` : '';

  outcome.leadText = `${state.world.dateLabel}，主线已推进到“${actTitle}”。你围绕“${actionLabel}”先落下一子，${location}里的风向立刻变了。${factionLine}${actionTextLine}`;
  return outcome;
}

function applyFactionAftermathToRelations(state, resolution) {
  const targetFaction = getFaction(state, resolution.targetFactionId);
  if (!targetFaction) return;

  const members = state.gameState.relationships.filter((item) => item.factionId === targetFaction.id);
  members.forEach((relation) => {
    state.gameState.relationships = upsertRelationship(state.gameState.relationships, {
      id: relation.id,
      name: relation.name,
      trustDelta: resolution.type === 'war'
        ? (resolution.tier === 'great' ? -1 : resolution.tier === 'fail' ? -3 : 0)
        : (resolution.tier === 'great' ? 1 : resolution.tier === 'fail' ? -2 : 0)
    });
  });
}

function updateAchievements(state) {
  const unlock = (id) => {
    state.gameState.achievements = state.gameState.achievements.map((achievement) =>
      achievement.id === id ? Object.assign({}, achievement, { unlocked: true }) : achievement
    );
  };

  if (state.gameState.domestic >= 8) unlock('domestic_name');
  if (state.gameState.diplomacy >= 8) unlock('diplomatic_name');
  if (state.gameState.military >= 8) unlock('war_banner');
  if (state.gameState.relationships.some((item) => item.romanceable && item.affection >= 12)) unlock('romance_seed');
  if (state.gameState.factions.some((item) => item.favor >= 24)) unlock('faction_broker');
}

function generateChoices(state, intent, forcedEvent) {
  const topThread = state.memory.openThreads[0];
  const romanceTarget = selectRomanceTarget(state);
  const mainline = state.world.mainline || { focus: [] };
  const hotFaction = mostImportantFaction(state);
  const pool = [];

  if (topThread) {
    pool.push({ id: `thread:${topThread.domain || 'investigate'}`, text: `优先处理“${topThread.title}”`, hint: '先压住眼前最急的一处，后面的布局才有地方落。' });
  }

  mainline.focus.forEach((domain) => {
    if (INTENT_CONFIG[domain]) {
      pool.push({
        id: domain,
        text: INTENT_CONFIG[domain].label,
        hint: `这是当前主线“${mainline.title}”最需要的一手。`
      });
    }
  });

  if (forcedEvent) {
    pool.push({ id: 'investigate', text: '先查清暗处的新动向', hint: '你已经在同一件事上盘旋太久，局面会反咬回来的。' });
  }

  if (hotFaction) {
    pool.push({
      id: 'diplomacy',
      text: `试探${hotFaction.name}`,
      hint: `${hotFaction.name}眼下最值得盯住，或者争，或者压。`
    });
  }

  pool.push(
    { id: 'domestic', text: '经略内政', hint: '稳住粮秣、税赋与民心，让根基先不散。' },
    { id: 'military', text: '整军练兵', hint: '先把人和阵列压住，再谈更大的征伐。' },
    { id: 'conquest', text: '发起战事', hint: '你可以选择遭遇战、野战或攻坚战，把局势直接往前推。' },
    { id: 'trade', text: '筹饷转运', hint: '钱粮和军需往往比一场嘴仗更能决定局面。' },
    { id: 'romance', text: romanceTarget ? `去见${romanceTarget.name}` : '赴一场私下相会', hint: '有些人心，得在刀兵之前先留住。' },
    { id: 'guidance', text: '向曲离歌问策', hint: '有些局面，旁观的人反而先看得见裂缝。' }
  );

  if (intent === 'conquest' || state.world.pressure >= 2 || state.gameState.fatigue > 50) {
    pool.push({ id: 'recover', text: '暂歇养势', hint: '伤口和疲惫拖久了，会先把你自己撕开。' });
  } else {
    pool.push({ id: 'travel', text: '换一处去路', hint: '有时候改一条路，比硬顶着往前更值。' });
  }

  return uniqBy(pool, (item) => item.id).slice(0, 6);
}

function assignImage(state, outcome) {
  const act = state.world.mainline ? state.world.mainline.title : state.world.stageName;
  const hotFaction = mostImportantFaction(state);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1a1310" />
          <stop offset="100%" stop-color="#4c2b20" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <text x="54" y="96" fill="#f5dfc1" font-size="30" font-family="Microsoft YaHei, sans-serif">${state.world.scriptName}</text>
      <text x="54" y="148" fill="#eebd83" font-size="24" font-family="Microsoft YaHei, sans-serif">${act}</text>
      <text x="54" y="214" fill="#f7f1e7" font-size="26" font-family="Microsoft YaHei, sans-serif">${state.world.dateLabel}</text>
      <text x="54" y="272" fill="#fff1de" font-size="28" font-family="Microsoft YaHei, sans-serif">${outcome.location}</text>
      <text x="54" y="328" fill="#ddc2a1" font-size="20" font-family="Microsoft YaHei, sans-serif">${state.world.objective}</text>
      <text x="54" y="378" fill="#cfae88" font-size="18" font-family="Microsoft YaHei, sans-serif">${hotFaction ? `牵动势力：${hotFaction.name}` : '局势尚在酝酿'}</text>
    </svg>
  `.replace(/\n/g, '');
  state.scene.imagePrompt = `${state.world.scriptName}，${act}，${state.world.dateLabel}，${outcome.location}，${outcome.mood}，汉末写意`;
  state.scene.imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function generatePrompt(state, intent, actionText, resolution, logEntry, leadText) {
  const relationText = state.gameState.relationships
    .filter((item) => item.trust > 0 || item.affection > 0 || item.loyalty > 0)
    .slice(0, 5)
    .map((item) => `${item.name}(信任${item.trust || 0}/情意${item.affection || 0}/依附${item.loyalty || 0})`)
    .join('、') || '暂无明显牵系';
  const factionText = (state.gameState.factions || [])
    .slice()
    .sort((a, b) => (b.hostility + b.leverage) - (a.hostility + a.leverage))
    .slice(0, 4)
    .map((item) => `${item.name}(态度${item.stance}/好感${item.favor}/敌意${item.hostility}/筹码${item.leverage})`)
    .join('、') || '暂无';
  const threadText = state.memory.openThreads.map((item) => item.title).join('、') || '暂无';
  const mainline = state.world.mainline || {};

  return [
    '你在续写一部汉末群像文字冒险。',
    '叙事必须紧扣当前主线章节，不要写成独立短篇。',
    '本地规则已经先算出状态变化、战斗结果、阵营波动和关系变化，你只能据此写剧情。',
    '请在 190 到 290 字之间，只写这一回合的推进、人物反应和新的风险。',
    '不要复述规则，不要列点，不要输出技术说明。',
    '必须使用年号，不要写公元纪年。',
    `导语：${leadText}`,
    `主线：${state.world.scriptName} / ${mainline.title || state.world.stageName} / 概要=${mainline.summary || ''}`,
    `当前危机：${mainline.crisis || state.world.objective}`,
    `当前地点：${state.world.location} / 当前目标：${state.world.objective}`,
    `玩家动作：${actionText}`,
    `本地裁定：${resolution.promptLine}`,
    `状态：身份=${state.gameState.identity}，内政=${state.gameState.domestic}，外交=${state.gameState.diplomacy}，军事=${state.gameState.military}，征伐=${state.gameState.conquest}，情意=${state.gameState.romance}，士气=${state.gameState.morale}，疲惫=${state.gameState.fatigue}，军需=${state.gameState.supplies}，影响力=${state.gameState.influence}`,
    `关键势力：${factionText}`,
    `关键关系：${relationText}`,
    `悬案：${threadText}`,
    `本回摘要：${logEntry}`
  ].join('\n');
}

function generateFallbackTail(state, resolution, outcome) {
  const pressure = state.world.mainline ? state.world.mainline.crisis : state.world.objective;
  return `${resolution.summary}${pressure}${state.world.weather}压在天边，${outcome.location}里的空气比先前更沉，也更像下一页马上要见血。`;
}

function processAction(state, actionPayload) {
  const { actionText, intent, target } = actionPayload;

  if (intent === 'background') {
    const background = BACKGROUNDS.find((item) => item.id === target);
    if (!background) throw new Error('未知的出身选项');

    applyBackground(state, target);
    state.scene.title = '卷首落定';
    state.scene.text = '';
    state.scene.statusLine = `${state.world.dateLabel} · ${state.world.location} · ${state.world.objective}`;
    assignImage(state, { location: state.world.location, mood: '初入乱世' });
    state.choices = generateChoices(state, 'unknown', false);
    state.gameState.turn = state.world.turn;
    state.saveTime = new Date().toISOString();

    const leadText = `${state.world.dateLabel}，你决定以“${background.identity}”的身份踏进这场乱世。`;
    const logEntry = `${state.world.dateLabel}，你选定出身为${background.label}，主线“${state.world.mainline.title}”从这一刻真正开始。`;
    return {
      leadText,
      prompt: generatePrompt(state, intent, actionText, { promptLine: '本回属于卷首定身，重点是确立身份、资源与主线落脚点。' }, logEntry, leadText),
      fallbackText: `你看清了自己手里还能拿出的筹码，也看见了第一道压在眼前的难关：${background.openingThread.title}。乱世不会给人太久迟疑，你只能先凭这层身份找一块能站稳的地方。`,
      mode: 'narration'
    };
  }

  const forcedEvent = detectLoop(state.memory, intent);
  const resolution = resolveAction(state, intent, actionText);
  applyResolution(state, resolution);
  applyFactionConsequences(state, intent, resolution);
  applyFactionAftermathToRelations(state, resolution);
  refreshFactionStances(state);
  updateMainline(state, intent, resolution);

  if (forcedEvent) {
    state.world.pressure += 1;
  }

  const outcome = buildNarrativeOutcome(state, intent, actionText, resolution);
  state.gameState.skills = uniqBy(state.gameState.skills.concat(outcome.addSkills), (item) => item.name);
  state.gameState.items = mergeItems(state.gameState.items, outcome.addItems);
  outcome.relationships.forEach((relationship) => {
    state.gameState.relationships = upsertRelationship(state.gameState.relationships, relationship);
  });

  const advanced = advanceMonth(state.world.year, state.world.month, (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].time) || 1);
  state.world.turn += 1;
  state.gameState.turn = state.world.turn;
  state.gameState.age = Number((state.gameState.age + (((INTENT_CONFIG[intent] && INTENT_CONFIG[intent].time) || 1) / 12)).toFixed(2));
  state.world.year = advanced.year;
  state.world.month = advanced.month;
  state.world.season = advanced.season;
  state.world.dateLabel = formatDateLabel(advanced.year, advanced.month, advanced.season);
  state.world.location = outcome.location;
  state.world.lastTopic = intent;
  state.world.weather = pickRandom(['薄阴', '急风', '雨歇', '暑热', '霜重']);
  nextStage(state.world);

  state.memory.recentIntents.push({ intent, tier: resolution.tier, total: resolution.total, actionText, mode: resolution.mode });
  state.memory.recentTopics.push(intent);
  state.memory.recentIntents = state.memory.recentIntents.slice(-6);
  state.memory.recentTopics = state.memory.recentTopics.slice(-6);
  state.memory.openThreads = state.memory.openThreads.slice(1);
  state.memory.openThreads.push(createThreadFromIntent(intent, state, resolution));
  state.memory.openThreads = state.memory.openThreads.sort((a, b) => b.urgency - a.urgency).slice(0, 4);
  state.memory.lastResolution = resolution;
  state.memory.lastChoiceText = actionText;
  state.gameState.lastResolutionSummary = resolution.summary;
  state.gameState.lastBattleReport = resolution.type === 'war'
    ? {
      mode: resolution.mode,
      tier: resolution.tier,
      playerStrength: resolution.battle.playerStrength,
      enemyStrength: resolution.battle.enemyStrength,
      casualties: resolution.casualties,
      supplyCost: resolution.supplyCost,
      targetFactionId: resolution.targetFactionId
    }
    : null;

  const actionLabel = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const battleLabel = resolution.type === 'war' ? `【${resolution.mode}】` : '';
  const faction = getFaction(state, resolution.targetFactionId);
  const logEntry = `${state.world.dateLabel}，你在“${actionLabel}”上落下一子${battleLabel}。${resolution.summary}${faction ? `被牵动的是“${faction.name}”。` : ''}`;
  state.gameState.adventureLog.push({ turn: state.world.turn, dateLabel: state.world.dateLabel, entry: logEntry });
  state.gameState.adventureLog = state.gameState.adventureLog.slice(-30);
  state.memory.majorEvents.push(logEntry);
  state.memory.majorEvents = state.memory.majorEvents.slice(-12);
  state.memory.summaries = state.memory.majorEvents.slice(-5);

  outcome.achievements.forEach((id) => {
    state.gameState.achievements = state.gameState.achievements.map((achievement) =>
      achievement.id === id ? Object.assign({}, achievement, { unlocked: true }) : achievement
    );
  });
  updateAchievements(state);

  state.scene.title = `${state.world.mainline ? state.world.mainline.title : state.world.stageName} · ${actionLabel}`;
  state.scene.summary = logEntry;
  state.scene.text = '';
  state.scene.statusLine = `${state.world.dateLabel} · ${state.world.location} · ${state.world.objective}`;
  assignImage(state, outcome);
  state.choices = generateChoices(state, intent, forcedEvent);
  state.saveTime = new Date().toISOString();

  return {
    leadText: outcome.leadText,
    prompt: generatePrompt(state, intent, actionText, resolution, logEntry, outcome.leadText),
    fallbackText: generateFallbackTail(state, resolution, outcome),
    mode: 'narration'
  };
}

module.exports = {
  processAction
};
