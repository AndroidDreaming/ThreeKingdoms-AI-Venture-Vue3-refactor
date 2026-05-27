const {
  RETINUE_DEFAULTS,
  RETINUE_ROLE_DEFINITIONS,
  TEAM_ACTION_DEFINITIONS
} = require('../config/chronicle.retinue.config');
const { isRelationMet } = require('./chronicleV5RelationVisibility');
const { historicalRecruitAccess } = require('./chronicleV5CitySystem');

const RETINUE_PROBE_STAGE_FORMAL = 3;
const RETINUE_PROBE_STAGE_LABELS = {
  0: '尚未试探',
  1: '初步试探',
  2: '已经谈动',
  3: '可以定局'
};

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function cloneDelta(delta) {
  return Object.keys(delta || {}).reduce((result, key) => {
    const value = Number(delta[key] || 0);
    if (!value) return result;
    result[key] = value;
    return result;
  }, {});
}

function mergeDelta(base, patch) {
  const next = cloneDelta(base || {});
  Object.keys(patch || {}).forEach((key) => {
    const value = Number(patch[key] || 0);
    if (!value) return;
    next[key] = Number(next[key] || 0) + value;
  });
  return next;
}

function fillTemplate(template, context) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(context[key] == null ? '' : context[key]));
}

function normalizeRetinueMember(member) {
  if (!member || !member.relationId) return null;
  return {
    relationId: String(member.relationId || ''),
    joinedTurn: Number(member.joinedTurn || 0),
    rolePool: ensureList(member.rolePool).map((item) => String(item || '')).filter(Boolean),
    activeRoleId: String(member.activeRoleId || ''),
    active: member.active !== false
  };
}

function ensureRetinueState(state) {
  if (!state || !state.gameState) return {
    capacity: RETINUE_DEFAULTS.capacity,
    members: [],
    assignments: {},
    actionTracks: {},
    companionRelationId: '',
    companionSinceTurn: 0
  };
  const raw = state.gameState.retinue && typeof state.gameState.retinue === 'object'
    ? state.gameState.retinue
    : {};
  const members = ensureList(raw.members).map(normalizeRetinueMember).filter(Boolean);
  const validIds = new Set(members.map((item) => item.relationId));
  const assignments = Object.keys(raw.assignments || {}).reduce((result, key) => {
    const relationId = String(raw.assignments[key] || '');
    if (relationId && validIds.has(relationId)) result[key] = relationId;
    return result;
  }, {});
  members.forEach((member) => {
    if (member.activeRoleId && assignments[member.activeRoleId] !== member.relationId) {
      member.activeRoleId = '';
    }
  });
  const companionRelationId = validIds.has(String(raw.companionRelationId || ''))
    ? String(raw.companionRelationId || '')
    : '';
  raw.capacity = Math.max(1, Number(raw.capacity || RETINUE_DEFAULTS.capacity));
  raw.members = members;
  raw.assignments = assignments;
  raw.actionTracks = raw.actionTracks && typeof raw.actionTracks === 'object' ? raw.actionTracks : {};
  raw.companionRelationId = companionRelationId;
  raw.companionSinceTurn = companionRelationId ? Number(raw.companionSinceTurn || 0) : 0;
  state.gameState.retinue = raw;
  return raw;
}

function getRoleDefinition(roleId) {
  return RETINUE_ROLE_DEFINITIONS.find((item) => item && item.id === roleId) || null;
}

function getTeamActionDefinition(mode) {
  return TEAM_ACTION_DEFINITIONS.find((item) => item && item.id === mode) || null;
}

function directionForDomain(domain) {
  if (domain === '经营') return 'governance';
  if (domain === '谋略') return 'strategy';
  if (domain === '江湖') return 'jianghu';
  if (domain === '军旅') return 'military';
  return 'governance';
}

function directionForKind(kind) {
  if (['govern', 'trade'].includes(kind)) return 'governance';
  if (['social', 'romance', 'diplomacy'].includes(kind)) return 'network';
  if (['investigate', 'intrigue'].includes(kind)) return 'strategy';
  if (['martial', 'sect'].includes(kind)) return 'martial';
  if (['military', 'warpath', 'battle'].includes(kind)) return 'military';
  if (['jianghu', 'spar'].includes(kind)) return 'jianghu';
  if (kind === 'travel') return 'world';
  return 'growth';
}

function relationById(state, relationId) {
  return ensureList(state && state.gameState && state.gameState.relationships).find((item) => item && item.id === relationId) || null;
}

function memberByRelationId(state, relationId) {
  const retinue = ensureRetinueState(state);
  return ensureList(retinue.members).find((item) => item && item.relationId === relationId) || null;
}

function relationScoreForRecruit(relation) {
  if (!relation) return -999;
  const trust = Number(relation.trust || 0);
  const loyalty = Number(relation.loyalty || 0);
  const affection = Number(relation.affection || 0);
  const rivalry = Number(relation.rivalry || 0);
  const strategyRating = Number(relation.strategyRating || 0);
  const martialRating = Number(relation.martialRating || 0);
  const bondBonus = relation.bondKey ? 8 : 0;
  const historyPenalty = relation.isHistorical ? 4 : 0;
  return (trust * 1.25)
    + (loyalty * 1.8)
    + (affection * 0.65)
    + (strategyRating * 0.08)
    + (martialRating * 0.08)
    + bondBonus
    - (rivalry * 1.15)
    - historyPenalty;
}

function tagsOf(relation) {
  return ensureList(relation && relation.tags).map((item) => String(item || ''));
}

function statRequirement(label, current, minimum) {
  return {
    type: 'stat',
    label,
    current: Number(current || 0),
    minimum: Number(minimum || 0),
    met: Number(current || 0) >= Number(minimum || 0)
  };
}

function stateRequirement(label, met) {
  return {
    type: 'state',
    label,
    met: !!met
  };
}

function buildAccess(requirements, reason = '') {
  const list = ensureList(requirements);
  const unmet = list.filter((item) => item && item.met !== true);
  return {
    unlocked: unmet.length === 0,
    reason: unmet.length ? (reason || unmet.map((item) => item.label || '').filter(Boolean).join('��')) : '',
    requirements: list
  };
}

function applyAccess(choice, access) {
  const next = Object.assign({}, choice, {
    requirements: ensureList(access && access.requirements),
    lockedReason: access && access.unlocked === false ? String(access.reason || '') : ''
  });
  if (access && access.unlocked === false) {
    next.disabled = true;
    if (next.lockedReason) next.hint = next.lockedReason;
  }
  return next;
}

function roleScoreForRelation(relation, role) {
  if (!relation || !role) return -999;
  const tags = tagsOf(relation);
  let score = relationScoreForRecruit(relation);
  const matchedTagCount = ensureList(role.tagsAnyOf).filter((tag) => tags.includes(tag)).length;
  score += matchedTagCount * 8;
  if (role.domain === '谋略') score += Number(relation.strategyRating || 0) * 0.32;
  if (role.domain === '军旅') score += Number(relation.martialRating || 0) * 0.28;
  if (role.domain === '江湖') score += (Number(relation.martialRating || 0) * 0.2) + (tags.includes('travel') ? 6 : 0);
  if (role.domain === '经营') score += (Number(relation.strategyRating || 0) * 0.2) + (tags.includes('mercantile') ? 6 : 0);
  return score;
}

function relationVisibleEnoughForRetinue(relation) {
  if (!relation) return false;
  const visibility = String(relation.revealState || relation.visibilityState || '');
  return isRelationMet(relation) || ['met', 'revealed'].includes(visibility);
}

function recruitProbeStage(relation) {
  return Math.max(0, Number(relation && relation.retinueRecruitStage || 0));
}

function recruitInclination(relation) {
  const explicit = Number(relation && relation.retinueRecruitInclination);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(0, Math.round(explicit));
  if (!relation) return 0;
  const trust = Number(relation.trust || 0);
  const loyalty = Number(relation.loyalty || 0);
  const affection = Number(relation.affection || 0);
  const rivalry = Number(relation.rivalry || 0);
  const derived = Math.round(
    (trust * 0.08)
    + (loyalty * 0.45)
    + (affection * 0.12)
    + (relation.bondKey ? 1 : 0)
    - (rivalry * 0.1)
  );
  return Math.max(0, derived);
}

function roleMatchesRelationTags(relation, role) {
  const tags = tagsOf(relation);
  return !ensureList(role && role.tagsAnyOf).length
    || ensureList(role && role.tagsAnyOf).some((tag) => tags.includes(tag));
}

function relationPotentialRoles(state, relation) {
  if (!state || !relation || !relation.id || !relation.name) return [];
  if (memberByRelationId(state, relation.id)) return [];
  return RETINUE_ROLE_DEFINITIONS
    .filter((role) => roleMatchesRelationTags(relation, role))
    .map((role) => ({ role, score: roleScoreForRelation(relation, role) }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map((entry) => entry.role);
}

function recruitThresholdsForRole(relation, role) {
  const recruit = role && role.recruit ? role.recruit : {};
  const probeStage = recruitProbeStage(relation);
  const inclination = recruitInclination(relation);
  const probeScoreDiscount = probeStage >= 1 ? 12 + Math.min(6, (probeStage - 1) * 2) : 0;
  const probeTrustDiscount = probeStage >= 1 ? 8 : 0;
  const probeLoyaltyDiscount = probeStage >= 1 ? 2 : 0;
  const probeAffectionDiscount = probeStage >= 1 ? 1 : 0;
  const probeRatingDiscount = probeStage >= 1 ? 12 + Math.min(6, (probeStage - 1) * 2) : 0;
  const inclinationScoreDiscount = Math.min(12, inclination * 3);
  const inclinationTrustDiscount = Math.min(6, inclination);
  const inclinationLoyaltyDiscount = Math.min(2, Math.floor(inclination / 2));
  const inclinationAffectionDiscount = inclination >= 4 ? 1 : 0;
  const inclinationRatingDiscount = Math.min(12, inclination * 2);

  return {
    score: Math.max(18, Number(recruit.minScore || 0) - probeScoreDiscount - inclinationScoreDiscount),
    trust: Math.max(6, Number(recruit.minTrust || 0) - probeTrustDiscount - inclinationTrustDiscount),
    loyalty: Math.max(1, Number(recruit.minLoyalty || 0) - probeLoyaltyDiscount - inclinationLoyaltyDiscount),
    affection: Math.max(0, Number(recruit.minAffection || 0) - probeAffectionDiscount - inclinationAffectionDiscount),
    strategyRating: Math.max(36, Number(recruit.minStrategyRating || 0) - probeRatingDiscount - inclinationRatingDiscount),
    martialRating: Math.max(36, Number(recruit.minMartialRating || 0) - probeRatingDiscount - inclinationRatingDiscount),
    probeStage,
    inclination
  };
}

function recruitRequirementsForRole(relation, role) {
  const score = roleScoreForRelation(relation, role);
  const thresholds = recruitThresholdsForRole(relation, role);
  const requirements = [];
  requirements.push(stateRequirement('����̽����', thresholds.probeStage >= 1));
  requirements.push(stateRequirement('������˴�����', relationVisibleEnoughForRetinue(relation)));
  requirements.push(stateRequirement(`�����ǩ����${role ? role.name : '��ְ˾'}`, roleMatchesRelationTags(relation, role)));
  if (thresholds.inclination > 0) requirements.push(statRequirement('��ļ����', thresholds.inclination, 1));
  if (thresholds.score > 0) requirements.push(statRequirement('���϶�', score, thresholds.score));
  if (thresholds.trust > 0) requirements.push(statRequirement('����', Number(relation && relation.trust || 0), thresholds.trust));
  if (thresholds.loyalty > 0) requirements.push(statRequirement('�ҳ�', Number(relation && relation.loyalty || 0), thresholds.loyalty));
  if (thresholds.affection > 0) requirements.push(statRequirement('���', Number(relation && relation.affection || 0), thresholds.affection));
  if (thresholds.strategyRating > 0) requirements.push(statRequirement('ı������', Number(relation && relation.strategyRating || 0), thresholds.strategyRating));
  if (thresholds.martialRating > 0) requirements.push(statRequirement('��������', Number(relation && relation.martialRating || 0), thresholds.martialRating));
  return requirements;
}

function recruitAccessForRole(relation, role) {
  return buildAccess(
    recruitRequirementsForRole(relation, role),
    `${relation && relation.name ? relation.name : '����'}���»�û����ʽ��ӵ�ʱ���Ȱѻ�ͷ���ȣ������Ρ���������϶���������һ�㡣`
  );
}

function relationCanRecruitForRole(state, relation, role) {
  if (!state || !relation || !role) return false;
  if (!relation.id || !relation.name) return false;
  if (memberByRelationId(state, relation.id)) return false;
  const retinue = ensureRetinueState(state);
  if (ensureList(retinue.members).length >= Number(retinue.capacity || RETINUE_DEFAULTS.capacity)) return false;
  if (!relationVisibleEnoughForRetinue(relation)) return false;
  return recruitAccessForRole(relation, role).unlocked;
}

function inferRecruitableRoles(state, relation) {
  return RETINUE_ROLE_DEFINITIONS
    .filter((role) => relationCanRecruitForRole(state, relation, role))
    .map((role) => ({ role, score: roleScoreForRelation(relation, role) }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.role);
}

function assignedRelationForRole(state, roleId) {
  const retinue = ensureRetinueState(state);
  const relationId = String((retinue.assignments || {})[roleId] || '');
  return relationId ? relationById(state, relationId) : null;
}

function actionDomain(action) {
  const kind = String(action && action.kind || '');
  if (['govern', 'trade', 'sect'].includes(kind)) return '经营';
  if (['diplomacy', 'investigate', 'intrigue', 'social'].includes(kind)) return '谋略';
  if (['martial', 'jianghu', 'rest', 'travel'].includes(kind)) return '江湖';
  if (['military', 'battle', 'warpath'].includes(kind)) return '军旅';
  return '';
}

function appointedRolesForDomain(state, action) {
  const domain = actionDomain(action);
  return RETINUE_ROLE_DEFINITIONS.filter((role) => role.domain === domain && assignedRelationForRole(state, role.id));
}

function roleSupportDeltaForAction(role, action) {
  if (!role || !action) return {};
  const support = role.supportDelta || {};
  if (action.mode && support[action.mode]) return support[action.mode];
  if (action.kind && support[action.kind]) return support[action.kind];
  return {};
}

function summarizeRoleContribution(state, action, roles) {
  const fragments = ensureList(roles).map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    if (!relation) return '';
    if (role.domain === '经营') return `${relation.name}替我压住${role.slotLabel}`;
    if (role.domain === '谋略') return `${relation.name}替我盯住${role.slotLabel}`;
    if (role.domain === '江湖') return `${relation.name}已经先一步出去探路`;
    if (role.domain === '军旅') return `${relation.name}替我扛住${role.slotLabel}`;
    return `${relation.name}替我接应`;
  }).filter(Boolean);
  if (!fragments.length) return '';
  return `这一回里，${fragments.join('，')}。`;
}

function summarizeRoleContribution(state, action, roles) {
  const fragments = ensureList(roles).map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    if (!relation) return '';
    if (role.domain === '经营') return `${relation.name}先替我理顺${role.slotLabel}的账与后手，递来几句稳妥建议`;
    if (role.domain === '谋略') return `${relation.name}把${role.slotLabel}上的线头先梳开，低声提醒我先防哪一手`;
    if (role.domain === '江湖') return `${relation.name}先替我放风探路，把可疑动静和可走门路回报上来`;
    if (role.domain === '军旅') return `${relation.name}先替我稳住${role.slotLabel}的阵脚，提醒我别在哪个口子上失手`;
    return `${relation.name}先替我把前后的照应接住，递来一两句可用的判断`;
  }).filter(Boolean);
  if (!fragments.length) return '';
  return `临动手前，${fragments.join('；')}。`;
}

