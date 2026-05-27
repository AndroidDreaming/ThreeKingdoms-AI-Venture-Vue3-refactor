const { BACKGROUNDS, INTENT_CONFIG, NPCS, SCRIPTS } = require('./constants');
const {
  advanceMonth,
  clamp,
  formatDateLabel,
  mergeItems,
  pickRandom,
  uniqBy,
  upsertRelationship
} = require('./helpers');
const { applyBackground } = require('./stateFactory');

function getRelevantStat(gameState, intent) {
  switch (intent) {
    case 'battle':
    case 'train':
      return gameState.attack;
    case 'investigate':
    case 'intrigue':
    case 'govern':
    case 'guidance':
      return gameState.defense;
    case 'trade':
      return Math.max(4, Math.floor(gameState.coins / 25)) + gameState.charm;
    case 'travel':
      return gameState.agility;
    case 'recruit':
    case 'diplomacy':
    case 'socialize':
      return gameState.charm;
    case 'rest':
      return Math.floor(gameState.health / 12);
    default:
      return Math.ceil((gameState.attack + gameState.defense + gameState.agility + gameState.charm) / 4);
  }
}

function resolveTier(score) {
  if (score >= 13) return 'great';
  if (score >= 9) return 'good';
  if (score >= 6) return 'mixed';
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
  return recent.every((item) => item.intent === intent && item.topic === memory.recentTopics[memory.recentTopics.length - 1]);
}

function createThreadFromIntent(intent, world) {
  const prefix = world.scriptName || '乱世';
  switch (intent) {
    case 'battle':
      return { key: `battle_${world.turn}`, title: `${prefix}中的兵锋正在逼近`, urgency: 2 };
    case 'trade':
      return { key: `trade_${world.turn}`, title: '一条可获利的商路正在招手', urgency: 1 };
    case 'diplomacy':
      return { key: `diplomacy_${world.turn}`, title: '地方势力愿意听取你的说辞', urgency: 1 };
    case 'investigate':
    case 'intrigue':
      return { key: `spy_${world.turn}`, title: '隐藏的密报指向新的内幕', urgency: 2 };
    case 'govern':
      return { key: `govern_${world.turn}`, title: '百姓对你的治理方式有了明确期待', urgency: 1 };
    default:
      return { key: `chance_${world.turn}`, title: '局势在暗处酝酿新的变化', urgency: 1 };
  }
}

