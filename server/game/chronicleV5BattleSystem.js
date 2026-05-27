const { isRelationMet } = require('./chronicleV5RelationVisibility');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function pickBySeed(list, seed) {
  if (!Array.isArray(list) || !list.length) return '';
  const index = Math.abs(Number(seed) || 0) % list.length;
  return list[index];
}

function scaleLabel(value) {
  const total = Number(value || 0);
  if (total >= 100000) return '十万级大战';
  if (total >= 10000) return '万人大战';
  if (total >= 1000) return '千人战';
  if (total >= 200) return '百人战';
  return '小规模冲突';
}

function battleCommandMeta(command) {
  const table = {
    spearhead: { label: '锋矢突进', family: 'formation' },
    fortify: { label: '方圆固守', family: 'formation' },
    harry: { label: '雁行游击', family: 'formation' },
    fire: { label: '火计奇袭', family: 'tactic' },
    rally: { label: '整军鼓舞', family: 'support' },
    champion: { label: '主将陷阵', family: 'hero' },
    strike: { label: '抢攻进手', family: 'attack' },
    guard: { label: '沉气守势', family: 'guard' },
    channel: { label: '提气运功', family: 'channel' },
    footwork: { label: '身法游走', family: 'footwork' },
    finisher: { label: '绝招爆发', family: 'finisher' }
  };
  return table[command] || { label: String(command || '未知手段'), family: 'unknown' };
}

function chooseMostHostileFaction(state) {
  return ensureList(state && state.gameState && state.gameState.factions)
    .slice()
    .sort((a, b) => ((b.hostility || 0) + (b.power || 0)) - ((a.hostility || 0) + (a.power || 0)))[0] || null;
}

function chooseDuelTarget(state) {
  const relations = ensureList(state && state.gameState && state.gameState.relationships)
    .filter((item) => item && isRelationMet(item));
  const martialTarget = relations
    .slice()
    .sort((a, b) => ((b.martialRating || 0) + (b.rivalry || 0) + (b.trust || 0)) - ((a.martialRating || 0) + (a.rivalry || 0) + (a.trust || 0)))[0];
  if (martialTarget) {
    return {
      name: martialTarget.name || '对手',
      title: martialTarget.title || '江湖客',
      martialRating: Math.max(48, Number(martialTarget.martialRating || 0)),
      strategyRating: Math.max(24, Number(martialTarget.strategyRating || 0))
    };
  }

  const pressure = Number(state && state.world && state.world.pressure || 0);
  return {
    name: pressure >= 50 ? '来路不善的成名客' : '路过此地的江湖高手',
    title: pressure >= 50 ? '狠手凶名' : '问剑游侠',
    martialRating: 55 + Math.round(pressure / 3),
    strategyRating: 28 + Math.round(pressure / 6)
  };
}

function createBattlefieldState(state) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const target = chooseMostHostileFaction(state);
  const troopBase = Math.max(30, Number(gs.troops || 0));
  const committedForce = Math.max(
    36,
    Math.min(
      troopBase,
      Math.round(troopBase * 0.55 + Number(gs.battlefieldPrestige || 0) * 2 + Number(gs.renown || 0) * 1.2 + Number(gs.martialPower || 0) / 35)
    )
  );
  const enemyForce = Math.max(
    40,
    Math.round(committedForce * 0.96 + Number(world.pressure || 0) * 5 + Number(target && target.power || 0) * 6 + 24)
  );

  return {
    active: true,
    mode: 'battlefield',
    title: '沙场征战',
    subtitle: target ? `对手是 ${target.name}` : '前方战云压城',
    targetName: target ? target.name : '未知对手',
    round: 1,
    maxRounds: 6,
    initialPlayerForce: committedForce,
    initialEnemyForce: enemyForce,
    scaleLabel: scaleLabel(Math.max(committedForce, enemyForce)),
    player: {
      force: committedForce,
      morale: clamp(Number(gs.morale || 0), 18, 100),
      command: Math.round(Number(gs.military || 0) * 1.2 + Number(gs.strategy || 0) * 0.65 + Number(gs.battlefieldPrestige || 0) * 0.18),
      strategy: Number(gs.strategy || 0),
      martial: Number(gs.martialPower || 0)
    },
    enemy: {
      force: enemyForce,
      morale: clamp(52 + Math.round((Number(world.pressure || 0) + Number(target && target.hostility || 0)) / 2), 28, 100),
      command: Math.round(Number(target && target.power || 50) * 0.9 + Number(world.pressure || 0) * 0.7 + 26),
      strategy: Math.round(Number(target && target.leverage || 20) * 0.7 + Number(world.pressure || 0) * 0.4 + 20),
      martial: Math.round(Number(target && target.power || 50) * 6)
    },
    playerSupplySpent: 0,
    casualtiesTaken: 0,
    casualtiesInflicted: 0,
    log: [],
    lastRoundSummary: '',
    resolution: null
  };
}

