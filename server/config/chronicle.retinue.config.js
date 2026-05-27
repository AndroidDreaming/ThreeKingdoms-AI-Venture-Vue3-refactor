const RETINUE_DEFAULTS = {
  capacity: 6,
  recruitChoiceLimit: 4,
  appointChoiceLimit: 5,
  teamChoiceLimit: 10
};

const RETINUE_ROLE_DEFINITIONS = [
  {
    id: 'steward',
    name: '内务主事',
    domain: '经营',
    slotLabel: '内务',
    tagsAnyOf: ['govern', 'trade', 'mercantile', 'courtcraft'],
    recruit: { minTrust: 16, minLoyalty: 4, minScore: 34, minStrategyRating: 58 },
    appointDelta: { governance: 1, supplies: 3, influence: 1 },
    supportDelta: {
      govern: { governance: 1, supplies: 2, fatigue: -1 },
      trade: { coins: 2, supplies: 2 },
      sect: { sectFavor: 1, supplies: 1 },
      diplomacy: { diplomacy: 1, influence: 1 },
      rest: { fatigue: -1, morale: 1 }
    },
    functions: ['盘账清册', '稳住仓储', '照看后方'],
    yieldText: '让经营与后勤动作更稳，更容易把钱粮落到实处。'
  },
  {
    id: 'quartermaster',
    name: '军需总管',
    domain: '经营',
    slotLabel: '军需',
    tagsAnyOf: ['trade', 'govern', 'military', 'frontier', 'mercantile'],
    recruit: { minTrust: 18, minLoyalty: 5, minScore: 36, minStrategyRating: 54 },
    appointDelta: { supplies: 4, morale: 1 },
    supportDelta: {
      military: { supplies: 3, morale: 1 },
      battle: { supplies: 2, morale: 1 },
      warpath: { supplies: 2, morale: 1 },
      trade: { supplies: 2, coins: 2 },
      rest: { health: 1, morale: 1, fatigue: -1 },
      martial: { health: 1, morale: 1 }
    },
    functions: ['调度粮秣', '整备甲械', '梳理军资'],
    yieldText: '能把经营收益转成部曲可用的补给与士气。'
  },
  {
    id: 'counselor',
    name: '帐前参议',
    domain: '谋略',
    slotLabel: '参议',
    tagsAnyOf: ['strategy', 'investigate', 'diplomacy', 'courtcraft', 'govern'],
    recruit: { minTrust: 18, minLoyalty: 4, minScore: 36, minStrategyRating: 66 },
    appointDelta: { strategy: 2, influence: 1 },
    supportDelta: {
      investigate: { strategy: 2, fatigue: -1 },
      intrigue: { strategy: 1, influence: 1 },
      diplomacy: { diplomacy: 1, influence: 1 },
      sect: { diplomacy: 1, strategy: 1, sectFavor: 1 },
      martial: { martialInsight: 1 }
    },
    functions: ['梳理线头', '预判局势', '替你压后手'],
    yieldText: '让谋略与交涉类动作更容易拿到清晰收益。'
  },
  {
    id: 'spymaster',
    name: '暗线统筹',
    domain: '谋略',
    slotLabel: '暗线',
    tagsAnyOf: ['intrigue', 'investigate', 'shadow', 'strategy', 'travel'],
    recruit: { minTrust: 20, minLoyalty: 4, minScore: 38, minStrategyRating: 62 },
    appointDelta: { strategy: 1, influence: 1 },
    supportDelta: {
      investigate: { strategy: 1, influence: 1 },
      intrigue: { strategy: 2, influence: 2 },
      jianghu: { jianghuPrestige: 1 },
      diplomacy: { influence: 2, strategy: 1 },
      sect: { strategy: 1, sectFavor: 1 }
    },
    functions: ['放线试口', '接驳耳目', '反查消息源头'],
    yieldText: '能把探查和布局做深，减少空转。'
  },
  {
    id: 'scout',
    name: '江湖耳目',
    domain: '江湖',
    slotLabel: '耳目',
    tagsAnyOf: ['jianghu', 'travel', 'shadow', 'martial', 'xuanfeng'],
    recruit: { minTrust: 16, minLoyalty: 3, minScore: 32, minMartialRating: 48 },
    appointDelta: { jianghuPrestige: 2, influence: 1 },
    supportDelta: {
      jianghu: { jianghuPrestige: 2, renown: 1 },
      investigate: { influence: 1, strategy: 1 },
      rest: { fatigue: -1, morale: 1 },
      diplomacy: { influence: 1, renown: 1 },
      sect: { jianghuPrestige: 1, sectFavor: 1 },
      martial: { martialInsight: 1 }
    },
    functions: ['踩点摸路', '打听门道', '替你提前认场'],
    yieldText: '能把江湖线与奇遇线更快接起来。'
  },
  {
    id: 'escort',
    name: '护行客卿',
    domain: '江湖',
    slotLabel: '护行',
    tagsAnyOf: ['martial', 'battle', 'travel', 'qingnang', 'jianghu'],
    recruit: { minTrust: 18, minLoyalty: 5, minScore: 35, minMartialRating: 62 },
    appointDelta: { health: 2, morale: 1 },
    supportDelta: {
      martial: { martialLevel: 1, health: 1 },
      jianghu: { martialLevel: 1, jianghuPrestige: 1 },
      travel: { health: 1, fatigue: -1 },
      rest: { health: 2, fatigue: -1 },
      sect: { martialLevel: 1, sectFavor: 1 }
    },
    functions: ['护行压阵', '替你试招', '关键时刻保命'],
    yieldText: '让江湖与武学动作更稳，不容易被反噬。'
  },
  {
    id: 'drillmaster',
    name: '部曲教头',
    domain: '军旅',
    slotLabel: '教头',
    tagsAnyOf: ['military', 'battle', 'frontier', 'warpath', 'martial'],
    recruit: { minTrust: 18, minLoyalty: 6, minScore: 38, minMartialRating: 68 },
    appointDelta: { military: 2, morale: 2 },
    supportDelta: {
      military: { military: 2, morale: 2, troops: 6 },
      battle: { morale: 2, troops: 4 },
      warpath: { military: 1, morale: 2 },
      martial: { martialLevel: 1, martialInsight: 1, morale: 1 },
      rest: { morale: 2, fatigue: -1 }
    },
    functions: ['操练部曲', '校正伍号', '把散兵练成可用的人'],
    yieldText: '能把军旅动作更稳定地转成士气与可用战力。'
  },
  {
    id: 'vanguard',
    name: '亲卫先锋',
    domain: '军旅',
    slotLabel: '先锋',
    tagsAnyOf: ['battle', 'warpath', 'frontier', 'martial', 'travel'],
    recruit: { minTrust: 20, minLoyalty: 6, minScore: 40, minMartialRating: 72 },
    appointDelta: { renown: 1, morale: 2 },
    supportDelta: {
      battle: { battlefieldPrestige: 2, morale: 2 },
      warpath: { battlefieldPrestige: 2, renown: 1 },
      jianghu: { renown: 1 },
      martial: { martialLevel: 1, renown: 1 },
      diplomacy: { renown: 1 },
      sect: { renown: 1, sectFavor: 1 }
    },
    functions: ['压阵冲锋', '带头啃硬仗', '在险局里替你撑场'],
    yieldText: '能把军功、威望与阵前气势更快打出来。'
  }
];

