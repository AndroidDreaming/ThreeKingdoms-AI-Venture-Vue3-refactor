const { CITIES_CONTENT } = require('./chronicleV5ContentConfig');
const {
  compareRelationVisibility,
  isRelationMet,
  relationVisibilityState,
  withRelationVisibility
} = require('./chronicleV5RelationVisibility');

const CITY_NAME_MAP = CITIES_CONTENT.reduce((map, city) => {
  map[city.id] = city.name;
  return map;
}, {});

const DEFAULT_RUMOR_STATUS = '我在当地的人声与风闻里第一次听见了这个名字，眼下还隔着一层传闻，只能继续顺线去摸。';
const DEFAULT_HIDDEN_STATUS = '此人眼下还不在我当前所在地域与时势的接触面里。';
const DEFAULT_UNLOCK_STATUS = '我终于在当地的人脉与时势里接上了这个人，先前隔着传闻，如今才算真正照面。';

const HISTORICAL_PRESENCE_RULES = {
  xun_yu: [
    {
      startYear: 196,
      endYear: 220,
      cityIds: ['xuchang', 'luoyang'],
      title: '颍川谋臣',
      summary: '奉迎天子之后，荀彧的重心一直压在许都与洛阳旧朝之间，不会轻易离开中原中枢。',
      sourceNote: '据《三国志》与荀彧相关传记整理，此阶段主要活动范围在许都、洛阳一线。'
    }
  ],
  diao_chan: [
    {
      startYear: 196,
      endYear: 199,
      cityIds: ['luoyang', 'changan', 'xiapi'],
      title: '乱世歌伎',
      summary: '董卓、吕布旧事余波未尽，貂蝉的名字仍在洛阳、长安与徐州之间被人低声提起。',
      sourceNote: '按演义人物线与吕布集团活动范围整理，作为可介入的情感与暗线人物投放。'
    },
    {
      startYear: 200,
      endYear: 220,
      cityIds: ['luoyang', 'xuchang'],
      title: '旧都遗影',
      summary: '旧都风声散尽之后，貂蝉更像一条隐在朝局边缘的旧影，只有真正顺着人情暗线追下去才会照面。',
      sourceNote: '按演义人物线后续留白整理，保留为可拓展支线。'
    }
  ],
  da_qiao: [
    {
      startYear: 196,
      endYear: 220,
      cityIds: ['jianye', 'wu', 'kuaiji', 'chaisang'],
      title: '江东乔氏',
      summary: '乔氏声名牵在江东名门与孙氏旧事之间，吴会、建业和柴桑一带最容易听见她的消息。',
      sourceNote: '据乔氏与江东孙氏相关活动面整理，投放于江东核心城市。'
    }
  ],
  xiao_qiao: [
    {
      startYear: 196,
      endYear: 220,
      cityIds: ['jianye', 'wu', 'kuaiji', 'chaisang'],
      title: '江东乔氏',
      summary: '小乔的名字常随江东文会、舟师宴饮与名士往来浮出水面，越是江东腹地越容易接上这条线。',
      sourceNote: '据乔氏、周瑜与江东活动面整理，投放于江东核心城市。'
    }
  ],
  sun_shangxiang: [
    {
      startYear: 196,
      endYear: 207,
      cityIds: ['jianye', 'wu', 'kuaiji'],
      title: '孙氏郡主',
      summary: '孙尚香仍在江东孙氏内宅与军府边缘长成，行事锋利，常能从弓马、护卫和孙氏门第中露出声息。',
      sourceNote: '据孙氏家族与江东核心地域整理，早期主要投放于吴会。'
    },
    {
      startYear: 208,
      endYear: 220,
      cityIds: ['jianye', 'wu', 'chaisang', 'jiangling'],
      title: '孙刘联姻风口',
      summary: '赤壁前后，孙刘联盟与联姻传闻把她的名字推到更大的局面里，江东与荆州交通线上都可能接触到她。',
      sourceNote: '据孙刘联盟与联姻相关纪事整理，后期扩展至江东、江陵一线。'
    }
  ],
  chen_deng: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['guangling', 'xiapi'],
      title: '广陵陈元龙',
      summary: '建安初年，陈登周旋于广陵、下邳与徐州局势之间，是典型的徐淮名士与地方重心人物。',
      sourceNote: '据陈登生平与徐州局势整理，此期主要活跃在广陵、下邳附近。'
    },
    {
      startYear: 201,
      endYear: 208,
      cityIds: ['xuchang', 'guangling'],
      title: '魏廷徐淮干才',
      summary: '徐州格局改写后，他与许都往来渐密，但根脚依旧牵在徐淮地面。',
      sourceNote: '据陈登后期经历整理，许都与广陵是其更可能被接触到的区域。'
    }
  ],
  mi_zhu: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['xiapi', 'xiaopei', 'pengcheng'],
      title: '徐州别驾',
      summary: '这一阶段糜竺仍紧随刘备系人马辗转徐州旧地，不会无故脱离这条主线南游。',
      sourceNote: '据糜竺与刘备早年行止整理，建安初年活动面仍压在徐州。'
    },
    {
      startYear: 201,
      endYear: 208,
      cityIds: ['xinye', 'xiangyang', 'jiangling'],
      title: '刘备近臣',
      summary: '刘备依附刘表之后，糜竺也随之进入荆州北线与江陵交通圈，兼顾钱粮、人情与商路。',
      sourceNote: '据刘备入荆州后的势力迁移整理，糜竺后续主要出现在新野、襄阳、江陵之间。'
    }
  ],
  zang_ba: [
    {
      startYear: 196,
      endYear: 205,
      cityIds: ['xiapi', 'yecheng'],
      title: '泰山宿将',
      summary: '这一阶段臧霸主要盘踞青徐边缘，与泰山、琅邪及河北边线军府往来最深。',
      sourceNote: '据臧霸相关传记整理，建安初年其重心仍在青徐与河北东缘。'
    }
  ],
  tai_shi_ci: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['jianye', 'wu', 'chaisang'],
      title: '江东勇士',
      summary: '建安初年前后，太史慈正在江东军中辗转受用，活动重心落在吴会与江面要冲。',
      sourceNote: '据太史慈与孙策集团的活动范围整理，此期主要在江东水陆要地。'
    }
  ],
  hua_tuo: [
    {
      startYear: 196,
      endYear: 208,
      cityIds: ['xuchang', 'guangling', 'xiangyang', 'jiangling'],
      title: '游方医者',
      summary: '华佗仍是行走四方的游医，荆襄与江淮之间都可能留下他的诊脉与药箱。',
      sourceNote: '据华佗生平整理，其主要以游方行医见于中原、江淮与荆襄一带。'
    }
  ],
  liu_bei: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['xiaopei', 'xiapi', 'pengcheng'],
      title: '左将军刘备',
      summary: '建安初年前后，刘备仍在徐州与小沛一线和吕布反复纠缠，尚未转入荆州地面。',
      sourceNote: '据刘备与吕布相关纪事整理，建安元年前后其重心仍在徐州。'
    },
    {
      startYear: 201,
      endYear: 208,
      cityIds: ['xinye', 'xiangyang', 'jiangling'],
      title: '荆州刘备',
      summary: '依附刘表之后，刘备的活动线压在荆州北境、新野与江陵交通轴上。',
      sourceNote: '据刘备入荆州后的行迹整理，后续主要活动于荆州北线。'
    }
  ],
  liu_biao: [
    {
      startYear: 196,
      endYear: 208,
      cityIds: ['xiangyang', 'jiangling'],
      title: '荆州牧刘表',
      summary: '荆州军政、人事与州府文书的核心重心都压在襄阳与江陵之间。',
      sourceNote: '据刘表相关记载整理，建安初年长期坐镇荆州核心。'
    }
  ],
  cao_cao: [
    {
      startYear: 196,
      endYear: 220,
      cityIds: ['xuchang', 'luoyang'],
      title: '曹公',
      summary: '奉迎天子之后，曹操的实际中枢就压在许都与洛阳旧朝之间。',
      sourceNote: '据曹操相关纪事整理，建安元年后长期以许都为核心。'
    }
  ],
  yuan_shao: [
    {
      startYear: 196,
      endYear: 202,
      cityIds: ['yecheng', 'pingyuan'],
      title: '河北盟主',
      summary: '这一阶段河北军政声势主要围着袁绍及其属下势力场运转。',
      sourceNote: '据袁绍集团活动面整理，建安初年重心在冀州、河北。'
    }
  ],
  yuan_shu: [
    {
      startYear: 196,
      endYear: 199,
      cityIds: ['shouchun'],
      title: '淮南袁公',
      summary: '寿春就是袁术在淮南张旗聚势的主场，财赋、兵力和野心都在此堆高。',
      sourceNote: '据袁术相关纪事整理，建安初年核心据点在寿春。'
    }
  ],
  sun_quan: [
    {
      startYear: 196,
      endYear: 199,
      cityIds: ['jianye', 'wu'],
      title: '孙氏少主',
      summary: '此时的孙权仍随孙策经营江东基业，重心落在吴会一带，还未正式独掌江东。',
      sourceNote: '据孙权、孙策相关纪事整理，建安初年孙权仍在江东随兄历练。'
    },
    {
      startYear: 200,
      endYear: 220,
      cityIds: ['jianye', 'wu', 'chaisang'],
      title: '江东之主',
      summary: '孙策死后，江东政军与舟师、人事的重心逐渐归拢到孙权手里。',
      sourceNote: '据孙权接掌江东后的行迹整理，建安五年前后起正式成为核心人物。'
    }
  ],
  sun_ce: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['jianye', 'wu', 'kuaiji', 'chaisang'],
      title: '江东小霸王',
      summary: '孙策正在江东连战立威，吴会与沿江军府处处都带着他的锋芒。',
      sourceNote: '据孙策集团发展整理，建安初年其主要活动面就在江东诸郡。'
    }
  ],
  guan_yu: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['xiaopei', 'xiapi', 'pengcheng'],
      title: '刘备部将',
      summary: '建安初年前后，关羽仍随刘备在徐州、小沛之间转战，不会突然偏离这条线。',
      sourceNote: '据刘备、关羽相关记载整理，建安初年活动面仍在徐州。'
    },
    {
      startYear: 201,
      endYear: 208,
      cityIds: ['xinye', 'xiangyang', 'jiangling'],
      title: '荆州关羽',
      summary: '刘备入荆州后，关羽也在北线营务、守备与军行之间逐渐站稳位置。',
      sourceNote: '据刘备入荆州后的行止整理，关羽随后进入荆州活动面。'
    }
  ],
  zhang_fei: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['xiaopei', 'xiapi', 'pengcheng'],
      title: '刘备部将',
      summary: '此时张飞仍随刘备在徐州势力场中辗转，不会先于主线跑去别州乱闯。',
      sourceNote: '据刘备、张飞早年经历整理，建安初年活动面仍在徐州。'
    },
    {
      startYear: 201,
      endYear: 208,
      cityIds: ['xinye', 'xiangyang', 'jiangling'],
      title: '荆州张飞',
      summary: '刘备转入荆州之后，张飞的军锋与部曲也跟着压向荆州北线。',
      sourceNote: '据刘备入荆州后的行迹整理，张飞也随之进入荆州活动面。'
    }
  ],
  zhang_xiu: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['wan'],
      title: '宛城张绣',
      summary: '宛城就是张绣最稳的地盘和缓冲带，北面曹营、南面荆州都离得太近。',
      sourceNote: '据张绣相关纪事整理，建安初年核心据点在宛城。'
    }
  ],
  zhuge_liang: [
    {
      startYear: 196,
      endYear: 197,
      cityIds: [],
      title: '琅琊少年',
      summary: '建安元年前后，诸葛亮仍随叔父诸葛玄在外郡漂泊，尚未真正定居隆中。',
      sourceNote: '据诸葛亮、诸葛玄相关纪事整理，建安初年活动面尚未稳定。'
    },
    {
      startYear: 198,
      endYear: 207,
      cityIds: ['xinye', 'xiangyang'],
      title: '隆中诸葛亮',
      summary: '叔父亡故之后，他逐渐在襄阳与隆中一带落脚，此时名望初成，尚未正式出山。',
      sourceNote: '据诸葛亮定居与结交范围整理，后期活动面与襄阳相连。'
    },
    {
      startYear: 208,
      endYear: 220,
      cityIds: ['xiangyang', 'jiangling', 'chengdu'],
      title: '卧龙诸葛亮',
      summary: '刘备三顾之后，军政筹划与后续入蜀布局里，处处都能看见诸葛亮的手笔。',
      sourceNote: '据诸葛亮出山与入蜀时间整理，建安十三年后正式进入主线核心。'
    }
  ],
  zhao_yun: [
    {
      startYear: 196,
      endYear: 199,
      cityIds: ['beiping', 'yecheng'],
      title: '幽州骑士',
      summary: '此时赵云仍在北地军旅与公孙旧部势力圈中辗转，活动面主要落在河北、幽州。',
      sourceNote: '据赵云早年经历整理，其初期仍在北地诸军中活动。'
    },
    {
      startYear: 200,
      endYear: 220,
      cityIds: ['xinye', 'xiangyang', 'jiangling', 'chengdu'],
      title: '刘备部将',
      summary: '转依刘备之后，赵云的行动面渐渐与荆州、后续蜀汉路线上重合。',
      sourceNote: '据赵云后期经历整理，归附刘备后主要活动于荆州与蜀地。'
    }
  ],
  zhou_yu: [
    {
      startYear: 196,
      endYear: 197,
      cityIds: ['wu'],
      title: '庐江英士',
      summary: '建安元年前后，周瑜与孙策仍处于重新并线的阶段，活动面先压在江东东部。',
      sourceNote: '据周瑜、孙策相关纪事整理，正式深度接入江东军府还要稍后一些。'
    },
    {
      startYear: 198,
      endYear: 210,
      cityIds: ['jianye', 'wu', 'chaisang'],
      title: '江东儒将',
      summary: '重返孙氏阵营之后，周瑜在江东军政与水陆筹划中的位置迅速抬高。',
      sourceNote: '据周瑜相关传记整理，后期主要活动于江东核心区域。'
    }
  ],
  chen_gong: [
    {
      startYear: 196,
      endYear: 198,
      cityIds: ['xiapi', 'xiaopei'],
      title: '徐州谋士',
      summary: '吕布在徐州立足期间，陈宫的谋划与声望也集中在下邳、小沛一线。',
      sourceNote: '据陈宫与吕布相关纪事整理，建安初年活动重心在徐州。'
    }
  ],
  sima_yi: [
    {
      startYear: 196,
      endYear: 200,
      cityIds: ['luoyang'],
      title: '河内司马氏子',
      summary: '此时的司马懿尚在河内温县家门之中，名声还未完全卷进许都权力场。',
      sourceNote: '据司马懿早年经历整理，建安初年仍以家居与地方名士身份为主。'
    },
    {
      startYear: 201,
      endYear: 220,
      cityIds: ['xuchang', 'luoyang'],
      title: '魏营谋士',
      summary: '受征辟之后，司马懿逐步进入曹营机要与中枢谋划，许都、洛阳成为主要活动面。',
      sourceNote: '据司马懿仕魏后的时间线整理，后续主要出现在魏国中枢。'
    }
  ],
  lu_meng: [
    {
      startYear: 196,
      endYear: 199,
      cityIds: ['wu', 'chaisang', 'jianye'],
      title: '江东少年军吏',
      summary: '此时的吕蒙尚在军中磨砺，跟随江东旧部立足，还未真正成名。',
      sourceNote: '据吕蒙早年经历整理，建安初年已经在江东军旅中历练。'
    },
    {
      startYear: 200,
      endYear: 220,
      cityIds: ['jianye', 'chaisang'],
      title: '江东宿将',
      summary: '随着江东军政稳固，吕蒙在沿江防务与兵事筹划里的分量越来越重。',
      sourceNote: '据吕蒙后期经历整理，其核心活动面长期在江东。'
    }
  ],
  gongsun_zan: [
    {
      startYear: 196,
      endYear: 199,
      cityIds: ['beiping'],
      title: '白马将军',
      summary: '幽州边线与旧骑军的气口仍压在公孙瓒手上，北平是他最硬的根基。',
      sourceNote: '据公孙瓒相关记载整理，建安初年核心仍在幽州。'
    }
  ],
  lu_bu: [
    {
      startYear: 196,
      endYear: 198,
      cityIds: ['xiapi', 'xiaopei'],
      title: '徐州温侯',
      summary: '这一阶段吕布盘踞下邳，主场仍是徐州，本不该无缘无故脱出本州轨道。',
      sourceNote: '据吕布相关纪事整理，建安元年前后核心地盘在下邳。'
    }
  ]
};