function createDuelState(state) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const target = chooseDuelTarget(state);
  const playerHealth = clamp(Math.round(Number(gs.health || 0) * 0.92 + Number(gs.martialLevel || 0) * 1.85 + 36), 60, 260);
  const enemyHealth = clamp(Math.round(target.martialRating * 1.95 + Number(world.pressure || 0) * 0.65 + 30), 58, 255);

  return {
    active: true,
    mode: 'duel',
    title: '江湖对决',
    subtitle: `${target.name} · ${target.title}`,
    targetName: target.name,
    round: 1,
    maxRounds: 7,
    initialPlayerHp: playerHealth,
    initialEnemyHp: enemyHealth,
    player: {
      hp: playerHealth,
      qi: clamp(24 + Math.round(Number(gs.martialLevel || 0) / 2) + Math.round(Number(gs.health || 0) / 14), 20, 100),
      guard: Math.round(Number(gs.martialLevel || 0) * 0.55 + Number(gs.health || 0) * 0.12 + 8),
      martial: Number(gs.martialLevel || 0),
      agility: Math.round(Number(gs.martialLevel || 0) * 0.36 + Number(gs.charm || 0) * 0.08 + 10)
    },
    enemy: {
      hp: enemyHealth,
      qi: clamp(22 + Math.round(target.martialRating / 2.2), 20, 100),
      guard: Math.round(target.martialRating * 0.52 + target.strategyRating * 0.16 + 8),
      martial: target.martialRating,
      agility: Math.round(target.martialRating * 0.32 + target.strategyRating * 0.18 + 10)
    },
    log: [],
    lastRoundSummary: '',
    resolution: null
  };
}

function startBattleEncounter(state, mode) {
  if (state.gameState && state.gameState.activeBattle && state.gameState.activeBattle.active) {
    return {
      kind: mode === 'duel' ? 'jianghu' : 'battle',
      tier: 'mixed',
      summary: '眼前这场战局还没分出高下，不能再另起一场。',
      delta: {},
      changeSummary: '',
      deltaLine: ''
    };
  }

  const battle = mode === 'duel' ? createDuelState(state) : createBattlefieldState(state);
  state.gameState.activeBattle = battle;
  state.gameState.lastBattleReport = null;
  state.gameState.lastRuleSummary = '';
  state.gameState.lastDeltaLine = '';
  state.gameState.lastResolutionSummary = mode === 'duel'
    ? `我与${battle.targetName}当面摆开了架势，接下来每一手都会直接决定这场江湖对决的高下。`
    : `我把这场${battle.scaleLabel}真正拉开了阵势，对面是${battle.targetName}，接下来要靠阵型、军令、计策与临阵决断一步步争胜。`;

  return {
    kind: mode === 'duel' ? 'jianghu' : 'battle',
    tier: 'mixed',
    summary: state.gameState.lastResolutionSummary,
    delta: {},
    changeSummary: '',
    deltaLine: ''
  };
}

function battlefieldEnemyCommand(battle) {
  if (battle.enemy.morale <= 34) return 'rally';
  if (battle.enemy.force <= battle.player.force * 0.7) return pickBySeed(['fortify', 'fire', 'rally'], battle.round + battle.enemy.force);
  if (battle.player.force <= battle.enemy.force * 0.72) return pickBySeed(['spearhead', 'champion', 'harry'], battle.round + battle.player.morale);
  return pickBySeed(['spearhead', 'fortify', 'harry', 'fire', 'champion'], battle.round + battle.enemy.command);
}

