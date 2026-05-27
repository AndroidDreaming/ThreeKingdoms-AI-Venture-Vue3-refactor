<template>
  <div class="ui-toast-stack" aria-live="polite">
    <transition-group name="ui-toast">
      <div
        v-for="item in items"
        :key="item.id"
        class="ui-toast"
        :class="`ui-toast--${item.type}`"
      >
        <strong>{{ item.type === 'error' ? '错误' : '提示' }}</strong>
        <span>{{ item.text }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script>
export default {
  name: 'UiToastStack',
  props: {
    items: {
      type: Array,
      default: () => []
    }
  }
};
</script>

<style scoped lang="less">
.ui-toast-stack {
  position: fixed;
  top: calc(18px + env(safe-area-inset-top, 0px));
  right: 18px;
  z-index: 4100;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(360px, calc(100vw - 32px));
}

.ui-toast {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px 14px;
  border-radius: 18px;
  border: 1px solid rgba(224, 189, 137, 0.18);
  background:
    linear-gradient(180deg, rgba(48, 33, 28, 0.96), rgba(18, 15, 15, 0.98));
  color: #f4eadb;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.2);
}

.ui-toast--error {
  border-color: rgba(213, 115, 93, 0.22);
  color: #ffd9ce;
}

.ui-toast strong {
  font-size: 12px;
  letter-spacing: 0.08em;
}

.ui-toast span {
  font-size: 13px;
  line-height: 1.65;
}

.ui-toast-enter-active,
.ui-toast-leave-active {
  transition: all .22s ease;
}

.ui-toast-enter-from,
.ui-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
