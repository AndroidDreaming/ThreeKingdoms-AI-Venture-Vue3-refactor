const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { buildDynamicPlanningBundle } = require('./chronicleV5DynamicPlanning');
const { buildChoiceContext } = require('./chronicleV5ContextAssembler');
const { CITIES } = require('./chronicleV5StateFactory');
const { getProviderCandidates } = require('../config/runtimeConfig');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(list) {
  return Array.from(new Set(ensureList(list).map((item) => String(item || '').trim()).filter(Boolean)));
}

function attachChoiceMeta(list, meta) {
  const next = Array.isArray(list) ? list.slice() : [];
  next.meta = {
    mode: meta && meta.mode ? meta.mode : 'fallback',
    reason: meta && meta.reason ? meta.reason : '',
    detail: meta && meta.detail ? meta.detail : ''
  };
  return next;
}

function normalizeText(value, fallback = '') {
  const text = String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
  return text || fallback;
}

function clipText(value, max = 999) {
  const text = normalizeText(value, '');
  return text.length > max ? text.slice(0, max) : text;
}

function clampNumber(value, min, max, fallback = min) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
}

function inferActionKind(text, fallback = '') {
  const raw = `${text || ''} ${fallback || ''}`;
  if (/(城|太守|政务|民心|治理|经略|经营)/.test(raw)) return 'govern';
  if (/(钱粮|商路|买卖|市井|商贾|补给)/.test(raw)) return 'trade';
  if (/(游说|使者|盟|劝|说客|请见|进言)/.test(raw)) return 'diplomacy';
  if (/(暧昧|心意|私会|情愫|恋|约会)/.test(raw)) return 'romance';
  if (/(武学|招式|练功|拳脚|刀剑|破限)/.test(raw)) return 'martial';
  if (/(军|营|部曲|军令|整军|将|粮道|沙场)/.test(raw)) return 'military';
  if (/(交锋|攻城|迎战|战场|厮杀|鏖战)/.test(raw)) return 'battle';
  if (/(暗线|探|查|旧案|口风|摸底|试探)/.test(raw)) return 'investigate';
  if (/(设局|布局|离间|反咬|借势|谋局|拨动)/.test(raw)) return 'intrigue';
  if (/(休整|静坐|养伤|回气|歇息|缓一缓)/.test(raw)) return 'rest';
  if (/(门派|山门|师门|外门|内门|拜师)/.test(raw)) return 'sect';
  if (/(启程|转道|动身|赶往|奔赴|行路)/.test(raw)) return 'travel';
  if (/(入门|投师|拜入)/.test(raw)) return 'joinsect';
  if (/(投军|从军|军旅|帐下|随军)/.test(raw)) return 'warpath';
  if (/(江湖|客栈|镖局|豪客|路见不平|帮派)/.test(raw)) return 'jianghu';
  if (/(结识|拜会|谈事|同行|问策|走访)/.test(raw)) return 'social';
  return String(fallback || 'social').trim() || 'social';
}

function dynamicCategoryLabel(kind) {
  return {
    govern: '经营',
    trade: '钱粮',
    diplomacy: '人脉',
    social: '人物',
    romance: '情感',
    martial: '武学',
    military: '军务',
    battle: '战局',
    investigate: '暗线',
    intrigue: '谋局',
    rest: '养成',
    sect: '门派',
    travel: '行路',
    joinsect: '入门',
    warpath: '军旅',
    jianghu: '江湖'
  }[kind] || '剧情';
}

const SLOT_ROLES = ['normal', 'moral', 'wild'];

function slotRoleByIndex(index) {
  return SLOT_ROLES[Math.max(0, Math.min(SLOT_ROLES.length - 1, Number(index || 0)))] || 'normal';
}

function normalizeSlotRole(value, fallback = '') {
  const raw = String(value || '').trim().toLowerCase();
  const mapped = {
    normal: 'normal',
    followup: 'normal',
    follow: 'normal',
    mainline: 'normal',
    main: 'normal',
    moral: 'moral',
    dilemma: 'moral',
    ethical: 'moral',
    wildcard: 'wild',
    wild: 'wild'
  }[raw];
  return mapped || (SLOT_ROLES.includes(fallback) ? fallback : '');
}

function normalizeIntent(value, slotRole = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (/(normal|followup|follow|顺势|承接|接住|续上|正路)/.test(raw)) return 'normal';
  if (/(moral|dilemma|ethical|代价|人情|承诺|名声|公义)/.test(raw)) return 'moral';
  if (/(wild|wildcard|risk|冒险|险着|押注|偏锋|奇手|反常理|破格|换路|绕开|侧击)/.test(raw)) return 'wild';
  const role = normalizeSlotRole(slotRole, '');
  if (role === 'normal') return 'normal';
  if (role === 'moral') return 'moral';
  if (role === 'wild') return 'wild';
  return 'normal';
}

function normalizeRisk(value, fallback = 'medium') {
  const raw = String(value || '').trim().toLowerCase();
  if (/(low|低)/.test(raw)) return 'low';
  if (/(high|高)/.test(raw)) return 'high';
  if (/(medium|mid|中)/.test(raw)) return 'medium';
  return fallback;
}

function dynamicSlotRoleLabel(role) {
  return {
    normal: '推进',
    moral: '二难',
    wild: '异想'
  }[normalizeSlotRole(role, 'normal')] || '动作';
}

function dynamicSlotRoleSummary(role) {
  return {
    normal: '顺水推舟。接住眼前的话头或变故，做出最符合当下常理、最能让事态自然向前发展的应对。',
    moral: '进退维谷。设计一个扯动软肋的举动：无论怎么做都会得罪一方，必须在道义、人情、名声或安全之间做痛苦的割肉。',
    wild: '剑走偏锋。跳出常规思维，给出一个狡黠、反常、不按套路出牌的动作，合乎情理但出人意料。'
  }[normalizeSlotRole(role, 'normal')] || '';
}

const EXPERT_THEMES = {
  strategy: { label: '谋局', preferredKinds: ['investigate', 'intrigue', 'diplomacy'], summary: '借暗线、口风、布局和后手去撬动局势。' },
  military: { label: '军略', preferredKinds: ['military', 'battle', 'warpath'], summary: '借军情、粮道、营中站位和部曲去破局。' },
  jianghu: { label: '江湖', preferredKinds: ['jianghu', 'martial', 'travel'], summary: '借江湖名号、恩怨、奇遇和路数把局面从旁撬开。' },
  sect: { label: '武门', preferredKinds: ['sect', 'joinsect', 'martial'], summary: '借门派规矩、山门关系和武学根脚往前推。' },
  relation: { label: '人心', preferredKinds: ['social', 'diplomacy', 'romance'], summary: '借试探、人情、情面和关系深浅把话头落成筹码。' },
  governance: { label: '经营', preferredKinds: ['govern', 'trade', 'travel'], summary: '借钱粮、商路、地盘和秩序把虚势落成底盘。' }
};

function resolveExpertTheme(action, planning) {
  const kind = inferActionKind(action && (action.actionKind || action.kind || action.mode || action.text), '');
  if (['investigate', 'intrigue'].includes(kind)) return EXPERT_THEMES.strategy;
  if (['military', 'battle', 'warpath'].includes(kind)) return EXPERT_THEMES.military;
  if (['jianghu', 'martial'].includes(kind)) return EXPERT_THEMES.jianghu;
  if (['sect', 'joinsect'].includes(kind)) return EXPERT_THEMES.sect;
  if (['social', 'diplomacy', 'romance'].includes(kind)) return EXPERT_THEMES.relation;
  if (['govern', 'trade', 'travel'].includes(kind)) return EXPERT_THEMES.governance;

  const corpus = ensureList(planning && planning.frontiers)
    .slice(0, 8)
    .map((item) => `${item && item.domain || ''} ${item && item.targetName || ''} ${ensureList(item && item.recommendedKinds).join(' ')}`)
    .join(' ');
  if (/(军|粮道|战局|营|将|兵|城防)/.test(corpus)) return EXPERT_THEMES.military;
  if (/(门派|山门|师门|武学)/.test(corpus)) return EXPERT_THEMES.sect;
  if (/(江湖|帮派|客栈|豪客)/.test(corpus)) return EXPERT_THEMES.jianghu;
  if (/(情面|人心|试探|结识|暧昧|盟友)/.test(corpus)) return EXPERT_THEMES.relation;
  if (/(钱粮|商路|仓廪|城务|经营)/.test(corpus)) return EXPERT_THEMES.governance;
  return EXPERT_THEMES.strategy;
}

function hasHighRiskFrontier(session, planning) {
  if (Number(session && session.gameState && session.gameState.fatigue || 0) >= 72) return true;
  if (ensureList(session && session.memory && session.memory.openThreads).some((item) => Number(item && item.urgency || 0) >= 3)) return true;
  return ensureList(planning && planning.frontiers).some((item) => /high|高/.test(String(item && item.risk || '')));
}

