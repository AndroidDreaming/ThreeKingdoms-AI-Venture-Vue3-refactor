<template>
  <section class="character-sheet">
    <!-- 区域 C：角色档案与状态监控 -->
    <header class="character-sheet__head">
      <div class="character-sheet__kicker">角色档案</div>
      <h2 class="character-sheet__name">{{ name }}</h2>
      <div class="character-sheet__subtitle">{{ title }}</div>
      <div class="character-sheet__location">{{ location }}</div>
      <div class="character-sheet__tags">
        <span v-for="tag in tags" :key="tag">{{ tag }}</span>
      </div>
    </header>

    <section class="character-metrics">
      <article
        v-for="metric in metrics"
        :key="metric.key"
        class="metric-cell"
        :class="{ 'metric-cell--long': String(metric.value || '').length > 4 }"
      >
        <span class="metric-cell__icon" v-html="metric.icon"></span>
        <span class="metric-cell__content">
          <small>{{ metric.label }}</small>
          <strong>{{ metric.value }}</strong>
        </span>
      </article>
    </section>

    <section class="character-vitals">
      <header class="character-vitals__head">
        <div class="character-vitals__title">生存状态</div>
        <div class="character-vitals__note">低于二成会触发危急光效。</div>
      </header>

      <article
        v-for="vital in vitals"
        :key="vital.key"
        class="vital-row"
        :class="{
          'vital-row--critical': Number(vital.percent || 0) < 20,
          'vital-row--morale-low': isMoraleVital(vital) && Number(vital.percent || 0) < 36
        }"
      >
        <div class="vital-row__copy">
          <span>{{ vital.label }}</span>
          <strong>{{ vital.value }}</strong>
        </div>
        <div class="vital-row__bar">
          <div
            class="vital-row__fill"
            :class="{
              'vital-row__fill--danger': vital.tone === 'danger',
              'vital-row__fill--support': vital.tone === 'support'
            }"
            :style="{ width: `${vital.percent}%` }"
          ></div>
        </div>
        <small v-if="vital.meta" class="vital-row__meta">{{ vital.meta }}</small>
      </article>
    </section>
  </section>
</template>

<script setup>
defineOptions({
  name: 'CharacterSheet'
});

defineProps({
  name: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  tags: {
    type: Array,
    default: () => []
  },
  metrics: {
    type: Array,
    default: () => []
  },
  vitals: {
    type: Array,
    default: () => []
  }
});

function isMoraleVital(vital) {
  const key = String((vital && vital.key) || '').toLowerCase();
  const label = String((vital && vital.label) || '');
  return key.includes('morale') || label.includes('士气');
}
</script>

<style scoped lang="less">
.character-sheet {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding: 18px;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background:
    linear-gradient(145deg, rgba(255, 247, 229, 0.035), transparent 34%),
    linear-gradient(180deg, #1c1815, #13100e);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.1),
    0 8px 30px rgba(0, 0, 0, 0.8);
  color: #e3d8c8;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
}

.character-sheet::-webkit-scrollbar {
  width: 4px;
}

.character-sheet::-webkit-scrollbar-thumb {
  background: rgba(184, 153, 71, 0.48);
}

.character-sheet__kicker {
  color: #b89947;
  font-size: 11px;
  letter-spacing: 0.22em;
}

.character-sheet__name {
  margin: 8px 0 5px;
  color: #e3d8c8;
  font-size: 32px;
  line-height: 1.1;
  text-shadow: 0 3px 14px rgba(0, 0, 0, 0.82);
}

.character-sheet__subtitle,
.character-sheet__location {
  color: rgba(227, 216, 200, 0.78);
  font-size: 14px;
  line-height: 1.7;
}

.character-sheet__location {
  color: #8b8172;
}

.character-sheet__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-top: 12px;
  color: #9ca3af;
  font-size: 13px;
}

.character-sheet__tags span + span::before {
  content: ' / ';
  margin: 0 7px;
  color: rgba(184, 153, 71, 0.36);
}

.character-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background: #2a241e;
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.15),
    0 18px 34px rgba(0, 0, 0, 0.28);
}

.metric-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 70px;
  padding: 12px 10px;
  background:
    repeating-radial-gradient(circle at 18% 26%, rgba(255, 247, 229, 0.02) 0 1px, transparent 1px 5px),
    linear-gradient(145deg, rgba(255, 247, 229, 0.025), transparent 44%),
    #171412;
}

.metric-cell:nth-child(odd) {
  border-right: 1px solid #2a241e;
}

.metric-cell:nth-child(n + 3) {
  border-top: 1px solid #2a241e;
}

.metric-cell__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 38% 32%, rgba(255, 247, 229, 0.28), transparent 28%),
    linear-gradient(135deg, rgba(184, 153, 71, 0.24), rgba(85, 70, 48, 0.16));
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.26),
    inset 0 -5px 8px rgba(0, 0, 0, 0.42),
    0 6px 14px rgba(0, 0, 0, 0.24);
  color: #c9ad71;
}

