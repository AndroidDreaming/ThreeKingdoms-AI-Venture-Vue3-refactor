const { SECT_DIRECTORY, CITY_SECT_MAP } = require('./chronicleV5SectDirectoryJY');

const BACKGROUNDS_CONTENT = [
  {
    id: 'imperial_kin',
    label: '汉室旁支',
    identity: '没落宗亲',
    description: '门第还有余温，人脉却散得差不多了。你熟悉礼法、名分与朝局缝隙，擅长借旧牌面为自己开路。',
    skill: { id: 'ritual_literacy', name: '宗室礼法', type: '出身', level: '熟练', effect: '外交和名分相关的行动更容易打开局面。' }
  },
  {
    id: 'local_gentry',
    label: '乡里武备',
    identity: '乡里主事',
    description: '家里有田亩、有乡勇，也有一群等着看你能不能撑住局面的乡党。你的路更像先稳盘，再图势。',
    skill: { id: 'militia_command', name: '乡勇号令', type: '出身', level: '熟练', effect: '募兵和整军更容易拿到稳定收益。' }
  },
  {
    id: 'fallen_scholar',
    label: '失路士子',
    identity: '寒门士人',
    description: '你会写、会算、会看局。乱世未必认文章，但一定认得懂局的人。',
    skill: { id: 'memorial_craft', name: '章表筹画', type: '出身', level: '熟练', effect: '治理、调查与谋略类行动更稳定。' }
  },
  {
    id: 'merchant_heir',
    label: '商旅后人',
    identity: '行商之后',
    description: '你知道哪里缺货，谁在囤粮，哪条路能把一车盐换成一支队伍的口粮。',
    skill: { id: 'market_instinct', name: '市路嗅觉', type: '出身', level: '熟练', effect: '经商与转运时的资金消耗更低，收益更稳。' }
  },
  {
    id: 'refugee',
    label: '乱世流民',
    identity: '流离之人',
    description: '你没有显赫出身，只剩活下来的本能。你知道什么时候躲，什么时候拼，什么时候拿命换一口气。',
    skill: { id: 'survival_instinct', name: '乱世求生', type: '出身', level: '熟练', effect: '低资源时的惩罚更轻，逆风局更容易止损。' }
  }
];

const SECTS_CONTENT = [
  {
    id: 'taibai',
    name: '太白门',
    region: '关中',
    style: '剑脉',
    summary: '重身法、破绽和决断，讲求一线见锋，也最重名节与眼力。',
    trainingBonus: { martialLevel: 4, strategy: 1 }
  },
  {
    id: 'canglang',
    name: '沧浪会',
    region: '荆州',
    style: '刀阵',
    summary: '多行旅与旧军户，刀路狠直，最重压阵不退和正面硬撑。',
    trainingBonus: { martialLevel: 5, military: 1 }
  },
  {
    id: 'qingnang',
    name: '青囊馆',
    region: '江淮',
    style: '养脉',
    summary: '医理与武理并修，重调息、续战与识人，越拖越稳。',
    trainingBonus: { martialLevel: 3, maxHealth: 4, governance: 1 }
  },
  {
    id: 'xuanfeng',
    name: '玄锋寨',
    region: '河北',
    style: '枪骑',
    summary: '擅长奔袭、骑冲与前线穿插，讲求一口气压到对手断势。',
    trainingBonus: { martialLevel: 4, military: 2 }
  }
];

