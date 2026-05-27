const STAT_LABELS = {
  governance: '内政',
  commerce: '经商',
  diplomacy: '外交',
  military: '军务',
  strategy: '谋略',
  martialLevel: '武学',
  martialInsight: '武感',
  health: '身骨',
  fatigue: '疲惫',
  morale: '士气',
  renown: '名望',
  influence: '声势',
  troops: '部曲',
  supplies: '粮秣',
  coins: '钱财',
  jianghuPrestige: '江湖名望',
  battlefieldPrestige: '战阵威名',
  sectFavor: '门派情分',
  sectPower: '门派势力'
};

const SKILL_METADATA = {
  bare_survival: { triggerHint: '资源吃紧、行路吃苦或局面失手时兜底', scopeTags: ['求生', '兜底', '低资源'], passiveType: '底线' },
  ritual_literacy: { triggerHint: '适用于外交、社交、情感与投门交涉', scopeTags: ['礼法', '交涉', '人脉'], passiveType: '判定' },
  militia_command: { triggerHint: '适用于募兵、练兵、军务与战阵推进', scopeTags: ['军旅', '募练', '部曲'], passiveType: '成长' },
  memorial_craft: { triggerHint: '适用于治理、调查、谋略与静读', scopeTags: ['治理', '筹画', '旧案'], passiveType: '判定' },
  market_instinct: { triggerHint: '适用于经商、转运与远行周转', scopeTags: ['经营', '商路', '远行'], passiveType: '收益' },
  survival_instinct: { triggerHint: '适用于低资源与逆风局止损', scopeTags: ['求生', '止损', '危局'], passiveType: '兜底' },
  wild_footwork: { triggerHint: '适用于远行、遭遇战与江湖过招', scopeTags: ['身法', '远行', '脱身'], passiveType: '兜底' },
  wild_counter: { triggerHint: '适用于兵少或逆风时硬扛一口气', scopeTags: ['逆风', '反咬', '战斗'], passiveType: '兜底' },
  taibai_edge: { triggerHint: '适用于试锋、探查与江湖问剑', scopeTags: ['剑脉', '试锋', '名望'], passiveType: '爆发' },
  taibai_flash: { triggerHint: '适用于高强度战斗与决胜一手', scopeTags: ['剑脉', '决胜', '武名'], passiveType: '爆发' },
  canglang_press: { triggerHint: '适用于练兵、压阵与正面冲撞', scopeTags: ['刀阵', '压阵', '士气'], passiveType: '成长' },
  canglang_break: { triggerHint: '适用于兵势尚足时扩大战果', scopeTags: ['战刀', '破营', '战果'], passiveType: '爆发' },
  qingnang_breath: { triggerHint: '适用于休整、修习与门中静修', scopeTags: ['养息', '续战', '恢复'], passiveType: '恢复' },
  qingnang_guard: { triggerHint: '适用于低血线与硬撑场面', scopeTags: ['护元', '保底', '低血线'], passiveType: '兜底' },
  xuanfeng_charge: { triggerHint: '适用于转场、军务与抢先动手', scopeTags: ['突骑', '先手', '转场'], passiveType: '节奏' },
  xuanfeng_breakline: { triggerHint: '适用于高压局与强行破局', scopeTags: ['破局', '高压', '军旅'], passiveType: '爆发' },
  survival_cache: { triggerHint: '适用于低资源场景下保存本钱', scopeTags: ['求生', '粮秣', '低资源'], passiveType: '兜底' },
  survival_exit: { triggerHint: '适用于失败或逆风后的抽身止损', scopeTags: ['止损', '撤身', '逆风'], passiveType: '兜底' },
  courtcraft_face: { triggerHint: '适用于社交、交涉、宴会与情感试探', scopeTags: ['朝局', '社交', '话术'], passiveType: '判定' },
  courtcraft_balance: { triggerHint: '适用于人情周旋与失手后的关系缓冲', scopeTags: ['周旋', '缓冲', '人情'], passiveType: '兜底' },
  mercantile_margin: { triggerHint: '适用于经商、压货与周转变现', scopeTags: ['商路', '价差', '收益'], passiveType: '收益' },
  mercantile_convoy: { triggerHint: '适用于远行商队与跨城调度', scopeTags: ['商队', '转运', '远行'], passiveType: '收益' },
  frontier_drill: { triggerHint: '适用于练兵、整军与营务经营', scopeTags: ['营务', '练兵', '士气'], passiveType: '成长' },
  frontier_supply: { triggerHint: '适用于大队补给与战后稳盘', scopeTags: ['军需', '补给', '稳盘'], passiveType: '收益' },
  shadow_mark: { triggerHint: '适用于探查、设局与顺线深挖', scopeTags: ['暗线', '探查', '线索'], passiveType: '成长' },
  shadow_turn: { triggerHint: '适用于阴线行动失手后的回身', scopeTags: ['暗线', '回身', '止损'], passiveType: '兜底' },
  taibai_inheritance: { triggerHint: '适用于太白门中修习、探查与问剑', scopeTags: ['门派', '太白', '剑脉'], passiveType: '成长' },
  canglang_inheritance: { triggerHint: '适用于沧浪门中的练兵与压阵', scopeTags: ['门派', '沧浪', '刀阵'], passiveType: '成长' },
  qingnang_inheritance: { triggerHint: '适用于青囊门中的养息与长线经营', scopeTags: ['门派', '青囊', '养息'], passiveType: '恢复' },
  xuanfeng_inheritance: { triggerHint: '适用于玄锋门中的调动、奔袭与破阵', scopeTags: ['门派', '玄锋', '先手'], passiveType: '节奏' },
  martial_destiny_break: { triggerHint: '适用于武学线真正定型后的关键手', scopeTags: ['武学', '破关', '定型'], passiveType: '成长' },
  battlefield_vanguard: { triggerHint: '适用于军旅线成形后的冲阵与立威', scopeTags: ['战阵', '军旅', '威名'], passiveType: '爆发' },
  battlefield_legend: { triggerHint: '适用于大战、鏖战与正面决胜', scopeTags: ['战阵', '传奇', '破军'], passiveType: '爆发' },
  jianghu_duelist: { triggerHint: '适用于江湖问剑、切磋与立名', scopeTags: ['江湖', '问剑', '名望'], passiveType: '爆发' },
  jianghu_supreme: { triggerHint: '适用于江湖线顶峰时的扩张', scopeTags: ['江湖', '绝顶', '威名'], passiveType: '爆发' },
  civil_admin_pillar: { triggerHint: '适用于内政稳盘、清仓与巡乡', scopeTags: ['内政', '民生', '稳盘'], passiveType: '收益' },
  commerce_route_open: { triggerHint: '适用于经营成网后的贸易与调度', scopeTags: ['经营', '商路', '钱粮'], passiveType: '收益' },
  strategy_board_sense: { triggerHint: '适用于调查、交涉与谋局联动', scopeTags: ['谋略', '布局', '联动'], passiveType: '成长' },
  retinue_of_minds: { triggerHint: '适用于有班底后的经营、谋略与协同', scopeTags: ['班底', '协同', '内政'], passiveType: '成长' },
  heart_anchor: { triggerHint: '适用于情感、社交与休整后的稳心', scopeTags: ['情感', '士气', '稳心'], passiveType: '恢复' },
  martial_first_gate: { triggerHint: '适用于武学刚成后第一次把武力兑现出来', scopeTags: ['武学', '试锋', '成长'], passiveType: '成长' },
  martial_master: { triggerHint: '适用于武学大成后的战斗兑现', scopeTags: ['武学', '大师', '爆发'], passiveType: '爆发' }
};