function duelEnemyCommand(battle) {
  if (battle.enemy.qi >= 22 && battle.player.hp <= battle.initialPlayerHp * 0.45) return 'finisher';
  if (battle.enemy.hp <= battle.initialEnemyHp * 0.38) return pickBySeed(['guard', 'footwork', 'channel'], battle.round + battle.enemy.hp);
  if (battle.enemy.qi <= 10) return 'channel';
  return pickBySeed(['strike', 'guard', 'footwork', 'channel', 'finisher'], battle.round + battle.enemy.martial);
}

function battlefieldCounter(playerCommand, enemyCommand) {
  if (playerCommand === 'spearhead' && enemyCommand === 'harry') return 8;
  if (playerCommand === 'harry' && enemyCommand === 'fortify') return 8;
  if (playerCommand === 'fortify' && enemyCommand === 'spearhead') return 8;
  if (playerCommand === 'fire' && ['fortify', 'rally'].includes(enemyCommand)) return 10;
  if (playerCommand === 'champion' && ['harry', 'fire'].includes(enemyCommand)) return 7;
  if (playerCommand === 'rally' && enemyCommand === 'champion') return -5;
  return 0;
}

function duelCounter(playerCommand, enemyCommand) {
  if (playerCommand === 'strike' && enemyCommand === 'channel') return 8;
  if (playerCommand === 'guard' && ['strike', 'finisher'].includes(enemyCommand)) return 9;
  if (playerCommand === 'footwork' && ['strike', 'finisher'].includes(enemyCommand)) return 7;
  if (playerCommand === 'finisher' && enemyCommand === 'channel') return 10;
  if (playerCommand === 'channel' && enemyCommand === 'guard') return 2;
  return 0;
}

function resolveBattlefieldRound(battle, command) {
  const enemyCommand = battlefieldEnemyCommand(battle);
  const playerCounter = battlefieldCounter(command, enemyCommand);
  const enemyCounter = battlefieldCounter(enemyCommand, command);
  const playerMeta = battleCommandMeta(command);
  const enemyMeta = battleCommandMeta(enemyCommand);

  const playerBase = Math.round(
    Math.log10(battle.player.force + 10) * 12 +
    battle.player.command * 0.38 +
    battle.player.strategy * 0.24 +
    battle.player.morale * 0.2 +
    Math.log10(Math.max(10, battle.player.martial)) * 4 +
    (command === 'champion' ? Math.log10(Math.max(10, battle.player.martial)) * 7 : 0) +
    (command === 'fire' ? battle.player.strategy * 0.38 : 0) +
    (command === 'rally' ? -8 : 0) +
    playerCounter
  );
  const enemyBase = Math.round(
    Math.log10(battle.enemy.force + 10) * 12 +
    battle.enemy.command * 0.38 +
    battle.enemy.strategy * 0.24 +
    battle.enemy.morale * 0.2 +
    Math.log10(Math.max(10, battle.enemy.martial)) * 3 +
    (enemyCommand === 'champion' ? Math.log10(Math.max(10, battle.enemy.martial)) * 6 : 0) +
    (enemyCommand === 'fire' ? battle.enemy.strategy * 0.38 : 0) +
    (enemyCommand === 'rally' ? -8 : 0) +
    enemyCounter
  );

  let enemyLoss = Math.max(0, Math.round((playerBase - enemyBase * 0.48) / 3));
  let playerLoss = Math.max(0, Math.round((enemyBase - playerBase * 0.5) / 3));
  let playerMoraleShift = 0;
  let enemyMoraleShift = 0;

  if (command === 'rally') {
    playerMoraleShift += 10;
    playerLoss = Math.max(0, playerLoss - 3);
  }
  if (enemyCommand === 'rally') {
    enemyMoraleShift += 10;
    enemyLoss = Math.max(0, enemyLoss - 3);
  }
  if (command === 'fortify') playerLoss = Math.max(0, playerLoss - 4);
  if (enemyCommand === 'fortify') enemyLoss = Math.max(0, enemyLoss - 4);

  if (command === 'champion') {
    enemyLoss += Math.max(2, Math.round(Math.log10(Math.max(10, battle.player.martial)) * 2));
    playerLoss += 1;
  }
  if (enemyCommand === 'champion') {
    playerLoss += Math.max(2, Math.round(Math.log10(Math.max(10, battle.enemy.martial)) * 2));
    enemyLoss += 1;
  }

  enemyMoraleShift -= Math.max(1, Math.round(enemyLoss / 5)) + Math.max(0, Math.round(playerCounter / 5));
  playerMoraleShift -= Math.max(1, Math.round(playerLoss / 5)) + Math.max(0, Math.round(enemyCounter / 5));

  battle.player.force = Math.max(0, battle.player.force - playerLoss);
  battle.enemy.force = Math.max(0, battle.enemy.force - enemyLoss);
  battle.player.morale = clamp(battle.player.morale + playerMoraleShift, 0, 100);
  battle.enemy.morale = clamp(battle.enemy.morale + enemyMoraleShift, 0, 100);
  battle.playerSupplySpent += Math.max(4, Math.round((playerLoss + enemyLoss) / 3) + (command === 'fire' ? 5 : 0) + (command === 'champion' ? 3 : 0));
  battle.casualtiesTaken += playerLoss;
  battle.casualtiesInflicted += enemyLoss;

  const summary = `第${battle.round}回合，我以${playerMeta.label}应对，对面则用${enemyMeta.label}接招。我方折损约${playerLoss}，敌方折损约${enemyLoss}，军心也随这一手起伏。`;
  battle.lastRoundSummary = summary;
  battle.log.push({
    round: battle.round,
    playerCommand: command,
    playerLabel: playerMeta.label,
    enemyCommand,
    enemyLabel: enemyMeta.label,
    playerLoss,
    enemyLoss,
    playerMorale: battle.player.morale,
    enemyMorale: battle.enemy.morale,
    summary
  });

  const ended = battle.round >= battle.maxRounds || battle.player.force <= 0 || battle.enemy.force <= 0 || battle.player.morale <= 0 || battle.enemy.morale <= 0;
  battle.round += 1;
  return ended;
}

