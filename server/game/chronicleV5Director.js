const { DEFAULT_MODEL } = require('./chronicleV2Constants');
const { buildLocalDynamicChoices, generateDynamicChoices } = require('./chronicleV5ChoiceGenerator');
const { applyDramaticMeta } = require('./chronicleV5DramaticLayer');
const { ensureMemoryState, normalizeThreadEntry } = require('./chronicleV5Memory');
const { NARRATION_CONFIG } = require('./chronicleV5NarrationConfigSafe');
const { streamUnifiedDirectorTurn } = require('./chronicleV5UnifiedTurnStream');

const LABEL_DOMAIN = '\u5c40\u52bf';
const LABEL_ACTION = '\u52a8\u4f5c';
const STATUS_LOCAL_NARRATION = '\u6b63\u6587\u5148\u7531\u672c\u5730\u63a5\u4f4f\uff0c\u540e\u7eed\u52a8\u4f5c\u6b63\u5728\u91cd\u6392\u3002';
const STATUS_PROVIDER_STREAM = '\u672c\u5730\u5bfc\u6f14\u5df2\u88c1\u5b9a\u6b64\u56de\uff0c\u7075\u5883\u6b63\u5728\u6d41\u5f0f\u6f14\u7ece\u6b63\u6587\u3002';
const STATUS_PROVIDER_CHOICES = '\u6b63\u6587\u5df2\u843d\u4e0b\uff0c\u6b63\u5728\u6574\u7406\u540e\u7eed\u52a8\u4f5c\u3002';

