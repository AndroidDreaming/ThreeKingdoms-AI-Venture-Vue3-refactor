const { BACKGROUNDS, INTENT_CONFIG, SCRIPTS } = require('./chronicleV2Constants');
const {
  advanceMonth,
  formatDateLabel,
  mergeItems,
  pickRandom,
  uniqBy,
  upsertRelationship
} = require('./chronicleV2Helpers');
const { applyBackground } = require('./chronicleV3StateFactory');
const { resolveAction, applyResolution } = require('./chronicleV3Resolver');

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

function updateMainline(state, intent, resolution) {
  const mainline = state.world.mainline;
  if (!mainline || !Array.isArray(mainline.acts) || !mainline.acts.length) return;

  const currentAct = mainline.acts[mainline.currentActIndex];
  let gain = resolution.tier === 'great' ? 2 : resolution.tier === 'good' ? 1 : resolution.tier === 'mixed' ? 0 : -1;
  if (currentAct.focus.includes(intent)) gain += 1;
  if (resolution.type === 'war' && currentAct.focus.includes('conquest')) gain += 1;
  if (resolution.tier === 'fail') {
    state.world.pressure += 1;
  } else if (resolution.tier === 'great' && state.world.pressure > 0) {
    state.world.pressure -= 1;
  }

  mainline.progress = Math.max(0, mainline.progress + gain);
  if (mainline.progress >= 4 && mainline.currentActIndex < mainline.acts.length - 1) {
    mainline.currentActIndex += 1;
    mainline.progress = 0;
    const nextAct = mainline.acts[mainline.currentActIndex];
    mainline.title = nextAct.title;
    mainline.summary = nextAct.summary;
    mainline.crisis = nextAct.crisis;
    mainline.focus = nextAct.focus;
    state.world.objective = nextAct.summary;
  } else {
    mainline.title = currentAct.title;
    mainline.summary = currentAct.summary;
    mainline.crisis = currentAct.crisis;
    mainline.focus = currentAct.focus;
  }
}

function createThreadFromIntent(intent, state, resolution) {
  const turn = state.world.turn;
  const map = {
    domestic: { title: '粮秣和民心仍在摇摆，若不继续按住，底盘就会先松。', urgency: 1, domain: 'domestic' },
    diplomacy: { title: '一封新回信已在路上，但谁先开价，谁就先露底。', urgency: 2, domain: 'diplomacy' },
    military: { title: '军营里表面安稳，私下里仍有人在看你下一道军令。', urgency: 1, domain: 'military' },
    conquest: { title: '前线被撕开的口子还没真正站住，要不要追上去还得立刻定。', urgency: 2, domain: 'conquest' },
    romance: { title: '一封未说尽的话还悬着，拖久了，它会自己变味。', urgency: 1, domain: 'romance' },
    intrigue: { title: '暗线被你拨动后，真正的回响还在后面。', urgency: 2, domain: 'intrigue' },
    investigate: { title: '风声越多，越要盯住那一条真正致命的线。', urgency: 2, domain: 'investigate' },
    trade: { title: '钱粮刚刚松动，接下来总会有人想来分这一杯。', urgency: 1, domain: 'trade' },
    travel: { title: '你换了路，也意味着旧地方的尾巴可能正跟上来。', urgency: 1, domain: 'travel' },
    recover: { title: '伤与疲惫压下去了一些，但真正的账还没清。', urgency: 1, domain: 'recover' }
  };
  const thread = map[intent] || { title: '新的裂缝在暗处继续张开。', urgency: 1, domain: 'unknown' };
  if (resolution.tier === 'fail') {
    thread.urgency += 1;
  }
  return { key: `${thread.domain}_${turn}`, title: thread.title, urgency: thread.urgency, domain: thread.domain };
}

function buildLocationAndMood(state, intent, resolution, romanceTarget) {
  const tier = resolution.tier;
  switch (intent) {
    case 'domestic':
      return { location: '郡县公廨', mood: '整饬' };
    case 'diplomacy':
      return { location: '会客偏厅', mood: '周旋' };
    case 'military':
      return { location: '校场军营', mood: '肃军' };
    case 'conquest':
      return { location: '前线旷野', mood: tier === 'fail' ? '惨烈' : '鏖战' };
    case 'romance':
      return { location: romanceTarget ? `${romanceTarget.name}常去的后园` : '灯下回廊', mood: '低回' };
    case 'trade':
      return { location: '市集渡口', mood: '盘算' };
    case 'intrigue':
      return { location: '暗巷酒肆', mood: '伏线' };
    case 'investigate':
      return { location: '市坊巷陌', mood: '窥伺' };
    case 'travel':
      return { location: pickRandom(['官道驿站', '山间栈道', '河港码头', '荒村野店']), mood: '奔波' };
    case 'recover':
      return { location: '临时歇脚处', mood: '回稳' };
    case 'guidance':
      return { location: '溪边旧亭', mood: '沉静' };
    default:
      return { location: state.world.location, mood: '未定' };
  }
}

