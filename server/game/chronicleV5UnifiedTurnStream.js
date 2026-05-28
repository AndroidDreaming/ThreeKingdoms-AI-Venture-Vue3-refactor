const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { sanitizeChronicleText } = require('./chronicleV5TextSanitizerCleanSafe');
const { normalizeDirectorProposal } = require('./chronicleV5ChoiceGenerator');
const { getProviderCandidates } = require('../config/runtimeConfig');

const TURN_SPLITTER = '=== TURN_SPLITTER ===';
const LEGACY_DIRECTOR_JSON_MARKER = '[[DIRECTOR_JSON]]';
const DIRECTOR_SPLITTERS = [TURN_SPLITTER, LEGACY_DIRECTOR_JSON_MARKER];
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
      route: [actor.martialRoute, actor.strategyRoute].filter(Boolean).join(' / ')
    },
    thisMove: {
      action: clipText(facts.actionText || packet.action && packet.action.raw || '', 90),
      verdict: facts.resultTier || packet.adjudication && packet.adjudication.tier || '',
      settledOutcome: clipText(facts.outcomeBeat || packet.adjudication && packet.adjudication.summary || '', 120),
      directorNotes: ensureList(facts.directorNotes).slice(0, 5).map((item) => clipText(item, 90)),
      visibleConsequences: ensureList(facts.consequenceBeats).slice(0, 3).map((item) => clipText(item, 70))
    },
    dramaticFocus: {
      immediatePressure: clipText(capsule.immediatePressure || '', 130),
      humanTension: clipText(capsule.humanTension || '', 130),
      aftertaste: clipText(capsule.aftertaste || '', 130),
      peopleInFrame: ensureList(capsule.peopleInFrame).slice(0, 3).map((item) => clipText(item, 60)),
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
  if (Array.isArray(payload)) return true;
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

function normalizeUnifiedProposal(session, action, payload) {
  if (!payload || typeof payload !== 'object') return null;
  const source = Array.isArray(payload)
    ? { nextChoices: payload }
    : (payload.proposal && typeof payload.proposal === 'object' ? payload.proposal : payload);
  const proposal = normalizeDirectorProposal(session, action, source);
  return proposal && Array.isArray(proposal.nextChoices) && proposal.nextChoices.length
    ? proposal
    : null;
}

function parseProposalTail(text, session, action) {
  const parsed = safeJsonParseLoose(text);
  if (!parsed) return { parsed: null, proposal: null };
  return {
    parsed,
    proposal: normalizeUnifiedProposal(session, action, parsed)
  };
}

function splitTurnByMarker(text) {
  const candidate = String(text || '');
  let found = null;
  DIRECTOR_SPLITTERS.forEach((marker) => {
    const index = candidate.indexOf(marker);
    if (index < 0) return;
    if (!found || index < found.index) found = { marker, index };
  });
  if (!found) return null;
  return {
    marker: found.marker,
    before: candidate.slice(0, found.index),
    after: candidate.slice(found.index + found.marker.length)
  };
}

function longestTurnMarkerLength() {
  return DIRECTOR_SPLITTERS.reduce((max, marker) => Math.max(max, marker.length), 0);
}

function parseUnifiedTurnFromCandidate(candidateText, session, action) {
  const candidate = normalizeText(candidateText, '');
  if (!candidate) return null;

  const splitTurn = splitTurnByMarker(candidate);
  if (splitTurn) {
    const narrationPart = stripLeadingMetaNarration(normalizeText(splitTurn.before, ''));
    const tailText = normalizeText(splitTurn.after, '');
    const parsedTail = parseProposalTail(tailText, session, action);
    return {
      narration: removeAbstractFillerSentences(sanitizeChronicleText(narrationPart, narrationPart)),
      proposal: parsedTail.proposal,
      markerSeen: true,
      proposalParsed: Boolean(parsedTail.parsed)
    };
  }

  const parsed = safeJsonParseLoose(candidate);
  if (parsed && typeof parsed === 'object') {
    const narrationText = normalizeText(
      parsed.narration || parsed.story || parsed.text || parsed.content || '',
      ''
    );
    const proposal = looksLikeProposalPayload(parsed)
      ? normalizeUnifiedProposal(session, action, parsed)
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
    '你是深谙汉末人情、军府文书、市井风声和古典白话节奏的剧情导演。',
    '你先写一段可以直接给玩家看的正文。正文只管文学演绎，不要惦记 JSON，也不要提前解释选项。',
    '正文从现场开笔：一件物、一个人、一句短话、一张榜文、一封书札、一道门槛，任选其一把玩家刚刚这一手落到地上。',
    '本地规则已经裁定事实。你要把裁定演成过程、阻力、人心和余波；涉及关系变化时，让它通过称呼、眼神、让步、试探或态度变化露出来。',
    '范例：错误写法：“本回大获成功，张飞关系+5，金钱+100。”',
    '范例：正确写法：“张飞把酒碗往案上一顿，盯了我片刻，忽然笑出声来。他不再叫我小子，只说：这话有胆。门外亲兵随即递来一只沉甸甸的布囊。”',
    '范例：错误写法：“疲劳上升，士气下降，剧情继续推进。”',
    '范例：正确写法：“营火烧得低了，老卒们说话也轻。没人明着退，可每个人系甲的手都比方才慢了一拍。”',
    '正文可以自由发挥，但只写本回已经发生的现场，不替下一步做决定。',
    '若场上有可互动人物，优先写人物之间的分寸；若没有，就从差役、店家、驿卒、门吏、兵卒、文书、榜文和地方事务里开局。',
    '正文里只能点名“正文场景卡”已经给出的人物；未给出的人物不要主动露面，可用门吏、差役、店家、驿卒、兵卒、文书等职能身份承接事件。',
    '若只是赶路、休整、练功或调查，用一个小事件把局面推开：盘查、误认、递信、榜文改贴、客舍争执、军报入城、熟人传话皆可。',
    `正文写完后，单独一行输出 ${TURN_SPLITTER}。`,
    '分隔符之后再输出结构化内容，结构化内容只服务动态选项和导演建议。',
    `正文结束后，另起一行，只输出 ${TURN_SPLITTER}；再下一行输出一个 JSON 对象。`,
    'JSON 格式必须是：{"proposal":{"summary":"","dramaticQuestion":"","scenePlan":{"surfaceGoal":"","obstacle":"","turnPoint":"","emotionalShift":"","closingBeat":"","tone":"","pace":""},"sceneResidue":["..."],"newRumors":["..."],"npcReactions":[{"targetName":"","warmth":0,"tension":0,"respect":0,"guardedness":0,"curiosity":0,"note":""}],"factionReactions":[{"targetName":"","watchfulness":0,"respect":0,"hostility":0,"leverageFear":0,"note":""}],"threadSuggestions":[{"title":"","domain":"","urgency":1,"note":""}],"nextChoices":[{"text":"","actionText":"","hint":""}]}}',
    'proposal 里的内容只是下一回合建议，不是已经生效的状态。',
    'summary、dramaticQuestion、sceneResidue、newRumors、threadSuggestions 都要短，带火气，能直接落存档。',
    'nextChoices 必须正好 3 个：第一个顺水推舟，第二个进退维谷，第三个剑走偏锋。',
    '第一个选择：接住眼前的话头或变故，做出最符合当下常理、最能让事态自然向前发展的应对。',
    '第二个选择：设计一个扯动软肋的举动，无论怎么做都会得罪一方，必须在道义、人情、名声或安全之间痛苦割肉。',
    '第三个选择：跳出常规思维，给出一个狡黠、反常、不按套路出牌的动作，合乎情理但出人意料；高危局面可以火中取栗。',
    '每个 choice 的 text 像玩家真会点下去的动作；actionText 如果填写，要比 text 更具体。',
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
        content: `你是三国文字游戏的叙事导演。先自由写正文，再输出 ${TURN_SPLITTER}，最后输出 JSON。`
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
    let earlyProposal = null;
    let earlyParsedTail = null;

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
        const parsedTail = parseProposalTail(proposalTail, session, action);
        if (parsedTail.proposal && parsedTail.proposal.nextChoices.length >= 3) {
          earlyProposal = parsedTail.proposal;
          earlyParsedTail = parsedTail.parsed;
          diagnostics.proposalParsed = true;
          diagnostics.proposalChoiceCount = earlyProposal.nextChoices.length;
        }
        return;
      }

      narrationBuffer += textDelta;
      const splitTurn = splitTurnByMarker(narrationBuffer);
      if (splitTurn) {
        const narrationPart = splitTurn.before;
        await flushNarration(narrationPart, true);
        proposalTail += splitTurn.after;
        narrationBuffer = '';
        markerSeen = true;
        diagnostics.markerSeen = true;
        diagnostics.proposalTailChars = proposalTail.length;
        const parsedTail = parseProposalTail(proposalTail, session, action);
        if (parsedTail.proposal && parsedTail.proposal.nextChoices.length >= 3) {
          earlyProposal = parsedTail.proposal;
          earlyParsedTail = parsedTail.parsed;
          diagnostics.proposalParsed = true;
          diagnostics.proposalChoiceCount = earlyProposal.nextChoices.length;
        }
        return;
      }

      const holdback = Math.max(longestTurnMarkerLength() + 6, 24);
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
          if (earlyProposal) break;
        }

        if (earlyProposal) {
          try {
            await reader.cancel();
          } catch (cancelError) {
            // Ignore cancel errors.
          }
          break;
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

      if (!earlyProposal) {
        const trailing = drainTransportBuffer(transportBuffer);
        diagnostics.trailingPayloadCount = trailing.payloads.length;
        if (trailing.payloads.length) {
          for (const payloadText of trailing.payloads) {
            await handlePayload(payloadText);
            if (earlyProposal) break;
          }
        } else if (markerSeen) {
          proposalTail += trailing.remainder;
          diagnostics.proposalTailChars = proposalTail.length;
        }
      }

      if (narrationBuffer) {
        if (markerSeen) {
          proposalTail += narrationBuffer;
        } else {
          await flushNarration(narrationBuffer, true);
        }
      }
      await flushNarration('', true);

      if (earlyProposal) {
        const sanitizedNarration = removeAbstractFillerSentences(sanitizeChronicleText(narration.trim(), narration.trim()));
        if (sanitizedNarration) {
          diagnostics.proposalParsed = true;
          diagnostics.proposalChoiceCount = earlyProposal.nextChoices.length;
          diagnostics.proposalTailChars = proposalTail.length;
          diagnostics.narrationChars = narration.length;
          diagnostics.localSanitizedNarrationChars = sanitizedNarration.length;
          const finalDiagnostics = finalizeAttemptDiagnostics(diagnostics, { status: 'ok_early_tail' });
          console.log(`[director-stream] ${summarizeAttemptDiagnostics(finalDiagnostics)}`);
          return {
            ok: true,
            narration: sanitizedNarration,
            proposal: earlyProposal,
            reason: 'provider_unified_stream_ok',
            detail: `unified-stream-ok-early:${url}|marker:${markerSeen ? 1 : 0}|tail:${earlyParsedTail ? 1 : 0}|choices:${earlyProposal.nextChoices.length}|narration:1`,
            diagnostics: Object.assign({}, finalDiagnostics, {
              markerSeen
            })
          };
        }
      }
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
    const parsedTail = parseProposalTail(proposalTail, session, action);
    let normalizedProposal = parsedTail.proposal;
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
    diagnostics.proposalParsed = Boolean(parsedTail.parsed || normalizedProposal);
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
        detail: `unified-stream-ok:${url}|marker:${markerSeen ? 1 : 0}|tail:${parsedTail.parsed ? 1 : 0}|recovered:${recoveredTurn && recoveredTurn.proposal ? 1 : 0}|reasoningRecovered:${reasoningRecoveredTurn && (reasoningRecoveredTurn.narration || reasoningRecoveredTurn.proposal) ? 1 : 0}|choices:${normalizedProposal && normalizedProposal.nextChoices ? normalizedProposal.nextChoices.length : 0}|narration:1`,
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