const CITIES_CONTENT = [
  { id: 'luoyang', name: '洛阳', region: '司隶', x: 7, y: 4, description: '旧都残火未尽，宗室、旧臣、官署与细作都在这里留下影子。', tags: ['朝局', '宗室', '旧都'], eventHooks: ['废宫旧案', '宫中旧识', '旧臣余脉'], localFactionId: '', sectId: 'taibai' },
  { id: 'changan', name: '长安', region: '关中', x: 3, y: 4, description: '关中壁垒相接，粮道与军情纠缠，谁能站稳这里，谁就捏住西线声势。', tags: ['关中', '军镇', '粮道'], eventHooks: ['军府征调', '关中门吏', '边军余部'], localFactionId: '', sectId: 'taibai' },
  { id: 'hanzhong', name: '汉中', region: '汉中', x: 4, y: 6, description: '北接秦陇，南控入蜀咽喉，山道一闭便像把门彻底闩死。', tags: ['山道', '关隘', '军镇'], eventHooks: ['栈道余火', '关城换防', '米仓旧线'], localFactionId: '', sectId: 'taibai' },
  { id: 'yecheng', name: '邺城', region: '河北', x: 9, y: 1, description: '河北沃野与兵锋并存，粮仓、军府和驿路一处紧过一处。', tags: ['河北', '兵锋', '粮仓'], eventHooks: ['军府调粮', '粮仓争夺', '旧营余脉'], localFactionId: '', sectId: 'xuanfeng' },
  { id: 'pingyuan', name: '平原', region: '青州', x: 10, y: 2, description: '齐鲁门户四通八达，粮道、驿站和流民总能在这里撞成一团。', tags: ['齐鲁', '粮道', '驿站'], eventHooks: ['州界巡缉', '坞堡争粮', '旧将借道'], localFactionId: '', sectId: 'xuanfeng' },
  { id: 'beiping', name: '北平', region: '幽州', x: 11, y: 0, description: '北地风烈马快，边军、胡市和旧营把这里磨成一片硬地。', tags: ['幽州', '边军', '骑军'], eventHooks: ['边骑入塞', '胡市纠纷', '旧营征发'], localFactionId: '', sectId: 'xuanfeng' },
  { id: 'xuchang', name: '许昌', region: '豫州', x: 8, y: 4, description: '文书、军令、钱粮在这里绞成一股绳，任何一步都带着中枢的影子。', tags: ['中枢', '文书', '军政'], eventHooks: ['曹营征辟', '台阁旧案', '仓曹调度'], localFactionId: '', sectId: 'qingnang' },
  { id: 'shouchun', name: '寿春', region: '淮南', x: 9, y: 5, description: '淮南水陆皆通，最适合聚兵屯粮，也最容易让野心一夜膨胀。', tags: ['淮南', '兵粮', '渡口'], eventHooks: ['桥津封锁', '淮南旧部', '粮船失踪'], localFactionId: '', sectId: 'qingnang' },
  { id: 'pengcheng', name: '彭城', region: '徐州', x: 10, y: 4, description: '徐州腹心，南北客商和军伍都绕不开这里，消息也传得最快。', tags: ['徐州', '通衢', '市井'], eventHooks: ['驿骑换马', '州府盘查', '酒肆流言'], localFactionId: '', sectId: 'qingnang' },
  { id: 'xiapi', name: '下邳', region: '徐州', x: 10, y: 5, description: '临泗控路，城门、军府与市井脾气都硬，一朝失衡便是满城风雨。', tags: ['徐州', '军府', '城门'], eventHooks: ['城门夜警', '营盘哗变', '客商压价'], localFactionId: '', sectId: 'qingnang' },
  { id: 'xiaopei', name: '小沛', region: '徐州', x: 9, y: 4, description: '地方不算大，却总卡在兵家借道的节点上，稍有风吹草动就会卷进战局。', tags: ['徐州', '借道', '屯兵'], eventHooks: ['借粮风波', '驿路追骑', '役夫聚集'], localFactionId: '', sectId: 'xuanfeng' },
  { id: 'guangling', name: '广陵', region: '徐州', x: 11, y: 6, description: '靠江吃水，也靠市井活命，盐铁、舟船和官署文书在此彼此咬合。', tags: ['江淮', '商路', '盐铁'], eventHooks: ['盐亭失火', '漕船暗斗', '官署宴请'], localFactionId: '', sectId: 'qingnang' },
  { id: 'wan', name: '宛城', region: '南阳', x: 7, y: 5, description: '南北路冲，谁在这里立旗，谁就能把荆豫边线搅得不安宁。', tags: ['南阳', '军镇', '路冲'], eventHooks: ['城门换防', '粮栈起火', '旧军投帖'], localFactionId: '', sectId: 'canglang' },
  { id: 'xinye', name: '新野', region: '荆北', x: 7, y: 6, description: '夹在宛襄之间，地方不大，却总是最先听见北风往哪边转。', tags: ['荆北', '前线', '驿路'], eventHooks: ['驿卒惊报', '里门闭锁', '借宿客人'], localFactionId: '', sectId: 'canglang' },
  { id: 'xiangyang', name: '襄阳', region: '荆州', x: 8, y: 7, description: '南北交通之锁，人物杂处，谋士、商旅与流军都喜欢在这里换气。', tags: ['荆州', '交通', '谋士'], eventHooks: ['州府宴客', '渡口税争', '江汉旧部'], localFactionId: '', sectId: 'canglang' },
  { id: 'jiangling', name: '江陵', region: '荆州', x: 7, y: 8, description: '水陆交汇，最适合囤粮、练兵，也最容易被人盯上。', tags: ['水路', '囤粮', '兵站'], eventHooks: ['船队夜火', '仓廪亏空', '私盐暗线'], localFactionId: '', sectId: 'canglang' },
  { id: 'changsha', name: '长沙', region: '荆南', x: 8, y: 10, description: '荆南粮土丰厚，郡县绵密，外人若想深入，先得过仓曹、郡兵和水路盘查。', tags: ['荆南', '粮土', '郡县'], eventHooks: ['郡兵盘仓', '山路扰边', '渠堰争水'], localFactionId: '', sectId: 'canglang' },
  { id: 'wuling', name: '武陵', region: '荆南', x: 6, y: 10, description: '山水深密，行路看似慢，消息却常沿着水道比人先到。', tags: ['山水', '溪路', '隐路'], eventHooks: ['溪寨借道', '猎户报讯', '盐道伏击'], localFactionId: '', sectId: 'canglang' },
  { id: 'hefei', name: '合肥', region: '扬州', x: 10, y: 6, description: '江淮锁钥，兵站和水陆渡口全卡在这里，守得住就能钉住东线。', tags: ['江淮', '锁钥', '兵站'], eventHooks: ['淝水夜巡', '斥候来报', '屯田争役'], localFactionId: '', sectId: 'qingnang' },
  { id: 'jianye', name: '建业', region: '江东', x: 12, y: 7, description: '江东新气正盛，军府、舟师与商会互相纠缠，适合借势，也最容易卷进大局。', tags: ['江东', '军府', '水军'], eventHooks: ['官署宴帖', '舟师调动', '盐铁估价'], localFactionId: '', sectId: 'qingnang' },
  { id: 'wu', name: '吴', region: '江东', x: 13, y: 8, description: '水乡城郭连着田亩、河泊和大宅，一旦站错边，整片市井都会跟着抬眼看你。', tags: ['吴会', '河泊', '舟楫'], eventHooks: ['水寨募人', '官署会饮', '河泊纠纷'], localFactionId: '', sectId: 'qingnang' },
  { id: 'kuaiji', name: '会稽', region: '江东', x: 14, y: 9, description: '山海相接，盐路、山道和县寺文书交错，越往里走越难只凭一句话通行。', tags: ['会稽', '山海', '盐路'], eventHooks: ['海盐估价', '山路献图', '县寺请帖'], localFactionId: '', sectId: 'qingnang' },
  { id: 'chaisang', name: '柴桑', region: '江夏', x: 10, y: 8, description: '扼住长江中段水面，往西是荆州，往东是江东，来往全看舟师与风向。', tags: ['长江', '水师', '渡口'], eventHooks: ['水寨操练', '商船夜泊', '江面缉盗'], localFactionId: '', sectId: 'qingnang' },
  { id: 'chengdu', name: '成都', region: '益州', x: 3, y: 9, description: '入蜀路难，出蜀更难。可一旦站住脚，这里足够养人，也足够藏锋。', tags: ['蜀道', '富庶', '自守'], eventHooks: ['蜀道商旅', '州府征辟', '山门访客'], localFactionId: '', sectId: 'taibai' }
];