function applyRetinuePassiveBonus(state, action, delta) {
  const roles = appointedRolesForDomain(state, action);
  if (!roles.length) return { delta: cloneDelta(delta || {}), line: '' };
  let next = cloneDelta(delta || {});
  roles.forEach((role) => {
    next = mergeDelta(next, roleSupportDeltaForAction(role, action));
  });
  return {
    delta: next,
    line: summarizeRoleContribution(state, action, roles)
  };
}

function summarizeDeltaLine(delta) {
  const statLabels = {
    governance: '����',
    commerce: '����',
    diplomacy: '�⽻',
    military: '����',
    strategy: 'ı��',
    martialLevel: '��ѧ',
    martialInsight: '���',
    health: '���',
    fatigue: 'ƣ��',
    morale: 'ʿ��',
    renown: '����',
    influence: '����',
    troops: '����',
    supplies: '����',
    coins: 'Ǯ��',
    jianghuPrestige: '��������',
    battlefieldPrestige: 'ս������',
    sectFavor: '�������',
    sectPower: '��������'
  };
  return Object.keys(delta || {}).reduce((parts, key) => {
    const value = Number(delta[key] || 0);
    if (!value) return parts;
    parts.push(`${statLabels[key] || key}${value > 0 ? '+' : ''}${value}`);
    return parts;
  }, []).join('��');
}

function buildTeamParticipantContribution(role) {
  if (!role) return '';
  if (role.domain === '��Ӫ') return `ѹס${role.slotLabel}`;
  if (role.domain === 'ı��') return `��ס${role.slotLabel}`;
  if (role.domain === '����') return '̽������';
  if (role.domain === '����') return `����${role.slotLabel}`;
  return '������Ӧ';
}

function buildTeamRetinueFeedback(state, definition, resolved, teamSupport, totalDelta) {
  const roles = ensureList(teamSupport && teamSupport.roles);
  const participants = roles.map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    return relation ? {
      relationId: relation.id || '',
      name: relation.name || relation.id || '',
      roleId: role.id || '',
      roleName: role.name || role.id || '',
      slotLabel: role.slotLabel || '',
      contribution: buildTeamParticipantContribution(role)
    } : null;
  }).filter(Boolean);
  const supportBonuses = roles.map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    const delta = roleSupportDeltaForAction(role, { kind: definition.kind, mode: definition.id });
    const deltaLine = summarizeDeltaLine(delta);
    if (!relation || !deltaLine) return null;
    return {
      sourceRoleId: role.id || '',
      sourceRoleName: role.name || role.id || '',
      memberName: relation.name || relation.id || '',
      reason: role.yieldText || '',
      deltaLine,
      delta
    };
  }).filter(Boolean);
  const participantLine = participants.length
    ? participants.map((item) => `${item.name}��${item.slotLabel || item.roleName}`).join('��')
    : '';
  return {
    actionType: definition.id || '',
    actionText: definition.text || '',
    tier: resolved && resolved.tier ? resolved.tier : '',
    participants,
    supportBonuses,
    baseDelta: definition.baseDelta || {},
    synergyDelta: teamSupport && teamSupport.bonus ? teamSupport.bonus : {},
    totalDelta: totalDelta || {},
    summaryTags: [
      definition.text || '���鶯��',
      resolved && resolved.tier === 'great'
        ? 'Эͬȫ��'
        : resolved && resolved.tier === 'good'
          ? 'Эͬ����'
          : resolved && resolved.tier === 'mixed'
            ? '��ǿ��ס'
            : '��ŷ�ɬ'
    ],
    summaryLine: participantLine
      ? `�˻���${participantLine}Эͬ����${definition.text || '���鶯��'}����`
      : `�˻صġ�${definition.text || '���鶯��'}��û���ȶ�Э֧ͬ�㡣`
  };
}

function summarizeRolePool(roleIds) {
  return ensureList(roleIds)
    .map((roleId) => getRoleDefinition(roleId))
    .filter(Boolean)
    .map((role) => role.name)
    .join('、');
}

function buildRecruitProbeChoice(state, relation, roles) {
  const bestRole = ensureList(roles)[0] || null;
  const rolePool = summarizeRolePool(ensureList(roles).map((item) => item.id));
  if (!relation || !bestRole) return null;
  return {
    id: `action:social:${relation.id}:recruit_probe`,
    text: `��̽${relation.name}���`,
    actionText: `action:social:${relation.id}:recruit_probe`,
    hint: rolePool
      ? `${relation.name}�������Ѿ��������ˡ�������̸һ̸��·�͹���������Է�Ը��Ը�⳯${rolePool}�⼸·��������`
      : `${relation.name}�������Ѿ��������ˡ�������̸һ̸��·�͹���������Է��Ƿ�Ը����ֽ�������߷š�`,
    category: '��ļ',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit_probe',
    group: 'recruit',
    groupLabel: '��ļ',
    direction: directionForDomain(bestRole.domain),
    retinueRoleIds: roles.map((item) => item.id),
    requirements: [
      stateRequirement('������˴�����', relationVisibleEnoughForRetinue(relation)),
      stateRequirement(`�ɷ�չΪ${bestRole.name}`, true)
    ]
  };
}

function buildFormalRecruitChoice(relation, roles) {
  const bestRole = ensureList(roles)[0] || null;
  if (!relation || !bestRole) return null;
  const choice = {
    id: `action:social:${relation.id}:recruit`,
    text: `����${relation.name}���`,
    actionText: `action:social:${relation.id}:recruit`,
    hint: `${relation.name}�Ѿ����������ҵ�������ֻҪ����ˣ�������ʽ����Ļ�£�����ְ���á�`,
    category: '��ļ',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit',
    group: 'recruit',
    groupLabel: '��ļ',
    direction: directionForDomain(bestRole.domain),
    retinueRoleIds: roles.map((item) => item.id)
  };
  return applyAccess(choice, recruitAccessForRole(relation, bestRole));
}

function buildRecruitEmptyChoice(state) {
  const memberCount = ensureList(state && state.gameState && state.gameState && state.gameState.retinue && state.gameState.retinue.members).length;
  const reason = memberCount > 0
    ? '���������ﻹû���µĿɷ�չ�����ȼ����ύ�������������������г�Ա���������߲㼶��'
    : '���»�û���㹻�졢�㹻���ϵ���Ը����������߿����Ȱ������������������ס�';
  return {
    id: 'placeholder:recruit:none',
    text: '���޿��ƽ���ļ',
    actionText: 'placeholder:recruit:none',
    hint: reason,
    category: '��ļ',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit_placeholder',
    group: 'recruit',
    groupLabel: '��ļ',
    direction: 'network',
    disabled: true
  };
}

function buildRecruitChoices(state) {
  const retinue = ensureRetinueState(state);
  if (ensureList(retinue.members).length >= Number(retinue.capacity || RETINUE_DEFAULTS.capacity)) {
    return [{
      id: 'placeholder:recruit:full',
      text: '��������',
      actionText: 'placeholder:recruit:full',
      hint: '���±����Ѿ����ˡ����������ˣ����Ȱ����а������á�',
      category: '��ļ',
      actionKind: 'social',
      source: 'fixed',
      actionMode: 'recruit_placeholder',
      group: 'recruit',
      groupLabel: '��ļ',
      direction: 'network',
      disabled: true
    }];
  }

  const built = ensureList(state && state.gameState && state.gameState.relationships)
    .filter((relation) => relationVisibleEnoughForRetinue(relation))
    .filter((relation) => {
      if (!relation || relation.isHistorical !== true) return true;
      return historicalRecruitAccess(state, relation).unlocked;
    })
    .map((relation) => {
      const formalRoles = inferRecruitableRoles(state, relation);
      const potentialRoles = relationPotentialRoles(state, relation);
      const primaryRoles = formalRoles.length ? formalRoles : potentialRoles;
      if (!primaryRoles.length) return null;
      const bestRole = primaryRoles[0];
      const choice = recruitProbeStage(relation) >= 1
        ? buildFormalRecruitChoice(relation, primaryRoles)
        : buildRecruitProbeChoice(state, relation, potentialRoles);
      return Object.assign({}, choice, {
        sortScore: roleScoreForRelation(relation, bestRole)
          + (recruitProbeStage(relation) >= 1 ? 30 : 0)
          + (recruitInclination(relation) * 4)
      });
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0))
    .slice(0, RETINUE_DEFAULTS.recruitChoiceLimit)
    .map((item) => {
      const next = Object.assign({}, item);
      delete next.sortScore;
      return next;
    });

  return built.length ? built : [buildRecruitEmptyChoice(state)];
}

function buildRoleStatusChoice(role, relation) {
  const roleDirection = directionForDomain(role.domain);
  if (relation) {
    return {
      id: `placeholder:appoint:${role.id}:assigned`,
      text: `${role.slotLabel}��${relation.name}�ƹ�`,
      actionText: `placeholder:appoint:${role.id}:assigned`,
      hint: `${role.name}��ǰ����${relation.name}����������Σ���Ҫ��׼���µ��������֡�`,
      category: '��������',
      actionKind: 'govern',
      source: 'fixed',
      actionMode: `appoint_status_${role.id}`,
      group: 'appoint',
      groupLabel: '����',
      direction: roleDirection,
      disabled: true
    };
  }
  return {
    id: `placeholder:appoint:${role.id}:vacant`,
    text: `${role.slotLabel}��ȱ����`,
    actionText: `placeholder:appoint:${role.id}:vacant`,
    hint: `${role.name}��ǰ���˿��Ρ�����������������ӣ����������ְ˾��`,
    category: '��������',
    actionKind: 'govern',
    source: 'fixed',
    actionMode: `appoint_status_${role.id}`,
    group: 'appoint',
    groupLabel: '����',
    direction: roleDirection,
    disabled: true
  };
}

function buildAppointmentChoices(state) {
  ensureRetinueState(state);
  const choices = [];
  RETINUE_ROLE_DEFINITIONS.forEach((role) => {
    const assigned = assignedRelationForRole(state, role.id);
    const candidates = ensureList(state && state.gameState && state.gameState.retinue && state.gameState.retinue.members)
      .map((member) => {
        const relation = relationById(state, member.relationId);
        if (!relation) return null;
        if (!ensureList(member.rolePool).includes(role.id)) return null;
        if (assigned && assigned.id === relation.id) return null;
        return {
          id: `action:govern:${relation.id}:appoint_${role.id}`,
          text: `��${relation.name}��${role.slotLabel}`,
          actionText: `action:govern:${relation.id}:appoint_${role.id}`,
          hint: `${role.name}����${ensureList(role.functions).slice(0, 2).join('��')}��${role.yieldText}`,
          category: '��������',
          actionKind: 'govern',
          source: 'fixed',
          actionMode: `appoint_${role.id}`,
          group: 'appoint',
          groupLabel: '����',
          direction: directionForDomain(role.domain),
          sortScore: roleScoreForRelation(relation, role)
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0));

    if (candidates.length) {
      candidates.forEach((item) => choices.push(item));
    } else {
      choices.push(buildRoleStatusChoice(role, assigned));
    }
  });
  return choices
    .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0))
    .map((item) => {
      const next = Object.assign({}, item);
      delete next.sortScore;
      return next;
    });
}

