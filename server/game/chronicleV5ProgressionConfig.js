const { SECT_RULE_PATCHES } = require('./chronicleV5SectDirectoryJY');

const MARTIAL_PATHS = [
  {
    id: 'wild',
    name: '乱世野修',
    description: '没有完整传承，只能靠实战、苦练和见机行事，硬把一条路数磨出来。',
    preferredActions: ['martial', 'battle', 'travel'],
    levelUpDelta: { strategy: 1 },
    unlocks: [
      {
        level: 12,
        skill: { id: 'wild_footwork', name: '乱步换位', type: '武学', level: '入门', effect: '远行与遭遇战时更容易保全自己。' }
      },
      {
        level: 28,
        skill: { id: 'wild_counter', name: '乱战反咬', type: '武学', level: '熟练', effect: '兵少时仍能保住部分战力，不容易被一轮打崩。' }
      }
    ]
  },
  {
    id: 'taibai_sword',
    name: '太白剑脉',
    description: '重身法、破绽和一击决断，擅长在乱局里拆关键点。',
    preferredActions: ['martial', 'battle', 'investigate', 'sect'],
    levelUpDelta: { strategy: 1, renown: 1 },
    unlocks: [
      {
        level: 18,
        skill: { id: 'taibai_edge', name: '太白破锋', type: '武学', level: '小成', effect: '战斗和探查获得额外锐气，胜时更容易涨名望。' }
      },
      {
        level: 42,
        skill: { id: 'taibai_flash', name: '流光断势', type: '武学', level: '大成', effect: '战斗中个人武学对战局的折算效率进一步提高。' }
      }
    ]
  },
  {
    id: 'canglang_blade',
    name: '沧浪刀阵',
    description: '刀路狠直，强调压阵和带兵一体，越在正面越见威势。',
    preferredActions: ['martial', 'military', 'battle', 'sect'],
    levelUpDelta: { military: 1, morale: 1 },
    unlocks: [
      {
        level: 18,
        skill: { id: 'canglang_press', name: '潮头压阵', type: '武学', level: '小成', effect: '练兵和征战更容易稳住士气。' }
      },
      {
        level: 42,
        skill: { id: 'canglang_break', name: '裂浪斩营', type: '武学', level: '大成', effect: '兵力尚可时，正面交锋能打出更强战果。' }
      }
    ]
  },
  {
    id: 'qingnang_body',
    name: '青囊养脉',
    description: '重调息、续力和伤后维持，武学不一定最猛，但最能拖长线。',
    preferredActions: ['martial', 'rest', 'sect', 'govern'],
    levelUpDelta: { maxHealth: 1, health: 1 },
    unlocks: [
      {
        level: 16,
        skill: { id: 'qingnang_breath', name: '青囊调息', type: '武学', level: '小成', effect: '休整和修习时恢复更稳，疲惫更容易压下去。' }
      },
      {
        level: 36,
        skill: { id: 'qingnang_guard', name: '护元续骨', type: '武学', level: '大成', effect: '身骨较低时仍能保住底线，不容易直接崩盘。' }
      }
    ]
  },
  {
    id: 'xuanfeng_lance',
    name: '玄锋骑枪',
    description: '偏军阵与突进，讲究起手压人、穿插套袭和兵锋联动。',
    preferredActions: ['martial', 'military', 'battle', 'travel'],
    levelUpDelta: { military: 1, strategy: 1 },
    unlocks: [
      {
        level: 18,
        skill: { id: 'xuanfeng_charge', name: '玄锋突骑', type: '武学', level: '小成', effect: '行军、转场和试锋时更容易抢先手。' }
      },
      {
        level: 42,
        skill: { id: 'xuanfeng_breakline', name: '贯阵长驱', type: '武学', level: '大成', effect: '对高压力局面有更强破局能力。' }
      }
    ]
  }
];

