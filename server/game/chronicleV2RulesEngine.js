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
const { applyBackground } = require('./chronicleV2StateFactory');

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
    domestic: { title: '粮秣与民心正在松动，再拖下去会先伤根本', urgency: 1, domain: 'domestic' },
    diplomacy: { title: '新的书信和说客都在路上，联盟与背叛只差一句话', urgency: 2, domain: 'diplomacy' },
    military: { title: '营中号令仍不够严整，兵锋未必先向外，先可能反噬自己', urgency: 1, domain: 'military' },
    conquest: { title: '前线胜负未定，若不乘势，原本撕开的口子就会重新合拢', urgency: 2, domain: 'conquest' },
    romance: { title: '一封未回的私信还压在灯下，迟早有人要先开口', urgency: 1, domain: 'romance' },
    intrigue: { title: '暗地里的耳目越来越多，真消息与假风声已经混在一起', urgency: 2, domain: 'intrigue' },
    investigate: { title: '巷陌间又多了两拨风声，得先分清哪一拨是真的', urgency: 2, domain: 'investigate' },
    trade: { title: '账目与军需开始纠缠，一步失手，接下来几月都要失血', urgency: 1, domain: 'trade' },
    travel: { title: '新的去处已经摆在眼前，但每一条路都要先交代代价', urgency: 1, domain: 'travel' }
  };
  const fallback = { title: '新的裂缝正在暗处张开', urgency: 1, domain: 'unknown' };
  const thread = map[intent] || fallback;
  return { key: `${thread.domain}_${turn}`, title: thread.title, urgency: thread.urgency, domain: thread.domain };
}