function teamActionUnlocked(state, definition) {
  return ensureList(definition && definition.requiredRolesAnyOf).some((roleId) => !!assignedRelationForRole(state, roleId));
}

function buildTeamActionChoices(state) {
  return TEAM_ACTION_DEFINITIONS
    .map((item) => ({
      id: `action:${item.kind}:${item.id}`,
      text: item.text,
      actionText: `action:${item.kind}:${item.id}`,
      hint: item.hint,
      category: '���鶯��',
      actionKind: item.kind,
      source: 'fixed',
      actionMode: item.id,
      group: 'team',
      groupLabel: '���鶯��',
      direction: directionForKind(item.kind),
      disabled: !teamActionUnlocked(state, item),
      requirements: ensureList(item.requiredRolesAnyOf).map((roleId) => {
        const role = getRoleDefinition(roleId);
        const assigned = assignedRelationForRole(state, roleId);
        const label = role
          ? `${role.name}${assigned ? `(${assigned.name})` : '(δ��λ)'}`
          : `${roleId}(δ��λ)`;
        return stateRequirement(label, !!assigned);
      }),
      lockedReason: !teamActionUnlocked(state, item)
        ? `������鶯����Ҫ�Ȱ�${ensureList(item.requiredRolesAnyOf).map((roleId) => {
          const role = getRoleDefinition(roleId);
          return role ? role.name : roleId;
        }).join(' / ')}�е�����һλ����λ��`
        : ''
    }))
    .slice(0, RETINUE_DEFAULTS.teamChoiceLimit);
}

function buildRetinueInteractionChoices(state) {
  const retinue = ensureRetinueState(state);
  const hasMembers = ensureList(retinue.members).length > 0;
  const lockedReason = hasMembers ? '' : '幕下还没有可点名的人。先把人物真正延揽入队。';
  return [
    {
      id: 'action:social:retinue_talk',
      text: '找幕下某人谈事',
      actionText: 'action:social:retinue_talk',
      hint: '点名一位幕下之人，把眼前的人情、分工或局势当面谈透。',
      category: '队伍动作',
      actionKind: 'social',
      actionMode: 'retinue_talk',
      source: 'fixed',
      targetType: 'relation',
      relationScope: 'retinue',
      group: 'retinue_interaction',
      groupLabel: '幕下往来',
      direction: 'network',
      disabled: !hasMembers,
      lockedReason
    },
    {
      id: 'action:investigate:retinue_counsel',
      text: '向幕下某人问策',
      actionText: 'action:investigate:retinue_counsel',
      hint: '点名一位幕下之人，把当前局势、后手与风险掰开来问。',
      category: '队伍动作',
      actionKind: 'investigate',
      actionMode: 'retinue_counsel',
      source: 'fixed',
      targetType: 'relation',
      relationScope: 'retinue_strategy',
      group: 'retinue_interaction',
      groupLabel: '幕下往来',
      direction: 'strategy',
      disabled: !hasMembers,
      lockedReason
    },
    {
      id: 'action:social:retinue_companion',
      text: '点幕下某人同行',
      actionText: 'action:social:retinue_companion',
      hint: '指定一位幕下成员同行。之后的回合里，他会随着当前事务给出自然反应与补位。',
      category: '队伍动作',
      actionKind: 'social',
      actionMode: 'retinue_companion',
      source: 'fixed',
      targetType: 'relation',
      relationScope: 'retinue',
      group: 'retinue_interaction',
      groupLabel: '幕下往来',
      direction: 'network',
      disabled: !hasMembers,
      lockedReason
    }
  ];
}

function buildRetinueChoiceGroups(state) {
  ensureRetinueState(state);
  return {
    recruitChoices: buildRecruitChoices(state),
    appointmentChoices: buildAppointmentChoices(state),
    interactionChoices: buildRetinueInteractionChoices(state),
    teamChoices: buildTeamActionChoices(state)
  };
}

function findChoiceMeta(state, action) {
  const raw = String(action && action.raw || action && action.actionText || '');
  return ensureList(state && state.choices).find((item) => item && (item.id === raw || item.actionText === raw)) || null;
}

function validateRetinueActionAvailability(state, action) {
  ensureRetinueState(state);
  if (!action) return '';
  if (action.kind === 'social' && action.mode === 'recruit_probe') {
    const relation = relationById(state, action.target);
    if (!relation) return '������ﵱǰ�����ڿ���̽�ķ�Χ�';
    const roles = relationPotentialRoles(state, relation);
    if (!roles.length) return `${relation.name}���»��������ʺ�����һ·��ס�`;
    return '';
  }
  if (action.kind === 'social' && action.mode === 'recruit') {
    const relation = relationById(state, action.target);
    if (!relation) return '������ﵱǰ�����ܱ�������ӡ�';
    const roles = inferRecruitableRoles(state, relation);
    if (!roles.length) return `${relation.name}���»�û�������ɿڣ������Ա�������顣`;
    return '';
  }
  if (
    (action.kind === 'social' && ['retinue_talk', 'retinue_companion'].includes(String(action.mode || '')))
    || (action.kind === 'investigate' && action.mode === 'retinue_counsel')
  ) {
    const relation = relationById(state, action.target);
    const member = memberByRelationId(state, action.target);
    if (!relation || !member) return '这一手只能点名已经入队的幕下成员。';
    return '';
  }
  if (/^appoint_/.test(String(action.mode || ''))) {
    const relation = relationById(state, action.target);
    const member = memberByRelationId(state, action.target);
    const roleId = String(action.mode || '').replace(/^appoint_/, '');
    const role = getRoleDefinition(roleId);
    if (!relation || !member || !role) return '����������ǰ�����ܳ�����';
    if (!ensureList(member.rolePool).includes(roleId)) return `${relation.name}�����ʺϵ���${role ? role.name : '���ְ˾'}��`;
    return '';
  }
  if (getTeamActionDefinition(action.mode || '')) {
    const definition = getTeamActionDefinition(action.mode || '');
    if (!teamActionUnlocked(state, definition)) return '���ﻹû�ж�Ӧְ�ܵ����֣�������鶯����ʱ����������';
  }
  return '';
}

function recruitSummaryLine(relation, roleIds) {
  const poolText = summarizeRolePool(roleIds);
  return `${relation.name}Ը�����������¡��˺���������${poolText || '����'}�е�ְ˾���������������ڴӡ��ɽӴ�������ˡ��ɵ�������`;
}

function recruitProbeSummaryLine(relation, roleIds) {
  const poolText = summarizeRolePool(roleIds);
  return `${relation.name}û�����̵�ͷ��ȴ�Ѿ�����������̸�������·�����ٰ�����������${poolText || '��һ����'}���л�����������£����ס�`;
}

function appointSummaryLine(relation, role) {
  return `${relation.name}������ʽ����${role.name}��λ���ϡ��Ժ���һ·�Ķ��񣬾Ͳ���ֻ����һ����Ӳ����`;
}

function resolveRecruitAction(state, action, relation) {
  const retinue = ensureRetinueState(state);
  const choiceMeta = findChoiceMeta(state, action);
  const roleIds = ensureList(choiceMeta && choiceMeta.retinueRoleIds).length
    ? ensureList(choiceMeta.retinueRoleIds)
    : inferRecruitableRoles(state, relation).map((item) => item.id);
  if (!relation || !roleIds.length) return null;
  retinue.members.push({
    relationId: relation.id,
    joinedTurn: Number(state && state.world && state.world.turn || 0),
    rolePool: roleIds.slice(0, 3),
    activeRoleId: '',
    active: true
  });
  return {
    overrideBase: true,
    hook: 'Ļ������',
    delta: { influence: 2, morale: 1 },
    summaryBase: recruitSummaryLine(relation, roleIds)
  };
}

function resolveRecruitProbeAction(state, action, relation) {
  const choiceMeta = findChoiceMeta(state, action);
  const roleIds = ensureList(choiceMeta && choiceMeta.retinueRoleIds).length
    ? ensureList(choiceMeta.retinueRoleIds)
    : relationPotentialRoles(state, relation).map((item) => item.id);
  if (!relation || !roleIds.length) return null;
  return {
    overrideBase: true,
    hook: '��̽����',
    delta: { diplomacy: 1, influence: 1, morale: 1 },
    summaryBase: recruitProbeSummaryLine(relation, roleIds)
  };
}

function resolveAppointAction(state, action, relation) {
  const retinue = ensureRetinueState(state);
  const roleId = String(action.mode || '').replace(/^appoint_/, '');
  const role = getRoleDefinition(roleId);
  const member = memberByRelationId(state, relation && relation.id);
  if (!relation || !member || !role) return null;
  const previousRelationId = String(retinue.assignments[roleId] || '');
  if (previousRelationId && previousRelationId !== relation.id) {
    const previousMember = memberByRelationId(state, previousRelationId);
    if (previousMember) previousMember.activeRoleId = '';
  }
  retinue.assignments[roleId] = relation.id;
  member.activeRoleId = roleId;
  return {
    overrideBase: true,
    hook: 'ְ˾����',
    delta: mergeDelta({ influence: 1 }, role.appointDelta || {}),
    summaryBase: appointSummaryLine(relation, role)
  };
}

function teamRoleSupport(state, definition) {
  const roles = ensureList(definition && definition.requiredRolesAnyOf)
    .map((roleId) => getRoleDefinition(roleId))
    .filter((role) => role && assignedRelationForRole(state, role.id));
  let bonus = {};
  roles.forEach((role) => {
    bonus = mergeDelta(bonus, roleSupportDeltaForAction(role, { kind: definition.kind, mode: definition.id }));
  });
  return {
    bonus,
    roles,
    line: summarizeRoleContribution(state, { kind: definition.kind, mode: definition.id }, roles)
  };
}

function resolveTeamAction(state, action, resolved) {
  const definition = getTeamActionDefinition(action.mode || '');
  if (!definition) return null;
  const teamSupport = teamRoleSupport(state, definition);
  const tierText = resolved && resolved.tier === 'great'
    ? '���'
    : resolved && resolved.tier === 'good'
      ? '����'
      : resolved && resolved.tier === 'mixed'
        ? '��ǿ'
        : 'ʧ��';
  const tierBonus = resolved && resolved.tier === 'great'
    ? { influence: 1 }
    : resolved && resolved.tier === 'good'
      ? {}
      : resolved && resolved.tier === 'fail'
        ? { morale: -1 }
        : {};
  const totalDelta = mergeDelta(mergeDelta(definition.baseDelta || {}, teamSupport.bonus || {}), tierBonus);
  return {
    overrideBase: true,
    hook: '����Эͬ',
    delta: totalDelta,
    summaryBase: `${fillTemplate(definition.summaryTemplate, { tierText })}${teamSupport.line}`,
    retinueFeedback: buildTeamRetinueFeedback(state, definition, resolved, teamSupport, totalDelta)
  };
}

function retinueTalkSummaryLine(relation) {
  return `${relation.name}被我单独叫来，把眼前的人情、分工和局势都摊开说透。原先只是在场边帮衬的人，这一步之后更像是真正能一起收拾局面的人。`;
}

function retinueCounselSummaryLine(relation) {
  return `${relation.name}把自己的判断、顾虑和后手都掰开给我看。话说到这一步，已经不是泛泛请教，而是在替我一起接眼前这盘局。`;
}

function retinueCompanionSummaryLine(relation, continued) {
  return continued
    ? `${relation.name}继续随我同行。这条线眼下已经不是偶尔露面，而是要一路看着风声、人物和事态怎么变，再在关键处搭手。`
    : `${relation.name}应声随我同行。往后的路不再只是我一个人往前探，而是有人会贴着眼前事务一起看、一起应、一起补位。`;
}

function resolveRetinueTalkAction(state, relation) {
  if (!relation) return null;
  return {
    overrideBase: true,
    hook: '幕下谈事',
    delta: { diplomacy: 1, morale: 1 },
    summaryBase: retinueTalkSummaryLine(relation)
  };
}

function resolveRetinueCounselAction(state, relation) {
  if (!relation) return null;
  return {
    overrideBase: true,
    hook: '幕下问策',
    delta: { strategy: 1, influence: 1 },
    summaryBase: retinueCounselSummaryLine(relation)
  };
}

function resolveRetinueCompanionAction(state, resolved, relation) {
  const retinue = ensureRetinueState(state);
  if (!relation) return null;
  const continued = String(retinue.companionRelationId || '') === relation.id;
  if (resolved && resolved.tier !== 'fail') {
    retinue.companionRelationId = relation.id;
    retinue.companionSinceTurn = Number(state && state.world && state.world.turn || 0);
  }
  return {
    overrideBase: true,
    hook: '幕下同行',
    delta: resolved && resolved.tier === 'fail'
      ? { morale: -1 }
      : { morale: 1, fatigue: -1 },
    summaryBase: retinueCompanionSummaryLine(relation, continued)
  };
}

