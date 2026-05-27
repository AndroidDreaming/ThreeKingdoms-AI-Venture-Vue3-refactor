const { sanitizeChronicleText, hasObviousMojibake } = require('./chronicleV5TextSanitizerCoreSafe');
const { buildLocalNarrationText } = require('./chronicleV5NarrationConfigSafe');

function isHtmlLike(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  return /<!doctype html|<html\b|<head\b|<body\b|<meta\b|<title\b|<script\b|<link\b/i.test(text);
}

/* Legacy duplicate implementation retained only for history.
function repairEraAnachronisms(value) {
  return String(value || '')
    .replace(/异人志/g, '旧史残简')
    .replace(/演义史说/g, '街谈旧闻')
    .replace(/通鉴故事/g, '旧史')
    .replace(/后人(?:都|常|每每|往往)?说/g, '坊间常说')
    .replace(/史书早有记载/g, '旧闻里早有影子');
}

function normalizeNarrationText(value, fallbackText = '') {
  const raw = String(value || '').trim();
  const fallback = String(fallbackText || '').trim();
  const sanitizedFallback = repairNumericMetaLeakage(
    stripNarrationLeakageSentences(
      sanitizeChronicleText(fallback, '')
    )
  ).trim();

  if (!raw) {
    return sanitizedFallback || buildLocalNarrationText('', 'provider_unavailable');
  }

  if (isHtmlLike(raw)) {
    return buildLocalNarrationText(sanitizedFallback, 'provider_endpoint_invalid');
  }

  const sanitized = repairEraAnachronisms(sanitizeChronicleText(raw, '')).trim();
  if (!sanitized || hasObviousMojibake(sanitized)) {
    return sanitizedFallback || buildLocalNarrationText('', 'provider_unavailable');
  }

  return sanitized;
}

function repairScene(scene, fallbackText = '') {
  const next = scene && typeof scene === 'object' ? { ...scene } : {};
  next.text = normalizeNarrationText(next.text, fallbackText);
  if (next.summary) {
    next.summary = normalizeNarrationText(next.summary, next.text).replace(/\n+/g, ' ').trim();
  }
  if (next.statusLine) {
    next.statusLine = sanitizeChronicleText(next.statusLine, '').replace(/\s{2,}/g, ' ').trim();
  }
  return next;
}

function chooseNarrationText(primary, secondary, fallbackText = '') {
  const first = normalizeNarrationText(primary, '');
  if (first) return first;
  const second = normalizeNarrationText(secondary, '');
  if (second) return second;
  return normalizeNarrationText('', fallbackText);
}

function chooseNarrationTextDetailed(primary, secondary, fallbackText = '') {
  const first = normalizeNarrationText(primary, '');
  if (first) {
    return { text: first, source: 'stream_primary' };
  }
  const second = normalizeNarrationText(secondary, '');
  if (second) {
    return { text: second, source: 'provider_secondary' };
  }
  return {
    text: normalizeNarrationText('', fallbackText),
    source: 'local_fallback'
  };
}

module.exports = {
  isHtmlLike,
  normalizeNarrationText,
  repairScene,
  chooseNarrationText,
  chooseNarrationTextDetailed
};
*/

function repairEraAnachronisms(value) {
  return String(value || '')
    .replace(/三国志/g, '旧史残简')
    .replace(/三国演义/g, '街谈旧闻')
    .replace(/资治通鉴/g, '旧史')
    .replace(/后人(?:都|往往)?说/g, '坊间常说')
    .replace(/史书早有记载/g, '旧闻里早有影子');
}

