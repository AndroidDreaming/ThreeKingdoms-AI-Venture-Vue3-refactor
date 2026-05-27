const {
  buildHistoricalNarrativeBundle,
  buildHistoricalChoiceLeads
} = require('./chronicleV5HistoricalEventManager');
const {
  buildEncounterChoiceLeads,
  buildEncounterNarrativeBundle
} = require('./chronicleV5EncounterSystem');
const { ensureSoftState } = require('./chronicleV5SoftState');
const { isRelationMet } = require('./chronicleV5RelationVisibility');
const { ensureWorldFermentationState } = require('./chronicleV5WorldFermentation');
const { ensureWorldPerceptionState } = require('./chronicleV5WorldPerception');
const { findCity, CITIES } = require('./chronicleV5StateFactory');

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(list) {
  return Array.from(new Set(ensureList(list).filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeSnippet(value, fallback = '') {
  const text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

const FRONTIER_LABEL_STOPWORDS = new Set([
  '当前', '眼下', '局势', '主线', '推进', '任务', '事件', '风声', '消息', '行动', '选择', '人物', '关系', '地图',
  '经营', '江湖', '军旅', '门派', '发展', '三国', '线索', '局面', '此地', '这里', '那里',
  '余波', '回响', '喘息', '话头', '军情', '风向', '态度', '边界', '后手', '口风', '影子'
]);

const CITY_NAME_SET = new Set(
  ensureList(CITIES)
    .map((item) => String(item && item.name || '').trim())
    .filter(Boolean)
);

const BAD_FRONTIER_LABEL_EXACT = new Set([
  '旧朝余烬',
  '前场余烬',
  '旧局余烬',
  '许都朝局起势',
  '邺城',
  '许都'
]);

const ABSTRACT_TARGET_LABEL_PATTERNS = [
  /^(?:这回|这一回|这一手|这层|那层|刚才|方才|眼下|当前|此刻)/,
  /(?:余波|回响|喘息|话头|军情|风向|局面|后手|心事|态度|边界|口风|影子|动静|波澜|旧线|尾声|热闹|空档)$/,
  /^(?:风声|局势|主线|消息|行动|选择|人物|关系|地图|线索|局面)$/,
  /(?:余烬|起势|前场|前局|旧局|朝局|地面|台面|风口|热场|后场|下一层|这一层)$/,
  /(?:借题发酵|试人心|摸一家|试手帖|旧朝|新起强人)$/
];

const FRONTIER_SALIENT_LABELS = [
  ['暗线', '暗线'],
  ['军情', '军情'],
  ['粮道', '粮道'],
  ['兵势', '兵势'],
  ['城防', '城防'],
  ['前哨', '前哨'],
  ['守备', '守备'],
  ['江湖', '江湖'],
  ['门派', '门派'],
  ['风评', '风评'],
  ['人心', '人心'],
  ['旧案', '旧案'],
  ['官渡', '官渡'],
  ['曹操', '曹操'],
  ['长安', '长安'],
  ['襄阳', '襄阳'],
  ['许都', '许都']
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
  if (!list.length) return null;
  return list[stableTextHash(seedSource || list[0].title || list[0].text || '') % list.length];
}

function looksTooAbstractForTargetLabel(value) {
  const text = normalizeSnippet(value, '').replace(/[“”"'《》〈〉【】]/g, '');
  if (!text) return true;
  if (FRONTIER_LABEL_STOPWORDS.has(text)) return true;
  if (CITY_NAME_SET.has(text)) return true;
  if (BAD_FRONTIER_LABEL_EXACT.has(text)) return true;
  if (/^[\u4e00-\u9fff]{2,8}(?:城|都|郡|州)$/.test(text) && CITY_NAME_SET.has(text)) return true;
  return ABSTRACT_TARGET_LABEL_PATTERNS.some((pattern) => pattern.test(text));
}

function inferSalientFrontierLabel(value) {
  const text = normalizeSnippet(value, '').replace(/[“”"'《》〈〉【】]/g, '');
  if (!text) return '';
  for (const [keyword, label] of FRONTIER_SALIENT_LABELS) {
    if (text.includes(keyword)) return label;
  }
  return '';
}

function compactFrontierLabel(value, fallback = '这局', limit = 6) {
  const text = normalizeSnippet(value, '');
  if (!text) return fallback;
  const salient = inferSalientFrontierLabel(text);
  if (salient && !looksTooAbstractForTargetLabel(salient)) return salient.slice(0, limit);
  const matches = text.match(/[\u4e00-\u9fff]{2,10}/g) || [];
  for (const item of matches) {
    const normalized = String(item || '').trim();
    const segmented = normalized
      .split(/[与和及并]/)
      .map((part) => String(part || '').trim())
      .map((part) => part.split(/已经|开始|再不|很快|会被|会把|会让|把|将|被|让|逼得|逼到|压到|拖到|到了|正在|仍在|仍可/)[0].trim())
      .find((part) => part.length >= 2) || normalized;
    if (!segmented || FRONTIER_LABEL_STOPWORDS.has(segmented) || looksTooAbstractForTargetLabel(segmented)) continue;
    return segmented.slice(0, limit);
  }
  const cleaned = text.replace(/[“”"'《》〈〉【】]/g, '').slice(0, limit);
  return looksTooAbstractForTargetLabel(cleaned) ? fallback : (cleaned || fallback);
}

function normalizeFollowupTargetLabel(value) {
  const cleaned = compactFrontierLabel(value, '', 6);
  if (!cleaned || looksTooAbstractForTargetLabel(cleaned)) return '';
  return cleaned;
}

function actionTargetsCity(action, targetName = '') {
  if (!action || typeof action !== 'object') return false;
  const kind = String(action.kind || '').trim();
  if (kind === 'origin' || kind === 'travel') return true;
  const directName = normalizeSnippet(targetName || action.targetName || '', '');
  if (directName && CITY_NAME_SET.has(directName)) return true;
  const targetId = String(action.target || '').trim();
  return Boolean(targetId && findCity(targetId));
}

function buildFollowupSeed(targetName, kind, cityName) {
  const target = normalizeFollowupTargetLabel(targetName);
  const seedSource = `${kind}:${target || cityName || 'this-turn'}`;
  if (kind === 'investigate' || kind === 'intrigue') {
    return pickSeedVariant(seedSource, target ? [
      actionChoiceSeed(
        `顺藤掏${target}底细`,
        `沿着${target}刚露出来的那点破绽继续掏底，把对方背后的来路、心思和后手一并翻明`,
        '线一旦露头，最值钱的不是换题，而是顺藤把根一起拽出来。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        `回拆${target}后手`,
        `抓住${target}刚刚露出的空当回身拆线，看看他真正压着的旧账、暗门和下一步打算是什么`,
        '很多局不是查出来的，是趁对方还没来得及收口时拆出来的。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        `沿${target}追下去`,
        `顺着${target}刚冒出的动静继续追，把还没浮上水面的那层人和事一口气追到明处`,
        '此时追半步，往往比日后补十步更省力。',
        kind,
        '剧情'
      )
    ] : [
      actionChoiceSeed(
        '把暗线追明',
        '沿着刚刚掀开的那层动静继续摸，把真正牵动后续的人、账和暗线追出来',
        '线头还热的时候往下摸，最容易摸到真正的脉络。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        '趁热翻旧账',
        '趁局面还没收口，回身把刚起的那层事掏到底，先把真正的利害和后手看明白',
        '很多后手不是等来的，是在别人来不及掩的时候掏开的。',
        kind,
        '剧情'
      )
    ]);
  }
  if (['social', 'diplomacy', 'romance'].includes(kind)) {
    return pickSeedVariant(seedSource, target ? [
      actionChoiceSeed(
        `和${target}把话接实`,
        `趁${target}态度还没收回去，当面把话说透，让站位、条件或心意都落到能兑现的地步`,
        '刚起了回响的时候把话接实，往往比另起新题更容易把关系做成。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        `请${target}给句准话`,
        `就着${target}刚露出的口风再往前走半步，请对方把真正的态度、底线和条件说得更明白`,
        '人心最难得的，不是热络，而是那一句能落地的准话。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        `与${target}定下章程`,
        `趁${target}还愿意接这层话头，把这段人情谈成能继续往前走的章程与后手`,
        '很多关系之所以散掉，不是没有温度，而是始终没谈成章程。',
        kind,
        '剧情'
      )
    ] : [
      actionChoiceSeed(
        '把话问到实处',
        '沿着刚刚松开的那段话头继续往深处说，把人情、态度和条件都坐实下来',
        '顺着回响把话坐实，比贸然换题更容易把局面做成。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        '趁热做深关系',
        '趁这回交谈还留着温度，再往前走一步，把眼前的人情从泛泛之交做成可兑现的关系',
        '关系最怕悬着，能做深的时候就别让它只停在气氛里。',
        kind,
        '剧情'
      )
    ]);
  }
  if (['military', 'battle', 'warpath'].includes(kind)) {
    return pickSeedVariant(seedSource, target ? [
      actionChoiceSeed(
        `沿${target}补上后手`,
        `就着${target}刚露出的缺口继续布置，把这一口军情补成能立刻影响后续调度的实局`,
        '军情最怕悬着，趁眼下还热着，把后手补齐最值钱。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        `把${target}这线坐稳`,
        `顺着${target}刚起的动静再压一步，把相关兵势、人手和布置都坐成可用的实利`,
        '军旅里的半步迟疑，常常要用整段战局去偿还。',
        kind,
        '剧情'
      )
    ] : [
      actionChoiceSeed(
        '先补营里缺口',
        '沿着刚起的军情再补一手，把兵势、粮口和后续布置都坐稳下来',
        '真正能决定后手的，往往是眼下这一下有没有补实。',
        kind,
        '剧情'
      ),
      actionChoiceSeed(
        '盯紧军中动静',
        '顺着这回军旅线刚松开的口子往前补，把后续调度需要的那层底盘先压成形',
        '营里这一步补实了，前面很多险局才扛得住。',
        kind,
        '剧情'
      )
    ]);
  }
  return pickSeedVariant(seedSource, target ? [
    actionChoiceSeed(
      `接着做${target}这线`,
      `顺着${target}刚给出的回响再落一步，把这条线从一时起意接成能继续发力的后手`,
      '很多好线不是靠多，而是靠你肯不肯在最该接的时候接住。',
      kind,
      '剧情'
    ),
    actionChoiceSeed(
      `沿${target}再布一手`,
      `沿着${target}刚松开的那点口子再布一手，让眼前这一线不至于空转过去`,
      '局面刚松的时候再补一手，常常比另起炉灶更划算。',
      kind,
      '剧情'
    )
  ] : [
    actionChoiceSeed(
      '沿这线再走一步',
      '沿着这一回刚起的回响再落一步，别让好不容易撬开的局面空掉',
      '很多可玩的线都死在没人愿意多接半拍。',
      kind,
      '剧情'
    ),
    actionChoiceSeed(
      '先把后劲续上',
      '就着这回事情刚松开的势头续上一手，把短暂起意接成真正能往后走的线',
      '顺手续上后劲，比等下一阵风更可靠。',
      kind,
      '剧情'
    )
  ]);
}

function buildMainlineSeed(title, kind) {
  const anchor = compactFrontierLabel(title, '主线');
  const seedSource = `${kind}:${anchor}:${title}`;
  if (kind === 'investigate' || kind === 'intrigue') {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `查${anchor}背后是谁`,
        `朝着“${title}”最卡脖子的关节下手，把眼前真正碍事的人、账、口子或旧案掏出来`,
        `“${title}”已经压到喉头，再不把背后的手查明，后面的每一步都只会更贵。`,
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `先拆${anchor}这一层`,
        `围着“${title}”先拆最关键的一层线头，看谁在背后压着不肯松口`,
        '主线真要推进，往往不是靠喊得更响，而是先拆掉最卡脖子的那层。 ',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `盯住${anchor}后手`,
        `就着“${title}”继续往下追，把还没露面的后手、旧账和人情网一并翻到台前`,
        '这条主线已经开始咬人了，最该盯紧的就是它背后那只还没露头的手。',
        kind,
        '主线'
      )
    ]);
  }
  if (kind === 'diplomacy') {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `拿${anchor}试口风`,
        `围着“${title}”去谈新的站位与交换，把眼前最关键的一层人心和势力重新排开`,
        '主线不只是往前冲，很多时候是先把该站边的人逼到桌上。',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `逼${anchor}先表态`,
        `顺着“${title}”去敲关键人物的口风，看谁愿意先站出来，谁又准备继续观望`,
        '站位这种事，拖得越久越贵，不如趁主线正热时先逼出一轮表态。',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `围着${anchor}换站位`,
        `借“${title}”这层压力重新排一轮人情与势力，让愿意下注的人先走到桌前`,
        '真正的主线推进，很多时候就是一场重新站位。',
        kind,
        '主线'
      )
    ]);
  }
  if (kind === 'govern' || kind === 'trade') {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `先给${anchor}补底盘`,
        `围着“${title}”先把钱粮、人手或地方运转补成底盘，让主线从空话变成能支撑后手的实务`,
        '底盘一旦垫稳，很多原本只敢想的布局才有资格真正展开。',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `围着${anchor}筹钱粮`,
        `顺着“${title}”先把钱粮和人手盘起来，免得主线一热就因为底子太薄而散掉`,
        '真正拖垮主线的，经常不是敌手，而是自己这边的底盘不够厚。',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `把${anchor}这摊盘活`,
        `拿“${title}”当成当前最要紧的一摊事来盘，先把地方运转、账口和用度重新理顺`,
        '能盘活眼前这摊事，主线才不是空转。',
        kind,
        '主线'
      )
    ]);
  }
  if (['military', 'battle', 'warpath'].includes(kind)) {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `先稳${anchor}这一线`,
        `围着“${title}”先把兵势、前哨、粮道或守备稳住，不让主线在真正要用力的时候散掉`,
        '真正吃人的从来不是大战本身，而是大战前那层没稳住的空档。',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `围着${anchor}补前哨`,
        `顺着“${title}”把前哨、粮道和守备重新补齐，让后面的兵势有地方发力`,
        '兵势再猛，前哨一漏，整条线都可能塌得比想象更快。',
        kind,
        '主线'
      ),
      actionChoiceSeed(
        `拿${anchor}试兵势`,
        `把“${title}”当成当前最该试探兵势的地方，看敌我哪一边先在这条线上露出破绽`,
        '主线越热，越该试一试谁是真硬，谁只是撑场面。',
        kind,
        '主线'
      )
    ]);
  }
  return pickSeedVariant(seedSource, [
    actionChoiceSeed(
      `围着${anchor}先走一步`,
      `围着“${title}”把当前阶段最要紧的一手先落下去，让悬着的主线开始真正转动`,
      '这条线已经顶到眼前，再绕开它，只会让后面的局越来越难收。',
      kind,
      '主线'
    ),
    actionChoiceSeed(
      `从${anchor}开新口`,
      `拿“${title}”去撬开当前阶段最硬的一层阻力，让主线不再只是挂在嘴上`,
      '主线最怕悬着，先开出一个真口子，后面的事才有得做。',
      kind,
      '主线'
    ),
    actionChoiceSeed(
      `先碰${anchor}这层钉子`,
      `别再绕开“${title}”里最扎手的那一层，先正面碰一下，逼局势给出真实反应`,
      '真正该推的主线，往往都扎手。',
      kind,
      '主线'
    )
  ]);
}

function normalizeHistoryEntry(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    turn: Number(item.turn || 0),
    id: String(item.id || ''),
    text: normalizeSnippet(item.text || ''),
    actionText: normalizeSnippet(item.actionText || ''),
    actionKind: String(item.actionKind || ''),
    slotRole: String(item.slotRole || ''),
    targetName: normalizeSnippet(item.targetName || ''),
    targetId: String(item.targetId || ''),
    frontierId: String(item.frontierId || ''),
    noveltyKey: String(item.noveltyKey || ''),
    outcomes: ensureList(item.outcomes).map((entry) => String(entry || '').trim()).filter(Boolean),
    source: String(item.source || '')
  };
}

function recentDynamicChoiceHistory(state, limit = 12) {
  const memory = state && state.memory ? state.memory : {};
  return ensureList(memory.dynamicChoiceHistory)
    .map((item) => normalizeHistoryEntry(item))
    .filter(Boolean)
    .slice(0, limit);
}

function recentSelectedDynamicChoiceHistory(state, limit = 8) {
  const memory = state && state.memory ? state.memory : {};
  return ensureList(memory.selectedDynamicChoiceHistory)
    .map((item) => normalizeHistoryEntry(item))
    .filter(Boolean)
    .slice(0, limit);
}

