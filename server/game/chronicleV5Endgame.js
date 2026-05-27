function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStringList(list, limit = 12) {
  return ensureList(list)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, source) => source.indexOf(item) === index)
    .slice(0, limit);
}

function normalizeMartialApexState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    unlockedAtTurn: Math.max(0, Number(source.unlockedAtTurn || 0)),
    threat: clamp(Number(source.threat || 0), 0, 100),
    exposure: clamp(Number(source.exposure || 0), 0, 100),
    burden: clamp(Number(source.burden || 0), 0, 100),
    sideEffectStage: Math.max(0, Number(source.sideEffectStage || 0)),
    lastSideEffectTurn: Math.max(0, Number(source.lastSideEffectTurn || 0)),
    lastCrisisTurn: Math.max(0, Number(source.lastCrisisTurn || 0)),
    lastBurdenNote: String(source.lastBurdenNote || '').trim(),
    triggeredCrisisKeys: normalizeStringList(source.triggeredCrisisKeys, 16),
    resolvedCrisisKeys: normalizeStringList(source.resolvedCrisisKeys, 16)
  };
}

function ensureLifecycleState(state) {
  const world = state.world || {};
  const gs = state.gameState || {};
  world.turn = Number(world.turn || 0);
  world.maxTurns = Number(world.maxTurns || 144);
  world.endYear = Number(world.endYear || 220);
  gs.age = Number(gs.age || 22);
  gs.alive = gs.alive !== false;
  gs.endingReason = gs.endingReason || '';
  gs.endingTier = gs.endingTier || '';
  gs.endingTitle = gs.endingTitle || '';
  gs.endingSummary = gs.endingSummary || '';
  gs.endingBiography = gs.endingBiography || '';
  gs.endingCommentary = gs.endingCommentary || '';
  gs.endingTree = Array.isArray(gs.endingTree) ? gs.endingTree : [];
  gs.endingTags = Array.isArray(gs.endingTags) ? gs.endingTags : [];
  gs.canInherit = gs.canInherit === true;
  gs.inheritancePreview = gs.inheritancePreview && typeof gs.inheritancePreview === 'object' ? gs.inheritancePreview : null;
  gs.inheritanceSummary = gs.inheritanceSummary || '';
  gs.martialApex = normalizeMartialApexState(gs.martialApex);
  if (Number(gs.martialLevel || 0) >= 100 && !gs.martialApex.unlockedAtTurn && Number(world.turn || 0) > 0) {
    gs.martialApex.unlockedAtTurn = Number(world.turn || 0);
  }
}

function registerTurnProgress(state) {
  ensureLifecycleState(state);
  state.world.turn += 1;
  if (state.world.turn > 0 && state.world.turn % 12 === 0) {
    state.gameState.age += 1;
  }
}

function topRelations(state, limit) {
  return ensureList(state && state.gameState && state.gameState.relationships)
    .slice()
    .sort((a, b) => (
      ((b.trust || 0) + (b.affection || 0) + (b.loyalty || 0) - (b.rivalry || 0))
      - ((a.trust || 0) + (a.affection || 0) + (a.loyalty || 0) - (a.rivalry || 0))
    ))
    .slice(0, limit || 3);
}

function topLover(state) {
  return topRelations(state, 8)
    .filter((item) => item && ((item.bondKey === 'lover') || Number(item.affection || 0) >= 68))
    .sort((a, b) => (
      ((b.affection || 0) * 2 + (b.trust || 0) + (b.loyalty || 0))
      - ((a.affection || 0) * 2 + (a.trust || 0) + (a.loyalty || 0))
    ))[0] || null;
}

function topAdvisor(state) {
  return topRelations(state, 8)
    .filter((item) => item && item.bondKey === 'advisor')
    .sort((a, b) => (
      ((b.loyalty || 0) + (b.trust || 0) + (b.affection || 0))
      - ((a.loyalty || 0) + (a.trust || 0) + (a.affection || 0))
    ))[0] || null;
}