function uniqueList(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));
}

function mergeDelta(base, patch) {
  const next = Object.assign({}, base || {});
  Object.keys(patch || {}).forEach((key) => {
    const value = Number((patch || {})[key] || 0);
    if (!value) return;
    next[key] = Number(next[key] || 0) + value;
  });
  return next;
}

function formatDeltaLine(delta) {
  const parts = Object.keys(delta || {}).reduce((list, key) => {
    const value = Number((delta || {})[key] || 0);
    if (!value) return list;
    list.push(`${STAT_LABELS[key] || key}${value > 0 ? '+' : ''}${value}`);
    return list;
  }, []);
  return parts.join(' · ');
}

function normalizeSkillRecord(skill) {
  if (!skill || !skill.id) return null;
  const meta = SKILL_METADATA[skill.id] || {};
  return {
    id: String(skill.id),
    name: skill.name || meta.name || String(skill.id),
    type: skill.type || meta.type || '通用',
    level: skill.level || meta.level || '基础',
    effect: skill.effect || skill.description || meta.effect || '',
    triggerHint: skill.triggerHint || meta.triggerHint || '',
    scopeTags: uniqueList([].concat(skill.scopeTags || [], meta.scopeTags || [])),
    passiveType: skill.passiveType || meta.passiveType || '被动'
  };
}

