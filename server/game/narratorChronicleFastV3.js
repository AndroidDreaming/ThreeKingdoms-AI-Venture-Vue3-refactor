const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { sanitizeChronicleText, hasObviousMojibake } = require('./chronicleV5TextSanitizerCoreSafe');
const { NARRATION_CONFIG, buildLocalNarrationText } = require('./chronicleV5NarrationConfigSafe');

function resolveEndpointStrategy(settings) {
  const explicit = String(
    (settings && (settings.endpointStrategy || settings.endpointMode))
    || ''
  ).trim().toLowerCase();
  if (explicit && explicit !== 'auto') return explicit;

  const apiBaseUrl = String(settings && settings.apiBaseUrl || '').trim().toLowerCase();
  if (/\/(?:chat\/completions|responses)\/?$/i.test(apiBaseUrl)) return 'exact_only';

  const providerName = String(settings && settings.providerName || '').trim().toLowerCase();
  if (/glm|zhipu/.test(providerName)) return 'v1_only';
  return 'auto';
}

function uniqueStrings(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)));
}

function deriveApiBaseCandidates(apiBaseUrl) {
  const trimmed = String(apiBaseUrl || '').replace(/\/$/, '');
  if (!trimmed) return [];
  return uniqueStrings([
    trimmed,
    trimmed.replace(/\/v1\/chat\/completions$/i, '/v1'),
    trimmed.replace(/\/chat\/completions$/i, ''),
    trimmed.replace(/\/v1\/responses$/i, '/v1'),
    trimmed.replace(/\/responses$/i, '')
  ]);
}

function buildEndpointCandidates(apiBaseUrl, pathSuffix, settings) {
  const normalizedSuffix = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  const candidates = [];
  const endpointStrategy = resolveEndpointStrategy(settings);
  const baseCandidates = deriveApiBaseCandidates(apiBaseUrl);

  if (!baseCandidates.length) return [];
  if (endpointStrategy === 'exact_only') {
    return [String(apiBaseUrl || '').replace(/\/$/, '')].filter(Boolean);
  }

  baseCandidates.forEach((baseUrl) => {
    if (baseUrl.endsWith(normalizedSuffix)) {
      candidates.push(baseUrl);
      return;
    }

    if (endpointStrategy === 'v1_only') {
      if (baseUrl.endsWith('/v1')) {
        candidates.push(baseUrl + normalizedSuffix);
        candidates.push(baseUrl.slice(0, -3) + normalizedSuffix);
      } else {
        candidates.push(baseUrl + '/v1' + normalizedSuffix);
        candidates.push(baseUrl + normalizedSuffix);
      }
      return;
    }

    if (baseUrl.endsWith('/v1')) {
      candidates.push(baseUrl + normalizedSuffix);
      candidates.push(baseUrl.slice(0, -3) + normalizedSuffix);
    } else {
      candidates.push(baseUrl + '/v1' + normalizedSuffix);
      candidates.push(baseUrl + normalizedSuffix);
    }
  });

  return Array.from(new Set(candidates.filter(Boolean)));
}

function withTimeoutSignal(timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(label)), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    },
    timedOut() {
      return controller.signal.aborted;
    },
    reason() {
      const reason = controller.signal.reason;
      return reason && reason.message ? reason.message : label;
    }
  };
}

function readChunkWithTimeout(reader, timeoutMs) {
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`idle-timeout:${timeoutMs}`)), timeoutMs);
    })
  ]);
}

function readResponseTextWithTimeout(response, timeoutMs) {
  return Promise.race([
    response.text(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`body-timeout:${timeoutMs}`)), timeoutMs);
    })
  ]);
}

function isHtmlResponse(response, previewText) {
  const contentType = String(response && response.headers && response.headers.get
    ? response.headers.get('content-type')
    : '').toLowerCase();
  if (contentType.includes('text/html')) return true;
  return /<!doctype html|<html/i.test(String(previewText || ''));
}