function historicalSummary(state) {
  const historical = state && state.gameState && state.gameState.historical ? state.gameState.historical : {};
  const eventStates = historical.eventStates && typeof historical.eventStates === 'object' ? Object.values(historical.eventStates) : [];
  return {
    triggered: eventStates.filter((item) => item && item.triggered).length,
    rewritten: eventStates.filter((item) => item && item.branch === 'rewrite').length,
    shifting: eventStates.filter((item) => item && item.branch === 'shifting').length,
    active: ensureList(historical.activeEventIds).length,
    momentum: Number(historical.historyMomentum || 0),
    lastTitle: historical.lastEventTitle || '',
    lastSummary: historical.lastEventSummary || ''
  };
}

function routeScores(state) {
  const gs = state.gameState || {};
  const mainline = state.world && state.world.mainline ? state.world.mainline : {};
  const lover = topLover(state);
  const advisor = topAdvisor(state);
  const relationList = topRelations(state, 3);
  const relationTotal = relationList.reduce((sum, item) => sum + (item.trust || 0) + (item.affection || 0) + (item.loyalty || 0), 0);
  const history = historicalSummary(state);

  return {
    military: (gs.battlefieldPrestige || 0) * 1.35 + (gs.military || 0) * 1.2 + (gs.troops || 0) / 4 + (gs.morale || 0) + (gs.renown || 0) * 0.5,
    jianghu: (gs.jianghuPrestige || 0) * 1.45 + (gs.martialLevel || 0) * 1.15 + (gs.martialInsight || 0) * 2 + (gs.renown || 0) * 0.45,
    sect: (gs.sectFavor || 0) * 1.1 + (gs.sectPower || 0) * 1.2 + (gs.martialLevel || 0) * 0.85 + (gs.strategyLevel || 0) * 0.35 + (gs.sectId ? 20 : 0),
    statecraft: (gs.governance || 0) * 1.2 + (gs.strategy || 0) * 1.15 + (gs.diplomacy || 0) * 0.8 + (gs.influence || 0) * 0.65 + (gs.supplies || 0) * 0.4 + (advisor ? 18 : 0),
    commerce: (gs.commerce || 0) * 1.3 + (gs.coins || 0) * 0.8 + (gs.supplies || 0) * 0.75 + (gs.diplomacy || 0) * 0.45 + (gs.influence || 0) * 0.4,
    strategy: (gs.strategy || 0) * 1.25 + (gs.strategyLevel || 0) * 1.05 + (gs.influence || 0) * 0.75 + (gs.diplomacy || 0) * 0.55 + history.momentum * 2,
    romance: lover
      ? (lover.affection || 0) * 1.6 + (lover.trust || 0) * 1.15 + (lover.loyalty || 0) * 0.9 + (gs.charm || 0) * 0.6 + (gs.renown || 0) * 0.25
      : 0,
    relations: relationTotal * 0.42 + (gs.influence || 0) * 0.85 + (gs.diplomacy || 0) * 0.6 + relationList.length * 12,
    history: history.rewritten * 85 + history.shifting * 34 + history.triggered * 12 + history.momentum * 3 + (mainline.progress || 0) * 0.55 + (gs.influence || 0) * 0.4 + (gs.renown || 0) * 0.3
  };
}

function endgameRouteGates(state, scores, extras = {}) {
  const gs = state && state.gameState ? state.gameState : {};
  const world = state && state.world ? state.world : {};
  const territory = world.territory && typeof world.territory === 'object' ? world.territory : {};
  const advisor = extras.advisor || null;
  const lover = extras.lover || null;
  const history = extras.history || historicalSummary(state);
  const apex = normalizeMartialApexState(gs.martialApex);
  const resolved = new Set(normalizeStringList(apex.resolvedCrisisKeys, 16));
  const governedCount = Number(territory.governedCount || 0);
  const controlledCount = Number(territory.controlledCount || 0);
  const relationsScore = Number(scores && scores.relations || 0);
  const conversionSolved = Number(gs.martialLevel || 0) < 100 || resolved.has('apex:conversion');

  return {
    military: Number(scores && scores.military || 0) >= 185
      && Number(gs.battlefieldPrestige || 0) >= 90
      && (controlledCount >= 1 || governedCount >= 2)
      && (Number(gs.governance || 0) >= 42 || Number(gs.strategy || 0) >= 42)
      && (Number(gs.influence || 0) >= 28 || !!advisor || relationsScore >= 118)
      && conversionSolved
      && (Number(gs.martialLevel || 0) < 100 || resolved.has('apex:battlefield:crisis')),
    jianghu: Number(scores && scores.jianghu || 0) >= 185
      && Number(gs.jianghuPrestige || 0) >= 95
      && (relationsScore >= 118 || !!lover || !!(gs.sectId || '') || Number(gs.influence || 0) >= 34)
      && (history.momentum >= 10 || Number(gs.diplomacy || 0) >= 36 || Number(gs.strategy || 0) >= 40)
      && conversionSolved
      && (Number(gs.martialLevel || 0) < 100 || resolved.has('apex:jianghu:crisis')),
    sect: !!(gs.sectId || '')
      && Number(scores && scores.sect || 0) >= 170
      && (Number(gs.sectFavor || 0) >= 65 || Number(gs.sectPower || 0) >= 65)
      && (Number(gs.diplomacy || 0) >= 32 || Number(gs.influence || 0) >= 32 || relationsScore >= 110)
      && (Number(gs.strategyLevel || 0) >= 20 || Number(gs.governance || 0) >= 28 || history.momentum >= 8)
      && conversionSolved
      && (Number(gs.martialLevel || 0) < 100 || resolved.has('apex:sect:crisis'))
  };
}

