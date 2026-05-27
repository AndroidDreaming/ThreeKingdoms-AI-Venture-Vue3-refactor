const { HISTORICAL_EVENT_CONFIG } = require('./chronicleV5HistoricalEventConfig');
const { summarizeRetinueForPrompt } = require('./chronicleV5RetinueSystem');
const { relationVisibilityState, isRelationMet } = require('./chronicleV5RelationVisibility');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSnippet(value, fallback = '') {
  const text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function getCurrentAct(world) {
  const mainline = world && world.mainline && typeof world.mainline === 'object' ? world.mainline : {};
  const acts = ensureList(mainline.acts);
  const index = Math.max(0, Math.min(acts.length - 1, Number(mainline.currentActIndex || 0)));
  return acts[index] || acts[0] || {
    title: '当前主线',
    focus: []
  };
}

function hasHistoricalDeviation(historical) {
  return Object.values((historical && historical.eventStates) || {}).some((item) => {
    if (!item || item.triggered !== true) return false;
    return item.branch === 'shifting' || item.branch === 'rewrite';
  });
}

function pickNearHistoricalEvent(world, historical) {
  const year = Number(world && world.year) || 0;
  return HISTORICAL_EVENT_CONFIG
    .map((config) => ({ config, state: historical && historical.eventStates ? historical.eventStates[config.id] : null }))
    .filter((item) => item.state && item.state.triggered !== true && year >= Number(item.config.year || 0) - 1)
    .map((item) => {
      const threshold = Math.max(1, Number(item.config.threshold || 1));
      const score = Number(item.state.score || 0);
      return {
        config: item.config,
        state: item.state,
        ratio: score / threshold
      };
    })
    .filter((item) => item.ratio >= 0.45)
    .sort((a, b) => b.ratio - a.ratio)[0] || null;
}

function battleModeLabel(activeBattle) {
  if (!activeBattle || !activeBattle.active) return '';
  if (activeBattle.mode === 'duel') {
    return activeBattle.variant === 'sparring' ? '江湖切磋' : '江湖对决';
  }
  return '沙场征战';
}

function buildPressureLine(gs) {
  const pressure = [];
  if (Number(gs.health || 0) <= 38) pressure.push(`健康${Number(gs.health || 0)}`);
  if (Number(gs.morale || 0) <= 35) pressure.push(`士气${Number(gs.morale || 0)}`);
  if (Number(gs.supplies || 0) <= 20) pressure.push(`粮秣${Number(gs.supplies || 0)}`);
  if (Number(gs.coins || 0) <= 40) pressure.push(`钱财${Number(gs.coins || 0)}`);
  if (!pressure.length) return '';
  return `导演指令：当前${pressure.join('、')}偏低，若涉及高压推进，优先写受阻、试探、借势、求援或止损，不要把硬条件不足的事情直接写成顺利达成。`;
}

function assignmentTouchesAction(assignment, action) {
  if (!assignment) return false;
  const mode = String(action && action.mode || '').trim();
  const kind = String(action && action.kind || '').trim();
  if (!mode && !kind) return false;
  if (mode.startsWith('team_') || mode.startsWith('appoint_') || mode === 'recruit' || mode === 'recruit_probe') {
    return true;
  }
  const supportedKinds = {
    steward: ['govern', 'trade', 'sect', 'diplomacy', 'rest'],
    quartermaster: ['military', 'battle', 'warpath', 'trade', 'rest', 'martial'],
    counselor: ['investigate', 'intrigue', 'diplomacy', 'sect', 'martial'],
    spymaster: ['investigate', 'intrigue', 'jianghu', 'diplomacy', 'sect'],
    scout: ['jianghu', 'investigate', 'rest', 'diplomacy', 'sect', 'martial'],
    escort: ['martial', 'jianghu', 'travel', 'rest', 'sect'],
    drillmaster: ['military', 'battle', 'warpath', 'martial', 'rest'],
    vanguard: ['battle', 'warpath', 'jianghu', 'martial', 'diplomacy', 'sect']
  };
  return ensureList(supportedKinds[String(assignment.roleId || '')]).includes(kind);
}

function buildRetinueLine(retinue, action) {
  if (!retinue || !retinue.narrativeConstraint) return '';
  const assignments = ensureList(retinue.assignments).slice(0, 4);
  const companion = retinue && retinue.companion ? retinue.companion : null;
  const roleText = assignments
    .map((item) => item.slotLabel || item.roleName)
    .filter(Boolean)
    .join('、');
  const focusedText = assignments
    .filter((item) => assignmentTouchesAction(item, action))
    .slice(0, 3)
    .map((item) => item.slotLabel || item.roleName)
    .filter(Boolean)
    .join('、');
  if (companion && companion.name) {
    const companionRole = companion.activeRoleName ? `，眼下职司偏向${companion.activeRoleName}` : '';
    return `导演指令：当前指定同行的是${companion.name}${companionRole}。本回让他基于性格、分工和眼前事务，自然给出一两次判断、提醒、动作或补位；不要把他写成空转闲聊，也不要抢走主角的叙事中心。${retinue.narrativeConstraint}`;
  }
  if (roleText && focusedText) {
    return `导演指令：当前编制状态为“${retinue.readiness}”，幕下已有人分掌${roleText}。本回若触及${focusedText}的分掌领域，默认写成他们在幕后递来一两句判断、提醒、风声或补位，不要频繁展开无关对话；除非玩家点名、同行，或动作本身就是队伍调度，才让已任命成员走到台前。${retinue.narrativeConstraint}`;
  }
  if (roleText) {
    return `导演指令：当前编制状态为“${retinue.readiness}”，幕下已有人分掌${roleText}。已任命成员默认在幕后给建议、回报和补位，不要把他们写成每回都抢镜的对话中心；只有玩家点名、同行，或动作直接命中其职司时，才让他们明显出场。${retinue.narrativeConstraint}`;
  }
  return `导演指令：当前编制状态为“${retinue.readiness}”。${retinue.narrativeConstraint}`;
}

function buildPromptDirectorLines(state, action, mode = 'narration') {
  const gs = state && state.gameState ? state.gameState : {};
  const world = state && state.world ? state.world : {};
  const memory = state && state.memory ? state.memory : {};
  const historical = gs.historical || {};
  const worldFermentation = gs.worldFermentation && typeof gs.worldFermentation === 'object' ? gs.worldFermentation : {};
  const activeBattle = gs.activeBattle || null;
  const retinue = summarizeRetinueForPrompt(state);
  const act = getCurrentAct(world);
  const lines = [];
  const activeEvents = ensureList(historical.activeEventIds)
    .map((id) => ({ config: HISTORICAL_EVENT_CONFIG.find((item) => item.id === id), state: historical.eventStates && historical.eventStates[id] }))
    .filter((item) => item.config && item.state)
    .sort((a, b) => Number(b.state.score || 0) - Number(a.state.score || 0));
  const nearEvent = pickNearHistoricalEvent(world, historical);
  const topThread = ensureList(memory.openThreads)
    .slice()
    .sort((a, b) => Number(b.urgency || 0) - Number(a.urgency || 0))[0] || null;
  const actFocus = ensureList(act.focus).slice(0, 2).join('、') || normalizeSnippet(act.title, '当前主线');
  const rumorOnlyNames = ensureList(gs.relationships)
    .filter((item) => item && item.name && !isRelationMet(item))
    .filter((item) => ['rumor', 'scene'].includes(relationVisibilityState(item, 'hidden')))
    .slice(0, 4)
    .map((item) => item.name)
    .filter(Boolean)
    .join('、');

  if (activeBattle && activeBattle.active) {
    const label = battleModeLabel(activeBattle);
    lines.push(`导演指令：本回主轴锁定在${label}，只允许围绕当前对手、战局交换、压制反制与收束余波推进，不要把篇幅分散到无关经营、远行或闲谈。`);
  } else if (activeEvents.length) {
    lines.push(`导演指令：本回优先推进“${activeEvents[0].config.title}”这条史势线，至少让人物、势力或地点其中一层发生实质变化，不要只做泛泛铺垫。`);
  } else if (topThread && topThread.title) {
    lines.push(`导演指令：本回优先承接线索“${normalizeSnippet(topThread.title, '眼前悬着的线头')}”，让它至少前进一步，不要继续悬空。`);
  } else {
    lines.push(`导演指令：本回优先服务“${actFocus}”，不要把篇幅平均铺给所有系统。`);
  }

  if (nearEvent && !activeEvents.length) {
    lines.push(`导演指令：${nearEvent.config.title}已经逼近触发阈值，本回若涉及相关人物、地点或势力，应继续加压，不要把势头写散。`);
  }

  if (!hasHistoricalDeviation(historical)) {
    lines.push('导演指令：在真正撬动史势之前，史实人物不得无缘无故脱离原本轨迹来陪游、私奔、走江湖或替主角让路。');
  }

  if (String(action && action.kind || '') === 'jianghu' && !(activeBattle && activeBattle.active)) {
    lines.push('导演指令：压向江湖默认写成风声、递帖、试探、结识、借势、摸门路与风波前兆；除非明确触发切磋、敌袭或围杀，不要直接写成即时战斗。');
  }

  if (world && world.territory && Number(world.territory.governedCount || 0) <= 0) {
    lines.push('导演指令：当前主角还没有真正拿到任何城池治权，史实人物最多写到结识、照面、试探与借势，不得直接写成已经被正式收进幕下。');
  }

  if (rumorOnlyNames) {
    lines.push(`导演指令：${rumorOnlyNames}目前还只停在风闻、露面或远处影子的层级。除非玩家这回主动点名去接、动作直接以其为目标，或关系已经真正做到“已结识”，否则只能把他们写成传闻、帖子、旁人口中的名字或远处身影，不得让他们自己走到台前与主角展开完整对话。`);
  }

  if (worldFermentation && worldFermentation.directorHint) {
    lines.push(`导演指令：${normalizeSnippet(worldFermentation.directorHint, '')}`);
  }

  const pressureLine = buildPressureLine(gs);
  if (pressureLine) lines.push(pressureLine);

  if (!gs.martialLimitBroken && Number(gs.martialLevel || 0) >= 88) {
    lines.push('导演指令：武学已逼近常规极限，后续若继续上冲，应优先通过名师、险局、绝境或奇遇推进，不要把普通练功写成还能稳定暴涨。');
  }

  const retinueLine = buildRetinueLine(retinue, action);
  if (retinueLine) lines.push(retinueLine);

  if (mode === 'choice') {
    lines.push('导演指令：动态选项必须给出对象、地点或目标；条件不足的方向可以可见，但要写成试探、铺垫、借势或求援，不要直接给完成态。');
    lines.push('导演指令：避开固定操作盘已经稳定承接的经营、养成、任命与队伍调度；不要预设哪条线天然更优先，只需避开重复、越权、无上下文支撑和模板化动作。');
  } else {
    lines.push('导演指令：正文必须把本地规则已裁定的得失、阻力与后果写实，不能跳过过程，更不能把未满足条件的结果写成已经发生。');
    lines.push('导演指令：正文严禁直接播报“数值变动”“士气+1”“谋略添一”这类结算语句；若有收益或损耗，只能改写成人心、气力、声势、门路、伤势、疲态与局势回响。');
  }

  if (mode !== 'choice') {
    lines.push('导演指令：严格锁在当下年份与身份语境里，禁止写出后世书名、后见之明、现代对白、现代职业称呼或穿越式旁白；人物对话必须符合其身份、地位、处境与汉末气口。');
  }

  return lines.slice(0, 6);
}

module.exports = {
  buildPromptDirectorLines
};