function buildDynamicSlotFrames(session, action, planning) {
  const expertTheme = resolveExpertTheme(action, planning);
  const highRisk = hasHighRiskFrontier(session, planning);
  return [
    {
      slotRole: 'normal',
      intent: 'normal',
      label: '推进',
      summary: '顺水推舟。接住眼前的话头或变故，做出最符合当下常理、最能让事态自然向前发展的应对。',
      preferredKinds: uniqueStrings(['social', 'diplomacy', 'investigate'].concat(
        [inferActionKind(action && (action.actionKind || action.kind || action.text), '')].filter(Boolean)
      ))
    },
    {
      slotRole: 'moral',
      intent: 'moral',
      label: '二难',
      summary: `进退维谷。设计一个扯动软肋的举动：无论怎么做都会得罪一方，必须在道义、人情、名声或安全之间做痛苦的割肉。${expertTheme.summary}`,
      preferredKinds: expertTheme.preferredKinds
    },
    {
      slotRole: 'wild',
      intent: 'wild',
      label: '异想',
      summary: highRisk
        ? '火中取栗。抛出一个游走在道德边缘的破局点：但若侥幸成功能斩获奇效或瞬间翻盘。'
        : '剑走偏锋。跳出常规思维，给出一个狡黠、反常、不按套路出牌的动作，合乎情理但出人意料。',
      preferredKinds: highRisk
        ? ['intrigue', 'battle', 'warpath', 'jianghu', 'travel']
        : ['social', 'travel', 'jianghu', 'sect', 'intrigue', 'romance']
    }
  ];
}

function frameMetaByRole(framePlan, role) {
  return ensureList(framePlan).find((item) => normalizeSlotRole(item && item.slotRole, '') === normalizeSlotRole(role, '')) || null;
}

function buildChoiceId(actionText, fallbackKind) {
  const normalized = clipText(actionText, 120) || '未定行动';
  const kind = inferActionKind(normalized, fallbackKind);
  return `dynamic:${kind}:${encodeURIComponent(normalized)}`;
}

const CHOICE_TITLE_STOPWORDS = new Set([
  '当前', '眼下', '局势', '主线', '剧情', '余波', '回响', '后手', '落点', '落账', '破局', '压实', '风声',
  '这局', '这线', '这一手', '这一拍', '此地', '这里', '那里', '人物', '关系', '行动', '选择', '话头', '后续落子',
  '窗口', '去向', '口子', '来人', '紧线', '偏手'
]);

const CITY_NAME_SET = new Set(
  ensureList(CITIES)
    .map((item) => String(item && item.name || '').trim())
    .filter(Boolean)
);

const BAD_DECISION_ANCHOR_EXACT = new Set([
  '邺城',
  '许都',
  '旧朝余烬',
  '前场余烬',
  '旧局余烬',
  '许都朝局起势'
]);

const BAD_DECISION_ANCHOR_PATTERNS = [
  /(?:余烬|起势|前场|前局|旧局|朝局|地面|台面|风口|热场|后场|下一层|这一层)$/,
  /^(?:旧朝|前场|朝局|偏门|地面|台面|窗口)/,
  /(?:借题发酵|试人心|摸一家|试手帖|新起强人)$/,
  /^(?:人物|关系|主线|局势|剧情|风声|来人|紧线|偏手)$/
];

const TEMPLATE_TITLE_PATTERNS = [
  /^压一压$/,
  /^稳一稳$/,
  /^试一试$/,
  /^看一看$/,
  /^等一等$/,
  /^回身接住余波$/,
  /^借偏锋试底牌$/,
  /^换条路撬开局$/,
  /^借.{1,8}余隙(?:落子|行事|试探)?$/,
  /^借.{1,8}缝隙(?:落子|行事|试探)?$/,
  /^借.{1,6}破局$/,
  /^把.{1,8}落账$/,
  /^把.{1,8}压实$/,
  /^落子.{1,8}$/,
  /^寻.{1,8}落点$/,
  /^接住.{1,8}余波$/,
  /^接住这一拍回响$/,
  /^顺手续上后劲$/,
  /^顺势把话坐实$/,
  /^接着把关系做深$/,
  /^后续落子$/,
  /^接着做.{1,8}这线$/,
  /^沿.{1,8}再布一手$/,
  /^沿.{1,8}补上后手$/,
  /^把.{1,8}这线坐稳$/,
  /^围着.{1,10}/,
  /^沿着?.{1,10}/,
  /^从侧面.{1,10}/,
  /^换个口子.{1,10}/,
  /^换条路.{1,10}/,
  /^拿.{1,8}试.{0,6}$/,
  /^借.{1,8}试.{0,6}$/,
  /^借.{1,12}(?:的戏|这出戏|这场戏).{0,6}$/,
  /^换个人去碰.{1,8}$/,
  /^后续行动/,
  /^第\s*\d+\s*个去向/
];