function lastSelectedDynamicChoice(state) {
  const memory = state && state.memory ? state.memory : {};
  const direct = normalizeHistoryEntry(memory.lastSelectedDynamicChoice);
  if (direct) return direct;
  return recentSelectedDynamicChoiceHistory(state, 1)[0] || null;
}

function normalizeActionDomain(kind) {
  const value = String(kind || '').trim();
  if (['govern', 'trade'].includes(value)) return '经营';
  if (['social', 'diplomacy', 'romance'].includes(value)) return '人物';
  if (['investigate', 'intrigue'].includes(value)) return '谋略';
  if (['martial', 'jianghu', 'sect', 'joinsect'].includes(value)) return '武学';
  if (['military', 'battle', 'warpath'].includes(value)) return '军旅';
  if (value === 'travel') return '行路';
  if (value === 'rest') return '休闲';
  return '局势';
}

function relationVisibilityStateOf(item) {
  const state = String(item && item.visibilityState || '').trim().toLowerCase();
  if (state) return state;
  return item && item.discovered === true ? 'met' : 'hidden';
}

function recentActionDomainWeights(state) {
  const recentActions = ensureList(state && state.memory && state.memory.recentActions).slice(0, 4);
  return recentActions.reduce((result, item, index) => {
    const domain = normalizeActionDomain(item && item.kind);
    const weight = Math.max(1, 4 - index);
    result[domain] = Number(result[domain] || 0) + weight;
    return result;
  }, {});
}

function frontierContinuityBonus(frontier, domainWeights, selectedChoice) {
  const domains = uniqueStrings([
    frontier && frontier.domain,
    ...ensureList(frontier && frontier.recommendedKinds).map((item) => normalizeActionDomain(item))
  ]);
  let bonus = 0;
  domains.forEach((domain) => {
    bonus += Number(domainWeights[domain] || 0) * 4;
  });
  if (selectedChoice && frontier) {
    if (selectedChoice.frontierId && selectedChoice.frontierId === frontier.id) bonus += 28;
    if (selectedChoice.noveltyKey && selectedChoice.noveltyKey === frontier.noveltyKey) bonus += 18;
    if (selectedChoice.targetName && frontier.targetName && selectedChoice.targetName === frontier.targetName) bonus += 12;
    if (selectedChoice.actionKind && ensureList(frontier.recommendedKinds).includes(selectedChoice.actionKind)) bonus += 10;
  }
  return bonus;
}

function relationScore(item) {
  if (!item) return 0;
  return Number(item.trust || 0) + Number(item.affection || 0) + Number(item.loyalty || 0) + Number(item.favorScore || 0) - Number(item.rivalry || 0);
}

function currentCityIdOf(state) {
  return String(state && state.world && state.world.currentCityId || '');
}

function currentCityNameOf(state) {
  return String(state && state.world && state.world.currentCityName || '');
}

function looksLikeInternalEntityId(value) {
  return /^(?:extra|npc|relation|faction|sect|city)_[\w-]+$/i.test(String(value || '').trim());
}

function resolveDisplayTargetName(state, targetId) {
  const id = String(targetId || '').trim();
  if (!id) return '';

  const relations = ensureList(state && state.gameState && state.gameState.relationships);
  const relation = relations.find((item) => item && item.id === id);
  if (relation && relation.name) return normalizeSnippet(relation.name);

  const factions = ensureList(state && state.gameState && state.gameState.factions);
  const faction = factions.find((item) => item && item.id === id);
  if (faction && faction.name) return normalizeSnippet(faction.name);

  const routes = ensureList(state && state.world && state.world.map && state.world.map.routes);
  const route = routes.find((item) => item && item.cityId === id);
  if (route && route.cityName) return normalizeSnippet(route.cityName);

  if (state && state.world && state.world.currentCityId === id) {
    return normalizeSnippet(state.world.currentCityName || '');
  }

  return '';
}

function displayTargetNameForAction(state, action) {
  const direct = normalizeSnippet(action && action.targetName || '');
  if (direct && !looksLikeInternalEntityId(direct)) return direct;
  return resolveDisplayTargetName(state, action && action.target);
}

function worldMainlineFocusKinds(state) {
  const focus = ensureList(state && state.world && state.world.mainline && state.world.mainline.focus);
  const mapping = {
    govern: 'govern',
    trade: 'trade',
    diplomacy: 'diplomacy',
    social: 'social',
    martial: 'martial',
    sect: 'sect',
    investigate: 'investigate',
    battle: 'battle',
    military: 'military',
    intrigue: 'intrigue',
    travel: 'travel'
  };
  return uniqueStrings(focus.map((item) => mapping[item] || '').filter(Boolean));
}

function recommendedKindsFromTags(tags) {
  const source = new Set(ensureList(tags).map((item) => String(item || '').trim()));
  const kinds = [];
  if (source.has('trade')) kinds.push('trade', 'govern');
  if (source.has('govern')) kinds.push('govern', 'diplomacy');
  if (source.has('strategy') || source.has('investigate')) kinds.push('investigate', 'intrigue');
  if (source.has('intrigue') || source.has('shadow')) kinds.push('intrigue', 'investigate');
  if (source.has('martial')) kinds.push('martial', 'jianghu');
  if (source.has('jianghu')) kinds.push('jianghu', 'social');
  if (source.has('social') || source.has('romance')) kinds.push('social', 'romance');
  return uniqueStrings(kinds).slice(0, 3);
}

function followupKindsForAction(actionKind) {
  return {
    govern: ['govern', 'trade', 'diplomacy'],
    trade: ['trade', 'govern', 'social'],
    diplomacy: ['diplomacy', 'social', 'investigate'],
    social: ['social', 'investigate', 'romance'],
    romance: ['romance', 'social', 'rest'],
    martial: ['martial', 'jianghu', 'social'],
    military: ['military', 'govern', 'investigate'],
    battle: ['battle', 'military', 'warpath'],
    investigate: ['investigate', 'social', 'intrigue'],
    intrigue: ['intrigue', 'investigate', 'diplomacy'],
    rest: ['rest', 'social', 'martial'],
    sect: ['sect', 'martial', 'social'],
    travel: ['social', 'investigate', 'travel'],
    joinsect: ['joinsect', 'sect', 'social'],
    warpath: ['military', 'warpath', 'battle'],
    jianghu: ['jianghu', 'social', 'investigate']
  }[String(actionKind || '').trim()] || ['social', 'investigate'];
}

function historyPenaltyScore(candidate, history) {
  const targetName = String(candidate.targetName || '').trim();
  const noveltyKey = String(candidate.noveltyKey || '').trim();
  const frontierId = String(candidate.id || '').trim();
  const kinds = new Set(ensureList(candidate.recommendedKinds));
  let penalty = 0;
  ensureList(history).forEach((item, index) => {
    const weight = Math.max(1, 6 - index);
    if (!item) return;
    if (noveltyKey && item.noveltyKey && item.noveltyKey === noveltyKey) penalty += 22 * weight;
    if (frontierId && item.frontierId && item.frontierId === frontierId) penalty += 18 * weight;
    if (targetName && item.targetName && item.targetName === targetName) penalty += 14 * weight;
    if (item.actionKind && kinds.has(item.actionKind)) penalty += 6 * weight;
  });
  return penalty;
}

function makeFrontier(base) {
  return Object.assign({
    id: '',
    type: 'generic',
    title: '',
    summary: '',
    reason: '',
    domain: '局势',
    risk: 'medium',
    slotBiases: [],
    recommendedKinds: [],
    targetId: '',
    targetName: '',
    targetType: '',
    cityId: '',
    cityName: '',
    outcomes: ['plot'],
    noveltyKey: '',
    source: 'planner',
    routineLike: false,
    dramaticPriority: 0,
    dynamicOnly: false,
    weight: 0,
    localChoice: null
  }, base || {});
}

function frontierDynamicMeta(frontier) {
  const source = String(frontier && frontier.source || '').trim();
  const routineLike = ['relation', 'growth', 'travel', 'leisure'].includes(source);
  const dynamicOnly = ['chosen_branch', 'followup', 'dramatic', 'fermentation', 'perception', 'mainline', 'historical', 'encounter', 'fatigue', 'attribute', 'consequence', 'promise_debt', 'moral_debt', 'faction_watch', 'rumor_heat', 'unfinished_move', 'momentum', 'scene_residue', 'shock_tag'].includes(source);
  const dramaticPriority = {
    chosen_branch: 8,
    followup: 7,
    dramatic: 7,
    consequence: 8,
    moral_debt: 8,
    unfinished_move: 8,
    promise_debt: 7,
    scene_residue: 7,
    rumor_heat: 7,
    shock_tag: 7,
    faction_watch: 6,
    momentum: 6,
    fermentation: 6,
    perception: 6,
    mainline: 6,
    historical: 5,
    encounter: 5,
    fatigue: 5,
    attribute: 4,
    faction: 3,
    extra_character: 2,
    relation: 1,
    growth: 1,
    travel: 0,
    leisure: 0
  }[source] ?? 1;
  return {
    routineLike,
    dramaticPriority,
    dynamicOnly
  };
}

function methodKindsForFrontier(frontier) {
  const domain = normalizeSnippet(frontier && frontier.domain || '');
  const recommended = uniqueStrings(ensureList(frontier && frontier.recommendedKinds));
  const base = uniqueStrings([frontier && frontier.localChoice && frontier.localChoice.actionKind].concat(recommended)).filter(Boolean);
  if (/(人物|亲近|风评)/.test(domain)) return uniqueStrings(base.concat(['social', 'diplomacy', 'investigate']));
  if (/(势力|主线|谋略|误读|暗潮)/.test(domain)) return uniqueStrings(base.concat(['investigate', 'intrigue', 'diplomacy']));
  if (/(军旅|战局)/.test(domain)) return uniqueStrings(base.concat(['military', 'investigate', 'warpath']));
  if (/(江湖|门派)/.test(domain)) return uniqueStrings(base.concat(['jianghu', 'social', 'investigate']));
  if (/(经营|城池)/.test(domain)) return uniqueStrings(base.concat(['govern', 'trade', 'diplomacy']));
  return uniqueStrings(base.concat(['social', 'investigate', 'diplomacy']));
}