function computeConsequences(state, intent, tier, actionText) {
  const { world } = state;
  const result = {
    statChanges: {
      health: 0,
      attack: 0,
      defense: 0,
      agility: 0,
      charm: 0,
      coins: 0,
      troops: 0,
      renown: 0
    },
    addSkills: [],
    addItems: [],
    relationships: [],
    achievements: [],
    mood: '紧张',
    location: world.location,
    topicKey: intent,
    objective: world.objective
  };

  if (intent === 'rest') {
    result.statChanges.health = tier === 'fail' ? 4 : tier === 'mixed' ? 8 : 14;
    result.mood = '喘息';
    result.objective = '恢复体力之后，尽快回到更关键的行动上。';
    return result;
  }

  if (intent === 'trade') {
    result.statChanges.coins = tier === 'great' ? 55 : tier === 'good' ? 30 : tier === 'mixed' ? 10 : -12;
    result.statChanges.charm = tier === 'fail' ? -1 : 1;
    result.statChanges.renown = tier === 'great' ? 2 : 1;
    result.mood = '算计';
    result.location = '市集与驿路之间';
  }

  if (intent === 'recruit') {
    result.statChanges.troops = tier === 'great' ? 40 : tier === 'good' ? 24 : tier === 'mixed' ? 10 : -6;
    result.statChanges.coins = tier === 'fail' ? -8 : -15;
    result.statChanges.charm = tier === 'great' ? 2 : tier === 'fail' ? -1 : 1;
    result.statChanges.renown = tier === 'great' ? 3 : 1;
    result.location = '乡亭与营地之间';
  }

  if (intent === 'train') {
    result.statChanges.attack = tier === 'great' ? 2 : tier === 'good' ? 1 : 0;
    result.statChanges.health = tier === 'fail' ? -8 : -3;
    if (tier === 'great') {
      result.addSkills.push({
        name: '阵前整队',
        description: '能在混乱局势中迅速稳定自己手上的人马。',
        icon: 'fa-solid fa-chess-rook'
      });
    }
    result.location = '校场';
  }

  if (intent === 'battle') {
    result.statChanges.health = tier === 'great' ? -8 : tier === 'good' ? -14 : tier === 'mixed' ? -20 : -28;
    result.statChanges.troops = tier === 'great' ? 18 : tier === 'good' ? 6 : tier === 'mixed' ? -12 : -25;
    result.statChanges.coins = tier === 'fail' ? -10 : 12;
    result.statChanges.renown = tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1;
    result.mood = tier === 'fail' ? '惨烈' : '激昂';
    result.location = '战场边缘';
    if (tier !== 'fail') {
      result.achievements.push('first_battle');
      if (tier === 'great') result.achievements.push('first_victory');
    }
  }

  if (intent === 'investigate' || intent === 'intrigue') {
    result.statChanges.defense = tier === 'great' ? 1 : 0;
    result.statChanges.coins = tier === 'fail' ? -6 : 8;
    result.statChanges.renown = tier === 'fail' ? 0 : 1;
    result.location = '暗巷与驿站';
    result.mood = '诡谲';
    if (tier === 'great') {
      result.addItems.push({ name: '密报', count: 1 });
    }
  }

  if (intent === 'diplomacy' || intent === 'socialize') {
    result.statChanges.charm = tier === 'great' ? 2 : tier === 'good' ? 1 : tier === 'fail' ? -1 : 0;
    result.statChanges.renown = tier === 'great' ? 3 : tier === 'good' ? 2 : 0;
    result.location = '厅堂宴席';
    result.mood = '周旋';
    result.relationships.push({
      name: pickRandom(['刘备', '曹操', '孙策', '荀彧', '张辽']),
      status: tier === 'fail' ? '观望' : tier === 'great' ? '赏识' : '有印象',
      description: `因“${actionText.slice(0, 12)}”与你产生交集。`
    });
  }

  if (intent === 'govern') {
    result.statChanges.coins = tier === 'great' ? 15 : tier === 'good' ? 8 : tier === 'mixed' ? 0 : -10;
    result.statChanges.charm = tier === 'fail' ? -1 : 1;
    result.statChanges.renown = tier === 'great' ? 3 : 1;
    result.location = '乡县田里';
    result.mood = '沉稳';
  }

  if (intent === 'travel') {
    result.statChanges.health = tier === 'fail' ? -10 : -4;
    result.statChanges.agility = tier === 'great' ? 1 : 0;
    result.location = pickRandom(['山道', '水路渡口', '驿站', '州县官道']);
    result.mood = '奔波';
  }

  if (intent === 'guidance') {
    const npc = NPCS[0];
    result.statChanges.defense = 1;
    result.statChanges.charm = 1;
    result.relationships.push({
      name: npc.name,
      status: '留下话头',
      description: `${npc.name}似乎看穿了你的处境，给你留下一句有用的提醒。`
    });
    result.location = '溪边旧亭';
    result.mood = '幽微';
    result.objective = '把曲离歌的提醒化成真正能落地的行动。';
  }

  if (intent === 'unknown') {
    result.statChanges.health = tier === 'fail' ? -6 : 0;
    result.statChanges.renown = tier === 'great' ? 1 : 0;
    result.location = world.location;
    result.mood = '未定';
  }

  return result;
}

