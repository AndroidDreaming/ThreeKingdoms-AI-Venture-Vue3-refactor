const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCleanSafe');
const { normalizeDirectorProposal } = require('./chronicleV5ChoiceGenerator');
const { getProviderCandidates } = require('../config/runtimeConfig');

const DIRECTOR_JSON_MARKER = '[[DIRECTOR_JSON]]';
const STATUS_REASONING_ONLY = '\u4e91\u7aef\u6a21\u578b\u5df2\u7ecf\u63a5\u901a\uff0c\u4f46\u5f53\u524d\u53ea\u8fd4\u56de\u4e86\u5185\u90e8\u63a8\u6f14\u7247\u6bb5\uff0c\u6b63\u6587\u9996\u6bb5\u4ecd\u672a\u843d\u4e0b\u3002';
const META_SENTENCE_PATTERN = /^(?:\u55ef[\uff0c,\u3002 ]*|\u597d\u7684[\uff0c,\u3002 ]*|\u73b0\u5728[\uff0c,\u3002 ]*)?(?:\u65f6\u4ee3\u9501\u5b9a|\u573a\u666f\u9501\u5b9a|\u8fd9\u662f\u4e00\u4e2a(?:\u53d9\u4e8b|\u5267\u60c5)\u4efb\u52a1|\u9700\u8981\u6839\u636e(?:\u63d0\u4f9b\u7684)?(?:\u7ed3\u6784\u5316)?\u72b6\u6001\u5305|\u6839\u636e(?:\u63d0\u4f9b\u7684)?(?:\u7ed3\u6784\u5316)?\u72b6\u6001\u5305|\u6211\u9700\u8981\u6839\u636e(?:\u63d0\u4f9b\u7684)?(?:\u7ed3\u6784\u5316)?\u72b6\u6001\u5305|\u9700\u8981\u628a\u5df2\u7ecf\u88c1\u5b9a|\u6b63\u5e38\u7684\u5267\u60c5\u6f14\u7ece)/;
const CHUNK_PREVIEW_LIMIT = 180;

function uniqueStrings(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).map((item) => String(item || '').trim()).filter(Boolean)));
}

function normalizeText(value, fallback = '') {
  const text = String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/```(?:json|text)?/gi, '')
    .replace(/```/g, '')
    .trim();
  return text || fallback;
}

function clipPreview(value, max = CHUNK_PREVIEW_LIMIT) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function createAttemptDiagnostics(url, settings) {
  return {
    endpoint: url,
    requestModel: String(settings && settings.model || ''),
    connectTimeoutMs: Number(settings && settings.connectTimeoutMs) || 15000,
    streamIdleTimeoutMs: Number(settings && settings.streamIdleTimeoutMs) || 20000,
    firstContentTimeoutMs: Number(settings && settings.firstContentTimeoutMs) || 18000,
    maxStreamDurationMs: Number(settings && settings.maxStreamDurationMs) || 120000,
    httpStatus: 0,
    contentType: '',
    responseOk: false,
    startedAt: new Date().toISOString(),
    connectMs: -1,
    totalDurationMs: -1,
    chunkCount: 0,
    totalChunkBytes: 0,
    firstChunkAtMs: -1,
    firstChunkBytes: 0,
    firstChunkHasDataPrefix: false,
    firstChunkHasNewline: false,
    firstChunkPreview: '',
    payloadCount: 0,
    payloadSamplesHead: [],
    payloadSamplesTail: [],
    parseMissCount: 0,
    donePayloadSeen: false,
    firstPayloadAtMs: -1,
    firstPayloadPreview: '',
    firstTextDeltaAtMs: -1,
    firstTextDeltaPreview: '',
    textDeltaCount: 0,
    textDeltaChars: 0,
    reasoningOnlyCount: 0,
    reasoningSamplesHead: [],
    sawReasoningOnly: false,
    markerSeen: false,
    trailingPayloadCount: 0,
    proposalTailChars: 0,
    proposalParsed: false,
    proposalChoiceCount: 0,
    narrationChars: 0,
    localSanitizedNarrationChars: 0,
    flushCount: 0,
    lastWaitTimeoutMs: 0,
    remainderChars: 0,
    status: 'started',
    error: '',
    notes: []
  };
}

function pushPreviewSample(list, value, limit = 3) {
  const next = Array.isArray(list) ? list : [];
  const sample = clipPreview(value, 220);
  if (!sample) return next;
  if (next.length < limit) {
    next.push(sample);
    return next;
  }
  next.shift();
  next.push(sample);
  return next;
}

function buildNonStreamRecoveryDiagnostics(baseDiagnostics, nonStream) {
  return Object.assign({}, baseDiagnostics || {}, {
    nonStreamAttempted: true,
    nonStreamOk: Boolean(nonStream && nonStream.ok),
    nonStreamDetail: nonStream && nonStream.detail ? nonStream.detail : '',
    nonStreamUrl: nonStream && nonStream.url ? nonStream.url : '',
    nonStreamDurationMs: nonStream && Number.isFinite(nonStream.durationMs) ? nonStream.durationMs : -1,
    nonStreamRawTextPreview: nonStream && nonStream.rawTextPreview ? nonStream.rawTextPreview : '',
    nonStreamMarkerSeen: Boolean(nonStream && nonStream.markerSeen),
    nonStreamProposalParsed: Boolean(nonStream && nonStream.proposalParsed)
  });
}

function finalizeAttemptDiagnostics(diagnostics, extra = {}) {
  const next = Object.assign({}, diagnostics || {}, extra || {});
  if (next.totalDurationMs === undefined || next.totalDurationMs === null || next.totalDurationMs < 0) {
    if (typeof next.__startedMs === 'number') {
      next.totalDurationMs = Date.now() - next.__startedMs;
    }
  }
  delete next.__startedMs;
  return next;
}

function summarizeAttemptDiagnostics(diagnostics) {
  const diag = diagnostics || {};
  return [
    `status=${diag.status || 'unknown'}`,
    `http=${diag.httpStatus || 0}`,
    `connectMs=${diag.connectMs}`,
    `chunks=${diag.chunkCount || 0}`,
    `payloads=${diag.payloadCount || 0}`,
    `parseMiss=${diag.parseMissCount || 0}`,
    `textDelta=${diag.textDeltaCount || 0}`,
    `reasoningOnly=${diag.reasoningOnlyCount || 0}`,
    `firstChunkAt=${diag.firstChunkAtMs}`,
    `firstPayloadAt=${diag.firstPayloadAtMs}`,
    `firstTextAt=${diag.firstTextDeltaAtMs}`,
    `marker=${diag.markerSeen ? 1 : 0}`,
    `proposal=${diag.proposalParsed ? 1 : 0}`,
    `choices=${diag.proposalChoiceCount || 0}`,
    `narrChars=${diag.localSanitizedNarrationChars || 0}`,
    diag.error ? `error=${diag.error}` : ''
  ].filter(Boolean).join(' ');
}

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
  const endpointStrategy = resolveEndpointStrategy(settings);
  const baseCandidates = deriveApiBaseCandidates(apiBaseUrl);
  const candidates = [];

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

  return uniqueStrings(candidates.filter(Boolean));
}

function withTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout:${timeoutMs}`)), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

async function readChunkWithTimeout(reader, timeoutMs) {
  return Promise.race([
    reader.read(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`idle-timeout:${timeoutMs}`)), timeoutMs);
    })
  ]);
}

function isHtmlResponse(response, previewText) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) return true;
  return /<!doctype html|<html/i.test(previewText || '');
}

function normalizeChunkText(value) {
  if (typeof value === 'string') return String(value || '');
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeChunkText(item))
      .filter(Boolean)
      .join('');
  }
  if (!value || typeof value !== 'object') return '';

  return [
    normalizeChunkText(value.text),
    normalizeChunkText(value.content),
    normalizeChunkText(value.output_text),
    normalizeChunkText(value.delta)
  ].filter(Boolean).join('');
}

function extractTextDelta(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const segments = [];
  const push = (value) => {
    const text = normalizeChunkText(value);
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
      if (Array.isArray(item && item.content)) {
        item.content.forEach((segment) => {
          push(segment && segment.text);
          push(segment && segment.content);
        });
      }
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

function extractPayloadCandidates(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) return [];
  if (line.startsWith('data:')) return [line.slice(5).trim()];
  if (line.startsWith('{') || line.startsWith('[')) return [line];
  return [];
}

function probeCompletePayload(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return '';
  if (raw === '[DONE]') return '[DONE]';

  if (raw.startsWith('data:')) {
    const candidate = raw.slice(5).trim();
    if (candidate === '[DONE]') return '[DONE]';
    if (safeJsonParseLoose(candidate)) return candidate;
  }

  if ((raw.startsWith('{') || raw.startsWith('[')) && safeJsonParseLoose(raw)) {
    return raw;
  }

  return '';
}

function drainTransportBuffer(buffer) {
  const source = String(buffer || '');
  if (!source) return { payloads: [], remainder: '' };

  const payloads = [];

  if (/\r?\n\r?\n/.test(source)) {
    const blocks = source.split(/\r?\n\r?\n/);
    const remainder = blocks.pop() || '';
    blocks.forEach((block) => {
      const trimmed = String(block || '').trim();
      if (!trimmed) return;
      if (trimmed.includes('\n')) {
        trimmed.split(/\r?\n/).forEach((line) => {
          extractPayloadCandidates(line).forEach((payload) => payloads.push(payload));
        });
        return;
      }
      extractPayloadCandidates(trimmed).forEach((payload) => payloads.push(payload));
    });
    const probed = probeCompletePayload(remainder);
    if (probed) {
      payloads.push(probed);
      return { payloads, remainder: '' };
    }
    return { payloads, remainder };
  }

  const lines = source.split(/\r?\n/);
  const remainder = lines.pop() || '';
  lines.forEach((line) => {
    extractPayloadCandidates(line).forEach((payload) => payloads.push(payload));
  });

  const probed = probeCompletePayload(remainder);
  if (probed) {
    payloads.push(probed);
    return { payloads, remainder: '' };
  }

  return { payloads, remainder };
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

function stripLeadingMetaNarration(text) {
  let current = String(text || '').trimStart();

  for (let index = 0; index < 3; index += 1) {
    const matched = current.match(/^[^\n\u3002\uff01\uff1f]*[\u3002\uff01\uff1f]?\s*/);
    const sentence = matched && matched[0] ? matched[0] : '';
    if (!sentence) break;
    if (!META_SENTENCE_PATTERN.test(sentence.trim())) break;
    current = current.slice(sentence.length).trimStart();
  }

  return current;
}

function removeAbstractFillerSentences(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  const fillerPattern = /(暗流涌动|深潭的石子|层层涟漪|这局大棋|大棋|风向变了|位置.*变|不再是.*过客|无关紧要的过客|清醒的冷冽|压下心头的虚火|淬炼得.*锋利|肃杀|捕捉到了几个陌生的字眼|河北豪族|地方豪族|地方豪右|地方势力|部族|士族|宗族|望族|乡豪|强宗)/;
  const concretePattern = /(曰|道|问|答|递|接|拦|敲|指|写|贴|榜|札|书|差役|驿卒|店家|掌柜|门吏|老卒|马|缰|案|灯|桌|路引|文书|脚步|目光)/;
  const parts = source.split(/(?<=[。！？])/).map((item) => item.trim()).filter(Boolean);
  const kept = parts.filter((sentence) => {
    if (!fillerPattern.test(sentence)) return true;
    return concretePattern.test(sentence) && sentence.length <= 90;
  });
  return (kept.length ? kept : parts.slice(0, 2)).join('');
}

function safeStringifyStateBundle(bundle) {
  try {
    return JSON.stringify(bundle && typeof bundle === 'object' ? bundle : {}, null, 2);
  } catch (error) {
    return '{}';
  }
}

function clipText(value, max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!max || text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + '…';
}

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function buildNarrationSceneCard(packet) {
  const narration = packet && packet.narrationContext ? packet.narrationContext : {};
  const current = narration.currentState || {};
  const capsule = narration.sceneCapsule || {};
  const facts = narration.resolvedFacts || {};
  const actor = narration.actorProfile || {};
  const state = narration.persistentState || {};
  const condition = state.condition || {};
  const resources = state.resources || {};

  return {
    scene: {
      time: current.date || '',
      place: [current.city, current.region].filter(Boolean).join(' / '),
      weather: current.weather || '',
      title: packet.sceneTitle || current.sceneTitle || '',
      previousBeat: clipText(current.previousBeat || capsule.openingImage || '', 140)
    },
    protagonist: {
      name: actor.name || '',
      identity: actor.identity || actor.background || '',
      route: [actor.martialRoute, actor.strategyRoute].filter(Boolean).join(' / '),
      condition: [
        condition.health ? `身骨${condition.health}` : '',
        condition.fatigue ? `疲态${condition.fatigue}` : '',
        condition.morale ? `士气${condition.morale}` : ''
      ].filter(Boolean).join('，'),
      leverage: [
        resources.coins ? `钱财${resources.coins}` : '',
        resources.supplies ? `粮秣${resources.supplies}` : '',
        resources.troops ? `部曲${resources.troops}` : ''
      ].filter(Boolean).join('，')
    },
    thisMove: {
      action: clipText(facts.actionText || packet.action && packet.action.raw || '', 90),
      verdict: facts.resultTier || packet.adjudication && packet.adjudication.tier || '',
      settledOutcome: clipText(facts.outcomeBeat || packet.adjudication && packet.adjudication.summary || '', 120),
      visibleConsequences: ensureList(facts.consequenceBeats).slice(0, 3).map((item) => clipText(item, 70))
    },
    dramaticFocus: {
      immediatePressure: clipText(capsule.immediatePressure || '', 130),
      humanTension: clipText(capsule.humanTension || '', 130),
      aftertaste: clipText(capsule.aftertaste || '', 130),
      peopleInFrame: ensureList(capsule.peopleInFrame).slice(0, 3).map((item) => clipText(item, 60)),
      rumorOnlyPeople: ensureList(capsule.rumorOnlyPeople || narration.rumorOnlyPeople).slice(0, 4).map((item) => clipText(item && item.name ? `${item.name}${item.hint ? `：${item.hint}` : ''}` : item, 60)),
      forcesInFrame: ensureList(capsule.forcesInFrame).slice(0, 2).map((item) => clipText(item, 60))
    }
  };
}

function buildChoiceSceneCard(packet) {
  const choice = packet && packet.choiceContext ? packet.choiceContext : {};
  const narration = packet && packet.narrationContext ? packet.narrationContext : {};
  const capsule = narration.sceneCapsule || {};
  const resolved = narration.resolvedFacts || {};
  const current = narration.currentState || {};
  const planning = choice.planning || {};
  const levers = choice.levers || {};

  return {
    sceneConflict: clipText(
      choice.sceneConflict || capsule.immediatePressure || resolved.outcomeBeat || '',
      130
    ),
    aftermath: clipText(choice.aftermath || capsule.aftertaste || current.previousBeat || '', 130),
    usableHooks: {
      people: ensureList(capsule.peopleInFrame || levers.relationHooks).slice(0, 3).map((item) => clipText(item && item.name ? `${item.name}${item.focus ? `：${item.focus}` : ''}` : item, 64)),
      rumorOnlyPeople: ensureList(capsule.rumorOnlyPeople).slice(0, 4).map((item) => clipText(item, 56)),
      placesOrRoutes: ensureList(levers.routeHooks || planning.frontiers).slice(0, 3).map((item) => clipText(item && typeof item === 'object' ? (item.city || item.title || item.route || '') : item, 50)),
      vulnerabilities: ensureList(levers.vulnerabilities).slice(0, 3).map((item) => clipText(item, 40)),
      assets: ensureList(levers.assets).slice(0, 3).map((item) => clipText(item, 40))
    },
    avoidRepeatingFixedActions: ensureList(choice.fixedChoiceDigest).slice(0, 6).map((item) => clipText(item && item.text, 32)).filter(Boolean)
  };
}

function extractCompletionTextCandidates(payload, options = {}) {
  if (!payload || typeof payload !== 'object') return [];
  const includeReasoning = options.includeReasoning === true;
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
      if (includeReasoning) {
        push(choice && choice.message && choice.message.reasoning_content);
        push(choice && choice.delta && choice.delta.reasoning_content);
      }
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

  if (includeReasoning) {
    push(payload.reasoning_content);
    push(payload.message && payload.message.reasoning_content);
    push(payload.delta && payload.delta.reasoning_content);
    push(payload.data && payload.data.reasoning_content);
  }

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

function looksLikeProposalPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.proposal && typeof payload.proposal === 'object') return true;
  return Boolean(
    payload.nextChoices
    || payload.threadSuggestions
    || payload.sceneResidue
    || payload.newRumors
    || payload.dramaticQuestion
    || payload.scenePlan
  );
}

function parseUnifiedTurnFromCandidate(candidateText, session, action) {
  const candidate = normalizeText(candidateText, '');
  if (!candidate) return null;

  if (candidate.includes(DIRECTOR_JSON_MARKER)) {
    const parts = candidate.split(DIRECTOR_JSON_MARKER);
    const narrationPart = stripLeadingMetaNarration(normalizeText(parts[0], ''));
    const tailText = normalizeText(parts.slice(1).join(DIRECTOR_JSON_MARKER), '');
    const parsedTail = safeJsonParseLoose(tailText);
    const proposal = parsedTail
      ? normalizeDirectorProposal(session, action, parsedTail.proposal || parsedTail)
      : null;
    return {
      narration: removeAbstractFillerSentences(sanitizeChronicleText(narrationPart, narrationPart)),
      proposal,
      markerSeen: true,
      proposalParsed: Boolean(parsedTail)
    };
  }

  const parsed = safeJsonParseLoose(candidate);
  if (parsed && typeof parsed === 'object') {
    const narrationText = normalizeText(
      parsed.narration || parsed.story || parsed.text || parsed.content || '',
      ''
    );
    const proposal = looksLikeProposalPayload(parsed)
      ? normalizeDirectorProposal(session, action, parsed.proposal || parsed)
      : null;
    if (narrationText || proposal) {
      return {
        narration: removeAbstractFillerSentences(sanitizeChronicleText(stripLeadingMetaNarration(narrationText), narrationText)),
        proposal,
        markerSeen: false,
        proposalParsed: Boolean(proposal)
      };
    }
  }

  if (!candidate.startsWith('{') && !candidate.startsWith('[')) {
    const narration = removeAbstractFillerSentences(sanitizeChronicleText(stripLeadingMetaNarration(candidate), candidate));
    if (narration) {
      return {
        narration,
        proposal: null,
        markerSeen: false,
        proposalParsed: false
      };
    }
  }

  return null;
}

function parseUnifiedTurnFromRawText(rawText, session, action, options = {}) {
  const root = safeJsonParseLoose(rawText);
  const candidates = [];
  if (root && root !== '[DONE]') {
    candidates.push(...extractCompletionTextCandidates(root, { includeReasoning: options.includeReasoning === true }));
  }
  candidates.push(normalizeText(rawText, ''));

  for (const candidate of uniqueStrings(candidates)) {
    const direct = parseUnifiedTurnFromCandidate(candidate, session, action);
    if (direct && (direct.narration || direct.proposal)) return direct;

    for (const structured of extractStructuredTextCandidates(candidate)) {
      const parsed = parseUnifiedTurnFromCandidate(structured, session, action);
      if (parsed && (parsed.narration || parsed.proposal)) return parsed;
    }
  }

  return null;
}

async function requestUnifiedTurnNonStream(settings, prompt, session, action) {
  const endpoints = buildEndpointCandidates(settings.apiBaseUrl, '/chat/completions', settings);
  const timeoutMs = Number(settings.nonStreamBodyTimeoutMs) || 90000;
  const errors = [];

  for (const url of endpoints) {
    const timeout = withTimeoutSignal(timeoutMs);
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: timeout.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: settings.temperature || 0.8,
          max_tokens: 3200,
          stream: false,
          messages: [
            {
              role: 'system',
              content: 'You are the turn director for a Three Kingdoms text adventure. Follow the requested format exactly. Never output reasoning or extra commentary.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
      const rawText = await response.text();
      const durationMs = Date.now() - startedAt;
      if (!response.ok) {
        errors.push(`${url} -> ${response.status}:${clipPreview(rawText, 200)}`);
        continue;
      }

      const parsed = parseUnifiedTurnFromRawText(rawText, session, action)
        || parseUnifiedTurnFromRawText(rawText, session, action, { includeReasoning: true });
      return {
        ok: Boolean(parsed && parsed.narration),
        url,
        durationMs,
        rawTextPreview: clipPreview(rawText, 220),
        narration: parsed && parsed.narration ? parsed.narration : '',
        proposal: parsed ? parsed.proposal : null,
        markerSeen: Boolean(parsed && parsed.markerSeen),
        proposalParsed: Boolean(parsed && parsed.proposalParsed),
        detail: `nonstream-ok:${url}|duration:${durationMs}|narration:${parsed && parsed.narration ? 1 : 0}|proposal:${parsed && parsed.proposal ? 1 : 0}`
      };
    } catch (error) {
      errors.push(`${url} -> ${error && error.message ? error.message : 'nonstream-error'}`);
    } finally {
      timeout.clear();
    }
  }

  return {
    ok: false,
    detail: `nonstream-failed:${errors.join(' | ')}`,
    errors
  };
}

function buildUnifiedDirectorPrompt(directorPacket) {
  const packet = directorPacket && typeof directorPacket === 'object' ? directorPacket : {};
  const narrationSceneCard = buildNarrationSceneCard(packet);
  const choiceSceneCard = buildChoiceSceneCard(packet);
  const compactDiagnostics = {
    narrationContextChars: safeStringifyStateBundle(packet.narrationContext || {}).length,
    choiceContextChars: safeStringifyStateBundle(packet.choiceContext || {}).length,
    narrationCardChars: safeStringifyStateBundle(narrationSceneCard).length,
    choiceCardChars: safeStringifyStateBundle(choiceSceneCard).length
  };
  return [
    '你在扮演一款汉末三国文字游戏的现场叙事导演。',
    '核心原则：玩家行动是叙事核心；历史不是固定剧本，而是会被玩家选择加速、延后、绕开或改写的动态推演。',
    '本回只写玩家刚刚选择造成的现场事件，并把它推进到新的可玩局面。',
    '输入是一张压缩后的场景卡：它只告诉你本回合已经裁定的事实、场面压力、人物张力和余波。',
    '你的职责是把事实演成一段真正发生在现场的剧情，不是解释状态，也不是复述动作。',
    '本地规则已经完成合法性、成败、资源与状态裁定。你只能演绎这些既成事实，不能新增结算或反转结果。',
    '输出必须严格只有两段：正文 + JSON。除此之外什么都不要写。',
    '第一段是正文，必须用简体中文直接开写，不要标题，不要“根据状态包”“这一回合”“以下是”“作为引擎”这类元话术。',
    '正文要先落到一个具体现场：我站在什么地方，面前具体有什么人或物，第一件发生的小事是什么。',
    '正文必须有展开：至少写出一个现场动作、一个明确的信息来源、一个人物或环境反应、一个转折/代价、一个留下余波的收束。',
    '文风要朴素、有筋骨、能落地。少用比喻，少用形容词，优先写动作、对话、物件、差役、店家、驿卒、书札、榜文、脚步、眼神。',
    '若涉及交锋，着重写招式、身法、气机、兵势、险意与胜负余韵；若不涉交锋，也要写出人物分寸、场面冷热和局势逼压。',
    '可以有动作、神态、对话、器物、街巷、灯火、潮气、蹄声、纸墨等细节，但只能写本地已裁定过的事实，不得新增未发生的胜负或资源变化。',
    '如果正文提到某个名字，必须交代这个名字从哪里来：谁说出口、哪张榜文写着、哪封书札递来、哪名差役盘问，不能只写“我捕捉到几个字眼”。',
    'rumorOnlyPeople 里的名字不是已结识人物：只能作为传闻、榜文、口信、旁人口中的名字或远处身影；除非本回 action 明确点名接触，不得让他们亲自出场、主动搭话、同行、帮忙或反复围着主角转。',
    'peopleInFrame 才是本回可以真正出场互动的人。若 peopleInFrame 为空，就让剧情从差役、店家、驿卒、门吏、兵卒、文书、榜文和地方事务展开。',
    '不要生成“河北豪族、地方豪族、地方豪右、地方势力、部族、士族、宗族、望族、乡豪、强宗”等抽象势力设定；正文和选项都必须落到具体官署、军营、商铺、驿站、门吏、差役、兵卒、文书、榜文、道路和当场人物。',
    '事件驱动要求：每回至少出现一个新的具体事件钩子，可以是战事军报、官署文书、人物口信、城中纠纷、门派规矩、商路变故、流言来源或追捕盘问。',
    '非线性历史要求：若玩家行动碰到史实人物、战事、城池或官署，必须写出这一步对历史走向的具体压力；若没有碰到历史主线，就让历史在背景里自行推进一小步，但不要把史实人物拉来陪主角。',
    '循环打破要求：如果场景看起来只是在赶路、休整、练功或泛泛调查，必须用一个小突发事件把局面推开，例如盘查、误认、递信、榜文改贴、客舍争执、军报入城、熟人传话。',
    '数值和字段只是背景约束，不能逐项复述；要化成底气、伤疲、手头紧松、名声轻重、人心冷热和局势高低。',
    '不要把 action、verdict、settledOutcome 或 visibleConsequences 换一种说法念一遍。',
    '禁止空泛套话：暗流涌动、肃杀、深潭石子、层层涟漪、大棋、风向变了、位置变了、冷冽、虚火、淬炼、真正介入、无关紧要的过客。',
    '禁止用一整段心理独白替代事件。每两三句里至少要有一个可见动作、具体物件、具体人物反应或一句短对白。',
    `正文结束后，另起一行，只输出 ${DIRECTOR_JSON_MARKER}；再下一行输出一个 JSON 对象。`,
    '不要在标记前后添加任何解释。',
    'JSON 格式必须是：{"proposal":{"summary":"","dramaticQuestion":"","scenePlan":{"surfaceGoal":"","obstacle":"","turnPoint":"","emotionalShift":"","closingBeat":"","tone":"","pace":""},"sceneResidue":["..."],"newRumors":["..."],"npcReactions":[{"targetName":"","warmth":0,"tension":0,"respect":0,"guardedness":0,"curiosity":0,"note":""}],"factionReactions":[{"targetName":"","watchfulness":0,"respect":0,"hostility":0,"leverageFear":0,"note":""}],"threadSuggestions":[{"title":"","domain":"","urgency":1,"note":""}],"nextChoices":[{"text":"","actionText":"","hint":""}]}}',
    'proposal 里的内容只是下一回合建议，不是已经生效的状态。',
    'summary、dramaticQuestion、sceneResidue、newRumors、threadSuggestions 都要短，带火气，能直接落存档。',
    'nextChoices 必须正好 3 个，并且必须按这个顺序：1. 正常推进 2. 道德两难 3. 反常理但有趣。',
    'nextChoices 不要写“把某物给某某豪族/地方势力”“拜会某地豪族”“借某股势力”“联络某部族”这类模板句。',
    '动态选项优先从当场人物、刚发生的余波、可见地点、手头困境和玩家刚选择的行动自然长出；不要把抽象势力当成默认收件人或万能目标。',
    'Choice 1 要最顺手、最明确地推动当前局势。',
    'Choice 2 必须让玩家清楚看见代价，代价可以落在人情、承诺、名声、忠义、安全、无辜者、部下或盟友身上。',
    'Choice 3 必须显得偏门、戏剧化、出人意料，甚至带一点黑色幽默，但仍然要立得住，必须能从当前局势生长出来。',
    '三个 choice 的 text 不要带固定前缀，不要输出“正路”“代价”“奇手”这类搭配词。',
    'actionText 如果填写，必须比 text 更具体；hint 如果填写，只提示代价、阻力、诡异点或风险，不要重说标题。',
    'choice 只能写下一步要做什么，不能把已经完成的后果写成动作。',
    'Director packet:',
    JSON.stringify({
      version: packet.version || 'director_turn_v1',
      sceneTitle: packet.sceneTitle || '',
      action: packet.action || {},
      adjudication: packet.adjudication || {},
      promptCompaction: compactDiagnostics
    }, null, 2),
    '正文场景卡：',
    safeStringifyStateBundle(narrationSceneCard),
    '动态选项卡：',
    safeStringifyStateBundle(choiceSceneCard)
  ].join('\n');
}

function createRequestBody(settings, prompt) {
  return JSON.stringify({
    model: settings.model,
    stream: true,
    temperature: settings.temperature || 0.8,
    messages: [
      {
        role: 'system',
        content: '你是三国文字游戏的叙事引擎。严格按协议输出：先给正文，再给 [[DIRECTOR_JSON]] 和 JSON。不要输出推理、解释、标题、寒暄或任何额外说明。'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });
}

async function streamUnifiedDirectorTurn(settings, session, action, directorPacket, hooks = {}) {
  const providerCandidates = getProviderCandidates(settings);
  if (!providerCandidates.length) {
    return {
      ok: false,
      narration: '',
      proposal: null,
      reason: 'provider_disabled',
      detail: `provider-disabled|request-model:${String(settings && settings.model || '')}`,
      diagnostics: {
        status: 'provider_disabled',
        requestModel: String(settings && settings.model || ''),
        endpoint: String(settings && settings.apiBaseUrl || '')
      }
    };
  }

  const onText = typeof hooks.onText === 'function' ? hooks.onText : async() => {};
  const onStatus = typeof hooks.onStatus === 'function' ? hooks.onStatus : null;
  const prompt = buildUnifiedDirectorPrompt(directorPacket);
  const errors = [];
  const attemptDiagnostics = [];
  const allEndpointCandidates = [];

  for (const providerSettings of providerCandidates) {
    const requestBody = createRequestBody(providerSettings, prompt);
    const candidates = buildEndpointCandidates(providerSettings.apiBaseUrl, '/chat/completions', providerSettings);
    const connectTimeoutMs = Number(providerSettings.connectTimeoutMs) || 15000;
    const streamIdleTimeoutMs = Number(providerSettings.streamIdleTimeoutMs) || 20000;
    const maxStreamDurationMs = Number(providerSettings.maxStreamDurationMs) || 120000;
    const firstContentTimeoutMs = Number(providerSettings.firstContentTimeoutMs) || 18000;
    allEndpointCandidates.push(...candidates);

    for (const url of candidates) {
      const diagnostics = createAttemptDiagnostics(url, providerSettings);
      diagnostics.providerName = String(providerSettings.providerName || '');
      diagnostics.endpointStrategy = resolveEndpointStrategy(providerSettings);
      diagnostics.endpointCandidates = candidates.slice(0, 6);
      diagnostics.__startedMs = Date.now();
      const connectTimeout = withTimeoutSignal(connectTimeoutMs);
      let response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerSettings.apiKey}`
        },
        body: requestBody,
        signal: connectTimeout.signal
      });
      diagnostics.connectMs = Date.now() - diagnostics.__startedMs;
    } catch (error) {
      connectTimeout.clear();
      errors.push(`${url} -> ${error.message}`);
      diagnostics.status = 'connect_error';
      diagnostics.error = error && error.message ? error.message : 'connect-error';
      attemptDiagnostics.push(finalizeAttemptDiagnostics(diagnostics));
      console.log(`[director-stream] ${summarizeAttemptDiagnostics(attemptDiagnostics[attemptDiagnostics.length - 1])}`);
      continue;
    }
    connectTimeout.clear();
    diagnostics.httpStatus = Number(response.status || 0);
    diagnostics.contentType = String(response.headers.get('content-type') || '');
    diagnostics.responseOk = Boolean(response.ok);

    if (!response.ok || !response.body) {
      const bodyText = response && typeof response.text === 'function'
        ? await response.text().catch(() => '')
        : '';
      errors.push(`${url} -> ${response.status}:${bodyText.slice(0, 200)}`);
      diagnostics.status = 'http_error';
      diagnostics.error = `${response.status}:${clipPreview(bodyText, 120)}`;
      diagnostics.notes.push(`body:${clipPreview(bodyText, 120)}`);
      attemptDiagnostics.push(finalizeAttemptDiagnostics(diagnostics));
      console.log(`[director-stream] ${summarizeAttemptDiagnostics(attemptDiagnostics[attemptDiagnostics.length - 1])}`);
      continue;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const startedAt = Date.now();
    const firstContentDeadline = startedAt + firstContentTimeoutMs;
    let transportBuffer = '';
    let checkedFirstChunk = false;
    let narration = '';
    let narrationBuffer = '';
    let proposalTail = '';
    let markerSeen = false;
    let sawReasoningOnly = false;
    let initialEmissionDone = false;
    let initialNarrationBuffer = '';
    let fullTextDelta = '';
    let fullReasoningDelta = '';

    const flushNarration = async(rawText, force = false) => {
      if (!rawText && !(force && initialNarrationBuffer)) return;
      if (!initialEmissionDone) {
        initialNarrationBuffer += rawText;
        const ready = force || initialNarrationBuffer.length >= 96 || /[\n\u3002\uff01\uff1f]/.test(initialNarrationBuffer);
        if (!ready) return;
        const cleaned = stripLeadingMetaNarration(initialNarrationBuffer);
        initialEmissionDone = true;
        initialNarrationBuffer = '';
        if (!cleaned) return;
        const safeChunk = removeAbstractFillerSentences(sanitizeChronicleText(cleaned, cleaned));
        diagnostics.flushCount += 1;
        if (diagnostics.firstTextDeltaAtMs < 0) {
          diagnostics.firstTextDeltaAtMs = Date.now() - startedAt;
          diagnostics.firstTextDeltaPreview = clipPreview(safeChunk, 120);
        }
        diagnostics.textDeltaCount += 1;
        diagnostics.textDeltaChars += safeChunk.length;
        narration += safeChunk;
        await onText(safeChunk);
        return;
      }
      const safeChunk = removeAbstractFillerSentences(sanitizeChronicleText(rawText, rawText));
      diagnostics.flushCount += 1;
      if (diagnostics.firstTextDeltaAtMs < 0) {
        diagnostics.firstTextDeltaAtMs = Date.now() - startedAt;
        diagnostics.firstTextDeltaPreview = clipPreview(safeChunk, 120);
      }
      diagnostics.textDeltaCount += 1;
      diagnostics.textDeltaChars += safeChunk.length;
      narration += safeChunk;
      await onText(safeChunk);
    };

    const handleTextDelta = async(textDelta) => {
      if (!textDelta) return;
      fullTextDelta += textDelta;
      if (markerSeen) {
        proposalTail += textDelta;
        diagnostics.proposalTailChars = proposalTail.length;
        return;
      }

      narrationBuffer += textDelta;
      const markerIndex = narrationBuffer.indexOf(DIRECTOR_JSON_MARKER);
      if (markerIndex >= 0) {
        const narrationPart = narrationBuffer.slice(0, markerIndex);
        await flushNarration(narrationPart, true);
        proposalTail += narrationBuffer.slice(markerIndex + DIRECTOR_JSON_MARKER.length);
        narrationBuffer = '';
        markerSeen = true;
        diagnostics.markerSeen = true;
        diagnostics.proposalTailChars = proposalTail.length;
        return;
      }

      const holdback = Math.max(DIRECTOR_JSON_MARKER.length + 6, 24);
      if (narrationBuffer.length > holdback) {
        const safeChunk = narrationBuffer.slice(0, narrationBuffer.length - holdback);
        narrationBuffer = narrationBuffer.slice(narrationBuffer.length - holdback);
        await flushNarration(safeChunk, false);
      }
    };

    const handlePayload = async(payloadText) => {
      if (!payloadText) return false;
      diagnostics.payloadCount += 1;
      diagnostics.payloadSamplesHead = pushPreviewSample(diagnostics.payloadSamplesHead, payloadText, 3);
      diagnostics.payloadSamplesTail = pushPreviewSample(diagnostics.payloadSamplesTail, payloadText, 3);
      if (diagnostics.firstPayloadAtMs < 0) {
        diagnostics.firstPayloadAtMs = Date.now() - startedAt;
        diagnostics.firstPayloadPreview = clipPreview(payloadText, 180);
      }
      if (payloadText === '[DONE]') {
        diagnostics.donePayloadSeen = true;
        return true;
      }

      const parsed = safeJsonParseLoose(payloadText);
      if (!parsed) {
        diagnostics.parseMissCount += 1;
        return false;
      }

      const textDelta = extractTextDelta(parsed);
      const reasoningDelta = extractReasoningDelta(parsed);
      if (!textDelta && reasoningDelta) {
        sawReasoningOnly = true;
        diagnostics.sawReasoningOnly = true;
        diagnostics.reasoningOnlyCount += 1;
        diagnostics.reasoningSamplesHead = pushPreviewSample(diagnostics.reasoningSamplesHead, reasoningDelta, 3);
        fullReasoningDelta += reasoningDelta;
      }
      if (textDelta) {
        await handleTextDelta(textDelta);
      }
      return false;
    };

    try {
      while (true) {
        if (Date.now() - startedAt > maxStreamDurationMs) {
          throw new Error(`stream-timeout:${maxStreamDurationMs}`);
        }

        const waitTimeoutMs = narration
          ? streamIdleTimeoutMs
          : (
            sawReasoningOnly
              ? Math.max(streamIdleTimeoutMs, firstContentTimeoutMs, 90000)
              : Math.max(streamIdleTimeoutMs, firstContentTimeoutMs)
          );
        diagnostics.lastWaitTimeoutMs = waitTimeoutMs;
        const { done, value } = await readChunkWithTimeout(reader, waitTimeoutMs);
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        diagnostics.chunkCount += 1;
        diagnostics.totalChunkBytes += value ? value.length : 0;
        if (diagnostics.firstChunkAtMs < 0) {
          diagnostics.firstChunkAtMs = Date.now() - startedAt;
          diagnostics.firstChunkBytes = value ? value.length : 0;
          diagnostics.firstChunkHasDataPrefix = chunkText.includes('data:');
          diagnostics.firstChunkHasNewline = /\r?\n/.test(chunkText);
          diagnostics.firstChunkPreview = clipPreview(chunkText, 180);
        }
        if (!checkedFirstChunk) {
          checkedFirstChunk = true;
          if (isHtmlResponse(response, chunkText)) {
            throw new Error('upstream-returned-html');
          }
        }

        transportBuffer += chunkText;
        const drained = drainTransportBuffer(transportBuffer);
        transportBuffer = drained.remainder;
        diagnostics.remainderChars = transportBuffer.length;

        for (const payloadText of drained.payloads) {
          const doneFlag = await handlePayload(payloadText);
          if (doneFlag) break;
        }

        const contentDeadlineMs = sawReasoningOnly
          ? Math.max(firstContentTimeoutMs, 90000)
          : firstContentTimeoutMs;
        if (!narration && !initialNarrationBuffer && !narrationBuffer && Date.now() > startedAt + contentDeadlineMs) {
          if (sawReasoningOnly && onStatus) {
            await onStatus(STATUS_REASONING_ONLY);
          }
          throw new Error(`first-content-timeout:${contentDeadlineMs}`);
        }
      }

      const trailing = drainTransportBuffer(transportBuffer);
      diagnostics.trailingPayloadCount = trailing.payloads.length;
      if (trailing.payloads.length) {
        for (const payloadText of trailing.payloads) {
          await handlePayload(payloadText);
        }
      } else if (markerSeen) {
        proposalTail += trailing.remainder;
        diagnostics.proposalTailChars = proposalTail.length;
      }

      if (narrationBuffer) {
        if (markerSeen) {
          proposalTail += narrationBuffer;
        } else {
          await flushNarration(narrationBuffer, true);
        }
      }
      await flushNarration('', true);
    } catch (error) {
      errors.push(`${url} -> ${error.message}`);
      diagnostics.status = 'stream_error';
      diagnostics.error = error && error.message ? error.message : 'stream-error';
      try {
        await reader.cancel();
      } catch (cancelError) {
        // Ignore cancel errors.
      }

      if (narrationBuffer && !markerSeen) {
        await flushNarration(narrationBuffer, true);
      }
      await flushNarration('', true);

      if (narration.trim()) {
        diagnostics.narrationChars = narration.length;
        diagnostics.localSanitizedNarrationChars = sanitizeChronicleText(narration.trim(), narration.trim()).length;
        const finalDiagnostics = finalizeAttemptDiagnostics(diagnostics, { status: 'partial_ok' });
        console.log(`[director-stream] ${summarizeAttemptDiagnostics(finalDiagnostics)}`);
        return {
          ok: true,
          narration: sanitizeChronicleText(narration.trim(), narration.trim()),
          proposal: null,
          reason: 'provider_stream_partial',
          detail: `unified-stream-partial:${url}|error:${error.message}|marker:${markerSeen ? 1 : 0}|narration:1`,
          diagnostics: Object.assign({}, finalDiagnostics, {
            markerSeen,
            narrationChars: narration.length,
            localSanitizedNarrationChars: sanitizeChronicleText(narration.trim(), narration.trim()).length,
            proposalTailChars: proposalTail.length
          })
        };
      }

      attemptDiagnostics.push(finalizeAttemptDiagnostics(diagnostics));
      console.log(`[director-stream] ${summarizeAttemptDiagnostics(attemptDiagnostics[attemptDiagnostics.length - 1])}`);

      if (diagnostics.sawReasoningOnly && !diagnostics.textDeltaCount) {
        const nonStream = await requestUnifiedTurnNonStream(providerSettings, prompt, session, action);
        const fallbackDiagnostics = buildNonStreamRecoveryDiagnostics(
          attemptDiagnostics[attemptDiagnostics.length - 1],
          nonStream
        );
        if (nonStream && nonStream.ok && nonStream.narration) {
          console.log(`[director-stream] status=nonstream_recovered endpoint=${nonStream.url || url} durationMs=${fallbackDiagnostics.nonStreamDurationMs} proposal=${fallbackDiagnostics.nonStreamProposalParsed ? 1 : 0}`);
          return {
            ok: true,
            narration: nonStream.narration,
            proposal: nonStream.proposal || null,
            reason: nonStream.proposal ? 'provider_nonstream_recovered' : 'provider_nonstream_recovered_no_tail',
            detail: `${attemptDiagnostics[attemptDiagnostics.length - 1].error ? `stream:${attemptDiagnostics[attemptDiagnostics.length - 1].error}|` : ''}${nonStream.detail}`,
            diagnostics: Object.assign({}, fallbackDiagnostics, {
              status: nonStream.proposal ? 'nonstream_recovered' : 'nonstream_recovered_no_tail',
              proposalChoiceCount: nonStream.proposal && nonStream.proposal.nextChoices ? nonStream.proposal.nextChoices.length : 0,
              proposalParsed: Boolean(nonStream.proposal),
              markerSeen: Boolean(nonStream.markerSeen),
              localSanitizedNarrationChars: nonStream.narration.length,
              narrationChars: nonStream.narration.length
            })
          };
        }
        const reasoningRecovered = fullReasoningDelta
          ? parseUnifiedTurnFromCandidate(fullReasoningDelta, session, action)
          : null;
        if (reasoningRecovered && reasoningRecovered.narration) {
          return {
            ok: true,
            narration: sanitizeChronicleText(reasoningRecovered.narration.trim(), reasoningRecovered.narration.trim()),
            proposal: reasoningRecovered.proposal || null,
            reason: reasoningRecovered.proposal ? 'provider_reasoning_recovered' : 'provider_reasoning_recovered_no_tail',
            detail: `${fallbackDiagnostics.nonStreamDetail ? `${fallbackDiagnostics.nonStreamDetail}|` : ''}reasoning-recovered:${url}|proposal:${reasoningRecovered.proposal ? 1 : 0}`,
            diagnostics: Object.assign({}, fallbackDiagnostics, {
              status: reasoningRecovered.proposal ? 'reasoning_recovered' : 'reasoning_recovered_no_tail',
              proposalChoiceCount: reasoningRecovered.proposal && reasoningRecovered.proposal.nextChoices ? reasoningRecovered.proposal.nextChoices.length : 0,
              proposalParsed: Boolean(reasoningRecovered.proposal),
              markerSeen: Boolean(reasoningRecovered.markerSeen),
              localSanitizedNarrationChars: sanitizeChronicleText(reasoningRecovered.narration.trim(), reasoningRecovered.narration.trim()).length,
              narrationChars: String(reasoningRecovered.narration || '').length
            })
          };
        }
        attemptDiagnostics[attemptDiagnostics.length - 1] = fallbackDiagnostics;
      }
      continue;
    }

    let sanitizedNarration = removeAbstractFillerSentences(sanitizeChronicleText(narration.trim(), narration.trim()));
    const parsedTail = safeJsonParseLoose(proposalTail);
    let normalizedProposal = parsedTail
      ? normalizeDirectorProposal(session, action, parsedTail.proposal || parsedTail)
      : null;
    const recoveredTurn = !normalizedProposal && fullTextDelta
      ? parseUnifiedTurnFromRawText(fullTextDelta, session, action)
      : null;
    const reasoningRecoveredTurn = (!normalizedProposal || !sanitizedNarration)
      && fullReasoningDelta
      ? parseUnifiedTurnFromCandidate(fullReasoningDelta, session, action)
      : null;
    if ((!sanitizedNarration || !sanitizedNarration.trim()) && recoveredTurn && recoveredTurn.narration) {
      sanitizedNarration = removeAbstractFillerSentences(sanitizeChronicleText(recoveredTurn.narration.trim(), recoveredTurn.narration.trim()));
    }
    if ((!sanitizedNarration || !sanitizedNarration.trim()) && reasoningRecoveredTurn && reasoningRecoveredTurn.narration) {
      sanitizedNarration = removeAbstractFillerSentences(sanitizeChronicleText(reasoningRecoveredTurn.narration.trim(), reasoningRecoveredTurn.narration.trim()));
    }
    if (!normalizedProposal && recoveredTurn && recoveredTurn.proposal) {
      normalizedProposal = recoveredTurn.proposal;
    }
    if (!normalizedProposal && reasoningRecoveredTurn && reasoningRecoveredTurn.proposal) {
      normalizedProposal = reasoningRecoveredTurn.proposal;
    }
    if (!markerSeen && recoveredTurn && recoveredTurn.markerSeen) {
      markerSeen = true;
      diagnostics.markerSeen = true;
    }
    if (!markerSeen && reasoningRecoveredTurn && reasoningRecoveredTurn.markerSeen) {
      markerSeen = true;
      diagnostics.markerSeen = true;
    }
    diagnostics.proposalParsed = Boolean(parsedTail || normalizedProposal);
    diagnostics.proposalChoiceCount = normalizedProposal && normalizedProposal.nextChoices
      ? normalizedProposal.nextChoices.length
      : 0;
    diagnostics.proposalTailChars = proposalTail.length;
    diagnostics.narrationChars = narration.length;
    diagnostics.localSanitizedNarrationChars = sanitizedNarration.length;

    if (sanitizedNarration) {
      const finalStatus = normalizedProposal ? 'ok' : 'ok_no_tail';
      const finalDiagnostics = finalizeAttemptDiagnostics(diagnostics, { status: finalStatus });
      console.log(`[director-stream] ${summarizeAttemptDiagnostics(finalDiagnostics)}`);
      return {
        ok: true,
        narration: sanitizedNarration,
        proposal: normalizedProposal,
        reason: normalizedProposal ? 'provider_unified_stream_ok' : 'provider_unified_stream_no_tail',
        detail: `unified-stream-ok:${url}|marker:${markerSeen ? 1 : 0}|tail:${parsedTail ? 1 : 0}|recovered:${recoveredTurn && recoveredTurn.proposal ? 1 : 0}|reasoningRecovered:${reasoningRecoveredTurn && (reasoningRecoveredTurn.narration || reasoningRecoveredTurn.proposal) ? 1 : 0}|choices:${normalizedProposal && normalizedProposal.nextChoices ? normalizedProposal.nextChoices.length : 0}|narration:1`,
        diagnostics: Object.assign({}, finalDiagnostics, {
          markerSeen
        })
      };
    }

    errors.push(`${url} -> empty-narration`);
    diagnostics.status = 'empty_narration';
    diagnostics.error = 'empty-narration';
    diagnostics.proposalTailChars = proposalTail.length;
    attemptDiagnostics.push(finalizeAttemptDiagnostics(diagnostics));
    console.log(`[director-stream] ${summarizeAttemptDiagnostics(attemptDiagnostics[attemptDiagnostics.length - 1])}`);

    if (diagnostics.sawReasoningOnly && !diagnostics.textDeltaCount) {
      const nonStream = await requestUnifiedTurnNonStream(providerSettings, prompt, session, action);
      const fallbackDiagnostics = buildNonStreamRecoveryDiagnostics(
        attemptDiagnostics[attemptDiagnostics.length - 1],
        nonStream
      );
      if (nonStream && nonStream.ok && nonStream.narration) {
        console.log(`[director-stream] status=nonstream_recovered endpoint=${nonStream.url || url} durationMs=${fallbackDiagnostics.nonStreamDurationMs} proposal=${fallbackDiagnostics.nonStreamProposalParsed ? 1 : 0}`);
        return {
          ok: true,
          narration: nonStream.narration,
          proposal: nonStream.proposal || null,
          reason: nonStream.proposal ? 'provider_nonstream_recovered' : 'provider_nonstream_recovered_no_tail',
          detail: `stream:empty-narration|${nonStream.detail}`,
          diagnostics: Object.assign({}, fallbackDiagnostics, {
            status: nonStream.proposal ? 'nonstream_recovered' : 'nonstream_recovered_no_tail',
            proposalChoiceCount: nonStream.proposal && nonStream.proposal.nextChoices ? nonStream.proposal.nextChoices.length : 0,
            proposalParsed: Boolean(nonStream.proposal),
            markerSeen: Boolean(nonStream.markerSeen),
            localSanitizedNarrationChars: nonStream.narration.length,
            narrationChars: nonStream.narration.length
          })
        };
      }
      const reasoningRecovered = fullReasoningDelta
        ? parseUnifiedTurnFromCandidate(fullReasoningDelta, session, action)
        : null;
      if (reasoningRecovered && reasoningRecovered.narration) {
        return {
          ok: true,
          narration: sanitizeChronicleText(reasoningRecovered.narration.trim(), reasoningRecovered.narration.trim()),
          proposal: reasoningRecovered.proposal || null,
          reason: reasoningRecovered.proposal ? 'provider_reasoning_recovered' : 'provider_reasoning_recovered_no_tail',
          detail: `${fallbackDiagnostics.nonStreamDetail ? `${fallbackDiagnostics.nonStreamDetail}|` : ''}reasoning-recovered:${url}|proposal:${reasoningRecovered.proposal ? 1 : 0}`,
          diagnostics: Object.assign({}, fallbackDiagnostics, {
            status: reasoningRecovered.proposal ? 'reasoning_recovered' : 'reasoning_recovered_no_tail',
            proposalChoiceCount: reasoningRecovered.proposal && reasoningRecovered.proposal.nextChoices ? reasoningRecovered.proposal.nextChoices.length : 0,
            proposalParsed: Boolean(reasoningRecovered.proposal),
            markerSeen: Boolean(reasoningRecovered.markerSeen),
            localSanitizedNarrationChars: sanitizeChronicleText(reasoningRecovered.narration.trim(), reasoningRecovered.narration.trim()).length,
            narrationChars: String(reasoningRecovered.narration || '').length
          })
        };
      }
      attemptDiagnostics[attemptDiagnostics.length - 1] = fallbackDiagnostics;
    }
    }
  }

  return {
    ok: false,
    narration: '',
    proposal: null,
    reason: 'provider_unavailable',
    detail: `unified-stream-failed:${errors.join(' | ') || uniqueStrings(allEndpointCandidates).join(' | ')}`,
    diagnostics: {
      status: 'all_attempts_failed',
      requestModel: String(settings && settings.model || ''),
      endpointCandidates: uniqueStrings(allEndpointCandidates),
      providerNames: providerCandidates.map((item) => String(item.providerName || '')),
      errors,
      attempts: attemptDiagnostics
    }
  };
}

module.exports = {
  streamUnifiedDirectorTurn
};