function buildInheritanceCarryover(state) {
  ensureLifecycleState(state);
  const gs = state.gameState || {};
  const bonus = {
    martialLevel: clamp(Math.floor(Number(gs.martialLevel || 0) * 0.2), 0, 18),
    martialInsight: clamp(Math.floor(Number(gs.martialInsight || 0) * 0.35), 0, 10),
    strategyLevel: clamp(Math.floor(Number(gs.strategyLevel || 0) * 0.22), 0, 18),
    governance: clamp(Math.floor(Number(gs.governance || 0) * 0.16), 0, 14),
    diplomacy: clamp(Math.floor(Number(gs.diplomacy || 0) * 0.16), 0, 14),
    commerce: clamp(Math.floor(Number(gs.commerce || 0) * 0.16), 0, 14),
    military: clamp(Math.floor(Number(gs.military || 0) * 0.16), 0, 14),
    strategy: clamp(Math.floor(Number(gs.strategy || 0) * 0.16), 0, 14),
    charm: clamp(Math.floor(Number(gs.charm || 0) * 0.14), 0, 10),
    maxHealth: clamp(Math.floor(Math.max(0, Number(gs.maxHealth || 100) - 100) * 0.25), 0, 10)
  };

  if (!Object.values(bonus).some((value) => value > 0)) {
    bonus.strategy = 1;
    bonus.martialInsight = 1;
  }

  const lines = [
    bonus.martialLevel ? `武艺底子+${bonus.martialLevel}` : '',
    bonus.strategyLevel ? `谋略路数+${bonus.strategyLevel}` : '',
    bonus.governance ? `内政根基+${bonus.governance}` : '',
    bonus.commerce ? `经营手感+${bonus.commerce}` : '',
    bonus.diplomacy ? `交涉分寸+${bonus.diplomacy}` : '',
    bonus.military ? `军务见识+${bonus.military}` : '',
    bonus.strategy ? `谋算眼力+${bonus.strategy}` : '',
    bonus.charm ? `人物拿捏+${bonus.charm}` : '',
    bonus.martialInsight ? `武学见识+${bonus.martialInsight}` : '',
    bonus.maxHealth ? `身骨底蕴+${bonus.maxHealth}` : ''
  ].filter(Boolean);

  return {
    eligible: true,
    profile: {
      name: gs.name || '无名之人',
      gender: gs.gender || '',
      genderLabel: gs.genderLabel || '未定',
      pronoun: gs.pronoun || ''
    },
    bonus,
    skill: {
      id: 'echo_of_previous_life',
      name: '前尘余韵',
      type: '继承',
      level: '余响',
      effect: '新的人生从建安元年重新展开，但旧局留下的手感、眼力和骨子里的路数还在。'
    },
    summary: lines.slice(0, 5).join('，') || '留下一点说不清的手感'
  };
}