function clampYear(year) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric)) return 196;
  return Math.floor(numeric);
}

function uniqueCityIds(cityIds) {
  if (!Array.isArray(cityIds)) return [];
  return cityIds.filter((item, index) => item && cityIds.indexOf(item) === index);
}

function cityLabels(cityIds) {
  return uniqueCityIds(cityIds).map((cityId) => CITY_NAME_MAP[cityId] || cityId);
}

function pickPresenceStage(relationId, year) {
  const list = HISTORICAL_PRESENCE_RULES[relationId];
  if (!Array.isArray(list) || !list.length) return null;
  const targetYear = clampYear(year);
  return list.find((item) => targetYear >= Number(item.startYear || 0) && targetYear <= Number(item.endYear || 9999)) || null;
}

function evaluateHistoricalPresence(relationId, options = {}) {
  const targetYear = clampYear(options.year);
  const targetCityId = String(options.cityId || '').trim();
  const stage = pickPresenceStage(relationId, targetYear);
  const cityIds = uniqueCityIds(stage && stage.cityIds);
  const discovered = !!(targetCityId && cityIds.includes(targetCityId));
  return {
    year: targetYear,
    active: !!stage,
    discovered,
    cityIds,
    titleOverride: stage && stage.title ? stage.title : '',
    summaryOverride: stage && stage.summary ? stage.summary : '',
    sourceNote: stage && stage.sourceNote ? stage.sourceNote : '',
    hiddenStatus: cityIds.length
      ? `此人此时的活动重心仍在${cityLabels(cityIds).join('、')}一带，我还没有真正走进他的接触圈。`
      : DEFAULT_HIDDEN_STATUS
  };
}