const ORIGIN_CITY_IDS = ['luoyang', 'changan', 'yecheng', 'xuchang', 'xiapi', 'xiangyang', 'jianye', 'chengdu'];

const CITY_ROUTE_LINES = [
  { id: 'route_changan_luoyang', from: 'changan', to: 'luoyang', type: 'official', weight: 3, label: '函谷官道' },
  { id: 'route_changan_hanzhong', from: 'changan', to: 'hanzhong', type: 'mountain', weight: 4, label: '褒斜栈道' },
  { id: 'route_hanzhong_xiangyang', from: 'hanzhong', to: 'xiangyang', type: 'mountain', weight: 4, label: '汉水山道' },
  { id: 'route_hanzhong_chengdu', from: 'hanzhong', to: 'chengdu', type: 'mountain', weight: 4, label: '入蜀栈道' },
  { id: 'route_luoyang_xuchang', from: 'luoyang', to: 'xuchang', type: 'official', weight: 2, label: '许洛官道' },
  { id: 'route_luoyang_yecheng', from: 'luoyang', to: 'yecheng', type: 'land', weight: 4, label: '河北大道' },
  { id: 'route_yecheng_pingyuan', from: 'yecheng', to: 'pingyuan', type: 'land', weight: 3, label: '冀青陆路' },
  { id: 'route_pingyuan_beiping', from: 'pingyuan', to: 'beiping', type: 'land', weight: 4, label: '幽州北路' },
  { id: 'route_xuchang_wan', from: 'xuchang', to: 'wan', type: 'official', weight: 3, label: '宛许官道' },
  { id: 'route_xuchang_shouchun', from: 'xuchang', to: 'shouchun', type: 'land', weight: 3, label: '淮南陆路' },
  { id: 'route_xuchang_pengcheng', from: 'xuchang', to: 'pengcheng', type: 'land', weight: 4, label: '徐豫通路' },
  { id: 'route_shouchun_hefei', from: 'shouchun', to: 'hefei', type: 'land', weight: 2, label: '淮肥陆路' },
  { id: 'route_shouchun_xiapi', from: 'shouchun', to: 'xiapi', type: 'canal', weight: 3, label: '泗淮水路' },
  { id: 'route_pengcheng_xiapi', from: 'pengcheng', to: 'xiapi', type: 'land', weight: 2, label: '彭下驿路' },
  { id: 'route_pengcheng_xiaopei', from: 'pengcheng', to: 'xiaopei', type: 'land', weight: 1, label: '彭沛短途' },
  { id: 'route_xiaopei_xiapi', from: 'xiaopei', to: 'xiapi', type: 'land', weight: 2, label: '沛下借道' },
  { id: 'route_xiapi_guangling', from: 'xiapi', to: 'guangling', type: 'canal', weight: 2, label: '邗沟水路' },
  { id: 'route_wan_xinye', from: 'wan', to: 'xinye', type: 'land', weight: 2, label: '南阳驿路' },
  { id: 'route_xinye_xiangyang', from: 'xinye', to: 'xiangyang', type: 'land', weight: 2, label: '襄北旧道' },
  { id: 'route_xiangyang_jiangling', from: 'xiangyang', to: 'jiangling', type: 'river', weight: 3, label: '汉江水路' },
  { id: 'route_jiangling_changsha', from: 'jiangling', to: 'changsha', type: 'river', weight: 4, label: '湘江水道' },
  { id: 'route_changsha_wuling', from: 'changsha', to: 'wuling', type: 'land', weight: 3, label: '荆南山路' },
  { id: 'route_jiangling_chaisang', from: 'jiangling', to: 'chaisang', type: 'river', weight: 4, label: '长江中段' },
  { id: 'route_chaisang_jianye', from: 'chaisang', to: 'jianye', type: 'river', weight: 4, label: '大江东下' },
  { id: 'route_hefei_jianye', from: 'hefei', to: 'jianye', type: 'land', weight: 3, label: '合濡陆路' },
  { id: 'route_guangling_jianye', from: 'guangling', to: 'jianye', type: 'river', weight: 2, label: '广陵渡江' },
  { id: 'route_jianye_wu', from: 'jianye', to: 'wu', type: 'river', weight: 2, label: '吴会水网' },
  { id: 'route_wu_kuaiji', from: 'wu', to: 'kuaiji', type: 'coast', weight: 3, label: '会稽海道' },
  { id: 'route_jiangling_chengdu', from: 'jiangling', to: 'chengdu', type: 'mountain', weight: 7, label: '峡江蜀道' }
];