function resolveRetinueAction(state, action, resolved, relation) {
  ensureRetinueState(state);
  if (!action || !action.mode) return null;
  if (action.kind === 'social' && action.mode === 'recruit_probe') return resolveRecruitProbeAction(state, action, relation);
  if (action.kind === 'social' && action.mode === 'recruit') return resolveRecruitAction(state, action, relation);
  if (action.kind === 'social' && action.mode === 'retinue_talk') return resolveRetinueTalkAction(state, relation);
  if (action.kind === 'investigate' && action.mode === 'retinue_counsel') return resolveRetinueCounselAction(state, relation);
  if (action.kind === 'social' && action.mode === 'retinue_companion') return resolveRetinueCompanionAction(state, resolved, relation);
  if (/^appoint_/.test(String(action.mode || ''))) return resolveAppointAction(state, action, relation);
  if (getTeamActionDefinition(action.mode || '')) return resolveTeamAction(state, action, resolved);
  return null;
}

function summarizeRetinueForPrompt(state) {
  const retinue = ensureRetinueState(state);
  const members = ensureList(retinue.members).slice(0, 6).map((member) => {
    const relation = relationById(state, member.relationId);
    const role = getRoleDefinition(member.activeRoleId);
    return {
      relationId: member.relationId,
      name: relation ? relation.name || member.relationId : member.relationId,
      activeRoleId: member.activeRoleId || '',
      activeRoleName: role ? role.name : '',
      activeDomain: role ? role.domain : '',
      rolePool: ensureList(member.rolePool).map((roleId) => {
        const matched = getRoleDefinition(roleId);
        return matched ? matched.name : roleId;
      })
    };
  });
  const assignments = Object.keys(retinue.assignments || {}).map((roleId) => {
    const relation = relationById(state, retinue.assignments[roleId]);
    const role = getRoleDefinition(roleId);
    return {
      relationId: relation ? relation.id || retinue.assignments[roleId] : retinue.assignments[roleId],
      roleId,
      roleName: role ? role.name : roleId,
      domain: role ? role.domain : '',
      slotLabel: role ? role.slotLabel : '',
      memberName: relation ? relation.name || retinue.assignments[roleId] : retinue.assignments[roleId],
      functions: ensureList(role && role.functions).slice(0, 3),
      yieldText: role ? role.yieldText : ''
    };
  }).filter((item) => item.memberName);
  const vacantRoles = RETINUE_ROLE_DEFINITIONS
    .filter((role) => !retinue.assignments[role.id])
    .map((role) => ({
      roleId: role.id,
      roleName: role.name,
      domain: role.domain,
      slotLabel: role.slotLabel
    }))
    .slice(0, 6);
  const recruitLeads = buildRecruitChoices(state)
    .filter((item) => item && item.group === 'recruit' && !item.disabled)
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      text: item.text,
      actionMode: item.actionMode,
      hint: item.hint || ''
    }));
  const availableTeamActions = TEAM_ACTION_DEFINITIONS
    .filter((item) => teamActionUnlocked(state, item))
    .map((item) => ({
      id: item.id,
      text: item.text,
      kind: item.kind,
      requiredRoles: ensureList(item.requiredRolesAnyOf).map((roleId) => {
        const role = getRoleDefinition(roleId);
        return role ? role.name : roleId;
      })
    }));
  const capacity = Number(retinue.capacity || RETINUE_DEFAULTS.capacity);
  const memberCount = ensureList(retinue.members).length;
  const assignedCount = assignments.length;
  const vacancyCount = Math.max(0, capacity - memberCount);
  const readiness = assignedCount >= 3
    ? '��׳���'
    : assignedCount >= 1
      ? '���з�ְ'
      : memberCount >= 1
        ? 'Ļ�³���'
        : '���ǵ������';
  const narrativeConstraint = assignedCount >= 2
    ? '������漰��Ӫ��ı�ԡ�������������񣬿���д��Ļ��Эͬ����Эͬ�����ϸ��Ӧ������ְ˾������ƾ�ն���°�ס�'
    : memberCount >= 1
      ? 'Ļ���������ˣ�����δ��ȫ��ְ������д�����桢��Ӧ����̽�԰��֣���Ҫд�ɳ�����������Ļ����ϵ��'
      : '��ǰ�����������Ա���Ϊ������Ҫд�������ڵ�Ļ�ŷֹ�������Эͬ���ȶ�ִ������';
  return {
    capacity,
    memberCount,
    assignedCount,
    vacancyCount,
    readiness,
    narrativeConstraint,
    members,
    assignments,
    vacantRoles,
    recruitLeads,
    availableTeamActions
  };
}

function resolveRecruitAction(state, action, relation) {
  const retinue = ensureRetinueState(state);
  const choiceMeta = findChoiceMeta(state, action);
  const roleIds = ensureList(choiceMeta && choiceMeta.retinueRoleIds).length
    ? ensureList(choiceMeta.retinueRoleIds)
    : inferRecruitableRoles(state, relation).map((item) => item.id);
  if (!relation || !roleIds.length) return null;
  retinue.members.push({
    relationId: relation.id,
    joinedTurn: Number(state && state.world && state.world.turn || 0),
    rolePool: roleIds.slice(0, 3),
    activeRoleId: '',
    active: true
  });
  return {
    overrideBase: true,
    hook: 'Ļ������',
    delta: { influence: 2, morale: 1 },
    summaryBase: recruitSummaryLine(relation, roleIds)
  };
}

function resolveRecruitProbeAction(state, action, relation) {
  const choiceMeta = findChoiceMeta(state, action);
  const roleIds = ensureList(choiceMeta && choiceMeta.retinueRoleIds).length
    ? ensureList(choiceMeta.retinueRoleIds)
    : relationPotentialRoles(state, relation).map((item) => item.id);
  if (!relation || !roleIds.length) return null;
  return {
    overrideBase: true,
    hook: '��̽����',
    delta: { diplomacy: 1, influence: 1, morale: 1 },
    summaryBase: recruitProbeSummaryLine(relation, roleIds)
  };
}

function resolveAppointAction(state, action, relation) {
  const retinue = ensureRetinueState(state);
  const roleId = String(action.mode || '').replace(/^appoint_/, '');
  const role = getRoleDefinition(roleId);
  const member = memberByRelationId(state, relation && relation.id);
  if (!relation || !member || !role) return null;
  const previousRelationId = String(retinue.assignments[roleId] || '');
  if (previousRelationId && previousRelationId !== relation.id) {
    const previousMember = memberByRelationId(state, previousRelationId);
    if (previousMember) previousMember.activeRoleId = '';
  }
  retinue.assignments[roleId] = relation.id;
  member.activeRoleId = roleId;
  return {
    overrideBase: true,
    hook: 'ְ˾����',
    delta: mergeDelta({ influence: 1 }, role.appointDelta || {}),
    summaryBase: appointSummaryLine(relation, role)
  };
}

function resolveTeamAction(state, action, resolved) {
  const definition = getTeamActionDefinition(action.mode || '');
  if (!definition) return null;
  const teamSupport = teamRoleSupport(state, definition);
  const tierText = resolved && resolved.tier === 'great'
    ? '���'
    : resolved && resolved.tier === 'good'
      ? '����'
      : resolved && resolved.tier === 'mixed'
        ? '��ǿ'
        : 'ʧ��';
  const tierBonus = resolved && resolved.tier === 'great'
    ? { influence: 1 }
    : resolved && resolved.tier === 'good'
      ? {}
      : resolved && resolved.tier === 'fail'
        ? { morale: -1 }
        : {};
  return {
    overrideBase: true,
    hook: '����Эͬ',
    delta: mergeDelta(mergeDelta(definition.baseDelta || {}, teamSupport.bonus || {}), tierBonus),
    summaryBase: `${fillTemplate(definition.summaryTemplate, { tierText })}${teamSupport.line}`
  };
}

function directionForDomain(domain) {
  if (domain === '经营') return 'governance';
  if (domain === '谋略') return 'strategy';
  if (domain === '江湖') return 'jianghu';
  if (domain === '军旅') return 'military';
  return 'governance';
}

function roleScoreForRelation(relation, role) {
  if (!relation || !role) return -999;
  const tags = tagsOf(relation);
  let score = relationScoreForRecruit(relation);
  const matchedTagCount = ensureList(role.tagsAnyOf).filter((tag) => tags.includes(tag)).length;
  score += matchedTagCount * 8;
  if (role.domain === '谋略') score += Number(relation.strategyRating || 0) * 0.32;
  if (role.domain === '军旅') score += Number(relation.martialRating || 0) * 0.28;
  if (role.domain === '江湖') score += (Number(relation.martialRating || 0) * 0.2) + (tags.includes('travel') ? 6 : 0);
  if (role.domain === '经营') score += (Number(relation.strategyRating || 0) * 0.2) + (tags.includes('mercantile') ? 6 : 0);
  return score;
}

function actionDomain(action) {
  const kind = String(action && action.kind || '');
  if (['govern', 'trade', 'sect'].includes(kind)) return '经营';
  if (['diplomacy', 'investigate', 'intrigue', 'social'].includes(kind)) return '谋略';
  if (['martial', 'jianghu', 'rest', 'travel'].includes(kind)) return '江湖';
  if (['military', 'battle', 'warpath'].includes(kind)) return '军旅';
  return '';
}

function summarizeRoleContribution(state, action, roles) {
  const fragments = ensureList(roles).map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    if (!relation) return '';
    if (role.domain === '经营') return `${relation.name}替我压住${role.slotLabel}`;
    if (role.domain === '谋略') return `${relation.name}替我盯住${role.slotLabel}`;
    if (role.domain === '江湖') return `${relation.name}已经先一步出去探路`;
    if (role.domain === '军旅') return `${relation.name}替我扛住${role.slotLabel}`;
    return `${relation.name}替我接应`;
  }).filter(Boolean);
  if (!fragments.length) return '';
  return `这一回里，${fragments.join('，')}。`;
}

function summarizeRolePool(roleIds) {
  return ensureList(roleIds)
    .map((roleId) => getRoleDefinition(roleId))
    .filter(Boolean)
    .map((role) => role.name)
    .join('、');
}

function buildAccess(requirements, reason = '') {
  const list = ensureList(requirements);
  const unmet = list.filter((item) => item && item.met !== true);
  return {
    unlocked: unmet.length === 0,
    reason: unmet.length ? (reason || unmet.map((item) => item.label || '').filter(Boolean).join('、')) : '',
    requirements: list
  };
}

function probeStageRequirementLabel(stage) {
  const current = Math.max(0, Number(stage || 0));
  const clamped = Math.min(RETINUE_PROBE_STAGE_FORMAL, current);
  return `招揽推进 ${clamped}/${RETINUE_PROBE_STAGE_FORMAL}（${RETINUE_PROBE_STAGE_LABELS[clamped] || '推进中'}）`;
}

function recruitThresholdsForRole(relation, role) {
  const recruit = role && role.recruit ? role.recruit : {};
  const probeStage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
  const inclination = recruitInclination(relation);
  const probeScoreDiscount = [0, 4, 9, 14][probeStage] || 0;
  const probeTrustDiscount = [0, 2, 4, 6][probeStage] || 0;
  const probeLoyaltyDiscount = [0, 0, 1, 2][probeStage] || 0;
  const probeAffectionDiscount = [0, 0, 0, 1][probeStage] || 0;
  const probeRatingDiscount = [0, 4, 8, 12][probeStage] || 0;
  const inclinationScoreDiscount = Math.min(10, inclination * 2);
  const inclinationTrustDiscount = Math.min(5, Math.floor(inclination * 0.75));
  const inclinationLoyaltyDiscount = Math.min(2, Math.floor(inclination / 3));
  const inclinationAffectionDiscount = inclination >= 6 ? 1 : 0;
  const inclinationRatingDiscount = Math.min(8, Math.ceil(inclination * 1.25));

  return {
    score: Math.max(20, Number(recruit.minScore || 0) - probeScoreDiscount - inclinationScoreDiscount),
    trust: Math.max(8, Number(recruit.minTrust || 0) - probeTrustDiscount - inclinationTrustDiscount),
    loyalty: Math.max(2, Number(recruit.minLoyalty || 0) - probeLoyaltyDiscount - inclinationLoyaltyDiscount),
    affection: Math.max(0, Number(recruit.minAffection || 0) - probeAffectionDiscount - inclinationAffectionDiscount),
    strategyRating: Math.max(42, Number(recruit.minStrategyRating || 0) - probeRatingDiscount - inclinationRatingDiscount),
    martialRating: Math.max(42, Number(recruit.minMartialRating || 0) - probeRatingDiscount - inclinationRatingDiscount),
    probeStage,
    inclination
  };
}

