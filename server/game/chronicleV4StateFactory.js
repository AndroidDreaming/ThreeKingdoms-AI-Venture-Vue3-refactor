const { BACKGROUNDS, DEFAULT_MODEL, NPCS, SCRIPTS } = require('./chronicleV2Constants');
const { formatDateLabel, mergeItems, pickRandom } = require('./chronicleV2Helpers');

function createAchievements() {
  return [
    { id: 'first_choice', text: '初入乱世：定下出身与第一步去路', unlocked: false },
    { id: 'domestic_name', text: '抚民有成：州县开始记住你的名字', unlocked: false },
    { id: 'diplomatic_name', text: '纵横有术：你已经能让人重新坐回桌前', unlocked: false },
    { id: 'war_banner', text: '军旗初振：你第一次真正压住军心', unlocked: false },
    { id: 'first_victory', text: '锋刃见血：你赢下了一场像样的胜势', unlocked: false },
    { id: 'romance_seed', text: '情意生根：有人开始在灯下等你回音', unlocked: false },
    { id: 'faction_broker', text: '权衡诸方：至少一方势力开始认真把你当回事', unlocked: false }
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
      { id: 'alignment', title: '选边与借势', summary: '郡府、豪强、流民武装都在招手，你不能一直站在门外。', crisis: '迟迟不下注的人，往往先被各方一并吃掉。', focus: ['diplomacy', 'military', 'intrigue'] },
      { id: 'breakout', title: '打出名号', summary: '你需要一场真正会被旁人记住的行动。', crisis: '若不能立名，你永远只是别人布局里的脚注。', focus: ['conquest', 'military', 'diplomacy'] }
    ],
    coalition: [
      { id: 'alliance', title: '立足盟局', summary: '盟旗之下人心不齐，你要先在会盟缝隙里找到自己的位置。', crisis: '诸侯互不信任，谁先露怯谁先被吞。', focus: ['diplomacy', 'intrigue', 'trade'] },
      { id: 'pressure', title: '军心与粮道', summary: '真正撑住联盟的不是誓词，而是粮秣与军心。', crisis: '营中一旦乱，盟局就会从内部先碎。', focus: ['domestic', 'military', 'trade'] },
      { id: 'seize', title: '从乱局里抬头', summary: '当别人都在犹豫时，你得靠一场行动把自己抬出来。', crisis: '再拖下去，你只会成为别人夺功的垫脚石。', focus: ['conquest', 'military', 'diplomacy'] }
    ],
    guandu: [
      { id: 'supply', title: '先稳后方', summary: '官渡之前，先决定成败的不是刀，而是粮。', crisis: '前线缺粮，后方每一次误判都可能让大局崩塌。', focus: ['domestic', 'trade', 'investigate'] },
      { id: 'shadow', title: '暗线互咬', summary: '细作、军议、谣言绞在一起，你得先看清谁在下手。', crisis: '真消息和假风声混在一起，判断错一次就足够致命。', focus: ['intrigue', 'investigate', 'diplomacy'] },
      { id: 'decide', title: '战局定手', summary: '真正的胜负手已经不远，你得为那一击积够势能。', crisis: '若不能在关键时点抢先一步，所有筹划都会被反噬。', focus: ['military', 'conquest', 'guidance'] }
    ],
    red_cliffs: [
      { id: 'coalition', title: '同舟未同心', summary: '联军看似并肩，实则各有顾虑，裂口随时会开。', crisis: '一封误信，就足够让同盟先从疑心里烧起来。', focus: ['diplomacy', 'romance', 'intrigue'] },
      { id: 'wind', title: '借风成局', summary: '风向、水军、病气、军心，缺任何一环都撑不起大战。', crisis: '算不准节奏，再好的谋划也只会提前暴露。', focus: ['military', 'trade', 'investigate'] },
      { id: 'inferno', title: '一战定势', summary: '火势将起，谁能抓住那口气，谁就能改写天下。', crisis: '大战逼近，已经没有多少试错空间。', focus: ['conquest', 'military', 'guidance'] }
    ]
  };
  return map[scriptId] || map.yellow_turban;
}