function generateChoices(state, intent, forcedEvent) {
  const topThread = state.memory.openThreads[0];
  const common = [];

  if (topThread) {
    common.push({
      id: `thread_${topThread.key}`,
      text: `围绕“${topThread.title}”继续推进`,
      intent: intent === 'rest' ? 'investigate' : intent,
      risk: topThread.urgency >= 2 ? '高' : '中',
      hint: '把当前最紧迫的线索彻底做出结果。'
    });
  }

  if (forcedEvent) {
    common.push({
      id: `forced_break_${state.world.turn}`,
      text: '抢先应对突发变局',
      intent: 'battle',
      risk: '高',
      hint: '局势已经不允许继续原地打转。'
    });
  }

  const intentChoices = {
    battle: [
      { id: 'battle_push', text: '乘势压上，争取一口气夺势', intent: 'battle', risk: '高', hint: '更冒险，但有机会直接破局。' },
      { id: 'battle_spy', text: '先查敌情，再决定如何动兵', intent: 'investigate', risk: '中', hint: '减少硬拼带来的损失。' },
      { id: 'battle_recruit', text: '回头补足人手与粮秣', intent: 'recruit', risk: '中', hint: '稳住兵力之后再战。' }
    ],
    trade: [
      { id: 'trade_expand', text: '继续做大买卖，赌一把利润', intent: 'trade', risk: '中', hint: '资金能更快上涨，但也更惹眼。' },
      { id: 'trade_diplomacy', text: '借财路结交地方人物', intent: 'diplomacy', risk: '中', hint: '把钱换成关系。' },
      { id: 'trade_travel', text: '亲自走一趟更远的商路', intent: 'travel', risk: '高', hint: '远路收益更高，也更容易出事。' }
    ],
    recruit: [
      { id: 'recruit_train', text: '先把新来的人练成能用之兵', intent: 'train', risk: '中', hint: '避免人多却不堪用。' },
      { id: 'recruit_govern', text: '安顿乡里，让更多人愿意追随', intent: 'govern', risk: '低', hint: '从根子上稳住人心。' },
      { id: 'recruit_battle', text: '带着这批人试一场小仗', intent: 'battle', risk: '高', hint: '最快检验成色。' }
    ],
    guidance: [
      { id: 'guidance_follow', text: '照曲离歌的提醒立刻行动', intent: 'investigate', risk: '中', hint: '顺着那句点拨去找真正的切口。' },
      { id: 'guidance_social', text: '先去拜访可能帮得上忙的人', intent: 'socialize', risk: '低', hint: '把隐士提醒变成人脉资源。' },
      { id: 'guidance_rest', text: '先压住躁意，静待更清楚的局势', intent: 'rest', risk: '低', hint: '适合在局势过紧时缓一口气。' }
    ],
    unknown: [
      { id: 'unknown_investigate', text: '先摸清局势，再决定下一步', intent: 'investigate', risk: '低', hint: '避免继续盲动。' },
      { id: 'unknown_social', text: '去结识一个能带来新消息的人', intent: 'socialize', risk: '中', hint: '从别人嘴里打开局面。' },
      { id: 'unknown_travel', text: '离开原地，换一处地方碰碰运气', intent: 'travel', risk: '中', hint: '新地点意味着新机会。' }
    ]
  };

  const additional = intentChoices[intent] || intentChoices.unknown;
  const merged = uniqBy(common.concat(additional), (item) => item.id);
  return merged.slice(0, 4);
}

function generateLogEntry(world, intent, tier, outcome) {
  const prefix = `${world.dateLabel} · ${world.location}`;
  const levelText = {
    great: '一举得势',
    good: '有所斩获',
    mixed: '勉强维持',
    fail: '受挫收场'
  }[tier];
  return `${prefix}，你在“${INTENT_CONFIG[intent].label}”中${levelText}。${outcome.objective}`;
}

function updateAchievements(state) {
  const unlock = (id) => {
    state.gameState.achievements = state.gameState.achievements.map((achievement) =>
      achievement.id === id ? Object.assign({}, achievement, { unlocked: true }) : achievement
    );
  };

  if (state.gameState.coins >= 180) unlock('rich_man');
  if (state.gameState.renown >= 12) unlock('high_reputation');
  if (state.gameState.skills.length >= 5) unlock('skill_master');
  if (state.memory.loopWarnings >= 1) unlock('story_breaker');
}

