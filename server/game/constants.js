const DEFAULT_MODEL = 'local-fallback';

const SCRIPTS = [
  {
    id: 'yellow_turban',
    name: '黄巾之乱',
    startYear: 184,
    openingLocation: '冀州乡野',
    summary: '黄巾席卷州郡，豪强与寒门都在寻找立足之地。',
    stages: ['州县骚动', '豪强并起', '朝廷征讨', '余波未平'],
    initialThreads: [
      { key: 'bandit_pressure', title: '流民与乱兵逼近村庄', urgency: 2 },
      { key: 'grain_shortage', title: '乡里粮仓见底', urgency: 1 }
    ]
  },
  {
    id: 'coalition',
    name: '反董卓联盟',
    startYear: 190,
    openingLocation: '陈留驿道',
    summary: '董卓专政，关东诸侯结盟，天下英雄相继现身。',
    stages: ['诸侯会盟', '军心离散', '关中震动', '群雄自立'],
    initialThreads: [
      { key: 'coalition_supply', title: '盟军粮道不稳', urgency: 2 },
      { key: 'warlord_contact', title: '地方豪杰正在招揽人才', urgency: 1 }
    ]
  },
  {
    id: 'guandu',
    name: '官渡之战前夕',
    startYear: 200,
    openingLocation: '许都外围',
    summary: '北方胜负悬于一线，军粮、谋略与人心都可能改写战局。',
    stages: ['战前筹备', '粮道争夺', '夜袭与反制', '北方易主'],
    initialThreads: [
      { key: 'supply_lines', title: '粮草转运需要可靠人手', urgency: 2 },
      { key: 'spy_hunt', title: '敌方细作已潜入营中', urgency: 2 }
    ]
  },
  {
    id: 'red_cliffs',
    name: '赤壁鏖战',
    startYear: 208,
    openingLocation: '江夏渡口',
    summary: '荆楚风云激荡，水战、盟约与疫病交错成局。',
    stages: ['联军磨合', '疫病蔓延', '火攻筹谋', '江东定局'],
    initialThreads: [
      { key: 'fleet_prep', title: '水军尚未完全整编', urgency: 2 },
      { key: 'alliance_strain', title: '盟友之间互有猜疑', urgency: 1 }
    ]
  }
];

const BACKGROUNDS = [
  {
    id: 'imperial_kin',
    label: '汉室宗亲',
    identity: '寒门宗亲',
    stats: { charm: 2, defense: 1, coins: 15 },
    skills: [
      { name: '宗室礼法', description: '擅长分辨名分与礼制，交涉时更容易取得信任。', icon: 'fa-solid fa-scroll' }
    ],
    items: [{ name: '旧族谱', count: 1 }],
    openingThread: { key: 'ancestral_claim', title: '一卷残缺宗谱或许能证明你的来历', urgency: 1 }
  },
  {
    id: 'local_gentry',
    label: '地方豪强',
    identity: '乡里豪强',
    stats: { attack: 1, troops: 20, coins: 30 },
    skills: [
      { name: '乡勇号令', description: '熟悉乡勇组织与地方豪强的用人之道。', icon: 'fa-solid fa-flag' }
    ],
    items: [{ name: '家传长刀', count: 1 }],
    openingThread: { key: 'village_militia', title: '邻里希望你出面整合乡勇', urgency: 2 }
  },
  {
    id: 'fallen_scholar',
    label: '落魄士人',
    identity: '寒门士子',
    stats: { defense: 2, charm: 1, coins: 10 },
    skills: [
      { name: '书案筹谋', description: '擅长写文书、算粮秣和推演局势。', icon: 'fa-solid fa-feather-pointed' }
    ],
    items: [{ name: '残卷兵书', count: 1 }],
    openingThread: { key: 'talent_recommendation', title: '一名县吏愿意将你举荐给上官', urgency: 1 }
  },
  {
    id: 'merchant_heir',
    label: '行商之子',
    identity: '商旅后人',
    stats: { coins: 45, agility: 1, charm: 1 },
    skills: [
      { name: '市易察色', description: '识价敏锐，擅长周转货物和打点关系。', icon: 'fa-solid fa-coins' }
    ],
    items: [
      { name: '账簿', count: 1 },
      { name: '绢匹', count: 2 }
    ],
    openingThread: { key: 'trade_route', title: '一条通往州城的商路正被乱兵切断', urgency: 2 }
  },
  {
    id: 'refugee',
    label: '战乱流民',
    identity: '流民',
    stats: { agility: 2, health: -10, attack: 1 },
    skills: [
      { name: '乱世求生', description: '擅长躲避兵灾、寻找藏身之所与生路。', icon: 'fa-solid fa-person-running' }
    ],
    items: [{ name: '粗布包袱', count: 1 }],
    openingThread: { key: 'survival', title: '你必须尽快找到能安身的势力或村寨', urgency: 3 }
  }
];

const NPCS = [
  {
    id: 'qulige',
    name: '曲离歌',
    title: '江湖隐士',
    style: '话少而锋利，像是早就看透天下风雨，却总留半句不说。'
  }
];

const INTENT_KEYWORDS = {
  background: ['汉室宗亲', '地方豪强', '落魄士人', '行商之子', '战乱流民'],
  recruit: ['招募', '募兵', '征兵', '收拢', '聚众', '乡勇'],
  train: ['训练', '练兵', '习武', '修习', '钻研', '演练'],
  investigate: ['侦察', '调查', '打探', '探查', '潜入', '摸清'],
  diplomacy: ['拜访', '游说', '结盟', '议和', '求见', '交涉'],
  trade: ['经商', '交易', '买卖', '筹钱', '贩运', '售卖'],
  govern: ['安民', '屯田', '修渠', '治理', '整顿', '赈济', '修筑'],
  intrigue: ['策反', '离间', '设伏', '收买', '造谣', '奇袭', '谋划'],
  battle: ['进攻', '攻城', '迎战', '出击', '截杀', '冲阵', '厮杀'],
  travel: ['前往', '出发', '北上', '南下', '西进', '东行', '赶赴'],
  rest: ['休整', '休息', '疗伤', '等待', '观望', '驻守'],
  socialize: ['结交', '探望', '拜会', '请教', '招揽', '宴请'],
  guidance: ['曲离歌', '隐士', '求教', '指点']
};

const INTENT_CONFIG = {
  background: { label: '选定出身', stat: 'charm', time: 0 },
  recruit: { label: '整合人手', stat: 'charm', time: 1 },
  train: { label: '修习与练兵', stat: 'attack', time: 1 },
  investigate: { label: '探查情报', stat: 'defense', time: 1 },
  diplomacy: { label: '周旋游说', stat: 'charm', time: 1 },
  trade: { label: '经营筹资', stat: 'coins', time: 1 },
  govern: { label: '治理地方', stat: 'defense', time: 1 },
  intrigue: { label: '暗中谋划', stat: 'defense', time: 1 },
  battle: { label: '正面交锋', stat: 'attack', time: 1 },
  travel: { label: '迁移赶路', stat: 'agility', time: 1 },
  rest: { label: '休整观势', stat: 'health', time: 1 },
  socialize: { label: '经营人脉', stat: 'charm', time: 1 },
  guidance: { label: '向隐士求教', stat: 'defense', time: 0 },
  unknown: { label: '随机应变', stat: 'agility', time: 1 }
};

module.exports = {
  DEFAULT_MODEL,
  SCRIPTS,
  BACKGROUNDS,
  NPCS,
  INTENT_KEYWORDS,
  INTENT_CONFIG
};