function buildMethodVariantChoice(anchor, methodKind, targetName, frontier) {
  const namedTarget = normalizeSnippet(targetName || '', '');
  const baseAnchor = namedTarget || compactFrontierLabel(anchor, '这条线');
  const targetLabel = namedTarget || baseAnchor;
  const domain = normalizeSnippet(frontier && frontier.domain || '', '局势');
  const targetId = frontier && frontier.targetId ? frontier.targetId : '';
  const targetType = frontier && frontier.targetType ? frontier.targetType : '';
  const category = domain || normalizeActionDomain(methodKind);

  if (methodKind === 'investigate') {
    return actionChoiceSeed(
      namedTarget ? `摸清${namedTarget}近来站哪边` : `先摸${baseAnchor}底稿`,
      `别急着表态，先围着${targetLabel}把来路、旧账和真正卡脖子的那层东西摸清，再决定下一步从哪里下手`,
      '同一条线先摸底，再出手，常常比硬顶更省代价。',
      'investigate',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'intrigue') {
    return actionChoiceSeed(
      namedTarget ? `借暗门拆${namedTarget}后手` : `换暗门拆${baseAnchor}`,
      `不从明面推，改从旁人的口风、旧线或暗门去拆${targetLabel}，逼真正落子的人先露手`,
      '同一个目标，换暗门切进去，往往比正面顶更容易掀后手。',
      'intrigue',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'diplomacy') {
    return actionChoiceSeed(
      namedTarget ? `托人问${namedTarget}一句准话` : `找人替${baseAnchor}递话`,
      `围着${targetLabel}先找最说得上话的人递一句能落地的话，试出站位、价码和底线`,
      '同一条线不一定非靠硬压，有时候先让人情和站位动起来更快。',
      'diplomacy',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'social') {
    return actionChoiceSeed(
      namedTarget ? `当面和${namedTarget}把话聊实` : `当面把${baseAnchor}聊实`,
      `直接去见围着${targetLabel}最关键的人，把这条线从风闻和试探聊成能兑现的章程`,
      '同一个目标，很多时候不是算出来的，而是当面聊实的。',
      'social',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'trade') {
    return actionChoiceSeed(
      namedTarget ? `拿钱粮替${namedTarget}补一手` : `拿钱粮盘${baseAnchor}`,
      `围着${targetLabel}先盘钱粮、供给和可换的门路，让这条线有一块能落成实利的底盘`,
      '同一目标换成钱粮手法，推进会慢一点，但更稳也更厚。',
      'trade',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'govern') {
    return actionChoiceSeed(
      namedTarget ? `先替${namedTarget}把盘面补稳` : `先补${baseAnchor}底盘`,
      `围着${targetLabel}先把人手、秩序和地方运转补稳，再谈更大的推进和收益`,
      '先补底盘，不会最炫，但常常能让后面的回合不再空转。',
      'govern',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'military' || methodKind === 'warpath') {
    return actionChoiceSeed(
      namedTarget ? `围着${namedTarget}重排兵势` : `围着${baseAnchor}重排兵势`,
      `把${targetLabel}放进兵势、前哨和回手里看，先把最容易吃亏的一环压实，再决定要不要继续硬顶`,
      '同一个目标放进兵势里重看，很多隐患会比台面上更早露出来。',
      methodKind === 'warpath' ? 'warpath' : 'military',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  if (methodKind === 'jianghu' || methodKind === 'martial') {
    return actionChoiceSeed(
      namedTarget ? `借江湖门路去碰${namedTarget}` : `借江湖门路碰${baseAnchor}`,
      `不走官面和明话，改从江湖人、场子或真本事上去碰${targetLabel}，看能不能先把局势撬开`,
      '换成江湖手法，推进会更偏，也更容易抢到别人没防的口子。',
      methodKind === 'martial' ? 'martial' : 'jianghu',
      category,
      { target: targetId, targetName: namedTarget, targetType }
    );
  }
  return actionChoiceSeed(
    `换手法碰${baseAnchor}`,
    `别沿着上一手的惯性走，换一种更适合${targetLabel}这条线的手法去碰，先试出它最肯松的一口气`,
    '同一目标换手法，本身就能长出新的戏和新的代价。',
    methodKind || 'social',
    category,
    { target: targetId, targetName: namedTarget, targetType }
  );
}

function buildMethodVariantFrontiers(frontier, limit = 1) {
  if (!frontier || !frontier.localChoice || !frontier.title) return [];
  const baseKind = String(frontier.localChoice.actionKind || ensureList(frontier.recommendedKinds)[0] || 'social').trim() || 'social';
  const kinds = methodKindsForFrontier(frontier).filter((kind) => kind && kind !== baseKind).slice(0, limit);
  const anchor = compactFrontierLabel(frontier.targetName || frontier.title || frontier.summary, frontier.targetName || '这条线');
  return kinds.map((kind, index) => {
    const localChoice = buildMethodVariantChoice(anchor, kind, frontier.targetName, frontier);
    return makeFrontier({
      ...frontier,
      id: `${frontier.id}:method:${kind}`,
      type: `${frontier.type || 'generic'}_method`,
      title: localChoice.text,
      summary: `${frontier.title}这条线不只一种推进法。除了“${frontier.localChoice.text}”那种做法，也可以改用${normalizeActionDomain(kind)}手法去碰同一个目标。`,
      reason: `同一目标改换手法：${kind}。`,
      recommendedKinds: uniqueStrings([kind].concat(ensureList(frontier.recommendedKinds))),
      noveltyKey: `${frontier.noveltyKey || frontier.id}:method:${kind}`,
      weight: Math.max(28, Number(frontier.weight || 0) - 10 - (index * 3)),
      localChoice
    });
  });
}

function actionChoiceSeed(text, actionText, hint, actionKind, category, extra = {}) {
  return Object.assign({
    text,
    actionText,
    hint,
    actionKind,
    category
  }, extra || {});
}

function buildFollowupFrontier(state, action) {
  if (!action || !action.kind) return null;
  const cityName = currentCityNameOf(state) || '此地';
  const targetName = displayTargetNameForAction(state, action);
  if (actionTargetsCity(action, targetName)) return null;
  const actionLabel = normalizeSnippet(action.raw || action.actionText || action.text || action.kind, action.kind);
  const stateAnchor = normalizeSnippet(
    state && state.gameState && state.gameState.lastEventTag
      ? state.gameState.lastEventTag
      : (state && state.scene && state.scene.title ? state.scene.title : ''),
    ''
  );
  const kinds = followupKindsForAction(action.kind);
  const leadKind = kinds[0] || 'social';
  const followupTargetName = normalizeFollowupTargetLabel(targetName);
  const anchorName = followupTargetName || normalizeFollowupTargetLabel(stateAnchor || actionLabel) || '';
  const localChoice = buildFollowupSeed(anchorName, leadKind, cityName);
  const title = normalizeSnippet(localChoice.text, anchorName ? `接住${anchorName}这手` : '接住刚才这手');
  const summary = followupTargetName
    ? `刚才围绕${followupTargetName}落下的这一手，已经把局面撬开了一道缝。顺势追下去，最容易把人情、口风或暗线坐实。`
    : `刚才这手已经把${stateAnchor || cityName}里的风向撬开了一层。眼下最值钱的不是换题，而是顺势承接。`;
  return makeFrontier({
    id: `frontier:followup:${action.kind}:${encodeURIComponent(targetName || actionLabel)}`,
    type: 'followup',
    title,
    summary,
    reason: `紧接玩家刚刚的动作：“${actionLabel}”。`,
    domain: '承接',
    risk: 'low',
    slotBiases: ['followup'],
    recommendedKinds: kinds,
    targetName: followupTargetName,
    targetType: followupTargetName ? 'followup_target' : '',
    cityId: currentCityIdOf(state),
    cityName,
    outcomes: followupTargetName ? ['plot', 'relation'] : ['plot'],
    noveltyKey: `followup:${action.kind}:${followupTargetName || currentCityIdOf(state)}`,
    source: 'followup',
    weight: 104,
    localChoice
  });
}

function buildMainlineFrontier(state) {
  const world = state && state.world ? state.world : {};
  const memory = state && state.memory ? state.memory : {};
  const topThread = ensureList(memory.openThreads)[0] || null;
  const mainline = world.mainline || {};
  const title = normalizeSnippet((topThread && topThread.title) || mainline.title || world.objective || '主线推进', '主线推进');
  const summary = normalizeSnippet(
    (topThread && topThread.title)
      ? `眼下压得最前的线头是“${topThread.title}”。如果这条线一直悬着不落地，后面的局只会越拖越散。`
      : (mainline.summary || world.objective || '这一阶段必须先把最核心的局势往前推下去。'),
    '这一阶段最要紧的，仍然是把真正压在眼前的局往前推进。'
  );
  const kinds = worldMainlineFocusKinds(state);
  const kind = kinds[0] || 'investigate';
  const cityName = currentCityNameOf(state) || '此地';
  const localChoice = buildMainlineSeed(title, kind);
  return makeFrontier({
    id: `frontier:mainline:${encodeURIComponent(title)}`,
    type: 'mainline',
    title,
    summary,
    reason: `当前阶段主线是“${mainline.title || '立足起势'}”，且待续线头仍在前排。`,
    domain: '主线',
    risk: 'medium',
    slotBiases: ['mainline'],
    recommendedKinds: kinds.length ? kinds : ['investigate', 'diplomacy', 'govern'],
    cityId: currentCityIdOf(state),
    cityName,
    outcomes: ['plot', 'resource'],
    noveltyKey: `mainline:${encodeURIComponent(title)}`,
    source: 'mainline',
    weight: 94,
    deadlineTurn: Number(topThread && topThread.deadlineTurn || 0),
    currentTurn: Number(world.turn || 0),
    localChoice
  });
}

function buildChosenBranchFrontier(state, action) {
  const chosen = lastSelectedDynamicChoice(state);
  if (!chosen || !chosen.actionText) return null;
  const anchor = compactFrontierLabel(chosen.text || chosen.targetName || chosen.actionText, '前线');
  const kinds = uniqueStrings([chosen.actionKind].concat(followupKindsForAction(chosen.actionKind))).filter(Boolean);
  const domain = normalizeActionDomain(chosen.actionKind);
  const chosenSeedSource = `${chosen.frontierId || chosen.noveltyKey || chosen.actionText}:${anchor}`;
  const chosenTitle = pickSeedVariant(chosenSeedSource, [
    `${anchor}这条线还在往前滚`,
    `${anchor}后头还有下一步`,
    `谁会接住${anchor}这手`
  ]);
  const chosenLocalChoice = pickSeedVariant(chosenSeedSource, [
    actionChoiceSeed(
      `顺着${anchor}再追一层`,
      `顺着刚刚亲手压下去的“${chosen.text || anchor}”继续往前，把已经露头的人情、阻力、价码或暗涌再往深处追一层`,
      '既然上一回已经押了这条线，真正有趣的不是换题，而是看它接下来会怎么反咬、松动或开口。',
      chosen.actionKind || 'social',
      domain
    ),
    actionChoiceSeed(
      `盯紧${anchor}下一手`,
      `别让“${chosen.text || anchor}”只停在展示层面，继续盯着它后头的人和事，看看下一手会先从哪里冒出来`,
      '真正被玩家选中的分支，不该只是亮过一次，而该继续长出后果。',
      chosen.actionKind || 'social',
      domain
    )
  ]);
  return makeFrontier({
    id: `frontier:chosen:${encodeURIComponent(chosen.frontierId || chosen.noveltyKey || chosen.actionText)}`,
    type: 'chosen_branch',
    title: chosenTitle,
    summary: `你上一回真正押下去的是“${chosen.text || anchor}”。这不是展示过的一堆备选，而是已经被你亲手续上的分支，下一轮规划理应先承接它留下的热度、阻力与后果。`,
    reason: `玩家上一回实际选择的动态分支是“${chosen.text || chosen.actionText}”。`,
    domain,
    risk: chosen.slotRole === 'wild' ? 'high' : (chosen.slotRole === 'moral' ? 'medium' : 'low'),
    slotBiases: uniqueStrings([chosen.slotRole || 'normal', 'normal']),
    recommendedKinds: kinds.length ? kinds : [chosen.actionKind || 'social'],
    targetId: chosen.targetId || '',
    targetName: chosen.targetName || '',
    targetType: chosen.targetName ? 'chosen_target' : '',
    cityId: currentCityIdOf(state),
    cityName: currentCityNameOf(state),
    outcomes: ensureList(chosen.outcomes).length ? ensureList(chosen.outcomes) : ['plot'],
    noveltyKey: chosen.noveltyKey || `chosen:${chosen.actionKind}:${chosen.targetName || anchor}`,
    source: 'chosen_branch',
    weight: String(action && action.source || '') === 'dynamic' ? 138 : 126,
    localChoice: chosenLocalChoice
  });
}

function buildDramaticResidueFrontiers(state) {
  const layer = state && state.gameState && state.gameState.dramaticLayer
    ? state.gameState.dramaticLayer
    : null;
  if (!layer) return [];
  const question = normalizeSnippet(layer.activeQuestion || '');
  const residues = ensureList(layer.sceneResidue).map((item) => normalizeSnippet(item, '')).filter(Boolean).slice(0, 2);
  const lastMeta = layer.lastMeta || {};
  const carryKind = String(lastMeta.actionKind || '').trim() || 'social';
  const carryDomain = normalizeActionDomain(carryKind);
  const next = [];
  if (question) {
    const anchor = compactFrontierLabel(question, '悬念');
    const questionSeedSource = `${anchor}:${carryKind}:${question}`;
    const questionTitle = pickSeedVariant(questionSeedSource, [
      `谁来回答${anchor}`,
      `${anchor}该落到谁头上`,
      `${anchor}还会逼谁开口`
    ]);
    const questionLocalChoice = pickSeedVariant(questionSeedSource, [
      actionChoiceSeed(
        `围着${anchor}再逼半步`,
        `围着“${question}”再往前逼半步，看这层迟迟悬着的问题到底会先从谁身上裂开`,
        '真正好看的戏，不是把问题说出来，而是看它悬着不落时如何逼人露出本相。',
        carryKind,
        carryDomain
      ),
      actionChoiceSeed(
        `看看谁先回${anchor}`,
        `盯着“${question}”继续往前推，看谁最先扛不住这层压力，主动给出回应`,
        '问题一旦压到场上，迟早会有人先接不住。',
        carryKind,
        carryDomain
      )
    ]);
    next.push(makeFrontier({
      id: `frontier:dramatic:question:${encodeURIComponent(anchor)}`,
      type: 'dramatic',
      title: questionTitle,
      summary: `本场戏真正还在发热的问题是“${question}”。只要它还悬着，后续动态选项就不该完全另起炉灶。`,
      reason: '戏剧层 activeQuestion 仍未收束，应继续影响下一轮动态规划。',
      domain: carryDomain,
      risk: 'medium',
      slotBiases: ['followup', 'mainline'],
      recommendedKinds: followupKindsForAction(carryKind),
      cityId: currentCityIdOf(state),
      cityName: currentCityNameOf(state),
      outcomes: ['plot', 'relation'],
      noveltyKey: `dramatic:question:${anchor}`,
      source: 'dramatic',
      weight: 116,
      localChoice: questionLocalChoice
    }));
  }
  residues.forEach((residue, index) => {
    const anchor = compactFrontierLabel(residue, '这事');
    const residueSeedSource = `${anchor}:${carryKind}:${index}:${residue}`;
    const residueLocalChoice = pickSeedVariant(residueSeedSource, [
      actionChoiceSeed(
        `追问${anchor}先落谁头上`,
        `顺着“${residue}”继续往前探，看这层余势会先压到谁头上，又会逼谁先表态`,
        '真正有分量的后续，不是主线硬拽出来的，而是上一场留下的动静逼人先开口。',
        carryKind,
        carryDomain
      ),
      actionChoiceSeed(
        `看看${anchor}还会咬谁`,
        `盯着“${residue}”后头还在发热的那层暗潮，看看接下来是谁先被卷进去`,
        '一场戏结束后最有趣的，常常不是结果本身，而是谁会被它反咬第二口。',
        carryKind,
        carryDomain
      ),
      actionChoiceSeed(
        `沿着${anchor}再摸半步`,
        `别让“${residue}”只停在背景里，顺着它再往前摸半步，把会继续发酵的人和事拎出来`,
        '这类残响最怕被一笔带过，真接上去，往往能顺手拽出下一场戏。',
        carryKind,
        carryDomain
      )
    ]);
    const residueTitle = pickSeedVariant(residueSeedSource, [
      `${anchor}这事还没完`,
      `谁还在盯着${anchor}`,
      `${anchor}后头有人要动`
    ]);
    next.push(makeFrontier({
      id: `frontier:dramatic:residue:${index}:${encodeURIComponent(anchor)}`,
      type: 'dramatic',
      title: residueTitle,
      summary: `上一场留下的余波是“${residue}”。它可能不是主线标题，却会实打实改变眼前人心、风声与下一步风险。`,
      reason: '戏剧层 sceneResidue 仍在冒热气，应作为新动态选项的重要来源。',
      domain: carryDomain,
      risk: index === 0 ? 'medium' : 'low',
      slotBiases: ['followup', 'wildcard'],
      recommendedKinds: uniqueStrings([carryKind].concat(followupKindsForAction(carryKind))),
      cityId: currentCityIdOf(state),
      cityName: currentCityNameOf(state),
      outcomes: ['plot', 'new_relation'],
      noveltyKey: `dramatic:residue:${anchor}`,
      source: 'dramatic',
      weight: 108 - (index * 4),
      localChoice: residueLocalChoice
    }));
  });
  return next.slice(0, 2);
}

function normalizeFrontierSlotBiases(slotBiases, source = '') {
  const mapped = uniqueStrings(ensureList(slotBiases).map((item) => {
    const raw = String(item || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw === 'normal' || raw === 'moral' || raw === 'wild') return raw;
    if (raw === 'mainline' || raw === 'followup') return 'normal';
    if (raw === 'wildcard') return 'wild';
    return '';
  }));
  if (mapped.length) return mapped;
  if (['moral_debt', 'promise_debt', 'faction_watch'].includes(source)) return ['moral'];
  if (['scene_residue', 'rumor_heat', 'shock_tag'].includes(source)) return ['wild'];
  return ['normal'];
}

function frontierRiskByWeight(value, mediumThreshold = 46, highThreshold = 72) {
  const next = Number(value || 0);
  if (next >= highThreshold) return 'high';
  if (next >= mediumThreshold) return 'medium';
  return 'low';
}

function lastConsequenceLedgerOf(state) {
  return state && state.gameState ? state.gameState.lastConsequenceLedger || null : null;
}

function buildConsequenceFrontiers(state, action) {
  const ledger = lastConsequenceLedgerOf(state);
  if (!ledger) return [];
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state) || '此地';
  const actionKind = normalizeSnippet(ledger.action && ledger.action.kind || action && action.kind || '', 'social');
  const domain = normalizeActionDomain(actionKind);
  return ensureList(ledger.consequences).slice(0, 3).map((item, index) => {
    const text = normalizeSnippet(item && item.text || '', '');
    if (!text) return null;
    const intensity = Number(item && item.intensity || 0);
    const anchor = compactFrontierLabel(text, '余波');
    return makeFrontier({
      id: `frontier:consequence:${ledger.turn || 0}:${index}:${encodeURIComponent(anchor)}`,
      type: 'consequence',
      title: `${anchor}这层余波还没落地`,
      summary: `这一回已经发生的“${text}”不会就此消散，它会继续把人物态度、消息风向或下一步空间往某个方向推。`,
      reason: `刚刚裁定出的结果余波仍在发热：${text}`,
      domain,
      risk: frontierRiskByWeight(intensity, 42, 74),
      slotBiases: ['normal', intensity >= 70 ? 'wild' : ''],
      recommendedKinds: uniqueStrings([actionKind].concat(followupKindsForAction(actionKind))),
      targetName: normalizeSnippet(ledger.action && ledger.action.targetName || ''),
      targetType: 'consequence',
      cityId,
      cityName,
      outcomes: ['plot', 'relation'],
      noveltyKey: `consequence:${ledger.turn || 0}:${anchor}`,
      source: 'consequence',
      weight: 118 + Math.min(18, Math.round(intensity / 6)),
      localChoice: actionChoiceSeed(
        `顺着${anchor}再压一手`,
        `别让“${text}”只停在这一回，顺着它留下的余波继续去碰人、碰话或碰后手，把下一层反应逼出来。`,
        '真正会长戏的，不是结果本身，而是结果之后谁先沉不住气。',
        actionKind,
        domain,
        {
          target: normalizeSnippet(ledger.action && ledger.action.targetId || ''),
          targetName: normalizeSnippet(ledger.action && ledger.action.targetName || ''),
          targetType: 'consequence'
        }
      )
    });
  }).filter(Boolean);
}

function buildSoftStateFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const softState = ensureSoftState(gs);
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state) || '此地';
  const frontiers = [];

  ensureList(softState.unfinishedMoves).slice(0, 2).forEach((item, index) => {
    const anchor = compactFrontierLabel(item && item.label || item && item.targetName || '', '这条线');
    const actionKind = normalizeSnippet(item && item.actionKind || '', 'social');
    frontiers.push(makeFrontier({
      id: `frontier:unfinished:${encodeURIComponent(item && item.id || `${index}:${anchor}`)}`,
      type: 'unfinished_move',
      title: `${anchor}这条线还没收口`,
      summary: `上一轮已经撬开的“${item && item.label || anchor}”仍挂在场上。如果继续晾着，它会从机会变成压力。`,
      reason: `未收口动作仍在逼近：${item && item.label || anchor}`,
      domain: normalizeActionDomain(actionKind),
      risk: frontierRiskByWeight(item && item.heat || 0, 45, 72),
      slotBiases: ['normal', Number(item && item.urgency || 0) >= 3 ? 'moral' : ''],
      recommendedKinds: uniqueStrings([actionKind].concat(followupKindsForAction(actionKind))),
      targetId: normalizeSnippet(item && item.targetId || ''),
      targetName: normalizeSnippet(item && item.targetName || ''),
      targetType: 'unfinished_move',
      cityId,
      cityName,
      outcomes: ['plot', 'relation'],
      noveltyKey: `unfinished:${item && item.id || anchor}`,
      source: 'unfinished_move',
      weight: 126 + Number(item && item.heat || 0),
      deadlineTurn: Number(item && item.deadlineTurn || 0),
      currentTurn: Number(state && state.world && state.world.turn || 0),
      localChoice: actionChoiceSeed(
        `把${anchor}这线收口`,
        `顺着“${item && item.label || anchor}”再追一手，把还悬着的人、话或口子尽快收成能继续推进的局面。`,
        '当一条线已经被你亲手撬开，再放着不管，代价往往比硬接更高。',
        actionKind,
        normalizeActionDomain(actionKind),
        {
          target: normalizeSnippet(item && item.targetId || ''),
          targetName: normalizeSnippet(item && item.targetName || ''),
          targetType: 'unfinished_move'
        }
      )
    }));
  });

  ensureList(softState.promiseDebt).slice(0, 2).forEach((item, index) => {
    const anchor = compactFrontierLabel(item && item.label || item && item.targetName || '', '承诺');
    frontiers.push(makeFrontier({
      id: `frontier:promise:${encodeURIComponent(item && item.id || `${index}:${anchor}`)}`,
      type: 'promise_debt',
      title: `${anchor}这笔承诺还挂着`,
      summary: `你已经应下的“${item && item.label || anchor}”还没有兑付。若继续拖着，关系和名声都会开始转坏。`,
      reason: `先前答应下来的账正在回头找你：${item && item.label || anchor}`,
      domain: '人物',
      risk: frontierRiskByWeight(item && item.value || 0, 38, 70),
      slotBiases: ['moral', 'normal'],
      recommendedKinds: ['social', 'diplomacy', 'investigate'],
      targetId: normalizeSnippet(item && item.targetId || ''),
      targetName: normalizeSnippet(item && item.targetName || ''),
      targetType: 'promise_debt',
      cityId,
      cityName,
      outcomes: ['relation', 'plot'],
      noveltyKey: `promise:${item && item.id || anchor}`,
      source: 'promise_debt',
      weight: 114 + Number(item && item.value || 0),
      localChoice: actionChoiceSeed(
        `先还${anchor}这笔账`,
        `去把“${item && item.label || anchor}”补上，哪怕要先舍出别的好处，也别让应下的话继续空着。`,
        '承诺最值钱的时候不是说出口，而是你愿不愿意真的拿手里的东西去兑。',
        'social',
        '人物',
        {
          target: normalizeSnippet(item && item.targetId || ''),
          targetName: normalizeSnippet(item && item.targetName || ''),
          targetType: 'promise_debt'
        }
      )
    }));
  });

  ensureList(softState.moralDebt).slice(0, 2).forEach((item, index) => {
    const anchor = compactFrontierLabel(item && item.label || item && item.targetName || '', '脏账');
    frontiers.push(makeFrontier({
      id: `frontier:moral:${encodeURIComponent(item && item.id || `${index}:${anchor}`)}`,
      type: 'moral_debt',
      title: `${anchor}这笔脏账在回头咬人`,
      summary: `你已经为推进局势留下了一笔“${item && item.label || anchor}”式的脏账。现在继续往前，就得决定谁来替它埋单。`,
      reason: `前一手留下的道德代价还在追着局面走：${item && item.label || anchor}`,
      domain: '人物',
      risk: frontierRiskByWeight(item && item.value || 0, 34, 64),
      slotBiases: ['moral'],
      recommendedKinds: ['social', 'intrigue', 'diplomacy'],
      targetId: normalizeSnippet(item && item.targetId || ''),
      targetName: normalizeSnippet(item && item.targetName || ''),
      targetType: 'moral_debt',
      cityId,
      cityName,
      outcomes: ['relation', 'plot'],
      noveltyKey: `moral:${item && item.id || anchor}`,
      source: 'moral_debt',
      weight: 124 + Number(item && item.value || 0),
      localChoice: actionChoiceSeed(
        `拿${anchor}继续换局`,
        `明知“${item && item.label || anchor}”这笔账还没洗干净，仍旧决定把它再往前推一步，让某个人、某层名声或某桩情义替你吃下后果。`,
        '这一步的核心不是风险，而是你必须明确决定谁来替局势付那笔不干净的价。',
        'intrigue',
        '人物',
        {
          target: normalizeSnippet(item && item.targetId || ''),
          targetName: normalizeSnippet(item && item.targetName || ''),
          targetType: 'moral_debt'
        }
      )
    }));
  });

  ensureList(softState.factionWatch).slice(0, 2).forEach((item, index) => {
    const anchor = compactFrontierLabel(item && item.targetName || item && item.note || '', '势力');
    frontiers.push(makeFrontier({
      id: `frontier:factionwatch:${encodeURIComponent(item && item.id || `${index}:${anchor}`)}`,
      type: 'faction_watch',
      title: `${anchor}已经开始盯你`,
      summary: `${item && item.targetName || anchor}正在盯着你最近这一串动作。接下来无论示好、敲打还是利用，都能立刻改变它的站位。`,
      reason: `势力警觉度正在上升：${item && (item.note || item.targetName) || anchor}`,
      domain: '局势',
      risk: frontierRiskByWeight(item && item.value || 0, 40, 68),
      slotBiases: ['moral', 'wild'],
      recommendedKinds: ['diplomacy', 'intrigue', 'investigate'],
      targetId: normalizeSnippet(item && item.targetId || ''),
      targetName: normalizeSnippet(item && item.targetName || ''),
      targetType: 'faction_watch',
      cityId,
      cityName,
      outcomes: ['plot', 'relation'],
      noveltyKey: `factionwatch:${item && item.id || anchor}`,
      source: 'faction_watch',
      weight: 108 + Number(item && item.value || 0),
      localChoice: actionChoiceSeed(
        `先试${anchor}的底线`,
        `趁${item && item.targetName || anchor}还只是盯着你，先递一句试探、放一点假风声，或者逼它表态，别等它先动手。`,
        '被盯上之后最危险的不是敌意，而是你根本不知道它准备从哪一面下嘴。',
        'diplomacy',
        '局势',
        {
          target: normalizeSnippet(item && item.targetId || ''),
          targetName: normalizeSnippet(item && item.targetName || ''),
          targetType: 'faction_watch'
        }
      )
    }));
  });

  ensureList(softState.rumorHeat).slice(0, 2).forEach((item, index) => {
    const anchor = compactFrontierLabel(item && item.label || item && item.cityName || '', '风声');
    frontiers.push(makeFrontier({
      id: `frontier:rumor:${encodeURIComponent(item && item.id || `${index}:${anchor}`)}`,
      type: 'rumor_heat',
      title: `${anchor}这阵风声正热`,
      summary: `城里关于“${item && item.label || anchor}”的风声还没散。谁先借它做事，谁就能把局面拧向自己要的方向。`,
      reason: `流言热度还在上升：${item && item.label || anchor}`,
      domain: '局势',
      risk: frontierRiskByWeight(item && item.value || 0, 36, 66),
      slotBiases: ['wild', 'normal'],
      recommendedKinds: ['social', 'intrigue', 'diplomacy'],
      cityId: normalizeSnippet(item && item.cityId || cityId),
      cityName: normalizeSnippet(item && item.cityName || cityName),
      outcomes: ['plot', 'relation'],
      noveltyKey: `rumor:${item && item.id || anchor}`,
      source: 'rumor_heat',
      weight: 104 + Number(item && item.value || 0),
      localChoice: actionChoiceSeed(
        `借${anchor}做一手文章`,
        `趁“${item && item.label || anchor}”这阵风声最热，顺势放话、借题、做局，逼想躲的人先露口风。`,
        '流言真正值钱的时机，不在它最响，而在别人还来不及统一说法的时候。',
        'intrigue',
        '局势'
      )
    }));
  });

  ensureList(softState.sceneResidues).slice(0, 2).forEach((item, index) => {
    const anchor = compactFrontierLabel(item && item.label || '', '余波');
    frontiers.push(makeFrontier({
      id: `frontier:residue:${encodeURIComponent(item && item.id || `${index}:${anchor}`)}`,
      type: 'scene_residue',
      title: `${anchor}这一层还在发热`,
      summary: `上一幕留下的“${item && item.label || anchor}”还在空气里发热。若立刻接它，往往能长出比正面推进更怪、更生动的一手。`,
      reason: `场景残响尚未退去：${item && item.label || anchor}`,
      domain: normalizeSnippet(item && item.domain || '局势', '局势'),
      risk: frontierRiskByWeight(item && item.heat || 0, 34, 62),
      slotBiases: ['wild'],
      recommendedKinds: ['social', 'intrigue', 'jianghu', 'travel'],
      cityId,
      cityName,
      outcomes: ['plot'],
      noveltyKey: `residue:${item && item.id || anchor}`,
      source: 'scene_residue',
      weight: 110 + Number(item && item.heat || 0),
      localChoice: actionChoiceSeed(
        `顺着${anchor}闹出下一拍`,
        `别让这层“${item && item.label || anchor}”白白凉掉，顺着它再做一手更偏、更怪、但更容易出戏的动作。`,
        '有些好戏不是从主线里长出来的，而是从刚刚还没冷掉的残响里拐出来的。',
        'jianghu',
        normalizeSnippet(item && item.domain || '局势', '局势')
      )
    }));
  });

  ensureList(softState.personalMomentum).slice(0, 2).forEach((item, index) => {
    const domain = normalizeSnippet(item && item.domain || '', '局势');
    const value = Number(item && item.value || 0);
    const anchor = compactFrontierLabel(item && item.note || domain, domain);
    frontiers.push(makeFrontier({
      id: `frontier:momentum:${encodeURIComponent(`${index}:${domain}:${anchor}`)}`,
      type: 'momentum',
      title: `${domain}这股手感还在`,
      summary: value >= 0
        ? `这一回在${domain}上的手感还没断。趁热接一手，往往能把优势滚成更大的变化。`
        : `${domain}这条线的手感已经发虚。下一手若还硬压，代价会更重，得换个更聪明的切口。`,
      reason: `个人势头仍在影响下一手：${item && item.note || domain}`,
      domain,
      risk: value >= 0 ? 'low' : 'medium',
      slotBiases: value >= 0 ? ['normal'] : ['wild'],
      recommendedKinds: domain === '军旅'
        ? ['military', 'investigate']
        : (domain === '人物' ? ['social', 'diplomacy'] : ['investigate', 'trade', 'travel']),
      cityId,
      cityName,
      outcomes: ['plot'],
      noveltyKey: `momentum:${domain}:${anchor}`,
      source: 'momentum',
      weight: 92 + Math.abs(value),
      localChoice: actionChoiceSeed(
        value >= 0 ? `趁着${domain}手感再进半步` : `换个切口修${domain}这口气`,
        value >= 0
          ? `趁${domain}这股手感还在，再往前压半步，把刚起的势直接滚成新的主动。`
          : `别沿着刚吃瘪的那条路硬顶，先换个切口把${domain}这口气调回来。`,
        value >= 0 ? '势头最值钱的时候，就是别人还没看清它会继续往哪边滚。' : '手感一虚时最忌继续硬推，换刀口反而更容易把局面救回来。',
        domain === '军旅' ? 'military' : (domain === '人物' ? 'social' : 'investigate'),
        domain
      )
    }));
  });

  ensureList(softState.recentShockTags).slice(0, 2).forEach((tag, index) => {
    const labelMap = {
      military_pressure: '兵势绷紧',
      hidden_tension: '暗线紧绷',
      human_pressure: '人情发紧',
      body_cost: '身体见底',
      failed_push: '硬推失手',
      strong_turn: '势头正盛'
    };
    const label = labelMap[String(tag || '').trim()] || normalizeSnippet(tag || '', '异样动静');
    frontiers.push(makeFrontier({
      id: `frontier:shock:${encodeURIComponent(`${index}:${tag}`)}`,
      type: 'shock_tag',
      title: `${label}这口气还在顶着`,
      summary: `这一回留下的“${label}”还在顶着场面。若直接借它做事，下一手通常会比常规推进更怪也更有变化。`,
      reason: `本回合留下的强烈标签仍未消退：${label}`,
      domain: '局势',
      risk: tag === 'failed_push' || tag === 'body_cost' ? 'high' : 'medium',
      slotBiases: tag === 'strong_turn' ? ['normal', 'wild'] : ['wild'],
      recommendedKinds: ['intrigue', 'jianghu', 'travel', 'social'],
      cityId,
      cityName,
      outcomes: ['plot'],
      noveltyKey: `shock:${tag}`,
      source: 'shock_tag',
      weight: 102 + (tag === 'strong_turn' ? 12 : 0),
      localChoice: actionChoiceSeed(
        `借${label}反做一手`,
        `别急着把“${label}”压下去，先顺着这股不稳、不顺或正旺的气做一手反常动作，看能不能直接把局势拧弯。`,
        '越是刚出过重手、失手或怪手的时候，越容易长出别人猜不到的下一拍。',
        'intrigue',
        '局势'
      )
    }));
  });

  return frontiers;
}

function buildEncounterFrontiers(state) {
  return buildEncounterChoiceLeads(state).map((item, index) => makeFrontier({
    id: `frontier:encounter:${item.id || index}`,
    type: 'encounter',
    title: normalizeSnippet(item.text, '奇遇线索'),
    summary: normalizeSnippet(item.hint || item.actionText || '奇遇已经露头，及时接住最容易把它做实。'),
    reason: '当前奇遇系统已有可接续的 lead。',
    domain: '奇遇',
    risk: 'medium',
    slotBiases: index === 0 ? ['followup', 'wildcard'] : ['wildcard'],
    recommendedKinds: [String(item.actionKind || 'social')],
    targetId: String(item.target || ''),
    targetName: normalizeSnippet(item.targetName || ''),
    targetType: String(item.targetType || ''),
    cityId: currentCityIdOf(state),
    cityName: currentCityNameOf(state),
    outcomes: ['encounter', item.targetName ? 'relation' : 'plot'],
    noveltyKey: `encounter:${item.id || encodeURIComponent(item.text || String(index))}`,
    source: 'encounter',
    weight: 108 - (index * 4),
    localChoice: actionChoiceSeed(item.text, item.actionText, item.hint, item.actionKind, item.category || '奇遇', {
      target: item.target || '',
      targetName: item.targetName || '',
      targetType: item.targetType || ''
    })
  }));
}

function buildHistoricalFrontiers(state) {
  const historicalBundle = buildHistoricalNarrativeBundle(state);
  return buildHistoricalChoiceLeads(state).map((item, index) => makeFrontier({
    id: `frontier:historical:${item.id || index}`,
    type: 'historical',
    title: normalizeSnippet(item.eventTitle || historicalBundle.activeText || historicalBundle.nearText, '史势回响'),
    summary: normalizeSnippet(item.hint || historicalBundle.activeText || historicalBundle.nearText || '这一步会继续牵动当前被推上台面的史势。'),
    reason: normalizeSnippet(historicalBundle.activeText || historicalBundle.nearText || '当前有可接续的历史事件压力。'),
    domain: '史势',
    risk: 'high',
    slotBiases: ['mainline', 'wildcard'],
    recommendedKinds: [String(item.actionKind || 'investigate')],
    cityId: currentCityIdOf(state),
    cityName: currentCityNameOf(state),
    outcomes: ['plot', 'faction'],
    noveltyKey: `historical:${item.id || encodeURIComponent(item.text || String(index))}`,
    source: 'historical',
    weight: 102 - (index * 5),
    localChoice: actionChoiceSeed(item.text, item.actionText, item.hint, item.actionKind, '史势')
  }));
}

function buildExtraCharacterSeed(item, cityName, actionKind) {
  const name = normalizeSnippet(item && item.name || '', '此人');
  const seedSource = `${item && item.id || name}:${actionKind}:${cityName}`;
  if (actionKind === 'romance') {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `约${name}私下见面`,
        `挑个不引人注目的时辰去见${name}，看看这段关系能不能从有好感往更深处试半步`,
        '感情线真正动人的地方，往往就在“要不要多走半步”的试探里。',
        'romance',
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      ),
      actionChoiceSeed(
        `陪${name}多坐一会`,
        `去找${name}单独坐坐，把最近绕着没说开的那层心事慢慢引出来`,
        '越是将要生根的关系，越需要一段能慢慢把话说开的时辰。',
        'romance',
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      )
    ]);
  }
  if (['investigate', 'intrigue'].includes(actionKind)) {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `探${name}近来替谁做事`,
        `顺着${cityName}里关于${name}的门路摸过去，看看他近来究竟在替哪边做事，又在躲哪边的眼睛`,
        '这种人物最值钱的，往往不是认识本身，而是他现在正站在谁的局边上。',
        actionKind,
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      ),
      actionChoiceSeed(
        `问${name}手里压着谁的信`,
        `去找${name}探一探，看他最近替谁传话、替谁遮事，顺便摸清他手里压着哪一层消息`,
        '真消息经常不在明面上，而是压在这种人手里没往外说。',
        actionKind,
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      )
    ]);
  }
  if (['jianghu', 'martial'].includes(actionKind)) {
    return pickSeedVariant(seedSource, [
      actionChoiceSeed(
        `找${name}当面过一招`,
        `直接去会一会${name}，在拳脚与分寸里看看这人到底是能交、能用，还是另有火气`,
        '江湖人物未必认寒暄，但很认眼前这一口真功夫和胆色。',
        actionKind,
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      ),
      actionChoiceSeed(
        `跟${name}走一趟街面`,
        `在${cityName}街巷里跟着${name}走一趟，看看他平日和谁来往、又是谁见了他会主动让路`,
        '有些江湖人的底色，不在名号里，而在他走过一条街时旁人的反应里。',
        actionKind,
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      )
    ]);
  }
  return pickSeedVariant(seedSource, [
    actionChoiceSeed(
      `去见${name}`,
      `主动去见${name}，别只停在听说与风闻上，直接看看这人眼下愿不愿意把话说到实处`,
      '人物线真正立起来，往往都要过一回当面。',
      actionKind,
      '人物',
      { target: item.id || '', targetName: name, targetType: 'relation' }
    ),
    actionChoiceSeed(
      `和${name}单独谈谈`,
      `找个不受打扰的时机和${name}单独谈一谈，看看能不能把这层关系往前推成真正可用的一线`,
      '空有认识不值钱，能谈成章程才值钱。',
      actionKind,
      '人物',
      { target: item.id || '', targetName: name, targetType: 'relation' }
    )
  ]);
}

function buildExtraCharacterFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state) || '此地';
  return ensureList(gs.relationships)
    .filter((item) => item && item.isExtraCharacter && isRelationMet(item))
    .filter((item) => item && item.name && !looksLikeInternalEntityId(item.name))
    .filter((item) => ensureList(item.homeCities).includes(cityId))
    .slice()
    .sort((a, b) => relationScore(b) - relationScore(a))
    .slice(0, 3)
    .map((item, index) => {
      const kinds = recommendedKindsFromTags(item.tags);
      const actionKind = kinds[0] || 'social';
      const extraSeed = buildExtraCharacterSeed(item, cityName, actionKind);
      return makeFrontier({
        id: `frontier:extra:${item.id || encodeURIComponent(item.name || String(index))}`,
        type: 'extra_relation',
        title: extraSeed.text,
        summary: `${item.name}本就在${cityName}一带活动。与其继续隔着风闻打转，不如主动去见，把对方眼下的态度、门路和站位摸到手里。`,
        reason: `追加人物${item.name}与当前城市${cityName}绑定。`,
        domain: '人物',
        risk: 'medium',
        slotBiases: ['followup', 'wildcard'],
        recommendedKinds: kinds.length ? kinds : [actionKind, 'social'],
        targetId: String(item.id || ''),
        targetName: normalizeSnippet(item.name || ''),
        targetType: 'relation',
        cityId,
        cityName,
        outcomes: ['relation', 'plot'],
        noveltyKey: `extra:${item.id || item.name}:met`,
        source: 'extra_character',
        weight: 94 - (index * 3),
        localChoice: extraSeed
      });
    });
}

