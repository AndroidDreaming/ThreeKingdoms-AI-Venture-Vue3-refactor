const { BACKGROUNDS, INTENT_CONFIG, SCRIPTS } = require('./chronicleConstants');
const {
  advanceMonth,
  clamp,
  formatDateLabel,
  mergeItems,
  pickRandom,
  uniqBy,
  upsertRelationship
} = require('./chronicleHelpers');
const { applyBackground } = require('./chronicleStateFactory');

function getRelevantStat(gameState, intent) {
  switch (intent) {
    case 'domestic':
      return gameState.domestic + Math.floor(gameState.defense / 2);
    case 'diplomacy':
      return gameState.diplomacy + Math.floor(gameState.charm / 2);
    case 'military':
      return gameState.military + Math.floor(gameState.attack / 2);
    case 'conquest':
      return gameState.conquest + Math.floor((gameState.attack + gameState.military) / 3);
    case 'romance':
      return gameState.romance + Math.floor(gameState.charm / 2);
    case 'trade':
      return Math.max(4, Math.floor(gameState.coins / 20)) + Math.floor(gameState.diplomacy / 2);
    case 'intrigue':
    case 'investigate':
      return Math.floor((gameState.defense + gameState.diplomacy) / 2);
    case 'travel':
      return Math.floor((gameState.agility + gameState.conquest) / 2);
    case 'recover':
      return Math.floor(gameState.health / 12);
    case 'guidance':
      return gameState.diplomacy + gameState.defense;
    default:
      return Math.ceil((gameState.attack + gameState.defense + gameState.agility + gameState.charm) / 4);
  }
}

function resolveTier(score) {
  if (score >= 14) return 'great';
  if (score >= 10) return 'good';
  if (score >= 7) return 'mixed';
  return 'fail';
}

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

function createThreadFromIntent(intent, state) {
  const turn = state.world.turn;
  const map = {
    domestic: { title: '地方赋税与仓粮再次牵动人心', urgency: 1, domain: 'domestic' },
    diplomacy: { title: '新的说客与书信正在路上，盟与裂都只差一句话', urgency: 2, domain: 'diplomacy' },
    military: { title: '营中军纪松动，部曲还需再压一压', urgency: 1, domain: 'military' },
    conquest: { title: '前线胜负未定，若不乘势，锋芒就会转钝', urgency: 2, domain: 'conquest' },
    romance: { title: '一封未回的私信还压在灯下，迟早要有人先开口', urgency: 1, domain: 'romance' },
    intrigue: { title: '暗地里的耳目越来越多，真假消息混在一起', urgency: 2, domain: 'intrigue' },
    investigate: { title: '巷陌里又多了两拨风声，得分出哪一拨是真的', urgency: 2, domain: 'investigate' }
  };
  const fallback = { title: '新的局缝正在暗处张开', urgency: 1, domain: 'unknown' };
  const thread = map[intent] || fallback;
  return { key: `${thread.domain}_${turn}`, title: thread.title, urgency: thread.urgency, domain: thread.domain };
}

