const SECT_DIRECTORY = [
  {
    id: 'shaolin',
    name: '少林',
    region: '司隶',
    style: '拳禅',
    summary: '重根骨、戒律与苦修，先立身，再出手。乱世越烈，越看能不能守住心气。',
    trainingBonus: { martialLevel: 3, maxHealth: 3, morale: 1 },
    joinRequirements: {
      backgrounds: ['refugee', 'fallen_scholar', 'local_gentry'],
      minStats: { health: 40, martialLevel: 3 },
      requirementText: '身骨40、武艺3，更看重寒门、流民与乡里武备出身。'
    },
    martialRouteId: 'qingnang_body',
    strategyRouteId: 'survival',
    joinDelta: { martialLevel: 3, maxHealth: 3, health: 2, morale: 2 },
    uniqueSkill: { id: 'shaolin_inheritance', name: '少林金刚身', type: '门派', level: '入门', effect: '休整、苦修与硬仗时更容易稳住身骨和士气。' }
  },
  {
    id: 'wudang',
    name: '武当',
    region: '荆襄',
    style: '剑意',
    summary: '重心法、节奏与借力，以静制动，既看根骨，也看悟性与分寸。',
    trainingBonus: { martialLevel: 4, strategy: 1, diplomacy: 1 },
    joinRequirements: {
      backgrounds: ['imperial_kin', 'fallen_scholar', 'merchant_heir'],
      minStats: { strategy: 18, diplomacy: 14 },
      requirementText: '谋略18、外交14，更愿意收宗室旁支、士子与商旅后人。'
    },
    martialRouteId: 'taibai_sword',
    strategyRouteId: 'courtcraft',
    joinDelta: { martialLevel: 4, strategy: 1, diplomacy: 1, influence: 1 },
    uniqueSkill: { id: 'wudang_inheritance', name: '太极听劲', type: '门派', level: '入门', effect: '探查、交涉与问剑时更容易抓到对手节奏。' }
  },
  {
    id: 'huashan',
    name: '华山',
    region: '关中',
    style: '剑宗',
    summary: '重剑芒、胆气与登险之志，剑要快，心也要定，肯拼才会被看见。',
    trainingBonus: { martialLevel: 4, renown: 1 },
    joinRequirements: {
      backgrounds: ['local_gentry', 'refugee', 'imperial_kin'],
      minStats: { martialLevel: 5, renown: 6 },
      requirementText: '武艺5、名望6，更看重敢拼敢闯的人。'
    },
    martialRouteId: 'taibai_sword',
    strategyRouteId: 'frontier_command',
    joinDelta: { martialLevel: 4, renown: 2, morale: 1 },
    uniqueSkill: { id: 'huashan_inheritance', name: '华山险剑', type: '门派', level: '入门', effect: '沙场试锋与江湖争名都更容易滚起名声。' }
  },
  {
    id: 'beggars_union',
    name: '丐帮',
    region: '荆州',
    style: '游侠',
    summary: '认路数、人情和活下来的本事。旧门第不重要，能在烂局里撑住才重要。',
    trainingBonus: { martialLevel: 2, influence: 2, commerce: 1 },
    joinRequirements: {
      backgrounds: ['refugee', 'merchant_heir', 'local_gentry', 'fallen_scholar'],
      minStats: { influence: 6 },
      requirementText: '影响6，最欢迎流民、商旅和走江湖的人。'
    },
    martialRouteId: 'wild',
    strategyRouteId: 'survival',
    joinDelta: { martialLevel: 2, influence: 2, commerce: 1, coins: 4 },
    uniqueSkill: { id: 'beggars_union_inheritance', name: '打狗换位', type: '门派', level: '入门', effect: '远行、探查与接触三教九流时更容易找到门路。' }
  },
  {
    id: 'gumu',
    name: '古墓派',
    region: '荆襄',
    style: '轻灵',
    summary: '路子冷，规矩也冷。看中的不是热闹名头，而是骨相、轻功和守住自己的心。',
    trainingBonus: { martialLevel: 4, charm: 1, strategy: 1 },
    joinRequirements: {
      backgrounds: ['imperial_kin', 'fallen_scholar', 'merchant_heir'],
      minStats: { charm: 12, martialLevel: 4 },
      requirementText: '魅力12、武艺4，更看中心性细、步法轻的人。'
    },
    martialRouteId: 'taibai_sword',
    strategyRouteId: 'shadow_scheme',
    joinDelta: { martialLevel: 4, charm: 1, strategy: 1 },
    uniqueSkill: { id: 'gumu_inheritance', name: '玉蜂迷影', type: '门派', level: '入门', effect: '人物经营、情感推进与暗线试探更容易打出细处上限。' }
  },
  {
    id: 'taohua',
    name: '桃花岛',
    region: '江东',
    style: '奇门',
    summary: '杂学、机巧、阵图与音律都算本事。越有自己的路数，越容易被岛上真正看中。',
    trainingBonus: { strategy: 2, charm: 1, martialLevel: 3 },
    joinRequirements: {
      backgrounds: ['merchant_heir', 'fallen_scholar', 'imperial_kin'],
      minStats: { strategy: 16, charm: 10 },
      requirementText: '谋略16、魅力10，更认商旅后人、士子和宗室旁支。'
    },
    martialRouteId: 'taibai_sword',
    strategyRouteId: 'shadow_scheme',
    joinDelta: { martialLevel: 3, strategy: 2, charm: 1, influence: 1 },
    uniqueSkill: { id: 'taohua_inheritance', name: '桃花奇门', type: '门派', level: '入门', effect: '布局、试探与人物攻略更容易撬出隐藏收益。' }
  },
  {
    id: 'riyue',
    name: '日月神教',
    region: '河北',
    style: '魔锋',
    summary: '最看胆气、欲念和敢不敢把自己压进风口。入门快，代价也重，越往上越见人心。',
    trainingBonus: { martialLevel: 4, renown: 1, influence: 1 },
    joinRequirements: {
      backgrounds: ['refugee', 'local_gentry', 'merchant_heir'],
      minStats: { renown: 8, influence: 8 },
      requirementText: '名望8、影响8，更偏爱敢拼敢赌的人。'
    },
    martialRouteId: 'canglang_blade',
    strategyRouteId: 'shadow_scheme',
    joinDelta: { martialLevel: 4, renown: 2, influence: 1, health: -1 },
    uniqueSkill: { id: 'riyue_inheritance', name: '日月魔锋', type: '门派', level: '入门', effect: '军旅压阵与江湖争锋都更容易打出高风险高回报。' }
  },
  {
    id: 'emei',
    name: '峨眉',
    region: '巴蜀',
    style: '清峭',
    summary: '剑掌兼修，路数清峭，重定力、规矩和临阵不乱的骨气。',
    trainingBonus: { martialLevel: 3, diplomacy: 1, maxHealth: 2 },
    joinRequirements: {
      backgrounds: ['fallen_scholar', 'merchant_heir', 'imperial_kin'],
      minStats: { martialLevel: 4, diplomacy: 10 },
      requirementText: '武艺4、外交10，更看重心性稳、进退有度的人。'
    },
    martialRouteId: 'qingnang_body',
    strategyRouteId: 'courtcraft',
    joinDelta: { martialLevel: 3, diplomacy: 1, maxHealth: 2, renown: 1 },
    uniqueSkill: { id: 'emei_inheritance', name: '峨眉清音', type: '门派', level: '入门', effect: '人物往来、疗养续战与守势反击会更稳。' }
  },
  {
    id: 'kunlun',
    name: '昆仑',
    region: '关陇',
    style: '雄奇',
    summary: '远山大派，最重根骨、胆气和长线跋涉后的硬底子，出手讲究阔大与强压。',
    trainingBonus: { martialLevel: 4, military: 1, health: 2 },
    joinRequirements: {
      backgrounds: ['refugee', 'local_gentry', 'fallen_scholar'],
      minStats: { martialLevel: 5, health: 42 },
      requirementText: '武艺5、身骨42，更偏爱扛得住远路和苦练的人。'
    },
    martialRouteId: 'canglang_blade',
    strategyRouteId: 'frontier_command',
    joinDelta: { martialLevel: 4, military: 1, health: 2, morale: 1 },
    uniqueSkill: { id: 'kunlun_inheritance', name: '昆仑横雪', type: '门派', level: '入门', effect: '远行、压阵与正面强破会更容易站住。' }
  },
  {
    id: 'mingjiao',
    name: '明教',
    region: '荆南',
    style: '燎原',
    summary: '人多路杂，讲信念，也讲火线上头的决断。越是乱局，越容易从边角烧出大势。',
    trainingBonus: { martialLevel: 3, influence: 2, morale: 1 },
    joinRequirements: {
      backgrounds: ['refugee', 'merchant_heir', 'local_gentry'],
      minStats: { influence: 10, renown: 6 },
      requirementText: '影响10、名望6，更愿意收能在乱局里聚人心的人。'
    },
    martialRouteId: 'canglang_blade',
    strategyRouteId: 'shadow_scheme',
    joinDelta: { martialLevel: 3, influence: 2, morale: 1, troops: 12 },
    uniqueSkill: { id: 'mingjiao_inheritance', name: '燎原圣火', type: '门派', level: '入门', effect: '煽动、聚众、军旅推进与江湖造势更容易连成势头。' }
  }
];