function endingLeaf(state, reason) {
  const gs = state.gameState || {};
  const history = historicalSummary(state);
  const scores = routeScores(state);
  const lover = topLover(state);
  const advisor = topAdvisor(state);
  const gates = endgameRouteGates(state, scores, { history, lover, advisor });
  const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] || ['legacy', 0];

  if (reason === 'death') {
    if (scores.military >= 175) {
      return {
        tier: 'tragic',
        tree: ['乱世立命', '沙场试锋', '战殁成名'],
        title: '战殁成名',
        summary: `你终究没能从乱世的刀口下全身退开，却把名字留在了军前。军阵威名${gs.battlefieldPrestige || 0}，部曲${gs.troops || 0}，后来翻兵书的人提到这一页，仍会知道你不是白死。`,
        tags: ['悲剧', '军旅', '死亡']
      };
    }
    if (scores.jianghu >= 170) {
      return {
        tier: 'tragic',
        tree: ['乱世立命', '江湖问剑', '绝顶殒身'],
        title: '绝顶殒身',
        summary: `你把一身武艺顶到了极高处，也把命丢在了最危险的地方。江湖声望${gs.jianghuPrestige || 0}，武艺${gs.martialLevel || 0}，后来人多半会把你当成那种只差半步便能彻底登顶的名字。`,
        tags: ['悲剧', '江湖', '死亡']
      };
    }
    return {
      tier: 'tragic',
      tree: ['乱世立命', '半途折卷', '身死乱世'],
      title: '身死乱世',
      summary: `你这一身终究没能扛过乱世的刀口。${state.world.dateLabel || ''}，${state.world.currentCityName || '无名城池'}替你收住了最后一口气。`,
      tags: ['悲剧', '死亡', '乱世']
    };
  }

  if (reason === 'old_age') {
    if (lover && scores.romance >= 150) {
      return {
        tier: 'fulfilled',
        tree: ['乱世立命', '红尘相守', '白首同归'],
        title: '白首同归',
        summary: `你没有把一生收在兵锋上，而是把风浪、年岁和人情都熬成了能并肩看老的日子。走到${gs.age || 0}岁，${lover.name}仍在你的传记里占着最重的一页。`,
        tags: ['情感', '白首', '收束']
      };
    }
    return {
      tier: 'fulfilled',
      tree: ['乱世立命', '霜鬓收卷', '岁尽而终'],
      title: '岁尽而终',
      summary: `你撑到了岁月自己来收卷的时候。走到${gs.age || 0}岁，再强的骨头和心气也得承认光阴已经压满全身。`,
      tags: ['老年', '收束']
    };
  }

  if (history.rewritten >= 1 && (scores.history >= 140 || (gs.influence || 0) >= 55 || (gs.renown || 0) >= 55)) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '史势改写', '留名正史'],
      title: '留名正史',
      summary: `你不只是活过了这段乱世，而是真的把手伸进史势里改了线头。已经触发的史事${history.triggered}桩，真正被你改出偏轨的至少${history.rewritten}桩，往后再有人写这一段时，很难绕开你的名字。`,
      tags: ['胜利', '史势', '改史']
    };
  }

  if (gates.military) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '军旅建功', '军前定鼎'],
      title: '军前定鼎',
      summary: `你没有把“能打”停在一时锋头上，而是把军令、城池、粮道和人心一并按进了自己的体系。军阵威名${gs.battlefieldPrestige || 0}，部曲${gs.troops || 0}，如今这股力真正能改的是局，不只是赢一仗。`,
      tags: ['胜利', '军旅', '战场']
    };
  }

  if (gates.jianghu) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '江湖问剑', '天下绝顶'],
      title: '天下绝顶',
      summary: `你最后赢下来的不只是“天下第一”的名头，而是把这身武名换成了规矩、盟约和众人默认的边界。江湖声望${gs.jianghuPrestige || 0}，武艺${gs.martialLevel || 0}，后来人的高下固然要拿你来比，更要拿你立下的秩序来比。`,
      tags: ['胜利', '江湖', '武学']
    };
  }

  if (gates.sect) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '门派传承', '一派宗师'],
      title: '一派宗师',
      summary: `你没有把门派走成个人神功的附庸，而是真把人心、传承和门内秩序一层层压稳了。${gs.sectName || '门派'}对你的好感${gs.sectFavor || 0}，可借势力${gs.sectPower || 0}，收局时你已经像一座活着的传承。`,
      tags: ['胜利', '门派', '宗师']
    };
  }

  if (scores.statecraft >= 168 && (gs.governance || 0) >= 62) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '经世成局', advisor ? '幕府谋主' : '州郡柱石'],
      title: advisor ? '幕府谋主' : '州郡柱石',
      summary: advisor
        ? `你真正站稳的不是锋芒，而是能把人、粮、政令和局势全拢到手里慢慢落稳的本事。${advisor.name}这样的幕僚都愿意把后背交给你，这一局最后收成了谋主之局。`
        : `你把根基、钱粮、秩序和人心一点点按实了。内政${gs.governance || 0}，谋略${gs.strategy || 0}，影响${gs.influence || 0}，后来很多人会记得，这乱世里真有人把地方从散局慢慢压成了盘面。`,
      tags: ['胜利', '经营', '谋略']
    };
  }

  if (scores.commerce >= 164 && (gs.commerce || 0) >= 62) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '商路成势', '富甲一方'],
      title: '富甲一方',
      summary: `你把钱路、粮路、人情和路数真正滚成了一盘活棋。经商${gs.commerce || 0}，钱财${gs.coins || 0}，粮秣${gs.supplies || 0}，后来的人若想知道乱世里怎样把商路做成势力，都会翻到你这一页。`,
      tags: ['胜利', '经营', '商路']
    };
  }

  if (lover && scores.romance >= 150) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '红尘知心', '乱世同归'],
      title: '乱世同归',
      summary: `你这一生最难得的，不是兵锋也不是财货，而是当天下一直在换颜色时，仍有人肯和你把命运系到一起。${lover.name}在你的局里早已经不只是软肋，而是陪你把许多关键选择撑过去的人。`,
      tags: ['胜利', '情感', '恋爱']
    };
  }

  if (scores.relations >= 148) {
    return {
      tier: 'victory',
      tree: ['乱世立命', '众望归人', '人情成城'],
      title: '人情成城',
      summary: `你最后赢下来的不是一座城，而是一张真正会替你回声的人情网。影响${gs.influence || 0}，名望${gs.renown || 0}，愿意往你这里压筹码的人越来越多，这样的赢法慢，却很难一夜之间塌掉。`,
      tags: ['胜利', '人物', '关系']
    };
  }

  if (strongest[0] === 'military') {
    return {
      tier: 'legacy',
      tree: ['乱世立命', '军旅试锋', '军旅名局'],
      title: '军旅名局',
      summary: `你这一生最后还是把名声压进了军旅。军阵威名${gs.battlefieldPrestige || 0}，部曲${gs.troops || 0}，哪怕未必能定天下，也已经足够让后来的人在兵书边角记下你的名字。`,
      tags: ['军旅', '战事']
    };
  }
  if (strongest[0] === 'jianghu') {
    return {
      tier: 'legacy',
      tree: ['乱世立命', '江湖试锋', '江湖余名'],
      title: '江湖余名',
      summary: `你最终把一身武艺推到了江湖之上。江湖声望${gs.jianghuPrestige || 0}，武艺${gs.martialLevel || 0}，这一局收束之后，仍会有人拿你的名字当作衡量高下的尺。`,
      tags: ['江湖', '武学']
    };
  }
  if (strongest[0] === 'statecraft' || strongest[0] === 'commerce' || strongest[0] === 'strategy') {
    return {
      tier: 'legacy',
      tree: ['乱世立命', '经营持局', '经营成局'],
      title: '经营成局',
      summary: `你没有把命全押在阵前，而是慢慢把根基、钱粮和人心经营成了自己的盘面。内政${gs.governance || 0}，经商${gs.commerce || 0}，谋略${gs.strategy || 0}，足够说明你这一局不是白走。`,
      tags: ['经营', '谋略']
    };
  }
  if (strongest[0] === 'romance' || strongest[0] === 'relations') {
    return {
      tier: 'legacy',
      tree: ['乱世立命', '红尘系命', '故人常在'],
      title: '故人常在',
      summary: `你最后留下来的不全是功业，还有一批真正被你牵动、也真正牵住你的人。乱世里能把关系走成这样，本身就已经是一种很难得的成局。`,
      tags: ['人物', '情感']
    };
  }
  return {
    tier: 'legacy',
    tree: ['乱世立命', '浮沉一世', '乱世一生'],
    title: '乱世一生',
    summary: `你在这段乱世里留下了一点自己的痕。名望${gs.renown || 0}，影响${gs.influence || 0}，虽未必大张旗鼓，却也让几座城、几拨人记得你确实来过。`,
    tags: ['人生']
  };
}

