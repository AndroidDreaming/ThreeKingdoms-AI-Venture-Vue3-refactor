<template>
  <section class="narrative-view">
    <!-- 区域 B1：叙事碑文区 -->
    <header class="narrative-stele">
      <div class="narrative-stele__block">
        <div class="narrative-stele__kicker">{{ chapterTitle }}</div>
        <h1 class="narrative-stele__title">{{ sceneTitle }}</h1>
        <p class="narrative-stele__subtitle">{{ sceneSubtitle }}</p>
      </div>

      <div class="narrative-stele__divider"></div>

      <div class="narrative-stele__block narrative-stele__block--right">
        <div class="narrative-stele__kicker">{{ sceneBadge }}</div>
        <div class="narrative-stele__number">{{ progressValue }}</div>
        <p class="narrative-stele__subtitle">{{ progressLabel }}</p>
      </div>
    </header>

    <section v-if="summaryRibbon.length" class="narrative-ribbon">
      <span v-for="item in summaryRibbon" :key="item.key">
        <strong>{{ item.label }}</strong>
        {{ item.value }}
      </span>
    </section>

    <section class="narrative-cards">
      <article
        v-for="card in cards"
        :key="card.key"
        class="narrative-card"
      >
        <div class="narrative-card__kicker">{{ card.kicker }}</div>
        <h2 class="narrative-card__title">{{ card.title }}</h2>
        <p class="narrative-card__body">{{ card.description }}</p>
        <div v-if="card.facts && card.facts.length" class="narrative-card__facts">
          <span v-for="fact in card.facts" :key="fact.label">
            <small>{{ fact.label }}</small>
            <strong>{{ fact.value }}</strong>
          </span>
        </div>
      </article>
    </section>

    <aside v-if="storyArchive && storyArchive.text" class="narrative-archive-strip">
      <div>
        <span>上一回归档</span>
        <strong>{{ storyArchive.title }}</strong>
      </div>
      <p>{{ storyArchive.statusLine || storyArchive.dateLabel }}</p>
    </aside>

    <section class="narrative-log">
      <div ref="scrollContainer" class="narrative-log__scroll">
        <article v-for="entry in logs" :key="entry.key" class="narrative-entry">
          <div v-if="entry.label" class="narrative-entry__label">{{ entry.label }}</div>
          <p
            v-for="paragraph in entry.paragraphs"
            :key="paragraph"
            class="narrative-entry__paragraph"
          >
            {{ paragraph }}
          </p>
        </article>

        <div
          v-if="storyHtml"
          class="narrative-story-html"
          :class="{ 'narrative-story-html--streaming': isNarrativeLoading }"
          v-html="storyHtml"
          @click="emit('story-click', $event)"
        ></div>

        <div v-if="isNarrativeLoading" class="narrative-stream-tail">
          <span v-if="showStreamTail" class="narrative-stream-tail__cursor">...</span>
          <span>{{ streamingLabel || '正文仍在继续落下。' }}</span>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';

defineOptions({
  name: 'NarrativeView'
});