function computeConsequences(state, intent, tier, actionText) {
  const romanceTarget = selectRomanceTarget(state);
  const result = {
    statChanges: {
      health: 0, attack: 0, defense: 0, agility: 0, charm: 0, coins: 0, troops: 0, renown: 0,
      domestic: 0, diplomacy: 0, military: 0, conquest: 0, romance: 0
    },
    addSkills: [],
    addItems: [],
    relationships: [],
    achievements: [],
    mood: '紧绷',
    location: state.world.location,
    topicKey: intent,
    objective: state.world.objective,
    leadText: ''
  };

  if (intent === 'domestic') {
    result.statChanges.domestic = tier === 'great' ? 2 : 1;
    result.statChanges.coins = tier === 'great' ? 22 : tier === 'good' ? 12 : tier === 'fail' ? -10 : 4;
    result.statChanges.renown = tier === 'fail' ? 0 : 2;
    result.location = '郡县公廨';
    result.mood = '整饬';
    result.objective = '稳住钱粮与民心，再考虑下一步更大的布局。';
  } else if (intent === 'diplomacy') {
    result.statChanges.diplomacy = tier === 'great' ? 2 : 1;
    result.statChanges.charm = tier === 'fail' ? 0 : 1;
    result.statChanges.renown = tier === 'great' ? 3 : 1;
    result.location = '馆舍席间';
    result.mood = '周旋';
    result.relationships.push({
      id: 'shen_zhiwei', name: '沈知微', title: '郡府书吏',
      status: tier === 'fail' ? '仍在观望' : '开始愿意替你递话',
      trust: tier === 'great' ? 14 : tier === 'good' ? 8 : 3,
      description: '她开始留意你在众人之间如何拿捏分寸。'
    });
    result.objective = '借来往书信和人情，把一条更稳的路先铺出来。';
  } else if (intent === 'military') {
    result.statChanges.military = tier === 'great' ? 2 : 1;
    result.statChanges.attack = tier === 'great' ? 1 : 0;
    result.statChanges.troops = tier === 'great' ? 16 : tier === 'good' ? 8 : tier === 'fail' ? -6 : 2;
    result.statChanges.health = tier === 'fail' ? -8 : -3;
    result.location = '校场军营';
    result.mood = '整军';
    result.relationships.push({
      id: 'huo_qinglan', name: '霍青岚', title: '营中偏将',
      status: tier === 'fail' ? '暂不服气' : '开始认可你的军令',
      trust: tier === 'great' ? 12 : tier === 'good' ? 7 : 3,
      description: '她把你在营中压住杂声的本事看在眼里。'
    });
    result.objective = '让这支人马先真正听得懂你的军令，再谈更大的征伐。';
  } else if (intent === 'conquest') {
    result.statChanges.conquest = tier === 'great' ? 2 : 1;
    result.statChanges.health = tier === 'great' ? -6 : tier === 'good' ? -10 : tier === 'mixed' ? -16 : -24;
    result.statChanges.troops = tier === 'great' ? 18 : tier === 'good' ? 6 : tier === 'mixed' ? -8 : -18;
    result.statChanges.renown = tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'fail' ? -1 : 1;
    result.statChanges.coins = tier === 'fail' ? -12 : 10;
    result.location = '前线旷野';
    result.mood = tier === 'fail' ? '惨烈' : '鏖战';
    if (tier !== 'fail') result.achievements.push('war_banner');
    if (tier === 'great') result.achievements.push('first_victory');
    result.objective = '趁敌方尚未喘匀，决定是收兵整势，还是继续把锋刃压下去。';
  } else if (intent === 'romance') {
    result.statChanges.romance = tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
    result.location = romanceTarget ? `${romanceTarget.name}常去的后园` : '灯下廊庑';
    result.mood = '低回';
    if (romanceTarget) {
      result.relationships.push({
        id: romanceTarget.id, name: romanceTarget.name, title: romanceTarget.title,
        status: tier === 'fail' ? '话到嘴边又咽了回去' : '心意比从前更近一步',
        affection: tier === 'great' ? 16 : tier === 'good' ? 10 : tier === 'mixed' ? 5 : 1,
        trust: tier === 'great' ? 5 : 2,
        romanceable: romanceTarget.romanceable,
        description: `与你有关的这一次相会，让${romanceTarget.name}开始认真记住你的眼神与分寸。`
      });
    }
    result.achievements.push('romance_seed');
    result.objective = '情意虽好，却不能与时局分开；下一步要想清楚，你愿为谁多担一层风险。';
  } else if (intent === 'trade') {
    result.statChanges.coins = tier === 'great' ? 36 : tier === 'good' ? 20 : tier === 'mixed' ? 6 : -10;
    result.statChanges.domestic = tier === 'great' ? 1 : 0;
    result.location = '市集渡口';
    result.mood = '盘算';
    result.objective = '把手上的钱粮尽快换成更稳的人心和更硬的底气。';
  } else if (intent === 'intrigue') {
    result.statChanges.diplomacy = tier === 'great' ? 1 : 0;
    result.statChanges.defense = tier === 'great' ? 1 : 0;
    result.statChanges.renown = tier === 'fail' ? 0 : 1;
    result.location = '暗巷酒肆';
    result.mood = '阴伏';
    result.addItems.push(tier === 'great' ? { name: '密信', count: 1 } : { name: '耳报', count: 1 });
    result.objective = '先把真假线索拆开.';
  } else if (intent === 'investigate') {
    result.statChanges.defense = tier === 'great' ? 1 : 0;
    result.location = '市坊巷陌';
    result.mood = '窥伺';
    result.objective = '再多确认一层风声，别让自己被最先听来的消息牵着走。';
  } else if (intent === 'travel') {
    result.statChanges.health = tier === 'fail' ? -9 : -4;
    result.statChanges.agility = tier === 'great' ? 1 : 0;
    result.location = pickRandom(['官道驿站', '山间栈路', '河港渡口', '荒村野店']);
    result.mood = '奔波';
    result.objective = '换到新的地方之后，先判断这一地的人心和势力究竟偏向谁。';
  } else if (intent === 'recover') {
    result.statChanges.health = tier === 'great' ? 16 : tier === 'good' ? 10 : 6;
    result.location = '临时歇脚处';
    result.mood = '回稳';
    result.objective = '缓过这口气，再决定下一步该动内政、军务还是人心。';
  } else if (intent === 'guidance') {
    result.statChanges.defense = 1;
    result.statChanges.diplomacy = 1;
    result.location = '溪边旧亭';
    result.mood = '沉静';
    result.relationships.push({
      id: 'qulige', name: '曲离歌', title: '江湖隐士',
      status: '又留下一句点拨', trust: 6,
      description: '他仍不肯替你下决定，却会把局中最险的一处轻轻拨开。'
    });
    result.objective = '把这句点拨落到实处。';
  } else {
    result.statChanges.renown = tier === 'great' ? 1 : 0;
    result.mood = '未定';
    result.objective = '先把局势看清，再决定真正要押的那一边。';
  }

  result.leadText = `${state.world.dateLabel}，你围绕“${INTENT_CONFIG[intent].label}”先落下一子，${result.location}里的风向立刻变了。`;
  return result;
}

