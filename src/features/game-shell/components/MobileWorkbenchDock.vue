<template>
  <nav class="mobile-bottom-dock mobile-bottom-dock--refined" aria-label="移动端工作区切换">
    <button
      v-for="item in items"
      :key="`dock-${item.key}`"
      type="button"
      class="mobile-bottom-dock__item"
      :class="{ active: activeKey === item.key }"
      @click="onSelect(item.key)"
    >
      <span class="mobile-bottom-dock__icon" v-html="item.icon"></span>
      <span class="mobile-bottom-dock__label">{{ item.label }}</span>
      <small>{{ item.note }}</small>
    </button>
  </nav>
</template>

<script>
export default {
  name: 'MobileWorkbenchDock',
  props: {
    activeKey: {
      type: String,
      default: ''
    },
    items: {
      type: Array,
      default: () => []
    },
    onSelect: {
      type: Function,
      required: true
    }
  }
};
</script>

<style scoped lang="less">
.mobile-bottom-dock {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 80;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-height: calc(64px + env(safe-area-inset-bottom, 0px));
  padding: 8px max(10px, env(safe-area-inset-right, 0px)) calc(8px + env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-left, 0px));
  border-radius: 18px 18px 0 0;
}

.mobile-bottom-dock--refined {
  background:
    linear-gradient(180deg, rgba(31, 24, 19, 0.94), rgba(14, 11, 10, 0.98)),
    rgba(14, 11, 10, 0.98);
  border: 1px solid rgba(214, 174, 116, 0.22);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.42),
    inset 0 1px 0 rgba(255, 244, 227, 0.08);
  backdrop-filter: blur(18px);
}

.mobile-bottom-dock__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  min-height: 52px;
  padding: 6px 4px 5px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: rgba(235, 217, 189, 0.72);
  font: inherit;
  cursor: pointer;
  transition: transform .16s ease, background .18s ease, color .18s ease, border-color .18s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-bottom-dock__item:active {
  transform: scale(.96);
  background: rgba(255, 239, 205, 0.08);
}

.mobile-bottom-dock__item.active {
  color: #fff3dd;
  border-color: rgba(214, 174, 116, 0.28);
  background:
    linear-gradient(180deg, rgba(142, 43, 35, 0.36), rgba(95, 33, 30, 0.18)),
    rgba(255, 239, 205, 0.08);
}

.mobile-bottom-dock__icon {
  width: 25px;
  height: 25px;
  color: currentColor;
}

.mobile-bottom-dock__icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.mobile-bottom-dock__label {
  margin-left: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.mobile-bottom-dock__item small {
  display: none;
}
</style>