function normalizeSkillList(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map((item) => normalizeSkillRecord(item))
    .filter((item) => item && item.id && !seen.has(item.id) && seen.add(item.id));
}

function hasSkill(state, skillId) {
  if (!skillId) return false;
  const skills = state && state.gameState ? state.gameState.skills : state;
  return (Array.isArray(skills) ? skills : []).some((item) => item && item.id === skillId);
}

function getSkillName(state, skillId) {
  const skills = state && state.gameState ? state.gameState.skills : state;
  const found = (Array.isArray(skills) ? skills : []).find((item) => item && item.id === skillId);
  if (found) return found.name || skillId;
  return (SKILL_METADATA[skillId] && SKILL_METADATA[skillId].name) || skillId;
}

function isKind(context, list) {
  return list.includes(String((context && context.kind) || '').trim());
}

function isMode(context, list) {
  return list.includes(String((context && context.mode) || '').trim());
}

function isSuccessTier(tier) {
  return tier === 'great' || tier === 'good';
}

function isRiskyContext(context) {
  return isKind(context, ['battle', 'warpath', 'jianghu', 'military', 'travel', 'spar']);
}

function lowResourceState(gs) {
  return Number(gs.coins || 0) <= 12
    || Number(gs.supplies || 0) <= 20
    || Number(gs.health || 0) <= 42
    || Number(gs.morale || 0) <= 40;
}

function makeScoreAccumulator(state) {
  const tags = new Set();
  const lines = [];
  const triggeredSkills = [];
  let bonus = 0;

  return {
    add(skillId, amount, line, tag) {
      if (!amount || !hasSkill(state, skillId)) return;
      const name = getSkillName(state, skillId);
      bonus += Number(amount || 0);
      triggeredSkills.push({ id: skillId, name, phase: 'score', amount: Number(amount || 0), line: line || '' });
      if (line) lines.push(`${name}：${line}`);
      if (tag) tags.add(tag);
    },
    result() {
      return {
        bonus,
        triggeredSkills,
        lines,
        summaryTags: Array.from(tags)
      };
    }
  };
}

function compensateNegative(delta, key, amount) {
  const value = Number((delta || {})[key] || 0);
  if (value >= 0 || amount <= 0) return {};
  return { [key]: Math.min(amount, Math.abs(value)) };
}

function reduceBurden(delta, key, amount) {
  const value = Number((delta || {})[key] || 0);
  if (value <= 0 || amount <= 0) return {};
  return { [key]: -Math.min(amount, value) };
}

function makeDeltaAccumulator(state, baseDelta) {
  let currentDelta = mergeDelta({}, baseDelta || {});
  let totalDelta = {};
  const tags = new Set();
  const lines = [];
  const triggeredSkills = [];

  return {
    current() {
      return currentDelta;
    },
    add(skillId, patch, line, tag) {
      if (!hasSkill(state, skillId)) return;
      const cleanPatch = Object.keys(patch || {}).reduce((result, key) => {
        const value = Number((patch || {})[key] || 0);
        if (!value) return result;
        result[key] = value;
        return result;
      }, {});
      if (!Object.keys(cleanPatch).length) return;
      const name = getSkillName(state, skillId);
      currentDelta = mergeDelta(currentDelta, cleanPatch);
      totalDelta = mergeDelta(totalDelta, cleanPatch);
      triggeredSkills.push({
        id: skillId,
        name,
        phase: 'delta',
        delta: cleanPatch,
        deltaLine: formatDeltaLine(cleanPatch),
        line: line || ''
      });
      if (line) lines.push(`${name}：${line}`);
      if (tag) tags.add(tag);
    },
    result() {
      return {
        delta: currentDelta,
        totalDelta,
        triggeredSkills,
        lines,
        summaryTags: Array.from(tags)
      };
    }
  };
}