function generateChoices(state, intent, forcedEvent) {
  const topThread = state.memory.openThreads[0];
  const romanceTarget = selectRomanceTarget(state);
  const pool = [];
  if (topThread) {
    pool.push({ id: `thread:${topThread.domain || 'investigate'}`, text: `先应对“${topThread.title}”`, hint: '把眼前最急的一件事压住，才能腾出手做别的。' });
  }
  if (forcedEvent) {
    pool.push({ id: 'investigate', text: '局势突变，先查明新动向', hint: '你若继续原地兜圈，别人就会替你写结局。' });
  }
  pool.push(
    { id: 'domestic', text: '转去安顿地方与钱粮', hint: '稳住内政，才能让后续的兵与盟都有落脚处。' },
    { id: 'diplomacy', text: '拜会可谈之人，试着借势', hint: '先争一封回信、一句松口，很多路就会自己露出来。' },
    { id: 'military', text: '回营整军，试试压住军心', hint: '人马若不齐心，刀再快也会先砍到自己。' },
    { id: 'conquest', text: '择机出兵，把锋刃往前再推一步', hint: '征伐最见血色，也最容易一战改势。' },
    { id: 'romance', text: romanceTarget ? `去见${romanceTarget.name}` : '赴一场私下相会', hint: '乱世里最难的是把真心留给还能相信的人。' }
  );
  return uniqBy(pool, (item) => item.id).slice(0, 5);
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
  const title = `${state.world.scriptName} · ${state.world.stageName}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#241813" /><stop offset="100%" stop-color="#4b2f23" /></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)" />
      <text x="56" y="116" fill="#f8e7c9" font-size="34" font-family="Microsoft YaHei, sans-serif">${title}</text>
      <text x="56" y="184" fill="#f3d6aa" font-size="24" font-family="Microsoft YaHei, sans-serif">${state.world.dateLabel}</text>
      <text x="56" y="244" fill="#fff7e6" font-size="28" font-family="Microsoft YaHei, sans-serif">${outcome.location}</text>
      <text x="56" y="312" fill="#e5ccb3" font-size="20" font-family="Microsoft YaHei, sans-serif">${outcome.objective}</text>
    </svg>
  `.replace(/\n/g, '');
  state.scene.imagePrompt = `${state.world.scriptName}，${outcome.location}，${state.world.dateLabel}，${outcome.mood}，汉末写意`;
  state.scene.imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function generatePrompt(state, intent, actionText, tier, logEntry, leadText) {
  const relationText = state.gameState.relationships
    .filter((item) => item.trust > 0 || item.affection > 0)
    .slice(0, 3)
    .map((item) => `${item.name}(信任${item.trust || 0}/情意${item.affection || 0})`)
    .join('，') || '暂无明显牵系';
  return [
    '你在续写一部汉末文字冒险，只负责剧情演绎，不负责数值计算。',
    '请根据以下结构化状态，续写 160 到 260 字中文正文。',
    '要求：直接续写，不要重复导语，不要解释系统，不要列点。',
    '只写这一回合带来的剧情变化、人物反应和下一层隐隐压力。',
    '时间表达必须使用年号，不要写公元纪年。',
    `导语：${leadText}`,
    `当前时局：${state.world.scriptName} / ${state.world.stageName} / ${state.world.dateLabel} / ${state.world.location}`,
    `当前目标：${state.world.objective}`,
    `本回行动：${actionText}，归类为${INTENT_CONFIG[intent].label}，结果层级为${tier}`,
    `最新结果摘要：${logEntry}`,
    `人物状态：身份${state.gameState.identity}，内政${state.gameState.domestic}，外交${state.gameState.diplomacy}，军务${state.gameState.military}，征伐${state.gameState.conquest}，情意${state.gameState.romance}`,
    `当前牵系：${relationText}`,
    `最近悬案：${state.memory.openThreads.map((item) => item.title).join('；') || '暂无'}`
  ].join('\n');
}

function generateFallbackTail(state, tier, outcome) {
  const tierText = {
    great: '这一手落得极稳，旁人看你的眼神已与先前不同。',
    good: '这一手落得不差，局势虽未定，却已经肯向你偏过来。',
    mixed: '这一手只能算勉强撑住，眼前的裂缝并没有真正合上。',
    fail: '这一手落得生硬，麻烦没有散，反而在暗处又多添了一层。'
  }[tier];
  return `${tierText} ${outcome.objective} ${state.world.weather}色压在天边，${outcome.location}里的人心比先前更难猜透。`;
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
    assignImage(state, { location: state.world.location, mood: '初入乱世', objective: state.world.objective });
    state.choices = generateChoices(state, 'unknown', false);
    state.gameState.turn = state.world.turn;
    state.saveTime = new Date().toISOString();
    const leadText = `${state.world.dateLabel}，你决定以“${background.identity}”的身份走入这场乱世。`;
    const logEntry = `${state.world.dateLabel}，你选定出身为${background.label}，卷宗从这一刻真正开始。`;
    return {
      leadText,
      prompt: generatePrompt(state, intent, actionText, 'good', logEntry, leadText),
      fallbackText: `你看清自己手里还能拿出来的筹码，也看见了第一道压在面前的难关：${background.openingThread.title}。乱世不会给人太久迟疑，你只能顺着这一层身份先找到立足的一角。`,
      mode: 'narration'
    };
  }

  const score = getRelevantStat(state.gameState, intent) + Math.floor(Math.random() * 7);
  const tier = resolveTier(score);
  const forcedEvent = detectLoop(state.memory, intent);
  const outcome = computeConsequences(state, intent, tier, actionText);
  if (forcedEvent) {
    state.memory.loopWarnings += 1;
    outcome.objective = '局势骤然催紧，你不能再围着同一处旧问题打转，必须换一只手去落子。';
    outcome.topicKey = `break_${intent}`;
    state.world.pressure += 1;
  }

  state.gameState.health = clamp(state.gameState.health + outcome.statChanges.health, 0, state.gameState.maxHealth);
  state.gameState.attack = clamp(state.gameState.attack + outcome.statChanges.attack, 1, 99);
  state.gameState.defense = clamp(state.gameState.defense + outcome.statChanges.defense, 1, 99);
  state.gameState.agility = clamp(state.gameState.agility + outcome.statChanges.agility, 1, 99);
  state.gameState.charm = clamp(state.gameState.charm + outcome.statChanges.charm, 1, 99);
  state.gameState.coins = Math.max(0, state.gameState.coins + outcome.statChanges.coins);
  state.gameState.troops = Math.max(0, state.gameState.troops + outcome.statChanges.troops);
  state.gameState.renown = Math.max(0, state.gameState.renown + outcome.statChanges.renown);
  state.gameState.domestic = clamp(state.gameState.domestic + outcome.statChanges.domestic, 1, 99);
  state.gameState.diplomacy = clamp(state.gameState.diplomacy + outcome.statChanges.diplomacy, 1, 99);
  state.gameState.military = clamp(state.gameState.military + outcome.statChanges.military, 1, 99);
  state.gameState.conquest = clamp(state.gameState.conquest + outcome.statChanges.conquest, 1, 99);
  state.gameState.romance = clamp(state.gameState.romance + outcome.statChanges.romance, 0, 99);
  state.gameState.skills = uniqBy(state.gameState.skills.concat(outcome.addSkills), (item) => item.name);
  state.gameState.items = mergeItems(state.gameState.items, outcome.addItems);
  outcome.relationships.forEach((relationship) => {
    state.gameState.relationships = upsertRelationship(state.gameState.relationships, relationship);
  });

  const advanced = advanceMonth(state.world.year, state.world.month, INTENT_CONFIG[intent].time || 1);
  state.world.turn += 1;
  state.gameState.turn = state.world.turn;
  state.gameState.age = Number((state.gameState.age + ((INTENT_CONFIG[intent].time || 1) / 12)).toFixed(2));
  state.world.year = advanced.year;
  state.world.month = advanced.month;
  state.world.season = advanced.season;
  state.world.dateLabel = formatDateLabel(advanced.year, advanced.month, advanced.season);
  state.world.location = outcome.location;
  state.world.lastTopic = outcome.topicKey;
  state.world.objective = outcome.objective;
  state.world.weather = pickRandom(['阴', '风急', '雨歇', '暑热', '霜重']);
  nextStage(state.world);

  state.memory.recentIntents.push({ intent, score, tier, actionText, topic: outcome.topicKey });
  state.memory.recentTopics.push(outcome.topicKey);
  state.memory.recentIntents = state.memory.recentIntents.slice(-6);
  state.memory.recentTopics = state.memory.recentTopics.slice(-6);
  state.memory.openThreads = state.memory.openThreads.slice(1);
  state.memory.openThreads.push(createThreadFromIntent(intent, state));
  state.memory.openThreads = state.memory.openThreads.sort((a, b) => b.urgency - a.urgency).slice(0, 4);

  const logEntry = `${state.world.dateLabel}，你在“${INTENT_CONFIG[intent].label}”上落下一子，${outcome.objective}`;
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

  state.scene.title = `${state.world.stageName} · ${INTENT_CONFIG[intent].label}`;
  state.scene.summary = logEntry;
  state.scene.text = '';
  state.scene.statusLine = `${state.world.dateLabel} · ${state.world.location} · ${state.world.objective}`;
  assignImage(state, outcome);
  state.choices = generateChoices(state, intent, forcedEvent);
  state.saveTime = new Date().toISOString();

  const leadText = outcome.leadText;
  return {
    leadText,
    prompt: generatePrompt(state, intent, actionText, tier, logEntry, leadText),
    fallbackText: generateFallbackTail(state, tier, outcome),
    mode: 'narration'
  };
}

module.exports = {
  processAction
};
