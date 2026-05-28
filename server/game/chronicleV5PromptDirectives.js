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
  if (Number(gs.morale || 0) <= 35) pressure.push('军心偏虚');
  if (!pressure.length) return '';
  return `导演提示：${pressure.join('、')}。若涉及高压推进，更适合写成试探、借势、求援或止损，让压力从人群反应和现场迟疑里露出来。`;
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
    return `导演提示：当前指定同行的是${companion.name}${companionRole}。可让他基于性格、分工和眼前事务，自然给出一两次判断、提醒、动作或补位；不要把他写成空转闲聊，也不要抢走主角的叙事中心。${retinue.narrativeConstraint}`;
  }
  if (roleText && focusedText) {
    return `导演提示：当前编制状态为“${retinue.readiness}”，幕下已有人分掌${roleText}。本回若触及${focusedText}的分掌领域，可以写成他们在幕后递来一两句判断、提醒、风声或补位；除非玩家点名、同行，或动作本身就是队伍调度，才让已任命成员走到台前。${retinue.narrativeConstraint}`;
  }
  if (roleText) {
    return `导演提示：当前编制状态为“${retinue.readiness}”，幕下已有人分掌${roleText}。已任命成员更适合在幕后给建议、回报和补位，不要把他们写成每回都抢镜的对话中心；只有玩家点名、同行，或动作直接命中其职司时，才让他们明显出场。${retinue.narrativeConstraint}`;
  }
  return `导演提示：当前编制状态为“${retinue.readiness}”。${retinue.narrativeConstraint}`;
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
    lines.push(`导演提示：本回主轴锁定在${label}，篇幅应主要围绕当前对手、战局交换、压制反制与收束余波，不要分散到无关经营、远行或闲谈。`);
  } else if (activeEvents.length) {
    lines.push(`导演提示：本回优先推进“${activeEvents[0].config.title}”这条史势线，让人物、势力或地点至少有一层具体变化，不要只做泛泛铺垫。`);
  } else if (topThread && topThread.title) {
    lines.push(`导演提示：本回优先承接线索“${normalizeSnippet(topThread.title, '眼前悬着的线头')}”，让它前进一步，不要继续悬空。`);
  } else {
    lines.push(`导演提示：本回优先服务“${actFocus}”，不要把篇幅平均铺给所有系统。`);
  }

  if (nearEvent && !activeEvents.length) {
    lines.push(`导演提示：${nearEvent.config.title}已经逼近触发阈值，本回若涉及相关人物、地点或势力，应继续加压，不要把势头写散。`);
  }

  if (!hasHistoricalDeviation(historical)) {
    lines.push('导演提示：史实人物若还没被玩家真正撬动，就让他们保持自身轨迹；可用传闻、文书、远处身影和旁人口信压出时代重量。');
  }

  if (String(action && action.kind || '') === 'jianghu' && !(activeBattle && activeBattle.active)) {
    lines.push('导演提示：压向江湖通常更适合写成风声、递帖、试探、结识、借势、摸门路与风波前兆；除非明确触发切磋、敌袭或围杀，不要直接写成即时战斗。');
  }

  if (world && world.territory && Number(world.territory.governedCount || 0) <= 0) {
    lines.push('导演提示：主角尚未握有城池治权；人物关系更适合落在照面、试探、借势和临时人情上。');
  }

  if (rumorOnlyNames) {
    lines.push(`导演提示：${rumorOnlyNames}仍是风闻或远影。让名字从传闻、帖子、口信、榜文或旁人话里出现，先留距离感。`);
  }

  if (worldFermentation && worldFermentation.directorHint) {
    lines.push(`导演提示：${normalizeSnippet(worldFermentation.directorHint, '')}`);
  }

  const pressureLine = buildPressureLine(gs);
  if (pressureLine) lines.push(pressureLine);

  if (!gs.martialLimitBroken && Number(gs.martialLevel || 0) >= 88) {
    lines.push('导演提示：武学已逼近常规极限，后续若继续上冲，应优先通过名师、险局、绝境或奇遇推进，不要把普通练功写成还能稳定暴涨。');
  }

  const retinueLine = buildRetinueLine(retinue, action);
  if (retinueLine) lines.push(retinueLine);

  if (mode === 'choice') {
    lines.push('导演提示：动态选项应尽量给出对象、地点或目标；条件不足的方向可以可见，但要写成试探、铺垫、借势或求援，不要直接给完成态。');
    lines.push('导演提示：避开固定操作盘已经稳定承接的经营、养成、任命与队伍调度；不要预设哪条线天然更优先，只需避开重复、越权、无上下文支撑和模板化动作。');
  } else {
    lines.push('导演提示：把本地裁定的得失、阻力与后果写成现场过程，少解释，多用动作、称呼、物件和旁人反应承载。');
    lines.push('范例：不要写“士气+1”，写“帐外原本低着头的老卒抬眼看了我一下，绑甲的手快了半拍”。');
  }

  if (mode !== 'choice') {
    lines.push('导演提示：人物说话贴住身份、地位和汉末气口；旁白像亲历者，不像后世史评。');
  }

  return lines.slice(0, 6);
}

module.exports = {
  buildPromptDirectorLines
};