function buildRelationFrontierSeed(item) {
  const name = normalizeSnippet(item && item.name || '', '此人');
  const tags = ensureList(item && item.tags);
  const affection = Number(item && item.affection || 0);
  const trust = Number(item && item.trust || 0);
  const seedSource = `${item && item.id || name}:${tags.join('|')}:${affection}:${trust}`;

  if (item && item.romanceable === false) {
    return pickSeedVariant(seedSource, [
      {
        title: `和${name}对明条件`,
        summary: `${name}这条人物线更适合走利益、试探与并肩，不适合往情爱上硬推。先把关系里的站位和章程对明更值钱。`,
        actionKind: trust >= 14 ? 'diplomacy' : 'social',
        localChoice: actionChoiceSeed(
          `和${name}对明条件`,
          `去见${name}，把眼下最要紧的一层人情和利害摊开说，看看双方能不能把条件、边界和帮手对明白`,
          '有些关系真正值钱的地方不在暧昧，而在能不能谈成并肩的章程。',
          trust >= 14 ? 'diplomacy' : 'social',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      }
    ]);
  }

  if (affection >= 14 || tags.includes('romance')) {
    return pickSeedVariant(seedSource, [
      {
        title: `和${name}把话说深`,
        summary: `${name}这条人物线已经带了私心与回响，眼下若把话往更深处说透，最容易让这段关系从有温度变成真牵挂。`,
        actionKind: 'romance',
        localChoice: actionChoiceSeed(
          `和${name}把话说深`,
          `挑个只有我和${name}能慢慢把话说透的时机，把这段关系里还没挑明的真心和顾虑都摊到台面上`,
          '情分最值钱的时候，往往就是双方都还没把那层纸彻底捅破的时候。',
          'romance',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `陪${name}坐到夜深`,
        summary: `${name}这一线已经不只剩表面寒暄。若肯陪对方把夜色坐深，很多原本不好开口的真意都会自己浮出来。`,
        actionKind: 'romance',
        localChoice: actionChoiceSeed(
          `陪${name}坐到夜深`,
          `找个不受人打扰的时辰陪${name}慢慢坐下，把彼此都绕着不说的那点牵挂一步步引出来`,
          '感情线真正起势的时候，往往不是轰轰烈烈，而是终于有人肯多坐一刻钟。',
          'romance',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `替${name}解开心结`,
        summary: `${name}心里像还压着一层没说出来的结。顺着这一点去碰，关系最容易从暧昧和好感走向真正的牵系。`,
        actionKind: 'romance',
        localChoice: actionChoiceSeed(
          `替${name}解开心结`,
          `顺着${name}最近露出的迟疑和顾虑慢慢往里问，看能不能替对方把压在心里的那层结解开`,
          '能被记住的，从来不是说过多少好听话，而是谁真正替人解开过心结。',
          'romance',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      }
    ]);
  }

  if (tags.some((tag) => ['strategy', 'investigate', 'intrigue', 'courtcraft', 'govern'].includes(tag))) {
    return pickSeedVariant(seedSource, [
      {
        title: `请${name}校一校旧案`,
        summary: `${name}不是只会寒暄的人。这条线继续往里校，很可能直接校出旧案、后手或能改局的一层暗门。`,
        actionKind: 'investigate',
        localChoice: actionChoiceSeed(
          `请${name}校一校旧案`,
          `去见${name}，顺着他熟的旧账、旧人和旧案慢慢校，看能不能校出真正能改局的错口和后手`,
          '有的人值钱，不在于情分厚，而在于他知道哪一页旧案一翻就会响。',
          'investigate',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `和${name}对盘旧账`,
        summary: `${name}这条人物线擅长看账外之账。若肯坐下来对盘，很多遮着的旧账和暗线都会露出轮廓。`,
        actionKind: 'investigate',
        localChoice: actionChoiceSeed(
          `和${name}对盘旧账`,
          `找${name}把旧账、旧人和旧线头摆在一处对盘，看看哪一层最值得先拆开`,
          '旧账最怕被单独看，真要找关节，往往得把几盘账一起对起来。',
          'investigate',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `借${name}拆开暗线`,
        summary: `${name}看得懂表面之下那层暗线。顺着他去拆，能比平推更快碰到真正改变剧情的机关。`,
        actionKind: 'intrigue',
        localChoice: actionChoiceSeed(
          `借${name}拆开暗线`,
          `去见${name}，顺着他掌握的旧线头把眼下藏着的暗线一层层拆开，看谁在背后真正落子`,
          '真会看局的人，不是看得多，而是知道先拆哪一层线。',
          'intrigue',
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      }
    ]);
  }

  if (tags.some((tag) => ['martial', 'jianghu', 'battle', 'warpath', 'frontier'].includes(tag))) {
    const actionKind = tags.includes('jianghu') ? 'jianghu' : 'social';
    return pickSeedVariant(seedSource, [
      {
        title: `约${name}并肩试局`,
        summary: `${name}这一线更适合在真本事、真胆气和真场面里见分晓。若主动并肩碰一次硬的，关系和江湖盘面都会同时起波澜。`,
        actionKind,
        localChoice: actionChoiceSeed(
          `约${name}并肩试局`,
          `把${name}约到能见真章的地方并肩走一回，看这一线到底会滚成知己、对手还是新的江湖门路`,
          '有些人不靠聊熟，只能靠真本事和真胆气把关系硬碰出来。',
          actionKind,
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `同${name}试招定交`,
        summary: `${name}更认招数、胆气和临场反应。若先在拳脚刀兵里见一次人，关系反而会比闲谈走得更快。`,
        actionKind,
        localChoice: actionChoiceSeed(
          `同${name}试招定交`,
          `找个能放开手脚的地方和${name}过一回招，看看这一线是会打成朋友，还是碰出新的恩怨`,
          '江湖里最直白的问候，往往不是寒暄，而是先见一回手上分量。',
          actionKind,
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `与${name}走一趟险路`,
        summary: `${name}这一线未必要在桌上谈明，反而适合放进一段有风险的场面里看真章。`,
        actionKind,
        localChoice: actionChoiceSeed(
          `与${name}走一趟险路`,
          `拉上${name}一起去碰一段不好走的路，看看在真正见险的时候这段关系会长成什么模样`,
          '一起走过险路的人，关系总比坐着说出来的更硬一些。',
          actionKind,
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      }
    ]);
  }

  if (tags.some((tag) => ['trade', 'mercantile', 'govern', 'diplomacy'].includes(tag))) {
    const actionKind = tags.includes('trade') || tags.includes('mercantile') ? 'trade' : 'diplomacy';
    return pickSeedVariant(seedSource, [
      {
        title: `和${name}合盘一手`,
        summary: `${name}这条线不只是见面寒暄，更可能接到账、铺面、人手或地方运转的实盘。顺着去合盘，能把人物线直接做成筹码线。`,
        actionKind,
        localChoice: actionChoiceSeed(
          `和${name}合盘一手`,
          `去找${name}，把眼下最值钱的一盘账、人手或地方门路摆开合盘，看能不能把人情直接落成可用筹码`,
          '人情若能直接落到账和地盘上，后面的局就不只是好看，而是真的能动。',
          actionKind,
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `请${name}搭手管账`,
        summary: `${name}这条线更适合拿来接实务。若肯让对方搭手，人物关系和经营收益都能同时往前走。`,
        actionKind,
        localChoice: actionChoiceSeed(
          `请${name}搭手管账`,
          `去见${name}，请他一起搭手盘账、接人手或疏通门路，看能不能先把一处实务做顺`,
          '比起空口交情，能一起管过事的人更容易留下长久的后手。',
          actionKind,
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      },
      {
        title: `托${name}疏通市面`,
        summary: `${name}手上更像握着现成的市面和门路。顺着这点去接，很容易把人物线直接做成经营推进。`,
        actionKind,
        localChoice: actionChoiceSeed(
          `托${name}疏通市面`,
          `去找${name}，顺着他熟悉的铺面、人脉和往来去疏通一层市面，看能不能把局面做活`,
          '经营线真正起势，不在数字涨了多少，而在门路是不是开始自己转起来。',
          actionKind,
          '人物',
          { target: item.id || '', targetName: name, targetType: 'relation' }
        )
      }
    ]);
  }

  return pickSeedVariant(seedSource, [
    {
      title: `和${name}对明条件`,
      summary: `${name}这条人物线已经攥到手边，眼下最值钱的不是再寒暄一次，而是把站位、条件或帮手对得更明白。`,
      actionKind: trust >= 14 ? 'diplomacy' : 'social',
      localChoice: actionChoiceSeed(
        `和${name}对明条件`,
        `去见${name}，把眼下最要紧的一层人情和利害摊开说，看看双方能不能把条件、边界和帮手对明白`,
        '条件越早对明，后面能少掉的弯路就越多。',
        trust >= 14 ? 'diplomacy' : 'social',
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      )
    },
    {
      title: `请${name}给句准话`,
      summary: `${name}已经不是完全摸不清的人了。此时去要一句准话，比再铺垫半天更能推动关系向前。`,
      actionKind: trust >= 14 ? 'diplomacy' : 'social',
      localChoice: actionChoiceSeed(
        `请${name}给句准话`,
        `去见${name}，顺着最近这段来往把态度和站位问实，请对方给一句能落地的准话`,
        '人和关系真正往前走，往往靠的不是热闹，而是一句说出口就算数的话。',
        trust >= 14 ? 'diplomacy' : 'social',
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      )
    },
    {
      title: `与${name}定个章程`,
      summary: `${name}这一线已经到了可以谈章程的时候。若能从情分走到规则，这条人物线就会稳定得多。`,
      actionKind: trust >= 14 ? 'diplomacy' : 'social',
      localChoice: actionChoiceSeed(
        `与${name}定个章程`,
        `去找${name}把这段关系里该守的分寸、该给的帮手和后续怎么接都定个章程`,
        '很多关系会散，不是没有情分，而是始终没定下章程。',
        trust >= 14 ? 'diplomacy' : 'social',
        '人物',
        { target: item.id || '', targetName: name, targetType: 'relation' }
      )
    }
  ]);
}

function buildRelationFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  return ensureList(gs.relationships)
    .filter((item) => item && isRelationMet(item) && !item.isHistorical && !item.isExtraCharacter)
    .slice()
    .sort((a, b) => relationScore(b) - relationScore(a))
    .slice(0, 2)
    .map((item, index) => {
      const seed = buildRelationFrontierSeed(item);
      return makeFrontier({
        id: `frontier:relation:${item.id || encodeURIComponent(item.name || String(index))}`,
        type: 'relation',
        title: seed.title,
        summary: seed.summary,
        reason: `当前高关联人物为${item.name}。`,
        domain: '人物',
        risk: 'low',
        slotBiases: ['followup', 'wildcard'],
        recommendedKinds: uniqueStrings([seed.actionKind, 'social', 'diplomacy', 'romance']),
        targetId: String(item.id || ''),
        targetName: normalizeSnippet(item.name || ''),
        targetType: 'relation',
        cityId: currentCityIdOf(state),
        cityName: currentCityNameOf(state),
        outcomes: ['relation', 'plot'],
        noveltyKey: `relation:${item.id || item.name}:${seed.actionKind}`,
        source: 'relation',
        weight: 82 - (index * 3),
        localChoice: seed.localChoice
      });
    });
}

function buildFactionFrontierSeed(item, cityName) {
  const name = normalizeSnippet(item && item.name || '', '这股势力');
  const hostility = Number(item && item.hostility || 0);
  const favor = Number(item && item.favor || 0);
  const leverage = Number(item && item.leverage || 0);
  const power = Number(item && item.power || 0);
  const seedSource = `${item && item.id || name}:${hostility}:${favor}:${leverage}:${power}`;

  if (hostility >= Math.max(favor + 6, 28)) {
    return pickSeedVariant(seedSource, [
      {
        title: `拆${name}暗桩`,
        summary: `${name}眼下更像一把压在喉头的刀。若不先拆掉它最隐蔽的暗桩，后面的很多线都会被它反咬。`,
        actionKind: hostility >= 42 ? 'intrigue' : 'investigate',
        localChoice: actionChoiceSeed(
          `拆${name}暗桩`,
          `沿着${name}在${cityName}最倚重的人手与旧线摸进去，先把它眼下最不能见光的一处暗桩拆掉`,
          '真要防一股势，不是盯着它表面最热的一层，而是先拆掉它最怕人看见的地方。',
          hostility >= 42 ? 'intrigue' : 'investigate',
          '势力'
        )
      },
      {
        title: `截${name}粮路`,
        summary: `${name}这股势如今压得太近。若能先截住它赖以发力的粮口和供给，很多主动权会立刻回到自己手里。`,
        actionKind: hostility >= 42 ? 'intrigue' : 'investigate',
        localChoice: actionChoiceSeed(
          `截${name}粮路`,
          `顺着${name}在${cityName}一带倚重的粮口和往来摸过去，先试着截断它最要紧的一段供给`,
          '局面里最硬的反制，往往不是硬碰硬，而是先让对方失掉发力的底盘。',
          hostility >= 42 ? 'intrigue' : 'investigate',
          '势力'
        )
      },
      {
        title: `摸${name}短板`,
        summary: `${name}看着势大，但越大的势力越会藏短板。眼下若能先摸准那块最脆的地方，后续就不会被动。`,
        actionKind: 'investigate',
        localChoice: actionChoiceSeed(
          `摸${name}短板`,
          `沿着${name}最近出手最急的一层门路摸过去，看看它到底哪一处最怕被人点破`,
          '不是所有硬势都能正面推开，但几乎所有硬势都有不能碰的短板。',
          'investigate',
          '势力'
        )
      }
    ]);
  }

  if (favor >= Math.max(hostility, 10) || leverage >= 16) {
    return pickSeedVariant(seedSource, [
      {
        title: `和${name}换门路`,
        summary: `${name}这股势力眼下并非只可提防，也有可借之处。若能顺势换一层门路，能把地方风向、钱粮或人手往自己这边带。`,
        actionKind: favor >= leverage ? 'diplomacy' : 'trade',
        localChoice: actionChoiceSeed(
          `和${name}换门路`,
          `主动去接${name}的门路与牌面，看能不能在${cityName}换到一条对自己更有利的路`,
          '借势最好的时候，不是别人已经彻底站你这边，而是他还有余温、也还愿意听价的时候。',
          favor >= leverage ? 'diplomacy' : 'trade',
          '势力'
        )
      },
      {
        title: `借${name}通市面`,
        summary: `${name}手上现成的市面和门路不少。若能接上这一层，很多经营和地方推进会立刻顺起来。`,
        actionKind: 'trade',
        localChoice: actionChoiceSeed(
          `借${name}通市面`,
          `顺着${name}在${cityName}的现成门路去通一通市面，看能不能先把钱粮和往来盘活`,
          '能借来的市面，往往比自己从零铺开的更快见效。',
          'trade',
          '势力'
        )
      },
      {
        title: `托${name}带风向`,
        summary: `${name}在地方上的话语和牌面仍然管用。若能顺势托它带一层风向，很多人会先于局势动起来。`,
        actionKind: 'diplomacy',
        localChoice: actionChoiceSeed(
          `托${name}带风向`,
          `去接${name}在${cityName}的话语和牌面，看能不能借它先把周边人心与站位带向自己想要的方向`,
          '有时候真正值钱的不是势力本身，而是它能替你带动多少别人先动。',
          'diplomacy',
          '势力'
        )
      }
    ]);
  }

  if (power >= 70) {
    return pickSeedVariant(seedSource, [
      {
        title: `同${name}划清界面`,
        summary: `${name}块头太大，不先把双方界面划清，谁都得在它的影子里走。眼下最值钱的是把真正底线摆明。`,
        actionKind: 'diplomacy',
        localChoice: actionChoiceSeed(
          `同${name}划清界面`,
          `挑个${name}不能装聋作哑的场面，把价码、边界和站位一并摆出来，逼着双方把界面划清`,
          '势力越大，越习惯让别人猜；能把界面划清的人，才有资格谈后手。',
          'diplomacy',
          '势力'
        )
      },
      {
        title: `请${name}摆明条件`,
        summary: `${name}这股势过于庞大，若始终让它含糊其词，后面每一步都要付额外代价。此时该逼它把条件摆上桌。`,
        actionKind: 'diplomacy',
        localChoice: actionChoiceSeed(
          `请${name}摆明条件`,
          `找个不得不谈清楚的场面，请${name}把真正的条件、底线与交换摆到桌面上`,
          '大势最爱吃人含糊，能让它把条件说清，本身就是一种主动。',
          'diplomacy',
          '势力'
        )
      },
      {
        title: `探${name}底线`,
        summary: `${name}块头越大，越容易把真正底线藏在场面后头。若能试出那条线，很多后续判断都会轻松不少。`,
        actionKind: 'diplomacy',
        localChoice: actionChoiceSeed(
          `探${name}底线`,
          `沿着${name}最近最在意的一层人事去试探，看它在${cityName}的真正底线到底落在哪儿`,
          '不是所有强势都能一口吃下，但只要摸到底线，至少不会再白撞。',
          'diplomacy',
          '势力'
        )
      }
    ]);
  }

  return pickSeedVariant(seedSource, [
    {
      title: `盘${name}来路`,
      summary: `${name}这股势力现在还没完全亮底。先盘清它真正靠什么发力、最近在押什么牌，后面才知道是借还是防。`,
      actionKind: 'investigate',
      localChoice: actionChoiceSeed(
        `盘${name}来路`,
        `顺着${name}最近在${cityName}压下的门路与往来去盘它真正靠哪张牌发力，别等它先把局带走`,
        '局面最怕的不是强敌，而是你根本不知道对方下一手凭什么落。',
        'investigate',
        '势力'
      )
    },
    {
      title: `看${name}押哪张牌`,
      summary: `${name}眼下最值得先看的，不是它说了什么，而是它究竟把筹码押在哪一层上。`,
      actionKind: 'investigate',
      localChoice: actionChoiceSeed(
        `看${name}押哪张牌`,
        `顺着${name}最近最反常的一层动作去看，看它究竟把人手、钱粮和声势押在了哪张牌上`,
        '看懂别人押牌的方向，很多局就已经赢了半截。',
        'investigate',
        '势力'
      )
    },
    {
      title: `试${name}门风`,
      summary: `${name}这股势还没有完全露底。先试一试它门里的人怎么说、怎么做，往往比硬查更快摸到真章。`,
      actionKind: 'social',
      localChoice: actionChoiceSeed(
        `试${name}门风`,
        `从${name}外围的人情与往来入手，先试一试这股势在${cityName}到底是什么门风和路数`,
        '势力的底色，很多时候不在头面人物口中，而在门下人怎么应事。',
        'social',
        '势力'
      )
    }
  ]);
}

function buildFactionPromptCorpus(state, action) {
  const gs = state && state.gameState ? state.gameState : {};
  const scene = state && state.scene ? state.scene : {};
  const memory = state && state.memory ? state.memory : {};
  const worldPerception = ensureWorldPerceptionState(gs);
  const worldFermentation = ensureWorldFermentationState(gs);
  return [
    action && action.kind,
    action && action.mode,
    action && action.targetName,
    action && action.raw,
    action && action.actionText,
    action && action.text,
    gs.lastResolutionSummary,
    gs.lastRuleSummary,
    gs.lastEventTag,
    scene.title,
    scene.summary,
    scene.text,
    worldPerception.headline,
    worldPerception.summary,
    worldPerception.hiddenCurrent,
    worldFermentation.headline,
    worldFermentation.summary,
    ensureList(memory.selectedDynamicChoiceHistory).slice(0, 4).map((item) => item && item.targetName),
    ensureList(memory.selectedDynamicChoiceHistory).slice(0, 4).map((item) => item && item.text),
    ensureList(memory.selectedDynamicChoiceHistory).slice(0, 4).map((item) => item && item.actionText)
  ].flat().filter(Boolean).join(' ');
}

function factionPlanningScore(item, state, action) {
  const city = findCity(currentCityIdOf(state));
  const localFactionId = String(city && city.localFactionId || '').trim();
  const corpus = buildFactionPromptCorpus(state, action);
  const name = String(item && item.name || '').trim();
  const id = String(item && item.id || '').trim();
  const hostility = Number(item && item.hostility || 0);
  const favor = Number(item && item.favor || 0);
  const leverage = Number(item && item.leverage || 0);
  const power = Number(item && item.power || 0);

  let score = Math.max(hostility, favor, leverage) + Math.round(power * 0.18);
  if (id && localFactionId && id === localFactionId) score += 220;
  if (name && corpus.includes(name)) score += 150;
  if (id && corpus.includes(id)) score += 80;
  if (String(item && item.role || '').trim() && corpus.includes(String(item.role).trim())) score += 26;

  const explicitlyRelevant = (id && localFactionId && id === localFactionId) || (name && corpus.includes(name)) || (id && corpus.includes(id));
  if (!explicitlyRelevant) score -= 120;
  return score;
}

function buildFactionFrontiers(state, action = {}) {
  const gs = state && state.gameState ? state.gameState : {};
  return ensureList(gs.factions)
    .slice()
    .map((item) => ({ item, score: factionPlanningScore(item, state, action) }))
    .filter(({ score }) => score >= 18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ item }, index) => {
      const cityName = currentCityNameOf(state) || '此地';
      const seed = buildFactionFrontierSeed(item, cityName);
      return makeFrontier({
        id: `frontier:faction:${item.id || index}`,
        type: 'faction',
        title: seed.title,
        summary: seed.summary,
        reason: Number(item.hostility || 0) >= Number(item.favor || 0)
          ? `当前最需要提防和摸清的势力是${item.name}。`
          : `当前最值得尝试借势的对象是${item.name}。`,
        domain: '势力',
        risk: Number(item.hostility || 0) >= 30 ? 'high' : 'medium',
        slotBiases: ['mainline', 'wildcard'],
        recommendedKinds: uniqueStrings([seed.actionKind, 'investigate', 'intrigue', 'diplomacy', 'trade']),
        targetId: String(item.id || ''),
        targetName: normalizeSnippet(item.name || ''),
        targetType: 'faction',
        cityId: currentCityIdOf(state),
        cityName,
        outcomes: ['faction', 'plot'],
        noveltyKey: `faction:${item.id || item.name}:${seed.actionKind}`,
        source: 'faction',
        weight: 86 - (index * 4),
        localChoice: seed.localChoice
      });
    });
}

function buildGrowthFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const frontiers = [];
  if (Number(gs.troops || 0) >= 30 || Number(gs.morale || 0) >= 20 || Number(gs.military || 0) >= 20) {
    frontiers.push(makeFrontier({
      id: 'frontier:growth:military_management',
      type: 'growth',
      title: '整顿军务后盘',
      summary: '眼下军旅不一定非得立刻往前线压，也可以先把营中的兵甲、粮秣、哨值与人心拢住，让后手真正能打。',
      reason: '你已经有了足够的部曲或军务基础，经营军旅本身就该是一条可玩的推进线。',
      domain: '军旅',
      risk: 'low',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['military', 'govern', 'trade'],
      cityId: currentCityIdOf(state),
      cityName: currentCityNameOf(state),
      outcomes: ['resource', 'stat'],
      noveltyKey: 'growth:military_management',
      source: 'growth',
      weight: 80,
      localChoice: actionChoiceSeed(
        '把营盘拢实',
        '先回营清点兵甲、粮秣与值哨，把部曲、军需和军纪这一层后盘真正拢成能持续发力的样子',
        '前线再热，也得有后盘撑着；这一手做实了，后面的军旅线才不会空心。',
        'military',
        '军旅'
      )
    }));
  }

  if (Number(gs.governance || 0) >= 18 || Number(gs.commerce || 0) >= 18 || Number(gs.coins || 0) >= 30 || Number(gs.supplies || 0) >= 20) {
    frontiers.push(makeFrontier({
      id: 'frontier:growth:business',
      type: 'growth',
      title: '盘活钱粮根底',
      summary: '眼下这局不只有查人和斗势，钱、粮、仓、铺和账本本身，也能长出剧情与筹码。',
      reason: '你的经营基础已经足够让后方根基变成真正可推进、可反馈的玩法方向。',
      domain: '经营',
      risk: 'low',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['govern', 'trade', 'diplomacy'],
      cityId: currentCityIdOf(state),
      cityName: currentCityNameOf(state),
      outcomes: ['resource', 'stat', 'plot'],
      noveltyKey: 'growth:business',
      source: 'growth',
      weight: 78,
      localChoice: actionChoiceSeed(
        '把仓账盘成筹码',
        '从仓账、铺面和往来人手里盘一盘眼下真正能变成筹码的钱粮根底，别让后方只停在数字上',
        '一旦把后方根基拢实，很多原本只能旁观的局，也会被你硬拽进手里。',
        'govern',
        '经营'
      )
    }));
  }

  if (Number(gs.martialLevel || 0) >= 8 || Number(gs.martialInsight || 0) >= 8) {
    frontiers.push(makeFrontier({
      id: 'frontier:growth:martial',
      type: 'growth',
      title: '拆招磨路数',
      summary: '武学成长不该只是重复练功，而该是把这几回露出来的短板和新路数慢慢拆明白。',
      reason: '你的武学已经有了底子，可以把个人成长做成剧情线，而不是单纯的数值上跳。',
      domain: '武学',
      risk: 'medium',
      slotBiases: ['wildcard'],
      recommendedKinds: ['martial', 'jianghu', 'sect'],
      cityId: currentCityIdOf(state),
      cityName: currentCityNameOf(state),
      outcomes: ['stat', 'encounter'],
      noveltyKey: 'growth:martial',
      source: 'growth',
      weight: 72,
      localChoice: actionChoiceSeed(
        '拆招磨路数',
        '借这几回露出来的破绽与余势，静下心把自己的招路重新拆一遍，看看能不能磨出下一层变化',
        '真正能改命的武学，不是多练一遍，而是把上一回露出来的那点东西想明白。',
        'martial',
        '武学'
      )
    }));
  }

  if (String(gs.sectId || '').trim()) {
    frontiers.push(makeFrontier({
      id: `frontier:growth:sect:${gs.sectId}`,
      type: 'growth',
        title: `叩开${gs.sectName}内里`,
      summary: `${gs.sectName}不只是一块招牌，门中人情、规矩、资源和暗线都还能继续往更深处打。`,
      reason: `你已经加入${gs.sectName}，门派内线理应成为持续可推进的成长方向。`,
      domain: '门派',
      risk: 'medium',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['sect', 'social', 'martial'],
      cityId: currentCityIdOf(state),
      cityName: currentCityNameOf(state),
      outcomes: ['sect', 'relation', 'stat'],
      noveltyKey: `growth:sect:${gs.sectId}`,
      source: 'growth',
      weight: 76,
      localChoice: actionChoiceSeed(
        `叩开${gs.sectName}`,
        `顺着${gs.sectName}门里的规矩、人情和没说透的门路继续往深里走，看看还能撬开哪一层新口子`,
        '门派真正值钱的东西往往不摆在门面上，而是在更深一层不轻易对外说破的地方。',
        'sect',
        '门派'
      )
    }));
  }

  return frontiers;
}

function buildTravelFrontiers(state) {
  const world = state && state.world ? state.world : {};
  const routes = ensureList(world && world.map && world.map.routes).slice(0, 2);
  return routes.map((item, index) => makeFrontier({
    id: `frontier:travel:${item.cityId || index}`,
    type: 'travel',
    title: index === 0 ? `借道${item.cityName}` : `赴${item.cityName}换局`,
    summary: `${item.cityName}这条路现在离你最近。若眼下本城的局一时打不开，换城换风向本身就是主动落子。`,
    reason: `当前临近可达的城市是${item.cityName}。`,
    domain: '行路',
    risk: String(item.risk || '').toLowerCase().includes('高') ? 'high' : 'medium',
    slotBiases: ['wildcard'],
    recommendedKinds: ['travel', 'investigate', 'social'],
    targetId: String(item.cityId || ''),
    targetName: normalizeSnippet(item.cityName || ''),
    targetType: 'city',
    cityId: String(item.cityId || ''),
    cityName: normalizeSnippet(item.cityName || ''),
    outcomes: ['plot', 'new_relation'],
    noveltyKey: `travel:${item.cityId || item.cityName}`,
    source: 'travel',
    weight: 68 - (index * 3),
    localChoice: actionChoiceSeed(
      index === 0 ? `借道${item.cityName}` : `赴${item.cityName}`,
      `借${item.routeLabel || '现成道路'}转去${item.cityName}换一口风，看那边有没有更值得现在压上的人物与局`,
      `${item.cityName}不只是换地方，更可能是换一组人物、门路与机会。`,
      'travel',
      '行路'
    )
  }));
}

function buildLeisureFrontier(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const recentKinds = ensureList(state && state.memory && state.memory.recentActions).slice(0, 3).map((item) => String(item && item.kind || ''));
  const intense = recentKinds.some((item) => ['battle', 'warpath', 'investigate', 'intrigue', 'military'].includes(item));
  if (!intense && Number(gs.fatigue || 0) < 10) return null;
  const cityName = currentCityNameOf(state) || '此地';
  const waterTown = /(江陵|建业|襄阳|柴桑|吴)/.test(cityName);
  const text = waterTown ? '去水边散散气' : '去茶肆坐坐';
  const actionText = waterTown
    ? `去${cityName}的水边走一程，借晚风、酒气和旁人的几句闲话，把这几回压得太紧的心神慢慢松开`
    : `去${cityName}的茶肆坐一阵，听些市井闲谈与说书杂话，把这几回绷得太紧的局重新理顺`;
  return makeFrontier({
    id: `frontier:leisure:${currentCityIdOf(state) || cityName}`,
    type: 'leisure',
    title: text,
    summary: '休闲线不只是回气，它也能换视角、出风声、撞见人，让一味绷紧的局面生出新缝。',
    reason: '最近几回动作偏紧，疲劳或压力已经抬头。',
    domain: '休闲',
    risk: 'low',
    slotBiases: ['wildcard'],
    recommendedKinds: ['rest', 'social', 'jianghu'],
    cityId: currentCityIdOf(state),
    cityName,
    outcomes: ['stat', 'encounter', 'new_relation'],
    noveltyKey: `leisure:${currentCityIdOf(state) || cityName}`,
    source: 'leisure',
    weight: 64,
    localChoice: actionChoiceSeed(
      text,
      actionText,
      '松一口气不等于停手，很多真正值钱的风声，反而是在你不硬追的时候自己撞过来。',
      'rest',
      '休闲'
    )
  });
}

function selectFatigueSupportRelation(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const retinue = gs && gs.retinue && typeof gs.retinue === 'object' ? gs.retinue : {};
  const companionId = String(retinue.companionRelationId || '').trim();
  const relations = ensureList(gs.relationships)
    .filter((item) => item && isRelationMet(item))
    .filter((item) => !item.isExtraCharacter || relationVisibilityStateOf(item) === 'met');
  if (companionId) {
    const companion = relations.find((item) => String(item && item.id || '') === companionId);
    if (companion) return companion;
  }
  return relations
    .slice()
    .sort((left, right) => (
      (Number(right.affection || 0) * 3)
      + Number(right.trust || 0)
      + Number(right.loyalty || 0)
    ) - (
      (Number(left.affection || 0) * 3)
      + Number(left.trust || 0)
      + Number(left.loyalty || 0)
    ))[0] || null;
}

function buildFatigueFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const total = Number(gs.fatigue || 0);
  const combat = Number(gs.fatigueCombat || 0);
  const travel = Number(gs.fatigueTravel || 0);
  const mental = Number(gs.fatigueMental || 0);
  if (total < 28) return [];

  const frontiers = [];
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state) || '此地';
  const supportRelation = selectFatigueSupportRelation(state);
  const retinueMembers = ensureList(gs && gs.retinue && gs.retinue.members);

  if (combat >= Math.max(16, travel, mental)) {
    frontiers.push(makeFrontier({
      id: `frontier:fatigue:combat:${cityId || cityName}`,
      type: 'fatigue',
      title: '卸甲缓伤',
      summary: '疲惫不只是总量高，而是劳战压在筋骨上。若继续硬推，后面出的就不是险手，而是失手。',
      reason: '当前疲惫主要来自劳战与硬顶。',
      domain: '收束',
      risk: total >= 70 ? 'medium' : 'low',
      slotBiases: ['followup', 'wildcard'],
      recommendedKinds: ['rest', 'social', 'martial'],
      cityId,
      cityName,
      outcomes: ['stat', 'plot'],
      noveltyKey: 'fatigue:combat_relief',
      source: 'fatigue',
      weight: total >= 70 ? 116 : 102,
      dynamicOnly: true,
      dramaticPriority: total >= 70 ? 4 : 3,
      localChoice: actionChoiceSeed(
        '卸甲缓伤',
        `先在${cityName}寻个能卸甲敷创、热食缓力的地方，把这几回积下的酸麻和暗伤压下去，再决定下一手还要不要硬顶`,
        '再硬撑下去，下一回掉出来的就不只是疲惫，很可能是伤势和失手。',
        'rest',
        '收束'
      )
    }));
  }

  if (travel >= Math.max(14, combat, mental)) {
    frontiers.push(makeFrontier({
      id: `frontier:fatigue:travel:${cityId || cityName}`,
      type: 'fatigue',
      title: '换脚收途',
      summary: '这层疲惫主要是长路、转城和来回奔波压出来的。此时最值钱的不是再赶一程，而是先把脚力和节奏收住。',
      reason: '当前疲惫主要来自奔波与路途消耗。',
      domain: '收束',
      risk: total >= 70 ? 'medium' : 'low',
      slotBiases: ['followup', 'wildcard'],
      recommendedKinds: ['rest', 'travel', 'social'],
      cityId,
      cityName,
      outcomes: ['stat', 'encounter'],
      noveltyKey: 'fatigue:travel_relief',
      source: 'fatigue',
      weight: total >= 70 ? 114 : 100,
      dynamicOnly: true,
      dramaticPriority: total >= 70 ? 4 : 3,
      localChoice: actionChoiceSeed(
        '换脚收途',
        `先在${cityName}换马歇脚、慢一程脚力，把这阵子压出来的脚程与晕眩收住，再看下一步往哪座城、哪条线继续落`,
        '一路抢赶最伤的不是盘缠，而是你还没发现自己已经开始判断发钝。',
        'rest',
        '收束'
      )
    }));
  }

  if (mental >= Math.max(14, combat, travel)) {
    frontiers.push(makeFrontier({
      id: `frontier:fatigue:mental:${cityId || cityName}`,
      type: 'fatigue',
      title: supportRelation ? `向${supportRelation.name}卸一口气` : '放松心弦',
      summary: supportRelation
        ? `${supportRelation.name}这条线眼下更适合承接你的心神疲态。把压在喉头的那层事说开，有时比硬做一轮更能改后势。`
        : '这层疲惫主要不是伤在筋骨，而是伤在心神。若不先把思绪和压强放松，后面越做越容易走偏。',
      reason: '当前疲惫主要来自谋算、周旋与心神消耗。',
      domain: '收束',
      risk: 'low',
      slotBiases: ['followup', 'wildcard'],
      recommendedKinds: supportRelation ? ['social', 'romance', 'rest'] : ['rest', 'social', 'investigate'],
      targetId: supportRelation ? String(supportRelation.id || '') : '',
      targetName: supportRelation ? normalizeSnippet(supportRelation.name || '') : '',
      targetType: supportRelation ? 'relation' : '',
      cityId,
      cityName,
      outcomes: supportRelation ? ['stat', 'relation', 'plot'] : ['stat', 'plot'],
      noveltyKey: supportRelation ? `fatigue:mental:${supportRelation.id || supportRelation.name}` : 'fatigue:mental_relief',
      source: 'fatigue',
      weight: 110,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        supportRelation ? `向${supportRelation.name}卸一口气` : '放松心弦',
        supportRelation
          ? `去找${supportRelation.name}单独坐一会儿，把这几回压得人发钝的顾虑、火气和没来得及想透的话慢慢说开，看这口心气能不能先顺下来`
          : `先去${cityName}找个能让人安静下来的地方，把这几回积在心口的火气、疑虑和杂念慢慢理顺，再决定下一手要压向谁`,
        '心神绷到最紧的时候，最容易错的不是看不见机会，而是把每个机会都看成同一件事。',
        supportRelation ? 'social' : 'rest',
        '收束',
        supportRelation ? { target: supportRelation.id || '', targetName: supportRelation.name || '', targetType: 'relation' } : {}
      )
    }));
  }

  if (total >= 65 && retinueMembers.length) {
    const helper = supportRelation || null;
    frontiers.push(makeFrontier({
      id: `frontier:fatigue:delegate:${cityId || cityName}`,
      type: 'fatigue',
      title: helper ? `让${helper.name}替我接一手` : '把杂务先分出去',
      summary: '高疲惫时不一定只能睡觉，也可以主动收束节奏，把该分出去的一层先分出去，避免自己把整局做钝。',
      reason: '当前总疲惫已经偏高，适合通过托付、同行或分担来回收行动质量。',
      domain: '收束',
      risk: 'medium',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['social', 'govern', 'investigate'],
      targetId: helper ? String(helper.id || '') : '',
      targetName: helper ? normalizeSnippet(helper.name || '') : '',
      targetType: helper ? 'relation' : '',
      cityId,
      cityName,
      outcomes: helper ? ['stat', 'relation', 'plot'] : ['stat', 'plot'],
      noveltyKey: helper ? `fatigue:delegate:${helper.id || helper.name}` : 'fatigue:delegate',
      source: 'fatigue',
      weight: 112,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        helper ? `让${helper.name}替我接一手` : '把杂务先分出去',
        helper
          ? `先把眼前最碎也最耗神的一层事交给${helper.name}替我接住，我自己只盯最要命的那一处，看能不能把整局重新收束起来`
          : `先把眼前最碎也最耗神的一层事务分出去，只把最要命的一处留在自己手里，别让疲态把整局一起拖钝`,
        '收手不是认输，真正高明的是在该分担的时候别把自己耗成全局最大的短板。',
        'social',
        '收束',
        helper ? { target: helper.id || '', targetName: helper.name || '', targetType: 'relation' } : {}
      )
    }));
  }

  return frontiers
    .slice()
    .sort((left, right) => Number(right.weight || 0) - Number(left.weight || 0))
    .slice(0, 2);
}

function buildAttributeFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state) || '此地';
  const frontiers = [];
  const push = (frontier) => {
    if (frontier) frontiers.push(frontier);
  };

  if (Number(gs.coins || 0) <= 10) {
    push(makeFrontier({
      id: `frontier:attribute:coins_low:${cityId || cityName}`,
      type: 'attribute',
      title: '先拆一口盘缠',
      summary: '钱财已经压到手边。此时很多局不是不能做，而是刚动身就会被盘缠卡死。',
      reason: '当前钱财偏低，很多交游、转移与经营动作会开始被成本反咬。',
      domain: '钱粮',
      risk: 'medium',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['trade', 'social', 'investigate'],
      cityId,
      cityName,
      outcomes: ['resource', 'plot'],
      noveltyKey: 'attribute:coins_low',
      source: 'attribute',
      weight: 104,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        '先拆一口盘缠',
        `先在${cityName}拆一口现成盘缠出来，不管是借熟门、押旧物还是换一笔快钱，先把眼前最卡手的那道钱关打开`,
        '钱一旦短到手边，很多本来能做的事都会在起手前先烂掉。',
        'trade',
        '钱粮'
      )
    }));
  }

  if (Number(gs.supplies || 0) <= 10) {
    push(makeFrontier({
      id: `frontier:attribute:supplies_low:${cityId || cityName}`,
      type: 'attribute',
      title: '先补粮口',
      summary: '粮秣已经吃紧。若继续拖着，远行、练兵、军旅和守城都会先变成空架子。',
      reason: '当前粮秣偏低，需要主动补口，否则后续大量玩法都会发钝。',
      domain: '钱粮',
      risk: 'medium',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['govern', 'trade', 'investigate'],
      cityId,
      cityName,
      outcomes: ['resource', 'plot'],
      noveltyKey: 'attribute:supplies_low',
      source: 'attribute',
      weight: 106,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        '先补粮口',
        `先把${cityName}眼下最能接到粮口的一层人手、仓口或转运线抓出来，别让后面的动作都饿在半路上`,
        '粮口一断，很多雄心都会先饿成空话。',
        'govern',
        '钱粮'
      )
    }));
  }

  if (Number(gs.troops || 0) >= 30 && Number(gs.morale || 0) <= 36) {
    push(makeFrontier({
      id: `frontier:attribute:morale_low:${cityId || cityName}`,
      type: 'attribute',
      title: '压住军心',
      summary: '你手里已经不只是自己一个人了，但士气开始发虚。若不先把军心压稳，人越多越容易坏事。',
      reason: '兵力已有规模，但士气偏低，适合优先处理军心与统摄问题。',
      domain: '军旅',
      risk: 'medium',
      slotBiases: ['mainline', 'followup'],
      recommendedKinds: ['military', 'social', 'govern'],
      cityId,
      cityName,
      outcomes: ['stat', 'plot'],
      noveltyKey: 'attribute:morale_low',
      source: 'attribute',
      weight: 102,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        '压住军心',
        `先把${cityName}营中最浮的那股军心压住，不管是整顿号令、当众定心还是揪出带坏风向的人，都别让这股虚气继续散`,
        '兵多而心散，比兵少更容易在关键时候一泻千里。',
        'military',
        '军旅'
      )
    }));
  }

  if (Number(gs.renown || 0) >= 34) {
    push(makeFrontier({
      id: `frontier:attribute:renown_high:${cityId || cityName}`,
      type: 'attribute',
      title: '借名开路',
      summary: '名望已经不是摆设。若还只把它放在面板上，那等于白白浪费了别人已经开始在意的东西。',
      reason: '当前名望已高到足以主动撬动人物、势力或新门路。',
      domain: '人物',
      risk: 'medium',
      slotBiases: ['wildcard', 'followup'],
      recommendedKinds: ['social', 'diplomacy', 'jianghu'],
      cityId,
      cityName,
      outcomes: ['relation', 'plot', 'faction'],
      noveltyKey: 'attribute:renown_high',
      source: 'attribute',
      weight: 96,
      dynamicOnly: true,
      dramaticPriority: 3,
      localChoice: actionChoiceSeed(
        '借名开路',
        `借着自己近来打出来的名头，在${cityName}主动叩一扇原本不会为我开的门，看这点声势到底能换来人、事还是新的敌意`,
        '名声最值钱的时候，不是别人已经来投，而是你可以主动去敲本来敲不开的门。',
        'social',
        '人物'
      )
    }));
  }

  if (Number(gs.influence || 0) >= 32) {
    push(makeFrontier({
      id: `frontier:attribute:influence_high:${cityId || cityName}`,
      type: 'attribute',
      title: '借势落暗子',
      summary: '影响力已经足够让你不只是回应局势，而能把自己的意思往别人眼皮底下埋进去。',
      reason: '当前影响力已能转化为布局、安插或试探别人的成本优势。',
      domain: '谋略',
      risk: 'high',
      slotBiases: ['wildcard', 'mainline'],
      recommendedKinds: ['intrigue', 'diplomacy', 'investigate'],
      cityId,
      cityName,
      outcomes: ['plot', 'faction'],
      noveltyKey: 'attribute:influence_high',
      source: 'attribute',
      weight: 98,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        '借势落暗子',
        `趁眼下还有人肯看我的脸色，在${cityName}先把一枚暗子悄悄落进去，看日后它会替我开门还是替我咬人`,
        '势能这东西最怕放凉，能先落下去的暗子，往往比临时起意的后手值钱得多。',
        'intrigue',
        '谋略'
      )
    }));
  }

  if (Number(gs.charm || 0) >= 26) {
    push(makeFrontier({
      id: `frontier:attribute:charm_high:${cityId || cityName}`,
      type: 'attribute',
      title: '借情面开口',
      summary: '魅力已经开始变成真实筹码。若还只靠硬谈和硬查，等于把自己最柔也最好使的一手白白丢着。',
      reason: '当前魅力足够让人情、试探、靠近与软推进变得更有价值。',
      domain: '人物',
      risk: 'low',
      slotBiases: ['followup', 'wildcard'],
      recommendedKinds: ['social', 'romance', 'diplomacy'],
      cityId,
      cityName,
      outcomes: ['relation', 'plot'],
      noveltyKey: 'attribute:charm_high',
      source: 'attribute',
      weight: 90,
      dynamicOnly: true,
      dramaticPriority: 3,
      localChoice: actionChoiceSeed(
        '借情面开口',
        `趁眼下还有人愿意给我情面，在${cityName}挑一个最该软着开的口子先试试，看这份好感到底能换出哪层真话`,
        '有些门不是撞开的，是别人愿意为你松一松门闩。',
        'social',
        '人物'
      )
    }));
  }

  if (Number(gs.martialInsight || 0) >= 2 || Number(gs.martialLevel || 0) >= 24) {
    push(makeFrontier({
      id: `frontier:attribute:martial_growth:${cityId || cityName}`,
      type: 'attribute',
      title: '把新悟试出去',
      summary: '武学已经不只是堆熟练度了。眼下若不把新悟的那点东西拿去碰人碰局，很快又会缩回抽象数值里。',
      reason: '当前武学层面已形成可转化为剧情推进的新理解或新路数。',
      domain: '武学',
      risk: 'medium',
      slotBiases: ['wildcard', 'followup'],
      recommendedKinds: ['martial', 'jianghu', 'warpath'],
      cityId,
      cityName,
      outcomes: ['stat', 'encounter', 'plot'],
      noveltyKey: 'attribute:martial_growth',
      source: 'attribute',
      weight: 94,
      dynamicOnly: true,
      dramaticPriority: 3,
      localChoice: actionChoiceSeed(
        '把新悟试出去',
        `别再只在心里拆招，找个能见真章的地方把最近悟到的那点变化试出去，看它到底是纸上心得还是能改局的硬本事`,
        '路数只有碰过人和局，才算真的长在自己身上。',
        'martial',
        '武学'
      )
    }));
  }

  return frontiers
    .slice()
    .sort((left, right) => Number(right.weight || 0) - Number(left.weight || 0))
    .slice(0, 2);
}

