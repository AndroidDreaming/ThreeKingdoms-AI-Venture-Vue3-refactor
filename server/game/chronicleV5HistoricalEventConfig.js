const HISTORICAL_PERSONA_RULES = {
  xun_yu: {
    label: '荀彧',
    actionWeights: { govern: 4, diplomacy: 4, social: 2, investigate: 2, intrigue: 1 },
    cityIds: ['xuchang', 'luoyang'],
    factionIds: ['court_remnant'],
    prompt: '荀彧更在意你能不能托住名分、财计与朝局秩序，而不是只会逞一时机锋。'
  },
  chen_deng: {
    label: '陈登',
    actionWeights: { govern: 3, trade: 3, investigate: 2, military: 2, diplomacy: 1 },
    cityIds: ['guangling', 'xiapi', 'xuchang'],
    factionIds: ['jingzhou_gentry', 'court_remnant'],
    prompt: '陈登会先看你是否真懂地方根基、军粮调度和城中人心。'
  },
  mi_zhu: {
    label: '糜竺',
    actionWeights: { trade: 4, diplomacy: 3, social: 2, travel: 2, govern: 1 },
    cityIds: ['xiapi', 'xiaopei', 'pengcheng', 'xinye', 'xiangyang', 'jiangling'],
    factionIds: ['river_merchants'],
    prompt: '糜竺在意的是你能不能把钱粮、商路和人情盘成真正的势力。'
  },
  zang_ba: {
    label: '臧霸',
    actionWeights: { military: 3, battle: 4, warpath: 4, govern: 1, rest: 1 },
    cityIds: ['xiapi', 'yecheng'],
    factionIds: ['frontier_army', 'northern_clans'],
    prompt: '臧霸只认真能带兵、吃苦、在乱局里站得住的人。'
  },
  tai_shi_ci: {
    label: '太史慈',
    actionWeights: { battle: 4, martial: 3, jianghu: 2, warpath: 3, social: 1 },
    cityIds: ['jianye', 'wu', 'chaisang'],
    factionIds: ['frontier_army', 'river_merchants'],
    prompt: '太史慈会留意你的锋芒、分寸和胆气，看你是不是配得上正面相见。'
  },
  hua_tuo: {
    label: '华佗',
    actionWeights: { rest: 4, martial: 2, investigate: 1, social: 1 },
    cityIds: ['xuchang', 'guangling', 'xiangyang', 'jiangling'],
    factionIds: ['court_remnant'],
    prompt: '华佗记得的不是嘴上逞强，而是你是否知进退、会不会拿命去硬顶。'
  },
  liu_bei: {
    label: '刘备',
    actionWeights: { social: 4, diplomacy: 3, govern: 2, travel: 1, romance: 1 },
    cityIds: ['xiaopei', 'xiapi', 'pengcheng', 'xinye', 'xiangyang', 'jiangling'],
    factionIds: ['court_remnant', 'jingzhou_gentry'],
    prompt: '刘备看重的，是义气、器量和你是否真能聚起人心。'
  },
  cao_cao: {
    label: '曹操',
    actionWeights: { govern: 4, military: 4, intrigue: 4, investigate: 3, diplomacy: 2, warpath: 2 },
    cityIds: ['xuchang', 'luoyang', 'yecheng'],
    factionIds: ['court_remnant', 'northern_clans'],
    prompt: '曹操先看你有没有用，敢不敢担事，会不会顺势而为。'
  },
  sun_quan: {
    label: '孙权',
    actionWeights: { govern: 3, diplomacy: 3, trade: 3, military: 2, social: 1 },
    cityIds: ['jianye', 'wu', 'chaisang'],
    factionIds: ['river_merchants', 'frontier_army'],
    prompt: '孙权留意你能不能守住根基，也能不能拿捏诸方轻重。'
  },
  guan_yu: {
    label: '关羽',
    actionWeights: { battle: 4, warpath: 4, martial: 3, military: 2, diplomacy: 1 },
    cityIds: ['xiaopei', 'xiapi', 'xinye', 'xiangyang', 'jiangling', 'chengdu'],
    factionIds: ['frontier_army', 'court_remnant'],
    prompt: '关羽最看重信义、名节和你能不能真正撑住场面。'
  },
  zhang_fei: {
    label: '张飞',
    actionWeights: { battle: 4, military: 3, martial: 3, warpath: 3, social: 1 },
    cityIds: ['xiaopei', 'xiapi', 'xinye', 'xiangyang', 'chengdu'],
    factionIds: ['frontier_army'],
    prompt: '张飞认的是胆气、真心和敢拼，不认花架子。'
  },
  zhuge_liang: {
    label: '诸葛亮',
    actionWeights: { strategy: 4, govern: 4, investigate: 3, diplomacy: 3, intrigue: 2, sect: 1 },
    cityIds: ['xinye', 'xiangyang', 'jiangling', 'chengdu'],
    factionIds: ['jingzhou_gentry', 'court_remnant'],
    prompt: '诸葛亮会盯着你的志向、执行和后手，不喜欢轻率误局。'
  },
  zhao_yun: {
    label: '赵云',
    actionWeights: { battle: 3, martial: 4, travel: 2, warpath: 3, rest: 1 },
    cityIds: ['beiping', 'yecheng', 'xinye', 'xiangyang', 'jiangling', 'chengdu'],
    factionIds: ['frontier_army', 'court_remnant'],
    prompt: '赵云看你靠不靠得住，关键时候能不能把事情稳稳托住。'
  },
  zhou_yu: {
    label: '周瑜',
    actionWeights: { strategy: 4, battle: 3, diplomacy: 3, trade: 2, intrigue: 2, military: 2 },
    cityIds: ['jianye', 'wu', 'chaisang', 'jiangling'],
    factionIds: ['river_merchants', 'frontier_army'],
    prompt: '周瑜先看你的才气、气度和配合度，庸碌拖沓的人进不了他的眼。'
  },
  sima_yi: {
    label: '司马懿',
    actionWeights: { strategy: 4, intrigue: 4, govern: 3, investigate: 3, diplomacy: 1 },
    cityIds: ['xuchang', 'luoyang', 'yecheng'],
    factionIds: ['court_remnant', 'northern_clans'],
    prompt: '司马懿更在意耐性、后手和藏锋，不喜欢轻易把底牌亮出来。'
  },
  lu_meng: {
    label: '吕蒙',
    actionWeights: { military: 3, investigate: 3, battle: 3, govern: 2, strategy: 3, travel: 1 },
    cityIds: ['jianye', 'wu', 'chaisang', 'jiangling'],
    factionIds: ['frontier_army', 'river_merchants'],
    prompt: '吕蒙会记住你是不是肯学肯练，能不能把本事越磨越细。'
  },
  liu_biao: {
    label: '刘表',
    actionWeights: { govern: 4, diplomacy: 3, social: 2, investigate: 2, intrigue: 1 },
    cityIds: ['xiangyang', 'jiangling'],
    factionIds: ['jingzhou_gentry'],
    prompt: '刘表会先看你稳不稳，能不能在复杂州郡里托住秩序。'
  },
  yuan_shao: {
    label: '袁绍',
    actionWeights: { diplomacy: 3, military: 3, govern: 2, social: 2, battle: 2 },
    cityIds: ['yecheng', 'pingyuan'],
    factionIds: ['northern_clans'],
    prompt: '袁绍更看门第声望与排场，也看你够不够撑场。'
  },
  yuan_shu: {
    label: '袁术',
    actionWeights: { trade: 3, military: 3, social: 2, intrigue: 2, battle: 1 },
    cityIds: ['shouchun'],
    factionIds: ['river_merchants'],
    prompt: '袁术看重财势、排场和有没有人愿意顺着他的气口说话。'
  },
  sun_ce: {
    label: '孙策',
    actionWeights: { battle: 4, military: 4, travel: 2, warpath: 3, social: 1 },
    cityIds: ['jianye', 'wu', 'kuaiji', 'chaisang'],
    factionIds: ['frontier_army', 'river_merchants'],
    prompt: '孙策最在意你敢不敢跟，能不能接住快刀般的局势。'
  },
  zhang_xiu: {
    label: '张绣',
    actionWeights: { military: 3, battle: 3, strategy: 2, investigate: 2, travel: 1 },
    cityIds: ['wan'],
    factionIds: ['frontier_army'],
    prompt: '张绣会看你是不是懂守险、审势，能不能在夹缝里留后手。'
  },
  chen_gong: {
    label: '陈宫',
    actionWeights: { strategy: 4, intrigue: 3, battle: 2, govern: 1, investigate: 2 },
    cityIds: ['xiapi', 'xiaopei'],
    factionIds: ['northern_clans', 'frontier_army'],
    prompt: '陈宫更在意判断力，别把局面和人心一起看错。'
  },
  gongsun_zan: {
    label: '公孙瓒',
    actionWeights: { battle: 4, military: 3, travel: 2, warpath: 3, martial: 1 },
    cityIds: ['beiping'],
    factionIds: ['northern_clans'],
    prompt: '公孙瓒最认北地骑战、硬军功和不怕撞阵的胆气。'
  }
};