function recruitRequirementsForRole(relation, role) {
  const score = roleScoreForRelation(relation, role);
  const thresholds = recruitThresholdsForRole(relation, role);
  const requirements = [];
  requirements.push(stateRequirement(probeStageRequirementLabel(thresholds.probeStage), thresholds.probeStage >= RETINUE_PROBE_STAGE_FORMAL));
  requirements.push(stateRequirement('已与此人搭上线', relationVisibleEnoughForRetinue(relation)));
  requirements.push(stateRequirement(`人物标签契合${role ? role.name : '该职司'}`, roleMatchesRelationTags(relation, role)));
  if (thresholds.inclination > 0) requirements.push(statRequirement('招募倾向', thresholds.inclination, 1));
  if (thresholds.score > 0) requirements.push(statRequirement('契合度', score, thresholds.score));
  if (thresholds.trust > 0) requirements.push(statRequirement('信任', Number(relation && relation.trust || 0), thresholds.trust));
  if (thresholds.loyalty > 0) requirements.push(statRequirement('忠诚', Number(relation && relation.loyalty || 0), thresholds.loyalty));
  if (thresholds.affection > 0) requirements.push(statRequirement('情分', Number(relation && relation.affection || 0), thresholds.affection));
  if (thresholds.strategyRating > 0) requirements.push(statRequirement('谋略资质', Number(relation && relation.strategyRating || 0), thresholds.strategyRating));
  if (thresholds.martialRating > 0) requirements.push(statRequirement('武艺资质', Number(relation && relation.martialRating || 0), thresholds.martialRating));
  return requirements;
}

function recruitAccessForRole(relation, role) {
  return buildAccess(
    recruitRequirementsForRole(relation, role),
    `${relation && relation.name ? relation.name : '此人'}这边还没到正式入队的时候。先把话头、后路和彼此信任再往前推一层。`
  );
}

function buildRecruitProbeChoice(state, relation, roles) {
  const bestRole = ensureList(roles)[0] || null;
  const rolePool = summarizeRolePool(ensureList(roles).map((item) => item.id));
  const stage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
  if (!relation || !bestRole) return null;

  const stageText = (
    stage <= 0 ? `试探${relation.name}口风`
      : stage === 1 ? `再探${relation.name}后路`
        : `与${relation.name}敲定去处`
  );
  const stageHint = (
    stage <= 0
      ? `${relation.name}这边的人情已经有了些起色。先去谈一谈去处和后路，看看对方愿不愿意朝${rolePool || '我的班底'}这边靠。`
      : stage === 1
        ? `${relation.name}已经肯跟我谈条件，但还没把话说死。再把职分和后路说明白一点，才可能从“愿意考虑”走到“愿意入队”。`
        : `${relation.name}这边其实只差最后一层承诺。去把能给的位置、后路和规矩都定下来，就能顺势把人收进来。`
  );
  return {
    id: `action:social:${relation.id}:recruit_probe`,
    text: stageText,
    actionText: `action:social:${relation.id}:recruit_probe`,
    hint: stageHint,
    category: '招募',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit_probe',
    group: 'recruit',
    groupLabel: '招募',
    direction: directionForDomain(bestRole.domain),
    retinueRoleIds: roles.map((item) => item.id),
    requirements: [
      stateRequirement('已与此人搭上线', relationVisibleEnoughForRetinue(relation)),
      stateRequirement(`可发展为${bestRole.name}`, true),
      stateRequirement(probeStageRequirementLabel(stage), true)
    ]
  };
}

function buildFormalRecruitChoice(relation, roles) {
  const bestRole = ensureList(roles)[0] || null;
  const rolePool = summarizeRolePool(ensureList(roles).map((item) => item.id));
  if (!relation || !bestRole) return null;
  const choice = {
    id: `action:social:${relation.id}:recruit`,
    text: `延揽${relation.name}入队`,
    actionText: `action:social:${relation.id}:recruit`,
    hint: rolePool
      ? `${relation.name}已经把入队这件事想清了。只要火候够了，就能正式收入幕下，并在${rolePool}这些方向上分派职司。`
      : `${relation.name}已经把入队这件事想清了。只要点头，就能正式收入幕下。`,
    category: '招募',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit',
    group: 'recruit',
    groupLabel: '招募',
    direction: directionForDomain(bestRole.domain),
    retinueRoleIds: roles.map((item) => item.id)
  };
  return applyAccess(choice, recruitAccessForRole(relation, bestRole));
}

function buildRecruitEmptyChoice(state) {
  const memberCount = ensureList(state && state.gameState && state.gameState.retinue && state.gameState.retinue.members).length;
  const reason = memberCount > 0
    ? '眼下还没有新的可发展人选。可以继续推进现有关系，或者先把幕下成员安排到更高层级。'
    : '眼下还没遇到足够熟、足够契合的对象。先在人情、江湖和探查线上继续铺开，再来招募。';
  return {
    id: 'placeholder:recruit:none',
    text: '暂无可推进招募',
    actionText: 'placeholder:recruit:none',
    hint: reason,
    category: '招募',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit_placeholder',
    group: 'recruit',
    groupLabel: '招募',
    direction: 'network',
    disabled: true
  };
}

function buildRecruitChoices(state) {
  const retinue = ensureRetinueState(state);
  if (ensureList(retinue.members).length >= Number(retinue.capacity || RETINUE_DEFAULTS.capacity)) {
    return [{
      id: 'placeholder:recruit:full',
      text: '招募人数已满',
      actionText: 'placeholder:recruit:full',
      hint: '幕下编制已经满了。要继续招人，先把现有人手安排妥当。',
      category: '招募',
      actionKind: 'social',
      source: 'fixed',
      actionMode: 'recruit_placeholder',
      group: 'recruit',
      groupLabel: '招募',
      direction: 'network',
      disabled: true
    }];
  }

  const built = ensureList(state && state.gameState && state.gameState.relationships)
    .filter((relation) => relationVisibleEnoughForRetinue(relation))
    .filter((relation) => {
      if (!relation || relation.isHistorical !== true) return true;
      return historicalRecruitAccess(state, relation).unlocked;
    })
    .map((relation) => {
      const stage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
      const formalRoles = inferRecruitableRoles(state, relation);
      const potentialRoles = relationPotentialRoles(state, relation);
      const primaryRoles = formalRoles.length ? formalRoles : potentialRoles;
      if (!primaryRoles.length) return null;
      const bestRole = primaryRoles[0];
      const choice = stage >= RETINUE_PROBE_STAGE_FORMAL
        ? buildFormalRecruitChoice(relation, primaryRoles)
        : buildRecruitProbeChoice(state, relation, potentialRoles);
      return Object.assign({}, choice, {
        sortScore: roleScoreForRelation(relation, bestRole) + (stage * 18) + (recruitInclination(relation) * 4)
      });
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0))
    .slice(0, RETINUE_DEFAULTS.recruitChoiceLimit)
    .map((item) => {
      const next = Object.assign({}, item);
      delete next.sortScore;
      return next;
    });

  return built.length ? built : [buildRecruitEmptyChoice(state)];
}

function buildRoleStatusChoice(role, relation) {
  const roleDirection = directionForDomain(role.domain);
  if (relation) {
    return {
      id: `placeholder:appoint:${role.id}:assigned`,
      text: `${role.slotLabel}·${relation.name}在任`,
      actionText: `placeholder:appoint:${role.id}:assigned`,
      hint: `${relation.name}当前已经坐稳${role.name}。若要换手，需要先准备新的接替人选。`,
      category: '任命',
      actionKind: 'govern',
      source: 'fixed',
      actionMode: `appoint_status_${role.id}`,
      group: 'appoint',
      groupLabel: '任命',
      direction: roleDirection,
      disabled: true
    };
  }
  return {
    id: `placeholder:appoint:${role.id}:vacant`,
    text: `${role.slotLabel}暂缺人手`,
    actionText: `placeholder:appoint:${role.id}:vacant`,
    hint: `${role.name}当前无人可任。先延揽合适人物入队，再来安排这个职司。`,
    category: '任命',
    actionKind: 'govern',
    source: 'fixed',
    actionMode: `appoint_status_${role.id}`,
    group: 'appoint',
    groupLabel: '任命',
    direction: roleDirection,
    disabled: true
  };
}

function buildAppointmentChoices(state) {
  ensureRetinueState(state);
  const choices = [];
  RETINUE_ROLE_DEFINITIONS.forEach((role) => {
    const assigned = assignedRelationForRole(state, role.id);
    const candidates = ensureList(state && state.gameState && state.gameState.retinue && state.gameState.retinue.members)
      .map((member) => {
        const relation = relationById(state, member.relationId);
        if (!relation) return null;
        if (!ensureList(member.rolePool).includes(role.id)) return null;
        if (assigned && assigned.id === relation.id) return null;
        return {
          id: `action:govern:${relation.id}:appoint_${role.id}`,
          text: `任${relation.name}掌${role.slotLabel}`,
          actionText: `action:govern:${relation.id}:appoint_${role.id}`,
          hint: `${role.name}主要负责${ensureList(role.functions).slice(0, 2).join('、')}，${role.yieldText}`,
          category: '任命',
          actionKind: 'govern',
          source: 'fixed',
          actionMode: `appoint_${role.id}`,
          group: 'appoint',
          groupLabel: '任命',
          direction: directionForDomain(role.domain),
          sortScore: roleScoreForRelation(relation, role)
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0));

    if (candidates.length) {
      candidates.forEach((item) => choices.push(item));
    } else {
      choices.push(buildRoleStatusChoice(role, assigned));
    }
  });
  return choices
    .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0))
    .map((item) => {
      const next = Object.assign({}, item);
      delete next.sortScore;
      return next;
    });
}

function teamActionUnlocked(state, definition) {
  const assignedCount = ensureList(definition && definition.requiredRolesAnyOf)
    .filter((roleId) => !!assignedRelationForRole(state, roleId))
    .length;
  const minimum = Math.max(1, Number(definition && definition.requiredRoleCount || 1));
  return assignedCount >= minimum;
}

function buildTeamActionChoices(state) {
  return TEAM_ACTION_DEFINITIONS
    .map((item) => {
      const minimum = Math.max(1, Number(item.requiredRoleCount || 1));
      const readyCount = ensureList(item.requiredRolesAnyOf)
        .filter((roleId) => !!assignedRelationForRole(state, roleId))
        .length;
      const unlocked = readyCount >= minimum;
      return {
        id: `action:${item.kind}:${item.id}`,
        text: item.text,
        actionText: `action:${item.kind}:${item.id}`,
        hint: item.hint,
        category: '队伍动作',
        actionKind: item.kind,
        source: 'fixed',
        actionMode: item.id,
        group: 'team',
        groupLabel: '队伍动作',
        direction: directionForKind(item.kind),
        disabled: !unlocked,
        requirements: ensureList(item.requiredRolesAnyOf).map((roleId) => {
          const role = getRoleDefinition(roleId);
          const assigned = assignedRelationForRole(state, roleId);
          const label = role
            ? `${role.name}${assigned ? `（${assigned.name}）` : '（未就位）'}`
            : `${roleId}${assigned ? '' : '（未就位）'}`;
          return stateRequirement(label, !!assigned);
        }),
        lockedReason: !unlocked
          ? `这个队伍动作至少需要 ${minimum} 位对应职司就位，当前只有 ${readyCount} 位。`
          : ''
      };
    })
    .slice(0, RETINUE_DEFAULTS.teamChoiceLimit);
}

function validateRetinueActionAvailability(state, action) {
  ensureRetinueState(state);
  if (!action) return '';
  if (action.kind === 'social' && action.mode === 'recruit_probe') {
    const relation = relationById(state, action.target);
    if (!relation) return '这个人当前不在可试探的范围里。';
    const roles = relationPotentialRoles(state, relation);
    if (!roles.length) return `${relation.name}眼下还看不出适合收入哪一路班底。`;
    return '';
  }
  if (action.kind === 'social' && action.mode === 'recruit') {
    const relation = relationById(state, action.target);
    if (!relation) return '这个人当前还不能被正式延揽。';
    const roles = inferRecruitableRoles(state, relation);
    if (!roles.length) return `${relation.name}这边还没到最后开口的时候，先把关系再做深些。`;
    return '';
  }
  if (/^appoint_/.test(String(action.mode || ''))) {
    const relation = relationById(state, action.target);
    const member = memberByRelationId(state, action.target);
    const roleId = String(action.mode || '').replace(/^appoint_/, '');
    const role = getRoleDefinition(roleId);
    if (!relation || !member || !role) return '这个安排当前还无法成立。';
    if (!ensureList(member.rolePool).includes(roleId)) return `${relation.name}并不适合担任${role ? role.name : '这个职司'}。`;
    return '';
  }
  if (getTeamActionDefinition(action.mode || '')) {
    const definition = getTeamActionDefinition(action.mode || '');
    if (!teamActionUnlocked(state, definition)) {
      const readyCount = ensureList(definition && definition.requiredRolesAnyOf)
        .filter((roleId) => !!assignedRelationForRole(state, roleId))
        .length;
      const minimum = Math.max(1, Number(definition && definition.requiredRoleCount || 1));
      return `队里当前只有 ${readyCount} 位对应职司就位，发动这个队伍动作还需要 ${minimum} 位协同。`;
    }
  }
  return '';
}

function recruitSummaryLine(relation, roleIds) {
  const poolText = summarizeRolePool(roleIds);
  return `${relation.name}愿意进到我这边来。人手和后路都补上之后，${poolText || '多个'}方向的职司都能慢慢派开，队伍也终于更像一支像样的班底。`;
}