const props = defineProps({
  chapterTitle: {
    type: String,
    default: ''
  },
  sceneTitle: {
    type: String,
    default: ''
  },
  sceneSubtitle: {
    type: String,
    default: ''
  },
  sceneBadge: {
    type: String,
    default: ''
  },
  cards: {
    type: Array,
    default: () => []
  },
  logs: {
    type: Array,
    default: () => []
  },
  storyHtml: {
    type: String,
    default: ''
  },
  storyArchive: {
    type: Object,
    default: () => null
  },
  showStreamTail: {
    type: Boolean,
    default: false
  },
  streamingLabel: {
    type: String,
    default: ''
  },
  isNarrativeLoading: {
    type: Boolean,
    default: false
  },
  summaryRibbon: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['story-click']);
const scrollContainer = ref(null);

const progressSource = computed(() => {
  const cards = Array.isArray(props.cards) ? props.cards : [];
  return cards.find(card => card && /进度\s*\d+%/.test(String(card.badge || ''))) || null;
});

const progressValue = computed(() => {
  const badge = progressSource.value ? String(progressSource.value.badge || '') : '';
  const match = badge.match(/(\d+)%/);
  return match ? `${match[1]}%` : '未定';
});

const progressLabel = computed(() => {
  return progressSource.value ? progressSource.value.title : '等待落子';
});

watch(
  () => [props.storyHtml, props.logs.length, props.showStreamTail, props.isNarrativeLoading],
  async () => {
    await nextTick();
    if (!scrollContainer.value) return;
    scrollContainer.value.scrollTo({
      top: scrollContainer.value.scrollHeight,
      behavior: props.isNarrativeLoading ? 'auto' : 'smooth'
    });
  },
  { flush: 'post' }
);
</script>

<style scoped lang="less">
.narrative-view {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background:
    repeating-radial-gradient(circle at 24% 18%, rgba(255, 247, 229, 0.018) 0 1px, transparent 1px 5px),
    linear-gradient(135deg, rgba(255, 247, 229, 0.035), transparent 28%),
    linear-gradient(180deg, #171412, #100e0c);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.1),
    0 8px 30px rgba(0, 0, 0, 0.8);
  color: #e3d8c8;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
}

.narrative-stele {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1px minmax(220px, 0.36fr);
  gap: 16px;
  padding: 12px 20px 10px;
  background:
    radial-gradient(circle at top, rgba(184, 153, 71, 0.12), transparent 42%),
    linear-gradient(to bottom, rgba(184, 153, 71, 0.1), transparent),
    linear-gradient(180deg, #1c1815, #14110f);
}

.narrative-stele__block {
  min-width: 0;
}

.narrative-stele__block--right {
  text-align: right;
}

.narrative-stele__kicker {
  color: #b89947;
  font-size: 12px;
  letter-spacing: 0.22em;
}

.narrative-stele__title {
  margin: 4px 0 3px;
  overflow: hidden;
  color: #e3d8c8;
  font-size: 34px;
  line-height: 1.15;
  text-overflow: ellipsis;
  text-shadow: 0 3px 14px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.narrative-stele__subtitle {
  margin: 0;
  color: rgba(227, 216, 200, 0.72);
  font-size: 14px;
  line-height: 1.45;
}

.narrative-stele__divider {
  width: 1px;
  min-height: 100%;
  background: linear-gradient(to bottom, transparent, rgba(184, 153, 71, 0.3), transparent);
}

.narrative-stele__number {
  margin-top: 1px;
  color: #b89947;
  font-size: 40px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 3px 14px rgba(0, 0, 0, 0.8);
}

.narrative-ribbon {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 6px 20px;
  border-top: 1px solid rgba(184, 153, 71, 0.08);
  border-bottom: 1px solid rgba(184, 153, 71, 0.08);
  color: rgba(227, 216, 200, 0.64);
  font-size: 12px;
}

.narrative-ribbon strong {
  margin-right: 6px;
  color: #b89947;
}

.narrative-cards {
  display: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 6px 20px 0;
  background: rgba(184, 153, 71, 0.12);
}

.narrative-card {
  position: relative;
  min-width: 0;
  padding: 8px 12px;
  background:
    repeating-radial-gradient(circle at 16% 24%, rgba(255, 247, 229, 0.018) 0 1px, transparent 1px 5px),
    linear-gradient(145deg, rgba(255, 247, 229, 0.035), transparent 42%),
    #171412;
  overflow: hidden;
}

.narrative-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent, rgba(184, 153, 71, 0.42), transparent) top left / 46% 1px no-repeat,
    linear-gradient(180deg, transparent, rgba(184, 153, 71, 0.24), transparent) top left / 1px 68% no-repeat;
  opacity: 0.34;
  transform: translateX(-52%);
  transition: opacity 360ms ease;
}

.narrative-card:hover::after {
  opacity: 0.72;
  animation: narrativeCardTrace 5.6s linear infinite;
}

.narrative-card__kicker {
  color: #b89947;
  font-size: 11px;
  letter-spacing: 0.16em;
}

.narrative-card__title {
  margin: 2px 0 3px;
  overflow: hidden;
  color: #e3d8c8;
  font-size: 20px;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.72);
  white-space: nowrap;
}

.narrative-card__body {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: rgba(227, 216, 200, 0.76);
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.narrative-card__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 10px;
  margin-top: 5px;
}

.narrative-card__facts span {
  min-width: 0;
  color: rgba(227, 216, 200, 0.68);
  font-size: 12px;
}

.narrative-card__facts small {
  margin-right: 5px;
  color: #8b8172;
}

.narrative-card__facts strong {
  color: #b89947;
  font-weight: 700;
}

.narrative-archive-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 6px 20px 0;
  padding: 7px 12px;
  background:
    linear-gradient(90deg, rgba(184, 153, 71, 0.08), transparent 70%),
    rgba(10, 8, 7, 0.28);
  box-shadow: inset 0 0 0 1px rgba(184, 153, 71, 0.08);
  color: rgba(227, 216, 200, 0.66);
}