.metric-cell__icon :deep(svg) {
  width: 17px;
  height: 17px;
  fill: currentColor;
}

.metric-cell__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  width: 100%;
}

.metric-cell small {
  display: block;
  color: #8a8377;
  font-family: Arial, "Helvetica Neue", sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-transform: uppercase;
}

.metric-cell strong {
  display: block;
  margin-top: 4px;
  max-width: 100%;
  overflow: hidden;
  color: #d4af37;
  font-size: clamp(18px, 2.2vw, 28px);
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
  line-height: 1.12;
  text-overflow: ellipsis;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  white-space: nowrap;
}

.metric-cell--long strong {
  font-size: 16px;
  line-height: 1.15;
  white-space: normal;
  word-break: break-word;
}

.character-vitals {
  padding: 16px;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background:
    linear-gradient(180deg, rgba(255, 247, 229, 0.025), rgba(255, 247, 229, 0.01)),
    #15120f;
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.1),
    0 8px 30px rgba(0, 0, 0, 0.32);
}

.character-vitals__title {
  color: #e3d8c8;
  font-size: 18px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.74);
}

.character-vitals__note {
  margin-top: 4px;
  color: #8b8172;
  font-size: 12px;
  line-height: 1.6;
}

.vital-row {
  position: relative;
  margin-top: 15px;
  padding: 8px;
  box-shadow: inset 0 0 0 1px transparent;
}

.vital-row--critical {
  box-shadow: inset 0 0 0 1px #8c2626, 0 0 18px rgba(140, 38, 38, 0.28);
  animation: criticalPulse 1.25s ease-in-out infinite;
}

.vital-row__copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #e3d8c8;
  font-size: 13px;
}

.vital-row__copy strong {
  color: #b89947;
  font-size: 14px;
}

.vital-row__bar {
  position: relative;
  height: 13px;
  overflow: hidden;
  padding: 2px;
  clip-path: polygon(8px 0, 100% 0, calc(100% - 7px) 100%, 0 100%);
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.96), rgba(30, 24, 18, 0.9)),
    #000;
  box-shadow:
    inset 0 0 0 1px rgba(117, 91, 55, 0.82),
    0 0 0 1px rgba(184, 153, 71, 0.08);
}

.vital-row__bar::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(184, 153, 71, 0.36), transparent 24%, transparent 76%, rgba(184, 153, 71, 0.26)),
    repeating-linear-gradient(90deg, transparent 0 14px, rgba(255, 247, 229, 0.055) 14px 15px);
  opacity: 0.5;
}

.vital-row__fill {
  height: 100%;
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
  background:
    repeating-linear-gradient(45deg, #b89947, #b89947 4px, #7a6027 4px, #7a6027 8px);
  box-shadow: 0 0 12px rgba(184, 153, 71, 0.24);
  transition: all 300ms cubic-bezier(0.25, 1, 0.5, 1);
  animation: vitalBreath 4.6s ease-in-out infinite;
}

.vital-row__fill--danger {
  background:
    repeating-linear-gradient(45deg, #8c2626, #8c2626 4px, #5e1818 4px, #5e1818 8px);
  box-shadow: 0 0 12px rgba(140, 38, 38, 0.34);
}

.vital-row__fill--support {
  background:
    repeating-linear-gradient(45deg, #486b55, #486b55 4px, #2f4638 4px, #2f4638 8px);
  box-shadow: 0 0 12px rgba(72, 107, 85, 0.28);
}

.vital-row--morale-low .vital-row__fill {
  animation: vitalBreath 4.6s ease-in-out infinite, moraleLowFlicker 3.2s ease-in-out infinite;
}

.vital-row__meta {
  display: block;
  margin-top: 7px;
  color: #8b8172;
  font-size: 11px;
  line-height: 1.55;
}

@keyframes criticalPulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.16); }
}

@keyframes vitalBreath {
  0%, 100% {
    filter: brightness(0.96) saturate(0.94);
    transform: scaleY(0.92);
  }
  50% {
    filter: brightness(1.08) saturate(1.04);
    transform: scaleY(1);
  }
}

@keyframes moraleLowFlicker {
  0%, 100% { opacity: 0.72; }
  47% { opacity: 0.92; }
  51% { opacity: 0.58; }
  56% { opacity: 0.88; }
}

@media (prefers-reduced-motion: reduce) {
  .vital-row--critical,
  .vital-row__fill,
  .vital-row--morale-low .vital-row__fill {
    animation: none;
  }
}

@media (max-width: 1080px) {
  .character-sheet {
    height: auto;
  }

  .metric-cell strong {
    font-size: 22px;
  }

  .metric-cell--long strong {
    font-size: 15px;
  }
}
</style>
