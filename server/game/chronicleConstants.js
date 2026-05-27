const DEFAULT_MODEL = 'local-fallback';

const SCRIPTS = [
  {
    id: 'yellow_turban',
    name: '黄巾之乱',
    startYear: 184,
    openingLocation: '冀州乡亭',
    summary: '黄巾蜂起，州县失序，豪强、寒门与流民都在寻找立足之地。',
    stages: ['州县震荡', '群雄并起', '军府压境', '余波未平'],
    initialThreads: [
      { key: 'grain_shortage', title: '乡里粮仓将尽，流民与乡勇都在盯着最后几车粮', urgency: 2, domain: 'domestic' },
      { key: 'county_envoy', title: '县中使吏将至，或许带来招募，也可能带来盘剥', urgency: 1, domain: 'diplomacy' }
    ]
  },
  {
    id: 'coalition',
    name: '关东联军',
    startYear: 190,
    openingLocation: '陈留驿道',
    summary: '董卓专政，诸侯会盟，军心与私欲并行，胜负未定，人心先散。',
    stages: ['会盟未稳', '军心离散', '关中震荡', '诸侯自立'],
    initialThreads: [
      { key: 'alliance_crack', title: '盟军粮道不稳，诸侯之间已有彼此观望之意', urgency: 2, domain: 'diplomacy' },
      { key: 'camp_order', title: '军营内盗掠滋生，再不整肃便会先乱己阵', urgency: 1, domain: 'military' }
    ]
  },
  {
    id: 'guandu',
    name: '官渡前夕',
    startYear: 200,
    openingLocation: '许都近郊',
    summary: '北方形势悬于一线，粮道、谋士与人心都会改写战争走向。',
    stages: ['筹兵蓄谷', '探路争情', '夜袭反制', '北地定形'],
    initialThreads: [
      { key: 'supply_lines', title: '前线缺粮，许都正在催押运粮草北上', urgency: 2, domain: 'domestic' },
      { key: 'spy_hunt', title: '细作混入军府，许多人都在看谁先露出破绽', urgency: 2, domain: 'intrigue' }
    ]
  },
  {
    id: 'red_cliffs',
    name: '赤壁前夜',
    startYear: 208,
    openingLocation: '江夏渡口',
    summary: '水陆相持，盟约脆弱，瘟气与火势都在江风里酝酿。',
    stages: ['联军磨合', '江上疑云', '火攻成局', '南北分势'],
    initialThreads: [
      { key: 'allied_strain', title: '盟友间互疑未消，一封误信就可能裂盟', urgency: 2, domain: 'diplomacy' },
      { key: 'fleet_drill', title: '水军操练未成，火候与风向都还差最后一步', urgency: 1, domain: 'military' }
    ]
  }
];

const BACKGROUNDS = [
  {
    id: 'imperial_kin',
    label: '宗室旁支',
    identity: '寒门宗亲',
    stats: { charm: 2, diplomacy: 1, coins: 15 },
    skills: [{ name: '宗籍礼法', description: '知晓名分与礼制，擅长借名望进入权力边缘。', icon: 'fa-solid fa-scroll' }],
    items: [{ name: '残缺族谱', count: 1 }],
    openingThread: { key: 'ancestral_claim', title: '一卷宗谱也许能替你换来一席立身之地', urgency: 1, domain: 'diplomacy' }
  },
  {
    id: 'local_gentry',
    label: '地方豪右',
    identity: '乡亭豪强',
    stats: { military: 1, troops: 18, coins: 30 },
    skills: [{ name: '乡勇号令', description: '熟悉乡勇调度和地方势力的人情往来。', icon: 'fa-solid fa-flag' }],
    items: [{ name: '家传长刀', count: 1 }],
    openingThread: { key: 'militia_call', title: '乡里盼你出面整合乡勇，以备乱兵侵袭', urgency: 2, domain: 'military' }
  },
  {
    id: 'fallen_scholar',
    label: '失路书生',
    identity: '寒门士子',
    stats: { domestic: 2, diplomacy: 1, coins: 8 },
    skills: [{ name: '章表筹画', description: '能写能算，善于从杂乱信息中捋出次序。', icon: 'fa-solid fa-feather-pointed' }],
    items: [{ name: '残卷兵书', count: 1 }],
    openingThread: { key: 'clerk_offer', title: '郡中幕府似乎缺一名会写会算的人', urgency: 1, domain: 'domestic' }
  },
  {
    id: 'merchant_heir',
    label: '行商后裔',
    identity: '商旅后人',
    stats: { coins: 45, charm: 1, diplomacy: 1 },
    skills: [{ name: '市路辨价', description: '知道货、路、钱和关系怎样互相换算。', icon: 'fa-solid fa-coins' }],
    items: [{ name: '账簿', count: 1 }, { name: '绢匹', count: 2 }],
    openingThread: { key: 'trade_route', title: '一条通往州城的商路正被乱兵切断', urgency: 2, domain: 'trade' }
  },
  {
    id: 'refugee',
    label: '乱世流民',
    identity: '流民',
    stats: { conquest: 1, health: -8, military: 1 },
    skills: [{ name: '乱世求生', description: '知道何时躲、何时逃、何时拼命才有活路。', icon: 'fa-solid fa-person-running' }],
    items: [{ name: '粗布包裹', count: 1 }],
    openingThread: { key: 'safe_haven', title: '你必须尽快找到可以栖身的势力或村寨', urgency: 3, domain: 'romance' }
  }
];