const TEXT_MAP_GROUPS_CONTENT = [
  { region: '司隶与关中', cityIds: ['luoyang', 'changan', 'hanzhong'] },
  { region: '河北与幽州', cityIds: ['yecheng', 'pingyuan', 'beiping'] },
  { region: '豫州与徐淮', cityIds: ['xuchang', 'shouchun', 'pengcheng', 'xiapi', 'xiaopei', 'guangling'] },
  { region: '荆襄与荆南', cityIds: ['wan', 'xinye', 'xiangyang', 'jiangling', 'changsha', 'wuling'] },
  { region: '江东与江夏', cityIds: ['hefei', 'jianye', 'wu', 'kuaiji', 'chaisang'] },
  { region: '巴蜀', cityIds: ['chengdu'] }
];

const FACTIONS_CONTENT = [];

const HISTORICAL_RELATIONS = [
  { id: 'xun_yu', name: '荀彧', title: '尚书令', factionId: 'court_remnant', summary: '眼光深，分寸更深，最看重一个人是否真能把局面托住。', tags: ['govern', 'diplomacy', 'courtcraft'], backgrounds: ['imperial_kin', 'fallen_scholar'] },
  { id: 'diao_chan', name: '貂蝉', title: '歌伎', factionId: 'court_remnant', summary: '善察风色，也最懂如何在锋芒最乱的时候把人心慢慢挑开。', tags: ['social', 'diplomacy', 'romance', 'intrigue', 'courtcraft'], backgrounds: ['imperial_kin', 'fallen_scholar'] },
  { id: 'da_qiao', name: '大乔', title: '江东名媛', factionId: 'river_merchants', summary: '温婉里带着分寸，最擅长在局势和情意之间守住一条不失礼的线。', tags: ['social', 'romance', 'diplomacy', 'trade'], backgrounds: ['merchant_heir', 'imperial_kin'] },
  { id: 'xiao_qiao', name: '小乔', title: '江东名媛', factionId: 'river_merchants', summary: '看似轻快，其实最会拿捏气氛与距离，越近越要细看火候。', tags: ['social', 'romance', 'diplomacy', 'investigate'], backgrounds: ['merchant_heir', 'imperial_kin'] },
  { id: 'sun_shangxiang', name: '孙尚香', title: '郡主', factionId: 'river_merchants', summary: '锋利、直白、好胜，认的是胆气和真心，不喜欢拖泥带水。', tags: ['battle', 'martial', 'romance', 'social', 'jianghu'], backgrounds: ['merchant_heir', 'local_gentry'] },
  { id: 'chen_deng', name: '陈登', title: '广陵名士', factionId: 'jingzhou_gentry', summary: '既懂地方，又懂军粮，最擅长把人放到合适的位置。', tags: ['govern', 'trade', 'strategy'], backgrounds: ['fallen_scholar', 'merchant_heir', 'local_gentry'] },
  { id: 'mi_zhu', name: '糜竺', title: '徐州巨贾', factionId: 'river_merchants', summary: '财货、人情和路数都算得极快，最懂谁能把钱粮变成真正局面。', tags: ['trade', 'social', 'romance', 'mercantile'], backgrounds: ['merchant_heir', 'imperial_kin'] },
  { id: 'zang_ba', name: '臧霸', title: '泰山宿将', factionId: 'frontier_army', summary: '见过乱局，也见过人心，认的是能打、能带、能活。', tags: ['military', 'battle', 'frontier'], backgrounds: ['local_gentry', 'refugee'] },
  { id: 'tai_shi_ci', name: '太史慈', title: '江东名将', factionId: 'frontier_army', summary: '锋芒与义气都在前面，最容易被敢拼又不失分寸的人吸引注意。', tags: ['battle', 'martial', 'romance', 'xuanfeng'], backgrounds: ['refugee', 'local_gentry'] },
  { id: 'hua_tuo', name: '华佗', title: '名医', factionId: 'court_remnant', summary: '医术之外更能看人骨相和命数，对苦熬出来的人格外上心。', tags: ['rest', 'martial', 'qingnang'], backgrounds: ['refugee', 'fallen_scholar'] },
  { id: 'liu_bei', name: '刘备', title: '汉室宗亲', factionId: 'court_remnant', summary: '仁义在口，更在人心，最擅长把失势局面重新拢成愿意跟随他的众望。', tags: ['social', 'diplomacy', 'govern', 'courtcraft'], backgrounds: ['imperial_kin'] },
  { id: 'liu_biao', name: '刘表', title: '荆州牧', factionId: 'jingzhou_gentry', summary: '外柔内审，最擅长在看似平静的州郡秩序里压住各方脾气。', tags: ['govern', 'diplomacy', 'courtcraft', 'strategy'], backgrounds: ['imperial_kin', 'fallen_scholar'] },
  { id: 'cao_cao', name: '曹操', title: '司空', factionId: 'court_remnant', summary: '最懂时势轻重，也最认结果与手段，盯人先看有没有用。', tags: ['govern', 'military', 'intrigue', 'strategy'], backgrounds: ['local_gentry'] },
  { id: 'yuan_shao', name: '袁绍', title: '河北盟主', factionId: 'northern_clans', summary: '门第、声势和人望都足够厚，最重出身场面，也最会借大势压人。', tags: ['govern', 'military', 'diplomacy', 'courtcraft'], backgrounds: ['imperial_kin', 'local_gentry'] },
  { id: 'yuan_shu', name: '袁术', title: '淮南袁公', factionId: 'river_merchants', summary: '出手阔，脾气也大，最容易被财货、兵势和奉承一同推高。', tags: ['trade', 'military', 'social', 'intrigue'], backgrounds: ['merchant_heir', 'local_gentry'] },
  { id: 'sun_quan', name: '孙权', title: '江东之主', factionId: 'river_merchants', summary: '善守根基，也懂权衡群臣与盟友，最在意一个人能不能把局面拿稳。', tags: ['govern', 'military', 'diplomacy', 'trade'], backgrounds: ['merchant_heir'] },
  { id: 'sun_ce', name: '孙策', title: '江东小霸王', factionId: 'frontier_army', summary: '打起来像风压水面，快、猛、狠，最认敢跟上他节奏的人。', tags: ['battle', 'military', 'martial', 'warpath'], backgrounds: ['local_gentry', 'refugee'] },
  { id: 'guan_yu', name: '关羽', title: '美髯公', factionId: 'frontier_army', summary: '重义守信，傲骨极盛，最敬真英雄，也最厌失节背义。', tags: ['battle', 'warpath', 'martial', 'frontier'], backgrounds: ['refugee'] },
  { id: 'zhang_fei', name: '张飞', title: '燕人猛将', factionId: 'frontier_army', summary: '烈性如火，胆气顶前，认的是痛快、真心和敢拼。', tags: ['battle', 'warpath', 'martial', 'frontier'], backgrounds: ['local_gentry'] },
  { id: 'zhang_xiu', name: '张绣', title: '宛城军主', factionId: 'frontier_army', summary: '久居边线，最懂什么叫守险、审势和在夹缝里留后手。', tags: ['military', 'battle', 'strategy', 'frontier'], backgrounds: ['local_gentry', 'refugee'] },
  { id: 'zhuge_liang', name: '诸葛亮', title: '卧龙', factionId: 'jingzhou_gentry', summary: '谋定后动，最重志向、执行和大局秩序，不喜躁进误军。', tags: ['strategy', 'govern', 'diplomacy', 'investigate'], backgrounds: ['fallen_scholar'] },
  { id: 'zhao_yun', name: '赵云', title: '常山赵子龙', factionId: 'frontier_army', summary: '沉静忠勇，克己守分，关键时候最能把事稳稳扛住。', tags: ['battle', 'martial', 'travel', 'frontier'], backgrounds: ['refugee'] },
  { id: 'zhou_yu', name: '周瑜', title: '江东都督', factionId: 'river_merchants', summary: '风采与兵机并重，最看才略、气度与配合，不耐庸碌拖沓。', tags: ['strategy', 'battle', 'diplomacy', 'trade'], backgrounds: ['merchant_heir'] },
  { id: 'chen_gong', name: '陈宫', title: '徐州谋士', factionId: 'northern_clans', summary: '眼里容不下庸手，也最容易因为看错人而把自己一并压上赌桌。', tags: ['strategy', 'intrigue', 'military', 'courtcraft'], backgrounds: ['fallen_scholar', 'local_gentry'] },
  { id: 'sima_yi', name: '司马懿', title: '魏廷谋臣', factionId: 'court_remnant', summary: '善忍善藏，最会看后手和时机，不肯轻易把底牌亮出去。', tags: ['intrigue', 'strategy', 'govern', 'investigate'], backgrounds: ['fallen_scholar'] },
  { id: 'lu_meng', name: '吕蒙', title: '江东宿将', factionId: 'frontier_army', summary: '由武入文，苦学成器，最欣赏肯磨自己、越练越细的人。', tags: ['military', 'investigate', 'strategy', 'battle'], backgrounds: ['refugee'] },
  { id: 'gongsun_zan', name: '公孙瓒', title: '白马将军', factionId: 'northern_clans', summary: '北地旧将出身，行事强硬，最认硬碰硬的军功与骑战本事。', tags: ['military', 'battle', 'frontier', 'travel'], backgrounds: ['local_gentry', 'refugee'] },
  { id: 'lu_bu', name: '吕布', title: '温侯', factionId: 'frontier_army', summary: '锋锐逼人，勇力压世，靠近他的人多半会先感觉到一种近乎失控的危险。', tags: ['battle', 'warpath', 'martial', 'frontier'], backgrounds: ['local_gentry', 'refugee'] }
];