.narrative-archive-strip div {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.narrative-archive-strip span {
  flex: 0 0 auto;
  color: #8a8377;
  font-size: 11px;
  letter-spacing: 0.18em;
}

.narrative-archive-strip strong {
  overflow: hidden;
  color: rgba(184, 153, 71, 0.82);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.narrative-archive-strip p {
  flex: 0 1 auto;
  max-width: 42%;
  margin: 0;
  overflow: hidden;
  color: #8b8172;
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.narrative-log {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  padding: 6px 14px 10px;
}

.narrative-log__scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: none;
  margin: 0 auto;
  overflow: auto;
  padding: 8px 18px 34px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
}

.narrative-log__scroll::-webkit-scrollbar {
  width: 4px;
}

.narrative-log__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.narrative-log__scroll::-webkit-scrollbar-thumb {
  background: rgba(184, 153, 71, 0.55);
}

.narrative-story-html {
  position: relative;
}

.narrative-story-html:not(.narrative-story-html--streaming) :deep(.story-paragraph) {
  animation: narrativeParagraphReveal 520ms cubic-bezier(0.25, 1, 0.5, 1) both;
}

.narrative-story-html :deep(.story-paragraph) {
  margin: 0 0 24px;
  color: #e3d8c8;
  font-size: 18px;
  line-height: 2.2;
  letter-spacing: 0.025em;
  text-indent: 2em;
}

.narrative-story-html--streaming :deep(.story-paragraph:last-child) {
  position: relative;
  text-shadow:
    0 0 10px rgba(184, 153, 71, 0.08),
    0 0 1px rgba(227, 216, 200, 0.28);
}

.narrative-story-html--streaming :deep(.story-paragraph:last-child::after) {
  content: '';
  display: inline-block;
  width: 0.62em;
  height: 1.35em;
  margin-left: 0.28em;
  vertical-align: -0.24em;
  background:
    linear-gradient(180deg, rgba(212, 175, 55, 0), rgba(212, 175, 55, 0.92) 38%, rgba(184, 153, 71, 0.36)),
    radial-gradient(circle at 50% 18%, rgba(255, 241, 194, 0.9), transparent 42%);
  clip-path: polygon(42% 0, 68% 0, 58% 72%, 100% 100%, 20% 82%);
  filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.45));
  animation: writingNib 0.95s ease-in-out infinite;
}

.narrative-story-html--streaming :deep(.story-paragraph:last-child::before) {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0.35em;
  width: 46%;
  max-width: 18rem;
  height: 1.8em;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(184, 153, 71, 0.12), transparent);
  mix-blend-mode: screen;
  transform: translateX(12%);
  animation: inkSweep 1.6s ease-in-out infinite;
}

.narrative-story-html :deep(.story-person),
.narrative-story-html :deep(.story-place),
.narrative-story-html :deep(.story-glossary-term) {
  border-bottom: 1px dashed #b89947;
  background: transparent;
  color: #b89947;
  cursor: help;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  transition: all 300ms cubic-bezier(0.25, 1, 0.5, 1);
}

