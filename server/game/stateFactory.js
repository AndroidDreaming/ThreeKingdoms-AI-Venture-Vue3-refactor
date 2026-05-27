const { BACKGROUNDS, DEFAULT_MODEL, NPCS, SCRIPTS } = require('./constants');
const { formatDateLabel, mergeItems, pickRandom } = require('./helpers');

function createAchievements() {
  return [
    { id: 'first_choice', text: '初入乱世：做出第一次命运选择', unlocked: false },
    { id: 'first_battle', text: '初经兵火：第一次真正置身战局', unlocked: false },
    { id: 'first_victory', text: '首捷告成：赢下属于自己的第一场胜利', unlocked: false },
    { id: 'rich_man', text: '积财有方：手中资财足以养一支小队', unlocked: false },
    { id: 'high_reputation', text: '声名鹊起：地方上开始主动提起你的名字', unlocked: false },
    { id: 'skill_master', text: '百艺渐成：掌握五种不同的生存或统御能力', unlocked: false },
    { id: 'story_breaker', text: '破局之人：在僵局中主动打开新的局面', unlocked: false }
  ];
}

function createBackgroundChoices() {
  return BACKGROUNDS.map((background) => ({
    id: `background:${background.id}`,
    text: background.label,
    intent: 'background',
    risk: '中',
    hint: `从“${background.label}”的视角开始进入乱世。`
  }));
}

function createInitialText(script, gender) {
  return `建安以前，天下已乱。你从一场过于真实的长梦中醒来，耳边只剩风穿破窗纸的声音。如今是${script.startYear}年，${script.name}的阴影正一步步逼近。你只是${gender === '女' ? '一名年轻女子' : '一名年轻男子'}，还没有名望，没有靠山，连明日能否安稳都未可知。可乱世从不只吞人，也会逼人长成刀锋。你抬头望向门外，天色沉沉，远处已有狼烟。此刻，先决定你要以怎样的身份活下去。`;
}

function createSessionState() {
  const script = pickRandom(SCRIPTS);
  const gender = Math.random() > 0.5 ? '男' : '女';
  const age = 17 + Math.floor(Math.random() * 6);

  return {
    sessionId: '',
    saveTime: new Date().toISOString(),
    settings: {
      apiBaseUrl: '',
      apiKey: '',
      model: DEFAULT_MODEL
    },
    world: {
      scriptId: script.id,
      scriptName: script.name,
      scriptSummary: script.summary,
      stageIndex: 0,
      stageName: script.stages[0],
      turn: 0,
      year: script.startYear,
      month: 1,
      season: '春',
      dateLabel: formatDateLabel(script.startYear, 1, '春'),
      location: script.openingLocation,
      objective: '先决定自己的出身，然后寻找第一条活路。',
      weather: '阴',
      pressure: 0,
      lastTopic: 'origin'
    },
    gameState: {
      name: '无名小卒',
      gender,
      age,
      background: '',
      identity: '布衣',
      faction: '未定',
      health: 100,
      maxHealth: 100,
      attack: 5,
      defense: 5,
      agility: 5,
      charm: 5,
      coins: 50,
      troops: 0,
      level: 1,
      renown: 0,
      skills: [
        { name: '谨慎求生', description: '面对未知局势时，不至于轻易失去分寸。', icon: 'fa-solid fa-shield-halved' }
      ],
      items: [],
      relationships: NPCS.map((npc) => ({
        name: npc.name,
        status: '未识',
        description: `${npc.title}。${npc.style}`
      })),
      achievements: createAchievements(),
      adventureLog: [],
      turn: 0,
      currentScene: 'origin'
    },
    memory: {
      recentIntents: [],
      recentTopics: [],
      majorEvents: [],
      openThreads: script.initialThreads.slice(),
      summaries: [],
      loopWarnings: 0
    },
    scene: {
      title: '风起乱世',
      text: createInitialText(script, gender),
      summary: '你在乱世开端醒来，准备决定自己的出身。',
      imagePrompt: `${script.name}，${script.openingLocation}，阴天，汉末风雨欲来`,
      imageUrl: '',
      statusLine: `${script.name} · ${script.openingLocation}`
    },
    choices: createBackgroundChoices()
  };
}

function applyBackground(state, backgroundId) {
  const background = BACKGROUNDS.find((item) => item.id === backgroundId);
  if (!background) return state;

  state.gameState.background = background.label;
  state.gameState.identity = background.identity;
  state.gameState.faction = '自立';
  state.gameState.attack += background.stats.attack || 0;
  state.gameState.defense += background.stats.defense || 0;
  state.gameState.agility += background.stats.agility || 0;
  state.gameState.charm += background.stats.charm || 0;
  state.gameState.coins += background.stats.coins || 0;
  state.gameState.troops += background.stats.troops || 0;
  state.gameState.health += background.stats.health || 0;
  state.gameState.maxHealth = Math.max(state.gameState.maxHealth, state.gameState.health);
  state.gameState.skills = state.gameState.skills.concat(background.skills || []);
  state.gameState.items = mergeItems(state.gameState.items, background.items || []);
  state.memory.openThreads.unshift(background.openingThread);
  state.world.objective = `以“${background.label}”的身份站稳脚跟，先处理眼前最紧迫的麻烦。`;
  state.gameState.achievements = state.gameState.achievements.map((achievement) => {
    if (achievement.id === 'first_choice') {
      return Object.assign({}, achievement, { unlocked: true });
    }
    return achievement;
  });
  return state;
}

module.exports = {
  createSessionState,
  applyBackground
};