const RANDOM_NPC_TEMPLATES = [
  { id: 'scribe', title: '幕僚', baseName: ['顾衡', '陆昭', '沈砚', '谢澄'], factionId: 'court_remnant', summary: '写得一手好文书，也习惯把话留半句。', tags: ['govern', 'diplomacy', 'strategy'] },
  { id: 'merchant', title: '商行掌柜', baseName: ['秦九娘', '柳闻笙', '程知远', '霍轻眉'], factionId: 'river_merchants', summary: '算盘打得快，心也转得快，绝不做白赔买卖。', tags: ['trade', 'social', 'romance', 'mercantile'] },
  { id: 'captain', title: '部曲校尉', baseName: ['韩烈', '魏沉', '杜陵', '冉骁'], factionId: 'frontier_army', summary: '真正信的是粮、马和军纪，其次才是嘴上的豪言。', tags: ['military', 'battle', 'frontier'] },
  { id: 'wanderer', title: '游侠', baseName: ['燕七', '苏别鹤', '宁归', '白迟'], factionId: 'northern_clans', summary: '识路、识人，也识得什么时候该把刀收回鞘里。', tags: ['investigate', 'martial', 'romance', 'shadow'] },
  { id: 'court_lady', title: '故家遗脉', baseName: ['裴清漪', '崔婉', '甄含章', '冯令仪'], factionId: 'jingzhou_gentry', summary: '看似温和，实则最懂局势和人心如何彼此拿捏。', tags: ['social', 'diplomacy', 'romance', 'courtcraft'] }
];