const HISTORICAL_EVENT_CONFIG = [
  {
    id: 'xudu_court',
    title: '许都朝局起势',
    year: 196,
    latestYear: 199,
    threshold: 14,
    rewriteThreshold: 28,
    cityIds: ['xuchang', 'luoyang'],
    routeIds: ['route_changan_luoyang', 'route_luoyang_xuchang'],
    factionIds: ['court_remnant'],
    relationIds: ['xun_yu', 'cao_cao', 'liu_bei'],
    actionWeights: { govern: 4, diplomacy: 4, social: 2, investigate: 2, intrigue: 2, travel: 1 },
    statWeights: { governance: 0.08, diplomacy: 0.08, influence: 0.1, renown: 0.05 },
    triggerSummary: '许都的朝局开始真正拢到一处，诏令、台阁和军府都在往同一股力上收束，局面已不再只是地方风声。',
    threadTitle: '许都朝局已经起势，谁能借名分、借诏令、借中枢，接下来就会越走越重。',
    promptFocus: '许都朝局正在成形，名分、诏令和中枢权柄开始压到台前。',
    dynamicActions: [
      {
        text: '借台阁余隙落子',
        actionText: '去许都设法接近台阁与近臣交界处的人情缝隙，看谁肯先递给你一份可用的名分、差遣或引见。',
        actionKind: 'diplomacy',
        hint: '台阁的门还没彻底关严，这时候挤进去，往后说话才有分量。'
      },
      {
        text: '翻旧牍寻错节',
        actionText: '从许都近年的旧牍和中枢积案里翻出一处错节，看看谁正借天子名义替自己铺路。',
        actionKind: 'investigate',
        hint: '朝局最值钱的，不是热闹，而是被人故意压下去的那页纸。'
      }
    ]
  },
  {
    id: 'guandu_shadow',
    title: '官渡之前',
    year: 200,
    latestYear: 201,
    threshold: 16,
    rewriteThreshold: 30,
    cityIds: ['xuchang', 'luoyang', 'yecheng', 'pingyuan', 'pengcheng'],
    routeIds: ['route_luoyang_yecheng', 'route_yecheng_pingyuan', 'route_xuchang_pengcheng'],
    factionIds: ['court_remnant', 'northern_clans', 'frontier_army'],
    relationIds: ['xun_yu', 'cao_cao', 'yuan_shao', 'zang_ba', 'sima_yi'],
    actionWeights: { trade: 3, govern: 3, military: 4, battle: 4, investigate: 2, intrigue: 2, warpath: 3 },
    statWeights: { supplies: 0.12, troops: 0.04, military: 0.08, strategy: 0.06, renown: 0.05 },
    triggerSummary: '官渡前夜的阴影已经压了下来，真正决定胜负的并不只有刀兵，还有粮道、军心和谁先撑不住。',
    threadTitle: '官渡前局正在成形，河北与许都两边的粮道、军心与暗线开始彼此咬住。',
    promptFocus: '官渡前局已经起势，粮道、军心、河北军府与许都中枢彼此牵扯。',
    dynamicActions: [
      {
        text: '先扣住粮道命门',
        actionText: '把目光压到官渡前局最要命的粮道与转运上，先摸清哪一段最先会断、哪一仓最先会乱。',
        actionKind: 'investigate',
        hint: '大军未动之前，真正能让人输掉一场战的，往往是看不见的那截后路。'
      },
      {
        text: '在军心未定时站边',
        actionText: '趁大战尚未完全压顶，去军营、粮仓和驿路之间试出站队与迟疑，把谁会先押注、谁会先退缩看个明白。',
        actionKind: 'military',
        hint: '还没开打的时候，才最容易听见人心倒向哪边。'
      }
    ]
  },
  {
    id: 'jingzhou_crack',
    title: '荆州裂隙',
    year: 208,
    latestYear: 209,
    threshold: 15,
    rewriteThreshold: 29,
    cityIds: ['wan', 'xinye', 'xiangyang', 'jiangling', 'changsha'],
    routeIds: ['route_wan_xinye', 'route_xinye_xiangyang', 'route_xiangyang_jiangling', 'route_jiangling_changsha'],
    factionIds: ['jingzhou_gentry', 'river_merchants'],
    relationIds: ['liu_biao', 'mi_zhu', 'liu_bei', 'zhuge_liang', 'zhou_yu'],
    actionWeights: { diplomacy: 3, social: 3, romance: 2, trade: 2, investigate: 3, intrigue: 3, travel: 1 },
    statWeights: { influence: 0.08, diplomacy: 0.08, commerce: 0.05, strategy: 0.06, renown: 0.04 },
    triggerSummary: '荆州的人心与旧系已经裂开口子，门阀、州府与江汉商路都在抢先找下一块落脚石。',
    threadTitle: '荆州裂隙已经显形，谁站得早、站得准，谁就可能先吃下后面的势。',
    promptFocus: '荆州正在裂开，门阀、州府、江汉商路与外来兵势都开始重新站队。',
    dynamicActions: [
      {
        text: '趁门阀摇摆时扣住一支',
        actionText: '借荆州旧系尚未完全站稳的空当，去逼近其中一支门阀或州府旧人，看谁先把真正的倾向露出来。',
        actionKind: 'diplomacy',
        hint: '裂口刚开的时候，最先松手的人，往往也最愿意说真话。'
      },
      {
        text: '从商路里撬开荆州局',
        actionText: '沿着江汉商路去找一处最能影响荆州去向的钱粮节点，把货流、人情和站队拽到一起看。',
        actionKind: 'trade',
        hint: '许多看似清谈定下的局，其实早在船货和账面上就已经写了答案。'
      }
    ]
  },
  {
    id: 'chibi_fire',
    title: '赤壁风火',
    year: 208,
    latestYear: 210,
    threshold: 18,
    rewriteThreshold: 32,
    cityIds: ['jiangling', 'chaisang', 'jianye', 'wu', 'xiangyang'],
    routeIds: ['route_jiangling_chaisang', 'route_chaisang_jianye', 'route_jianye_wu'],
    factionIds: ['river_merchants', 'frontier_army', 'court_remnant'],
    relationIds: ['mi_zhu', 'tai_shi_ci', 'sun_quan', 'sun_ce', 'zhou_yu', 'zhuge_liang', 'lu_meng'],
    actionWeights: { battle: 4, military: 3, trade: 2, intrigue: 3, travel: 2, warpath: 3, jianghu: 1 },
    statWeights: { troops: 0.05, morale: 0.1, supplies: 0.1, martialLevel: 0.04, renown: 0.05, influence: 0.04 },
    triggerSummary: '江面上的风已经变了，赤壁之前的兵势、船队和火势都在慢慢朝同一处压过去。',
    threadTitle: '赤壁风火已经起势，江船、粮路、火攻与人心都在等一个真正点燃局面的瞬间。',
    promptFocus: '赤壁前夜的江风正在收紧，船队、粮草、火势与联盟都快撞在一起。',
    dynamicActions: [
      {
        text: '先看哪支船队会先乱',
        actionText: '去江上把船队调度、水军呼应与营船疏漏看清，先找出最可能被火势和夜风咬开的那一道口子。',
        actionKind: 'investigate',
        hint: '赤壁真正决定胜负的，常常不是谁喊得最响，而是谁先露出一处破绽。'
      },
      {
        text: '借风火逼一手先机',
        actionText: '顺着江风、营船位置与联盟猜忌布一个能提前撬动局势的小局，看能不能让赤壁前夜先偏半步。',
        actionKind: 'intrigue',
        hint: '风已经起了，只差一只手把它推到能烧起来的方向。'
      }
    ]
  },
  {
    id: 'hanzhong_contest',
    title: '汉中争衡',
    year: 217,
    latestYear: 219,
    threshold: 18,
    rewriteThreshold: 34,
    cityIds: ['changan', 'hanzhong', 'chengdu', 'jiangling'],
    routeIds: ['route_changan_hanzhong', 'route_hanzhong_chengdu', 'route_jiangling_chengdu'],
    factionIds: ['frontier_army', 'court_remnant'],
    relationIds: ['zang_ba', 'hua_tuo', 'liu_bei', 'guan_yu', 'zhang_fei', 'zhao_yun'],
    actionWeights: { battle: 4, military: 4, govern: 2, travel: 2, warpath: 3, jianghu: 1, sect: 1 },
    statWeights: { troops: 0.05, morale: 0.08, military: 0.08, strategy: 0.05, martialLevel: 0.04, renown: 0.05 },
    triggerSummary: '关中与蜀地之间的汉中开始重新发热，谁先站稳这里，谁就能把后面的国势往自己手里拽。',
    threadTitle: '汉中争衡已经显形，关中、蜀地与边军之间的力道正在重新绷紧。',
    promptFocus: '汉中争衡开始发热，关中、蜀地与边军的重心都在往西线集中。',
    dynamicActions: [
      {
        text: '把前哨与险地先连成线',
        actionText: '去看汉中前哨、险地与旧部之间哪一处最先能拢成支点，让你能真正把脚跟钉在这场争衡里。',
        actionKind: 'military',
        hint: '谁先把险地连成自己的线，谁就在汉中多了一层说话的底气。'
      },
      {
        text: '回头掐住西线后盘',
        actionText: '别只盯着阵前，回头查清关中到汉中的补给、后路与换手节点，看这场争衡真正靠什么撑住。',
        actionKind: 'govern',
        hint: '能不能守住汉中，常常先看谁能把背后的那口气续上。'
      }
    ]
  }
];

module.exports = {
  HISTORICAL_PERSONA_RULES,
  HISTORICAL_EVENT_CONFIG
};