function applySkillScoreBonus(state, context) {
  const gs = state && state.gameState ? state.gameState : {};
  const score = makeScoreAccumulator(state);
  const pressure = Number((context && context.pressure) != null ? context.pressure : ((state && state.world && state.world.pressure) || 0));

  if (lowResourceState(gs) && isKind(context, ['govern', 'trade', 'travel', 'rest', 'military', 'battle', 'jianghu'])) {
    score.add('bare_survival', 1, '底线仍稳，这一步不至于因为手头太薄而完全失真。', '求生');
    score.add('survival_instinct', 2, '越到缺钱缺粮的时候，越能逼出真正的求生手感。', '求生');
    score.add('survival_cache', 1, '会先想着把钱粮留住，再谈别的。', '求生');
  }

  if (isKind(context, ['diplomacy', 'social', 'romance', 'joinsect']) || isMode(context, ['banquet', 'envoy', 'salon', 'outer_visit', 'inner_network'])) {
    score.add('ritual_literacy', 2, '说话、递帖和落礼都更容易踩在合适的分寸上。', '交涉');
    score.add('courtcraft_face', 2, '懂得借场面开口，判定更容易往上走。', '交涉');
    if (pressure >= 45) {
      score.add('courtcraft_balance', 1, '局势越拧，越知道怎么把两头都先稳住。', '交涉');
    }
  }

  if (isKind(context, ['govern', 'investigate', 'intrigue']) || isMode(context, ['study', 'archive', 'counterspy', 'audit', 'granary'])) {
    score.add('memorial_craft', 2, '能把杂乱线头先理成章法，判定自然更稳。', '谋略');
    score.add('strategy_board_sense', 2, '会把当前这一步放进整张局盘里看。', '谋略');
  }

  if (isKind(context, ['trade', 'travel']) || isMode(context, ['warehouse', 'blackmarket', 'caravan', 'arms'])) {
    score.add('market_instinct', 2, '知道哪一步是真能换来现钱与周转的。', '经营');
    score.add('mercantile_margin', 1, '会主动挑最能落袋的那一刀价差。', '经营');
    score.add('mercantile_convoy', 1, '对货路与转运的把控更稳。', '经营');
    score.add('commerce_route_open', 2, '既有商路已经开始反过来托住这一步。', '经营');
  }

  if (isKind(context, ['military', 'warpath', 'battle']) || isMode(context, ['recruit', 'drill', 'discipline', 'camp'])) {
    score.add('militia_command', 2, '知道怎么把散勇与杂牌先拢成可用的人手。', '军旅');
    score.add('frontier_drill', 2, '营务与口令的基础打得更实。', '军旅');
    score.add('frontier_supply', 1, '有补给章法，很多军务动作不会白耗。', '军旅');
    score.add('canglang_press', 2, '压阵时更容易把整队气势提起来。', '军旅');
    score.add('canglang_inheritance', 2, '门中战刀的压阵路数在这里是对口的。', '军旅');
    score.add('battlefield_vanguard', 2, '战阵线已经成形，出手就更容易滚起威名。', '军旅');
    score.add('battlefield_legend', 3, '大阵当前，个人锋芒终于能真正压到战局里。', '军旅');
  }

  if (isKind(context, ['investigate', 'intrigue']) || isMode(context, ['terrain', 'archive', 'rumor', 'counterspy'])) {
    score.add('shadow_mark', 2, '不会只看眼前一层，而是顺手去记后面的暗脉。', '暗线');
    if (pressure >= 40) score.add('shadow_turn', 1, '局面紧的时候也会给自己留回身口。', '暗线');
  }

  if (isKind(context, ['martial', 'battle', 'jianghu', 'spar']) || isMode(context, ['solo', 'closedoor', 'challenge', 'trace'])) {
    score.add('martial_destiny_break', 1, '武学路线已经真正定型，很多手感不再是碰运气。', '武学');
    score.add('martial_first_gate', 1, '武艺开始能稳定兑现成结果。', '武学');
    score.add('martial_master', 2, '大成之后，胜负更容易被个人火候直接拉开。', '武学');
    score.add('taibai_edge', 2, '试锋时更能把锐气压到点子上。', '武学');
    score.add('taibai_inheritance', 1, '太白路数在这种试锋场面更容易吃满。', '武学');
    score.add('jianghu_duelist', 2, '江湖对决里，这一步更容易打得出名。', '江湖');
    score.add('jianghu_supreme', 3, '江湖威势已成，很多对手会先被气机压住半分。', '江湖');
  }

  if (isKind(context, ['battle', 'jianghu', 'travel'])) {
    score.add('wild_footwork', 1, '身法让自己在乱局里多出一层余地。', '武学');
    score.add('xuanfeng_charge', 2, '抢先起手和转场节奏都更顺。', '武学');
  }

  if (isKind(context, ['battle', 'warpath']) && Number(gs.troops || 0) >= 80) {
    score.add('canglang_break', 3, '兵势够厚时，更容易把正面冲撞直接滚成战果。', '军旅');
  }

  if (isKind(context, ['battle', 'warpath', 'intrigue']) && pressure >= 55) {
    score.add('xuanfeng_breakline', 2, '高压局里更擅长强行撕开一条路。', '破局');
  }

  if (isKind(context, ['rest', 'martial', 'sect', 'joinsect']) || isMode(context, ['study', 'closedoor', 'inner_drill'])) {
    score.add('qingnang_breath', 2, '气息与火候都更容易慢慢落稳。', '恢复');
    if (Number(gs.health || 0) <= 45) {
      score.add('qingnang_guard', 2, '血线偏低时，更懂得护住底线。', '恢复');
    }
    score.add('qingnang_inheritance', 1, '青囊一路在养息和长线经营上更对口。', '恢复');
  }

  if (isKind(context, ['travel', 'battle', 'military'])) {
    score.add('xuanfeng_inheritance', 1, '玄锋一脉擅长调动与压前手。', '节奏');
  }

  if (isKind(context, ['govern']) || isMode(context, ['audit', 'patrol', 'granary'])) {
    score.add('civil_admin_pillar', 2, '内政骨架已经搭起来了，这一步不再只是碰运气。', '经营');
  }

  if (isKind(context, ['govern', 'trade', 'investigate', 'diplomacy', 'social']) && Number((gs.retinue && gs.retinue.members && gs.retinue.members.length) || 0) > 0) {
    score.add('retinue_of_minds', 1, '班底开始真正替我分压，不必事事单扛。', '班底');
  }

  if (isKind(context, ['social', 'romance', 'rest'])) {
    score.add('heart_anchor', 1, '心里有了牵系，很多摇摆会先稳下来。', '情感');
  }

  return score.result();
}

