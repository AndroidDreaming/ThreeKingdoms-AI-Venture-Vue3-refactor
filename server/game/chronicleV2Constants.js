const DEFAULT_MODEL = 'local-fallback';

const SCRIPTS = [
  {
    id: 'yellow_turban',
    name: '黄巾余波',
    startYear: 184,
    openingLocation: '冀州乡亭',
    summary: '黄巾余焰未灭，郡县失序，豪强、流民与寒门都在抢一块能立足的地方。',
    stages: ['州郡震荡', '群豪并起', '粮秣争夺', '余波未平'],
    initialThreads: [
      { key: 'grain_shortage', title: '乡里粮仓将尽，流民与乡勇都盯着最后几车粟米', urgency: 2, domain: 'domestic' },
      { key: 'county_envoy', title: '县府使吏将至，也许带来招徕，也可能带来盘剥', urgency: 1, domain: 'diplomacy' }
    ]
  },
  {
    id: 'coalition',
    name: '关东盟局',
    startYear: 190,
    openingLocation: '陈留驿道',
    summary: '董卓专权，诸侯会盟，盟誓之下各怀盘算，真正先碎掉的往往是军心。',
    stages: ['盟旗初起', '军心离散', '关中风紧', '诸侯自张'],
    initialThreads: [
      { key: 'alliance_crack', title: '盟军粮道不稳，诸侯之间已生观望之意', urgency: 2, domain: 'diplomacy' },
      { key: 'camp_order', title: '军营内掠夺滋生，再不整饬便要先乱己阵', urgency: 1, domain: 'military' }
    ]
  },
  {
    id: 'guandu',
    name: '官渡之前',
    startYear: 200,
    openingLocation: '许都近郊',
    summary: '北方局势悬于一线，粮秣、谋士与人心都会改写大战的走向。',
    stages: ['蓄粮筹兵', '暗线互探', '奇袭伏笔', '北地定形'],
    initialThreads: [
      { key: 'supply_lines', title: '前线催粮日紧，许都一线正在逼着各处输送粟草', urgency: 2, domain: 'domestic' },
      { key: 'spy_hunt', title: '细作混入营中，先露破绽的人就会先死', urgency: 2, domain: 'intrigue' }
    ]
  },
  {
    id: 'red_cliffs',
    name: '赤壁前夜',
    startYear: 208,
    openingLocation: '江夏渡口',
    summary: '水陆相持，盟约脆薄，风向、病气与火势都在改变这场决战。',
    stages: ['联军磨合', '江上疑云', '火势成局', '南北分疆'],
    initialThreads: [
      { key: 'allied_strain', title: '盟友之间互疑未消，一封误信就可能令同舟者反目', urgency: 2, domain: 'diplomacy' },
      { key: 'fleet_drill', title: '水军操练未成，风向与火候都还差最后一层拿捏', urgency: 1, domain: 'military' }
    ]
  }
];

