<template>
  <div class="crpg-shell">
    <TopHeader
      :title="title"
      :chapter-label="chapterLabel"
      :time-label="timeLabel"
      :turn-label="turnLabel"
      :system-items="systemItems"
      :support-entry="supportEntry"
      @system-action="emit('system-action', $event)"
    />

    <div class="crpg-shell__body">
      <!-- 区域 A：一级指令悬符 -->
      <aside class="crpg-shell__left">
        <CommandPanel
          :title="commandTitle"
          :subtitle="commandSubtitle"
          :groups="commandGroups"
          :active-group-key="activeGroupKey"
          @group-toggle="emit('group-toggle', $event)"
        />
      </aside>

      <!-- 区域 B：叙事碑文 + 决策案牍台 -->
      <main class="crpg-shell__main">
        <NarrativeView
          :chapter-title="narrative.chapterTitle"
          :scene-title="narrative.sceneTitle"
          :scene-subtitle="narrative.sceneSubtitle"
          :scene-badge="narrative.sceneBadge"
          :cards="narrative.cards"
          :logs="narrative.logs"
          :summary-ribbon="narrative.summaryRibbon"
          :story-html="narrative.storyHtml"
          :story-archive="narrative.storyArchive"
          :show-stream-tail="narrative.showStreamTail"
          :streaming-label="narrative.streamingLabel"
          :is-narrative-loading="isNarrativeLoading"
          @story-click="emit('story-click', $event)"
        />

        <section
          class="action-desk"
          :class="{ 'action-desk--loading': isNarrativeLoading }"
        >
          <header class="action-desk__head">
            <div>
              <div class="action-desk__kicker">决策案牍台</div>
              <h2 class="action-desk__title">{{ activeGroupLabel }}</h2>
            </div>
            <p class="action-desk__summary">{{ activeGroupSummary }}</p>
          </header>

          <transition name="desk-rise" mode="out-in">
            <div :key="activeGroupKey || 'empty'" class="action-desk__scroll">
              <section v-if="dynamicActions.length || isNarrativeLoading" class="action-desk__dynamic">
                <button
                  v-for="action in dynamicActions"
                  :key="action.key"
                  type="button"
                  class="action-card action-card--dynamic"
                  :class="{
                    'action-card--disabled': action.disabled || hasFailedRequirement(action),
                    'action-card--danger': action.tone === 'danger'
                  }"
                  :disabled="action.disabled"
                  @click="emit('action-select', action)"
                >
                  <span class="action-card__trace" aria-hidden="true">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                      <path d="M6 1 H99 V91 L91 99 H1 V8 Z" />
                    </svg>
                  </span>
                  <span class="action-card__seal" v-html="action.icon || activeGroupIcon"></span>
                  <span class="action-card__body">
                    <strong>{{ action.label }}</strong>
                    <small>{{ action.meta }}</small>
                    <span v-if="action.requirements && action.requirements.length" class="action-card__requirements">
                      <span
                        v-for="requirement in action.requirements"
                        :key="`${action.key}-${requirement.label}`"
                        :class="{ 'action-card__requirement--failed': isRequirementFailed(requirement) }"
                      >
                        {{ formatRequirement(requirement) }}
                      </span>
                    </span>
                  </span>
                  <span v-if="action.badge" class="action-card__badge">{{ action.badge }}</span>
                </button>
                <div v-if="!dynamicActions.length && isNarrativeLoading" class="action-desk__pending">
                  正在推演事件抉择<span>...</span>
                </div>
              </section>

              <div v-if="dynamicActions.length || isNarrativeLoading" class="action-desk__divider">
                <div></div>
                <span>常驻策略</span>
                <div></div>
              </div>

              <section class="action-desk__grid">
                <button
                  v-for="action in staticActions"
                  :key="action.key"
                  type="button"
                  class="action-card"
                  :class="{
                    'action-card--disabled': action.disabled || hasFailedRequirement(action),
                    'action-card--danger': action.tone === 'danger'
                  }"
                  :disabled="action.disabled"
                  @click="emit('action-select', action)"
                >
                  <span class="action-card__trace" aria-hidden="true">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                      <path d="M6 1 H99 V91 L91 99 H1 V8 Z" />
                    </svg>
                  </span>
                  <span class="action-card__seal" v-html="action.icon || activeGroupIcon"></span>
                  <span class="action-card__body">
                    <strong>{{ action.label }}</strong>
                    <small>{{ action.meta }}</small>
                    <span v-if="action.requirements && action.requirements.length" class="action-card__requirements">
                      <span
                        v-for="requirement in action.requirements"
                        :key="`${action.key}-${requirement.label}`"
                        :class="{ 'action-card__requirement--failed': isRequirementFailed(requirement) }"
                      >
                        {{ formatRequirement(requirement) }}
                      </span>
                    </span>
                  </span>
                  <span v-if="action.badge" class="action-card__badge">{{ action.badge }}</span>
                </button>

                <div v-if="!staticActions.length && !dynamicActions.length && !isNarrativeLoading" class="action-desk__empty">
                  此类暂无可落之子。
                </div>
              </section>
            </div>
          </transition>
        </section>
      </main>

      <!-- 区域 C：角色档案与状态监控 -->
      <aside class="crpg-shell__right">
        <CharacterSheet
          :name="character.name"
          :title="character.title"
          :location="character.location"
          :tags="character.tags"
          :metrics="character.metrics"
          :vitals="character.vitals"
        />
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import CharacterSheet from './CharacterSheet.vue';
import CommandPanel from './CommandPanel.vue';
import NarrativeView from './NarrativeView.vue';
import TopHeader from './TopHeader.vue';