function buildLineIdentityFrontiers(state) {
  const gs = state && state.gameState ? state.gameState : {};
  const territory = state && state.world && state.world.territory ? state.world.territory : {};
  const cityId = currentCityIdOf(state);
  const cityName = currentCityNameOf(state);
  const frontiers = [];
  const push = (item) => {
    if (item) frontiers.push(item);
  };

  if (String(gs.martialFocusId || '') === 'battlefield' || Number(gs.battlefieldPrestige || 0) >= 20) {
    push(makeFrontier({
      id: `frontier:line:battlefield:${cityId || cityName}`,
      type: 'line_identity',
      title: '把军旅声势压实',
      summary: '这条线已经明显往军旅和战阵倾斜。此时若还用平均手法推进，只会把已经滚起来的兵势重新摊平。',
      reason: '当前志向、威名和近线盘面都更适合把军旅线继续压深。',
      domain: '军旅',
      risk: 'medium',
      slotBiases: ['mainline', 'wildcard'],
      recommendedKinds: ['military', 'warpath', 'battle', 'govern'],
      cityId,
      cityName,
      outcomes: ['military', 'plot', 'resource'],
      noveltyKey: 'line:battlefield',
      source: 'line_identity',
      weight: 106,
      dynamicOnly: true,
      dramaticPriority: 5,
      localChoice: actionChoiceSeed(
        '把军旅声势压实',
        `趁眼下阵前声势还热，在${cityName}继续把兵、粮、名和能真正打得动的一线安排压实，别让这条军旅线又散回普通见闻里`,
        '军旅线真正值钱的，不是打过一仗，而是从此每一步都更像个在战场上会越滚越大的角色。',
        'military',
        '军旅'
      )
    }));
  }

  if (String(gs.martialFocusId || '') === 'jianghu' || Number(gs.jianghuPrestige || 0) >= 20) {
    push(makeFrontier({
      id: `frontier:line:jianghu:${cityId || cityName}`,
      type: 'line_identity',
      title: '把江湖名头做大',
      summary: '这条线已经开始靠江湖名头和个人路数吃饭。要么继续把名声做成门路，要么就等它自己凉掉。',
      reason: '当前武学志向和江湖威名都在催你把个人名号继续放大。',
      domain: '江湖',
      risk: 'medium',
      slotBiases: ['followup', 'wildcard'],
      recommendedKinds: ['jianghu', 'martial', 'travel', 'investigate'],
      cityId,
      cityName,
      outcomes: ['encounter', 'renown', 'plot'],
      noveltyKey: 'line:jianghu',
      source: 'line_identity',
      weight: 104,
      dynamicOnly: true,
      dramaticPriority: 5,
      localChoice: actionChoiceSeed(
        '把江湖名头做大',
        `趁别人还在议论我最近这一身路数，继续在${cityName}挑一处最容易扬名也最容易结怨的地方把名字打出去`,
        '江湖线最怕不上不下。要么趁热滚大，要么就只能看着别人把风头接走。',
        'jianghu',
        '江湖'
      )
    }));
  }

  if ((gs.sectId || '') && (Number(gs.sectFavor || 0) >= 12 || Number(gs.sectPower || 0) >= 10)) {
    push(makeFrontier({
      id: `frontier:line:sect:${gs.sectId || cityId || cityName}`,
      type: 'line_identity',
      title: '把山门门路坐稳',
      summary: '门派线已经不再只是背景板。此时若不继续压人情、传承和门中位置，之前吃下的门路就很难变成长线收益。',
      reason: '当前门派身份已经形成真实的成长入口，值得继续深挖。',
      domain: '门派',
      risk: 'low',
      slotBiases: ['mainline', 'followup'],
      recommendedKinds: ['sect', 'joinsect', 'martial', 'social'],
      cityId,
      cityName,
      outcomes: ['stat', 'relation', 'plot'],
      noveltyKey: 'line:sect',
      source: 'line_identity',
      weight: 100,
      dynamicOnly: true,
      dramaticPriority: 4,
      localChoice: actionChoiceSeed(
        '把山门门路坐稳',
        `别只把${gs.sectName || '山门'}当成一层身份，继续顺着门里的规矩、人情和传承去压，把这条线真正盘成以后能反复吃收益的根`,
        '门派线真正值钱的，是让一层身份慢慢变成一整套能反复借力的门路。',
        'sect',
        '门派'
      )
    }));
  }

  if (Number(territory.governedCount || 0) > 0 || ['steward', 'control'].includes(String(territory.currentAuthority || ''))) {
    push(makeFrontier({
      id: `frontier:line:territory:${cityId || cityName}`,
      type: 'line_identity',
      title: '把地盘回流吃满',
      summary: '你已经不只是路过此地，而是开始真的有地盘可吃。此时最值钱的不是再去碰无关小事，而是把城池、班底和回流压成长期优势。',
      reason: '当前已经握住一部分治权，经营线应该被进一步放大。',
      domain: '经营',
      risk: 'low',
      slotBiases: ['mainline', 'followup'],
      recommendedKinds: ['govern', 'trade', 'diplomacy', 'military'],
      cityId,
      cityName,
      outcomes: ['resource', 'territory', 'faction'],
      noveltyKey: 'line:territory',
      source: 'line_identity',
      weight: 108,
      dynamicOnly: true,
      dramaticPriority: 5,
      localChoice: actionChoiceSeed(
        '把地盘回流吃满',
        `趁眼下这块地盘还肯往我手里回流，继续在${cityName}把城中治权、钱粮回流和班底协同压实，别让根基只是写在面板上的好看数字`,
        '真正耐玩的经营线，不是当回合补几个数，而是把一座城慢慢盘成会自动替你供血的根。',
        'govern',
        '经营'
      )
    }));
  }

  return frontiers
    .slice()
    .sort((left, right) => Number(right.weight || 0) - Number(left.weight || 0))
    .slice(0, 2);
}