function recruitProbeSummaryLine(relation, roleIds) {
  const poolText = summarizeRolePool(roleIds);
  const stage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
  if (stage >= RETINUE_PROBE_STAGE_FORMAL) {
    return `${relation.name}这边的话头和后路都已经谈得差不多了。只要顺一顺最后的规矩，${poolText || '这一路人手'}就能正式收进来。`;
  }
  if (stage >= 2) {
    return `${relation.name}没有立刻点头，却已经肯认真和我谈去处、职分与后路。再往前推一回，这条线就快能真正定局。`;
  }
  return `${relation.name}没有立刻点头，却已经肯认真听我谈条件与后路。若再把这层人情做深，${poolText || '这一路人手'}就有机会真正被我拢进班底。`;
}

function appointSummaryLine(relation, role) {
  return `${relation.name}现在已经正式坐上${role.name}的位置。以后这一线的杂务、缺口和临场变数，就不必只靠我一个人硬扛。`;
}

function summarizeRetinueForPrompt(state) {
  const retinue = ensureRetinueState(state);
  const members = ensureList(retinue.members).slice(0, 6).map((member) => {
    const relation = relationById(state, member.relationId);
    const role = getRoleDefinition(member.activeRoleId);
    return {
      relationId: member.relationId,
      name: relation ? relation.name || member.relationId : member.relationId,
      activeRoleId: member.activeRoleId || '',
      activeRoleName: role ? role.name : '',
      activeDomain: role ? role.domain : '',
      rolePool: ensureList(member.rolePool).map((roleId) => {
        const matched = getRoleDefinition(roleId);
        return matched ? matched.name : roleId;
      })
    };
  });
  const assignments = Object.keys(retinue.assignments || {}).map((roleId) => {
    const relation = relationById(state, retinue.assignments[roleId]);
    const role = getRoleDefinition(roleId);
    return {
      relationId: relation ? relation.id || retinue.assignments[roleId] : retinue.assignments[roleId],
      roleId,
      roleName: role ? role.name : roleId,
      domain: role ? role.domain : '',
      slotLabel: role ? role.slotLabel : '',
      memberName: relation ? relation.name || retinue.assignments[roleId] : retinue.assignments[roleId],
      functions: ensureList(role && role.functions).slice(0, 3),
      yieldText: role ? role.yieldText : ''
    };
  }).filter((item) => item.memberName);
  const vacantRoles = RETINUE_ROLE_DEFINITIONS
    .filter((role) => !retinue.assignments[role.id])
    .map((role) => ({
      roleId: role.id,
      roleName: role.name,
      domain: role.domain,
      slotLabel: role.slotLabel
    }))
    .slice(0, 6);
  const recruitLeads = buildRecruitChoices(state)
    .filter((item) => item && item.group === 'recruit' && !item.disabled)
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      text: item.text,
      actionMode: item.actionMode,
      hint: item.hint || ''
    }));
  const availableTeamActions = TEAM_ACTION_DEFINITIONS
    .filter((item) => teamActionUnlocked(state, item))
    .map((item) => ({
      id: item.id,
      text: item.text,
      kind: item.kind,
      requiredRoles: ensureList(item.requiredRolesAnyOf).map((roleId) => {
        const role = getRoleDefinition(roleId);
        return role ? role.name : roleId;
      })
    }));
  const capacity = Number(retinue.capacity || RETINUE_DEFAULTS.capacity);
  const memberCount = ensureList(retinue.members).length;
  const assignedCount = assignments.length;
  const vacancyCount = Math.max(0, capacity - memberCount);
  const companionRelationId = String(retinue.companionRelationId || '');
  const companion = companionRelationId
    ? members.find((item) => item && item.relationId === companionRelationId) || null
    : null;
  const readiness = assignedCount >= 4
    ? '班底成形'
    : assignedCount >= 2
      ? '已有分职'
      : memberCount >= 1
        ? '幕下初聚'
        : '仍是单打独斗';
  const narrativeConstraint = assignedCount >= 2
    ? '涉及经营、谋略、江湖或军旅的行动时，可以开始明确写出幕下协同：谁在顶前，谁在补位，谁在把后路接住。'
    : memberCount >= 1
      ? '幕下已经开始聚人，但还没分清职能。可以写成有人帮忙探路、接应或压场，但还不到稳定协同的时候。'
      : '当前还没有成形班底，相关推进应以个人行动为主，不要写成完整队伍协同。';
  return {
    capacity,
    memberCount,
    assignedCount,
    vacancyCount,
    readiness,
    narrativeConstraint,
    companionRelationId,
    companionSinceTurn: Number(retinue.companionSinceTurn || 0),
    companion,
    members,
    assignments,
    vacantRoles,
    recruitLeads,
    availableTeamActions
  };
}

function resolveTeamAction(state, action, resolved) {
  const definition = getTeamActionDefinition(action.mode || '');
  if (!definition) return null;
  const teamSupport = teamRoleSupport(state, definition);
  const tierText = resolved && resolved.tier === 'great'
    ? '大成'
    : resolved && resolved.tier === 'good'
      ? '稳成'
      : resolved && resolved.tier === 'mixed'
        ? '勉强成事'
        : '失手';
  const tierBonus = resolved && resolved.tier === 'great'
    ? { influence: 1 }
    : resolved && resolved.tier === 'good'
      ? {}
      : resolved && resolved.tier === 'fail'
        ? { morale: -1 }
        : {};
  const totalDelta = mergeDelta(mergeDelta(definition.baseDelta || {}, teamSupport.bonus || {}), tierBonus);
  return {
    overrideBase: true,
    hook: '队伍协同',
    delta: totalDelta,
    summaryBase: `${fillTemplate(definition.summaryTemplate, { tierText })}${teamSupport.line}`,
    retinueFeedback: buildTeamRetinueFeedback(state, definition, resolved, teamSupport, totalDelta)
  };
}

function buildAccess(requirements, reason = '') {
  const list = ensureList(requirements);
  const unmet = list.filter((item) => item && item.met !== true);
  return {
    unlocked: unmet.length === 0,
    reason: unmet.length ? (reason || unmet.map((item) => item.label || '').filter(Boolean).join('、')) : '',
    requirements: list
  };
}

function directionForDomain(domain) {
  if (domain === '经营') return 'governance';
  if (domain === '谋略') return 'strategy';
  if (domain === '江湖') return 'jianghu';
  if (domain === '军旅') return 'military';
  return 'governance';
}

function directionForKind(kind) {
  if (['govern', 'trade'].includes(kind)) return 'governance';
  if (['social', 'romance', 'diplomacy'].includes(kind)) return 'network';
  if (['investigate', 'intrigue'].includes(kind)) return 'strategy';
  if (['martial', 'sect'].includes(kind)) return 'martial';
  if (['military', 'warpath', 'battle'].includes(kind)) return 'military';
  if (['jianghu', 'spar'].includes(kind)) return 'jianghu';
  if (kind === 'travel') return 'world';
  return 'growth';
}

function probeStageRequirementLabel(current, required = RETINUE_PROBE_STAGE_FORMAL) {
  const value = Math.max(0, Math.min(Number(current || 0), RETINUE_PROBE_STAGE_FORMAL));
  const need = Math.max(1, Math.min(Number(required || RETINUE_PROBE_STAGE_FORMAL), RETINUE_PROBE_STAGE_FORMAL));
  const labels = {
    0: '尚未试探',
    1: '初步试探',
    2: '谈过去处',
    3: '可定后路'
  };
  return `招揽火候 ${value}/${need} · ${labels[value] || '未定'}`;
}

function summarizeDeltaLine(delta) {
  const statLabels = {
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
    charm: '魅力',
    jianghuPrestige: '江湖名望',
    battlefieldPrestige: '战阵威名',
    sectFavor: '门派情分',
    sectPower: '门派势力'
  };
  return Object.keys(delta || {}).reduce((parts, key) => {
    const value = Number((delta || {})[key] || 0);
    if (!value) return parts;
    parts.push(`${statLabels[key] || key}${value > 0 ? '+' : ''}${value}`);
    return parts;
  }, []).join(' · ');
}

function buildTeamParticipantContribution(role) {
  if (!role) return '';
  if (role.domain === '经营') return `稳住${role.slotLabel}`;
  if (role.domain === '谋略') return `补上${role.slotLabel}`;
  if (role.domain === '江湖') return '替我认场探路';
  if (role.domain === '军旅') return `压住${role.slotLabel}`;
  return '替我接应';
}

function buildTeamRetinueFeedback(state, definition, resolved, teamSupport, totalDelta) {
  const roles = ensureList(teamSupport && teamSupport.roles);
  const participants = roles.map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    return relation ? {
      relationId: relation.id || '',
      name: relation.name || relation.id || '',
      roleId: role.id || '',
      roleName: role.name || role.id || '',
      slotLabel: role.slotLabel || '',
      contribution: buildTeamParticipantContribution(role)
    } : null;
  }).filter(Boolean);
  const supportBonuses = roles.map((role) => {
    const relation = assignedRelationForRole(state, role.id);
    const delta = roleSupportDeltaForAction(role, { kind: definition.kind, mode: definition.id });
    const deltaLine = summarizeDeltaLine(delta);
    if (!relation || !deltaLine) return null;
    return {
      sourceRoleId: role.id || '',
      sourceRoleName: role.name || role.id || '',
      memberName: relation.name || relation.id || '',
      reason: role.yieldText || '',
      deltaLine,
      delta
    };
  }).filter(Boolean);
  const participantLine = participants.length
    ? participants.map((item) => `${item.name}守${item.slotLabel || item.roleName}`).join('、')
    : '';
  const tierLabel = resolved && resolved.tier === 'great'
    ? '协同极顺'
    : resolved && resolved.tier === 'good'
      ? '协同成局'
      : resolved && resolved.tier === 'mixed'
        ? '勉强撑住'
        : '协同失手';
  return {
    actionType: definition.id || '',
    actionText: definition.text || '',
    tier: resolved && resolved.tier ? resolved.tier : '',
    participants,
    supportBonuses,
    baseDelta: definition.baseDelta || {},
    synergyDelta: teamSupport && teamSupport.bonus ? teamSupport.bonus : {},
    totalDelta: totalDelta || {},
    summaryTags: [definition.text || '队伍动作', tierLabel],
    summaryLine: participantLine
      ? `这一回由${participantLine}一起把“${definition.text || '队伍动作'}”压成了实效。`
      : `这一回“${definition.text || '队伍动作'}”没有真正吃上幕下协同。`
  };
}

function recruitJourneyOf(relation) {
  const raw = relation && relation.retinueRecruitJourney && typeof relation.retinueRecruitJourney === 'object'
    ? relation.retinueRecruitJourney
    : {};
  return {
    rapport: Math.max(0, Number(raw.rapport || 0)),
    counsel: Math.max(0, Number(raw.counsel || 0)),
    diplomacy: Math.max(0, Number(raw.diplomacy || 0)),
    trade: Math.max(0, Number(raw.trade || 0)),
    warpath: Math.max(0, Number(raw.warpath || 0)),
    logistics: Math.max(0, Number(raw.logistics || 0)),
    martial: Math.max(0, Number(raw.martial || 0)),
    jianghu: Math.max(0, Number(raw.jianghu || 0)),
    historical: Math.max(0, Number(raw.historical || 0)),
    probe: Math.max(0, Number(raw.probe || 0)),
    promise: Math.max(0, Number(raw.promise || 0)),
    bond: Math.max(0, Number(raw.bond || 0)),
    teamwork: Math.max(0, Number(raw.teamwork || 0))
  };
}

function recruitJourneyCount(journey, keys) {
  return ensureList(keys).reduce((total, key) => total + Number((journey || {})[key] || 0), 0);
}