function clipPreviewText(value, limit = 220) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function looksLikeMetaNarration(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return /(?:鏃朵唬閿佸畾|缁撴瀯鍖栫姸鎬佸寘|鐘舵€佸寘鏄剧ず|鍙欎簨浠诲姟|鑱岃矗杈圭晫|鍙礋璐ｆ妸|鍐欐垚鏈夎繃绋媩鐢ㄦ埛瑕佹眰鎴憒鍩轰簬缁欏畾鐨勭粨鏋勫寲鐘舵€佸寘|缁啓鍓ф儏|鎬濈淮閾緗鍒嗘瀽濡備笅|璁╂垜鍏堝垎鏋?/.test(value);
}

async function summarizeBadResponse(response, timeoutMs = 5000) {
  if (!response) return 'no-response';
  const parts = [`status:${Number(response.status || 0)}`];
  try {
    const raw = await readResponseTextWithTimeout(response, timeoutMs);
    const preview = clipPreviewText(raw, 220);
    if (preview) parts.push(`body:${preview}`);
  } catch (error) {
    parts.push(`body-read:${error && error.message ? error.message : 'failed'}`);
  }
  return parts.join('|');
}

function createRequestBody(settings, prompt, stream) {
  return JSON.stringify({
    model: settings.model,
    stream,
    temperature: settings.temperature || 0.8,
    max_tokens: NARRATION_CONFIG.request.maxTokens,
    messages: [
      {
        role: 'system',
        content: NARRATION_CONFIG.request.systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });
}

function extractBalancedJsonCandidates(text) {
  const input = String(text || '');
  const candidates = [];
  let start = -1;
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (!quote && char === '[' && input.slice(i, i + 6) === '[DONE]' && depth === 0) {
      candidates.push('[DONE]');
      i += 5;
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '{' || char === '[') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if ((char === '}' || char === ']') && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(input.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function tryParseJsonLoose(value) {
  if (value === '[DONE]') return '[DONE]';

  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    const candidates = extractBalancedJsonCandidates(raw);
    for (const candidate of candidates) {
      if (candidate === '[DONE]') return '[DONE]';
      try {
        return JSON.parse(candidate);
      } catch (innerError) {
        // Continue trying the next candidate.
      }
    }
  }

  return null;
}

function normalizeTextChunk(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => normalizeTextChunk(item)).filter(Boolean).join('');
  if (!value || typeof value !== 'object') return '';

  return [
    normalizeTextChunk(value.text),
    normalizeTextChunk(value.content),
    normalizeTextChunk(value.output_text),
    normalizeTextChunk(value.delta),
    normalizeTextChunk(value.message)
  ].filter(Boolean).join('');
}

function extractTextDelta(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const segments = [];
  const push = (value) => {
    const text = normalizeTextChunk(value);
    if (text) segments.push(text);
  };

  push(payload.text);
  push(payload.content);
  push(payload.output_text);
  push(payload.message && payload.message.content);
  push(payload.message && payload.message.text);
  push(payload.delta && payload.delta.content);
  push(payload.delta && payload.delta.text);
  push(payload.data && payload.data.content);
  push(payload.data && payload.data.text);
  push(payload.data && payload.data.output_text);

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      push(choice && choice.text);
      push(choice && choice.message && choice.message.content);
      push(choice && choice.message && choice.message.text);
      push(choice && choice.delta && choice.delta.content);
      push(choice && choice.delta && choice.delta.text);
      push(choice && choice.delta && choice.delta.output_text);
    });
  }

  if (Array.isArray(payload.output)) {
    payload.output.forEach((item) => {
      push(item && item.content);
      push(item && item.text);
      push(item && item.output_text);
    });
  }

  return segments.join('');
}

function extractReasoningDelta(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const values = [
    payload.reasoning_content,
    payload.message && payload.message.reasoning_content,
    payload.delta && payload.delta.reasoning_content,
    payload.data && payload.data.reasoning_content
  ];

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      values.push(choice && choice.delta && choice.delta.reasoning_content);
      values.push(choice && choice.message && choice.message.reasoning_content);
    });
  }

  return values
    .filter((item) => typeof item === 'string' && item.trim())
    .join('');
}

function collectReasoningCandidates(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const values = [];
  const push = (value) => {
    const text = String(value || '').trim();
    if (text) values.push(text);
  };

  push(payload.reasoning_content);
  push(payload.message && payload.message.reasoning_content);
  push(payload.delta && payload.delta.reasoning_content);
  push(payload.data && payload.data.reasoning_content);

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      push(choice && choice.delta && choice.delta.reasoning_content);
      push(choice && choice.message && choice.message.reasoning_content);
    });
  }

  return uniqueStrings(values);
}