function buildBiography(state, ending) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const lover = topLover(state);
  const advisor = topAdvisor(state);
  const relations = topRelations(state, 2);
  const history = historicalSummary(state);
  const clauses = [
    `${gs.name || '无名之人'}以${gs.backgroundLabel || '未定出身'}入局，在${world.originCityName || world.currentCityName || '乱世路口'}落下第一根桩。`,
    `这一生走到${gs.age || 22}岁，共行了${world.turn || 0}回，最终收成“${ending.title}”。`,
    ''
  ];

  if (ending.tree[1] === '军旅建功' || ending.tree[1] === '军旅试锋') {
    clauses[2] = `他把武艺、部曲与军心拧成一股力，军阵威名攀到${gs.battlefieldPrestige || 0}，手中最多能压动的部曲已有${gs.troops || 0}。`;
  } else if (ending.tree[1] === '江湖问剑' || ending.tree[1] === '江湖试锋') {
    clauses[2] = `他没有把路数全押给官场，而是把武名一路打进江湖，武艺${gs.martialLevel || 0}，江湖声望${gs.jianghuPrestige || 0}。`;
  } else if (ending.tree[1] === '门派传承') {
    clauses[2] = `${gs.sectName || '门派'}最后成了他最稳的一层根，门中好感${gs.sectFavor || 0}，可借势力${gs.sectPower || 0}，这一身武学与传承因此真正立住。`;
  } else if (ending.tree[1] === '经世成局' || ending.tree[1] === '经营持局' || ending.tree[1] === '商路成势') {
    clauses[2] = `他把钱粮、人心、调度与局势感慢慢磨成了盘面，内政${gs.governance || 0}，经商${gs.commerce || 0}，谋略${gs.strategy || 0}。`;
  } else if (ending.tree[1] === '红尘知心' || ending.tree[1] === '红尘相守' || ending.tree[1] === '红尘系命') {
    clauses[2] = lover
      ? `${lover.name}成了他命里最深的一段牵系，乱世里很多最难落下的决定，最后都绕不过这份情分。`
      : `他真正留下的，不只是几项数字，而是一批在乱世里愿意把心意和后背托给他的人。`;
  } else if (ending.tree[1] === '史势改写') {
    clauses[2] = `他不只是在史势边上看热闹，而是真把手伸了进去。被推上桌面的史事${history.triggered}桩，至少有${history.rewritten}桩已被改出偏轨。`;
  } else {
    clauses[2] = `他一路摸索、一路周旋，虽未必样样都压到绝顶，却终究在几座城、几拨人和几条暗线上留下了自己的痕迹。`;
  }

  if (advisor) {
    clauses.push(`${advisor.name}曾以幕僚之姿站进他的局里，替这段人生把不少将散未散的线头重新拢稳。`);
  } else if (relations[0]) {
    clauses.push(`${relations[0].name}始终是这卷人生里最有分量的同行者之一，也让许多原本只算利害往来的选择多出了真正的温度。`);
  }

  if (history.lastTitle) {
    clauses.push(`到收卷时，离他最近的一层史势回声仍是“${history.lastTitle}”，这说明他的故事始终没有离开时代正中央。`);
  }

  return clauses.filter(Boolean).join('');
}