function createFactionSet(scriptId) {
  const common = {
    yellow_turban: [
      { id: 'county_office', name: '郡县官府', role: '地方政务', summary: '守法统、保赋税，但并不总能护住百姓。', stance: '观望', favor: 2, hostility: 18, leverage: 8, power: 58, tags: ['政务', '法统'] },
      { id: 'local_gentry', name: '乡亭豪右', role: '地方豪强', summary: '手里有人有粮，也最看重谁能替他们守住利益。', stance: '审视', favor: 0, hostility: 24, leverage: 10, power: 64, tags: ['乡勇', '田地'] },
      { id: 'turban_remnant', name: '黄巾余部', role: '流动作战', summary: '散而未灭，最懂得怎样在乱局里把裂缝撕大。', stance: '敌视', favor: -12, hostility: 58, leverage: 4, power: 52, tags: ['流兵', '鼓噪'] },
      { id: 'refugee_bands', name: '流民团', role: '民间武装', summary: '想活下来的人聚在一起，谁能给粮，谁就能带他们走。', stance: '观望', favor: 6, hostility: 16, leverage: 6, power: 40, tags: ['流民', '求生'] },
      { id: 'salt_merchants', name: '行商会', role: '商路与钱粮', summary: '谁能保住商路，他们就愿意押注谁。', stance: '中立', favor: 4, hostility: 12, leverage: 14, power: 48, tags: ['商路', '钱粮'] }
    ],
    coalition: [
      { id: 'allied_lords', name: '关东盟军', role: '盟约诸侯', summary: '同举义旗，却并不代表同心。', stance: '观望', favor: 4, hostility: 18, leverage: 12, power: 70, tags: ['会盟', '军令'] },
      { id: 'western_court', name: '西都旧系', role: '朝廷旧势', summary: '人在西京，手仍伸得到关东。', stance: '敌视', favor: -10, hostility: 56, leverage: 8, power: 66, tags: ['权柄', '朝廷'] },
      { id: 'camp_officers', name: '营中宿将', role: '军中骨干', summary: '他们不认盟誓，只认谁能把人和粮压住。', stance: '审视', favor: 2, hostility: 22, leverage: 10, power: 62, tags: ['军中', '宿将'] },
      { id: 'grain_guild', name: '漕粮商盟', role: '转运后勤', summary: '谁能保住粮路，他们就向谁倾斜。', stance: '中立', favor: 5, hostility: 10, leverage: 15, power: 54, tags: ['漕运', '后勤'] }
    ],
    guandu: [
      { id: 'cao_camp', name: '许都曹营', role: '中枢军政', summary: '军令严密，最看重效率和忠诚。', stance: '审视', favor: 5, hostility: 18, leverage: 14, power: 76, tags: ['中枢', '军政'] },
      { id: 'yuan_camp', name: '河北袁营', role: '北地强军', summary: '兵多势众，却也更容易生出轻慢。', stance: '敌视', favor: -12, hostility: 60, leverage: 8, power: 78, tags: ['强军', '河北'] },
      { id: 'capital_clerks', name: '许都吏曹', role: '文书与内政', summary: '章表、军需、调度都要经他们的手。', stance: '观望', favor: 8, hostility: 12, leverage: 12, power: 50, tags: ['文书', '调度'] },
      { id: 'grain_merchants', name: '粮道行会', role: '粮秣商路', summary: '战局越紧，他们手里的票码越重。', stance: '中立', favor: 4, hostility: 10, leverage: 16, power: 55, tags: ['军需', '商道'] }
    ],
    red_cliffs: [
      { id: 'river_alliance', name: '江上联军', role: '江东与荆州盟友', summary: '同舟而行，但每个人都在掂量谁能活到战后。', stance: '审视', favor: 6, hostility: 20, leverage: 14, power: 74, tags: ['联军', '水军'] },
      { id: 'north_expedition', name: '北来大军', role: '北方压境', summary: '兵锋逼江，仗势压人。', stance: '敌视', favor: -14, hostility: 64, leverage: 8, power: 82, tags: ['压境', '兵锋'] },
      { id: 'jiangxia_clans', name: '江夏宗族', role: '地方门阀', summary: '他们最在乎的是战后谁来写规矩。', stance: '观望', favor: 2, hostility: 18, leverage: 12, power: 58, tags: ['门阀', '地方'] },
      { id: 'river_merchants', name: '江港商会', role: '水路转运', summary: '风向和货路决定他们站在哪边。', stance: '中立', favor: 8, hostility: 10, leverage: 18, power: 50, tags: ['水运', '商道'] }
    ]
  };

  return (common[scriptId] || common.yellow_turban).map((item) => Object.assign({}, item));
}

function assignNpcFaction(npcId, factions) {
  const available = factions.map((item) => item.id);
  const map = {
    qulige: available[3] || available[0],
    shen_zhiwei: available[0],
    huo_qinglan: available[1] || available[0],
    lu_yunyao: available[available.length - 1]
  };
  return map[npcId] || available[0];
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
  const factions = createFactionSet(script.id);

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
      playerFactionId: '',
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
      influence: 6,
      statusTags: ['无名', '局外人'],
      lastResolutionSummary: '',
      lastBattleReport: null,
      factions,
      skills: [
        { name: '乱世自保', description: '局势不明时，知道先看风向再落子。', icon: 'fa-solid fa-shield-halved' }
      ],
      items: [],
      relationships: NPCS.map((npc) => ({
        id: npc.id,
        name: npc.name,
        title: npc.title,
        factionId: assignNpcFaction(npc.id, factions),
        status: '初识未深',
        affection: 0,
        trust: npc.id === 'qulige' ? 10 : 0,
        loyalty: 0,
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
  state.gameState.influence += 2;
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