function extractNarrationTextFromResponse(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const segments = [];
  const push = (value) => {
    const text = normalizeTextChunk(value);
    if (text) segments.push(text);
  };

  push(payload.text);
  push(payload.content);
  push(payload.output_text);
  push(payload.message && payload.message.content);
  push(payload.message && payload.message.text);

  if (Array.isArray(payload.choices)) {
    payload.choices.forEach((choice) => {
      push(choice && choice.text);
      push(choice && choice.message && choice.message.content);
      push(choice && choice.message && choice.message.text);
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

  if (segments.length) return segments.join('');

  const reasoningCandidates = collectReasoningCandidates(payload);
  for (const reasoning of reasoningCandidates) {
    const extracted = extractReasoningAnswerCandidates(reasoning, { allowLoose: false });
    const valid = extracted.find((item) => /[\u4e00-\u9fff]/.test(item));
    if (valid) return valid;
  }

  return '';
}

function stripMetaLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !NARRATION_CONFIG.filters.metaLinePattern.test(line))
    .join('\n');
}

function isNarrationLeakageSentence(sentence) {
  const text = String(sentence || '').trim();
  if (!text) return false;

  if (/(?:缁撴瀯鍖栫姸鎬佸寘|鐘舵€佸寘鏄剧ず|鏍规嵁鎻愪緵鐨勭姸鎬佸寘|鏍规嵁鎻愪緵鐨勭粨鏋勫寲鐘舵€佸寘|缁啓杩欎竴鍥炵殑鏁呬簨|涓昏鏄瘄韬唤鏄瘄鍦扮偣鍦▅姝ｅ湪浠ｆ不|闇€瑕佹牴鎹?*鐘舵€佸寘)/.test(text)) {
    return true;
  }

  if (/(?:杈撳嚭瑕佹眰|绯荤粺鎻愮ず|鐢ㄦ埛瑕佹眰|鍙繑鍥瀨JSON|schema|璁惧畾瑕佹眰|鍓ф儏瑕佹眰)/i.test(text)) {
    return true;
  }

  if (/(?:杩欎竴鍥炵粨鏋滄槸|杩欎竴姝ラ噷|鏇村ぇ鐨勫彶鍔垮苟娌℃湁绂昏繙|鍚庣画璧板悜寮€濮嬪亸绂诲師鏈彶鍔縷浣犲凡缁忔繁搴︽彃鍏ヨ繖鍦轰簨灞€)/.test(text)) {
    return true;
  }

  if (/^(?:鍡瘄濂絴鍏坾璁╂垜|鎴戦渶瑕亅鎴戝厛)(?:[锛?銆俔\s*|\s*)/.test(text) && /(?:鐘舵€佸寘|缁啓|鍓ф儏|鏁呬簨|缁撴瀯鍖?/.test(text)) {
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
    .split(/(?<=[銆傦紒锛焅n])/)
    .map((segment) => segment.trim())
    .filter((segment) => segment && !isNarrationLeakageSentenceV2(segment))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeNarrationPlainText(text) {
  return stripNarrationLeakageSentences(sanitizeChronicleText(
    stripMetaLines(
      String(text || '')
        .replace(/```(?:json|text|markdown)?/gi, '')
        .replace(/```/g, '')
        .replace(/^\s*data:\s*/gim, '')
        .replace(/\r/g, '')
    ),
    ''
  )).trim();
}

function extractReasoningAnswerCandidates(text, options = {}) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const allowLoose = options && options.allowLoose === true;

  const candidates = [];
  const push = (value) => {
    const normalized = normalizeNarrationPlainText(value);
    if (normalized && !looksLikeMetaNarration(normalized)) candidates.push(normalized);
  };

  const fencePattern = /```(?:text|markdown|md)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fencePattern.exec(raw))) {
    push(match[1]);
  }

  const labelledPattern = /(?:鏈€缁堝洖绛攟鏈€缁堣緭鍑簗Final Answer|Answer|姝ｆ枃|杈撳嚭)\s*[:锛歖\s*([\s\S]+)/ig;
  while ((match = labelledPattern.exec(raw))) {
    push(match[1]);
  }

  if (!candidates.length && allowLoose) {
    const segments = raw.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    segments.forEach((segment) => {
      if (/[\u4e00-\u9fff]/.test(segment) && !/(I need to|We need to|Let's|the user|user asks|query)/i.test(segment) && !looksLikeMetaNarration(segment)) {
        push(segment);
      }
    });
  }

  return uniqueStrings(candidates);
}

function getTextMetrics(text) {
  const value = String(text || '');
  return {
    length: value.length,
    chinese: (value.match(/[\u4e00-\u9fff]/g) || []).length,
    latin: (value.match(/[A-Za-z]/g) || []).length,
    brackets: (value.match(/[{}[\]<>`]/g) || []).length
  };
}

function hasReadableNarrationSeed(text) {
  const value = cleanNarrationCandidate(text);
  if (!value) return false;
  if (hasObviousMojibake(value)) return false;
  if (NARRATION_CONFIG.filters.leakagePattern.test(value)) return false;

  const metrics = getTextMetrics(value);
  if (metrics.length < 16) return false;
  if (metrics.chinese < 8) return false;
  if (metrics.latin / Math.max(metrics.length, 1) > 0.32) return false;
  if (metrics.brackets / Math.max(metrics.length, 1) > 0.2) return false;

  return true;
}

function cleanNarrationCandidate(input) {
  let text = String(input || '').trim();
  if (!text) return '';

  const parsed = tryParseJsonLoose(text);
  if (parsed && parsed !== '[DONE]') {
    text = extractNarrationTextFromResponse(parsed) || '';
  }

  text = normalizeNarrationPlainText(text);
  if (!text) return '';
  if (isHtmlResponse(null, text)) return '';
  return text;
}

function isValidNarration(text, partial = false) {
  const value = cleanNarrationCandidate(text);
  if (!value) return false;
  if (hasObviousMojibake(value)) return false;
  if (NARRATION_CONFIG.filters.leakagePattern.test(value)) return false;

  const metrics = getTextMetrics(value);
  const minLength = partial
    ? NARRATION_CONFIG.validation.minPartialLength
    : NARRATION_CONFIG.validation.minLength;

  if (metrics.length < minLength) return false;
  if (metrics.chinese < NARRATION_CONFIG.validation.minChineseChars) return false;
  if (metrics.latin / Math.max(metrics.length, 1) > NARRATION_CONFIG.validation.maxLatinRatio) return false;
  if (metrics.brackets / Math.max(metrics.length, 1) > NARRATION_CONFIG.validation.maxBracketRatio) return false;

  return true;
}

function shouldCommitStream(text) {
  const value = cleanNarrationCandidate(text);
  if (!value) return false;
  if (hasObviousMojibake(value)) return false;

  const metrics = getTextMetrics(value);
  return (
    metrics.length >= NARRATION_CONFIG.validation.commitStreamMinLength &&
    metrics.chinese >= Math.floor(NARRATION_CONFIG.validation.minChineseChars / 2) &&
    /[锛屻€傦紒锛燂紱]/.test(value)
  );
}