function buildNarrativeOutcome(state, intent, actionText, resolution) {
  const romanceTarget = selectRomanceTarget(state);
  const placement = buildLocationAndMood(state, intent, resolution, romanceTarget);
  const result = {
    location: placement.location,
    mood: placement.mood,
    objective: state.world.objective,
    addItems: [],
    addSkills: [],
    relationships: [],
    achievements: [],
    leadText: ''
  };

  if (intent === 'diplomacy') {
    result.relationships.push({
      id: 'shen_zhiwei',
      name: '沈知微',
      title: '郡府书吏',
      status: resolution.tier === 'fail' ? '仍在观望' : '开始愿意替你递话',
      trustDelta: resolution.tier === 'great' ? 10 : resolution.tier === 'good' ? 6 : 2,
      description: '她开始认真衡量，你究竟是会被风吹走的人，还是能立住的人。'
    });
  }

  if (intent === 'military') {
    result.relationships.push({
      id: 'huo_qinglan',
      name: '霍青岚',
      title: '营中偏将',
      status: resolution.tier === 'fail' ? '暂时不服气' : '开始认你的军令',
      trustDelta: resolution.tier === 'great' ? 10 : resolution.tier === 'good' ? 6 : 2,
      description: '她盯着你如何把人心压成一道线，也记住了你下令时的分寸。'
    });
  }

  if (intent === 'romance' && romanceTarget) {
    result.relationships.push({
      id: romanceTarget.id,
      name: romanceTarget.name,
      title: romanceTarget.title,
      status: resolution.tier === 'fail' ? '话头到了嘴边，又被你们各自按了回去' : '心意比从前更近了一层',
      affectionDelta: resolution.tier === 'great' ? 14 : resolution.tier === 'good' ? 8 : resolution.tier === 'mixed' ? 4 : 1,
      trustDelta: resolution.tier === 'great' ? 5 : 2,
      romanceable: romanceTarget.romanceable,
      description: `这一回见面之后，${romanceTarget.name}开始认真记住你的目光、停顿和迟疑。`
    });
    result.achievements.push('romance_seed');
  }

  if (intent === 'trade') {
    result.relationships.push({
      id: 'lu_yunyao',
      name: '陆云瑶',
      title: '盐铁商会管事',
      status: resolution.tier === 'fail' ? '还在试探你' : '开始认真衡量值不值得在你身上下筹码',
      trustDelta: resolution.tier === 'great' ? 8 : 4,
      description: '她未必会喜欢你，但会记住谁有本事把账算明白。'
    });
  }

  if (intent === 'intrigue') {
    result.addItems.push(resolution.tier === 'great' ? { name: '密信', count: 1 } : { name: '耳报', count: 1 });
  }

  if (intent === 'guidance') {
    result.relationships.push({
      id: 'qulige',
      name: '曲离歌',
      title: '江湖隐士',
      status: '又给你留下一句点拨',
      trustDelta: 6,
      description: '他仍不肯替你下决断，却总能把局里最险的一处轻轻拨开。'
    });
  }

  if (intent === 'conquest' && resolution.tier !== 'fail') {
    result.achievements.push('war_banner');
    if (resolution.tier === 'great') {
      result.achievements.push('first_victory');
    }
  }

  const actTitle = state.world.mainline ? state.world.mainline.title : state.world.stageName;
  const actionLabel = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const visibleAction = actionText && !String(actionText).startsWith('thread:') && !String(actionText).startsWith('background:')
    ? `你这一回明着做的是“${actionText}”。`
    : '';

  result.leadText = `${state.world.dateLabel}，主线已推进到“${actTitle}”。你围绕“${actionLabel}”先落下一子，${result.location}里的风向立刻变了。${visibleAction}`;
  return result;
}

function generateChoices(state, intent, forcedEvent) {
  const topThread = state.memory.openThreads[0];
  const romanceTarget = selectRomanceTarget(state);
  const mainline = state.world.mainline || { focus: [] };
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

  pool.push(
    { id: 'domestic', text: '经略内政', hint: '稳住粮秣、税赋与民心，让根基先不散。' },
    { id: 'diplomacy', text: '纵横外交', hint: '争一封回信、一句松口，有时就够改一小段命。' },
    { id: 'military', text: '整军练兵', hint: '人马不齐心，再快的刀也会先砍到自己。' },
    { id: 'conquest', text: '征伐攻取', hint: '征伐最见血色，也最容易一战改局。' },
    { id: 'trade', text: '筹饷转运', hint: '钱粮能让局势慢下来，也能逼很多人开口。' },
    { id: 'romance', text: romanceTarget ? `去见${romanceTarget.name}` : '赴一场私下相会', hint: '乱世里最难的，是把真心留给还肯相信的人。' },
    { id: 'guidance', text: '向曲离歌问策', hint: '有些局面，旁观的人反而先看得见裂缝。' }
  );

  if (intent === 'conquest' || state.world.pressure >= 2 || state.gameState.fatigue > 50) {
    pool.push({ id: 'recover', text: '暂歇养势', hint: '伤口和疲惫再拖下去，会先把你自己撕开。' });
  } else {
    pool.push({ id: 'travel', text: '换一处去路', hint: '有时候改一条路，比硬顶着往前更值。' });
  }

  return uniqBy(pool, (item) => item.id).slice(0, 6);
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
}