function recruitBlueprintFor(relation, role) {
  const journey = recruitJourneyOf(relation);
  const tags = tagsOf(relation);
  const strategyRating = Number(relation && relation.strategyRating || 0);
  const martialRating = Number(relation && relation.martialRating || 0);
  const friendlyBond = ['advisor', 'confidant', 'lover'].includes(String(relation && relation.bondKey || ''));
  const cautious = relation && (relation.isHistorical === true || Number(relation.rivalry || 0) >= 20);
  let label = '看人看事';
  let summary = '先把去处、后路与能接的差事谈实，这人才会认真考虑入队。';
  let requiredProbeStage = cautious ? 3 : 2;
  let requiredInclination = cautious ? 2 : 1;
  const extraRequirements = [];
  const addRequirement = (text, met) => extraRequirements.push(stateRequirement(text, met));

  switch (String(role && role.id || '')) {
    case 'steward':
      label = '经手实事';
      summary = '这类人不吃空口招呼，得真让他经手过钱粮、仓口或后路。';
      addRequirement('一起经手过钱粮、仓口或后路至少两回', recruitJourneyCount(journey, ['trade', 'logistics', 'rapport']) >= 2 || journey.teamwork >= 1);
      break;
    case 'quartermaster':
      label = '后路同担';
      summary = '军需人先看你能不能把人手养活，得一起压过补给与后路。';
      addRequirement('一起压过军需、粮道或补给至少两回', recruitJourneyCount(journey, ['logistics', 'warpath', 'trade']) >= 2 || journey.teamwork >= 1);
      break;
    case 'counselor':
      label = '问策入局';
      summary = '谋士要先看到你会接话，至少得有几回问策、翻旧案或当面掰局。';
      addRequirement('至少有两回问策、旧案或进言往来', recruitJourneyCount(journey, ['counsel', 'diplomacy', 'historical']) >= 2);
      break;
    case 'spymaster':
      label = '暗线过手';
      summary = '这类人得先和你一起放过风、追过线、摸过暗路。';
      addRequirement('至少有两回探线、问策或史线追查', recruitJourneyCount(journey, ['counsel', 'jianghu', 'historical']) >= 2);
      break;
    case 'scout':
      label = '共历风声';
      summary = '江湖耳目先看你会不会认场和认人，得一起摸过路数。';
      addRequirement('至少有两回摸路、探口风或踩点往来', recruitJourneyCount(journey, ['jianghu', 'counsel', 'rapport']) >= 2);
      break;
    case 'escort':
      label = '并肩试手';
      summary = '护行客卿更认一起顶过事的人，得有并肩护场的经历。';
      addRequirement('至少有两回并肩护场、问武或压阵经历', recruitJourneyCount(journey, ['martial', 'warpath', 'jianghu']) >= 2);
      break;
    case 'drillmaster':
      label = '营中看成色';
      summary = '教头只服真能压住营中火候的人，得让他看过你在军务或武学上的成色。';
      addRequirement('至少有两回军务、操练或阵前协作', recruitJourneyCount(journey, ['warpath', 'martial', 'logistics']) >= 2);
      break;
    case 'vanguard':
      label = '阵前认主';
      summary = '先锋要看你敢不敢往前顶，光嘴上招揽不够，得一起吃过阵前火。';
      requiredProbeStage = 3;
      requiredInclination = 2;
      addRequirement('至少有两回阵前或武学硬碰的经历', recruitJourneyCount(journey, ['warpath', 'martial']) >= 2);
      break;
    default:
      addRequirement('至少有一回真正谈过去处和后路', journey.rapport + journey.counsel + journey.probe >= 1);
      break;
  }

  if (strategyRating >= martialRating + 10) {
    addRequirement('此人至少真正递过一次判断', recruitJourneyCount(journey, ['counsel', 'diplomacy', 'historical']) >= 1);
  } else if (martialRating >= strategyRating + 10) {
    addRequirement('此人至少和我一起顶过一次场', recruitJourneyCount(journey, ['warpath', 'martial']) >= 1);
  } else if (tags.some((tag) => ['mercantile', 'trade', 'govern'].includes(tag))) {
    addRequirement('至少一起盘过一次钱粮或站位', recruitJourneyCount(journey, ['trade', 'diplomacy', 'logistics']) >= 1);
  } else if (tags.some((tag) => ['shadow', 'travel', 'jianghu'].includes(tag))) {
    addRequirement('至少一起踩过一次暗线或门路', recruitJourneyCount(journey, ['jianghu', 'counsel', 'historical']) >= 1);
  }

  if (relation && relation.isHistorical === true) {
    addRequirement('这条史实人物线已真正接到“已结识”层', isRelationMet(relation));
  }

  if (friendlyBond) {
    requiredProbeStage = Math.max(2, requiredProbeStage - 1);
    requiredInclination = Math.max(1, requiredInclination - 1);
  }

  if (String(relation && relation.bondKey || '') === 'lover') {
    addRequirement('这层情分已经不是普通往来', Number(relation && relation.affection || 0) >= 16 || Number(relation && relation.trust || 0) >= 14);
  }

  return { label, summary, requiredProbeStage, requiredInclination, extraRequirements };
}

function recruitThresholdsForRole(relation, role) {
  const recruit = role && role.recruit ? role.recruit : {};
  const currentProbeStage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
  const inclination = recruitInclination(relation);
  const blueprint = recruitBlueprintFor(relation, role);
  const probeScoreDiscount = [0, 4, 8, 12][currentProbeStage] || 0;
  const probeTrustDiscount = [0, 2, 4, 6][currentProbeStage] || 0;
  const probeLoyaltyDiscount = [0, 0, 1, 2][currentProbeStage] || 0;
  const probeAffectionDiscount = [0, 0, 1, 2][currentProbeStage] || 0;
  const probeRatingDiscount = [0, 4, 8, 10][currentProbeStage] || 0;
  const inclinationScoreDiscount = Math.min(8, inclination * 2);
  const inclinationTrustDiscount = Math.min(5, Math.floor(inclination * 0.75));
  const inclinationLoyaltyDiscount = Math.min(2, Math.floor(inclination / 3));
  const inclinationAffectionDiscount = inclination >= 5 ? 1 : 0;
  const inclinationRatingDiscount = Math.min(6, Math.ceil(inclination));

  return {
    score: Math.max(20, Number(recruit.minScore || 0) - probeScoreDiscount - inclinationScoreDiscount),
    trust: Math.max(8, Number(recruit.minTrust || 0) - probeTrustDiscount - inclinationTrustDiscount),
    loyalty: Math.max(2, Number(recruit.minLoyalty || 0) - probeLoyaltyDiscount - inclinationLoyaltyDiscount),
    affection: Math.max(0, Number(recruit.minAffection || 0) - probeAffectionDiscount - inclinationAffectionDiscount),
    strategyRating: Math.max(42, Number(recruit.minStrategyRating || 0) - probeRatingDiscount - inclinationRatingDiscount),
    martialRating: Math.max(42, Number(recruit.minMartialRating || 0) - probeRatingDiscount - inclinationRatingDiscount),
    currentProbeStage,
    requiredProbeStage: blueprint.requiredProbeStage,
    currentInclination: inclination,
    requiredInclination: blueprint.requiredInclination,
    profileLabel: blueprint.label,
    profileSummary: blueprint.summary,
    extraRequirements: blueprint.extraRequirements
  };
}

function recruitRequirementsForRole(relation, role) {
  const score = roleScoreForRelation(relation, role);
  const thresholds = recruitThresholdsForRole(relation, role);
  const requirements = [];
  requirements.push(stateRequirement(probeStageRequirementLabel(thresholds.currentProbeStage, thresholds.requiredProbeStage), thresholds.currentProbeStage >= thresholds.requiredProbeStage));
  requirements.push(stateRequirement('已与此人搭上线', relationVisibleEnoughForRetinue(relation)));
  requirements.push(stateRequirement(`人物标签契合${role ? role.name : '该职司'}`, roleMatchesRelationTags(relation, role)));
  if (thresholds.requiredInclination > 0) requirements.push(statRequirement('招募倾向', thresholds.currentInclination, thresholds.requiredInclination));
  if (thresholds.score > 0) requirements.push(statRequirement('契合度', score, thresholds.score));
  if (thresholds.trust > 0) requirements.push(statRequirement('信任', Number(relation && relation.trust || 0), thresholds.trust));
  if (thresholds.loyalty > 0) requirements.push(statRequirement('忠诚', Number(relation && relation.loyalty || 0), thresholds.loyalty));
  if (thresholds.affection > 0) requirements.push(statRequirement('情分', Number(relation && relation.affection || 0), thresholds.affection));
  if (thresholds.strategyRating > 0) requirements.push(statRequirement('谋略资质', Number(relation && relation.strategyRating || 0), thresholds.strategyRating));
  if (thresholds.martialRating > 0) requirements.push(statRequirement('武艺资质', Number(relation && relation.martialRating || 0), thresholds.martialRating));
  return requirements.concat(ensureList(thresholds.extraRequirements));
}

function recruitAccessForRole(relation, role) {
  const thresholds = recruitThresholdsForRole(relation, role);
  return buildAccess(
    recruitRequirementsForRole(relation, role),
    `${relation && relation.name ? relation.name : '此人'}这边还没到正式入队的时候。先把“${thresholds.profileLabel}”这层火候做实，再谈最后的开口。`
  );
}

function buildRecruitProbeChoice(state, relation, roles) {
  const bestRole = ensureList(roles)[0] || null;
  if (!relation || !bestRole) return null;
  const rolePool = summarizeRolePool(ensureList(roles).map((item) => item.id));
  const thresholds = recruitThresholdsForRole(relation, bestRole);
  const stage = thresholds.currentProbeStage;
  const stageText = stage <= 0
    ? `试探${relation.name}口风`
    : stage === 1
      ? `再谈${relation.name}去处`
      : `把${relation.name}的后路谈定`;
  return {
    id: `action:social:${relation.id}:recruit_probe`,
    text: stageText,
    actionText: `action:social:${relation.id}:recruit_probe`,
    hint: `${thresholds.profileSummary}${rolePool ? ` 这人更适合往${rolePool}这一路收。` : ''}`,
    category: '招募',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit_probe',
    group: 'recruit',
    groupLabel: '招募',
    direction: directionForDomain(bestRole.domain),
    retinueRoleIds: roles.map((item) => item.id),
    recruitProfileLabel: thresholds.profileLabel,
    recruitProfileSummary: thresholds.profileSummary,
    requirements: [
      stateRequirement('已与此人搭上线', relationVisibleEnoughForRetinue(relation)),
      stateRequirement(`可发展为${bestRole.name}`, true),
      stateRequirement(probeStageRequirementLabel(stage, thresholds.requiredProbeStage), true)
    ]
  };
}

function buildFormalRecruitChoice(relation, roles) {
  const bestRole = ensureList(roles)[0] || null;
  if (!relation || !bestRole) return null;
  const rolePool = summarizeRolePool(ensureList(roles).map((item) => item.id));
  const thresholds = recruitThresholdsForRole(relation, bestRole);
  const choice = {
    id: `action:social:${relation.id}:recruit`,
    text: `延揽${relation.name}入队`,
    actionText: `action:social:${relation.id}:recruit`,
    hint: `${relation.name}这条招募线已经谈到最后一层。${thresholds.profileSummary}${rolePool ? ` 入队后可先往${rolePool}这一路安置。` : ''}`,
    category: '招募',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit',
    group: 'recruit',
    groupLabel: '招募',
    direction: directionForDomain(bestRole.domain),
    retinueRoleIds: roles.map((item) => item.id),
    recruitProfileLabel: thresholds.profileLabel,
    recruitProfileSummary: thresholds.profileSummary
  };
  return applyAccess(choice, recruitAccessForRole(relation, bestRole));
}

function buildRecruitEmptyChoice(state) {
  const memberCount = ensureList(state && state.gameState && state.gameState.retinue && state.gameState.retinue.members).length;
  const reason = memberCount > 0
    ? '眼下还没有新的可发展人选。继续把现有人物线做深，或先把幕下成员安排到更关键的位置。'
    : '眼下还没遇到足够熟、也足够契合的人。先在人情、江湖、军旅与谋略线上做出真实交集，再来招募。';
  return {
    id: 'placeholder:recruit:none',
    text: '暂无可推进招募',
    actionText: 'placeholder:recruit:none',
    hint: reason,
    category: '招募',
    actionKind: 'social',
    source: 'fixed',
    actionMode: 'recruit_placeholder',
    group: 'recruit',
    groupLabel: '招募',
    direction: 'network',
    disabled: true
  };
}

function buildRecruitChoices(state) {
  const retinue = ensureRetinueState(state);
  if (ensureList(retinue.members).length >= Number(retinue.capacity || RETINUE_DEFAULTS.capacity)) {
    return [{
      id: 'placeholder:recruit:full',
      text: '招募人数已满',
      actionText: 'placeholder:recruit:full',
      hint: '幕下编制已经满了。要继续招人，先把现有人手安排妥当。',
      category: '招募',
      actionKind: 'social',
      source: 'fixed',
      actionMode: 'recruit_placeholder',
      group: 'recruit',
      groupLabel: '招募',
      direction: 'network',
      disabled: true
    }];
  }

  const built = ensureList(state && state.gameState && state.gameState.relationships)
    .filter((relation) => relationVisibleEnoughForRetinue(relation))
    .filter((relation) => {
      if (!relation || relation.isHistorical !== true) return true;
      return historicalRecruitAccess(state, relation).unlocked;
    })
    .map((relation) => {
      const formalRoles = inferRecruitableRoles(state, relation);
      const potentialRoles = relationPotentialRoles(state, relation);
      const primaryRoles = formalRoles.length ? formalRoles : potentialRoles;
      if (!primaryRoles.length) return null;
      const bestRole = primaryRoles[0];
      const journey = recruitJourneyOf(relation);
      const stage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
      const thresholds = recruitThresholdsForRole(relation, bestRole);
      const choice = stage >= thresholds.requiredProbeStage
        ? buildFormalRecruitChoice(relation, primaryRoles)
        : buildRecruitProbeChoice(state, relation, potentialRoles);
      return Object.assign({}, choice, {
        sortScore: roleScoreForRelation(relation, bestRole)
          + (stage * 18)
          + (recruitInclination(relation) * 4)
          + recruitJourneyCount(journey, ['rapport', 'counsel', 'warpath', 'martial', 'trade', 'historical'])
      });
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.sortScore || 0) - Number(a.sortScore || 0))
    .slice(0, RETINUE_DEFAULTS.recruitChoiceLimit)
    .map((item) => {
      const next = Object.assign({}, item);
      delete next.sortScore;
      return next;
    });

  return built.length ? built : [buildRecruitEmptyChoice(state)];
}

