<template>
  <header class="crpg-topbar">
    <div class="crpg-topbar__center">
      <span class="crpg-topbar__chapter">{{ chapterLabel }}</span>
      <strong class="crpg-topbar__title">{{ title }} - {{ timeLabel }}</strong>
      <span v-if="turnLabel" class="crpg-topbar__turn">{{ turnLabel }}</span>
    </div>

    <div class="crpg-topbar__system">
      <button
        v-if="supportEntry"
        type="button"
        class="support-quick"
        :class="{ 'support-quick--pulse': supportEntry.pulse }"
        @click="onSystemAction(supportEntry)"
      >
        <span class="support-quick__glow" aria-hidden="true"></span>
        <span class="support-quick__copy">
          <small>{{ supportEntry.title || '残茶一盏' }}</small>
          <strong>{{ supportEntry.label || '请说书人饮茶' }}</strong>
        </span>
        <span class="support-quick__hint">{{ supportEntry.hint || supportEntry.value || '茶案已备' }}</span>
      </button>

      <button
        type="button"
        class="system-toggle"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        aria-label="系统菜单"
        @click="menuOpen = !menuOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 2h2l.55 2.32a8.33 8.33 0 0 1 2.15.89l2.05-1.2 1.42 1.42-1.2 2.05c.38.67.68 1.4.89 2.15L22 11v2l-2.32.55a8.33 8.33 0 0 1-.89 2.15l1.2 2.05-1.42 1.42-2.05-1.2a8.33 8.33 0 0 1-2.15.89L13 22h-2l-.55-2.32a8.33 8.33 0 0 1-2.15-.89l-2.05 1.2-1.42-1.42 1.2-2.05a8.33 8.33 0 0 1-.89-2.15L2 13v-2l2.32-.55c.21-.75.51-1.48.89-2.15l-1.2-2.05 1.42-1.42 2.05 1.2a8.33 8.33 0 0 1 2.15-.89L11 2Z" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      </button>

      <transition name="menu-fade">
        <div v-if="menuOpen" class="system-menu">
          <button
            v-for="item in systemItems"
            :key="item.key"
            type="button"
            class="system-menu__item"
            @click="onSystemAction(item)"
          >
            <span class="system-menu__label">{{ item.label }}</span>
            <small v-if="item.value" class="system-menu__value">{{ item.value }}</small>
          </button>
        </div>
      </transition>
    </div>
  </header>
</template>

<script setup>
import { ref } from 'vue';

defineOptions({
  name: 'TopHeader'
});

defineProps({
  title: {
    type: String,
    default: ''
  },
  chapterLabel: {
    type: String,
    default: ''
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
  }
});

const emit = defineEmits(['system-action']);

const menuOpen = ref(false);

function onSystemAction(item) {
  emit('system-action', item);
  menuOpen.value = false;
}
</script>

<style scoped lang="less">
.crpg-topbar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 64px;
  min-height: 64px;
  padding: 0 18px;
  background:
    linear-gradient(180deg, rgba(28, 24, 21, 0.94), rgba(12, 10, 9, 0.92)),
    linear-gradient(90deg, transparent, rgba(184, 153, 71, 0.08), transparent);
  box-shadow:
    inset 0 -1px 0 rgba(184, 153, 71, 0.15),
    0 16px 34px rgba(0, 0, 0, 0.34);
  color: #e3d8c8;
  font-family: "Noto Serif SC", "Songti SC", SimSun, serif;
}

.crpg-topbar::after {
  content: '';
  position: absolute;
  right: 18px;
  bottom: 8px;
  left: 18px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(184, 153, 71, 0.34), transparent);
}

.crpg-topbar__center {
  min-width: 0;
  text-align: center;
}

.crpg-topbar__chapter {
  display: block;
  color: #b89947;
  font-size: 11px;
  letter-spacing: 0.24em;
}

.crpg-topbar__title {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: #e3d8c8;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.78);
  white-space: nowrap;
}

.crpg-topbar__turn {
  color: rgba(227, 216, 200, 0.62);
  font-size: 12px;
}

