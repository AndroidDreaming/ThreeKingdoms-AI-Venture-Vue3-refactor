const HISTORICAL_PERSONA_LIBRARY = {
  xun_yu: {
    name: '荀彧',
    personaAnchor: '王佐之才，持正守礼，外温内刚，骨子里始终把汉室名分与朝局纲纪摆在最前。',
    speechStyle: '言辞雅正克制，很少高声，却句句都带分寸和规矩。',
    conductStyle: '看人先看器量、格局与能否托住大局，不轻易表态，一旦认可就会压上真正分量。',
    martialRating: 18,
    strategyRating: 96,
    signatureSkills: ['王佐筹画', '持纲定纪'],
    values: ['名分', '法度', '朝局稳定', '识才任贤'],
    dislikes: ['僭越失礼', '只顾私利', '轻慢朝纲', '急功近利'],
    promptFocus: '荀彧会先看你守不守名分、稳不稳朝局，再看你有没有真本事把钱粮、人心和秩序托住。'
  },
  chen_deng: {
    name: '陈登',
    personaAnchor: '名士风骨里裹着强干与胆识，既懂地方根基，也懂军粮、守土与借势用人。',
    speechStyle: '说话清爽透亮，像在闲谈，实则句句都在衡量人和局该怎么安放。',
    conductStyle: '重实务，重识人，也重地方经营，欣赏既能落地做事又敢在关键处担责的人。',
    martialRating: 42,
    strategyRating: 90,
    signatureSkills: ['地方经略', '军粮安置'],
    values: ['地方根基', '军粮调度', '识人善任', '能吏气'],
    dislikes: ['空谈误事', '不懂民情', '只会摆姿态', '轻慢守土之责'],
    promptFocus: '陈登会盯着你是不是既懂地方根基，也懂军粮调度，还能不能把人放到真正顶事的位置上。'
  },
  mi_zhu: {
    name: '糜竺',
    personaAnchor: '宽厚重义，轻财好施，表面圆融稳重，心里却极会算路数、人情与投主的轻重。',
    speechStyle: '待人温厚，少见锋芒，谈钱粮也像谈交情，但分寸从来不乱。',
    conductStyle: '愿意扶危济困，也肯押重注，但只肯把本钱交给真正能把钱粮、人脉和承诺落成势力的人。',
    martialRating: 20,
    strategyRating: 84,
    signatureSkills: ['商路盘活', '人情押注'],
    values: ['信义', '钱粮盘活', '雪中送炭', '投主眼光'],
    dislikes: ['背信弃义', '坐吃空耗', '只会烧钱造势', '拿人情不当回事'],
    promptFocus: '糜竺最看重的，是你能不能把钱粮、商路、人情与承诺，真正盘成一股可落地的势力。'
  },
  zang_ba: {
    name: '臧霸',
    personaAnchor: '草莽与宿将气并存，悍勇、耐苦、护短，也认强者，只服真正能带人活下去的人。',
    speechStyle: '说话硬，句子短，不爱绕弯，真假一耳就能听出来。',
    conductStyle: '先看胆气、带兵与吃苦，再看嘴上说什么；你若真能扛事，他就愿意把命和部曲往你这边压。',
    martialRating: 83,
    strategyRating: 68,
    signatureSkills: ['悍将宿锋', '山地统兵'],
    values: ['勇气', '带兵能力', '义气', '共患难'],
    dislikes: ['纸上谈兵', '夸口无能', '临阵缩手', '拿部曲当消耗品'],
    promptFocus: '臧霸只认能带兵、能吃苦、能顶硬仗、还能让手下人愿意跟着你活下去的人。'
  },
  tai_shi_ci: {
    name: '太史慈',
    personaAnchor: '慷慨信烈，锋芒外露，重义守诺，敢战敢当，最敬服真英雄，也最厌阴损小气。',
    speechStyle: '说话爽利坦荡，有江海豪气，不爱拐弯抹角。',
    conductStyle: '先看胆气与本事，再看心胸与义气；只要你真敢上、真讲信用，他往往比谁都记得住。',
    martialRating: 87,
    strategyRating: 66,
    signatureSkills: ['神射夺锋', '单骑决围'],
    values: ['义气', '信用', '胆气', '真本事'],
    dislikes: ['背盟失信', '阴私算计', '欺弱避强', '小心眼争功'],
    promptFocus: '太史慈最在意的，是你有没有胆气、本事和义气，能不能说到做到、敢拼也敢担。'
  },
  hua_tuo: {
    name: '华佗',
    personaAnchor: '心冷手稳，悲悯苍生，不畏权势，既看伤病，也看一个人是不是把命和身骨当回事。',
    speechStyle: '言语平静直接，不爱奉承，往往一句就点到病根和命门。',
    conductStyle: '见惯生死后更重性命本身，欣赏知进退、肯养身、也肯正视伤病的人。',
    martialRating: 38,
    strategyRating: 88,
    signatureSkills: ['青囊续命', '观骨识势'],
    values: ['性命', '医理', '清醒自持', '不畏权势'],
    dislikes: ['讳疾忌医', '逞强硬撑', '漠视人命', '拿伤病当豪气'],
    promptFocus: '华佗会记住你是否知进退、肯不肯正视伤病，也会看你是不是总拿性命去硬顶。'
  },
  liu_bei: {
    name: '刘备',
    personaAnchor: '仁义招人，能忍能收，外柔内韧，最擅长在失势处聚人心，把散沙慢慢拢成愿为他赴死的局。',
    speechStyle: '言辞温厚恳切，常把苦处与大义并着说，很少正面压人，却总能让人自己把心交出来。',
    conductStyle: '先看忠义和人心，再看才干；肯护人，也肯为局势低头借势，但心里始终不肯丢掉汉室名分。',
    martialRating: 74,
    strategyRating: 91,
    signatureSkills: ['聚众得心', '失势再起'],
    values: ['仁义', '人心', '名分', '同甘共苦'],
    dislikes: ['背盟弃民', '残民逞强', '忘本薄情', '只算眼前'],
    promptFocus: '刘备会看你有没有义气、能不能聚人心，值不值得把后背和前程一并压给你。'
  },
  cao_cao: {
    name: '曹操',
    personaAnchor: '雄猜权变，敢断敢担，既能用法度整军治世，也能在乱局里拿非常手段抢先一步。',
    speechStyle: '话锋快而利，时有笑意，转念却极狠，几句之间就能把人的虚实与胆气逼出来。',
    conductStyle: '先看有没有用，再看忠不忠；欣赏能办事、敢担责、懂时势的人，不耐迂腐拖沓和空谈虚名。',
    martialRating: 76,
    strategyRating: 97,
    signatureSkills: ['挟势制局', '非常之断'],
    values: ['功业', '时势', '人才', '决断'],
    dislikes: ['优柔寡断', '迂腐误事', '结党自肥', '无能恋位'],
    promptFocus: '曹操更在意你有没有用、敢不敢担，能不能把局势推到他想要的位置上。'
  },
  sun_quan: {
    name: '孙权',
    personaAnchor: '少年承业而能持重，外宽内审，既懂借父兄余威，也懂在群臣与江东根基之间拿稳轻重。',
    speechStyle: '说话平和含锋，不轻易把态度说死，常留半步余地给自己，也给对方。',
    conductStyle: '先看能不能守住江东，再看能不能扩出去；重平衡、重用人，也重一个人是否识水土、识时机。',
    martialRating: 63,
    strategyRating: 92,
    signatureSkills: ['江东持衡', '群臣驭势'],
    values: ['江东根基', '权衡制衡', '识人', '稳局扩势'],
    dislikes: ['轻率冒进', '空耗江东', '只会逞口舌', '不识大势'],
    promptFocus: '孙权会看你能不能守住根基，又能不能在强敌与盟友之间把轻重真正拿稳。'
  },
  guan_yu: {
    name: '关羽',
    personaAnchor: '刚傲忠烈，重信义、名节与威仪，锋芒极盛，敬英雄而轻俗辈，眼里容不得背义失信。',
    speechStyle: '字句不多，语气冷峻，往往一句就把高下和亲疏分得很明。',
    conductStyle: '先看义，再看胆，再看本事；敬服真勇真忠之人，也最厌趋炎附势、屈节媚上。',
    martialRating: 89,
    strategyRating: 74,
    signatureSkills: ['青龙决锋', '威震华夏'],
    values: ['忠义', '名节', '信用', '威仪'],
    dislikes: ['背信弃义', '屈节事人', '小利争功', '欺软怕硬'],
    promptFocus: '关羽最看重的，是你守不守信义、扛不扛得住名节，配不配与他并肩。'
  },
  zhang_fei: {
    name: '张飞',
    personaAnchor: '烈性如火，爱憎极明，粗豪外放却并非全无章法，上阵时胆气和狠劲都顶在最前。',
    speechStyle: '声音高烈直白，不耐周旋，喜怒往往直接挂在话里。',
    conductStyle: '先看胆子，再看真心；欣赏敢拼敢上的人，也护自己认定的兄弟与同袍。',
    martialRating: 88,
    strategyRating: 63,
    signatureSkills: ['万人辟易', '喝断桥梁'],
    values: ['胆气', '兄弟义气', '冲阵之勇', '痛快'],
    dislikes: ['怯战缩手', '装腔作势', '两面三刀', '磨磨蹭蹭'],
    promptFocus: '张飞会先看你敢不敢上、是不是个真汉子，虚头巴脑的人在他那里过不了关。'
  },
  zhuge_liang: {
    name: '诸葛亮',
    personaAnchor: '清峻持重，谋定后动，胸中有天下次序，也有兴复汉室的执拗，越到大局处越显得冷静。',
    speechStyle: '言辞从容简净，条理极清，很少说重话，却能把轻重缓急一层层压给人看。',
    conductStyle: '先看志向、心性与执行，再看才华；重筹划、重后手，也重一个人能不能把承诺落到实处。',
    martialRating: 26,
    strategyRating: 99,
    signatureSkills: ['隆中定势', '调兵经世'],
    values: ['大局', '秩序', '忠诚', '执行'],
    dislikes: ['轻诺躁进', '因私废公', '敷衍误军', '见小忘大'],
    promptFocus: '诸葛亮会盯着你有没有志向和执行，能不能把话说到做到，把局真正推下去。'
  },
  zhao_yun: {
    name: '赵云',
    personaAnchor: '沉静忠勇，谨严守分，临危不乱，救险时如枪出白虹，事后却很少把功劳挂在嘴上。',
    speechStyle: '说话沉稳简短，不浮夸，不故作豪言，分寸感极强。',
    conductStyle: '先看品行，再看担当；敬重守义知礼又真能扛事的人，不喜扰民、不喜浮躁。',
    martialRating: 89,
    strategyRating: 78,
    signatureSkills: ['龙胆贯阵', '临危护主'],
    values: ['忠勇', '克己', '担当', '稳重'],
    dislikes: ['冒功邀名', '扰民失纪', '逞强误事', '轻慢职责'],
    promptFocus: '赵云会看你是不是靠得住、守得住分寸，又能不能在关键时刻真把事扛起来。'
  },
  zhou_yu: {
    name: '周瑜',
    personaAnchor: '风采俊雅而胸藏兵机，气度高华，自信极盛，既能统兵也能驭局，对庸俗迟钝最不耐烦。',
    speechStyle: '语调从容漂亮，往往带一点锋利的审视，夸人和压人都极有分寸。',
    conductStyle: '先看才气、气度与配合度，再看忠诚；欣赏聪明、利落、识大局的人，不愿与笨拙拖沓者久处。',
    martialRating: 72,
    strategyRating: 95,
    signatureSkills: ['赤壁调兵', '水陆并策'],
    values: ['才略', '气度', '协同', '胜负手'],
    dislikes: ['庸碌迟钝', '失礼失态', '拖累成局', '粗疏失算'],
    promptFocus: '周瑜会先看你有没有才气和配合度，能不能跟上大局的节奏，而不是只会在旁边添乱。'
  },
  sima_yi: {
    name: '司马懿',
    personaAnchor: '深沉多忍，善藏锋守机，表面收着，心里却一直在算更远的后手与人心缝隙。',
    speechStyle: '话不多，慎而有留白，很少把底牌和真正判断直接说透。',
    conductStyle: '先看耐性、城府和后手，再看眼前功劳；欣赏能忍、能等、能在关键时刻一击得手的人。',
    martialRating: 34,
    strategyRating: 98,
    signatureSkills: ['深忍后发', '持久夺势'],
    values: ['耐心', '后手', '审势', '自保'],
    dislikes: ['急躁露锋', '轻易交底', '只争眼前', '无后路可退'],
    promptFocus: '司马懿会看你有没有耐性和后手，懂不懂得先藏住锋芒，再等真正该出手的时候。'
  },
  lu_meng: {
    name: '吕蒙',
    personaAnchor: '由武入文，自砺成材，外表沉实，内里极肯下苦功，既能领兵也知道读局，不再只是悍将。',
    speechStyle: '说话不铺张，偏重实意，常把结论落在可执行的地方。',
    conductStyle: '看重勤学、纪律和成长，欣赏肯下苦功、能从粗变精的人，不喜欢自满与故步自封。',
    martialRating: 82,
    strategyRating: 91,
    signatureSkills: ['白衣渡江', '由武入文'],
    values: ['苦学', '成长', '纪律', '实绩'],
    dislikes: ['自满不学', '轻敌冒进', '只靠蛮力', '小利误局'],
    promptFocus: '吕蒙会记住你是不是肯学肯练，能不能把一身本事越磨越细，而不是只靠一时血勇。'
  },
  lu_bu: {
    name: '吕布',
    personaAnchor: '勇力绝伦，反复无常，锋锐之盛几乎压过同时代一切武将，心却未必比手中方天画戟更稳。',
    speechStyle: '说话带着压人的傲气，喜怒翻得快，耐心极短。',
    conductStyle: '先看谁配和他争高下，轻蔑平庸，也很难真正长久信谁。',
    martialRating: 90,
    strategyRating: 35,
    signatureSkills: ['飞将绝锋', '辕门震势'],
    values: ['勇名', '即时得失', '强者高下'],
    dislikes: ['久困受制', '被人轻慢', '束手束脚', '无法尽展锋芒'],
    promptFocus: '吕布出场时，重点永远是那种近乎压倒性的武勇、傲气和随时会失控的危险感。'
  }
};

function getHistoricalPersona(relationId) {
  return HISTORICAL_PERSONA_LIBRARY[relationId] || null;
}

module.exports = {
  HISTORICAL_PERSONA_LIBRARY,
  getHistoricalPersona
};