function resolveDuelRound(battle, command) {
  const enemyCommand = duelEnemyCommand(battle);
  const playerCounter = duelCounter(command, enemyCommand);
  const enemyCounter = duelCounter(enemyCommand, command);
  const playerMeta = battleCommandMeta(command);
  const enemyMeta = battleCommandMeta(enemyCommand);

  const commandAttack = command === 'strike' ? 18 : command === 'footwork' ? 11 : command === 'finisher' ? 30 : 4;
  const enemyAttack = enemyCommand === 'strike' ? 18 : enemyCommand === 'footwork' ? 11 : enemyCommand === 'finisher' ? 30 : 4;

  const playerGuard = command === 'guard' ? 18 : command === 'footwork' ? 12 : command === 'channel' ? 4 : 6;
  const enemyGuard = enemyCommand === 'guard' ? 18 : enemyCommand === 'footwork' ? 12 : enemyCommand === 'channel' ? 4 : 6;

  if (command === 'channel') battle.player.qi = clamp(battle.player.qi + 12, 0, 100);
  if (enemyCommand === 'channel') battle.enemy.qi = clamp(battle.enemy.qi + 12, 0, 100);

  if (command === 'finisher') battle.player.qi = Math.max(0, battle.player.qi - 16);
  if (enemyCommand === 'finisher') battle.enemy.qi = Math.max(0, battle.enemy.qi - 16);

  let enemyDamage = Math.max(
    0,
    Math.round(
      commandAttack +
      battle.player.martial * 0.35 +
      battle.player.qi * 0.18 +
      battle.player.agility * 0.22 +
      playerCounter -
      (battle.enemy.guard * 0.25 + enemyGuard + battle.enemy.agility * 0.16)
    )
  );
  let playerDamage = Math.max(
    0,
    Math.round(
      enemyAttack +
      battle.enemy.martial * 0.35 +
      battle.enemy.qi * 0.18 +
      battle.enemy.agility * 0.22 +
      enemyCounter -
      (battle.player.guard * 0.25 + playerGuard + battle.player.agility * 0.16)
    )
  );

  if (command === 'guard') playerDamage = Math.max(0, playerDamage - 4);
  if (enemyCommand === 'guard') enemyDamage = Math.max(0, enemyDamage - 4);
  if (command === 'footwork' && ['strike', 'finisher'].includes(enemyCommand)) playerDamage = Math.max(0, playerDamage - 5);
  if (enemyCommand === 'footwork' && ['strike', 'finisher'].includes(command)) enemyDamage = Math.max(0, enemyDamage - 5);

  battle.player.hp = Math.max(0, battle.player.hp - playerDamage);
  battle.enemy.hp = Math.max(0, battle.enemy.hp - enemyDamage);

  const summary = `第${battle.round}回合，我以${playerMeta.label}应手，对面则回以${enemyMeta.label}。我受创${playerDamage}，对手受创${enemyDamage}，气机与步点都在这一来一往里重新失衡。`;
  battle.lastRoundSummary = summary;
  battle.log.push({
    round: battle.round,
    playerCommand: command,
    playerLabel: playerMeta.label,
    enemyCommand,
    enemyLabel: enemyMeta.label,
    playerDamage,
    enemyDamage,
    playerHp: battle.player.hp,
    enemyHp: battle.enemy.hp,
    playerQi: battle.player.qi,
    enemyQi: battle.enemy.qi,
    summary
  });

  const ended = battle.round >= battle.maxRounds || battle.player.hp <= 0 || battle.enemy.hp <= 0;
  battle.round += 1;
  return ended;
}