.crpg-topbar__system {
  position: absolute;
  top: 10px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.support-quick {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    "glow copy"
    "glow hint";
  align-items: center;
  column-gap: 9px;
  min-width: 178px;
  min-height: 42px;
  padding: 7px 11px 7px 9px;
  border: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background:
    repeating-radial-gradient(circle at 18% 26%, rgba(255, 247, 229, 0.018) 0 1px, transparent 1px 5px),
    linear-gradient(135deg, rgba(140, 38, 38, 0.16), rgba(184, 153, 71, 0.12) 58%),
    linear-gradient(180deg, rgba(31, 25, 19, 0.96), rgba(18, 16, 14, 0.96));
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.2),
    0 14px 28px rgba(0, 0, 0, 0.28);
  color: #ead9bd;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: transform 220ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 220ms cubic-bezier(0.25, 1, 0.5, 1), filter 220ms ease;
}

.support-quick:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
  box-shadow:
    inset 0 0 0 1px rgba(205, 169, 105, 0.38),
    0 18px 34px rgba(0, 0, 0, 0.36),
    0 0 22px rgba(184, 153, 71, 0.08);
}

.support-quick:active {
  transform: scale(0.98);
}

.support-quick__glow {
  grid-area: glow;
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 42% 36%, rgba(255, 247, 229, 0.88) 0 2px, transparent 4px),
    radial-gradient(circle, #c9a76b, #6f4d2c 70%);
  box-shadow:
    inset 0 1px 0 rgba(255, 247, 229, .42),
    0 0 0 5px rgba(184, 153, 71, 0.08),
    0 0 18px rgba(184, 153, 71, 0.14);
}

.support-quick__glow::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  border: 1px solid rgba(205, 169, 105, 0.32);
  opacity: 0;
}

.support-quick--pulse .support-quick__glow::after {
  animation: supportQuickPulse 2.3s ease-out infinite;
}

.support-quick__copy {
  grid-area: copy;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.support-quick__copy small {
  color: rgba(226, 207, 171, 0.7);
  font-size: 10px;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.support-quick__copy strong {
  overflow: hidden;
  color: #f0dfbf;
  font-size: 13px;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.support-quick__hint {
  grid-area: hint;
  color: rgba(226, 207, 171, 0.62);
  font-size: 11px;
  line-height: 1.25;
}

.system-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background:
    linear-gradient(135deg, rgba(184, 153, 71, 0.16), transparent 48%),
    linear-gradient(180deg, #1c1815, #11100e);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.2),
    0 12px 24px rgba(0, 0, 0, 0.26);
  color: #b89947;
  cursor: pointer;
  transition: all 300ms cubic-bezier(0.25, 1, 0.5, 1);
}

.system-toggle:hover {
  transform: translateY(-1px);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.36),
    0 16px 30px rgba(0, 0, 0, 0.34);
}

.system-toggle:active {
  transform: scale(0.98);
}

.system-toggle svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.system-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 10px);
  right: 0;
  width: 250px;
  padding: 8px;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  background: linear-gradient(180deg, #1c1815, #100e0c);
  box-shadow:
    inset 0 0 0 1px rgba(184, 153, 71, 0.18),
    0 24px 44px rgba(0, 0, 0, 0.46);
}

.system-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: #e3d8c8;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all 300ms cubic-bezier(0.25, 1, 0.5, 1);
}

.system-menu__item:hover {
  transform: translateX(2px);
  background: rgba(184, 153, 71, 0.08);
  color: #b89947;
}

.system-menu__item:active {
  transform: scale(0.98);
}

.system-menu__label {
  font-size: 14px;
}

.system-menu__value {
  color: #8b8172;
  font-size: 11px;
  text-align: right;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 200ms cubic-bezier(0.25, 1, 0.5, 1), transform 200ms cubic-bezier(0.25, 1, 0.5, 1);
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes supportQuickPulse {
  0% {
    transform: scale(0.82);
    opacity: 0.72;
  }
  78% {
    transform: scale(1.42);
    opacity: 0;
  }
  100% {
    transform: scale(1.42);
    opacity: 0;
  }
}

@media (max-width: 900px) {
  .support-quick {
    min-width: 44px;
    width: 44px;
    padding: 0;
    grid-template-columns: 1fr;
    grid-template-areas: "glow";
    place-items: center;
  }

  .support-quick__copy,
  .support-quick__hint {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .support-quick--pulse .support-quick__glow::after {
    animation: none;
  }
}
</style>