defineOptions({
  name: 'CrpgLayout'
});

const props = defineProps({
  title: {
    type: String,
    default: '汉末往昔之影'
  },
  chapterLabel: {
    type: String,
    default: '乱世卷册'
  },
  timeLabel: {
    type: String,
    default: ''
  },
  turnLabel: {
    type: String,
    default: ''
  },
  systemItems: {
    type: Array,
    default: () => []
  },
  supportEntry: {
    type: Object,
    default: null
  },
  commandTitle: {
    type: String,
    default: '军令簿'
  },
  commandSubtitle: {
    type: String,
    default: ''
  },
  commandGroups: {
    type: Array,
    default: () => []
  },
  activeGroupKey: {
    type: String,
    default: ''
  },
  narrative: {
    type: Object,
    default: () => ({
      chapterTitle: '',
      sceneTitle: '',
      sceneSubtitle: '',
      sceneBadge: '',
      cards: [],
      logs: [],
      summaryRibbon: []
    })
  },
  character: {
    type: Object,
    default: () => ({
      name: '',
      title: '',
      location: '',
      tags: [],
      metrics: [],
      vitals: []
    })
  },
  isNarrativeLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'system-action',
  'group-toggle',
  'action-select',
  'story-click'
]);

const activeGroup = computed(() => {
  const groups = Array.isArray(props.commandGroups) ? props.commandGroups : [];
  return groups.find(group => group && group.key === props.activeGroupKey) || groups[0] || null;
});

const activeActions = computed(() => {
  return activeGroup.value && Array.isArray(activeGroup.value.actions) ? activeGroup.value.actions : [];
});

const priorityActions = computed(() => {
  const groups = Array.isArray(props.commandGroups) ? props.commandGroups : [];
  const priorityGroup = groups.find(group => group && group.key === 'priority');
  return priorityGroup && Array.isArray(priorityGroup.actions) ? priorityGroup.actions : [];
});

const displayedActions = computed(() => {
  const seen = new Set();
  const actions = [];
  const pushAction = (action) => {
    if (!action || !action.key || seen.has(action.key)) return;
    seen.add(action.key);
    actions.push(action);
  };
  if (activeGroup.value && activeGroup.value.key !== 'priority') {
    priorityActions.value.forEach(pushAction);
  }
  activeActions.value.forEach(pushAction);
  return actions;
});