function applySkillDeltaBonus(state, context) {
  const gs = state && state.gameState ? state.gameState : {};
  const delta = makeDeltaAccumulator(state, (context && context.delta) || {});
  const tier = String((context && context.tier) || '').trim();
  const risky = isRiskyContext(context);
  const current = () => delta.current();

  if (lowResourceState(gs) && (tier === 'mixed' || tier === 'fail')) {
    delta.add('bare_survival', mergeDelta(
      compensateNegative(current(), 'coins', 1),
      mergeDelta(compensateNegative(current(), 'supplies', 1), reduceBurden(current(), 'fatigue', 1))
    ), '资源再薄，也还是硬留住了一点活动余地。', '求生');
    delta.add('survival_instinct', mergeDelta(
      compensateNegative(current(), 'health', 2),
      mergeDelta(compensateNegative(current(), 'coins', 2), mergeDelta(compensateNegative(current(), 'supplies', 2), compensateNegative(current(), 'troops', 4)))
    ), '逆风时先把人和本钱护住。', '求生');
    delta.add('survival_cache', mergeDelta(compensateNegative(current(), 'supplies', 2), compensateNegative(current(), 'coins', 1)), '会下意识地先保粮保盘缠。', '求生');
    delta.add('survival_exit', mergeDelta(
      compensateNegative(current(), 'health', 3),
      mergeDelta(compensateNegative(current(), 'troops', 5), compensateNegative(current(), 'morale', 3))
    ), '失手之后仍旧给自己留下了抽身的本钱。', '求生');
  }

  if (isKind(context, ['trade']) && isSuccessTier(tier)) {
    delta.add('market_instinct', { coins: 4, supplies: 1 }, '这一步的收益被捞得更实。', '经营');
    delta.add('mercantile_margin', { coins: 3 }, '价差没有白做。', '经营');
    delta.add('commerce_route_open', { coins: 5, supplies: 2 }, '既有商路开始自己反哺新的经营。', '经营');
  }

  if (isKind(context, ['travel'])) {
    delta.add('market_instinct', mergeDelta(compensateNegative(current(), 'coins', 2), compensateNegative(current(), 'supplies', 1)), '远行时更会省盘缠。', '经营');
    delta.add('mercantile_convoy', mergeDelta(compensateNegative(current(), 'coins', 2), compensateNegative(current(), 'supplies', 2)), '对路费和补给的拿捏更稳。', '经营');
    delta.add('wild_footwork', mergeDelta(compensateNegative(current(), 'health', 2), reduceBurden(current(), 'fatigue', 2)), '身法替自己省下了一截风尘磨损。', '武学');
    delta.add('xuanfeng_charge', reduceBurden(current(), 'fatigue', 2), '抢前手赶路，反而少被拖慢。', '节奏');
    delta.add('xuanfeng_inheritance', mergeDelta(reduceBurden(current(), 'fatigue', 2), { strategy: 1 }), '沿路调度比常人更有章法。', '节奏');
  }

  if (isKind(context, ['govern']) && isSuccessTier(tier)) {
    delta.add('memorial_craft', { strategy: 1, governance: 1 }, '理出来的不只是账面，还有后手。', '经营');
    delta.add('civil_admin_pillar', { governance: 2, influence: 1, supplies: 2 }, '内政已成骨架，这一步真正落到了根基上。', '经营');
    delta.add('retinue_of_minds', Number((gs.retinue && gs.retinue.members && gs.retinue.members.length) || 0) > 0 ? { strategy: 1, influence: 1 } : {}, '班底开始把内务分担成体系。', '班底');
    delta.add('qingnang_inheritance', { health: 1, fatigue: -1 }, '长线经营时更懂得护住自己的节奏。', '恢复');
  }

  if (isKind(context, ['diplomacy', 'social', 'romance', 'joinsect']) && isSuccessTier(tier)) {
    delta.add('ritual_literacy', { influence: 1 }, '礼数与措辞都替自己多托开了一层门。', '交涉');
    delta.add('courtcraft_face', { influence: 2, renown: 1 }, '场面被撑住之后，名分和声势都会跟着涨。', '交涉');
  }

  if (isKind(context, ['diplomacy', 'social', 'romance', 'intrigue']) && (tier === 'mixed' || tier === 'fail')) {
    delta.add('courtcraft_balance', mergeDelta(compensateNegative(current(), 'influence', 2), compensateNegative(current(), 'renown', 1)), '就算失手，也没让场面当场翻掉。', '交涉');
    delta.add('heart_anchor', { morale: 2 }, '心里那点牵系把浮动的气先稳住了。', '情感');
  }

  if (isKind(context, ['investigate', 'intrigue']) && isSuccessTier(tier)) {
    delta.add('memorial_craft', { strategy: 1 }, '翻旧案与排线头的效率明显更高。', '谋略');
    delta.add('shadow_mark', { strategy: 2, influence: 1 }, '不止抓到了这一层，还顺手留下了后续线索。', '暗线');
    delta.add('strategy_board_sense', { strategy: 2, influence: 2 }, '这一步被放回整张局盘里，于是收益更厚。', '谋略');
  }

  if (isKind(context, ['investigate', 'intrigue']) && (tier === 'mixed' || tier === 'fail')) {
    delta.add('shadow_turn', mergeDelta(compensateNegative(current(), 'influence', 1), { strategy: 1 }), '就算线头没全抓住，也还是给自己留了个转身位。', '暗线');
  }

  if (isKind(context, ['military']) && isSuccessTier(tier)) {
    delta.add('militia_command', { troops: 4, morale: 2 }, '募练的人手更快成了可用部曲。', '军旅');
    delta.add('frontier_drill', { troops: 3, morale: 3, military: 1 }, '营务和操练被真正压成了战力。', '军旅');
    delta.add('frontier_supply', { supplies: 3 }, '补给章法让军务推进没那么伤底子。', '军旅');
    delta.add('canglang_press', { morale: 2, troops: 2 }, '压阵时队伍不容易散。', '军旅');
    delta.add('canglang_inheritance', { military: 1, morale: 2 }, '门中战刀的整队路数很吃这类场景。', '军旅');
  }

  if (isKind(context, ['battle', 'warpath'])) {
    delta.add('frontier_supply', mergeDelta(compensateNegative(current(), 'supplies', 4), compensateNegative(current(), 'troops', 6)), '大战之后，军需反噬被压下去了一截。', '军旅');
    delta.add('wild_counter', (tier === 'mixed' || tier === 'fail') ? mergeDelta(compensateNegative(current(), 'troops', 6), compensateNegative(current(), 'morale', 3)) : {} , '逆风时仍旧咬住了一口气。', '武学');
    delta.add('canglang_break', isSuccessTier(tier) ? mergeDelta({ renown: 2, influence: 1 }, compensateNegative(current(), 'troops', 5)) : {}, '兵势站住之后，战果被顺势放大。', '军旅');
    delta.add('battlefield_vanguard', isSuccessTier(tier) ? { battlefieldPrestige: 3, renown: 2 } : {}, '这一仗会更像是立威，而不只是取胜。', '军旅');
    delta.add('battlefield_legend', isSuccessTier(tier) ? { battlefieldPrestige: 5, influence: 2 } : {}, '大战里滚出的威名更足。', '军旅');
    delta.add('taibai_edge', isSuccessTier(tier) ? { renown: 2 } : {}, '试锋时的锐气被旁人真正看见了。', '武学');
    delta.add('taibai_flash', isSuccessTier(tier) ? { battlefieldPrestige: 2 } : {}, '决胜那一手打得更亮。', '武学');
    delta.add('xuanfeng_breakline', isSuccessTier(tier) ? { influence: 2, renown: 1 } : {}, '高压局里硬撕开来的那道口子，直接换成了声势。', '破局');
    delta.add('martial_master', isSuccessTier(tier) ? { renown: 2, battlefieldPrestige: 2 } : {}, '个人武学不再只是数值，而是真的改写了战局体感。', '武学');
  }

  if (isKind(context, ['jianghu', 'spar'])) {
    delta.add('wild_footwork', mergeDelta(compensateNegative(current(), 'health', 2), reduceBurden(current(), 'fatigue', 2)), '过招里多省出了一线身位。', '武学');
    delta.add('taibai_edge', isSuccessTier(tier) ? { renown: 2, jianghuPrestige: 1 } : {}, '出手足够利，江湖上会记住这一点。', '江湖');
    delta.add('taibai_flash', isSuccessTier(tier) ? { jianghuPrestige: 2 } : {}, '收势那一下把武名也一起抬了起来。', '江湖');
    delta.add('jianghu_duelist', isSuccessTier(tier) ? { jianghuPrestige: 3, renown: 2 } : {}, '问剑的名声正在成形。', '江湖');
    delta.add('jianghu_supreme', isSuccessTier(tier) ? { jianghuPrestige: 5, influence: 2 } : {}, '这一手会让更多江湖人把我当成真正的风头人物。', '江湖');
    delta.add('martial_master', isSuccessTier(tier) ? { renown: 2, jianghuPrestige: 2 } : {}, '武学火候被看见之后，江湖声望也会跟着涨。', '武学');
  }

  if (isKind(context, ['rest', 'martial', 'sect', 'joinsect']) || isMode(context, ['study', 'closedoor', 'inner_drill'])) {
    if (isSuccessTier(tier)) {
      delta.add('qingnang_breath', { health: 4, fatigue: -4 }, '调息与火候把恢复吃得更满。', '恢复');
      delta.add('qingnang_inheritance', { health: 2, fatigue: -2 }, '门中养息路数让恢复更稳。', '恢复');
      delta.add('martial_destiny_break', isKind(context, ['martial', 'sect', 'joinsect']) ? { martialInsight: 1 } : {}, '火候被真正往前推了一线。', '武学');
    }
    if (Number(gs.health || 0) <= 45 || tier === 'mixed' || tier === 'fail') {
      delta.add('qingnang_guard', mergeDelta(compensateNegative(current(), 'health', 3), reduceBurden(current(), 'fatigue', 2)), '再危险也先把身体底线护住。', '恢复');
    }
  }

  if (isKind(context, ['martial']) && isSuccessTier(tier)) {
    delta.add('taibai_inheritance', { martialLevel: 1, renown: 1 }, '门派传承把个人武学往上顶了一层。', '武学');
    delta.add('martial_first_gate', { renown: 1 }, '武艺刚成，已经能换来更直接的回响。', '武学');
  }

  return delta.result();
}

