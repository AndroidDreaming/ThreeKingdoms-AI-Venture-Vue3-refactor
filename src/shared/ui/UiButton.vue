<template>
  <button
    :type="nativeType"
    class="ui-button"
    :class="[
      `ui-button--${variant}`,
      { 'is-loading': loading, 'is-block': block }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true"></span>
    <span class="ui-button__label"><slot /></span>
  </button>
</template>

<script>
export default {
  name: 'UiButton',
  props: {
    variant: {
      type: String,
      default: 'ghost'
    },
    nativeType: {
      type: String,
      default: 'button'
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    block: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click']
};
</script>

<style scoped lang="less">
.ui-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.08), rgba(255, 244, 227, 0.03)),
    rgba(255, 244, 227, 0.02);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.05),
    0 10px 22px rgba(0, 0, 0, 0.12);
  color: #f3e7d5;
  cursor: pointer;
  transition:
    transform .22s cubic-bezier(.22, 1, .36, 1),
    border-color .18s ease,
    box-shadow .22s ease,
    background .22s ease,
    opacity .18s ease;
}

.ui-button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(224, 189, 137, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.07),
    0 16px 28px rgba(0, 0, 0, 0.16);
}

.ui-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 10px rgba(0, 0, 0, 0.18),
    0 8px 18px rgba(0, 0, 0, 0.12);
}

.ui-button:disabled {
  opacity: .56;
  cursor: not-allowed;
}

.ui-button--primary {
  color: #231710;
  border-color: rgba(232, 196, 142, 0.22);
  background:
    linear-gradient(180deg, rgba(244, 216, 170, 0.98), rgba(203, 150, 88, 0.94)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0));
  box-shadow:
    inset 0 1px 0 rgba(255, 252, 246, 0.72),
    0 18px 30px rgba(109, 66, 28, 0.24);
}

.ui-button--warning {
  color: #fff3df;
  border-color: rgba(233, 170, 107, 0.24);
  background:
    linear-gradient(180deg, rgba(145, 76, 36, 0.95), rgba(102, 54, 31, 0.96)),
    rgba(102, 54, 31, 0.96);
}

.ui-button--ghost {
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.05), rgba(255, 244, 227, 0.02)),
    rgba(255, 244, 227, 0.015);
}

.ui-button--subtle {
  background: rgba(255, 244, 227, 0.04);
}

.ui-button--text {
  min-height: auto;
  padding: 4px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.ui-button--text:hover:not(:disabled) {
  transform: none;
  box-shadow: none;
}

.ui-button.is-block {
  display: flex;
  width: 100%;
}

.ui-button__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
  animation: ui-button-spin .72s linear infinite;
}

@keyframes ui-button-spin {
  to { transform: rotate(360deg); }
}
</style>