function finalizeBattlefield(state, battle) {
  const gs = state.gameState || {};
  const playerRatio = battle.initialPlayerForce > 0 ? battle.player.force / battle.initialPlayerForce : 0;
  const enemyRatio = battle.initialEnemyForce > 0 ? battle.enemy.force / battle.initialEnemyForce : 0;
  const advantage = playerRatio - enemyRatio + (battle.player.morale - battle.enemy.morale) / 120;
  const tier = advantage >= 0.32 ? 'great' : advantage >= 0.12 ? 'good' : advantage >= -0.08 ? 'mixed' : 'fail';
  const troopLoss = Math.min(Number(gs.troops || 0), Math.max(0, Math.round(battle.casualtiesTaken * 0.58)));
  const supplyCost = Math.max(8, Math.round(battle.playerSupplySpent * 0.72));
  const healthLoss = Math.max(0, Math.round(battle.casualtiesTaken / 16));
  const delta = {
    troops: -troopLoss,
    supplies: -supplyCost,
    health: -healthLoss,
    fatigue: tier === 'great' ? 10 : tier === 'good' ? 12 : tier === 'mixed' ? 15 : 18,
    morale: tier === 'great' ? 8 : tier === 'good' ? 4 : tier === 'mixed' ? -2 : -8,
    renown: tier === 'great' ? 7 : tier === 'good' ? 4 : tier === 'mixed' ? 1 : -2,
    influence: tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 0 : -2,
    military: tier === 'great' ? 2 : tier === 'good' ? 1 : 0,
    strategy: battle.log.some((item) => item.playerCommand === 'fire') && tier !== 'fail' ? 1 : 0,
    battlefieldPrestige: tier === 'great' ? 10 : tier === 'good' ? 6 : tier === 'mixed' ? 3 : 1,
    jianghuPrestige: battle.log.some((item) => item.playerCommand === 'champion') && tier !== 'fail' ? 2 : 0
  };

  if (battle.log.some((item) => item.playerCommand === 'champion')) {
    delta.health -= 2;
  }

  const summary = tier === 'great'
    ? `这场${battle.scaleLabel}被我硬生生压出了胜势。阵型、军令和临阵决断终于拧成了一股力，对面的军心先一步塌了。`
    : tier === 'good'
      ? `这场${battle.scaleLabel}最终还是由我方稳住了阵脚。虽然代价不小，但胜负已经偏向我这边。`
      : tier === 'mixed'
        ? `这一场${battle.scaleLabel}打得两边都发沉，我勉强撑住场面，没有让它当场崩掉。`
        : `这场${battle.scaleLabel}没能按我的预想压住，对面的反咬比预估更狠，这一回明显吃了亏。`;

  state.gameState.lastBattleReport = {
    mode: '沙场征战',
    scaleLabel: battle.scaleLabel,
    playerCommittedTroops: battle.initialPlayerForce,
    enemyTroops: battle.initialEnemyForce,
    playerStrength: Math.round(battle.player.command + battle.player.force / 8 + battle.player.morale / 2),
    enemyStrength: Math.round(battle.enemy.command + battle.enemy.force / 8 + battle.enemy.morale / 2),
    casualties: troopLoss,
    supplyCost,
    targetFactionName: battle.targetName,
    rounds: battle.log.slice()
  };
  return { tier, summary, delta };
}