function assignImage(state, outcome) {
  const title = `${state.world.scriptName} · ${state.world.stageName}`;
  const prompt = `${state.world.scriptName}，${outcome.location}，${outcome.mood}，${state.world.dateLabel}，汉末写意风`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1f2937" />
          <stop offset="100%" stop-color="#6b3f2a" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
      <text x="60" y="120" fill="#f8e7c9" font-size="34" font-family="Microsoft YaHei, sans-serif">${title}</text>
      <text x="60" y="190" fill="#f5d7a1" font-size="24" font-family="Microsoft YaHei, sans-serif">${state.world.dateLabel}</text>
      <text x="60" y="250" fill="#fff7e6" font-size="28" font-family="Microsoft YaHei, sans-serif">${outcome.location}</text>
      <text x="60" y="320" fill="#e5ccb3" font-size="20" font-family="Microsoft YaHei, sans-serif">${outcome.objective}</text>
    </svg>
  `.replace(/\n/g, '');

  state.scene.imagePrompt = prompt;
  state.scene.imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function processAction(state, actionPayload) {
  const { actionText, intent, target } = actionPayload;

  if (intent === 'background') {
    const background = BACKGROUNDS.find((item) => item.id === target);
    if (!background) throw new Error('未知的出身选项');

    applyBackground(state, target);
    state.scene.title = '命运落子';
    state.scene.summary = `你选择以“${background.label}”的身份活在乱世。`;
    state.scene.text = '';
    state.scene.statusLine = `${state.world.scriptName} · ${state.world.location}`;
    assignImage(state, {
      location: state.world.location,
      mood: '风起',
      objective: state.world.objective
    });
    state.choices = generateChoices(state, 'unknown', false);
    state.gameState.turn = state.world.turn;
    state.saveTime = new Date().toISOString();
    return {
      prompt: '',
      fallbackText: `你决定以“${background.label}”的身份踏入乱世。${background.openingThread.title}很快摆在眼前，你知道，真正的第一步已经没有退路。`,
      mode: 'fallback'
    };
  }

  const relevantStat = getRelevantStat(state.gameState, intent);
  const score = relevantStat + Math.floor(Math.random() * 7);
  const tier = resolveTier(score);
  const forcedEvent = detectLoop(state.memory, intent);
  const outcome = computeConsequences(state, intent, tier, actionText);

  if (forcedEvent) {
    state.memory.loopWarnings += 1;
    outcome.objective = '局势骤然加速，你必须立刻处理突然压上的新麻烦。';
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
  state.gameState.skills = uniqBy(state.gameState.skills.concat(outcome.addSkills), (item) => item.name);
  state.gameState.items = mergeItems(state.gameState.items, outcome.addItems);
  outcome.relationships.forEach((relationship) => {
    state.gameState.relationships = upsertRelationship(state.gameState.relationships, relationship);
  });

  const advanced = advanceMonth(state.world.year, state.world.month, INTENT_CONFIG[intent].time);
  state.world.turn += 1;
  state.gameState.turn = state.world.turn;
  state.gameState.age = Number((state.gameState.age + 0.25).toFixed(2));
  state.world.year = advanced.year;
  state.world.month = advanced.month;
  state.world.season = advanced.season;
  state.world.dateLabel = formatDateLabel(advanced.year, advanced.month, advanced.season);
  state.world.location = outcome.location;
  state.world.lastTopic = outcome.topicKey;
  state.world.objective = outcome.objective;
  state.world.weather = pickRandom(['阴', '风急', '雨歇', '燥热', '霜重']);
  nextStage(state.world);

  state.memory.recentIntents.push({ intent, score, tier, actionText, topic: outcome.topicKey });
  state.memory.recentTopics.push(outcome.topicKey);
  state.memory.recentIntents = state.memory.recentIntents.slice(-6);
  state.memory.recentTopics = state.memory.recentTopics.slice(-6);
  state.memory.openThreads = state.memory.openThreads.slice(1);
  state.memory.openThreads.push(createThreadFromIntent(intent, state.world));
  state.memory.openThreads = state.memory.openThreads.sort((a, b) => b.urgency - a.urgency).slice(0, 4);

  const logEntry = generateLogEntry(state.world, intent, tier, outcome);
  state.gameState.adventureLog.push({ turn: state.world.turn, dateLabel: state.world.dateLabel, entry: logEntry });
  state.gameState.adventureLog = state.gameState.adventureLog.slice(-30);
  state.memory.majorEvents.push(`${state.world.dateLabel}：${logEntry}`);
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

  const prompt = [
    '你是三国题材文字冒险游戏的叙事作者。',
    '请根据以下结构化导演指令，写一段 220 到 380 字的中文叙事文本。',
    '要求：',
    '1. 只输出正文，不要标题，不要列表，不要解释。',
    '2. 必须体现时间推进、地点变化、事件结果和下一步压力。',
    '3. 不要重复上一回合的表述，要让局势明显向前。',
    `4. 当前世界：${state.world.scriptName} / ${state.world.stageName} / ${state.world.dateLabel} / ${state.world.location}。`,
    `5. 玩家身份：${state.gameState.identity}，年龄${Math.floor(state.gameState.age)}，当前目标：${state.world.objective}。`,
    `6. 玩家这次行动：${actionText}。动作类型：${INTENT_CONFIG[intent].label}。结果层级：${tier}。`,
    `7. 最近大事：${state.memory.summaries.join('；') || '暂无。'}`,
    `8. 最新结果摘要：${logEntry}`,
    `9. 当前能力：武力${state.gameState.attack}，智略${state.gameState.defense}，统率${state.gameState.agility}，魅力${state.gameState.charm}，财货${state.gameState.coins}，兵力${state.gameState.troops}。`,
    '10. 保持汉末现实感，不要出现修仙、现代科技、系统提示。'
  ].join('\n');

  const fallbackText = `你按下心思，照着“${actionText}”去做。${logEntry} ${state.world.weather}压着天色，${state.world.location}里的人和事都比上一刻更清楚，也更难应付。你知道，下一步若不及时落子，这点刚攒起来的优势就会很快被乱世吞没。`;

  return { prompt, fallbackText, mode: 'narration' };
}

module.exports = {
  processAction
};