.narrative-story-html :deep(.story-person:hover),
.narrative-story-html :deep(.story-place:hover),
.narrative-story-html :deep(.story-glossary-term:hover) {
  background:
    radial-gradient(circle at 12% 55%, rgba(205, 169, 105, 0.22) 0 1px, transparent 1.4px),
    radial-gradient(circle at 84% 36%, rgba(205, 169, 105, 0.18) 0 1px, transparent 1.4px),
    rgba(184, 153, 71, 0.14);
  background-size: 10px 10px, 13px 13px, auto;
  animation: glossaryDust 1.8s ease-in-out infinite;
}

.narrative-story-html :deep(.story-spacer) {
  height: 14px;
}

.narrative-stream-tail {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 14px;
  color: #b89947;
  font-size: 12px;
}

.narrative-stream-tail__cursor {
  display: inline-block;
  margin-left: 8px;
  color: #b89947;
  animation: tailPulse 1.2s ease-in-out infinite;
}

.narrative-entry + .narrative-entry {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(184, 153, 71, 0.08);
}

.narrative-entry__label {
  margin-bottom: 8px;
  color: #b89947;
  font-size: 12px;
  letter-spacing: 0.16em;
}

.narrative-entry__paragraph {
  margin: 0 0 24px;
  color: #e3d8c8;
  font-size: 18px;
  line-height: 2.2;
  letter-spacing: 0.025em;
  text-indent: 2em;
}

.narrative-entry__archive-title {
  margin: 0 0 4px;
  color: #e3d8c8;
  font-size: 18px;
}

.narrative-entry__archive-meta {
  margin: 0 0 10px;
  color: #8b8172;
  font-size: 12px;
}

@keyframes tailPulse {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}

@keyframes writingNib {
  0%, 100% {
    opacity: 0.35;
    transform: translateY(1px) rotate(-4deg) scaleY(0.92);
  }
  45% {
    opacity: 1;
    transform: translateY(-2px) rotate(2deg) scaleY(1.05);
  }
}

@keyframes inkSweep {
  0% {
    opacity: 0;
    transform: translateX(22%);
  }
  35% {
    opacity: 0.82;
  }
  100% {
    opacity: 0;
    transform: translateX(-8%);
  }
}

@keyframes narrativeParagraphReveal {
  from {
    opacity: 0;
    clip-path: inset(0 0 32% 0);
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    clip-path: inset(0 0 0 0);
    transform: translateY(0);
  }
}

@keyframes narrativeCardTrace {
  0% { background-position: -52% 0, 0 -68%; }
  100% { background-position: 152% 0, 0 168%; }
}

@keyframes glossaryDust {
  0%, 100% { background-position: 0 0, 8px 2px, 0 0; }
  50% { background-position: 7px -3px, 1px 5px, 0 0; }
}

@media (prefers-reduced-motion: reduce) {
  .narrative-story-html--streaming :deep(.story-paragraph:last-child::before),
  .narrative-story-html--streaming :deep(.story-paragraph:last-child::after),
  .narrative-stream-tail__cursor,
  .narrative-story-html:not(.narrative-story-html--streaming) :deep(.story-paragraph),
  .narrative-card:hover::after,
  .narrative-story-html :deep(.story-person:hover),
  .narrative-story-html :deep(.story-place:hover),
  .narrative-story-html :deep(.story-glossary-term:hover) {
    animation: none;
  }
}

@media (max-width: 860px) {
  .narrative-stele,
  .narrative-cards {
    grid-template-columns: 1fr;
  }

  .narrative-cards {
    display: grid;
  }

  .narrative-stele__divider {
    display: none;
  }

  .narrative-stele__block--right {
    text-align: left;
  }

  .narrative-stele__title {
    white-space: normal;
  }

  .narrative-log {
    padding-right: 14px;
    padding-left: 14px;
  }

  .narrative-archive-strip {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
    margin-right: 14px;
    margin-left: 14px;
  }

  .narrative-archive-strip p {
    max-width: none;
    text-align: left;
  }

  .narrative-log__scroll {
    max-width: none;
    padding-right: 10px;
    padding-left: 10px;
  }
}
</style>