function buildCommentary(state, ending) {
  const gs = state.gameState || {};
  const lover = topLover(state);
  const advisor = topAdvisor(state);
  const tree = ending.tree || [];
  const route = tree[1] || '';

  if (route === '军旅建功' || route === '军旅试锋') {
    return `点评：你真正成形的不是单一武勇，而是把个人武学、部曲规模和军心一起拧成了战场压制力。这条线已经足够重；若再把钱粮与人事多稳一层，往上推到改写天下并不夸张。`;
  }
  if (route === '江湖问剑' || route === '江湖试锋') {
    return `点评：这条线的代入感强在“我不必先做官，也能靠自己把名字打到最高处”。你的成长不是职位晋升，而是武艺、见识、奇遇与江湖回声不断抬高。`;
  }
  if (route === '门派传承') {
    return `点评：门派线现在已经不再只是武艺附属，而是兼有传承、人情、资源和内部权力的完整路线。你赢下来的，是“我在这门里到底算什么人”。`;
  }
  if (route === '经世成局' || route === '经营持局' || route === '商路成势') {
    return advisor
      ? `点评：经营谋略线终于具备了和战斗线同等的重量，因为它不再只是涨数值，而是在决定谁会替你办事、谁会给你开路、谁会在关键时候把局面替你接住。`
      : `点评：经营谋略线的胜法慢，却最耐看。你不是靠一刀一枪定高下，而是靠钱粮、人心、调度与局势感把盘面慢慢滚厚，这种赢法最像真正活过一生。`;
  }
  if (route === '红尘知心' || route === '红尘相守' || route === '红尘系命') {
    return lover
      ? `点评：恋爱线现在已经不是边角料。${lover.name}之所以重要，不是因为多了一段剧情文本，而是因为这段关系真会改动你的心气、名声、人脉和很多关键决断的方向。`
      : `点评：人物关系这条线最难做成，因为它不能只是“好感度上涨”。现在它至少已经能收束成真正的人生结局，而不是战斗之外的点缀。`;
  }
  if (route === '史势改写') {
    return `点评：这是最像“三国背景主角”该有的高阶胜法。你不是单纯刷出一串漂亮数值，而是把自己的存在压进史势，让历史事件开始因为你而改线。`;
  }
  return `点评：这是一种更接近“活过一生”的结局。${gs.name || '主角'}未必样样登顶，但至少已经长出自己的路数，而不是只做数字表上的一次通关。`;
}