function finalizeDuel(state, battle) {
  const playerRatio = battle.initialPlayerHp > 0 ? battle.player.hp / battle.initialPlayerHp : 0;
  const enemyRatio = battle.initialEnemyHp > 0 ? battle.enemy.hp / battle.initialEnemyHp : 0;
  const advantage = playerRatio - enemyRatio + (battle.player.qi - battle.enemy.qi) / 160;
  const tier = advantage >= 0.34 ? 'great' : advantage >= 0.12 ? 'good' : advantage >= -0.08 ? 'mixed' : 'fail';
  const hpLoss = Math.max(0, Math.round((battle.initialPlayerHp - battle.player.hp) / 2.2));
  const delta = {
    health: -hpLoss,
    fatigue: tier === 'great' ? 6 : tier === 'good' ? 8 : tier === 'mixed' ? 11 : 14,
    renown: tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1,
    jianghuPrestige: tier === 'great' ? 9 : tier === 'good' ? 6 : tier === 'mixed' ? 3 : 1,
    martialLevel: tier === 'great' ? 2 : tier === 'good' ? 1 : 0,
    martialInsight: tier === 'great' ? 2 : tier === 'good' ? 1 : 0
  };

  const summary = tier === 'great'
    ? `这一场江湖对决被我打得节奏尽在掌心。对面的招式被我一点点拆开，最后只能在正面败下去。`
    : tier === 'good'
      ? `这一场江湖对决终究还是我占了上风。几手拆招之后，对面的底气已经接不住后面的变化。`
      : tier === 'mixed'
        ? `这一场江湖对决打得并不轻松，我只是勉强把局面咬住，没让自己先一步垮掉。`
        : `这一场江湖对决没能打出我想要的压迫感，对面的招法比想象里更狠，我这一回明显吃了亏。`;

  state.gameState.lastBattleReport = {
    mode: '江湖对决',
    scaleLabel: '生死问招',
    playerCommittedTroops: 1,
    enemyTroops: 1,
    playerStrength: Math.round(battle.player.martial + battle.player.hp / 5 + battle.player.qi / 2),
    enemyStrength: Math.round(battle.enemy.martial + battle.enemy.hp / 5 + battle.enemy.qi / 2),
    casualties: hpLoss,
    supplyCost: 0,
    targetFactionName: battle.targetName,
    rounds: battle.log.slice()
  };
  return { tier, summary, delta };
}

function resolveBattleCommand(state, command) {
  const battle = state && state.gameState ? state.gameState.activeBattle : null;
  if (!battle || !battle.active) {
    return {
      kind: 'battle',
      tier: 'fail',
      summary: '眼下并没有真正进入战斗，不能直接下战斗指令。',
      delta: {},
      changeSummary: '',
      deltaLine: ''
    };
  }

  const normalizedCommand = String(command || '').trim();
  const ended = battle.mode === 'duel'
    ? resolveDuelRound(battle, normalizedCommand)
    : resolveBattlefieldRound(battle, normalizedCommand);

  if (!ended) {
    return {
      kind: battle.mode === 'duel' ? 'jianghu' : 'battle',
      tier: 'mixed',
      summary: battle.lastRoundSummary,
      delta: {},
      changeSummary: '',
      deltaLine: ''
    };
  }

  const finalResolution = battle.mode === 'duel'
    ? finalizeDuel(state, battle)
    : finalizeBattlefield(state, battle);

  state.gameState.activeBattle = null;
  return {
    kind: battle.mode === 'duel' ? 'jianghu' : 'battle',
    tier: finalResolution.tier,
    summary: `${battle.lastRoundSummary}${finalResolution.summary}`,
    delta: finalResolution.delta,
    changeSummary: '',
    deltaLine: ''
  };
}