const BACKGROUND_RELATION_RULES = {
  imperial_kin: { historical: ['xun_yu', 'diao_chan', 'da_qiao', 'xiao_qiao', 'liu_bei', 'liu_biao', 'yuan_shao', 'mi_zhu'], npc: ['court_lady', 'scribe'] },
  local_gentry: { historical: ['chen_deng', 'zang_ba', 'cao_cao', 'yuan_shao', 'sun_ce', 'sun_shangxiang', 'zhang_fei', 'zhang_xiu', 'lu_bu'], npc: ['captain', 'merchant'] },
  fallen_scholar: { historical: ['xun_yu', 'diao_chan', 'zhuge_liang', 'chen_gong', 'sima_yi', 'hua_tuo', 'liu_biao'], npc: ['scribe', 'wanderer'] },
  merchant_heir: { historical: ['mi_zhu', 'da_qiao', 'xiao_qiao', 'sun_shangxiang', 'chen_deng', 'yuan_shu', 'sun_quan', 'zhou_yu', 'sun_ce'], npc: ['merchant', 'court_lady'] },
  refugee: { historical: ['tai_shi_ci', 'zhao_yun', 'lu_meng', 'guan_yu', 'zhang_xiu', 'gongsun_zan', 'lu_bu'], npc: ['wanderer', 'captain'] }
};

SECTS_CONTENT.splice(0, SECTS_CONTENT.length, ...SECT_DIRECTORY.map((item) => ({ ...item })));
CITIES_CONTENT.forEach((city) => {
  const sectIds = Array.isArray(CITY_SECT_MAP[city.id]) ? CITY_SECT_MAP[city.id].slice() : (city.sectId ? [city.sectId] : []);
  city.sectIds = sectIds;
  city.sectId = sectIds[0] || city.sectId || '';
});

module.exports = {
  BACKGROUNDS_CONTENT,
  SECTS_CONTENT,
  CITIES_CONTENT,
  ORIGIN_CITY_IDS,
  CITY_ROUTE_LINES,
  TEXT_MAP_GROUPS_CONTENT,
  FACTIONS_CONTENT,
  HISTORICAL_RELATIONS,
  RANDOM_NPC_TEMPLATES,
  BACKGROUND_RELATION_RULES
};