const CITY_SECT_MAP = {
  luoyang: ['shaolin', 'beggars_union'],
  changan: ['huashan', 'kunlun'],
  hanzhong: ['huashan', 'kunlun'],
  yecheng: ['riyue', 'mingjiao'],
  pingyuan: ['riyue', 'beggars_union'],
  beiping: ['riyue', 'kunlun'],
  xuchang: ['shaolin', 'wudang'],
  shouchun: ['beggars_union', 'riyue'],
  pengcheng: ['beggars_union', 'shaolin'],
  xiapi: ['beggars_union', 'mingjiao'],
  xiaopei: ['beggars_union', 'shaolin'],
  guangling: ['taohua', 'beggars_union'],
  wan: ['huashan', 'wudang'],
  xinye: ['wudang', 'beggars_union'],
  xiangyang: ['wudang', 'gumu'],
  jiangling: ['beggars_union', 'mingjiao'],
  changsha: ['emei', 'mingjiao'],
  wuling: ['mingjiao', 'emei'],
  hefei: ['shaolin', 'wudang'],
  jianye: ['taohua', 'riyue'],
  wu: ['taohua', 'gumu'],
  kuaiji: ['taohua', 'mingjiao'],
  chaisang: ['taohua', 'beggars_union'],
  chengdu: ['emei', 'kunlun']
};

const SECT_RULE_PATCHES = SECT_DIRECTORY.reduce((result, sect) => {
  result[sect.id] = {
    martialRouteId: sect.martialRouteId,
    strategyRouteId: sect.strategyRouteId,
    joinDelta: sect.joinDelta,
    uniqueSkill: sect.uniqueSkill
  };
  return result;
}, {});

module.exports = {
  SECT_DIRECTORY,
  CITY_SECT_MAP,
  SECT_RULE_PATCHES
};