const NPCS = [
  { id: 'qulige', name: '曲离歌', title: '江湖隐士', style: '寡言锐利，像是总能从风向里先听见祸福。', romanceable: false },
  { id: 'shen_zhiwei', name: '沈知微', title: '郡府书吏', style: '言辞温静，写得一手漂亮章表，眼里却常藏着警惕。', romanceable: true },
  { id: 'huo_qinglan', name: '霍青岚', title: '营中偏将', style: '行事利落，惯在军中压住杂声，少有柔色。', romanceable: true }
];

const INTENT_KEYWORDS = {
  background: ['宗室旁支', '地方豪右', '失路书生', '行商后裔', '乱世流民'],
  domestic: ['安民', '整饬', '屯田', '赈济', '修渠', '治政', '内政', '理政'],
  diplomacy: ['结盟', '游说', '拜会', '谈判', '出使', '结交', '纵横', '外交'],
  military: ['练兵', '整军', '募兵', '军务', '操练', '整肃营伍', '军事'],
  conquest: ['征伐', '出征', '攻城', '突袭', '用兵', '追击', '征战'],
  romance: ['赴约', '私语', '寄信', '相会', '赠礼', '恋爱', '情意', '表白'],
  intrigue: ['离间', '设伏', '收买', '反间', '谍报', '密探', '谋划'],
  trade: ['经商', '买卖', '转运', '筹粮', '筹饷', '贸易'],
  investigate: ['打探', '查访', '侦察', '探明', '寻访', '调查'],
  travel: ['启程', '转往', '北上', '南下', '西进', '东去', '赶路'],
  recover: ['歇息', '调养', '养伤', '静候', '休整'],
  guidance: ['曲离歌', '问策', '求教', '请教', '隐士']
};

const INTENT_CONFIG = {
  background: { label: '定下出身', time: 0, domain: 'origin' },
  domestic: { label: '经略内政', time: 1, domain: 'domestic' },
  diplomacy: { label: '周旋纵横', time: 1, domain: 'diplomacy' },
  military: { label: '整军练兵', time: 1, domain: 'military' },
  conquest: { label: '征伐用兵', time: 2, domain: 'conquest' },
  romance: { label: '经营情意', time: 1, domain: 'romance' },
  intrigue: { label: '暗线谋局', time: 1, domain: 'intrigue' },
  trade: { label: '筹粮筹饷', time: 1, domain: 'trade' },
  investigate: { label: '查访情势', time: 1, domain: 'investigate' },
  travel: { label: '改道转移', time: 1, domain: 'travel' },
  recover: { label: '歇息养势', time: 1, domain: 'recover' },
  guidance: { label: '向隐士问策', time: 0, domain: 'guidance' },
  unknown: { label: '临机应变', time: 1, domain: 'unknown' }
};

module.exports = {
  DEFAULT_MODEL,
  SCRIPTS,
  BACKGROUNDS,
  NPCS,
  INTENT_KEYWORDS,
  INTENT_CONFIG
};