function buildWorldFermentationFrontiers(state) {
  const worldFermentation = ensureWorldFermentationState(state && state.gameState ? state.gameState : {});
  const frontiers = ensureList(worldFermentation.frontierSeeds)
    .map((item, index) => {
      const localChoice = item && item.localChoice ? item.localChoice : null;
      if (!item || !localChoice || !localChoice.text || !localChoice.actionText) return null;
      const actionBias = Number((worldFermentation.actionBias || {})[String(localChoice.actionKind || '').trim()] || 0);
      const heatBonus = Math.round(Number(worldFermentation.heat || 0) / 8);
      const seedType = String(item.type || '').trim();
      const slotBiases = /request|visit|invitation|summons/.test(seedType)
        ? ['followup']
        : (/ultimatum|pressure/.test(seedType) ? ['mainline', 'wildcard'] : ['followup', 'wildcard']);
      return makeFrontier({
        id: item.id || `frontier:fermentation:${index}`,
        type: item.type || 'fermentation',
        title: item.title || localChoice.text,
        summary: item.summary || worldFermentation.summary || '世界已经开始对你刚落下去的这一手作出反应。',
        reason: item.reason || worldFermentation.headline || '这一层暗潮若不接，后面会自己变形。',
        domain: item.domain || '暗潮',
        risk: item.risk || 'medium',
        slotBiases,
        recommendedKinds: ensureList(item.recommendedKinds).length ? item.recommendedKinds : [localChoice.actionKind || 'investigate'],
        targetId: item.targetId || '',
        targetName: item.targetName || '',
        targetType: item.targetType || '',
        cityId: item.cityId || currentCityIdOf(state),
        cityName: item.cityName || currentCityNameOf(state),
        outcomes: ensureList(item.outcomes),
        noveltyKey: item.noveltyKey || `fermentation:${item.id || localChoice.actionText}`,
        source: 'fermentation',
        weight: Number(item.weight || 72) + heatBonus + actionBias,
        localChoice: {
          text: localChoice.text,
          actionText: localChoice.actionText,
          hint: localChoice.hint || worldFermentation.headline || '这一手会承接世界刚刚起的暗潮。',
          actionKind: localChoice.actionKind || 'investigate',
          actionMode: localChoice.actionMode || '',
          category: localChoice.category || '暗潮',
          targetId: localChoice.targetId || item.targetId || '',
          targetName: localChoice.targetName || item.targetName || ''
        }
      });
    })
    .filter(Boolean);
  if (!frontiers.length) return [];
  const top = frontiers[0];
  if (top && worldFermentation.heat >= 72) {
    top.weight += 8;
  }
  return frontiers.slice(0, 4);
}