function assignImage(state, outcome) {
  const act = state.world.mainline ? state.world.mainline.title : state.world.stageName;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1c1511" />
          <stop offset="100%" stop-color="#513123" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <text x="54" y="106" fill="#f8e4c5" font-size="30" font-family="Microsoft YaHei, sans-serif">${state.world.scriptName}</text>
      <text x="54" y="156" fill="#efc391" font-size="22" font-family="Microsoft YaHei, sans-serif">${act}</text>
      <text x="54" y="218" fill="#f7f1e7" font-size="26" font-family="Microsoft YaHei, sans-serif">${state.world.dateLabel}</text>
      <text x="54" y="274" fill="#fff3dd" font-size="28" font-family="Microsoft YaHei, sans-serif">${outcome.location}</text>
      <text x="54" y="334" fill="#ddc2a1" font-size="20" font-family="Microsoft YaHei, sans-serif">${state.world.objective}</text>
    </svg>
  `.replace(/\n/g, '');
  state.scene.imagePrompt = `${state.world.scriptName}，${state.world.mainline ? state.world.mainline.title : state.world.stageName}，${state.world.dateLabel}，${outcome.location}，${outcome.mood}，汉末写意`;
  state.scene.imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function generatePrompt(state, intent, actionText, resolution, logEntry, leadText) {
  const relationText = state.gameState.relationships
    .filter((item) => item.trust > 0 || item.affection > 0)
    .slice(0, 4)
    .map((item) => `${item.name}(信任${item.trust || 0}/情意${item.affection || 0})`)
    .join('、') || '暂无明显牵系';
  const threadText = state.memory.openThreads.map((item) => item.title).join('、') || '暂无';
  const mainline = state.world.mainline || {};

  return [
    '你在续写一部汉末群像文字冒险。',
    '叙事必须与当前主线章节强相关，不要写成独立小故事。',
    '本地规则已经先行裁定行动结果，你只负责把这些结果写成沉浸式正文。',
    '请在 180 到 280 字之间，只写这一回合带来的剧情变化、人物反应和新的压力。',
    '不要复述系统，不要列点，不要解释规则，不要输出技术表述。',
    '必须使用年号，不要写公元纪年。',
    `导语：${leadText}`,
    `当前战役：${state.world.scriptName} / 主线章节=${mainline.title || state.world.stageName} / 阶段摘要=${mainline.summary || ''}`,
    `当前危机：${mainline.crisis || state.world.objective}`,
    `当前地点：${state.world.location} / 当前目标：${state.world.objective}`,
    `玩家选择：${actionText}`,
    `本地规则裁定：${resolution.promptLine}`,
    `人物状态：身份=${state.gameState.identity}，内政=${state.gameState.domestic}，外交=${state.gameState.diplomacy}，军事=${state.gameState.military}，征伐=${state.gameState.conquest}，情意=${state.gameState.romance}，士气=${state.gameState.morale}，疲惫=${state.gameState.fatigue}，军需=${state.gameState.supplies}`,
    `关键关系：${relationText}`,
    `当前悬案：${threadText}`,
    `本回摘要：${logEntry}`
  ].join('\n');
}

function generateFallbackTail(state, resolution, outcome) {
  return `${resolution.summary}${state.world.mainline ? state.world.mainline.crisis : state.world.objective}${state.world.weather}压在天边，${outcome.location}里的人心比先前更难猜透。`;
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
      prompt: generatePrompt(state, intent, actionText, {
        promptLine: `行动“${actionText}”属于卷首定身，重点是确立主线身份与资源来源。`
      }, logEntry, leadText),
      fallbackText: `你看清了自己手里还能拿出的筹码，也看见了第一道压在眼前的难关：${background.openingThread.title}。乱世不会给人太久迟疑，你只能先凭这层身份找一块能站稳的地方。`,
      mode: 'narration'
    };
  }

  const forcedEvent = detectLoop(state.memory, intent);
  const resolution = resolveAction(state, intent, actionText);
  applyResolution(state, resolution);
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

  state.memory.recentIntents.push({ intent, tier: resolution.tier, total: resolution.total, actionText });
  state.memory.recentTopics.push(intent);
  state.memory.recentIntents = state.memory.recentIntents.slice(-6);
  state.memory.recentTopics = state.memory.recentTopics.slice(-6);
  state.memory.openThreads = state.memory.openThreads.slice(1);
  state.memory.openThreads.push(createThreadFromIntent(intent, state, resolution));
  state.memory.openThreads = state.memory.openThreads.sort((a, b) => b.urgency - a.urgency).slice(0, 4);
  state.memory.lastResolution = resolution;
  state.memory.lastChoiceText = actionText;

  const actionLabel = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const logEntry = `${state.world.dateLabel}，你在“${actionLabel}”上落下一子。${resolution.summary}${state.world.mainline ? `主线现已推进到“${state.world.mainline.title}”。` : ''}`;
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