function ensureList(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(list) {
  return Array.from(new Set(ensureList(list).map((item) => String(item || '').trim()).filter(Boolean)));
}

function clipText(value, max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProviderEnabled(settings) {
  return Boolean(
    settings
    && settings.apiBaseUrl
    && settings.apiKey
    && settings.model
    && settings.model !== DEFAULT_MODEL
  );
}

function buildDynamicChoiceMeta(mode, reason, detail) {
  return {
    mode: String(mode || 'fallback').trim() || 'fallback',
    reason: String(reason || 'local_dynamic_fallback').trim() || 'local_dynamic_fallback',
    detail: String(detail || '').trim()
  };
}

function sortOpenThreads(list) {
  return ensureList(list)
    .filter(Boolean)
    .sort((left, right) => {
      const urgencyGap = Number(right.urgency || 0) - Number(left.urgency || 0);
      if (urgencyGap) return urgencyGap;
      const deadlineGap = Number(left.deadlineTurn || 0) - Number(right.deadlineTurn || 0);
      if (deadlineGap) return deadlineGap;
      return String(left.title || '').localeCompare(String(right.title || ''), 'zh-Hans-CN');
    });
}

function buildThreadKey(turn, item, index) {
  const title = String(item && item.title || '')
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, '_')
    .slice(0, 24);
  return `director_${turn}_${index}_${title || 'thread'}`;
}

function applyDirectorThreadSuggestions(session, action, proposal) {
  if (!session || !session.memory) return { added: 0, updated: 0 };
  const suggestions = ensureList(proposal && proposal.threadSuggestions).slice(0, 3);
  if (!suggestions.length) return { added: 0, updated: 0 };

  const memory = ensureMemoryState(session.memory);
  const turn = Number(session.world && session.world.turn || 0);
  const existing = sortOpenThreads(
    ensureList(memory.openThreads).map((item) => normalizeThreadEntry(item, { currentTurn: turn }))
  );
  let added = 0;
  let updated = 0;

  suggestions.forEach((item, index) => {
    const title = clipText(item && item.title || '', 48);
    if (!title) return;
    const domain = clipText(item && item.domain || LABEL_DOMAIN, 16) || LABEL_DOMAIN;
    const note = clipText(item && item.note || '', 96);
    const urgency = Math.max(1, Math.min(3, Number(item && item.urgency || 2) || 2));
    const found = existing.find((thread) => thread && thread.title === title);
    if (found) {
      found.urgency = Math.max(Number(found.urgency || 1), urgency);
      if (note) {
        found.notes = uniqueStrings([note].concat(ensureList(found.notes))).slice(0, 4);
      }
      if (!found.sourceActionKind) found.sourceActionKind = String(action && action.kind || '').trim();
      updated += 1;
      return;
    }

    existing.unshift(normalizeThreadEntry({
      key: buildThreadKey(turn, item, index),
      title,
      urgency,
      domain,
      status: 'open',
      source: 'director',
      sourceActionKind: String(action && action.kind || '').trim(),
      lastAdvancedTurn: turn,
      notes: note ? [note] : []
    }, { currentTurn: turn }));
    added += 1;
  });

  memory.openThreads = sortOpenThreads(existing).slice(0, 6);
  session.memory = memory;
  return { added, updated };
}

function applyDirectorProposal(session, action, proposal) {
  const normalizedProposal = proposal && typeof proposal === 'object' ? proposal : {};
  const residues = uniqueStrings(
    ensureList(normalizedProposal.sceneResidue).concat(ensureList(normalizedProposal.newRumors))
  ).slice(0, 6);
  const hasDramaticData = Boolean(
    residues.length
    || normalizedProposal.dramaticQuestion
    || Object.values(normalizedProposal.scenePlan || {}).some(Boolean)
    || ensureList(normalizedProposal.npcReactions).length
    || ensureList(normalizedProposal.factionReactions).length
    || normalizedProposal.summary
  );

  if (hasDramaticData && session && session.gameState) {
    applyDramaticMeta(session.gameState, {
      dramaticQuestion: normalizedProposal.dramaticQuestion || '',
      summary: normalizedProposal.summary || '',
      scenePlan: normalizedProposal.scenePlan || {},
      sceneResidue: residues,
      softStatePatch: {
        actor: {},
        relations: ensureList(normalizedProposal.npcReactions).map((item) => ({
          targetId: item.targetId || '',
          targetName: item.targetName || '',
          warmth: Number(item.warmth || 0),
          tension: Number(item.tension || 0),
          respect: Number(item.respect || 0),
          guardedness: Number(item.guardedness || 0),
          curiosity: Number(item.curiosity || 0),
          note: item.note || ''
        })),
        factions: ensureList(normalizedProposal.factionReactions).map((item) => ({
          targetId: item.targetId || '',
          targetName: item.targetName || '',
          watchfulness: Number(item.watchfulness || 0),
          respect: Number(item.respect || 0),
          hostility: Number(item.hostility || 0),
          leverageFear: Number(item.leverageFear || 0),
          note: item.note || ''
        }))
      }
    }, {
      turn: session.world && session.world.turn,
      source: 'director_provider',
      actionKind: action && action.kind,
      actionMode: action && action.mode,
      summary: normalizedProposal.summary || clipText(residues[0] || '', 60)
    });
  }

  const threadPatch = applyDirectorThreadSuggestions(session, action, normalizedProposal);
  return {
    residuesApplied: residues.length,
    threadPatch,
    nextChoices: ensureList(normalizedProposal.nextChoices).slice(0, 3)
  };
}

async function emitDirectedChoices(choices, onDraft, onChoice) {
  const list = ensureList(choices).slice(0, 3);
  for (let index = 0; index < list.length; index += 1) {
    const choice = list[index];
    if (typeof onDraft === 'function') {
      await onDraft({
        slot: index,
        slotRole: choice.slotRole || '',
        slotRoleLabel: choice.slotRoleLabel || `${LABEL_ACTION}${index + 1}`,
        text: choice.text || '',
        hint: choice.hint || '',
        isTyping: true
      });
      await sleep(120);
    }
    if (typeof onChoice === 'function') {
      await onChoice(choice);
    }
  }
}

async function streamLocalFallbackText(text, onText) {
  const chunks = String(text || '').match(/.{1,18}/g) || [String(text || '')];
  let finalText = '';
  for (const chunk of chunks) {
    finalText += chunk;
    if (typeof onText === 'function') {
      await onText(chunk);
    }
    await sleep(35);
  }
  return finalText;
}

async function buildFallbackTurn(options, bundleDetail = '') {
  const {
    session,
    action,
    runtimeSettings,
    turnResult,
    onStatus,
    onText,
    onDraft,
    onChoice,
    providerDiagnostics = null
  } = options;

  const narration = {
    text: (await streamLocalFallbackText(turnResult.fallbackText, onText)).trim(),
    mode: 'fallback',
    reason: 'provider_unavailable',
    detail: bundleDetail || 'director-local-fallback'
  };

  let dynamicChoices = [];
  let dynamicChoiceMeta = buildDynamicChoiceMeta('disabled', 'dynamic_skipped', bundleDetail || 'director-bypass');
  if (session && session.world && session.world.phase === 'playing' && session.world.phase !== 'ended') {
    if (typeof onStatus === 'function') {
      await onStatus(
        narration && narration.mode === 'fallback'
          ? STATUS_LOCAL_NARRATION
          : NARRATION_CONFIG.status.choicesReady
      );
    }
    const generated = await generateDynamicChoices(session, action, runtimeSettings, {
      onDraft,
      onChoice,
      allowLocalFallback: false
    });
    dynamicChoices = ensureList(generated).slice(0, 3);
    dynamicChoiceMeta = buildDynamicChoiceMeta(
      generated && generated.meta && generated.meta.mode
        ? generated.meta.mode
        : (narration && narration.mode === 'fallback' ? 'fallback' : 'disabled'),
      generated && generated.meta && generated.meta.reason
        ? generated.meta.reason
        : 'dynamic_choices_unavailable',
      generated && generated.meta && generated.meta.detail
        ? generated.meta.detail
        : (bundleDetail || 'director-dynamic-unavailable')
    );
  }

  return {
    narration,
    dynamicChoices,
    dynamicChoiceMeta,
    directorMeta: {
      mode: 'unified_fallback',
      reason: 'unified_narration_failed',
      detail: bundleDetail || narration.detail || '',
      diagnostics: providerDiagnostics
    }
  };
}

async function runDirectorTurn(options) {
  const {
    session,
    action,
    turnResult,
    runtimeSettings,
    onStatus,
    onText,
    onDraft,
    onChoice
  } = options;

  if (!turnResult || !turnResult.prompt) {
    return {
      narration: {
        text: '',
        mode: 'fallback',
        reason: 'rule_only',
        detail: 'director-no-prompt'
      },
      dynamicChoices: [],
      dynamicChoiceMeta: buildDynamicChoiceMeta('disabled', 'dynamic_skipped', 'director-no-prompt'),
      directorMeta: {
        mode: 'rule_only',
        reason: 'rule_only',
        detail: 'director-no-prompt'
      }
    };
  }

  if (!isProviderEnabled(runtimeSettings) || !turnResult.directorPacket) {
    return buildFallbackTurn(options, 'director-disabled-or-missing-packet');
  }

  if (typeof onStatus === 'function') {
    await onStatus(STATUS_PROVIDER_STREAM);
  }

  const streamedTurn = await streamUnifiedDirectorTurn(
    runtimeSettings,
    session,
    turnResult.effectiveAction || action,
    turnResult.directorPacket,
    { onText, onStatus }
  );

  if (!streamedTurn || !streamedTurn.ok || !streamedTurn.narration) {
    return buildFallbackTurn(
      Object.assign({}, options, {
        providerDiagnostics: streamedTurn && streamedTurn.diagnostics ? streamedTurn.diagnostics : null
      }),
      streamedTurn && streamedTurn.detail ? streamedTurn.detail : 'director-unified-stream-failed'
    );
  }

  const narration = {
    text: streamedTurn.narration,
    mode: 'provider',
    reason: streamedTurn.reason || 'provider_unified_stream_ok',
    detail: streamedTurn.detail || ''
  };

  let applied = {
    residuesApplied: 0,
    threadPatch: { added: 0, updated: 0 },
    nextChoices: []
  };

  if (streamedTurn.proposal) {
    if (typeof onStatus === 'function') {
      await onStatus(STATUS_PROVIDER_CHOICES);
    }
    applied = applyDirectorProposal(session, turnResult.effectiveAction || action, streamedTurn.proposal || {});
  }

  let dynamicChoices = ensureList(applied.nextChoices).slice(0, 3);
  let dynamicChoiceMeta = buildDynamicChoiceMeta(
    dynamicChoices.length ? 'provider' : 'disabled',
    dynamicChoices.length ? 'provider_director_choices' : 'provider_missing_choices',
    [
      narration && narration.detail ? `narration:${narration.detail}` : '',
      `director-residue:${Number(applied.residuesApplied || 0)}`,
      `director-threads:${Number(applied.threadPatch && applied.threadPatch.added || 0)}+${Number(applied.threadPatch && applied.threadPatch.updated || 0)}`
    ].filter(Boolean).join('|')
  );

  if (session && session.world && session.world.phase === 'playing' && session.world.phase !== 'ended') {
    if (typeof onStatus === 'function') {
      await onStatus(NARRATION_CONFIG.status.choicesReady);
    }
    if (dynamicChoices.length) {
      await emitDirectedChoices(dynamicChoices, onDraft, onChoice);
    }
  } else {
    dynamicChoices = [];
    dynamicChoiceMeta = buildDynamicChoiceMeta(
      'disabled',
      'phase_unavailable',
      narration && narration.detail ? narration.detail : 'director-phase-disabled'
    );
  }

  return {
    narration,
    dynamicChoices,
    dynamicChoiceMeta,
    directorMeta: {
      mode: narration && narration.mode === 'provider' ? 'provider' : 'fallback',
      reason: narration && narration.mode === 'provider' ? 'provider_director_ok' : ((narration && narration.reason) || 'legacy_narration_fallback'),
      detail: [
        narration && narration.detail ? `narration:${narration.detail}` : '',
        `residues:${Number(applied.residuesApplied || 0)}`,
        `threads:${Number(applied.threadPatch && applied.threadPatch.added || 0)}+${Number(applied.threadPatch && applied.threadPatch.updated || 0)}`
      ].filter(Boolean).join('|'),
      diagnostics: streamedTurn && streamedTurn.diagnostics ? streamedTurn.diagnostics : null
    }
  };
}

module.exports = {
  runDirectorTurn
};