const MARTIAL_BOTTLENECKS = [
  { level: 24, insight: 3, name: '筋骨关', hint: '单靠闷头苦练已经不够了。需要门派点拨、实战磨砺或一次真正开眼的契机。' },
  { level: 39, insight: 6, name: '淬锋关', hint: '再往上走，光有勤苦不够，要么得名师点破，要么得在险局里真见生死。' },
  { level: 54, insight: 10, name: '化劲关', hint: '招式和力道开始卡在一处，要靠更高层次的对手、传承或奇遇把劲路打通。' },
  { level: 69, insight: 15, name: '宗师关', hint: '这一层已不是练多练少的问题，而是有没有自己的路数、自己的心气和自己的破法。' },
  { level: 84, insight: 21, name: '通玄关', hint: '再往上已经近乎绝顶。没有极重的机缘、传承或改命一战，很难硬撞过去。' }
];

const STRATEGY_PATHS = [
  {
    id: 'survival',
    name: '乱世求生',
    description: '先活，再谋，再攒底牌，适合白手起家和低资源开局。',
    preferredActions: ['rest', 'investigate', 'travel', 'trade'],
    levelUpDelta: { strategy: 1, maxHealth: 1 },
    unlocks: [
      {
        level: 10,
        skill: { id: 'survival_cache', name: '藏锋留粮', type: '谋略', level: '入门', effect: '低资源时行动惩罚更轻。' }
      },
      {
        level: 24,
        skill: { id: 'survival_exit', name: '抽身留路', type: '谋略', level: '熟练', effect: '逆风时更容易保住人手与本钱。' }
      }
    ]
  },
  {
    id: 'courtcraft',
    name: '朝局周旋',
    description: '重名分、人情和说辞，适合靠交涉与牌面换空间。',
    preferredActions: ['diplomacy', 'social', 'romance', 'govern'],
    levelUpDelta: { diplomacy: 1, charm: 1 },
    unlocks: [
      {
        level: 10,
        skill: { id: 'courtcraft_face', name: '借势开口', type: '谋略', level: '入门', effect: '交涉和人物经营更容易打出好结果。' }
      },
      {
        level: 24,
        skill: { id: 'courtcraft_balance', name: '两头周全', type: '谋略', level: '熟练', effect: '势力关系更不容易因为一次失手直接翻脸。' }
      }
    ]
  },
  {
    id: 'mercantile',
    name: '商路经营',
    description: '重周转、补给和路径效率，适合把钱粮滚成真正的局面。',
    preferredActions: ['trade', 'travel', 'diplomacy'],
    levelUpDelta: { commerce: 1, coins: 2 },
    unlocks: [
      {
        level: 10,
        skill: { id: 'mercantile_margin', name: '价差落袋', type: '谋略', level: '入门', effect: '经商和行路获得更稳定的钱粮收益。' }
      },
      {
        level: 24,
        skill: { id: 'mercantile_convoy', name: '商队调度', type: '谋略', level: '熟练', effect: '跨城转运的盘缠与耗损更可控。' }
      }
    ]
  },
  {
    id: 'frontier_command',
    name: '军政统筹',
    description: '重兵员、军纪和长线维持，适合把小股力量慢慢练成能打的部曲。',
    preferredActions: ['military', 'govern', 'battle'],
    levelUpDelta: { military: 1, morale: 1 },
    unlocks: [
      {
        level: 10,
        skill: { id: 'frontier_drill', name: '营务成序', type: '谋略', level: '入门', effect: '练兵与整军更容易转化成稳定战力。' }
      },
      {
        level: 24,
        skill: { id: 'frontier_supply', name: '军需有章', type: '谋略', level: '熟练', effect: '部曲规模起来后，不容易被粮秣反噬。' }
      }
    ]
  },
  {
    id: 'shadow_scheme',
    name: '暗线谋局',
    description: '重情报、试探和借刀，适合把局面撬开而不是正面硬撞。',
    preferredActions: ['investigate', 'intrigue', 'diplomacy', 'social'],
    levelUpDelta: { strategy: 1, influence: 1 },
    unlocks: [
      {
        level: 10,
        skill: { id: 'shadow_mark', name: '先记暗脉', type: '谋略', level: '入门', effect: '探查和设局更容易接出后续线索。' }
      },
      {
        level: 24,
        skill: { id: 'shadow_turn', name: '借势回身', type: '谋略', level: '熟练', effect: '暗线行动失败时更容易留退路。' }
      }
    ]
  }
];