const dynamicActions = computed(() => {
  return displayedActions.value.filter(action => action && action.choice && action.choice.source === 'dynamic');
});

const staticActions = computed(() => {
  return displayedActions.value.filter(action => !(action && action.choice && action.choice.source === 'dynamic'));
});

const activeGroupLabel = computed(() => (activeGroup.value && activeGroup.value.label) || '待命');
const activeGroupSummary = computed(() => (activeGroup.value && activeGroup.value.summary) || props.commandSubtitle || '先择令，再落子。');
const activeGroupIcon = computed(() => (activeGroup.value && activeGroup.value.icon) || '');

function isRequirementFailed(requirement) {
  return requirement && requirement.type === 'stat' && Number(requirement.current || 0) < Number(requirement.minimum || 0);
}

function hasFailedRequirement(action) {
  return !!(action && Array.isArray(action.requirements) && action.requirements.some(isRequirementFailed));
}

function formatRequirement(requirement) {
  if (!requirement) return '';
  if (requirement.type === 'stat') {
    return `${requirement.label}${Number(requirement.current || 0)}/${Number(requirement.minimum || 0)}`;
  }
  return requirement.label || '';
}
</script>

<style scoped lang="less">
.crpg-shell {
  --crpg-bg: #0c0a09;
  --crpg-panel: #171412;
  --crpg-panel-strong: #1c1815;
  --crpg-paper: #e3d8c8;
  --crpg-muted: #8b8172;
  --crpg-gold: #b89947;
  --crpg-blood: #8c2626;
  --crpg-line: rgba(184, 153, 71, 0.15);
  --crpg-chamfer: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  --crpg-motion: all 300ms cubic-bezier(0.25, 1, 0.5, 1);
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% -18%, rgba(184, 153, 71, 0.1), transparent 34%),
    radial-gradient(circle at 18% 72%, rgba(112, 80, 48, 0.08), transparent 26%),
    repeating-radial-gradient(circle at 12% 8%, rgba(255, 247, 229, 0.018) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, #110e0d 0%, var(--crpg-bg) 42%, #070605 100%);
  color: var(--crpg-paper);
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
}

.crpg-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.16;
  background-image:
    linear-gradient(rgba(227, 216, 200, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(227, 216, 200, 0.018) 1px, transparent 1px),
    radial-gradient(circle at 1px 1px, rgba(184, 153, 71, 0.28) 1px, transparent 0);
  background-size: 34px 34px, 34px 34px, 19px 19px;
}

.crpg-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.18;
  background-image:
    radial-gradient(circle, rgba(202, 166, 104, 0.42) 0 1px, transparent 1.6px),
    radial-gradient(circle, rgba(205, 196, 177, 0.22) 0 1px, transparent 1.8px),
    radial-gradient(circle, rgba(93, 76, 55, 0.32) 0 1px, transparent 1.4px);
  background-position: 10% 110%, 70% 105%, 44% 112%;
  background-size: 180px 240px, 260px 320px, 140px 220px;
  mix-blend-mode: screen;
  animation: crpgAshFall 34s linear infinite;
}

.crpg-shell__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
  overflow: hidden;
  padding: 16px;
}

.crpg-shell__left {
  flex: 0 0 96px;
  min-width: 0;
  overflow: visible;
}

.crpg-shell__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 16px;
}

.crpg-shell__right {
  flex: 0 0 284px;
  min-width: 0;
  overflow: hidden;
}