function stripTrailingClosers(text) {
  return String(text || '')
    .replace(/[\s\u3000]+$/g, '')
    .replace(/[鈥濃€欍€嶃€忥級銆嬨€夈€戙€曪級锛絔+$/g, '')
    .replace(/[\s\u3000]+$/g, '');
}

function hasNarrationClosure(text) {
  const value = stripTrailingClosers(cleanNarrationCandidate(text));
  if (!value) return false;
  return /[銆傦紒锛熲€$/.test(value);
}

function extractClosedNarrationPrefix(text, partial = false) {
  const value = cleanNarrationCandidate(text);
  if (!value) return '';
  const lastClosureIndex = Math.max(
    value.lastIndexOf('銆?),
    value.lastIndexOf('锛?),
    value.lastIndexOf('锛?),
    value.lastIndexOf('鈥?)
  );
  if (lastClosureIndex < 0) return '';
  const clipped = value.slice(0, lastClosureIndex + 1).trim();
  if (!clipped) return '';
  return isValidNarration(clipped, partial) ? clipped : '';
}

function explainNarrationClosure(text) {
  const value = stripTrailingClosers(cleanNarrationCandidate(text));
  if (!value) return 'empty';
  if (/[銆傦紒锛熲€$/.test(value)) return 'closed';
  if (/[锛屻€侊細锛沒$/.test(value)) return 'open-punctuation';
  return 'open-tail';
}

function getFirstContentTimeoutMs(settings) {
  const configured = Number(settings && settings.firstContentTimeoutMs);
  return Number.isFinite(configured) && configured > 0 ? configured : 30000;
}

function getReasoningIdleTimeoutMs(settings) {
  const configured = Number(settings && settings.reasoningStreamIdleTimeoutMs);
  if (Number.isFinite(configured) && configured > 0) return configured;
  const streamIdleTimeoutMs = Number(settings && settings.streamIdleTimeoutMs) || 20000;
  return Math.max(streamIdleTimeoutMs, 45000);
}

function getNonStreamBodyTimeoutMs(settings) {
  const explicit = Number(settings && settings.nonStreamBodyTimeoutMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const maxStreamDurationMs = Number(settings && settings.maxStreamDurationMs) || 120000;
  return Math.max(60000, Math.min(120000, maxStreamDurationMs));
}

function getNonStreamConnectTimeoutMs(settings) {
  const explicit = Number(settings && settings.nonStreamConnectTimeoutMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const bodyTimeoutMs = getNonStreamBodyTimeoutMs(settings);
  const connectTimeoutMs = Number(settings && settings.connectTimeoutMs) || 15000;
  return Math.max(connectTimeoutMs, Math.min(70000, Math.max(30000, bodyTimeoutMs - 10000)));
}

function shouldPreferFinalOnlyRescue(error) {
  const message = String(error && error.message || error || '');
  return /reasoning-only|first-text-late|stream-empty|stream-incomplete/.test(message);
}

function buildFinalOnlyPrompt(prompt, fallbackText) {
  return [
    '鐩存帴杈撳嚭鏈€缁堟鏂囷紝涓嶈瑙ｉ噴锛屼笉瑕佸杩颁换鍔★紝涓嶈杈撳嚭鎬濈淮閾撅紝涓嶈杈撳嚭鈥滄椂浠ｉ攣瀹氣€濃€滅粨鏋勫寲鐘舵€佸寘鈥濃€滃彊浜嬩换鍔♀€濃€滆亴璐ｈ竟鐣屸€濈瓑瀛楁牱銆?,
    '姝ｆ枃蹇呴』鏄畝浣撲腑鏂囩涓€浜虹О锛岀洿鎺ヨ惤鍒板墽鎯呰繃绋嬨€侀樆鍔涖€佷唬浠蜂笌浣欐尝銆?,
    '鑻ヤ綘鎯冲厛鍒嗘瀽锛岃璺宠繃鍒嗘瀽锛岀洿鎺ョ粰鏈€缁堟鏂囥€?,
    '鏃㈡垚浜嬪疄鎽樿锛?,
    clipPreviewText(fallbackText, 900),
    '蹇呰鏃跺啀鍙傝€冨師濮嬩换鍔★細',
    clipPreviewText(prompt, 1500)
  ].join('\n');
}

function drainTransportBuffer(buffer) {
  const lines = String(buffer || '').split(/\r?\n/);
  const remainder = lines.pop() || '';
  const payloads = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const raw = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
    if (!raw) return;
    if (raw === '[DONE]') {
      payloads.push('[DONE]');
      return;
    }

    const candidates = extractBalancedJsonCandidates(raw);
    if (candidates.length) {
      payloads.push(...candidates);
      return;
    }

    if (/[\u4e00-\u9fff]/.test(raw)) {
      payloads.push(raw);
    }
  });

  return { payloads, remainder };
}

async function emitTextDiff(text, state, onText) {
  if (!text || !onText) return;
  if (!state.committed && !shouldCommitStream(text) && !hasReadableNarrationSeed(text)) return;

  const normalized = cleanNarrationCandidate(text);
  if (!normalized) return;

  if (!state.committed) {
    state.committed = true;
  }

  if (normalized.length <= state.emittedLength) return;
  const delta = normalized.slice(state.emittedLength);
  if (!delta) return;

  state.emittedLength = normalized.length;
  await onText(delta);
}

async function streamFromProvider(settings, prompt, onText, onStatus) {
  if (!settings.apiBaseUrl || !settings.apiKey || !settings.model || settings.model === DEFAULT_MODEL) {
    return null;
  }

  const requestBody = createRequestBody(settings, prompt, true);
  const candidates = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions', settings);
  const errors = [];
  const connectTimeoutMs = Number(settings.connectTimeoutMs) || 15000;
  const streamIdleTimeoutMs = Number(settings.streamIdleTimeoutMs) || 20000;
  const maxStreamDurationMs = Number(settings.maxStreamDurationMs) || 120000;
  const firstContentTimeoutMs = getFirstContentTimeoutMs(settings);
  const reasoningIdleTimeoutMs = getReasoningIdleTimeoutMs(settings);
  const activeTransportGraceMs = Math.max(6000, Math.min(15000, Math.floor(streamIdleTimeoutMs * 0.9)));

  for (const url of candidates) {
    const connectTimeout = withTimeoutSignal(connectTimeoutMs, `connect-timeout:${connectTimeoutMs}`);
    let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: requestBody,
        signal: connectTimeout.signal
      });
    } catch (error) {
      errors.push(`${url} -> ${connectTimeout.timedOut() ? connectTimeout.reason() : error.message}`);
      connectTimeout.clear();
      continue;
    }
    connectTimeout.clear();

    if (!response.ok || !response.body) {
      errors.push(`${url} -> ${await summarizeBadResponse(response)}`);
      continue;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const startedAt = Date.now();
    const firstContentDeadline = startedAt + firstContentTimeoutMs;
    const hardFirstContentDeadline = firstContentDeadline + activeTransportGraceMs;
    const streamState = {
      committed: false,
      emittedLength: 0
    };

    let buffer = '';
    let checkedFirstChunk = false;
    let rawText = '';
    let sawReasoningOnly = false;
    let reasoningStatusSent = false;
    let parseMisses = 0;
    let sawAnyTransport = false;
    let sawAnyPayload = false;
    let lastTransportAt = startedAt;
    let sawDoneToken = false;
    let reasoningText = '';

    try {
      while (true) {
        if (Date.now() - startedAt > maxStreamDurationMs) {
          throw new Error(`stream-timeout:${maxStreamDurationMs}|parse-miss:${parseMisses}`);
        }

        const readTimeoutMs = sawReasoningOnly && !streamState.committed && !cleanNarrationCandidate(rawText)
          ? reasoningIdleTimeoutMs
          : streamIdleTimeoutMs;
        let chunk;
        try {
          chunk = await readChunkWithTimeout(reader, readTimeoutMs);
        } catch (error) {
          if (String(error && error.message || '').startsWith('idle-timeout:') && sawReasoningOnly && !streamState.committed && !cleanNarrationCandidate(rawText)) {
            throw new Error(`reasoning-only-timeout:${readTimeoutMs}|parse-miss:${parseMisses}`);
          }
          throw error;
        }
        const { done, value } = chunk;
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        if (chunkText) {
          sawAnyTransport = true;
          lastTransportAt = Date.now();
        }
        buffer += chunkText;

        if (!checkedFirstChunk) {
          checkedFirstChunk = true;
          if (isHtmlResponse(response, chunkText)) {
            throw new Error(`upstream-returned-html:${clipPreviewText(chunkText, 180)}`);
          }
        }

        const drained = drainTransportBuffer(buffer);
        buffer = drained.remainder;

        for (const payloadText of drained.payloads) {
          if (payloadText === '[DONE]') {
            sawDoneToken = true;
            break;
          }

          const parsed = tryParseJsonLoose(payloadText);
          if (parsed === '[DONE]') {
            sawDoneToken = true;
            break;
          }

          if (parsed) {
            sawAnyPayload = true;
            const textDelta = extractTextDelta(parsed);
            const reasoningDelta = extractReasoningDelta(parsed);

            if (!textDelta && reasoningDelta) {
              sawReasoningOnly = true;
              reasoningText += reasoningDelta;
              if (!reasoningStatusSent && onStatus) {
                reasoningStatusSent = true;
                await onStatus(NARRATION_CONFIG.status.reasoningOnly);
              }
            }

            if (textDelta) {
              rawText += textDelta;
              await emitTextDiff(rawText, streamState, onText);
            }
            continue;
          }

          parseMisses += 1;
          const looseText = cleanNarrationCandidate(payloadText);
          if (looseText && /[\u4e00-\u9fff]/.test(looseText)) {
            rawText += looseText;
            await emitTextDiff(rawText, streamState, onText);
          }
        }

        const now = Date.now();
        if (!cleanNarrationCandidate(rawText) && !hasReadableNarrationSeed(rawText) && now > firstContentDeadline) {
          const recentTransport = sawAnyTransport && (now - lastTransportAt) <= streamIdleTimeoutMs;
          const streamStillAdvancing = recentTransport || sawAnyPayload || sawReasoningOnly || parseMisses > 0;

          if (streamStillAdvancing && now <= hardFirstContentDeadline) {
            continue;
          }

          if (!sawAnyTransport) {
            throw new Error(`first-byte-timeout:${firstContentTimeoutMs}|parse-miss:${parseMisses}`);
          }
          if (sawReasoningOnly) {
            throw new Error(`reasoning-only-timeout:${firstContentTimeoutMs}|grace:${activeTransportGraceMs}|parse-miss:${parseMisses}`);
          }
          throw new Error(`first-text-late:${firstContentTimeoutMs}|grace:${activeTransportGraceMs}|parse-miss:${parseMisses}`);
        }
      }

      const trailing = drainTransportBuffer(`${buffer}\n`);
      for (const payloadText of trailing.payloads) {
        if (payloadText === '[DONE]') {
          sawDoneToken = true;
          continue;
        }
        const parsed = tryParseJsonLoose(payloadText);
        if (parsed && parsed !== '[DONE]') {
          const textDelta = extractTextDelta(parsed);
          const reasoningDelta = extractReasoningDelta(parsed);
          if (textDelta) {
            rawText += textDelta;
          } else if (reasoningDelta) {
            reasoningText += reasoningDelta;
            const derived = extractReasoningAnswerCandidates(reasoningText, { allowLoose: false }).find((item) => isValidNarration(item, true));
            if (derived && derived.length > rawText.length) rawText = derived;
          }
        } else if (parsed === '[DONE]') {
          sawDoneToken = true;
        } else if (/[\u4e00-\u9fff]/.test(payloadText)) {
          rawText += payloadText;
        }
      }

      const finalText = cleanNarrationCandidate(rawText);
      const finalClosed = hasNarrationClosure(finalText);
      const finalClosure = explainNarrationClosure(finalText);
      if (!finalText && sawReasoningOnly && sawDoneToken) {
        throw new Error(`reasoning-only-finished:done:${sawDoneToken ? 1 : 0}|parse-miss:${parseMisses}`);
      }
      if (isValidNarration(finalText) && finalClosed) {
        await emitTextDiff(finalText, streamState, onText);
        return {
          text: finalText,
          reason: 'provider_stream_ok',
          detail: `stream-ok|parse-miss:${parseMisses}|done:${sawDoneToken ? 1 : 0}|closure:${finalClosure}`
        };
      }

      if (isValidNarration(finalText, true) && streamState.committed && finalClosed) {
        await emitTextDiff(finalText, streamState, onText);
        return {
          text: finalText,
          reason: 'provider_partial_stream',
          detail: `partial-stream-tail|parse-miss:${parseMisses}|done:${sawDoneToken ? 1 : 0}|closure:${finalClosure}`
        };
      }
      if (isValidNarration(finalText, true) && streamState.committed) {
        throw new Error(`stream-incomplete:done:${sawDoneToken ? 1 : 0}|closure:${finalClosure}|parse-miss:${parseMisses}`);
      }
    } catch (error) {
      const derivedReasoningText = extractReasoningAnswerCandidates(reasoningText, { allowLoose: false }).find((item) => isValidNarration(item, true)) || '';
      const partialText = cleanNarrationCandidate(derivedReasoningText || rawText);
      const partialClosed = hasNarrationClosure(partialText);
      const partialClosure = explainNarrationClosure(partialText);
      if (isValidNarration(partialText, true) && streamState.committed && partialClosed) {
        await emitTextDiff(partialText, streamState, onText);
        return {
          text: partialText,
          reason: 'provider_partial_stream',
          detail: `partial-stream|${error.message || 'unknown'}|parse-miss:${parseMisses}|done:${sawDoneToken ? 1 : 0}|closure:${partialClosure}`
        };
      }

      errors.push(`${url} -> ${error.message || 'stream-error'}|parse-miss:${parseMisses}`);
      try {
        await reader.cancel();
      } catch (cancelError) {
        // Ignore cancel errors.
      }
      continue;
    }

    errors.push(`${url} -> stream-empty|parse-miss:${parseMisses}`);
  }

  throw new Error(`upstream-unavailable:${errors.join(' | ') || candidates.join(' | ')}`);
}

async function requestNonStreamNarration(settings, prompt) {
  const requestBody = createRequestBody(settings, prompt, false);
  const candidates = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions', settings);
  const errors = [];
  const connectTimeoutMs = getNonStreamConnectTimeoutMs(settings);
  const bodyTimeoutMs = getNonStreamBodyTimeoutMs(settings);

  for (const url of candidates) {
    const connectTimeout = withTimeoutSignal(connectTimeoutMs, `connect-timeout:${connectTimeoutMs}`);
    let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: requestBody,
        signal: connectTimeout.signal
      });
    } catch (error) {
      errors.push(`${url} -> ${connectTimeout.timedOut() ? connectTimeout.reason() : error.message}`);
      connectTimeout.clear();
      continue;
    }
    connectTimeout.clear();

    if (!response.ok) {
      errors.push(`${url} -> ${await summarizeBadResponse(response)}`);
      continue;
    }

    const rawText = await readResponseTextWithTimeout(response, bodyTimeoutMs);
    if (isHtmlResponse(response, rawText)) {
      errors.push(`${url} -> upstream-returned-html:${clipPreviewText(rawText, 180)}`);
      continue;
    }

    const parsed = tryParseJsonLoose(rawText);
    const candidate = parsed && parsed !== '[DONE]'
      ? extractNarrationTextFromResponse(parsed)
      : rawText;
    const explicitReasoningAnswer = parsed && parsed !== '[DONE]'
      ? extractReasoningAnswerCandidates(extractReasoningDelta(parsed), { allowLoose: false }).find((item) => isValidNarration(item, true))
      : '';
    const reasoningOnly = parsed && parsed !== '[DONE]' && extractReasoningDelta(parsed) && !cleanNarrationCandidate(candidate) && !explicitReasoningAnswer;
    const normalized = cleanNarrationCandidate(candidate);
    const clippedNormalized = extractClosedNarrationPrefix(normalized, true);
    const clippedReasoningAnswer = extractClosedNarrationPrefix(explicitReasoningAnswer, true);
    const closure = explainNarrationClosure(normalized);

    if ((isValidNarration(normalized) || isValidNarration(normalized, true)) && hasNarrationClosure(normalized)) {
      return normalized;
    }

    if (clippedNormalized) {
      return clippedNormalized;
    }

    if (explicitReasoningAnswer && hasNarrationClosure(explicitReasoningAnswer)) {
      return explicitReasoningAnswer;
    }

    if (clippedReasoningAnswer) {
      return clippedReasoningAnswer;
    }

    if (reasoningOnly) {
      errors.push(`${url} -> reasoning-only-body`);
      continue;
    }

    errors.push(`${url} -> invalid-body|closure:${closure}`);
  }

  throw new Error(`nonstream-unavailable:${errors.join(' | ') || candidates.join(' | ')}`);
}

async function requestFinalOnlyNarration(settings, prompt, fallbackText) {
  const requestBody = JSON.stringify({
    model: settings.model,
    stream: false,
    temperature: Math.max(0.4, Math.min(0.8, Number(settings.temperature) || 0.6)),
    max_tokens: Math.max(1200, Math.min(1800, Number(NARRATION_CONFIG.request.maxTokens || 1600))),
    messages: [
      {
        role: 'system',
        content: '浣犳槸鏂囧瓧娓告垙寮曟搸銆傚彧杈撳嚭鏈€缁堟鏂囷紝涓嶈緭鍑烘€濈淮閾俱€佸垎鏋愩€佷换鍔″杩般€丣SON銆佹爣绛俱€?
      },
      {
        role: 'user',
        content: buildFinalOnlyPrompt(prompt, fallbackText)
      }
    ]
  });
  const candidates = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions', settings);
  const errors = [];
  const connectTimeoutMs = getNonStreamConnectTimeoutMs(settings);
  const bodyTimeoutMs = Math.max(30000, Math.min(90000, getNonStreamBodyTimeoutMs(settings)));

  for (const url of candidates) {
    const connectTimeout = withTimeoutSignal(connectTimeoutMs, `connect-timeout:${connectTimeoutMs}`);
    let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: requestBody,
        signal: connectTimeout.signal
      });
    } catch (error) {
      errors.push(`${url} -> ${connectTimeout.timedOut() ? connectTimeout.reason() : error.message}`);
      connectTimeout.clear();
      continue;
    }
    connectTimeout.clear();

    if (!response.ok) {
      errors.push(`${url} -> ${await summarizeBadResponse(response)}`);
      continue;
    }

    const rawText = await readResponseTextWithTimeout(response, bodyTimeoutMs);
    if (isHtmlResponse(response, rawText)) {
      errors.push(`${url} -> upstream-returned-html:${clipPreviewText(rawText, 180)}`);
      continue;
    }

    const parsed = tryParseJsonLoose(rawText);
    const candidate = parsed && parsed !== '[DONE]'
      ? extractNarrationTextFromResponse(parsed)
      : rawText;
    const normalized = cleanNarrationCandidate(candidate);
    const clippedNormalized = extractClosedNarrationPrefix(normalized, true);
    if ((isValidNarration(normalized) || isValidNarration(normalized, true)) && hasNarrationClosure(normalized)) {
      return normalized;
    }
    if (clippedNormalized) {
      return clippedNormalized;
    }
    errors.push(`${url} -> final-only-invalid`);
  }

  throw new Error(`final-only-unavailable:${errors.join(' | ') || candidates.join(' | ')}`);
}