function buildWorldPerceptionFrontiers(state) {
  const worldPerception = ensureWorldPerceptionState(state && state.gameState ? state.gameState : {});
  const frontiers = ensureList(worldPerception.frontierSeeds)
    .map((item, index) => {
      const localChoice = item && item.localChoice ? item.localChoice : null;
      if (!item || !localChoice || !localChoice.text || !localChoice.actionText) return null;
      const actionBias = Number((worldPerception.actionBias || {})[String(localChoice.actionKind || '').trim()] || 0);
      const intensityBonus = Math.round(Number(worldPerception.intensity || 0) / 8);
      const seedType = String(item.type || '').trim();
      const slotBiases = /request|visit|invitation/.test(seedType)
        ? ['followup']
        : ['followup', 'wildcard'];
      return makeFrontier({
        id: item.id || `frontier:perception:${index}`,
        type: item.type || 'perception',
        title: item.title || localChoice.text,
        summary: item.summary || worldPerception.summary || '世界已经开始按不同视角解读你刚落下去的这一手。',
        reason: item.reason || worldPerception.headline || '先看清别人怎么读你，再决定下一手往哪一层发力。',
        domain: item.domain || '风评',
        risk: item.risk || 'medium',
        slotBiases,
        recommendedKinds: ensureList(item.recommendedKinds).length ? item.recommendedKinds : [localChoice.actionKind || 'investigate'],
        targetId: item.targetId || '',
        targetName: item.targetName || '',
        targetType: item.targetType || '',
        cityId: item.cityId || currentCityIdOf(state),
        cityName: item.cityName || currentCityNameOf(state),
        outcomes: ensureList(item.outcomes),
        noveltyKey: item.noveltyKey || `perception:${item.id || localChoice.actionText}`,
        source: 'perception',
        weight: Number(item.weight || 78) + intensityBonus + actionBias,
        dynamicOnly: true,
        dramaticPriority: 6,
        localChoice: {
          text: localChoice.text,
          actionText: localChoice.actionText,
          hint: localChoice.hint || worldPerception.headline || '这一手会承接旁人对你刚刚起的那层解读。',
          actionKind: localChoice.actionKind || 'investigate',
          actionMode: localChoice.actionMode || '',
          category: localChoice.category || '风评',
          targetId: localChoice.targetId || item.targetId || '',
          targetName: localChoice.targetName || item.targetName || ''
        }
      });
    })
    .filter(Boolean);
  if (!frontiers.length) return [];
  const top = frontiers[0];
  if (top && worldPerception.intensity >= 72) {
    top.weight += 8;
  }
  return frontiers.slice(0, 4);
}

function finalizeFrontiers(list, history, limit = 8) {
  const seen = new Set();
  return ensureList(list)
    .filter((item) => item && item.id && item.title && item.localChoice && item.localChoice.text && item.localChoice.actionText)
    .map((item) => ({
      ...item,
      weight: Number(item.weight || 0) - historyPenaltyScore(item, history)
    }))
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
    .filter((item) => {
      const key = `${item.id}::${item.noveltyKey || item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function buildCharacterCards(state, action, frontiers, limit = 4) {
  const gs = state && state.gameState ? state.gameState : {};
  const wantedNames = uniqueStrings(
    ensureList(frontiers).flatMap((item) => [item.targetName, item.title, item.summary, item.reason])
  );
  const currentCityId = currentCityIdOf(state);
  return ensureList(gs.relationships)
    .filter((item) => {
      if (!item || !item.name) return false;
      return isRelationMet(item);
    })
    .map((item) => {
      let score = 0;
      if (wantedNames.some((entry) => entry && entry.includes(item.name))) score += 120;
      if (String(action && action.targetName || '') === item.name) score += 90;
      if (ensureList(item.homeCities).includes(currentCityId)) score += 18;
      if (item.isExtraCharacter) score += 16;
      if (item.isHistorical) score += 8;
      score += Math.max(0, relationScore(item));
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id || '',
      name: item.name || '',
      type: item.isHistorical ? 'historical' : (item.isExtraCharacter ? 'extra' : 'relation'),
      gender: item.genderLabel || '',
      title: item.title || '',
      storyDomain: item.storyDomain || '',
      homeCities: ensureList(item.homeCities).slice(0, 4),
      tags: ensureList(item.tags).slice(0, 6),
      trust: Number(item.trust || 0),
      affection: Number(item.affection || 0),
      loyalty: Number(item.loyalty || 0),
      rivalry: Number(item.rivalry || 0),
      status: normalizeSnippet(item.status || ''),
      persona: normalizeSnippet(item.personaAnchor || item.summary || ''),
      personality: normalizeSnippet(item.personality || ''),
      martialProfile: normalizeSnippet(item.martialProfile || ''),
      promptFocus: normalizeSnippet(item.promptFocus || '')
    }));
}

function buildDynamicPlanningBundle(state, action, options = {}) {
  const historyLimit = Number(options.historyLimit || 12);
  const frontierLimit = Number(options.frontierLimit || 8);
  const history = recentDynamicChoiceHistory(state, historyLimit);
  const selectedHistory = recentSelectedDynamicChoiceHistory(state, 6);
  const selectedChoice = lastSelectedDynamicChoice(state);
  const domainWeights = recentActionDomainWeights(state);
  const historicalBundle = buildHistoricalNarrativeBundle(state);
  const encounterBundle = buildEncounterNarrativeBundle(state);
  const consequenceFrontiers = buildConsequenceFrontiers(state, action || {});
  const softStateFrontiers = buildSoftStateFrontiers(state);
  const chosenBranchFrontier = buildChosenBranchFrontier(state, action || {});
  const followupFrontier = buildFollowupFrontier(state, action || {});
  const mainlineFrontier = buildMainlineFrontier(state);
  const frontiers = finalizeFrontiers([
    ...consequenceFrontiers,
    ...softStateFrontiers,
    chosenBranchFrontier,
    ...buildMethodVariantFrontiers(chosenBranchFrontier, 1),
    ...buildDramaticResidueFrontiers(state),
    ...buildWorldPerceptionFrontiers(state),
    ...buildWorldFermentationFrontiers(state),
    followupFrontier,
    ...buildMethodVariantFrontiers(followupFrontier, 1),
    mainlineFrontier,
    ...buildMethodVariantFrontiers(mainlineFrontier, 2),
    ...buildEncounterFrontiers(state).slice(0, 2),
    ...buildHistoricalFrontiers(state).slice(0, 2),
    ...buildLineIdentityFrontiers(state).slice(0, 2),
    ...buildExtraCharacterFrontiers(state).slice(0, 1),
    ...buildRelationFrontiers(state).slice(0, 1),
    ...buildGrowthFrontiers(state).slice(0, 1),
    ...buildAttributeFrontiers(state).slice(0, 2),
    ...buildFatigueFrontiers(state).slice(0, 2),
    ...buildTravelFrontiers(state).slice(0, 1),
    buildLeisureFrontier(state)
  ].filter(Boolean).filter((item) => {
    const source = String(item && item.source || '').trim();
    const targetType = String(item && item.targetType || '').trim();
    return source !== 'faction' && source !== 'faction_watch' && targetType !== 'faction';
  }).map((item) => {
    const dynamicMeta = frontierDynamicMeta(item);
    const source = String(item && item.source || '').trim();
    const primaryBoost = ['consequence', 'unfinished_move', 'moral_debt', 'promise_debt', 'scene_residue', 'rumor_heat', 'shock_tag', 'momentum'].includes(source) ? 28 : 0;
    return {
      ...item,
      ...dynamicMeta,
      slotBiases: normalizeFrontierSlotBiases(item && item.slotBiases, source),
      weight: Number(item.weight || 0)
        + frontierContinuityBonus(item, domainWeights, selectedChoice)
        + (dynamicMeta.dramaticPriority * 8)
        + (dynamicMeta.dynamicOnly ? 18 : 0)
        + primaryBoost
        - (dynamicMeta.routineLike ? 18 : 0)
    };
  }), history, frontierLimit);
  const characterCards = buildCharacterCards(state, action || {}, frontiers, 4);
  return {
    recentDynamicChoices: history,
    selectedDynamicChoices: selectedHistory,
    frontiers: frontiers.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      summary: item.summary,
      reason: item.reason,
      domain: item.domain,
      risk: item.risk,
      slotBiases: ensureList(item.slotBiases),
      recommendedKinds: ensureList(item.recommendedKinds),
      targetId: item.targetId || '',
      targetName: item.targetName || '',
      targetType: item.targetType || '',
      cityId: item.cityId || '',
      cityName: item.cityName || '',
      outcomes: ensureList(item.outcomes),
      noveltyKey: item.noveltyKey || '',
      source: item.source || '',
      routineLike: Boolean(item.routineLike),
      dramaticPriority: Number(item.dramaticPriority || 0),
      dynamicOnly: Boolean(item.dynamicOnly),
      weight: Number(item.weight || 0),
      localChoice: item.localChoice ? { ...item.localChoice } : null
    })),
    characterCards,
    historical: historicalBundle,
    encounters: encounterBundle
  };
}

module.exports = {
  buildDynamicPlanningBundle,
  recentDynamicChoiceHistory,
  recentSelectedDynamicChoiceHistory
};


