const { BACKGROUNDS, DEFAULT_MODEL, NPCS, SCRIPTS } = require('./chronicleConstants');
const { formatDateLabel, mergeItems, pickRandom } = require('./chronicleHelpers');

function createAchievements() {
  return [
    { id: 'first_choice', text: '初入乱世：定下自己的出身与去路', unlocked: false },
    { id: 'domestic_name', text: '抚民有成：地方开始记住你的手段', unlocked: false },
    { id: 'diplomatic_name', text: '唇舌动人：你能让原本不肯点头的人重新坐下', unlocked: false },
    { id: 'war_banner', text: '旗鼓初振：你的军令第一次真正压住人心', unlocked: false },
    { id: 'first_victory', text: '锋刃染血：你赢下了第一场真正的征伐', unlocked: false },
    { id: 'romance_seed', text: '心事生根：有人开始在灯下等你一句回音', unlocked: false }
  ];
}

function createBackgroundChoices() {
  return BACKGROUNDS.map((background) => ({
    id: `background:${background.id}`,
    text: background.label,
    intent: 'background',
    risk: '低',
    hint: `以“${background.identity}”的身份踏入这一卷乱世。`
  }));
}

function createInitialText(script, gender) {
  return `乱世风尘扑面而来。如今是${formatDateLabel(script.startYear, 1, '春')}，${script.name}的阴影已压到眼前。你只是一个${gender === '女' ? '尚未被世道记住的女子' : '尚未被世道记住的男子'}，没有现成靠山，没有稳定去路，身边只有几样薄物和一口不肯轻易认输的心气。门外风过枯草，你知道，真正决定命数的，不在出身高低，而在你准备怎样迈出第一步。`;
}

function createSessionState() {
  const script = pickRandom(SCRIPTS);
  const gender = Math.random() > 0.5 ? '男' : '女';
  const age = 17 + Math.floor(Math.random() * 7);

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
      objective: '先定下自己的出身，再找准第一块能够落脚的地方。',
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
      renown: 0,
      domestic: 4,
      diplomacy: 4,
      military: 4,
      conquest: 3,
      romance: 0,
      skills: [
        { name: '乱世自保', description: '在局势不明的时候，知道先看风向再落子。', icon: 'fa-solid fa-shield-halved' }
      ],
      items: [],
      relationships: NPCS.map((npc) => ({
        id: npc.id,
        name: npc.name,
        title: npc.title,
        status: '初见未深',
        affection: 0,
        trust: npc.id === 'qulige' ? 10 : 0,
        romanceable: npc.romanceable,
        description: `${npc.title}，${npc.style}`
      })),
      achievements: createAchievements(),
      adventureLog: [],
      turn: 0
    },
    memory: {
      recentIntents: [],
      recentTopics: [],
      majorEvents: [],
      openThreads: script.initialThreads.slice(),
      summaries: [],
      loopWarnings: 0,
      romanceTargetId: 'shen_zhiwei'
    },
    scene: {
      title: '卷首未定',
      text: createInitialText(script, gender),
      summary: '你在乱世醒来，尚未定下自己的出身。',
      imagePrompt: `${script.name}，${script.openingLocation}，汉末，阴天，写意`,
      imageUrl: '',
      statusLine: `${script.name} · ${script.openingLocation}`,
      mode: 'fallback'
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
  state.gameState.domestic += background.stats.domestic || 0;
  state.gameState.diplomacy += background.stats.diplomacy || 0;
  state.gameState.military += background.stats.military || 0;
  state.gameState.conquest += background.stats.conquest || 0;
  state.gameState.maxHealth = Math.max(state.gameState.maxHealth, state.gameState.health);
  state.gameState.skills = state.gameState.skills.concat(background.skills || []);
  state.gameState.items = mergeItems(state.gameState.items, background.items || []);
  state.memory.openThreads.unshift(background.openingThread);
  state.world.objective = `以“${background.identity}”的身份站稳脚跟，先把眼前最紧迫的麻烦按住。`;
  state.gameState.achievements = state.gameState.achievements.map((achievement) =>
    achievement.id === 'first_choice' ? Object.assign({}, achievement, { unlocked: true }) : achievement
  );
  return state;
}

module.exports = {
  createSessionState,
  applyBackground
};