function repairNumericMetaLeakage(value) {
  const text = String(value || '');
  if (!text) return '';
  return text
    .replace(/[^。！？\n]*?(?:数值|属性|面板)[^。！？\n]*[。！？]?/g, '')
    .replace(
      /[^。！？\n]*(?:士气|谋略|影响|影响力|外交|治理|军略|兵力|钱财|粮秣|健康|疲劳|声望|名望|魅力|武艺|武学|战略|统御|人脉|威望)[^。！？\n]*?(?:\+\d+|＋\d+|-\d+|－\d+|添[一二三四五六七八九十百两俩\d]+|加[一二三四五六七八九十百两俩\d]+|增[一二三四五六七八九十百两俩\d]+|减[一二三四五六七八九十百两俩\d]+|升[一二三四五六七八九十百两俩\d]+|降[一二三四五六七八九十百两俩\d]+)[^。！？\n]*[。！？]?/g,
      ''
    )
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isNarrationLeakageSentence(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;

  if (/(?:结构化状态包|状态包显示|根据提供的状态包|根据提供的结构化状态包|续写这一回的故事|主角是|身份是|地点在|正在代治|需要根据.*状态包)/.test(text)) {
    return true;
  }

  if (/(?:输出要求|系统提示|用户要求|只返回|JSON|schema|设定要求|剧情要求)/i.test(text)) {
    return true;
  }

  if (/(?:这一回结果是|这一步里|更大的史势并没有离远|后续走向开始偏离原本史势|你已经深度插入这场事局)/.test(text)) {
    return true;
  }

  if (/^(?:嗯|好|先|让我|我需要|我先)(?:[，,。]\s*|\s*)/.test(text) && /(?:状态包|续写|剧情|故事|结构化)/.test(text)) {
    return true;
  }

  return false;
}

function isNarrationLeakageSentenceV2(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;

  if (/(?:\u7ed3\u6784\u5316\u72b6\u6001\u5305|\u72b6\u6001\u5305\u663e\u793a|\u6839\u636e\u63d0\u4f9b\u7684\u72b6\u6001\u5305|\u6839\u636e\u63d0\u4f9b\u7684\u7ed3\u6784\u5316\u72b6\u6001\u5305|\u7eed\u5199\u8fd9\u4e00\u56de\u7684\u6545\u4e8b|\u4e3b\u89d2\u662f|\u8eab\u4efd\u662f|\u5730\u70b9\u5728|\u6b63\u5728\u4ee3\u6cbb|\u9700\u8981\u6839\u636e.*\u72b6\u6001\u5305)/.test(text)) {
    return true;
  }
  if (/(?:\u8f93\u51fa\u8981\u6c42|\u7cfb\u7edf\u63d0\u793a|\u7528\u6237\u8981\u6c42|\u53ea\u8fd4\u56de|JSON|schema|\u8bbe\u5b9a\u8981\u6c42|\u5267\u60c5\u8981\u6c42)/i.test(text)) {
    return true;
  }
  if (/(?:\u8fd9\u4e00\u56de\u7ed3\u679c\u662f|\u8fd9\u4e00\u6b65\u91cc|\u66f4\u5927\u7684\u53f2\u52bf\u5e76\u6ca1\u6709\u79bb\u8fdc|\u540e\u7eed\u8d70\u5411\u5f00\u59cb\u504f\u79bb\u539f\u672c\u53f2\u52bf|\u4f60\u5df2\u7ecf\u6df1\u5ea6\u63d2\u5165\u8fd9\u573a\u4e8b\u5c40)/.test(text)) {
    return true;
  }
  if (/(?:\u65f6\u4ee3\u9501\u5b9a\u5728|\u8fd9\u662f\u4e00\u4e2a\u53d9\u4e8b\u4efb\u52a1|\u5df2\u7ecf\u88c1\u5b9a\u7684|\u6709\u8fc7\u7a0b\u3001\u6709\u4ee3\u4ef7\u3001\u6709\u65f6\u4ee3\u91cd\u91cf\u7684\u6b63\u6587|\u53ea\u8d1f\u8d23\u628a.*\u5199\u6210)/.test(text)) {
    return true;
  }
  if (/^(?:\u55ef|\u597d|\u5148|\u8ba9\u6211|\u6211\u9700\u8981|\u6211\u5148)(?:[\uff0c,\u3002]\s*|\s*)/.test(text) && /(?:\u72b6\u6001\u5305|\u7eed\u5199|\u5267\u60c5|\u6545\u4e8b|\u7ed3\u6784\u5316)/.test(text)) {
    return true;
  }
  return false;
}

function stripNarrationLeakageSentences(text) {
  const input = String(text || '').trim();
  if (!input) return '';

  return input
    .split(/(?<=[。！？\n])/)
    .map((segment) => segment.trim())
    .filter((segment) => segment && !isNarrationLeakageSentenceV2(segment))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeNarrationText(value, fallbackText = '') {
  const raw = String(value || '').trim();
  const fallback = String(fallbackText || '').trim();
  const sanitizedFallback = repairNumericMetaLeakage(
    stripNarrationLeakageSentences(
      sanitizeChronicleText(fallback, '')
    )
  ).trim();

  if (!raw) {
    return sanitizedFallback || buildLocalNarrationText('', 'provider_unavailable');
  }

  if (isHtmlLike(raw)) {
    return buildLocalNarrationText(sanitizedFallback, 'provider_endpoint_invalid');
  }

  const sanitized = repairNumericMetaLeakage(
    stripNarrationLeakageSentences(
      repairEraAnachronisms(sanitizeChronicleText(raw, ''))
    )
  ).trim();
  if (!sanitized || hasObviousMojibake(sanitized)) {
    return sanitizedFallback || buildLocalNarrationText('', 'provider_unavailable');
  }

  return sanitized;
}

function repairScene(scene, fallbackText = '') {
  const next = scene && typeof scene === 'object' ? { ...scene } : {};
  next.text = normalizeNarrationText(next.text, fallbackText);
  if (next.summary) {
    next.summary = normalizeNarrationText(next.summary, next.text).replace(/\n+/g, ' ').trim();
  }
  if (next.statusLine) {
    next.statusLine = sanitizeChronicleText(next.statusLine, '').replace(/\s{2,}/g, ' ').trim();
  }
  return next;
}

function chooseNarrationText(primary, secondary, fallbackText = '') {
  const first = normalizeNarrationText(primary, '');
  if (first) return first;
  const second = normalizeNarrationText(secondary, '');
  if (second) return second;
  return normalizeNarrationText('', fallbackText);
}

function chooseNarrationTextDetailed(primary, secondary, fallbackText = '') {
  const first = normalizeNarrationText(primary, '');
  if (first) {
    return { text: first, source: 'stream_primary' };
  }
  const second = normalizeNarrationText(secondary, '');
  if (second) {
    return { text: second, source: 'provider_secondary' };
  }
  return {
    text: normalizeNarrationText('', fallbackText),
    source: 'local_fallback'
  };
}

module.exports = {
  isHtmlLike,
  normalizeNarrationText,
  repairScene,
  chooseNarrationText,
  chooseNarrationTextDetailed
};
