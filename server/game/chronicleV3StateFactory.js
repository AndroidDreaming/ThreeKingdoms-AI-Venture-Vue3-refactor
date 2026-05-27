const { BACKGROUNDS, DEFAULT_MODEL, NPCS, SCRIPTS } = require('./chronicleV2Constants');
const { formatDateLabel, mergeItems, pickRandom } = require('./chronicleV2Helpers');

function createAchievements() {
  return [
    { id: 'first_choice', text: '初入乱世：定下自己的出身与第一步去路', unlocked: false },
    { id: 'domestic_name', text: '抚民有成：地方开始记住你的手段', unlocked: false },
    { id: 'diplomatic_name', text: '纵横有术：你能让原本不肯点头的人重新坐下', unlocked: false },
    { id: 'war_banner', text: '军旗初振：你的军令第一次压住了人心', unlocked: false },
    { id: 'first_victory', text: '锋刃见血：你赢下了第一场像样的胜势', unlocked: false },
    { id: 'romance_seed', text: '情意生根：有人开始在灯下等你一句回音', unlocked: false }
  ];
}

function createBackgroundChoices() {
  return BACKGROUNDS.map((background) => ({
    id: `background:${background.id}`,
    text: background.label,
    hint: `以“${background.identity}”的身份步入乱世。`,
    risk: '低'
  }));
}

function getCampaignActs(scriptId) {
  const map = {
    yellow_turban: [
      { id: 'roots', title: '先活下来', summary: '黄巾余波未散，你得先在州县震荡里保住一块落脚地。', crisis: '乡里缺粮，郡县权力正在松动。', focus: ['domestic', 'travel', 'trade'] },
      { id: 'alignment', title: '选边与借势', summary: '豪强、郡府、流民武装都在招手，你不能一直站在门外。', crisis: '你若迟迟不下注，就会被当成随时能丢弃的人。', focus: ['diplomacy', 'military', 'intrigue'] },
      { id: 'breakout', title: '打出名号', summary: '你需要一次真正能被旁人记住的手段，让别人知道你不是过路人。', crisis: '名声不立，就永远只能被更大的势力吞掉。', focus: ['conquest', 'military', 'diplomacy'] }
    ],
    coalition: [
      { id: 'alliance', title: '立足盟局', summary: '盟旗之下人心不齐，你要先在会盟的缝隙里找到自己的位置。', crisis: '诸侯互不信任，谁先露怯谁先被吃。', focus: ['diplomacy', 'intrigue', 'trade'] },
      { id: 'pressure', title: '军心与粮道', summary: '真正撑住联盟的不是誓词，而是军心与粮秣。', crisis: '营中一旦乱，盟局就先从内部碎掉。', focus: ['domestic', 'military', 'trade'] },
      { id: 'seize', title: '从乱局里抬头', summary: '当别人都在犹豫时，你得用一场行动把自己抬出来。', crisis: '再拖下去，你只会成为别人夺功的垫脚石。', focus: ['conquest', 'military', 'diplomacy'] }
    ],
    guandu: [
      { id: 'supply', title: '先稳后方', summary: '官渡之前，最先决定成败的不是刀，而是粮。', crisis: '前线缺粮，后方每一次误判都可能让大局崩塌。', focus: ['domestic', 'trade', 'investigate'] },
      { id: 'shadow', title: '暗线互咬', summary: '细作、军议、谣言互相绞成一团，你得先看清谁在下手。', crisis: '真消息和假风声混在一起，判断错一次就足够致命。', focus: ['intrigue', 'investigate', 'diplomacy'] },
      { id: 'decide', title: '战局定手', summary: '真正的胜负手已经不远，你得为那一击积够势能。', crisis: '若不能在关键节点抢先一步，所有筹划都会被反噬。', focus: ['military', 'conquest', 'guidance'] }
    ],
    red_cliffs: [
      { id: 'coalition', title: '同舟未同心', summary: '联军看似并肩，实则各有顾虑，裂口随时会开。', crisis: '只要一封误信，一场同盟就会先从疑心里烧起来。', focus: ['diplomacy', 'romance', 'intrigue'] },
      { id: 'wind', title: '借风成局', summary: '风向、水军、病气、军心，缺任何一环都撑不起大战。', crisis: '你若算不准节奏，再好的谋划也只会提前暴露。', focus: ['military', 'trade', 'investigate'] },
      { id: 'inferno', title: '一战定势', summary: '火势将起，谁能在这一夜抓住那口气，谁就能改写天下。', crisis: '大战迫近，已经没有多少试错空间。', focus: ['conquest', 'military', 'guidance'] }
    ]
  };
  return map[scriptId] || map.yellow_turban;
}

function createInitialText(script, gender) {
  const roleText = gender === '女' ? '尚未被世道记住的女子' : '尚未被世道记住的男子';
  return `${formatDateLabel(script.startYear, 1, '春')}，${script.name}的阴影已经压到眼前。你只是一个${roleText}，没有现成靠山，没有稳当去处，身边只有几样薄物和一口不肯轻易认输的气。门外风过枯草，你知道，真正改写命数的，从来不在出身高低，而在你准备怎样迈出第一步。`;
}

function createSessionState() {
  const script = pickRandom(SCRIPTS);
  const gender = Math.random() > 0.5 ? '男' : '女';
  const age = 17 + Math.floor(Math.random() * 7);
  const acts = getCampaignActs(script.id);

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
      objective: '先定下自己的出身，再找准第一块可以落脚的地方。',
      weather: '薄阴',
      pressure: 0,
      lastTopic: 'origin',
      mainline: {
        acts,
        currentActIndex: 0,
        title: acts[0].title,
        summary: acts[0].summary,
        crisis: acts[0].crisis,
        progress: 0,
        focus: acts[0].focus
      }
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
      morale: 58,
      fatigue: 8,
      supplies: 45,
      statusTags: ['无名', '局外人'],
      skills: [
        { name: '乱世自保', description: '局势不明时，知道先看风向再落子。', icon: 'fa-solid fa-shield-halved' }
      ],
      items: [],
      relationships: NPCS.map((npc) => ({
        id: npc.id,
        name: npc.name,
        title: npc.title,
        status: '初识未深',
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
      romanceTargetId: 'shen_zhiwei',
      lastResolution: null,
      lastChoiceText: ''
    },
    scene: {
      title: '卷首未定',
      text: createInitialText(script, gender),
      summary: '你已来到乱世门前，只差替自己选定第一层身份。',
      imagePrompt: `${script.name}，${script.openingLocation}，汉末，春天，薄阴，写意`,
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
  state.gameState.supplies += Math.max(0, Math.floor((background.stats.coins || 0) / 2));
  state.gameState.maxHealth = Math.max(state.gameState.maxHealth, state.gameState.health);
  state.gameState.skills = state.gameState.skills.concat(background.skills || []);
  state.gameState.items = mergeItems(state.gameState.items, background.items || []);
  state.memory.openThreads.unshift(background.openingThread);
  state.world.objective = `以“${background.identity}”的身份先站稳脚跟，把眼前最紧迫的麻烦按住。`;
  state.gameState.statusTags = Array.from(new Set([background.label, background.identity]));
  state.gameState.achievements = state.gameState.achievements.map((achievement) =>
    achievement.id === 'first_choice' ? Object.assign({}, achievement, { unlocked: true }) : achievement
  );
  return state;
}

module.exports = {
  createSessionState,
  applyBackground,
  getCampaignActs
};