const MARTIAL_FOCI = [
  {
    id: 'unbound',
    name: '未定志向',
    description: '还在摸索这一身武学，究竟要落在军阵之上，还是落在江湖之巅。'
  },
  {
    id: 'battlefield',
    name: '军阵万人敌',
    description: '把个人武艺、军务和威名都压进战阵里，走的是阵前破局、万人辟易的路数。'
  },
  {
    id: 'jianghu',
    name: '武林天下第一',
    description: '不必先入官场，也能凭宗门、比武、游历和问剑把名声一路打到江湖绝顶。'
  }
];

const BACKGROUND_RULES = {
  imperial_kin: {
    statDelta: { diplomacy: 12, governance: 8, charm: 8, coins: 24, influence: 12, renown: 4, strategy: 4 },
    martialRouteId: 'wild',
    strategyRouteId: 'courtcraft'
  },
  local_gentry: {
    statDelta: { military: 10, governance: 4, commerce: 4, coins: 18, troops: 60, supplies: 20, morale: 18, renown: 8, influence: 6 },
    martialRouteId: 'wild',
    strategyRouteId: 'frontier_command'
  },
  fallen_scholar: {
    statDelta: { governance: 12, strategy: 12, diplomacy: 6, coins: 8, influence: 8, charm: 4 },
    martialRouteId: 'wild',
    strategyRouteId: 'shadow_scheme'
  },
  merchant_heir: {
    statDelta: { commerce: 12, diplomacy: 6, strategy: 4, coins: 42, supplies: 12, charm: 6, influence: 4 },
    martialRouteId: 'wild',
    strategyRouteId: 'mercantile'
  },
  refugee: {
    statDelta: { military: 4, strategy: 6, martialLevel: 6, health: -6, fatigue: 10, coins: 2, charm: 1, morale: 4 },
    martialRouteId: 'wild',
    strategyRouteId: 'survival'
  }
};

const SECT_RULES = {
  taibai: {
    martialRouteId: 'taibai_sword',
    strategyRouteId: 'courtcraft',
    joinDelta: { martialLevel: 4, strategy: 1, renown: 1, influence: 1 },
    uniqueSkill: { id: 'taibai_inheritance', name: '太白真传', type: '门派', level: '入门', effect: '剑脉成长更快，探查与试锋更容易打出上限。' }
  },
  canglang: {
    martialRouteId: 'canglang_blade',
    strategyRouteId: 'frontier_command',
    joinDelta: { martialLevel: 5, military: 1, morale: 2 },
    uniqueSkill: { id: 'canglang_inheritance', name: '沧浪战刀', type: '门派', level: '入门', effect: '练兵、压阵和正面交锋更容易站住。' }
  },
  qingnang: {
    martialRouteId: 'qingnang_body',
    strategyRouteId: 'survival',
    joinDelta: { martialLevel: 3, maxHealth: 4, governance: 1, health: 2 },
    uniqueSkill: { id: 'qingnang_inheritance', name: '青囊养息', type: '门派', level: '入门', effect: '恢复、续战与长线经营更稳。' }
  },
  xuanfeng: {
    martialRouteId: 'xuanfeng_lance',
    strategyRouteId: 'frontier_command',
    joinDelta: { martialLevel: 4, military: 2, strategy: 1 },
    uniqueSkill: { id: 'xuanfeng_inheritance', name: '玄锋枪骑', type: '门派', level: '入门', effect: '奔袭、调动和前线突破更有优势。' }
  }
};

Object.keys(SECT_RULE_PATCHES).forEach((key) => {
  SECT_RULES[key] = Object.assign({}, SECT_RULES[key] || {}, SECT_RULE_PATCHES[key]);
});

function getMartialPath(pathId) {
  return MARTIAL_PATHS.find((item) => item.id === pathId) || MARTIAL_PATHS[0];
}

function getStrategyPath(pathId) {
  return STRATEGY_PATHS.find((item) => item.id === pathId) || STRATEGY_PATHS[0];
}

function getMartialFocus(focusId) {
  return MARTIAL_FOCI.find((item) => item.id === focusId) || MARTIAL_FOCI[0];
}

module.exports = {
  MARTIAL_PATHS,
  MARTIAL_BOTTLENECKS,
  MARTIAL_FOCI,
  STRATEGY_PATHS,
  BACKGROUND_RULES,
  SECT_RULES,
  getMartialPath,
  getStrategyPath,
  getMartialFocus
};