async function streamFallback(text, onText) {
  const normalized = sanitizeChronicleText(text, text);
  if (!onText || !normalized) return normalized;

  const pattern = new RegExp(`.{1,${NARRATION_CONFIG.streaming.replayChunkSize}}`, 'g');
  const pieces = normalized.match(pattern) || [normalized];
  for (const piece of pieces) {
    await onText(piece);
  }
  return normalized;
}

function mapFallbackReason(error, providerEnabled) {
  if (!providerEnabled) {
    return {
      code: 'provider_disabled',
      statusText: NARRATION_CONFIG.status.localDisabled
    };
  }

  const message = String((error && error.message) || error || '');
  if (message.includes('first-byte-timeout')) {
    return {
      code: 'provider_first_byte_timeout',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('reasoning-only-timeout')) {
    return {
      code: 'provider_reasoning_only_timeout',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('reasoning-only-finished')) {
    return {
      code: 'provider_reasoning_only_timeout',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('first-text-late')) {
    return {
      code: 'provider_first_text_late',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('first-content-timeout')) {
    return {
      code: 'provider_timeout',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('idle-timeout')) {
    return {
      code: 'provider_stream_idle',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('upstream-returned-html')) {
    return {
      code: 'provider_endpoint_invalid',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('nonstream-unavailable')) {
    return {
      code: 'provider_nonstream_failed',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  if (message.includes('body-timeout')) {
    return {
      code: 'provider_nonstream_timeout',
      statusText: NARRATION_CONFIG.status.localFallback
    };
  }
  return {
    code: 'provider_unavailable',
    statusText: NARRATION_CONFIG.status.localFallback
  };
}

async function narrateScene(options) {
  const { settings, prompt, fallbackText, onText, onStatus } = options;
  const providerEnabled = Boolean(
    settings &&
    settings.apiBaseUrl &&
    settings.apiKey &&
    settings.model &&
    settings.model !== DEFAULT_MODEL
  );

  if (onStatus) {
    await onStatus(
      providerEnabled
        ? NARRATION_CONFIG.status.waitingOpening
        : NARRATION_CONFIG.status.localDisabled
    );
  }

  if (!providerEnabled) {
    const fallback = buildLocalNarrationText(fallbackText, 'provider_disabled');
    const replayed = await streamFallback(fallback, onText);
    return {
      text: replayed.trim(),
      mode: 'fallback',
      reason: 'provider_disabled',
      detail: [
        'provider-disabled',
        `request-model:${String(settings && settings.model || '')}`,
        `request-max_tokens:${Number(NARRATION_CONFIG.request.maxTokens || 0)}`
      ].join('|')
    };
  }

  let streamError = null;
  let nonStreamError = null;
  let finalOnlyError = null;

  try {
    const streamed = await streamFromProvider(settings, prompt, onText, onStatus);
    if (streamed && streamed.text) {
      return {
        text: streamed.text.trim(),
        mode: 'provider',
        reason: streamed.reason || 'provider_stream_ok',
        detail: [
          streamed.detail || '',
          `request-model:${String(settings && settings.model || '')}`,
          `request-max_tokens:${Number(NARRATION_CONFIG.request.maxTokens || 0)}`
        ].filter(Boolean).join('|')
      };
    }
  } catch (error) {
    streamError = error;
  }

  const tryNonStream = async() => {
    if (onStatus) {
      await onStatus(NARRATION_CONFIG.status.degradedToNonStream);
    }
    try {
      const nonStreamText = await requestNonStreamNarration(settings, prompt);
      if (!nonStreamText) return null;
      const replayed = await streamFallback(nonStreamText, onText);
      return {
        text: replayed.trim(),
        mode: 'provider',
        reason: 'provider_nonstream_ok',
        detail: [
          `nonstream-after:${streamError ? String(streamError.message || streamError) : 'stream-empty'}`,
          `request-model:${String(settings && settings.model || '')}`,
          `request-max_tokens:${Number(NARRATION_CONFIG.request.maxTokens || 0)}`
        ].join('|')
      };
    } catch (error) {
      nonStreamError = error;
      return null;
    }
  };

  const tryFinalOnly = async() => {
    if (onStatus) {
      await onStatus('灵境正在收束推演，尝试只提取最终正文。');
    }
    try {
      const finalOnlyText = await requestFinalOnlyNarration(settings, prompt, fallbackText);
      if (!finalOnlyText) return null;
      const replayed = await streamFallback(finalOnlyText, onText);
      return {
        text: replayed.trim(),
        mode: 'provider',
        reason: 'provider_final_only_ok',
        detail: [
          `final-only-after:${nonStreamError ? String(nonStreamError.message || nonStreamError) : (streamError ? String(streamError.message || streamError) : 'stream-empty')}`,
          `request-model:${String(settings && settings.model || '')}`,
          `request-max_tokens:${Number(NARRATION_CONFIG.request.maxTokens || 0)}`
        ].join('|')
      };
    } catch (error) {
      finalOnlyError = error;
      return null;
    }
  };

  const preferFinalOnly = shouldPreferFinalOnlyRescue(streamError);
  const firstRescue = preferFinalOnly ? await tryFinalOnly() : await tryNonStream();
  if (firstRescue) return firstRescue;

  const secondRescue = preferFinalOnly ? await tryNonStream() : await tryFinalOnly();
  if (secondRescue) return secondRescue;

  const dominantError = finalOnlyError || nonStreamError || streamError;
  const fallbackReason = mapFallbackReason(dominantError, providerEnabled);
  if (onStatus) {
    await onStatus(fallbackReason.statusText);
  }

  const fallback = buildLocalNarrationText(fallbackText, fallbackReason.code);
  const replayed = await streamFallback(fallback, onText);
  return {
    text: replayed.trim(),
    mode: 'fallback',
    reason: fallbackReason.code,
    detail: [
      streamError ? `stream:${String(streamError.message || streamError)}` : '',
      nonStreamError ? `nonstream:${String(nonStreamError.message || nonStreamError)}` : '',
      finalOnlyError ? `finalonly:${String(finalOnlyError.message || finalOnlyError)}` : '',
      `request-model:${String(settings && settings.model || '')}`,
      `request-max_tokens:${Number(NARRATION_CONFIG.request.maxTokens || 0)}`
    ].filter(Boolean).join('|')
  };
}

module.exports = {
  narrateScene
};