function syncHistoricalRelationPresence(relationships, options = {}) {
  const list = Array.isArray(relationships) ? relationships.slice() : [];
  const targetYear = clampYear(options.year);
  const targetCityId = String(options.cityId || '').trim();
  const preserveDiscovery = options.preserveDiscovery !== false;
  const unlocked = [];

  const next = list.map((relation) => {
    if (!relation || relation.isHistorical !== true || !relation.id) return relation;
    const presence = evaluateHistoricalPresence(relation.id, {
      year: targetYear,
      cityId: targetCityId
    });
    const currentState = relationVisibilityState(relation, 'hidden');
    let nextState = presence.discovered ? 'rumor' : 'hidden';
    if (preserveDiscovery && compareRelationVisibility(currentState, nextState) > 0) {
      nextState = currentState;
    }
    if (preserveDiscovery && isRelationMet(relation)) {
      nextState = 'met';
    }

    const baseTitle = relation.historicalBaseTitle || relation.title || '';
    const baseSummary = relation.historicalBaseSummary || relation.summary || '';
    const nextRelation = Object.assign({}, withRelationVisibility(relation, nextState), {
      historicalBaseTitle: baseTitle,
      historicalBaseSummary: baseSummary,
      title: presence.titleOverride || baseTitle,
      summary: presence.summaryOverride || baseSummary,
      historicalPresence: {
        year: targetYear,
        active: presence.active,
        cityIds: presence.cityIds.slice(),
        sourceNote: presence.sourceNote || ''
      }
    });

    if (nextState === 'hidden') {
      nextRelation.status = presence.hiddenStatus;
      return nextRelation;
    }

    if (!isRelationMet(nextRelation)) {
      if (compareRelationVisibility(currentState, 'rumor') < 0) {
        nextRelation.status = DEFAULT_RUMOR_STATUS;
        unlocked.push({
          id: nextRelation.id,
          name: nextRelation.name || nextRelation.id,
          title: nextRelation.title || '',
          revealState: 'rumor'
        });
      }
      return nextRelation;
    }

    if (!isRelationMet(relation)) {
      nextRelation.status = DEFAULT_UNLOCK_STATUS;
      unlocked.push({
        id: nextRelation.id,
        name: nextRelation.name || nextRelation.id,
        title: nextRelation.title || '',
        revealState: 'met'
      });
    }

    return nextRelation;
  });

  return {
    relationships: next,
    unlocked
  };
}

module.exports = {
  HISTORICAL_PRESENCE_RULES,
  evaluateHistoricalPresence,
  syncHistoricalRelationPresence
};