function chooseDuelTarget(state, options = {}) {
  const relations = ensureList(state && state.gameState && state.gameState.relationships)
    .filter((item) => item && isRelationMet(item));
  const explicitTarget = options.target
    ? relations.find((item) => item.id === options.target)
    : null;
  const martialTarget = explicitTarget || relations
    .slice()
    .sort((a, b) => ((b.martialRating || 0) + (b.rivalry || 0) + (b.trust || 0)) - ((a.martialRating || 0) + (a.rivalry || 0) + (a.trust || 0)))[0];
  if (martialTarget) {
    return {
      name: martialTarget.name || '对手',
      title: martialTarget.title || '江湖客',
      martialRating: Math.max(48, Number(martialTarget.martialRating || 0)),
      strategyRating: Math.max(24, Number(martialTarget.strategyRating || 0))
    };
  }

  const pressure = Number(state && state.world && state.world.pressure || 0);
  return {
    name: pressure >= 50 ? '来路不善的成名客' : '路过此地的江湖高手',
    title: pressure >= 50 ? '狠手凶名' : '问剑游侠',
    martialRating: 55 + Math.round(pressure / 3),
    strategyRating: 28 + Math.round(pressure / 6)
  };
}

function createDuelState(state, options = {}) {
  const gs = state.gameState || {};
  const world = state.world || {};
  const target = chooseDuelTarget(state, options);
  const variant = options.variant === 'sparring' ? 'sparring' : 'duel';
  const playerHealth = clamp(Math.round(Number(gs.health || 0) * 0.92 + Number(gs.martialLevel || 0) * 1.85 + 36), 60, 260);
  const enemyHealth = clamp(
    Math.round(target.martialRating * (variant === 'sparring' ? 1.65 : 1.95) + Number(world.pressure || 0) * 0.45 + (variant === 'sparring' ? 18 : 30)),
    52,
    variant === 'sparring' ? 220 : 255
  );

  return {
    active: true,
    mode: 'duel',
    variant,
    title: variant === 'sparring' ? '江湖切磋' : '江湖对决',
    subtitle: `${target.name} · ${target.title}`,
    targetName: target.name,
    round: 1,
    maxRounds: variant === 'sparring' ? 5 : 7,
    initialPlayerHp: playerHealth,
    initialEnemyHp: enemyHealth,
    player: {
      hp: playerHealth,
      qi: clamp(24 + Math.round(Number(gs.martialLevel || 0) / 2) + Math.round(Number(gs.health || 0) / 14), 20, 100),
      guard: Math.round(Number(gs.martialLevel || 0) * 0.55 + Number(gs.health || 0) * 0.12 + 8),
      martial: Number(gs.martialLevel || 0),
      agility: Math.round(Number(gs.martialLevel || 0) * 0.36 + Number(gs.charm || 0) * 0.08 + 10)
    },
    enemy: {
      hp: enemyHealth,
      qi: clamp(22 + Math.round(target.martialRating / 2.2), 20, 100),
      guard: Math.round(target.martialRating * 0.52 + target.strategyRating * 0.16 + 8),
      martial: target.martialRating,
      agility: Math.round(target.martialRating * 0.32 + target.strategyRating * 0.18 + 10)
    },
    log: [],
    lastRoundSummary: '',
    resolution: null
  };
}

function startBattleEncounter(state, mode, options = {}) {
  if (state.gameState && state.gameState.activeBattle && state.gameState.activeBattle.active) {
    return {
      kind: mode === 'duel' ? 'jianghu' : 'battle',
      tier: 'mixed',
      summary: '眼前这场战局还没分出高下，不能再另起一场。',
      delta: {},
      changeSummary: '',
      deltaLine: ''
    };
  }

  const battle = mode === 'duel' ? createDuelState(state, options) : createBattlefieldState(state);
  state.gameState.activeBattle = battle;
  state.gameState.lastBattleReport = null;
  state.gameState.lastRuleSummary = '';
  state.gameState.lastDeltaLine = '';
  state.gameState.lastResolutionSummary = mode === 'duel'
    ? battle.variant === 'sparring'
      ? `我与${battle.targetName}先把切磋架势摆开，这几手主要看攻守、步点和真气拿捏。`
      : `我与${battle.targetName}当面摆开了架势，接下来每一手都会直接决定这场江湖对决的高下。`
    : `我把这场${battle.scaleLabel}真正拉开了阵势，对面是${battle.targetName}，接下来要靠阵型、军令、计策与临阵决断一步步争胜。`;

  return {
    kind: mode === 'duel' ? 'jianghu' : 'battle',
    tier: 'mixed',
    summary: state.gameState.lastResolutionSummary,
    delta: {},
    changeSummary: '',
    deltaLine: ''
  };
}

