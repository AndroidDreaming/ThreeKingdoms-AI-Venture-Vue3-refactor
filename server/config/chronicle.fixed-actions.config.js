const FIXED_ACTION_CONFIG = [
  {
    id: 'action:govern:audit',
    text: '清账理册',
    actionText: 'action:govern:audit',
    hint: '把仓账、收支和在手人力先摸清，后方有没有空心，一翻就知道。',
    category: '经营',
    actionKind: 'govern',
    actionMode: 'audit',
    direction: 'governance',
    group: 'personal'
  },
  {
    id: 'action:govern:patrol',
    text: '巡乡定纷',
    actionText: 'action:govern:patrol',
    hint: '亲自去看田里、街上和乡里的秩序，把民心与隐患一起压实。',
    category: '经营',
    actionKind: 'govern',
    actionMode: 'patrol',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { governance: 16 }
    }
  },
  {
    id: 'action:govern:granary',
    text: '修渠清仓',
    actionText: 'action:govern:granary',
    hint: '把水路、仓口和转运节奏重新理顺，让粮秣不再只停在数字上。',
    category: '经营',
    actionKind: 'govern',
    actionMode: 'granary',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { governance: 24, supplies: 18 },
      skillsAnyOf: [
        { id: 'memorial_craft', label: '章表筹画' },
        { id: 'civil_admin_pillar', label: '吏治成序' },
        { id: 'qingnang_inheritance', label: '青囊养息' }
      ]
    }
  },
  {
    id: 'action:govern:stewardship',
    text: '争取城池代治',
    actionText: 'action:govern:stewardship',
    hint: '把仓账、豪右、守备与人心捏到一处，争取这座城的实际运转权。拿不到城中权柄，很多史实人物终究只能结识，谈不上真正延揽。',
    category: '经营',
    actionKind: 'govern',
    actionMode: 'stewardship',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { governance: 18, influence: 8, renown: 6 },
      maxCityAuthorityBelow: 'control'
    }
  },
  {
    id: 'action:govern:stabilize',
    text: '安民肃吏',
    actionText: 'action:govern:stabilize',
    hint: '既然已经拿到城中实权，就得把豪右、旧吏和街乡秩序一起压住，不然治权只是名义。',
    category: '经营',
    actionKind: 'govern',
    actionMode: 'stabilize',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { governance: 22, influence: 10 },
      requiresCityAuthority: 'steward'
    }
  },
  {
    id: 'action:trade:warehouse',
    text: '盘库点货',
    actionText: 'action:trade:warehouse',
    hint: '先把现钱、现货和能立刻周转的门路盘活，经营才有手感。',
    category: '经营',
    actionKind: 'trade',
    actionMode: 'warehouse',
    direction: 'governance',
    group: 'personal'
  },
  {
    id: 'action:trade:blackmarket',
    text: '试开偏门货路',
    actionText: 'action:trade:blackmarket',
    hint: '绕开明面上的卡口试一条偏路，收益更快，风险也更近。',
    category: '经营',
    actionKind: 'trade',
    actionMode: 'blackmarket',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { commerce: 18 },
      skillsAnyOf: [
        { id: 'market_instinct', label: '市路嗅觉' }
      ]
    }
  },
  {
    id: 'action:trade:caravan',
    text: '压远线商队',
    actionText: 'action:trade:caravan',
    hint: '把货路往更远处压出去，赌的是大收益，也会换来新地界的人脉与风险。',
    category: '经营',
    actionKind: 'trade',
    actionMode: 'caravan',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { commerce: 26, coins: 30 },
      skillsAnyOf: [
        { id: 'market_instinct', label: '市路嗅觉' },
        { id: 'mercantile_margin', label: '价差落袋' },
        { id: 'mercantile_convoy', label: '商队调度' }
      ]
    }
  },
  {
    id: 'action:trade:arms',
    text: '采办军需',
    actionText: 'action:trade:arms',
    hint: '把商路收益直接换成甲械、箭镞和可用的军需，后面的军旅线才有牙。',
    category: '经营',
    actionKind: 'trade',
    actionMode: 'arms',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { commerce: 14 },
      skillsAnyOf: [
        { id: 'militia_command', label: '乡勇号令' },
        { id: 'frontier_supply', label: '军需有章' },
        { id: 'commerce_route_open', label: '商路开盘' }
      ]
    }
  },
  {
    id: 'action:trade:market_town',
    text: '整饬市路',
    actionText: 'action:trade:market_town',
    hint: '把集市、码头、行会和税卡重新拧顺，让这座城的商流开始稳定反哺你的盘面。',
    category: '经营',
    actionKind: 'trade',
    actionMode: 'market_town',
    direction: 'governance',
    group: 'personal',
    unlock: {
      stats: { commerce: 20, governance: 16 },
      requiresCityAuthority: 'steward'
    }
  },
  {
    id: 'action:diplomacy:banquet',
    text: '入席会面',
    actionText: 'action:diplomacy:banquet',
    hint: '借酒席、席位和旁人的眼光试探价码，很多站位都藏在这层场面里。',
    category: '人脉',
    actionKind: 'diplomacy',
    actionMode: 'banquet',
    direction: 'network',
    group: 'personal',
    unlock: {
      stats: { diplomacy: 18, renown: 8 },
      skillsAnyOf: [
        { id: 'ritual_literacy', label: '宗谱礼法' },
        { id: 'courtcraft_face', label: '借势开口' }
      ]
    }
  },
  {
    id: 'action:diplomacy:notables',
    text: '抚定豪右',
    actionText: 'action:diplomacy:notables',
    hint: '和地方豪右、旧家与仓口关键人物把条件讲透，让他们暂时把筹码压到你这边。',
    category: '人脉',
    actionKind: 'diplomacy',
    actionMode: 'notables',
    direction: 'network',
    group: 'personal',
    unlock: {
      stats: { diplomacy: 20, influence: 10 },
      requiresCityAuthority: 'steward'
    }
  },
  {
    id: 'action:diplomacy:envoy',
    text: '递帖通门路',
    actionText: 'action:diplomacy:envoy',
    hint: '不求立刻谈成，先把门路搭上，下一次再来就不是陌路人。',
    category: '人脉',
    actionKind: 'diplomacy',
    actionMode: 'envoy',
    direction: 'network',
    group: 'personal',
    unlock: {
      stats: { diplomacy: 12 }
    }
  },
  {
    id: 'action:social:salon',
    text: '设宴结社',
    actionText: 'action:social:salon',
    hint: '把几路人物请到同一张桌上，看谁想靠近，谁想看戏，谁想压价。',
    category: '人脉',
    actionKind: 'social',
    actionMode: 'salon',
    direction: 'network',
    group: 'personal',
    unlock: {
      stats: { influence: 10, diplomacy: 14 },
      skillsAnyOf: [
        { id: 'ritual_literacy', label: '宗谱礼法' },
        { id: 'courtcraft_face', label: '借势开口' },
        { id: 'heart_anchor', label: '心有所系' }
      ]
    }
  },
  {
    id: 'action:romance:approach',
    text: '借灯夜会',
    actionText: 'action:romance:approach',
    hint: '从已结识人物里挑一个不至于惊动旁人的时刻，把话说近一点，让气氛先软下来。',
    category: '情感',
    actionKind: 'romance',
    actionMode: 'approach',
    direction: 'network',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'romance'
  },
  {
    id: 'action:romance:promise',
    text: '试表心迹',
    actionText: 'action:romance:promise',
    hint: '不再只停在气氛里，朝已结识的人把心意说得更明白些，看对方肯不肯接住。',
    category: '情感',
    actionKind: 'romance',
    actionMode: 'promise',
    direction: 'network',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'romance',
    unlock: {
      stats: { charm: 14, diplomacy: 12 }
    }
  },
  {
    id: 'action:romance:bond',
    text: '共许风雨',
    actionText: 'action:romance:bond',
    hint: '把和已结识之人的情分往真正能并肩担事的层次推，甜，也会更深地牵动整局。',
    category: '情感',
    actionKind: 'romance',
    actionMode: 'bond',
    direction: 'network',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'romance',
    unlock: {
      stats: { charm: 18, influence: 10, morale: 10 }
    }
  },
  {
    id: 'action:romance:daily',
    text: '相伴日常',
    actionText: 'action:romance:daily',
    hint: '不急着表白或立誓，只把这一日的饭食、闲话和小事过成两个人之间的温度。',
    category: '情感',
    actionKind: 'romance',
    actionMode: 'daily',
    direction: 'network',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'romance',
    unlock: {
      stats: { charm: 10 }
    }
  },
  {
    id: 'action:romance:companion',
    text: '携手同行',
    actionText: 'action:romance:companion',
    hint: '让心上人贴着这一程同进同退，把陪伴变成真正会影响行动和抉择的关系。',
    category: '情感',
    actionKind: 'romance',
    actionMode: 'companion',
    direction: 'network',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'romance',
    unlock: {
      stats: { charm: 14, morale: 8 }
    }
  },
  {
    id: 'action:romance:jealousy',
    text: '安抚吃醋',
    actionText: 'action:romance:jealousy',
    hint: '旁人的目光、旧情和争宠的酸意已经冒头，先把心上人的不安和分寸稳住。',
    category: '情感',
    actionKind: 'romance',
    actionMode: 'jealousy',
    direction: 'network',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'romance',
    unlock: {
      stats: { charm: 16, diplomacy: 10 }
    }
  },
  {
    id: 'action:investigate:terrain',
    text: '踏勘地势',
    actionText: 'action:investigate:terrain',
    hint: '把渡口、街巷、暗道和可借的落脚点先记熟，后手才不空。',
    category: '谋略',
    actionKind: 'investigate',
    actionMode: 'terrain',
    direction: 'strategy',
    group: 'personal'
  },
  {
    id: 'action:investigate:archive',
    text: '翻地方旧案',
    actionText: 'action:investigate:archive',
    hint: '从陈账和旧卷里掏今天的命门，很多人最怕你去翻旧纸。',
    category: '谋略',
    actionKind: 'investigate',
    actionMode: 'archive',
    direction: 'strategy',
    group: 'personal',
    unlock: {
      stats: { strategy: 16 },
      skillsAnyOf: [
        { id: 'memorial_craft', label: '章表筹画' }
      ]
    }
  },
  {
    id: 'action:investigate:historical_lead',
    text: '史实人物线索',
    actionText: 'action:investigate:historical_lead',
    hint: '从本城已经浮出水面的史实人物风闻里挑一条，顺着门路、落脚处与时势把人真正接出来。',
    category: '谋略',
    actionKind: 'investigate',
    actionMode: 'historical_lead',
    direction: 'strategy',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'historical',
    lockedHint: '此地眼下还没有已经浮到明面的史实人物线索。',
    unlock: {
      requiresHistoricalRumorInCity: true
    }
  },
  {
    id: 'action:intrigue:rumor',
    text: '放风试口',
    actionText: 'action:intrigue:rumor',
    hint: '先放一层风，看谁急，谁藏，谁抢着替自己辩。',
    category: '谋略',
    actionKind: 'intrigue',
    actionMode: 'rumor',
    direction: 'strategy',
    group: 'personal'
  },
  {
    id: 'action:intrigue:counterspy',
    text: '反钩细作',
    actionText: 'action:intrigue:counterspy',
    hint: '故意递出一层假消息，顺着回路反钩真正的幕后手。',
    category: '谋略',
    actionKind: 'intrigue',
    actionMode: 'counterspy',
    direction: 'strategy',
    group: 'personal',
    unlock: {
      stats: { strategy: 22, influence: 8 },
      skillsAnyOf: [
        { id: 'shadow_mark', label: '先记暗脉' },
        { id: 'strategy_board_sense', label: '局盘有眼' }
      ]
    }
  },
  {
    id: 'action:martial:solo',
    text: '独练拆招',
    actionText: 'action:martial:solo',
    hint: '把这几回合里逼出来的破绽与手感，慢慢磨成真正属于自己的路数。',
    category: '武学',
    actionKind: 'martial',
    actionMode: 'solo',
    direction: 'martial',
    group: 'personal'
  },
  {
    id: 'action:military:garrison',
    text: '整顿城防',
    actionText: 'action:military:garrison',
    hint: '把城门、仓口、守军和值夜的层次重排一遍，治安和守备才能真正开始稳下来。',
    category: '军旅',
    actionKind: 'military',
    actionMode: 'garrison',
    direction: 'military',
    group: 'personal',
    unlock: {
      stats: { military: 18, governance: 14 },
      requiresCityAuthority: 'steward'
    }
  },
  {
    id: 'action:warpath:join',
    text: '投军挂名',
    actionText: 'action:warpath:join',
    hint: '先把名字压进对方军中，争一个能随军立功、在阵前站住脚的位置。',
    category: '军旅',
    actionKind: 'warpath',
    actionMode: 'join',
    direction: 'military',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'warpath',
    unlock: {
      stats: { military: 12 }
    }
  },
  {
    id: 'action:warpath:counsel',
    text: '入幕进言',
    actionText: 'action:warpath:counsel',
    hint: '去和军中主事人当面掰开战局、粮道与站位，争取让自己的判断真正落到军令里。',
    category: '军旅',
    actionKind: 'warpath',
    actionMode: 'counsel',
    direction: 'military',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'warpath',
    unlock: {
      stats: { strategy: 16, diplomacy: 12 }
    }
  },
  {
    id: 'action:warpath:assist',
    text: '随军助战',
    actionText: 'action:warpath:assist',
    hint: '不自己抢主位，而是贴着对方的战事去补阵脚、顶空当、吃真正的阵前火候。',
    category: '军旅',
    actionKind: 'warpath',
    actionMode: 'assist',
    direction: 'military',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'warpath',
    unlock: {
      stats: { military: 22, martialLevel: 20, morale: 18 }
    }
  },
  {
    id: 'action:warpath:logistics',
    text: '押送军需',
    actionText: 'action:warpath:logistics',
    hint: '顺着某位史实人物的战事去接粮道、甲械和补给，把自己嵌进真正能决定胜负的后手里。',
    category: '军旅',
    actionKind: 'warpath',
    actionMode: 'logistics',
    direction: 'military',
    group: 'personal',
    targetType: 'relation',
    relationScope: 'warpath',
    unlock: {
      stats: { military: 14, commerce: 12, supplies: 14 }
    }
  },
  {
    id: 'action:martial:closedoor',
    text: '闭关破关',
    actionText: 'action:martial:closedoor',
    hint: '先把外面的喧闹关在门外，逼自己把火候真正推过一层坎。',
    category: '武学',
    actionKind: 'martial',
    actionMode: 'closedoor',
    direction: 'martial',
    group: 'personal',
    unlock: {
      stats: { martialLevel: 28, martialInsight: 12, health: 72 },
      skillsAnyOf: [
        { id: 'qingnang_breath', label: '青囊调息' },
        { id: 'taibai_inheritance', label: '太白真传' },
        { id: 'martial_first_gate', label: '发劲入骨' }
      ]
    }
  },
  {
    id: 'action:rest:teahouse',
    text: '茶楼听书',
    actionText: 'action:rest:teahouse',
    hint: '借说书与闲谈把这几回的紧绷松下来，市井风声也会顺手钻进耳朵。',
    category: '养成',
    actionKind: 'rest',
    actionMode: 'teahouse',
    direction: 'growth',
    group: 'personal'
  },
  {
    id: 'action:rest:stroll',
    text: '夜游城坊',
    actionText: 'action:rest:stroll',
    hint: '夜色里走一圈，能让火气下去，也能让白天没看清的人影浮出来。',
    category: '养成',
    actionKind: 'rest',
    actionMode: 'stroll',
    direction: 'growth',
    group: 'personal'
  },
  {
    id: 'action:rest:study',
    text: '抄书静坐',
    actionText: 'action:rest:study',
    hint: '把杂乱的线头重新排一遍，很多判断都得在静下来之后才会成形。',
    category: '养成',
    actionKind: 'rest',
    actionMode: 'study',
    direction: 'growth',
    group: 'personal',
    unlock: {
      stats: { strategy: 12 }
    }
  },
  {
    id: 'action:rest:inn',
    text: '投店安睡',
    actionText: 'action:rest:inn',
    hint: '找间稳妥客店，把伤神和疲态先按下去一夜，第二天才有力气再接局。',
    category: '养成',
    actionKind: 'rest',
    actionMode: 'inn',
    direction: 'growth',
    group: 'personal'
  },
  {
    id: 'action:rest:medicate',
    text: '药汤调息',
    actionText: 'action:rest:medicate',
    hint: '借热汤、药气和吐纳把筋骨慢慢理顺，适合把高疲惫和小伤一起往下压。',
    category: '养成',
    actionKind: 'rest',
    actionMode: 'medicate',
    direction: 'growth',
    group: 'personal'
  },
  {
    id: 'action:military:recruit',
    text: '募练新勇',
    actionText: 'action:military:recruit',
    hint: '先把兵源和底子抓住，后面的军旅推进才不是空架子。',
    category: '军旅',
    actionKind: 'military',
    actionMode: 'recruit',
    direction: 'military',
    group: 'personal',
    unlock: {
      stats: { military: 16 }
    }
  },
  {
    id: 'action:military:drill',
    text: '夜操部曲',
    actionText: 'action:military:drill',
    hint: '把口令、步点和应变磨在夜里，真到阵前才不会手忙脚乱。',
    category: '军旅',
    actionKind: 'military',
    actionMode: 'drill',
    direction: 'military',
    group: 'personal',
    unlock: {
      stats: { military: 20, troops: 160, morale: 22 },
      skillsAnyOf: [
        { id: 'militia_command', label: '乡勇号令' },
        { id: 'frontier_drill', label: '营务成序' },
        { id: 'canglang_inheritance', label: '沧浪战刀' }
      ]
    }
  },
  {
    id: 'action:military:discipline',
    text: '立军法整饬',
    actionText: 'action:military:discipline',
    hint: '把军纪先立起来，营中那些试探深浅的人自然会收一收。',
    category: '军旅',
    actionKind: 'military',
    actionMode: 'discipline',
    direction: 'military',
    group: 'personal',
    unlock: {
      stats: { military: 14 }
    }
  },
  {
    id: 'action:military:camp',
    text: '整修营垒',
    actionText: 'action:military:camp',
    hint: '不急着压前线，先把营垒、哨位和军需位次扎牢，军旅线才会越走越稳。',
    category: '军旅',
    actionKind: 'military',
    actionMode: 'camp',
    direction: 'military',
    group: 'personal',
    unlock: {
      stats: { military: 16, supplies: 14 },
      skillsAnyOf: [
        { id: 'frontier_supply', label: '军需有章' },
        { id: 'civil_admin_pillar', label: '吏治成序' }
      ]
    }
  },
  {
    id: 'action:jianghu:lodge',
    text: '混进武馆茶肆',
    actionText: 'action:jianghu:lodge',
    hint: '先钻进江湖人真正说话的地方，奇遇、对手和名号才会有影子。',
    category: '江湖',
    actionKind: 'jianghu',
    actionMode: 'lodge',
    direction: 'jianghu',
    group: 'personal'
  },
  {
    id: 'action:jianghu:challenge',
    text: '挂帖邀战',
    actionText: 'action:jianghu:challenge',
    hint: '主动把名头抛出去，想踩你、试你、结交你的人都会冒头。',
    category: '江湖',
    actionKind: 'jianghu',
    actionMode: 'challenge',
    direction: 'jianghu',
    group: 'personal',
    unlock: {
      stats: { martialLevel: 24, jianghuPrestige: 16, renown: 10 },
      skillsAnyOf: [
        { id: 'taibai_edge', label: '太白破锋' },
        { id: 'jianghu_duelist', label: '名动江湖' },
        { id: 'martial_first_gate', label: '发劲入骨' }
      ]
    }
  },
  {
    id: 'action:jianghu:trace',
    text: '顺名号追人',
    actionText: 'action:jianghu:trace',
    hint: '顺着城里最响的一个名号追过去，看看等着你的是高人、仇家还是新门路。',
    category: '江湖',
    actionKind: 'jianghu',
    actionMode: 'trace',
    direction: 'jianghu',
    group: 'personal',
    unlock: {
      stats: { jianghuPrestige: 8 },
      skillsAnyOf: [
        { id: 'shadow_mark', label: '先记暗脉' },
        { id: 'taibai_edge', label: '太白破锋' },
        { id: 'jianghu_duelist', label: '名动江湖' }
      ]
    }
  },
  {
    id: 'action:sect:recruit',
    text: '整编外门',
    actionText: 'action:sect:recruit',
    hint: '把门中外围人手、外门弟子和依附门路慢慢编成自己的靠山。',
    category: '门派',
    actionKind: 'sect',
    actionMode: 'recruit',
    direction: 'martial',
    group: 'sect_inner',
    unlock: {
      requiresSect: true,
      stats: { sectFavor: 20, sectPower: 12 },
      skillsAnyOf: [
        { id: 'canglang_inheritance', label: '沧浪战刀' },
        { id: 'frontier_drill', label: '营务成序' },
        { id: 'retinue_of_minds', label: '幕下成班' }
      ]
    }
  },
  {
    id: 'action:sect:inner_drill',
    text: '门中深修',
    actionText: 'action:sect:inner_drill',
    hint: '回到门中正经把传承往深处走，不只涨武艺，也涨在门里的分量。',
    category: '门派',
    actionKind: 'sect',
    actionMode: 'inner_drill',
    direction: 'martial',
    group: 'sect_inner',
    unlock: {
      requiresSect: true,
      stats: { sectFavor: 18, martialLevel: 22, martialInsight: 10 },
      skillsAnyOf: [
        { id: 'martial_destiny_break', label: '武命破关' },
        { id: 'taibai_inheritance', label: '太白真传' },
        { id: 'qingnang_inheritance', label: '青囊养息' },
        { id: 'xuanfeng_inheritance', label: '玄锋枪骑' },
        { id: 'canglang_inheritance', label: '沧浪战刀' }
      ]
    }
  },
  {
    id: 'action:sect:inner_network',
    text: '走动门中人情',
    actionText: 'action:sect:inner_network',
    hint: '门派不只是传承，门中辈分、人情和规矩也都是能借的势。',
    category: '门派',
    actionKind: 'sect',
    actionMode: 'inner_network',
    direction: 'network',
    group: 'sect_inner',
    unlock: {
      requiresSect: true,
      stats: { sectFavor: 10, influence: 8 },
      skillsAnyOf: [
        { id: 'ritual_literacy', label: '宗谱礼法' },
        { id: 'courtcraft_face', label: '借势开口' },
        { id: 'retinue_of_minds', label: '幕下成班' }
      ]
    }
  }
];

module.exports = {
  FIXED_ACTION_CONFIG
};