.action-desk {
  position: relative;
  flex: 0 0 318px;
  min-height: 0;
  padding: 14px;
  clip-path: var(--crpg-chamfer);
  background:
    repeating-radial-gradient(circle at 18% 24%, rgba(255, 247, 229, 0.02) 0 1px, transparent 1px 5px),
    linear-gradient(145deg, rgba(255, 255, 255, 0.035), transparent 34%),
    linear-gradient(180deg, var(--crpg-panel-strong), #120f0d);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.1),
    inset 0 1px 0 rgba(255, 247, 229, 0.05),
    0 8px 30px rgba(0, 0, 0, 0.8);
  transition: var(--crpg-motion);
}

.action-desk--loading {
  pointer-events: none;
  opacity: 0.4;
  transform: scale(0.99);
}

.action-desk__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
}

.action-desk__kicker {
  color: var(--crpg-gold);
  font-size: 11px;
  letter-spacing: 0.22em;
}

.action-desk__title {
  margin: 3px 0 0;
  color: var(--crpg-paper);
  font-size: 22px;
  line-height: 1.1;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.72);
}

.action-desk__summary {
  max-width: 520px;
  margin: 0;
  color: var(--crpg-muted);
  font-size: 13px;
  line-height: 1.7;
  text-align: right;
}

.action-desk__scroll {
  height: 232px;
  min-height: 224px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-color: rgba(184, 153, 71, 0.6) transparent;
  scrollbar-width: thin;
  box-shadow: inset 0 -20px 20px -20px rgba(0, 0, 0, 0.8);
  mask-image: linear-gradient(to bottom, black 84%, transparent);
}

.action-desk__scroll::-webkit-scrollbar {
  width: 3px;
}

.action-desk__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.action-desk__scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(184, 153, 71, 0.48);
}

.action-desk__dynamic {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-desk__divider {
  display: flex;
  align-items: center;
  gap: 0;
  margin: 14px 0;
}

.action-desk__divider div {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(184, 153, 71, 0.3), transparent);
}

.action-desk__divider span {
  padding: 0 16px;
  color: #8a8377;
  font-size: 12px;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
  letter-spacing: 0.18em;
  white-space: nowrap;
}

.action-desk__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.action-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 116px;
  padding: 12px 14px;
  border: 0;
  clip-path: var(--crpg-chamfer);
  background:
    repeating-radial-gradient(circle at 16% 18%, rgba(255, 247, 229, 0.018) 0 1px, transparent 1px 6px),
    linear-gradient(135deg, rgba(184, 153, 71, 0.13), transparent 42%),
    linear-gradient(180deg, #211b16, #15110f);
  backdrop-filter: blur(10px);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.15),
    inset 0 -10px 24px rgba(0, 0, 0, 0.28);
  color: var(--crpg-paper);
  cursor: pointer;
  font-family: inherit;
  isolation: isolate;
  overflow: hidden;
  text-align: left;
  transition: var(--crpg-motion);
}