const TEAM_ACTION_DEFINITIONS = [
  {
    id: 'team_logistics',
    kind: 'govern',
    text: '调度后勤线',
    hint: '让经营人手把账册、粮栈和后路一起拢紧，换一回更扎实的后方收益。',
    category: '队伍动作',
    requiredRolesAnyOf: ['steward', 'quartermaster'],
    requiredRoleCount: 1,
    baseDelta: { governance: 2, supplies: 10, coins: 6, fatigue: 5 },
    summaryTemplate: '我把后勤线整个压到台面上，让队伍里的经营人手去清账、调仓、补后路，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_trade',
    kind: 'trade',
    text: '铺开商路网',
    hint: '由经营人手分头跑铺面、接货路，把钱粮和外部门路一起盘活。',
    category: '队伍动作',
    requiredRolesAnyOf: ['steward', 'quartermaster'],
    requiredRoleCount: 1,
    baseDelta: { commerce: 2, coins: 12, supplies: 8, fatigue: 6 },
    summaryTemplate: '我把人手撒到铺面、仓口和货路上，试着把分散的钱粮门路拢成一张可用的网，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_probe',
    kind: 'investigate',
    text: '铺耳目探风向',
    hint: '让参议和耳目分层摸口风，比单人硬查更适合滚出有效消息。',
    category: '队伍动作',
    requiredRolesAnyOf: ['counselor', 'spymaster', 'scout'],
    requiredRoleCount: 1,
    baseDelta: { strategy: 2, influence: 2, fatigue: 4 },
    summaryTemplate: '我把耳目和参议一起放出去，让明线暗线同时去摸局势缝隙，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_layout',
    kind: 'intrigue',
    text: '拆线设回钩',
    hint: '让暗线人手和参议协同落子，适合做更深一层的试探与反制。',
    category: '队伍动作',
    requiredRolesAnyOf: ['counselor', 'spymaster'],
    requiredRoleCount: 1,
    baseDelta: { strategy: 2, influence: 3, fatigue: 5 },
    summaryTemplate: '我把局拆成几层，让懂暗线的人各自去落钩、递话、看反应，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_roam',
    kind: 'jianghu',
    text: '放队友走江湖',
    hint: '由江湖耳目与护行客卿先去探场，适合奇遇、名号和新人物线。',
    category: '队伍动作',
    requiredRolesAnyOf: ['scout', 'escort'],
    requiredRoleCount: 1,
    baseDelta: { jianghuPrestige: 8, renown: 2, fatigue: 5 },
    summaryTemplate: '我把能认地、能护行的人先放出去，让江湖上的名号和门路自己朝我这边聚，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_muster',
    kind: 'military',
    text: '整编营中部曲',
    hint: '由教头、先锋和军需协同，适合练兵、整补与扩充可用部曲。',
    category: '队伍动作',
    requiredRolesAnyOf: ['drillmaster', 'vanguard', 'quartermaster'],
    requiredRoleCount: 1,
    baseDelta: { military: 2, troops: 18, morale: 6, supplies: -4, fatigue: 6 },
    summaryTemplate: '我把营里的骨架先扶正，让教头、先锋和军需人手各守一摊，把部曲整成真能动的样子，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_parley',
    kind: 'diplomacy',
    text: '分头游说定站位',
    hint: '把参议、耳目和内务人手分头放出去，先把场面、人心和价码一起摸实。',
    category: '队伍动作',
    requiredRolesAnyOf: ['counselor', 'spymaster', 'steward', 'scout'],
    requiredRoleCount: 2,
    baseDelta: { diplomacy: 3, influence: 5, renown: 2, fatigue: 5 },
    summaryTemplate: '我让队里能说话、会看风向的人分头去游说试价，把原本散着的人心和站位往一张桌上拢，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_sect_affairs',
    kind: 'sect',
    text: '整饬门内外缘',
    hint: '由熟门路的人去理门中人情、外门往来与山门体面，让门派线不只停在个人拜访上。',
    category: '队伍动作',
    requiredRolesAnyOf: ['steward', 'counselor', 'escort', 'scout'],
    requiredRoleCount: 2,
    baseDelta: { sectFavor: 5, sectPower: 4, influence: 2, fatigue: 6 },
    summaryTemplate: '我把门中内外两层一起收拾，让懂人情、懂场面、懂护行的人各接一段，把门派这张网往自己身边收紧，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_recover',
    kind: 'rest',
    text: '轮值整补养锐',
    hint: '不只是自己歇口气，而是让队里的人轮值照料、整备和护持，换一回更完整的恢复。',
    category: '队伍动作',
    requiredRolesAnyOf: ['quartermaster', 'escort', 'scout', 'drillmaster'],
    requiredRoleCount: 2,
    baseDelta: { health: 8, fatigue: -12, morale: 4 },
    summaryTemplate: '我没有一个人硬撑，而是让队里轮值照料、补给、守夜和安顿，把整支班底的气一起缓回来，这一回结果是“{tierText}”。'
  },
  {
    id: 'team_martial',
    kind: 'martial',
    text: '合练拆招磨路数',
    hint: '由护行、教头和先锋陪练对拆，把自己的武学长进变成一整套更稳的推进。',
    category: '队伍动作',
    requiredRolesAnyOf: ['escort', 'drillmaster', 'vanguard', 'scout'],
    requiredRoleCount: 2,
    baseDelta: { martialLevel: 3, martialInsight: 3, renown: 1, health: -2, fatigue: 8 },
    summaryTemplate: '我让队里最懂拳脚、最能扛场的人陪着合练拆招，把一时手感慢慢磨成能反复取用的路数，这一回结果是“{tierText}”。'
  }
];

module.exports = {
  RETINUE_DEFAULTS,
  RETINUE_ROLE_DEFINITIONS,
  TEAM_ACTION_DEFINITIONS
};