function finalizeDuel(state, battle) {
  const sparring = battle && battle.variant === 'sparring';
  const playerRatio = battle.initialPlayerHp > 0 ? battle.player.hp / battle.initialPlayerHp : 0;
  const enemyRatio = battle.initialEnemyHp > 0 ? battle.enemy.hp / battle.initialEnemyHp : 0;
  const advantage = playerRatio - enemyRatio + (battle.player.qi - battle.enemy.qi) / 160;
  const tier = advantage >= 0.34 ? 'great' : advantage >= 0.12 ? 'good' : advantage >= -0.08 ? 'mixed' : 'fail';
  const hpLossBase = Math.max(0, Math.round((battle.initialPlayerHp - battle.player.hp) / 2.2));
  const hpLoss = sparring ? Math.max(0, Math.round(hpLossBase * 0.45)) : hpLossBase;
  const delta = sparring
    ? {
        health: -hpLoss,
        fatigue: tier === 'great' ? 3 : tier === 'good' ? 4 : tier === 'mixed' ? 6 : 8,
        renown: tier === 'great' ? 2 : tier === 'good' ? 1 : 0,
        jianghuPrestige: tier === 'great' ? 4 : tier === 'good' ? 3 : tier === 'mixed' ? 1 : 0,
        martialLevel: tier === 'great' ? 2 : 1,
        martialInsight: tier === 'great' ? 2 : 1
      }
    : {
        health: -hpLoss,
        fatigue: tier === 'great' ? 6 : tier === 'good' ? 8 : tier === 'mixed' ? 11 : 14,
        renown: tier === 'great' ? 4 : tier === 'good' ? 2 : tier === 'mixed' ? 1 : -1,
        jianghuPrestige: tier === 'great' ? 9 : tier === 'good' ? 6 : tier === 'mixed' ? 3 : 1,
        martialLevel: tier === 'great' ? 2 : tier === 'good' ? 1 : 0,
        martialInsight: tier === 'great' ? 2 : tier === 'good' ? 1 : 0
      };

  const summary = sparring
    ? tier === 'great'
      ? `这一场切磋被我打得相当顺手，步点、真气和拆招节奏都稳稳压住了对面。`
      : tier === 'good'
        ? `这一场切磋终究还是我更稳一筹，几次换手之后，手感已经完全热起来了。`
        : tier === 'mixed'
          ? `这一场切磋打得有来有回，我把手感勉强找了回来，也看清了几处空门。`
          : `这一场切磋没能打顺，对面的手法比想象里更老辣，我这一回先记下了教训。`
    : tier === 'great'
      ? `这一场江湖对决被我打得节奏尽在掌心。对面的招式被我一点点拆开，最后只能在正面败下去。`
      : tier === 'good'
        ? `这一场江湖对决终究还是我占了上风。几手拆招之后，对面的底气已经接不住后面的变化。`
        : tier === 'mixed'
          ? `这一场江湖对决打得并不轻松，我只是勉强把局面咬住，没让自己先一步垮掉。`
          : `这一场江湖对决没能打出我想要的压迫感，对面的招法比想象里更狠，我这一回明显吃了亏。`;

  state.gameState.lastBattleReport = {
    mode: sparring ? '江湖切磋' : '江湖对决',
    scaleLabel: sparring ? '喂招过手' : '生死问招',
    playerCommittedTroops: 1,
    enemyTroops: 1,
    playerStrength: Math.round(battle.player.martial + battle.player.hp / 5 + battle.player.qi / 2),
    enemyStrength: Math.round(battle.enemy.martial + battle.enemy.hp / 5 + battle.enemy.qi / 2),
    casualties: hpLoss,
    supplyCost: 0,
    targetFactionName: battle.targetName,
    rounds: battle.log.slice()
  };
  return { tier, summary, delta };
}

module.exports = {
  startBattleEncounter,
  resolveBattleCommand
};