.action-card--dynamic {
  width: 100%;
  min-height: 74px;
  background:
    linear-gradient(90deg, #2a241e, #201c18 54%, transparent),
    linear-gradient(180deg, #211b16, #15110f);
  box-shadow:
    inset 0 0 0 1px rgba(212, 175, 55, 0.4),
    inset 0 -10px 24px rgba(0, 0, 0, 0.28),
    0 0 15px rgba(212, 175, 55, 0.1);
  animation: fadeInUp 0.4s ease-out;
}

.action-card--dynamic .action-card__body strong {
  color: #d4af37;
  font-size: 18px;
  letter-spacing: 0.025em;
}

.action-card--dynamic .action-card__body small {
  color: rgba(227, 216, 200, 0.82);
  -webkit-line-clamp: 1;
}

.action-desk__pending {
  min-height: 58px;
  padding: 16px 18px;
  clip-path: var(--crpg-chamfer);
  background: linear-gradient(90deg, rgba(42, 36, 30, 0.88), rgba(32, 28, 24, 0.75), transparent);
  box-shadow:
    inset 0 0 0 1px rgba(212, 175, 55, 0.22),
    0 0 15px rgba(212, 175, 55, 0.08);
  color: rgba(212, 175, 55, 0.8);
  font-size: 14px;
  letter-spacing: 0.12em;
}

.action-desk__pending span {
  display: inline-block;
  margin-left: 6px;
  animation: tailPulse 1.2s ease-in-out infinite;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.34),
    0 18px 34px rgba(0, 0, 0, 0.36),
    0 0 22px rgba(184, 153, 71, 0.08);
}

.action-card:active {
  transform: translateY(1px) scale(0.985);
  filter: brightness(0.96);
}

.action-card--disabled {
  opacity: 0.6;
  filter: grayscale(1);
  cursor: not-allowed;
}

.action-card--disabled:hover {
  transform: none;
}

.action-card__trace {
  position: absolute;
  inset: 1px;
  z-index: 0;
  pointer-events: none;
  opacity: 0.34;
}

.action-card > :not(.action-card__trace) {
  position: relative;
  z-index: 1;
}

.action-card__trace svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.action-card__trace path {
  fill: none;
  stroke: rgba(198, 157, 91, 0.62);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  stroke-dasharray: 72 260;
  stroke-dashoffset: 180;
  filter: drop-shadow(0 0 5px rgba(184, 153, 71, 0.18));
  transition: stroke 300ms ease, opacity 300ms ease;
}

.action-card:hover .action-card__trace {
  opacity: 0.82;
}

.action-card:hover .action-card__trace path {
  animation: actionTraceFlow 5.8s linear infinite;
  stroke: rgba(218, 179, 111, 0.78);
}

.action-card__seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  width: 36px;
  height: 36px;
  padding: 8px;
  border-radius: 2px;
  background: #2a241e;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5);
  color: var(--crpg-gold);
}

.action-card__seal :deep(svg) {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.action-card__body {
  min-width: 0;
}

.action-card__body strong {
  display: block;
  overflow: hidden;
  color: var(--crpg-paper);
  font-size: 15px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-card__body small {
  display: -webkit-box;
  margin-top: 4px;
  overflow: hidden;
  color: rgba(227, 216, 200, 0.72);
  font-size: 12px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.action-card__requirements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
  color: rgba(184, 153, 71, 0.8);
  font-size: 11px;
}

.action-card__requirement--failed {
  color: var(--crpg-blood);
  font-weight: 700;
  animation: dangerPulse 1.3s ease-in-out infinite;
}

.action-card__badge {
  margin-left: auto;
  color: var(--crpg-gold);
  font-size: 11px;
  white-space: nowrap;
}

.action-desk__empty {
  grid-column: 1 / -1;
  padding: 28px;
  color: var(--crpg-muted);
  text-align: center;
}

.desk-rise-enter-active,
.desk-rise-leave-active {
  transition: opacity 220ms cubic-bezier(0.25, 1, 0.5, 1), transform 220ms cubic-bezier(0.25, 1, 0.5, 1);
}

.desk-rise-enter-from,
.desk-rise-leave-to {
  opacity: 0;
  transform: translateY(14px);
}

@keyframes dangerPulse {
  0%, 100% { opacity: 0.62; }
  50% { opacity: 1; text-shadow: 0 0 10px rgba(140, 38, 38, 0.9); }
}

@keyframes tailPulse {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes crpgAshFall {
  0% { background-position: 10% 110%, 70% 105%, 44% 112%; }
  100% { background-position: 12% -20%, 68% -28%, 46% -18%; }
}

@keyframes actionTraceFlow {
  0% { stroke-dashoffset: 180; }
  100% { stroke-dashoffset: -152; }
}

@media (prefers-reduced-motion: reduce) {
  .crpg-shell::after,
  .action-card:hover .action-card__trace path,
  .action-desk__pending span {
    animation: none;
  }
}

@media (max-width: 1080px) {
  .crpg-shell {
    overflow-y: auto;
  }

  .crpg-shell__body {
    flex-direction: column;
    overflow: visible;
  }

  .crpg-shell__left,
  .crpg-shell__right {
    flex-basis: auto;
  }

  .action-desk {
    flex-basis: auto;
  }
}
</style>