function computeConsequences(state, intent, tier, actionText) {
  const romanceTarget = selectRomanceTarget(state);
  const result = {
    statChanges: {
      health: 0,
      attack: 0,
      defense: 0,
      agility: 0,
      charm: 0,
      coins: 0,
      troops: 0,
      renown: 0,
      domestic: 0,
      diplomacy: 0,
      military: 0,
      conquest: 0,
      romance: 0
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
    result.objective = '先稳住钱粮与民心，再谈更大的布势。';
  } else if (intent === 'diplomacy') {
    result.statChanges.diplomacy = tier === 'great' ? 2 : 1;
    result.statChanges.charm = tier === 'fail' ? 0 : 1;
    result.statChanges.renown = tier === 'great' ? 3 : 1;
    result.location = '会客偏厅';
    result.mood = '周旋';
    result.relationships.push({
      id: 'shen_zhiwei',
      name: '沈知微',
      title: '郡府书吏',
      status: tier === 'fail' ? '仍在观望' : '开始愿意替你递话',
      trustDelta: tier === 'great' ? 14 : tier === 'good' ? 8 : 3,
      description: '她开始留意你在众人之间如何拿捏分寸。'
    });
    result.objective = '借往来书信和人情，把一条更稳的路先铺出来。';
  } else if (intent === 'military') {
    result.statChanges.military = tier === 'great' ? 2 : 1;
    result.statChanges.attack = tier === 'great' ? 1 : 0;
    result.statChanges.troops = tier === 'great' ? 16 : tier === 'good' ? 8 : tier === 'fail' ? -6 : 2;
    result.statChanges.health = tier === 'fail' ? -8 : -3;
    result.location = '校场军营';
    result.mood = '肃军';
    result.relationships.push({
      id: 'huo_qinglan',
      name: '霍青岚',
      title: '营中偏将',
      status: tier === 'fail' ? '暂时不服气' : '开始认你的军令',
      trustDelta: tier === 'great' ? 12 : tier === 'good' ? 7 : 3,
      description: '她把你在营中压住杂声的本事看进了眼里。'
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
    result.objective = '趁敌军尚未合拢，决定是收兵整势，还是继续把刀锋压下去。';
  } else if (intent === 'romance') {
    result.statChanges.romance = tier === 'great' ? 3 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : 0;
    result.location = romanceTarget ? `${romanceTarget.name}常去的后园` : '灯下回廊';
    result.mood = '低回';
    if (romanceTarget) {
      result.relationships.push({
        id: romanceTarget.id,
        name: romanceTarget.name,
        title: romanceTarget.title,
        status: tier === 'fail' ? '话到嘴边又被你们按回去了' : '心意比从前更近了一层',
        affectionDelta: tier === 'great' ? 16 : tier === 'good' ? 10 : tier === 'mixed' ? 5 : 1,
        trustDelta: tier === 'great' ? 5 : 2,
        romanceable: romanceTarget.romanceable,
        description: `这一回相见之后，${romanceTarget.name}开始认真记住你的目光与迟疑。`
      });
    }
    result.achievements.push('romance_seed');
    result.objective = '情意虽好，却不能与时局割裂；下一步你得想清楚，愿为谁多担一层风险。';
  } else if (intent === 'trade') {
    result.statChanges.coins = tier === 'great' ? 36 : tier === 'good' ? 20 : tier === 'mixed' ? 6 : -10;
    result.statChanges.domestic = tier === 'great' ? 1 : 0;
    result.location = '市集渡口';
    result.mood = '盘算';
    result.relationships.push({
      id: 'lu_yunyao',
      name: '陆云瑶',
      title: '盐铁商会管事',
      status: tier === 'fail' ? '仍在试探你' : '开始认真衡量你值不值得下注',
      trustDelta: tier === 'great' ? 9 : 4,
      description: '她不轻易相信谁，但会记住谁算得清账。'
    });
    result.objective = '把手里的钱粮尽快换成更稳的人心和更硬的底气。';
  } else if (intent === 'intrigue') {
    result.statChanges.diplomacy = tier === 'great' ? 1 : 0;
    result.statChanges.defense = tier === 'great' ? 1 : 0;
    result.statChanges.renown = tier === 'fail' ? 0 : 1;
    result.location = '暗巷酒肆';
    result.mood = '伏线';
    result.addItems.push(tier === 'great' ? { name: '密信', count: 1 } : { name: '耳报', count: 1 });
    result.objective = '先把真假线索拆开，再决定该把矛头往谁身上递。';
  } else if (intent === 'investigate') {
    result.statChanges.defense = tier === 'great' ? 1 : 0;
    result.location = '市坊巷陌';
    result.mood = '窥伺';
    result.objective = '再多确认一层风声，别让自己被最先听来的消息牵着走。';
  } else if (intent === 'travel') {
    result.statChanges.health = tier === 'fail' ? -9 : -4;
    result.statChanges.agility = tier === 'great' ? 1 : 0;
    result.location = pickRandom(['官道驿站', '山间栈道', '河港码头', '荒村野店']);
    result.mood = '奔波';
    result.objective = '换到新地方之后，先判断这一地的人心和势力究竟偏向谁。';
  } else if (intent === 'recover') {
    result.statChanges.health = tier === 'great' ? 16 : tier === 'good' ? 10 : 6;
    result.location = '临时歇脚处';
    result.mood = '回稳';
    result.objective = '缓过这一口气，再决定下一步该动内政、军务还是人心。';
  } else if (intent === 'guidance') {
    result.statChanges.defense = 1;
    result.statChanges.diplomacy = 1;
    result.location = '溪边旧亭';
    result.mood = '沉静';
    result.relationships.push({
      id: 'qulige',
      name: '曲离歌',
      title: '江湖隐士',
      status: '又留下一句点拨',
      trustDelta: 6,
      description: '他仍不肯替你下决断，却会把局中最险的一处轻轻拨开。'
    });
    result.objective = '把这句点拨落到实处，不要让它只停在耳边。';
  } else {
    result.statChanges.renown = tier === 'great' ? 1 : 0;
    result.mood = '未定';
    result.objective = '先把局势看清，再决定真正要押的是哪一边。';
  }

  const label = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  result.leadText = `${state.world.dateLabel}，你围绕“${label}”先落下一子，${result.location}里的风向立刻变了。`;
  if (actionText && !String(actionText).startsWith('thread:') && !String(actionText).startsWith('background:')) {
    result.leadText += `你这一回明着做的是“${actionText}”。`;
  }
  return result;
}

function buildChoice(id, text, hint) {
  return { id, text, hint };
}

function generateChoices(state, intent, forcedEvent) {
  const topThread = state.memory.openThreads[0];
  const romanceTarget = selectRomanceTarget(state);
  const pool = [];

  if (topThread) {
    pool.push(buildChoice(`thread:${topThread.domain || 'investigate'}`, `先应对“${topThread.title}”`, '把眼前最急的一件事压住，才能腾出手做别的。'));
  }

  if (forcedEvent) {
    pool.push(buildChoice('investigate', '局势突变，先查明新动向', '你若继续原地打转，别人就会替你写结局。'));
  }

  pool.push(
    buildChoice('domestic', '经略内政', '稳住粮秣、税赋与民心，让根基先不散。'),
    buildChoice('diplomacy', '纵横外交', '先争一封回信、一句松口，很多路就会自己露出来。'),
    buildChoice('military', '整军练兵', '人马若不齐心，再快的刀也会先砍到自己。'),
    buildChoice('conquest', '征伐攻取', '征伐最见血色，也最容易一战改局。'),
    buildChoice('romance', romanceTarget ? `去见${romanceTarget.name}` : '赴一场私下相会', '乱世里最难的，是把真心留给还肯相信的人。'),
    buildChoice('trade', '筹饷转运', '钱粮能让局势慢下来，也能逼很多人开口。'),
    buildChoice('guidance', '向曲离歌问策', '有些局面，旁观者反而能先看见裂缝。')
  );

  if (intent === 'conquest' || state.world.pressure >= 2) {
    pool.push(buildChoice('recover', '暂歇养势', '先把伤口和军心按住，再谈下一步。'));
  } else {
    pool.push(buildChoice('travel', '换一处去路', '有时候改一条路，比硬顶着往前更值。'));
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
  const title = `${state.world.scriptName} · ${state.world.stageName}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1f1712" />
          <stop offset="100%" stop-color="#4b2f23" />
        </linearGradient>
      </defs>
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
    .slice(0, 4)
    .map((item) => `${item.name}(信任${item.trust || 0}/情意${item.affection || 0})`)
    .join('、') || '暂无明显牵系';
  const threadText = state.memory.openThreads.map((item) => item.title).join('、') || '暂无';

  return [
    '你在续写一部汉末群像文字冒险。',
    '你只负责叙事演绎，不负责数值计算。',
    '请在 160 到 260 字之间，直接续写本回合带来的剧情变化。',
    '不要复述系统设定，不要列点，不要解释规则，不要输出状态总结。',
    '必须使用年号，不要写公元纪年。',
    '只写这一回合的推进、人物反应、隐约埋下的下一层压力。',
    `导语：${leadText}`,
    `当前时局：${state.world.scriptName} / ${state.world.stageName} / ${state.world.dateLabel} / ${state.world.location}`,
    `当前目标：${state.world.objective}`,
    `本回行动：${actionText}，归类为${(INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变'}，结果层级为${tier}`,
    `最新结果摘要：${logEntry}`,
    `人物状态：身份${state.gameState.identity}，内政${state.gameState.domestic}，外交${state.gameState.diplomacy}，军事${state.gameState.military}，征伐${state.gameState.conquest}，情意${state.gameState.romance}`,
    `关键关系：${relationText}`,
    `当前悬案：${threadText}`
  ].join('\n');
}

function generateFallbackTail(state, tier, outcome) {
  const tierText = {
    great: '这一手落得极稳，旁人再看你时，眼神已经和先前不同。',
    good: '这一手落得不差，局势虽未定，却已经向你这边偏过来。',
    mixed: '这一手只能算勉强撑住，裂缝并没有真的合拢。',
    fail: '这一手落得生硬，麻烦没有散，反而在暗处又添了一层。'
  }[tier];

  return `${tierText}${outcome.objective}${state.world.weather}压在天边，${outcome.location}里的人心比先前更难猜透。`;
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

    const leadText = `${state.world.dateLabel}，你决定以“${background.identity}”的身份踏进这场乱世。`;
    const logEntry = `${state.world.dateLabel}，你选定出身为${background.label}，属于自己的局，从这一刻开始。`;
    return {
      leadText,
      prompt: generatePrompt(state, intent, actionText, 'good', logEntry, leadText),
      fallbackText: `你看清了自己手里还能拿出的筹码，也看见了第一道压在面前的难关：${background.openingThread.title}。乱世不会给人太久迟疑，你只能先凭这层身份找一块能站稳的地方。`,
      mode: 'narration'
    };
  }

  const score = getRelevantStat(state.gameState, intent) + Math.floor(Math.random() * 7);
  const tier = resolveTier(score);
  const forcedEvent = detectLoop(state.memory, intent);
  const outcome = computeConsequences(state, intent, tier, actionText);

  if (forcedEvent) {
    state.memory.loopWarnings += 1;
    outcome.objective = '局势已经开始催逼你换手，再围着同一处旧问题打转，迟早会被反噬。';
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

  const advanced = advanceMonth(state.world.year, state.world.month, (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].time) || 1);
  state.world.turn += 1;
  state.gameState.turn = state.world.turn;
  state.gameState.age = Number((state.gameState.age + (((INTENT_CONFIG[intent] && INTENT_CONFIG[intent].time) || 1) / 12)).toFixed(2));
  state.world.year = advanced.year;
  state.world.month = advanced.month;
  state.world.season = advanced.season;
  state.world.dateLabel = formatDateLabel(advanced.year, advanced.month, advanced.season);
  state.world.location = outcome.location;
  state.world.lastTopic = outcome.topicKey;
  state.world.objective = outcome.objective;
  state.world.weather = pickRandom(['薄阴', '急风', '雨歇', '暑热', '霜重']);
  nextStage(state.world);

  state.memory.recentIntents.push({ intent, score, tier, actionText, topic: outcome.topicKey });
  state.memory.recentTopics.push(outcome.topicKey);
  state.memory.recentIntents = state.memory.recentIntents.slice(-6);
  state.memory.recentTopics = state.memory.recentTopics.slice(-6);
  state.memory.openThreads = state.memory.openThreads.slice(1);
  state.memory.openThreads.push(createThreadFromIntent(intent, state));
  state.memory.openThreads = state.memory.openThreads.sort((a, b) => b.urgency - a.urgency).slice(0, 4);

  const label = (INTENT_CONFIG[intent] && INTENT_CONFIG[intent].label) || '临机应变';
  const logEntry = `${state.world.dateLabel}，你在“${label}”上落下一子，${outcome.objective}`;
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

  state.scene.title = `${state.world.stageName} · ${label}`;
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