function stableTextHash(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

function pickSeedVariant(seedSource, variants) {
  const list = ensureList(variants).filter(Boolean);
  if (!list.length) return '';
  return list[stableTextHash(seedSource || list[0]) % list.length];
}

function isUnusableDecisionAnchor(value) {
  const text = normalizeText(value, '').replace(/[“”"'《》〈〉【】]/g, '').trim();
  if (!text) return true;
  if (CHOICE_TITLE_STOPWORDS.has(text)) return true;
  if (CITY_NAME_SET.has(text)) return true;
  if (BAD_DECISION_ANCHOR_EXACT.has(text)) return true;
  return BAD_DECISION_ANCHOR_PATTERNS.some((pattern) => pattern.test(text));
}

function genericDecisionAnchor(kind, role = '') {
  const normalizedKind = inferActionKind(kind, kind);
  if (['social', 'diplomacy', 'romance'].includes(normalizedKind)) {
    return role === 'normal' ? '对方' : '这层关系';
  }
  if (['investigate', 'intrigue'].includes(normalizedKind)) {
    return role === 'wild' ? '暗口' : '这层暗线';
  }
  if (['military', 'battle', 'warpath'].includes(normalizedKind)) return '这段军情';
  if (['govern', 'trade'].includes(normalizedKind)) return '这块盘面';
  if (['sect', 'joinsect', 'jianghu', 'martial'].includes(normalizedKind)) return '这条门路';
  if (normalizedKind === 'travel') return '去路';
  return '这一手';
}

function compactChoiceAnchor(value, fallback = '', limit = 8) {
  const text = normalizeText(value, '').replace(/[“”"'《》〈〉【】]/g, '');
  if (!text) return fallback;
  const matches = text.match(/[\u4e00-\u9fff]{2,14}/g) || [];
  for (const item of matches) {
    const candidate = String(item || '')
      .trim()
      .split(/[与和及并或]/)
      .map((part) => String(part || '').trim())
      .map((part) => part.split(/已经|正在|眼下|当前|这回|这一回|刚刚|刚才|可以|需要|继续|先把|把|将|让|会把|会被|会让|还在|仍在|压到|拖到|逼到|摸清|查清|问明|问清|谈实|稳住|补稳|救回/)[0].trim())
      .map((part) => part
        .replace(/^(?:借|拿|把|围着|先给|先稳|先拆|先碰|先补|去见|去找|去探|去问|去会|顺着|沿着|沿|再和|和|同|请|问|探|查|逼|盯住|跟|陪|约|找|给|补|盘活|盘成|绕开|改走|从偏门)/, '')
        .replace(/(?:这摊|这一线|这线|落子|底盘|口风|后手|人心|前哨|钱粮|局面|外路|一句准话|下一层人|背后的人|背后是谁)$/g, '')
        .trim())
      .find((part) => part.length >= 2) || '';
    if (!candidate) continue;
    if (CHOICE_TITLE_STOPWORDS.has(candidate)) continue;
    if (isUnusableDecisionAnchor(candidate)) continue;
    if (/(?:一句准话|下一层人|背后的人|背后是谁|继续往哪边推)$/.test(candidate)) continue;
    if (/^[顺沿追探查问见谈碰摸][\u4e00-\u9fff]{4,}$/.test(candidate)) continue;
    if (/(余波|回响|落点|落账|破局|压实|后手|局势|主线|话头)$/.test(candidate)) continue;
    return candidate.slice(0, limit);
  }
  const cleaned = text.slice(0, limit);
  if (!cleaned || CHOICE_TITLE_STOPWORDS.has(cleaned) || isUnusableDecisionAnchor(cleaned)) return fallback;
  return cleaned;
}

function looksTemplateLikeTitle(value) {
  const text = normalizeText(value, '').replace(/[。！？；：]/g, '').trim();
  if (!text) return true;
  if (CHOICE_TITLE_STOPWORDS.has(text)) return true;
  if (TEMPLATE_TITLE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (/(?:台阁|余隙|缝隙|空档|空隙).*(?:落子|破局|行事|试探)$/.test(text)) return true;
  return /(余波|回响|落点|落账|破局|压实)/.test(text) && text.length <= 10;
}

function isWeakProvidedChoiceTitle(value) {
  const text = normalizeText(value, '').replace(/[。！？；：]/g, '').trim();
  if (!text) return true;
  if (isUnusableDecisionAnchor(text)) return true;
  if (looksTemplateLikeTitle(text)) return true;
  if (text.length <= 4) return true;
  if (/(?:摸一家|再摸一家|压一压|稳一稳|试一试|看一看|等一等)$/.test(text)) return true;
  if (/^借.{1,12}(?:的戏|这出戏|这场戏)/.test(text)) return true;
  return false;
}

function frontierByRole(planning, role) {
  const list = ensureList(planning && planning.frontiers);
  return list.find((item) => ensureList(item && item.slotBiases).includes(role))
    || list.find((item) => item && item.targetName)
    || list[0]
    || null;
}

function deriveChoiceAnchor(frontier, actionText, fallback = '') {
  const safeFallback = isUnusableDecisionAnchor(fallback) ? '' : fallback;
  return compactChoiceAnchor(
    (frontier && frontier.targetName)
      || (frontier && frontier.title)
      || (frontier && frontier.summary)
      || actionText
      || safeFallback,
    safeFallback,
    8
  );
}

function isLikelyPersonName(value) {
  return /^[\u4e00-\u9fff]{2,4}$/.test(String(value || '').trim());
}

function normalizeTitleAnchor(value, fallback = '眼前事') {
  const anchor = compactChoiceAnchor(value, fallback, 8)
    .replace(/^(?:谁在|如何|怎么|那个|这层|这一层|这条|这笔|这件)/, '')
    .replace(/^(?:顺|沿|追|探|查|问|去见|去问|去找)/, '')
    .replace(/(?:的人|的事|这线|这一线|局面|后手|口风|一句准话|下一层人|背后是谁)$/g, '')
    .trim();
  if (!anchor || isUnusableDecisionAnchor(anchor)) return fallback;
  return anchor;
}

function extractDecisionTitleFromActionText(actionText, anchor = '') {
  const text = normalizeText(actionText, '').replace(/[“”"'《》〈〉【】]/g, '');
  if (!text) return '';
  if (/(一句准话|下一层人|背后是谁|继续往哪边推)$/.test(text)) return '';
  const titleBuilders = [
    { pattern: /去见([\u4e00-\u9fff]{2,8})/, build: (match) => `去见${normalizeTitleAnchor(match[1], anchor || '来人')}` },
    { pattern: /去找([\u4e00-\u9fff]{2,8})/, build: (match) => `去找${normalizeTitleAnchor(match[1], anchor || '来人')}` },
    { pattern: /去问([\u4e00-\u9fff]{2,8})/, build: (match) => `去问${normalizeTitleAnchor(match[1], anchor || '来人')}` },
    { pattern: /去摸([\u4e00-\u9fff]{2,16}?)(?:的边|底|路子|门路|态度|反应|$)/, build: (match) => `去摸${normalizeTitleAnchor(match[1], anchor || '底细')}` },
    { pattern: /先查(?:清)?([\u4e00-\u9fff]{2,10})/, build: (match) => `先查${normalizeTitleAnchor(match[1], anchor || '底细')}` },
    { pattern: /查清([\u4e00-\u9fff]{2,10})/, build: (match) => `查清${normalizeTitleAnchor(match[1], anchor || '底细')}` },
    { pattern: /摸清([\u4e00-\u9fff]{2,10})/, build: (match) => `查清${normalizeTitleAnchor(match[1], anchor || '底细')}` },
    { pattern: /先稳([\u4e00-\u9fff]{2,10})/, build: (match) => `先稳${normalizeTitleAnchor(match[1], anchor || '这线')}` },
    { pattern: /先补([\u4e00-\u9fff]{2,10})/, build: (match) => `先补${normalizeTitleAnchor(match[1], anchor || '底盘')}` },
    { pattern: /改走([\u4e00-\u9fff]{2,10})外路/, build: (match) => `改走${normalizeTitleAnchor(match[1], anchor || '外路')}外路` },
    { pattern: /从偏门查([\u4e00-\u9fff]{2,10})/, build: (match) => `从偏门查${normalizeTitleAnchor(match[1], anchor || '底细')}` },
    { pattern: /抢在[^，。；]{0,8}前碰([\u4e00-\u9fff]{2,10})/, build: (match) => `抢先碰${normalizeTitleAnchor(match[1], anchor || '这一线')}` }
  ];

  for (const item of titleBuilders) {
    const matched = text.match(item.pattern);
    if (!matched) continue;
    if (matched[1] && isUnusableDecisionAnchor(matched[1])) continue;
    const built = normalizeChoiceTitle(item.build(matched), '');
    if (built && !looksTemplateLikeTitle(built)) return built;
  }

  const firstClause = text
    .split(/[，。；！？」]/)[0]
    .replace(/^(?:先|再)/, '')
    .replace(/^(?:别沿着明面硬顶|不再围着旧话打转|避开正路上的掣肘|绕开所有人都盯着的正面|不走明面|改从)/, '')
    .replace(/^，/, '')
    .trim();
  const candidate = normalizeChoiceTitle(firstClause, '');
  return looksTemplateLikeTitle(candidate) ? '' : candidate;
}

function contextualTitleVariants(role, kind, anchor) {
  const label = normalizeTitleAnchor(anchor, genericDecisionAnchor(kind, role));
  const person = isLikelyPersonName(label);
  if (['social', 'diplomacy', 'romance'].includes(kind)) {
    if (role === 'wild') return person ? [`绕去见${label}`, `换人去找${label}`] : [`换路去谈${label}`, `绕去问${label}`];
    if (role === 'normal') return person ? [`去见${label}`, `回${label}的话`] : [`去问${label}`, `把${label}谈明`];
    return person ? [`去问${label}`, `逼${label}表态`] : [`把${label}问明`, `先谈${label}`];
  }
  if (['investigate', 'intrigue'].includes(kind)) {
    if (role === 'wild') return [`从偏门查${label}`, `绕去摸${label}`];
    if (role === 'normal') return [`先查${label}`, `追问${label}`];
    return [`查清${label}`, `先拆${label}`];
  }
  if (['military', 'battle', 'warpath'].includes(kind)) {
    if (role === 'wild') return [`抢先碰${label}`, `截住${label}`];
    if (role === 'normal') return [`去问${label}`, `盯住${label}`];
    return [`先稳${label}`, `补住${label}`];
  }
  if (['govern', 'trade'].includes(kind)) {
    if (role === 'wild') return [`改走${label}外路`, `从旁补${label}`];
    if (role === 'normal') return [`先谈${label}`, `去见${label}`];
    return [`先补${label}`, `先稳${label}`];
  }
  return role === 'wild'
    ? [`绕去碰${label}`, `换路查${label}`]
    : [`先办${label}`, `先问${label}`];
}

function composeContextualChoiceTitle(role, kind, anchor, seedSource, actionText = '') {
  const actionLed = extractDecisionTitleFromActionText(actionText, anchor);
  if (actionLed) return actionLed;
  const variants = contextualTitleVariants(role, kind, anchor);
  const fallbackAnchor = normalizeTitleAnchor(anchor, genericDecisionAnchor(kind, role));
  return pickSeedVariant(seedSource, variants) || (fallbackAnchor ? `先办${fallbackAnchor}` : '这一手');
}

function buildTemplateSafeTitle(rawTitle, actionText, actionKind, frontier, role, fallback = '') {
  const normalized = normalizeChoiceTitle(rawTitle, '');
  if (normalized && !looksTemplateLikeTitle(normalized) && !isWeakProvidedChoiceTitle(normalized)) return normalized;
  const safeFallbackAnchor = compactChoiceAnchor(
    fallback || actionText,
    genericDecisionAnchor(actionKind || actionText, role),
    8
  ) || genericDecisionAnchor(actionKind || actionText, role);
  const anchor = deriveChoiceAnchor(frontier, actionText, safeFallbackAnchor);
  return normalizeChoiceTitle(
    composeContextualChoiceTitle(
      role,
      inferActionKind(actionKind || actionText, actionKind),
      anchor,
      `${role}:${actionKind}:${anchor}:${actionText}:${frontier && frontier.id || ''}`,
      actionText
    ),
    fallback || '这一手'
  );
}

function normalizeChoiceTitle(value, fallback) {
  const raw = normalizeText(value, '').replace(/[。！？；：]/g, '').trim();
  if (!raw) return fallback || '这一手';
  const primaryClause = raw.split(/[，、]/).map(item => String(item || '').trim()).filter(Boolean)[0] || raw;
  const cleaned = String(primaryClause)
    .replace(/^(?:正路|代价|奇手|动作[123])(?:[:：\s-])?/, '')
    .replace(/(?:继续往哪边推|下一层人|一句准话|背后是谁)$/g, '')
    .replace(/[“”"'《》〈〉【】]/g, '')
    .trim();
  const text = cleaned.length > 24 ? cleaned.slice(0, 24).trim() : cleaned;
  return text || fallback || '这一手';
}

function normalizeHint(value, fallback) {
  const text = clipText(value, 72).trim();
  return text || fallback || '风声未散，这一手或许能把余波接成新局。';
}

function normalizeEffectObject(effect) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) return null;
  const next = {};
  Object.keys(effect).forEach((key) => {
    const raw = effect[key];
    if (raw === undefined || raw === null || raw === '') return;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      if (raw !== 0) next[key] = Math.round(raw);
      return;
    }
    if (typeof raw === 'boolean') {
      if (raw) next[key] = true;
      return;
    }
    if (typeof raw === 'string') {
      const text = raw.trim();
      if (text) next[key] = text;
      return;
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const nested = Object.keys(raw).reduce((result, nestedKey) => {
        const nestedRaw = raw[nestedKey];
        if (nestedRaw === undefined || nestedRaw === null || nestedRaw === '') return result;
        if (typeof nestedRaw === 'number' && Number.isFinite(nestedRaw)) {
          if (nestedRaw !== 0) result[nestedKey] = Math.round(nestedRaw);
          return result;
        }
        if (typeof nestedRaw === 'string' && nestedRaw.trim()) {
          result[nestedKey] = nestedRaw.trim();
        }
        return result;
      }, {});
      if (Object.keys(nested).length) next[key] = nested;
    }
  });
  return Object.keys(next).length ? next : null;
}

function effectLabel(key) {
  return {
    health_change: '身骨',
    health_gain: '身骨',
    coins_change: '钱财',
    coins_gain: '钱财',
    supplies_change: '粮秣',
    supplies_gain: '粮秣',
    troop_gain: '兵力',
    troops_gain: '兵力',
    morale_change: '士气',
    morale_gain: '士气',
    charm_change: '魅力',
    renown_change: '名望',
    influence_change: '影响',
    relationship_change: '关系',
    fatigue_change: '疲惫',
    skill_used: '战法',
    random_event: '变数'
  }[String(key || '').trim()] || String(key || '').trim();
}

function summarizeEffectPreview(effect) {
  const normalized = normalizeEffectObject(effect);
  if (!normalized) return [];
  const lines = [];
  Object.keys(normalized).forEach((key) => {
    const value = normalized[key];
    if (typeof value === 'number') {
      const sign = value > 0 ? '+' : '';
      lines.push(`${effectLabel(key)}${sign}${value}`);
      return;
    }
    if (key === 'relationship_change' && value && typeof value === 'object') {
      Object.keys(value).slice(0, 2).forEach((name) => {
        const delta = Number(value[name] || 0);
        if (!delta) return;
        const sign = delta > 0 ? '+' : '';
        lines.push(`${name}${sign}${delta}`);
      });
      return;
    }
    if (typeof value === 'string') {
      lines.push(`${effectLabel(key)}：${value}`);
      return;
    }
    if (value === true) {
      lines.push(effectLabel(key));
    }
  });
  return uniqueStrings(lines).slice(0, 4);
}

function summarizeCostPreview(choice, frontier, role, risk) {
  const notes = [];
  const domain = String((choice && choice.category) || (frontier && frontier.domain) || '').trim();
  const normalizedRisk = normalizeRisk(risk || '', role === 'wild' ? 'high' : 'medium');
  const outcomes = uniqueStrings((choice && choice.outcomes) || (frontier && frontier.outcomes) || []);
  const deadlineTurn = Number(frontier && frontier.deadlineTurn || 0);
  const currentTurn = Number(frontier && frontier.currentTurn || 0);
  const turnsLeft = deadlineTurn > 0 ? Math.max(0, deadlineTurn - currentTurn) : 0;

  if (role === 'moral') notes.push('会实打实压掉一层人情、承诺或名声');
  if (role === 'wild') notes.push(normalizedRisk === 'high' ? '失手会直接伤局' : '一旦偏掉就会白白漏手');
  if (normalizedRisk === 'high') notes.push('容易结怨或透支状态');
  else if (normalizedRisk === 'medium') notes.push('会带来明显消耗');

  if (['军旅', '战局'].includes(domain) || outcomes.includes('military')) notes.push('多半要吃粮秣和士气');
  if (['江湖', '武学'].includes(domain) || outcomes.includes('encounter')) notes.push('可能换来伤势或新仇');
  if (['经营', '商路'].includes(domain) || outcomes.includes('resource')) notes.push('先压底盘，回报不会立刻全到手');
  if (['人物', '情感'].includes(domain) || outcomes.includes('relation')) notes.push('关系押错了会反噬');
  if (['谋略', '主线'].includes(domain) || outcomes.includes('plot')) notes.push('一旦放空，后手会被别人先接');
  if (turnsLeft > 0 && turnsLeft <= 2) notes.push(`只剩${turnsLeft}回能接`);

  return uniqueStrings(notes).slice(0, 3);
}

function normalizeChoiceCandidate(choice, index, framePlan, frontier = null, options = {}) {
  if (!choice) return null;
  const role = normalizeSlotRole(choice.slotRole || choice.role, slotRoleByIndex(index)) || slotRoleByIndex(index);
  const frameMeta = frameMetaByRole(framePlan, role) || framePlan[index] || buildDynamicSlotFrames(null, null, null)[index];
  const actionText = normalizeText(choice.actionText || choice.action || choice.plan || choice.command || choice.text || choice.title || '', '');
  const explicitKind = normalizeText(choice.actionKind || choice.kind || '', '');
  const actionKind = explicitKind || inferActionKind(actionText, choice.category || 'social');
  const effect = normalizeEffectObject(choice.effect || choice.effects || choice.impact || null);
  const effectPreview = summarizeEffectPreview(effect);
  const frontierRisk = choice.risk || frontier && frontier.risk || '';
  const rawTitle = options && options.trustProvidedTitle
    ? (choice.text || choice.title || choice.label || '')
    : '';
  let text = '';
  if (options && options.strictProvidedTitle) {
    text = normalizeChoiceTitle(rawTitle, '');
    if (!text) text = normalizeChoiceTitle(actionText, '');
  } else if (options && options.preserveProvidedTitle) {
    text = normalizeChoiceTitle(rawTitle, '');
    if (isWeakProvidedChoiceTitle(text)) {
      const actionLed = extractDecisionTitleFromActionText(
        actionText,
        deriveChoiceAnchor(frontier || choice, actionText, compactChoiceAnchor(actionText, '眼前这局', 8))
      );
      text = normalizeChoiceTitle(actionLed || actionText, '');
    }
    if (isWeakProvidedChoiceTitle(text)) {
      text = buildTemplateSafeTitle(
        '',
        actionText,
        actionKind,
        frontier || choice,
        role,
        normalizeChoiceTitle(actionText, '这一手')
      );
    }
    if (!text) text = normalizeChoiceTitle(actionText, '');
  } else {
    text = buildTemplateSafeTitle(
      rawTitle,
      actionText,
      actionKind,
      frontier || choice,
      role,
      normalizeChoiceTitle(actionText, '这一手')
    );
  }
  if (!text || !actionText) return null;
  return {
    id: buildChoiceId(actionText, actionKind),
    text,
    slot: index,
    prefix: '',
    actionText,
    actionKind,
    hint: normalizeHint(choice.hint || choice.summary || frontier && frontier.reason || '', '风声未散，这一手或许能把余波接成新局。'),
    category: normalizeText(choice.category || choice.domain || dynamicCategoryLabel(actionKind), dynamicCategoryLabel(actionKind)),
    slotRole: role,
    slotRoleLabel: frameMeta && frameMeta.label ? frameMeta.label : `动作${index + 1}`,
    frameSummary: frameMeta && frameMeta.summary ? frameMeta.summary : dynamicSlotRoleSummary(role),
    frameIntent: normalizeIntent(frameMeta && frameMeta.intent || '', role),
    intent: normalizeIntent(choice.intent || '', role),
    risk: normalizeRisk(choice.risk || frontier && frontier.risk || '', role === 'wild' ? 'high' : 'medium'),
    frontierId: normalizeText(choice.frontierId || frontier && frontier.id || '', ''),
    targetId: normalizeText(choice.targetId || choice.target || frontier && frontier.targetId || '', ''),
    targetName: normalizeText(choice.targetName || frontier && frontier.targetName || '', ''),
    targetType: normalizeText(choice.targetType || frontier && frontier.targetType || '', ''),
    noveltyKey: normalizeText(choice.noveltyKey || frontier && frontier.noveltyKey || '', ''),
    outcomes: uniqueStrings(choice.outcomes || frontier && frontier.outcomes || []).slice(0, 4),
    target: normalizeText(choice.target || choice.targetId || frontier && frontier.targetId || '', ''),
    effect,
    effectHints: uniqueStrings((choice.effectHints || []).concat(effectPreview)).slice(0, 4),
    costHints: uniqueStrings((choice.costHints || []).concat(summarizeCostPreview(choice, frontier, role, frontierRisk))).slice(0, 3),
    source: 'dynamic',
    order: index
  };
}

function frontierSourcePriority(source, role) {
  const table = {
    normal: ['consequence', 'unfinished_move', 'promise_debt', 'followup', 'chosen_branch', 'dramatic', 'perception', 'mainline', 'historical', 'fermentation', 'relation', 'attribute', 'planner', 'travel'],
    moral: ['moral_debt', 'promise_debt', 'consequence', 'mainline', 'dramatic', 'historical', 'relation', 'perception', 'attribute', 'planner', 'travel'],
    wild: ['scene_residue', 'rumor_heat', 'shock_tag', 'consequence', 'dramatic', 'perception', 'encounter', 'historical', 'fermentation', 'planner', 'travel', 'mainline']
  };
  const ordered = table[normalizeSlotRole(role, 'normal')] || table.normal;
  const index = ordered.indexOf(String(source || '').trim());
  return index < 0 ? -12 : Math.max(0, 48 - (index * 4));
}

function scoreChoiceForFrame(choice, frameMeta, planning, action, selected) {
  if (!choice || !frameMeta) return -999;
  const kind = inferActionKind(choice.actionKind || choice.actionText, choice.actionKind);
  const corpus = `${choice.text || ''}\n${choice.actionText || ''}\n${choice.hint || ''}\n${choice.category || ''}`;
  let score = 0;

  if (normalizeIntent(choice.intent || '', choice.slotRole) === normalizeIntent(frameMeta.intent || '', frameMeta.slotRole)) score += 24;
  if (ensureList(frameMeta.preferredKinds).includes(kind)) score += 20;
  if (selected.some((item) => inferActionKind(item.actionKind, item.actionKind) === kind)) score -= 18;
  if (selected.some((item) => item.frontierId && item.frontierId === choice.frontierId)) score -= 22;

  const frontier = planning && planning.frontiersById && choice.frontierId ? planning.frontiersById.get(choice.frontierId) : null;
  if (frontier) {
    score += frontierSourcePriority(frontier.source, frameMeta.slotRole);
    if (ensureList(frontier.recommendedKinds).includes(kind)) score += 18;
    if (ensureList(frontier.slotBiases).includes(frameMeta.slotRole)) score += 14;
    score += Math.min(24, Number(frontier.dramaticPriority || 0) * 4);
    if (frontier.dynamicOnly) score += 10;
    if (frontier.routineLike) score -= 16;
  }

  if (frameMeta.intent === 'normal') {
    const actionKind = inferActionKind(action && (action.actionKind || action.kind || action.text), '');
    if (actionKind && kind === actionKind) score += 12;
    if (/(顺势|接住|接实|接着|回身|紧跟|当即|续上)/.test(corpus)) score += 12;
    if (/(请|邀|来见|上门|递话|托|赴约|准话|来人|留话|帖子|口信|当面)/.test(corpus)) score += 14;
    if (choice.targetName) score += 8;
    if (frontier && ['relation', 'extra_character', 'perception', 'fermentation', 'chosen_branch', 'unfinished_move', 'consequence'].includes(frontier.source)) score += 8;
  } else if (frameMeta.intent === 'moral') {
    if (/(牺牲|连累|压掉|背弃|出卖|利用|哄骗|欺瞒|失信|亏欠|名声|公义|承诺|人情)/.test(corpus)) score += 26;
    if (/(为了|换来|代价|哪怕|即便|要拿|要赔上)/.test(corpus)) score += 12;
    if (frontier && ['moral_debt', 'promise_debt', 'consequence', 'mainline'].includes(frontier.source)) score += 14;
  } else if (frameMeta.intent === 'wild') {
    if (/(冒险|偏锋|硬闯|越线|赌一把|险|底牌|逼出|奇手|怪招)/.test(corpus)) score += 14;
    if (/(截|偷|抢|伏|换路|先手|截胡|抢先|偏门|奇货|空门|假借|闹大|反做)/.test(corpus)) score += 12;
    if (frontier && ['scene_residue', 'rumor_heat', 'shock_tag', 'encounter', 'historical', 'perception', 'fermentation'].includes(frontier.source)) score += 10;
  }

  return score;
}

function selectChoicesByFrames(session, action, candidates, planning, limit = 3) {
  const framePlan = buildDynamicSlotFrames(session, action || {}, planning);
  const pool = ensureList(candidates).filter(Boolean);
  const selected = [];
  const usedIds = new Set();

  framePlan.slice(0, limit).forEach((frameMeta, index) => {
    let best = null;
    pool.forEach((item) => {
      if (!item || usedIds.has(item.id)) return;
      const scored = scoreChoiceForFrame(item, frameMeta, planning, action, selected);
      if (!best || scored > best.score) best = { item, score: scored };
    });
    if (!best || !best.item) return;
    usedIds.add(best.item.id);
    selected.push({
      ...best.item,
      slotRole: frameMeta.slotRole,
      slotRoleLabel: frameMeta.label,
      frameSummary: frameMeta.summary,
      frameIntent: frameMeta.intent,
      order: index
    });
  });

  return selected.slice(0, limit);
}

function defaultLocalSeedForFrame(frameMeta, action, planning) {
  const label = frameMeta && frameMeta.label ? frameMeta.label : '剧情';
  const hintBase = frameMeta && frameMeta.summary ? frameMeta.summary : '局势正在等待下一手落下。';
  const firstFrontier = frontierByRole(planning, frameMeta && frameMeta.slotRole || 'normal');
  const actionKind = ensureList(frameMeta && frameMeta.preferredKinds)[0] || inferActionKind(action && action.text, 'social');
  const fallbackAnchor = genericDecisionAnchor(actionKind, frameMeta && frameMeta.slotRole || 'normal');
  const anchor = deriveChoiceAnchor(firstFrontier, action && (action.actionText || action.text || action.raw), fallbackAnchor);
  const seedSource = `${frameMeta && frameMeta.slotRole || 'normal'}:${frameMeta && frameMeta.intent || 'normal'}:${actionKind}:${anchor}:${firstFrontier && firstFrontier.id || ''}`;
  let actionText = `先把${anchor}这件事按住，再看下一手往哪边推。`;
  let hint = hintBase;
  let risk = frameMeta && frameMeta.intent === 'wild' ? 'high' : 'medium';

  if (frameMeta && frameMeta.intent === 'normal') {
    risk = 'low';
    if (['investigate', 'intrigue'].includes(actionKind)) {
      actionText = `去问递话的人，查清${anchor}背后是谁。`;
      hint = '真正先递话的人，往往比闹得最响的人更早知道风往哪边吹。';
    } else if (['social', 'diplomacy', 'romance'].includes(actionKind)) {
      actionText = `去见${anchor}，把态度、条件或情分当面问明。`;
      hint = '人物主动找上门时，值钱的不是热闹，是那句能落地的准话。';
    } else if (['military', 'battle', 'warpath'].includes(actionKind)) {
      actionText = `先问${anchor}这线的军情，把最要紧的一句实话掏出来。`;
      hint = '先来营里递话的人，常常比战报本身更早暴露下一手。';
    } else if (['govern', 'trade'].includes(actionKind)) {
      actionText = `去见管${anchor}的人，把钱粮、人手或商路先谈实。`;
      hint = '有人主动带着路子来时，先把条件问实，比自己四处乱铺更省力。';
    }
  } else if (frameMeta && frameMeta.intent === 'moral') {
    risk = 'medium';
    if (['investigate', 'intrigue'].includes(actionKind)) {
      actionText = `拿${anchor}这线上的人情去换口风，哪怕要把欠谁、骗谁这层账坐实。`;
      hint = '这一步不是单纯冒险，而是明知会欠下一笔脏账，还得硬把它花出去。';
    } else if (['social', 'diplomacy', 'romance'].includes(actionKind)) {
      actionText = `逼${anchor}替你担一层名声或风险，好把眼前这局往前推。`;
      hint = '它真正痛的地方，不在难，而在你得让某个人替这一步垫背。';
    } else if (['military', 'battle', 'warpath'].includes(actionKind)) {
      actionText = `先保${anchor}这一线，但要拿旁人的安稳、名声或承诺去垫这口气。`;
      hint = '要赢这一步，就得清楚是谁替你吃下代价。';
    } else {
      actionText = `把${anchor}先做成，但得压掉一层情义、承诺或公面。`;
      hint = '它不是普通消耗，而是会在人情账上留下清楚伤口。';
    }
  } else if (frameMeta && frameMeta.intent === 'wild') {
    if (['investigate', 'intrigue'].includes(actionKind)) {
      actionText = `从偏门查${anchor}，逼暗处那只手先露面。`;
      hint = '这一手更险，但真要打穿，常常能直接把藏着的人掀出来。';
    } else if (['military', 'battle', 'warpath'].includes(actionKind)) {
      actionText = `抢在众人回手前碰${anchor}，看能不能直接改掉兵势。`;
      hint = '险着不是乱冲，而是在大家都没防到的地方突然把局改过来。';
    } else {
      actionText = `换个场合去碰${anchor}，逼最不愿意动的人先失手。`;
      hint = '这一步会更贵，但也最可能把僵局硬生生撬出裂口。';
    }
  } else {
    if (['investigate', 'intrigue'].includes(actionKind)) {
      actionText = `先查${anchor}背后是谁，再把最碍事的后手拆掉。`;
    } else if (['social', 'diplomacy', 'romance'].includes(actionKind)) {
      actionText = `去问${anchor}一句准话，把态度和条件逼到明面。`;
    } else if (['military', 'battle', 'warpath'].includes(actionKind)) {
      actionText = `先稳${anchor}这线，再补前哨、粮口和兵势。`;
    } else if (['govern', 'trade'].includes(actionKind)) {
      actionText = `先补${anchor}这一块底盘，让钱粮和人手转起来。`;
    } else {
      actionText = `先把${anchor}这件事压住，再决定下一手往哪边推。`;
    }
  }

  const text = normalizeChoiceTitle(
    composeContextualChoiceTitle(
      frameMeta && frameMeta.slotRole || 'normal',
      actionKind,
      anchor,
      seedSource,
      actionText
    ),
    anchor || '这一手'
  );
  return {
    text,
    actionText,
    actionKind,
    hint,
    category: dynamicCategoryLabel(actionKind),
    frontierId: firstFrontier && firstFrontier.id || '',
    targetId: firstFrontier && firstFrontier.targetId || '',
    targetName: firstFrontier && firstFrontier.targetName || '',
    targetType: firstFrontier && firstFrontier.targetType || '',
    intent: frameMeta && frameMeta.intent || 'normal',
    risk
  };
}

function buildLocalDynamicChoices(session, action) {
  if (!session || !session.world || session.world.phase !== 'playing') {
    return attachChoiceMeta([], { mode: 'disabled', reason: 'phase_unavailable', detail: 'local-choice-phase-unavailable' });
  }
  const planning = buildDynamicPlanningBundle(session, action || {});
  const framePlan = buildDynamicSlotFrames(session, action || {}, planning);
  const candidates = [];
  const seen = new Set();

  ensureList(planning.frontiers).forEach((frontier, index) => {
    if (!frontier || !frontier.localChoice) return;
    const normalized = normalizeChoiceCandidate(frontier.localChoice, index, framePlan, frontier, { trustProvidedTitle: true });
    if (!normalized) return;
    const key = `${normalized.id}::${normalized.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  });

  framePlan.forEach((frameMeta, index) => {
    const seed = normalizeChoiceCandidate(defaultLocalSeedForFrame(frameMeta, action, planning), index, framePlan, null, { trustProvidedTitle: true });
    if (!seed) return;
    const key = `${seed.id}::${seed.text}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(seed);
  });

  const selected = selectChoicesByFrames(session, action, candidates, planning, 3);
  return attachChoiceMeta(selected, {
    mode: 'fallback',
    reason: 'local_dynamic_planning',
    detail: `local-frontiers:${ensureList(planning.frontiers).length}|selected:${selected.length}`
  });
}

function buildPromptFrontierDigest(planning, limit = 6) {
  return ensureList(planning && planning.frontiers)
    .slice(0, limit)
    .map((item, index) => {
      const target = item && item.targetName ? ` / ${item.targetName}` : '';
      const source = item && item.source ? item.source : 'planner';
      const risk = item && item.risk ? item.risk : 'unknown';
      const pressure = clipText(item && (item.reason || item.summary || item.title || ''), 60);
      const recommended = ensureList(item && item.recommendedKinds).slice(0, 3).join(', ');
      return `${index + 1}. ${item && item.id || `frontier:${index}`} | ${source}${target} | risk=${risk} | kinds=${recommended || 'auto'} | ${pressure || '无'}`;
    })
    .join('\n');
}

function buildFramePlanDigest(framePlan) {
  return ensureList(framePlan)
    .slice(0, 3)
    .map((frame, index) => `${index + 1}. slotRole=${frame.slotRole}; label=${frame.label}; intent=${frame.intent}; rule=${frame.summary}`)
    .join('\n');
}

function safeStringify(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch (error) {
    return '{}';
  }
}

function buildChoicePrompt(session, action) {
  const planning = buildDynamicPlanningBundle(session, action || {});
  const choiceContext = buildChoiceContext(session, action || {}, null, null, planning);
  return [
    '你是三国题材文字冒险的动态选项生成器。',
    '只返回一个 JSON 对象，格式为 {"choices":[...]}。',
    '生成 3 个动态选项。',
    '本地引擎负责固定玩法、状态结算与事实裁定；你只负责给出真正会因当回剧情而变化的动态动作。',
    '只根据当前回合事实、后果、余波、人物关系和下一步压力来长出三条路。',
    '按三种张力输出三张牌：1. 推动剧情 2. 二难选项 3. 违背常理但有趣。',
    '第一张：顺水推舟。接住眼前的话头或变故，做出最符合当下常理、最能让事态自然向前发展的应对。',
    '第二张：进退维谷。设计一个扯动软肋的举动：无论怎么做都会得罪一方，必须在道义、人情、名声或安全之间做痛苦的割肉。',
    '第三张：剑走偏锋。跳出常规思维，给出一个狡黠、反常、不按套路出牌的动作，合乎情理但出人意料；高危局面可以火中取栗，侥幸成功就斩获奇效或瞬间翻盘。',
    '每个 choice 至少包含 slot 和 text。不要给 text 加固定前缀，不要输出“正路”“代价”“奇手”这类搭配词。',
    '不要复述固定操作，不要把同一件事换三种说法，不要写成完成态。',
    '标题、行动、提示都必须是简体中文。',
    '每个选项至少要有 text；如果你愿意，也可以补 actionText、hint 或其他字段，但不要为了凑字段把语言写死。',
    'text 要像玩家真正会点的决策，不要写成空泛口号。',
    '如果提供 actionText，它应该比 text 更具体，能直接作为执行描述。',
    '第二张与第三张的 actionText 或 hint 里，尽量让玩家看见它为什么两难、为什么反常但可行。',
    '如果条件还不够，只能写成试探、铺垫、借势、旁敲或求援，不得直接写成完成态。',
    'Choice context:',
    safeStringify(choiceContext)
  ].join('\n');
}

function buildNarrationChoicesPrompt(session, action, narrationPrompt) {
  const planning = buildDynamicPlanningBundle(session, action || {});
  const choiceContext = buildChoiceContext(session, action || {}, null, null, planning);
  return [
    '你要一次完成两件事：',
    '1. 写出本回合正文 narration。',
    '2. 生成 3 个动态选项 choices。',
    '只返回一个 JSON 对象。格式：{"narration":"...","choices":[...],"dramaticMeta":{}}。',
    '正文必须是简体中文，不要写系统说明。',
    '动态选项只根据当前回合事实、余波、关系和下一步压力来长出三条路。',
    '不要生成“河北豪族、地方豪族、地方豪右、地方势力、部族、士族、宗族、望族、乡豪、强宗”等抽象势力目标，也不要写“把某物给某某豪族/地方势力”“拜会某地豪族”“借某股势力”“联络某部族”这类模板句。',
    '动态选项优先落在当场人物、刚发生的余波、可见地点、手头困境和玩家刚选择的行动上；目标必须具体到官署、军营、店铺、驿站、门吏、差役、兵卒、文书、榜文或当场人物。',
    '按三种张力输出三张牌：1. 推动剧情 2. 二难选项 3. 违背常理但有趣。',
    '第二张按“进退维谷”设计，让两边都有理由、也都会得罪一方。',
    '第三张按“剑走偏锋”设计，反常、狡黠、不按套路，但合乎情理。',
    '每个 choice 至少要有 slot 和 text，不要加固定前缀。',
    '如果提供 actionText，它应该比 text 更具体，能直接作为执行描述。',
    '第二张与第三张的 actionText 或 hint 里，尽量让玩家看见它为什么两难、为什么反常但可行。',
    '若条件不足，只能写成试探、铺垫、借势、旁敲或求援，不得直接写成完成态。',
    '叙事任务：',
    clipText(narrationPrompt, 600),
    'Choice context:',
    safeStringify(choiceContext)
  ].join('\n');
}

function buildDirectorTurnPrompt(directorPacket) {
  const packet = directorPacket && typeof directorPacket === 'object' ? directorPacket : {};
  return [
    '你是三国题材文字冒险的剧情主持与编剧。',
    '本地导演已经完成本回合的规则裁定、数值结算、状态变更、存档与合法性边界。',
    '你不能改写任何已裁定事实，不能自行增减数值，不能越权提交状态，只能演绎正文并提出可供本地再次校验的变化建议。',
    '只返回一个 JSON 对象，不要输出解释、前言、思维链、代码块或额外文字。',
    '返回格式：{"narration":"...","proposal":{"summary":"","dramaticQuestion":"","scenePlan":{"surfaceGoal":"","obstacle":"","turnPoint":"","emotionalShift":"","closingBeat":"","tone":"","pace":""},"sceneResidue":["..."],"newRumors":["..."],"npcReactions":[{"targetName":"","warmth":0,"tension":0,"respect":0,"guardedness":0,"curiosity":0,"note":""}],"factionReactions":[{"targetName":"","watchfulness":0,"respect":0,"hostility":0,"leverageFear":0,"note":""}],"threadSuggestions":[{"title":"","domain":"","urgency":1,"note":""}],"nextChoices":[{"text":"","actionText":"","hint":""}]}}。',
    'narration 只写本回合已经裁定发生的过程、阻力、代价、人物反应和余波，不要重写规则，不要播报数值。',
    'proposal 里的所有字段都是“建议”，不是已提交状态。不要在 proposal 里写数值结算结果。',
    'nextChoices 必须正好给出 3 个不同方向，且都必须只基于当前剧情状态、人物关系、地点变化与世界事实自然长出。',
    '不要生成“河北豪族、地方豪族、地方豪右、地方势力、部族、士族、宗族、望族、乡豪、强宗”等抽象势力目标，也不要写“把某物给某某豪族/地方势力”“拜会某地豪族”“借某股势力”“联络某部族”这类模板句。',
    '动态选项优先落在当场人物、刚发生的余波、可见地点、手头困境和玩家刚选择的行动上；目标必须具体到官署、军营、店铺、驿站、门吏、差役、兵卒、文书、榜文或当场人物。',
    '这三张 nextChoices 分别承担：顺水推舟、进退维谷、剑走偏锋。',
    '第二张应写成二难取舍，无论怎么做都会得罪一方，必须在道义、人情、名声或安全之间割肉。',
    '第三张可以偏离常规路径，狡黠、反常、不按套路，合乎情理但出人意料；高危局面可以火中取栗。',
    '把决定权交给剧情语境本身，不要假设本地已经替你规划好路线。text 足够时就不要硬补字段；actionText、hint 等字段只在自然需要时补充。',
    '第二张与第三张的 actionText 或 hint 里，尽量让玩家看见它为什么两难、为什么反常但可行，不能只写成普通行动说明。',
    '每个 nextChoice 至少包含 slot 和 text。不要给 text 加固定前缀，不要输出“正路”“代价”“奇手”这类搭配词。',
    'threadSuggestions 只提出值得持续追踪的线头，标题要能直接入档，不要空泛。',
    'sceneResidue 与 newRumors 都应该是短句，像回合结束后仍在发热的余波，不要写成长段解释。',
    '导演回合包：',
    JSON.stringify({
      version: packet.version || 'director_turn_v1',
      sceneTitle: packet.sceneTitle || '',
      action: packet.action || {},
      adjudication: packet.adjudication || {},
      narrationContext: packet.narrationContext || {},
      choiceContext: packet.choiceContext || {}
    }, null, 2)
  ].join('\n');
}

function buildEndpointCandidates(apiBaseUrl) {
  const trimmed = String(apiBaseUrl || '').replace(/\/$/, '');
  if (!trimmed) return [];
  const candidates = [trimmed];
  if (/\/chat\/completions$/i.test(trimmed)) return uniqueStrings(candidates);
  if (/\/v1$/i.test(trimmed)) {
    candidates.push(trimmed + '/chat/completions');
    candidates.push(trimmed.replace(/\/v1$/i, '') + '/v1/chat/completions');
  } else {
    candidates.push(trimmed + '/v1/chat/completions');
    candidates.push(trimmed + '/chat/completions');
  }
  return uniqueStrings(candidates);
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

const REMOTE_COMPLETION_MAX_TOKENS = 1200;

async function requestCompletion(settings, prompt, options = {}) {
  const providerCandidates = getProviderCandidates(settings);
  if (!providerCandidates.length) {
    return { ok: false, text: '', detail: 'provider-disabled' };
  }
  const errors = [];
  const timeoutMs = Number(options && options.timeoutMs) > 0 ? Number(options.timeoutMs) : 45000;
  const requestMaxTokens = Number(options && options.maxTokens) > 0
    ? Math.max(256, Math.min(2400, Number(options.maxTokens)))
    : REMOTE_COMPLETION_MAX_TOKENS;
  const systemPrompt = normalizeText(
    options && options.systemPrompt,
    '你是三国题材文字冒险游戏的内容生成器。只按要求输出。'
  );
  for (const provider of providerCandidates) {
    const endpoints = buildEndpointCandidates(provider && provider.apiBaseUrl || '');
    for (const url of endpoints) {
      const timeout = withTimeout(timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: timeout.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: Number(provider.temperature) || 0.8,
            max_tokens: requestMaxTokens,
            stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ]
          })
        });
        const text = await response.text();
        if (!response.ok) {
          errors.push(`${provider.providerName || 'provider'}@${url} -> ${response.status}:${text.slice(0, 200)}|request-max_tokens:${requestMaxTokens}`);
          continue;
        }
        return {
          ok: true,
          url,
          text,
          providerName: provider.providerName || '',
          model: provider.model || ''
        };
      } catch (error) {
        errors.push(`${provider.providerName || 'provider'}@${url} -> ${error && error.message ? error.message : 'request-error'}`);
      } finally {
        timeout.clear();
      }
    }
  }
  return { ok: false, text: '', detail: errors.join(' | ') };
}

function findBalancedJsonFragment(text) {
  const raw = String(text || '');
  const start = raw.search(/[\[{]/);
  if (start < 0) return '';
  const opener = raw[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const ch = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === opener) depth += 1;
    if (ch === closer) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return '';
}

function safeJsonParseLoose(text) {
  const normalized = normalizeText(text, '');
  if (!normalized) return null;
  try {
    return JSON.parse(normalized);
  } catch (error) {
    const fragment = findBalancedJsonFragment(normalized);
    if (!fragment) return null;
    try {
      return JSON.parse(fragment);
    } catch (secondError) {
      return null;
    }
  }
}

function looksLikeProviderWrapperChoice(item) {
  return Boolean(
    item &&
    typeof item === 'object' &&
    (
      Object.prototype.hasOwnProperty.call(item, 'message') ||
      Object.prototype.hasOwnProperty.call(item, 'delta') ||
      Object.prototype.hasOwnProperty.call(item, 'finish_reason') ||
      Object.prototype.hasOwnProperty.call(item, 'index')
    ) &&
    !Object.prototype.hasOwnProperty.call(item, 'actionText')
  );
}

function looksLikeBusinessChoice(item) {
  return Boolean(
    item &&
    typeof item === 'object' &&
    (
      Object.prototype.hasOwnProperty.call(item, 'actionText') ||
      Object.prototype.hasOwnProperty.call(item, 'actionKind') ||
      Object.prototype.hasOwnProperty.call(item, 'slotRole') ||
      Object.prototype.hasOwnProperty.call(item, 'intent') ||
      Object.prototype.hasOwnProperty.call(item, 'effect') ||
      Object.prototype.hasOwnProperty.call(item, 'hint')
    )
  );
}

function looksLikeStructuredChoicePayload(payload) {
  if (!payload) return false;
  if (Array.isArray(payload)) {
    return payload.some((item) => looksLikeBusinessChoice(item));
  }
  if (typeof payload !== 'object') return false;
  if (Array.isArray(payload.choices) && payload.choices.some((item) => looksLikeBusinessChoice(item))) return true;
  if (Array.isArray(payload.options) && payload.options.some((item) => looksLikeBusinessChoice(item))) return true;
  return Boolean(payload.narration || payload.story || payload.dramaticMeta);
}

function normalizeShortTextList(list, limit = 6, maxChars = 80) {
  return uniqueStrings(ensureList(list).map((item) => clipText(item, maxChars)).filter(Boolean)).slice(0, limit);
}

function normalizeDirectorNpcReaction(item) {
  if (!item || typeof item !== 'object') return null;
  const targetName = clipText(item.targetName || item.name || '', 24);
  const targetId = clipText(item.targetId || '', 40);
  if (!targetName && !targetId) return null;
  return {
    targetName,
    targetId,
    warmth: clampNumber(item.warmth, 0, 100, 0),
    tension: clampNumber(item.tension, 0, 100, 0),
    respect: clampNumber(item.respect, 0, 100, 0),
    guardedness: clampNumber(item.guardedness, 0, 100, 0),
    curiosity: clampNumber(item.curiosity, 0, 100, 0),
    note: clipText(item.note || '', 80)
  };
}

function normalizeDirectorFactionReaction(item) {
  if (!item || typeof item !== 'object') return null;
  const targetName = clipText(item.targetName || item.name || '', 24);
  const targetId = clipText(item.targetId || '', 40);
  if (!targetName && !targetId) return null;
  return {
    targetName,
    targetId,
    watchfulness: clampNumber(item.watchfulness, 0, 100, 0),
    respect: clampNumber(item.respect, 0, 100, 0),
    hostility: clampNumber(item.hostility, 0, 100, 0),
    leverageFear: clampNumber(item.leverageFear, 0, 100, 0),
    note: clipText(item.note || '', 80)
  };
}

function normalizeDirectorThreadSuggestion(item) {
  if (!item || typeof item !== 'object') return null;
  const title = clipText(item.title || item.text || '', 48);
  if (!title) return null;
  return {
    title,
    domain: clipText(item.domain || '局势', 16) || '局势',
    urgency: clampNumber(item.urgency, 1, 3, 2),
    note: clipText(item.note || item.summary || '', 96)
  };
}

function normalizeDirectorScenePlan(item) {
  const source = item && typeof item === 'object' ? item : {};
  return {
    surfaceGoal: clipText(source.surfaceGoal || source.goal || '', 80),
    obstacle: clipText(source.obstacle || source.block || '', 80),
    turnPoint: clipText(source.turnPoint || source.pivot || '', 80),
    emotionalShift: clipText(source.emotionalShift || source.shift || '', 80),
    closingBeat: clipText(source.closingBeat || source.residue || '', 80),
    tone: clipText(source.tone || '', 40),
    pace: clipText(source.pace || '', 24)
  };
}

function normalizeDirectorProposal(session, action, proposal) {
  const source = proposal && typeof proposal === 'object' ? proposal : {};
  const nextChoices = normalizeRemoteChoices(session, action, source.nextChoices || source.choices || []);
  return {
    summary: clipText(source.summary || '', 120),
    dramaticQuestion: clipText(source.dramaticQuestion || source.question || '', 80),
    scenePlan: normalizeDirectorScenePlan(source.scenePlan || source.plan || {}),
    sceneResidue: normalizeShortTextList(source.sceneResidue || source.residue || source.residues, 6, 72),
    newRumors: normalizeShortTextList(source.newRumors || source.rumors, 4, 72),
    npcReactions: ensureList(source.npcReactions || source.relationReactions || source.relations)
      .map((item) => normalizeDirectorNpcReaction(item))
      .filter(Boolean)
      .slice(0, 5),
    factionReactions: ensureList(source.factionReactions || source.factions)
      .map((item) => normalizeDirectorFactionReaction(item))
      .filter(Boolean)
      .slice(0, 4),
    threadSuggestions: ensureList(source.threadSuggestions || source.threads)
      .map((item) => normalizeDirectorThreadSuggestion(item))
      .filter(Boolean)
      .slice(0, 3),
    nextChoices
  };
}

function extractCompletionTextCandidates(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const values = [];
  const push = (value) => {
    const text = normalizeText(value, '');
    if (text) values.push(text);
  };

  push(payload.text);
  push(payload.content);
  push(payload.output_text);
  push(payload.message && payload.message.content);
  push(payload.message && payload.message.text);
  push(payload.response && payload.response.content);
  push(payload.response && payload.response.text);
  push(payload.data && payload.data.content);
  push(payload.data && payload.data.text);

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      push(choice && choice.text);
      push(choice && choice.message && choice.message.content);
      push(choice && choice.message && choice.message.text);
      push(choice && choice.delta && choice.delta.content);
      push(choice && choice.delta && choice.delta.text);
      push(choice && choice.message && choice.message.reasoning_content);
      push(choice && choice.delta && choice.delta.reasoning_content);
    });
  }

  if (Array.isArray(payload.output)) {
    payload.output.forEach((item) => {
      push(item && item.content);
      push(item && item.text);
      push(item && item.output_text);
      if (Array.isArray(item && item.content)) {
        item.content.forEach((segment) => {
          push(segment && segment.text);
          push(segment && segment.content);
        });
      }
    });
  }

  push(payload.reasoning_content);
  push(payload.message && payload.message.reasoning_content);
  push(payload.delta && payload.delta.reasoning_content);
  push(payload.data && payload.data.reasoning_content);

  return uniqueStrings(values);
}

function extractStructuredTextCandidates(text) {
  const normalized = normalizeText(text, '');
  if (!normalized) return [];

  const candidates = [normalized];
  const fencePattern = /```(?:json|javascript|js|text)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fencePattern.exec(normalized))) {
    const block = normalizeText(match[1], '');
    if (block) candidates.push(block);
  }

  const labelledMatch = normalized.match(/(?:最终回答|最终输出|Final Answer|Answer|JSON|输出)\s*[:：]\s*([\s\S]+)/i);
  if (labelledMatch && labelledMatch[1]) {
    candidates.push(normalizeText(labelledMatch[1], ''));
  }

  const fragment = findBalancedJsonFragment(normalized);
  if (fragment) candidates.push(fragment);
  return uniqueStrings(candidates);
}

function unwrapStructuredPayload(rawText) {
  const root = safeJsonParseLoose(rawText);
  if (!root) return null;
  if (looksLikeStructuredChoicePayload(root) && !(Array.isArray(root.choices) && root.choices.some((item) => looksLikeProviderWrapperChoice(item)))) {
    return root;
  }

  const nestedTexts = extractCompletionTextCandidates(root);
  for (const text of nestedTexts) {
    const candidates = extractStructuredTextCandidates(text);
    for (const candidate of candidates) {
      const parsed = safeJsonParseLoose(candidate);
      if (parsed && looksLikeStructuredChoicePayload(parsed)) {
        return parsed;
      }
    }
  }

  return looksLikeStructuredChoicePayload(root) ? root : null;
}

function parseChoiceArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.choices) && payload.choices.some((item) => looksLikeProviderWrapperChoice(item))) return [];
  if (Array.isArray(payload.choices)) return payload.choices;
  if (Array.isArray(payload.options)) return payload.options;
  return [];
}

function normalizeRemoteChoiceOrder(candidates, framePlan) {
  return ensureList(candidates)
    .filter(Boolean)
    .slice(0, 3)
    .map((item, index) => {
      const fallbackFrame = framePlan[index] || framePlan[0] || null;
      const role = normalizeSlotRole(
        item.slotRole || item.role,
        fallbackFrame && fallbackFrame.slotRole ? fallbackFrame.slotRole : slotRoleByIndex(index)
      ) || slotRoleByIndex(index);
      const frameMeta = frameMetaByRole(framePlan, role) || fallbackFrame || framePlan[index] || null;
      return Object.assign({}, item, {
        slot: index,
        prefix: '',
        slotRole: role,
        slotRoleLabel: item.slotRoleLabel || frameMeta && frameMeta.label || `动作${index + 1}`,
        frameSummary: item.frameSummary || item.hint || frameMeta && frameMeta.summary || '',
        frameIntent: item.frameIntent || normalizeIntent(item.intent || '', role),
        order: index
      });
    });
}

function buildRemoteChoiceFrames() {
  return [0, 1, 2].map((index) => ({
    slotRole: slotRoleByIndex(index),
    label: dynamicSlotRoleLabel(slotRoleByIndex(index)),
    summary: dynamicSlotRoleSummary(slotRoleByIndex(index)),
    intent: normalizeIntent(slotRoleByIndex(index), slotRoleByIndex(index))
  }));
}

function normalizeRemoteChoices(session, action, rawChoices) {
  const framePlan = buildRemoteChoiceFrames();
  const candidates = parseChoiceArray(rawChoices)
    .map((item, index) => normalizeChoiceCandidate(
      item,
      index,
      framePlan,
      null,
      { trustProvidedTitle: true, strictProvidedTitle: true }
    ))
    .filter(Boolean);
  return normalizeRemoteChoiceOrder(candidates, framePlan);
}

function emitDraftPlaceholders(framePlan, onDraft) {
  if (typeof onDraft !== 'function') return Promise.resolve();
  return Promise.all(framePlan.slice(0, 3).map((frame, index) => onDraft({
    slot: index,
    slotRole: frame.slotRole,
    slotRoleLabel: frame.label,
    text: '这一手正在浮现',
    hint: frame.summary,
    isTyping: true
  })));
}

function emitGenericDraftPlaceholders(onDraft) {
  if (typeof onDraft !== 'function') return Promise.resolve();
  return Promise.all([0, 1, 2].map((index) => onDraft({
    slot: index,
    slotRole: slotRoleByIndex(index),
    slotRoleLabel: `动作${index + 1}`,
    text: `第 ${index + 1} 手正在浮现`,
    hint: '灵境正在根据当前局势凝出新的动作。',
    isTyping: true
  })));
}

async function generateDynamicChoices(session, action, runtimeSettings, options = {}) {
  if (!session || !session.world || session.world.phase !== 'playing' || session.world.phase === 'ended') {
    return attachChoiceMeta([], {
      mode: 'disabled',
      reason: 'phase_unavailable',
      detail: 'dynamic-choice-phase-unavailable'
    });
  }

  const settings = runtimeSettings || session.settings || {};
  const providerEnabled = getProviderCandidates(settings).length > 0;
  const onChoice = typeof options.onChoice === 'function' ? options.onChoice : null;
  const onDraft = typeof options.onDraft === 'function' ? options.onDraft : null;

  if (providerEnabled) {
    const prompt = buildChoicePrompt(session, action || {});
    const remote = await requestCompletion(settings, prompt);
    if (remote.ok) {
      const parsed = unwrapStructuredPayload(remote.text);
      const normalized = normalizeRemoteChoices(session, action, parsed && parsed.choices ? parsed.choices : parsed);
      if (normalized.length) {
        for (const choice of normalized) {
          if (onChoice) await onChoice(choice);
        }
        return attachChoiceMeta(normalized, {
          mode: 'provider',
          reason: 'provider_batch_choices',
          detail: `batch-ok:${remote.url}|choices:${normalized.length}`
        });
      }
      if (options.allowLocalFallback === false) {
        return attachChoiceMeta([], {
          mode: 'provider',
          reason: 'provider_empty_choices',
          detail: `batch-empty:${remote.url}`
        });
      }
    } else if (options.allowLocalFallback === false) {
      return attachChoiceMeta([], {
        mode: 'provider',
        reason: 'provider_failed',
        detail: remote.detail || 'batch-failed'
      });
    }
  }

  const fallback = buildLocalDynamicChoices(session, action || {});
  for (const choice of fallback) {
    if (onChoice) await onChoice(choice);
  }
  return attachChoiceMeta(fallback, {
    mode: providerEnabled ? 'fallback' : 'disabled',
    reason: providerEnabled ? 'local_dynamic_fallback' : 'provider_disabled',
    detail: providerEnabled ? 'local-fallback-after-provider' : 'provider-disabled'
  });
}

async function requestNarrationChoicesBundle(settings, session, action, narrationPrompt) {
  if (getProviderCandidates(settings).length === 0) {
    return {
      narration: '',
      choices: [],
      dramaticMeta: null,
      detail: `provider-disabled|request-model:${String(settings && settings.model || '')}`
    };
  }

  const prompt = buildNarrationChoicesPrompt(session, action || {}, narrationPrompt || '');
  const remote = await requestCompletion(settings, prompt);
  if (!remote.ok) {
    return {
      narration: '',
      choices: [],
      dramaticMeta: null,
      detail: `unified-failed:${remote.detail || 'request-failed'}|request-model:${String(settings && settings.model || '')}`
    };
  }

  const parsed = unwrapStructuredPayload(remote.text);
  const narration = normalizeText(parsed && (parsed.narration || parsed.story || parsed.text || parsed.content) || '', '');
  const choices = normalizeRemoteChoices(session, action, parsed && parsed.choices ? parsed.choices : parsed);
  return {
    narration,
    choices,
    dramaticMeta: parsed && parsed.dramaticMeta && typeof parsed.dramaticMeta === 'object' ? parsed.dramaticMeta : null,
    detail: `unified-ok:${remote.url}|request-model:${String(remote && remote.model || settings && settings.model || '')}|choices:${choices.length}|narration:${narration ? 1 : 0}`
  };
}

async function requestDirectorTurnBundle(settings, session, action, directorPacket) {
  if (getProviderCandidates(settings).length === 0) {
    return {
      narration: '',
      proposal: null,
      detail: `provider-disabled|request-model:${String(settings && settings.model || '')}`
    };
  }

  const prompt = buildDirectorTurnPrompt(directorPacket);
  const remote = await requestCompletion(settings, prompt, {
    timeoutMs: 90000,
    maxTokens: 1800,
    systemPrompt: '你是三国题材文字冒险的导演制回合编剧。只返回符合 schema 的 JSON，不输出额外文字。'
  });
  if (!remote.ok) {
    return {
      narration: '',
      proposal: null,
      detail: `director-failed:${remote.detail || 'request-failed'}|request-model:${String(settings && settings.model || '')}`
    };
  }

  const parsed = unwrapStructuredPayload(remote.text);
  const rawProviderPayload = safeJsonParseLoose(remote.text);
  const providerNarrationFallback = rawProviderPayload
    ? extractCompletionTextCandidates(rawProviderPayload).find((item) => /[\u4e00-\u9fff]/.test(String(item || '')))
    : '';
  const narration = normalizeText(
    (parsed && (parsed.narration || parsed.story || parsed.text || parsed.content))
      || providerNarrationFallback
      || '',
    ''
  );
  const proposal = normalizeDirectorProposal(session, action, parsed && parsed.proposal ? parsed.proposal : parsed);
  return {
    narration,
    proposal,
    detail: `director-ok:${remote.url}|request-model:${String(remote && remote.model || settings && settings.model || '')}|choices:${proposal && proposal.nextChoices ? proposal.nextChoices.length : 0}|narration:${narration ? 1 : 0}`
  };
}

module.exports = {
  requestNarrationChoicesBundle,
  requestDirectorTurnBundle,
  generateDynamicChoices,
  buildLocalDynamicChoices,
  normalizeRemoteChoices,
  normalizeDirectorProposal
};