function finalizeEnding(state, reason, prefix) {
  const leaf = endingLeaf(state, reason);
  const inheritancePreview = buildInheritanceCarryover(state);
  return {
    reason,
    tier: leaf.tier,
    tree: leaf.tree,
    title: leaf.title,
    summary: prefix ? `${prefix}${leaf.summary}` : leaf.summary,
    biography: buildBiography(state, leaf),
    commentary: buildCommentary(state, leaf),
    tags: leaf.tags.concat([leaf.tree[1], leaf.tree[2]]).filter(Boolean),
    canInherit: inheritancePreview.eligible,
    inheritancePreview
  };
}

function evaluateEnding(state) {
  ensureLifecycleState(state);
  const gs = state.gameState || {};
  const world = state.world || {};

  if ((gs.health || 0) <= 0) {
    return finalizeEnding(state, 'death', '');
  }

  if ((gs.age || 0) >= 78 || ((gs.age || 0) >= 68 && (gs.health || 0) <= 18 && (gs.fatigue || 0) >= 85)) {
    return finalizeEnding(state, 'old_age', '');
  }

  if ((world.turn || 0) >= (world.maxTurns || 144)) {
    return finalizeEnding(state, 'turn_limit', '这一局走到了回合上限。');
  }

  if ((world.year || 0) >= (world.endYear || 220)) {
    return finalizeEnding(state, 'era_limit', '天下格局已走到新的年号门槛，这一卷也该收住。');
  }

  return null;
}

function applyEndingState(state, ending) {
  ensureLifecycleState(state);
  const gs = state.gameState;
  const world = state.world;
  world.phase = 'ended';
  world.objective = '此局已定，结局正在收束。';
  gs.alive = ending.reason !== 'death';
  gs.endingReason = ending.reason;
  gs.endingTier = ending.tier || '';
  gs.endingTitle = ending.title;
  gs.endingSummary = ending.summary;
  gs.endingBiography = ending.biography || '';
  gs.endingCommentary = ending.commentary || '';
  gs.endingTree = ending.tree || [];
  gs.endingTags = ending.tags || [];
  gs.canInherit = ending.canInherit === true;
  gs.inheritancePreview = ending.inheritancePreview || null;
  gs.inheritanceSummary = ending.inheritancePreview ? ending.inheritancePreview.summary || '' : '';
  state.scene.title = `结局 · ${ending.title}`;
  state.scene.summary = ending.summary;
  state.scene.statusLine = `${world.dateLabel} · 第${world.turn}回 · ${ending.title}`;
  state.choices = [];
}

module.exports = {
  ensureLifecycleState,
  registerTurnProgress,
  evaluateEnding,
  applyEndingState,
  buildInheritanceCarryover
};