function buildRoleStatusChoice(role, relation) {
  const roleDirection = directionForDomain(role.domain);
  if (relation) {
    return {
      id: `placeholder:appoint:${role.id}:assigned`,
      text: `${role.slotLabel}路${relation.name}在任`,
      actionText: `placeholder:appoint:${role.id}:assigned`,
      hint: `${relation.name}当前已经坐稳${role.name}。若要换手，得先备好新的接替人选。`,
      category: '任命',
      actionKind: 'govern',
      source: 'fixed',
      actionMode: `appoint_status_${role.id}`,
      group: 'appoint',
      groupLabel: '任命',
      direction: roleDirection,
      disabled: true
    };
  }
  return {
    id: `placeholder:appoint:${role.id}:vacant`,
    text: `${role.slotLabel}暂缺人手`,
    actionText: `placeholder:appoint:${role.id}:vacant`,
    hint: `${role.name}当前无人可任。先延揽合适人物入队，再来安排这个职司。`,
    category: '任命',
    actionKind: 'govern',
    source: 'fixed',
    actionMode: `appoint_status_${role.id}`,
    group: 'appoint',
    groupLabel: '任命',
    direction: roleDirection,
    disabled: true
  };
}

function buildTeamActionChoices(state) {
  return TEAM_ACTION_DEFINITIONS
    .map((item) => {
      const minimum = Math.max(1, Number(item.requiredRoleCount || 1));
      const readyCount = ensureList(item.requiredRolesAnyOf)
        .filter((roleId) => !!assignedRelationForRole(state, roleId))
        .length;
      const unlocked = readyCount >= minimum;
      return {
        id: `action:${item.kind}:${item.id}`,
        text: item.text,
        actionText: `action:${item.kind}:${item.id}`,
        hint: item.hint,
        category: '队伍动作',
        actionKind: item.kind,
        source: 'fixed',
        actionMode: item.id,
        group: 'team',
        groupLabel: '队伍动作',
        direction: directionForKind(item.kind),
        disabled: !unlocked,
        requirements: ensureList(item.requiredRolesAnyOf).map((roleId) => {
          const role = getRoleDefinition(roleId);
          const assigned = assignedRelationForRole(state, roleId);
          const label = role
            ? `${role.name}${assigned ? `（${assigned.name}在位）` : '（未就位）'}`
            : `${roleId}${assigned ? '' : '（未就位）'}`;
          return stateRequirement(label, !!assigned);
        }),
        lockedReason: !unlocked
          ? `这个队伍动作至少需要${minimum}位对应职司就位，当前只有${readyCount}位。`
          : ''
      };
    })
    .slice(0, RETINUE_DEFAULTS.teamChoiceLimit);
}

function validateRetinueActionAvailability(state, action) {
  ensureRetinueState(state);
  if (!action) return '';
  if (action.kind === 'social' && action.mode === 'recruit_probe') {
    const relation = relationById(state, action.target);
    if (!relation) return '这个人物当前不在可试探的范围里。';
    const roles = relationPotentialRoles(state, relation);
    if (!roles.length) return `${relation.name}眼下还看不出适合收进哪一路班底。`;
    return '';
  }
  if (action.kind === 'social' && action.mode === 'recruit') {
    const relation = relationById(state, action.target);
    if (!relation) return '这个人物当前还不能被正式延揽。';
    const roles = inferRecruitableRoles(state, relation);
    if (!roles.length) return `${relation.name}这边还没到最后开口的时候，先把关系和共同经历做深些。`;
    return '';
  }
  if (/^appoint_/.test(String(action.mode || ''))) {
    const relation = relationById(state, action.target);
    const member = memberByRelationId(state, action.target);
    const roleId = String(action.mode || '').replace(/^appoint_/, '');
    const role = getRoleDefinition(roleId);
    if (!relation || !member || !role) return '这个任命当前还无法成立。';
    if (!ensureList(member.rolePool).includes(roleId)) return `${relation.name}并不适合担任${role ? role.name : '这个职司'}。`;
    return '';
  }
  if (getTeamActionDefinition(action.mode || '')) {
    const definition = getTeamActionDefinition(action.mode || '');
    if (!teamActionUnlocked(state, definition)) {
      const readyCount = ensureList(definition && definition.requiredRolesAnyOf)
        .filter((roleId) => !!assignedRelationForRole(state, roleId))
        .length;
      const minimum = Math.max(1, Number(definition && definition.requiredRoleCount || 1));
      return `队里当前只有${readyCount}位对应职司就位，发动这个队伍动作还需要至少${minimum}位协同。`;
    }
  }
  return '';
}

function recruitSummaryLine(relation, roleIds) {
  const poolText = summarizeRolePool(roleIds);
  return `${relation.name}已经正式入队，先前谈妥的去处、后路和差事终于全都落了地。${poolText ? ` 接下来可优先往${poolText}这一路安置。` : ' 接下来可以开始给他分真正的差事。'}`;
}

function recruitProbeSummaryLine(relation, roleIds) {
  const poolText = summarizeRolePool(roleIds);
  const stage = Math.min(RETINUE_PROBE_STAGE_FORMAL, recruitProbeStage(relation));
  if (stage >= RETINUE_PROBE_STAGE_FORMAL) {
    return `${relation.name}这边的话头和后路已经谈得差不多，只差最后把规矩和位置落死。${poolText ? ` 顺着${poolText}这一路收人，火候正好。` : ''}`;
  }
  if (stage >= 2) {
    return `${relation.name}没有立刻点头，却已经开始认真和我谈去处、职分与后路。再往前推一回，这条线就快能定局。`;
  }
  return `${relation.name}还没有把话说死，但已经肯认真听我谈条件与后路。再把这一层人情做深，招揽才会真正有门。`;
}

function appointSummaryLine(relation, role) {
  return `${relation.name}现在已经正式坐上${role.name}的位置。以后这一线的杂务、缺口和临场变数，就不必只靠我一个人硬扛。`;
}

function summarizeRetinueForPrompt(state) {
  const retinue = ensureRetinueState(state);
  const members = ensureList(retinue.members).slice(0, 6).map((member) => {
    const relation = relationById(state, member.relationId);
    const role = getRoleDefinition(member.activeRoleId);
    return {
      relationId: member.relationId,
      name: relation ? relation.name || member.relationId : member.relationId,
      activeRoleId: member.activeRoleId || '',
      activeRoleName: role ? role.name : '',
      activeDomain: role ? role.domain : '',
      rolePool: ensureList(member.rolePool).map((roleId) => {
        const matched = getRoleDefinition(roleId);
        return matched ? matched.name : roleId;
      })
    };
  });
  const assignments = Object.keys(retinue.assignments || {}).map((roleId) => {
    const relation = relationById(state, retinue.assignments[roleId]);
    const role = getRoleDefinition(roleId);
    return {
      relationId: relation ? relation.id || retinue.assignments[roleId] : retinue.assignments[roleId],
      roleId,
      roleName: role ? role.name : roleId,
      domain: role ? role.domain : '',
      slotLabel: role ? role.slotLabel : '',
      memberName: relation ? relation.name || retinue.assignments[roleId] : retinue.assignments[roleId],
      functions: ensureList(role && role.functions).slice(0, 3),
      yieldText: role ? role.yieldText : ''
    };
  }).filter((item) => item.memberName);
  const vacantRoles = RETINUE_ROLE_DEFINITIONS
    .filter((role) => !retinue.assignments[role.id])
    .map((role) => ({
      roleId: role.id,
      roleName: role.name,
      domain: role.domain,
      slotLabel: role.slotLabel
    }))
    .slice(0, 6);
  const recruitLeads = buildRecruitChoices(state)
    .filter((item) => item && item.group === 'recruit' && !item.disabled)
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      text: item.text,
      actionMode: item.actionMode,
      hint: item.hint || ''
    }));
  const availableTeamActions = TEAM_ACTION_DEFINITIONS
    .filter((item) => teamActionUnlocked(state, item))
    .map((item) => ({
      id: item.id,
      text: item.text,
      kind: item.kind,
      requiredRoles: ensureList(item.requiredRolesAnyOf).map((roleId) => {
        const role = getRoleDefinition(roleId);
        return role ? role.name : roleId;
      })
    }));
  const capacity = Number(retinue.capacity || RETINUE_DEFAULTS.capacity);
  const memberCount = ensureList(retinue.members).length;
  const assignedCount = assignments.length;
  const vacancyCount = Math.max(0, capacity - memberCount);
  const readiness = assignedCount >= 4
    ? '班底成形'
    : assignedCount >= 2
      ? '已见分工'
      : memberCount >= 1
        ? '幕下初聚'
        : '仍是单打独斗';
  const narrativeConstraint = assignedCount >= 2
    ? '涉及经营、谋略、江湖或军旅动作时，可以明确写出幕下协同：谁在顶前，谁在补位，谁在把后路接住。'
    : memberCount >= 1
      ? '幕下已经开始聚人，但还没真正分清职司。可以写成有人帮忙探路、接应或压场，但还不到稳定协同的时候。'
      : '当前还没有成形班底，相关推进应以个人行动为主，不要写成完整队伍协同。';
  return {
    capacity,
    memberCount,
    assignedCount,
    vacancyCount,
    readiness,
    narrativeConstraint,
    members,
    assignments,
    vacantRoles,
    recruitLeads,
    availableTeamActions
  };
}

function resolveRecruitAction(state, action, relation) {
  const retinue = ensureRetinueState(state);
  const choiceMeta = findChoiceMeta(state, action);
  const roleIds = ensureList(choiceMeta && choiceMeta.retinueRoleIds).length
    ? ensureList(choiceMeta.retinueRoleIds)
    : inferRecruitableRoles(state, relation).map((item) => item.id);
  if (!relation || !roleIds.length) return null;
  retinue.members.push({
    relationId: relation.id,
    joinedTurn: Number(state && state.world && state.world.turn || 0),
    rolePool: roleIds.slice(0, 3),
    activeRoleId: '',
    active: true
  });
  return {
    overrideBase: true,
    hook: '幕下添人',
    delta: { influence: 2, morale: 1 },
    summaryBase: recruitSummaryLine(relation, roleIds)
  };
}

function resolveRecruitProbeAction(state, action, relation) {
  const choiceMeta = findChoiceMeta(state, action);
  const roleIds = ensureList(choiceMeta && choiceMeta.retinueRoleIds).length
    ? ensureList(choiceMeta && choiceMeta.retinueRoleIds)
    : relationPotentialRoles(state, relation).map((item) => item.id);
  if (!relation || !roleIds.length) return null;
  return {
    overrideBase: true,
    hook: '试探招揽',
    delta: { diplomacy: 1, influence: 1, morale: 1 },
    summaryBase: recruitProbeSummaryLine(relation, roleIds)
  };
}

function resolveAppointAction(state, action, relation) {
  const retinue = ensureRetinueState(state);
  const roleId = String(action.mode || '').replace(/^appoint_/, '');
  const role = getRoleDefinition(roleId);
  const member = memberByRelationId(state, relation && relation.id);
  if (!relation || !member || !role) return null;
  const previousRelationId = String(retinue.assignments[roleId] || '');
  if (previousRelationId && previousRelationId !== relation.id) {
    const previousMember = memberByRelationId(state, previousRelationId);
    if (previousMember) previousMember.activeRoleId = '';
  }
  retinue.assignments[roleId] = relation.id;
  member.activeRoleId = roleId;
  return {
    overrideBase: true,
    hook: '职司就位',
    delta: mergeDelta({ influence: 1 }, role.appointDelta || {}),
    summaryBase: appointSummaryLine(relation, role)
  };
}

function resolveTeamAction(state, action, resolved) {
  const definition = getTeamActionDefinition(action.mode || '');
  if (!definition) return null;
  const teamSupport = teamRoleSupport(state, definition);
  const tierText = resolved && resolved.tier === 'great'
    ? '大成'
    : resolved && resolved.tier === 'good'
      ? '稳成'
      : resolved && resolved.tier === 'mixed'
        ? '勉强成事'
        : '失手';
  const tierBonus = resolved && resolved.tier === 'great'
    ? { influence: 1 }
    : resolved && resolved.tier === 'good'
      ? {}
      : resolved && resolved.tier === 'fail'
        ? { morale: -1 }
        : {};
  const totalDelta = mergeDelta(mergeDelta(definition.baseDelta || {}, teamSupport.bonus || {}), tierBonus);
  return {
    overrideBase: true,
    hook: '队伍协同',
    delta: totalDelta,
    summaryBase: `${fillTemplate(definition.summaryTemplate, { tierText })}${teamSupport.line}`,
    retinueFeedback: buildTeamRetinueFeedback(state, definition, resolved, teamSupport, totalDelta)
  };
}

module.exports = {
  ensureRetinueState,
  relationCanRecruitForRole,
  buildRetinueChoiceGroups,
  validateRetinueActionAvailability,
  applyRetinuePassiveBonus,
  resolveRetinueAction,
  summarizeRetinueForPrompt,
  recruitProbeStage,
  recruitInclination
};