function summarizeSkillFeedback(payload) {
  const score = payload && payload.score ? payload.score : null;
  const delta = payload && payload.delta ? payload.delta : null;
  const triggered = []
    .concat(score && Array.isArray(score.triggeredSkills) ? score.triggeredSkills : [])
    .concat(delta && Array.isArray(delta.triggeredSkills) ? delta.triggeredSkills : []);
  if (!triggered.length) return null;

  const skillNames = uniqueList(triggered.map((item) => item && item.name));
  const summaryTags = uniqueList([]
    .concat(score && score.summaryTags ? score.summaryTags : [])
    .concat(delta && delta.summaryTags ? delta.summaryTags : []))
    .slice(0, 4);
  const lines = uniqueList([]
    .concat(score && score.lines ? score.lines : [])
    .concat(delta && delta.lines ? delta.lines : []))
    .slice(0, 5);
  const totalParts = [];
  if (score && Number(score.bonus || 0) > 0) totalParts.push(`判定+${Number(score.bonus || 0)}`);
  if (delta && delta.totalDelta && Object.keys(delta.totalDelta).length) {
    const deltaLine = formatDeltaLine(delta.totalDelta);
    if (deltaLine) totalParts.push(deltaLine);
  }

  let summaryLine = '';
  if (score && Number(score.bonus || 0) > 0 && delta && delta.totalDelta && Object.keys(delta.totalDelta).length) {
    summaryLine = `${skillNames.slice(0, 3).join('、')}在这一手里同时托住了判定与收束。`;
  } else if (score && Number(score.bonus || 0) > 0) {
    summaryLine = `${skillNames.slice(0, 3).join('、')}让这一步的判定更稳。`;
  } else {
    summaryLine = `${skillNames.slice(0, 3).join('、')}把这一步的结算往更厚处推了一层。`;
  }

  return {
    actionText: payload && payload.actionText ? payload.actionText : '',
    tier: payload && payload.tier ? payload.tier : '',
    summaryLine,
    totalLine: totalParts.join('；'),
    lines,
    summaryTags,
    skillNames,
    scoreBonus: score ? Number(score.bonus || 0) : 0,
    totalDelta: delta && delta.totalDelta ? delta.totalDelta : {}
  };
}

module.exports = {
  normalizeSkillRecord,
  normalizeSkillList,
  applySkillScoreBonus,
  applySkillDeltaBonus,
  summarizeSkillFeedback,
  formatSkillDeltaLine: formatDeltaLine
};
