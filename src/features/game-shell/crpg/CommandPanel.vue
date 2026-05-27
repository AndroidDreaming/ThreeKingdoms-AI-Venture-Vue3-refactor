<template>
  <nav class="command-panel" aria-label="一级指令">
    <button
      v-for="group in groups"
      :key="group.key"
      type="button"
      class="command-seal"
      :class="{ 'command-seal--active': group.key === activeGroupKey }"
      :title="group.summary"
      @click="emit('group-toggle', group)"
    >
      <span class="command-seal__blood"></span>
      <span class="command-seal__icon" v-html="group.icon"></span>
      <span class="command-seal__label" aria-hidden="true">
        <span
          v-for="(char, index) in splitLabel(group.label)"
          :key="`${group.key}-label-${index}-${char}`"
        >
          {{ char }}
        </span>
      </span>
      <span class="command-seal__sr-label">{{ group.label }}</span>
      <span class="command-seal__count">{{ group.count }}</span>
    </button>
  </nav>
</template>

<script setup>
defineOptions({
  name: 'CommandPanel'
});

defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  groups: {
    type: Array,
    default: () => []
  },
  activeGroupKey: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['group-toggle', 'action-select']);

function splitLabel(label) {
  return Array.from(String(label || '').replace(/\s+/g, ''));
}
</script>

<style scoped lang="less">
.command-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  height: 100%;
  overflow: visible;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
}

.command-seal {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 84px;
  min-height: 108px;
  padding: 12px 8px;
  border: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background:
    linear-gradient(90deg, rgba(0, 0, 0, 0.28), transparent 18%, transparent 82%, rgba(255, 247, 229, 0.035)),
    repeating-linear-gradient(90deg, rgba(184, 153, 71, 0.055) 0, rgba(184, 153, 71, 0.055) 1px, transparent 1px, transparent 13px),
    linear-gradient(180deg, #1c1815, #12100e);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.15),
    inset 10px 0 18px rgba(0, 0, 0, 0.25),
    0 18px 36px rgba(0, 0, 0, 0.36);
  color: #e3d8c8;
  cursor: pointer;
  opacity: 0.6;
  transition: all 300ms cubic-bezier(0.25, 1, 0.5, 1);
}

.command-seal:hover {
  opacity: 0.86;
  transform: translateX(4px);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.26),
    0 22px 40px rgba(0, 0, 0, 0.42);
}

.command-seal:active {
  transform: translateX(4px) scale(0.98);
}

.command-seal--active {
  color: #b89947;
  opacity: 1;
  transform: translateX(8px);
}

.command-seal--active:hover {
  transform: translateX(8px);
}

.command-seal__blood {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: 3px;
  background: transparent;
  box-shadow: none;
}

.command-seal--active .command-seal__blood {
  background: #8c2626;
  box-shadow: 0 0 14px rgba(140, 38, 38, 0.85);
}

.command-seal__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
}

.command-seal__icon :deep(svg) {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.command-seal__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: inherit;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
}

.command-seal__label span + span {
  margin-top: 4px;
}

.command-seal__sr-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.command-seal__count {
  color: rgba(227, 216, 200, 0.56);
  font-size: 10px;
}

@media (max-width: 1080px) {
  .command-panel {
    flex-direction: row;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .command-seal {
    flex: 0 0 84px;
  }
}
</style>