const BACKGROUNDS = [
  {
    id: 'imperial_kin',
    label: '宗室旁支',
    identity: '寒微宗亲',
    stats: { charm: 2, diplomacy: 1, coins: 15 },
    skills: [{ name: '宗牒礼法', description: '知晓名分与礼制，擅长借身份挤进权力边缘。', icon: 'fa-solid fa-scroll' }],
    items: [{ name: '残缺族谱', count: 1 }],
    openingThread: { key: 'ancestral_claim', title: '一卷宗谱或许能替你换来立足之地，也可能引来觊觎', urgency: 1, domain: 'diplomacy' }
  },
  {
    id: 'local_gentry',
    label: '地方豪右',
    identity: '乡亭豪强',
    stats: { military: 1, troops: 18, coins: 30 },
    skills: [{ name: '乡勇号令', description: '熟悉地方势力和乡勇调度，知道人情怎样换成兵。', icon: 'fa-solid fa-flag' }],
    items: [{ name: '家传长刀', count: 1 }],
    openingThread: { key: 'militia_call', title: '乡里盯着你出面整合乡勇，以备乱兵侵掠', urgency: 2, domain: 'military' }
  },
  {
    id: 'fallen_scholar',
    label: '失路书生',
    identity: '寒门士子',
    stats: { domestic: 2, diplomacy: 1, coins: 8 },
    skills: [{ name: '章表筹画', description: '能写能算，擅长从杂乱信息里理出次序。', icon: 'fa-solid fa-feather-pointed' }],
    items: [{ name: '残卷兵书', count: 1 }],
    openingThread: { key: 'clerk_offer', title: '郡中幕府似乎缺一个会写会算又能守口的人', urgency: 1, domain: 'domestic' }
  },
  {
    id: 'merchant_heir',
    label: '商旅后裔',
    identity: '行商之后',
    stats: { coins: 45, charm: 1, diplomacy: 1 },
    skills: [{ name: '市路辨价', description: '熟悉货、路、钱和关系之间的换算。', icon: 'fa-solid fa-coins' }],
    items: [{ name: '账簿', count: 1 }, { name: '绢匹', count: 2 }],
    openingThread: { key: 'trade_route', title: '一条通往州城的商路刚被乱兵切断，谁先接上谁就先活', urgency: 2, domain: 'trade' }
  },
  {
    id: 'refugee',
    label: '乱世流民',
    identity: '流民',
    stats: { conquest: 1, health: -8, military: 1 },
    skills: [{ name: '乱世求生', description: '知道何时躲、何时逃、何时拼命才有活路。', icon: 'fa-solid fa-person-running' }],
    items: [{ name: '粗布包袱', count: 1 }],
    openingThread: { key: 'safe_haven', title: '你必须先找到一处肯收留你的势力或村寨，否则下一阵风就会把你吹散', urgency: 3, domain: 'travel' }
  }
];

const NPCS = [
  { id: 'qulige', name: '曲离歌', title: '江湖隐士', style: '寡言锋利，像是总能先一步听见风向里的祸福。', romanceable: false },
  { id: 'shen_zhiwei', name: '沈知微', title: '郡府书吏', style: '言辞温静，写得一手漂亮章表，眼里却常藏着戒心。', romanceable: true },
  { id: 'huo_qinglan', name: '霍青岚', title: '营中偏将', style: '行事利落，惯在军中压住杂声，少见柔色。', romanceable: true },
  { id: 'lu_yunyao', name: '陆云瑶', title: '盐铁商会管事', style: '眼光很快，笑意从不白给，知道什么叫价码。', romanceable: true }
];

const INTENT_KEYWORDS = {
  background: ['宗室旁支', '地方豪右', '失路书生', '商旅后裔', '乱世流民'],
  domestic: ['内政', '安民', '修渠', '赈济', '理政', '屯田', '整饬民生'],
  diplomacy: ['外交', '结盟', '游说', '谈判', '拜会', '出使', '纵横'],
  military: ['军事', '整军', '练兵', '募兵', '军务', '操练', '整饬营伍'],
  conquest: ['征伐', '出征', '攻城', '追击', '征战', '用兵'],
  romance: ['恋爱', '相会', '寄信', '私语', '赴约', '表白', '情意'],
  intrigue: ['离间', '设伏', '密探', '谋划', '谍报', '反间'],
  trade: ['经商', '贸易', '转运', '筹粮', '筹饷', '商路'],
  investigate: ['查探', '调查', '打听', '侦察', '探明', '寻访'],
  travel: ['启程', '转往', '迁往', '赶路', '转移', '北上', '南下'],
  recover: ['歇息', '休整', '养伤', '调养', '静养'],
  guidance: ['曲离歌', '问策', '请教', '求教', '问计']
};

const INTENT_CONFIG = {
  background: { label: '定下出身', time: 0, domain: 'origin' },
  domestic: { label: '经略内政', time: 1, domain: 'domestic' },
  diplomacy: { label: '纵横外交', time: 1, domain: 'diplomacy' },
  military: { label: '整军练兵', time: 1, domain: 'military' },
  conquest: { label: '征伐攻取', time: 2, domain: 'conquest' },
  romance: { label: '经营情意', time: 1, domain: 'romance' },
  intrigue: { label: '暗线谋局', time: 1, domain: 'intrigue' },
  trade: { label: '转运筹饷', time: 1, domain: 'trade' },
  investigate: { label: '查探局势', time: 1, domain: 'investigate' },
  travel: { label: '迁转行路', time: 1, domain: 'travel' },
  recover: { label: '休整养势', time: 1, domain: 'recover' },
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
