const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCoreSafe');

const NARRATION_CONFIG = {
  request: {
    systemPrompt: [
      '你是文字游戏引擎，负责把已经由本地规则引擎裁定的事实，写成汉末至三国背景的沉浸式中文剧情。',
      '整段正文必须以主角“我”为主视角，除对话或他人称呼外，不要用“你”或主角姓名当作旁白主语。',
      '只能输出简体中文正文，不要解释规则，不要泄露系统信息，不要输出 JSON、代码块、HTML、标题、标签或角色名冒号格式。',
      '不得篡改输入中已经判定的年份、地点、人物、成败、数值变化、历史事件和状态约束。',
      '时代约束是硬性要求：不得出现后世成书书名、后世评话体系、现代口语、现代行业称呼或穿越式知识。严禁写“三国志”、“三国演义”、“资治通鉴”、“小说里写过”等后世视角。',
      '人物说话必须符合汉末三国语境：要有身份、场景、距离感与时代气口，不要写成现代聊天、解释式对话或读者视角的呼叫。',
      '若输入里混入英文标签、乱码、残缺短句、HTML 页面或结构碎片，请直接丢弃这些脏内容，改写成正常中文叙事。',
      '文风要有时代感，优先使用东汉末至三国的语境和词汇，兼顾军政、江湖、人情、门派与乱世氛围。',
      '不要写玩家、系统、设定、数值卡面等元叙事词汇。',
      '禁止把正文写成属性播报、面板播报或结算播报，禁止出现“数值变动”“士气+1”“谋略添一”“影响加二”这类表述。'
    ].join(''),
    maxTokens: 1600
  },
  validation: {
    minLength: 72,
    minPartialLength: 48,
    minChineseChars: 22,
    commitStreamMinLength: 36,
    maxLatinRatio: 0.18,
    maxBracketRatio: 0.12
  },
  streaming: {
    replayChunkSize: 24
  },
  status: {
    turnAccepted: '这一手已经落下，局势正在续写。',
    waitingOpening: '灵境叙事已接通，正在落下这一手的正文。',
    reasoningOnly: '灵境正在推演细节，正文稍后落下。',
    degradedToNonStream: '灵境流式不稳，正在改用整段补写。',
    localDisabled: '当前未启用灵境叙事，本回合将直接使用本地续写。',
    localFallback: '灵境暂时失联，这一手先由本地续写接住。',
    choicesReady: '正文已写定，正在整理后续可选行动。'
  },
  localFallback: {
    genericLead: '局势没有因为片刻沉寂而停住。',
    genericTail: '城中灯火渐深，我这一手留下的余波仍沿着街巷、营帐、厅堂与山门慢慢发酵；等下一回合再落子时，它们都会以新的模样回到我面前。'
  },
  filters: {
    metaLinePattern: /^(system|assistant|user|prompt|json|schema|输出要求|要求：|说明：|角色设定|设定：|```)/i,
    leakagePattern: /<(system|assistant|user)|```|^\s*(system|assistant|user|json|prompt)\b/im
  }
};

function ensureSentenceEnding(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return /[。！？…]$/.test(value) ? value : `${value}。`;
}

function isFallbackMetaSentence(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;
  return /(?:结构化状态包|状态包显示|根据给定的(?:结构化)?状态包|这是一[个个]叙事任务|时代锁定在|主角是|身份是|地点在|正在代治|这一回结果是|你已经深度插入这场事局|后续走向开始偏离原本史势)/.test(text);
}

function stripFallbackMetaLeakage(text) {
  const input = String(text || '').trim();
  if (!input) return '';
  return input
    .split(/(?<=[。！？\n])/)
    .map((segment) => segment.trim())
    .filter((segment) => segment && !isFallbackMetaSentence(segment))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildLocalNarrationText(fallbackText, reasonCode = 'provider_unavailable') {
  const base = stripFallbackMetaLeakage(sanitizeChronicleText(fallbackText, '')).trim();
  const baseLooksLikeHtml = /<!doctype html|<html\b|<head\b|<body\b|<meta\b|<title\b|<script\b|<link\b/i.test(base);
  if (!base) {
    return `${NARRATION_CONFIG.localFallback.genericLead}${NARRATION_CONFIG.localFallback.genericTail}`;
  }

  if (!baseLooksLikeHtml && base.length >= NARRATION_CONFIG.validation.minPartialLength) {
    return base;
  }

  const introMap = {
    provider_disabled: '这一回合暂由局势本身替我续上一笔。',
    provider_first_byte_timeout: '灵境长久未见首段声息，局势只能先从眼前的人心与风声里续下去。',
    provider_reasoning_only_timeout: '灵境一直在推演，正文却迟迟未落，这一手先由现实局面接住。',
    provider_first_text_late: '灵境已有回响，但正文起笔还没真正落稳，局势先顺着眼前的变化转动。',
    provider_timeout: '正文起笔迟迟未落，局势却已经先一步转动。',
    provider_stream_idle: '灵境叙事半途失声，城中的风声却没有停。',
    provider_endpoint_invalid: '这一回的外援没有接上，眼前的局面只能先顺着既成的变化往前推。',
    provider_nonstream_failed: '补写也没有顺利接上，这一手便先按局势演化落成。',
    provider_nonstream_timeout: '整段补写等得太久，这一手便先按眼下的局势落成。',
    provider_unavailable: '这一步先由城中风声、人心与旧账接着往前走。'
  };

  const intro = introMap[reasonCode] || introMap.provider_unavailable;
  if (baseLooksLikeHtml) {
    return `${intro}${NARRATION_CONFIG.localFallback.genericTail}`;
  }
  return `${intro}${ensureSentenceEnding(base)}${NARRATION_CONFIG.localFallback.genericTail}`;
}

module.exports = {
  NARRATION_CONFIG,
  buildLocalNarrationText
};
