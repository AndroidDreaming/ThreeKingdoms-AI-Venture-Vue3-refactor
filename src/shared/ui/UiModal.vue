<template>
  <teleport to="body">
    <transition name="ui-modal-fade">
      <div v-if="modelValue" class="ui-modal" @click.self="close">
        <div class="ui-modal__panel" :style="panelStyle" role="dialog" aria-modal="true">
          <div class="ui-modal__head">
            <div class="ui-modal__title">{{ title }}</div>
            <button type="button" class="ui-modal__close" aria-label="关闭" @click="close">×</button>
          </div>
          <div class="ui-modal__body">
            <slot />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script>
export default {
  name: 'UiModal',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: ''
    },
    width: {
      type: String,
      default: '520px'
    }
  },
  emits: ['update:modelValue'],
  computed: {
    panelStyle() {
      return { maxWidth: this.width };
    }
  },
  methods: {
    close() {
      this.$emit('update:modelValue', false);
    },
    handleEscape(event) {
      if (event.key === 'Escape' && this.modelValue) this.close();
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape);
  }
};
</script>

<style scoped lang="less">
.ui-modal {
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(8, 7, 7, 0.62);
  backdrop-filter: blur(12px);
}

.ui-modal__panel {
  width: 100%;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(224, 189, 137, 0.14);
  background: linear-gradient(180deg, rgba(33, 25, 22, 0.98), rgba(18, 15, 15, 0.98));
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.26);
}

.ui-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid rgba(224, 189, 137, 0.12);
}

.ui-modal__title {
  color: #fff0dc;
  letter-spacing: 0.08em;
}

.ui-modal__close {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 244, 227, 0.06);
  color: #c9ae87;
  font-size: 18px;
  cursor: pointer;
}

.ui-modal__body {
  padding: 16px 20px 20px;
  color: #e5d1b2;
}

.ui-modal-fade-enter-active,
.ui-modal-fade-leave-active {
  transition: opacity .2s ease;
}

.ui-modal-fade-enter-from,
.ui-modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .ui-modal__head {
    padding: 16px 16px 10px;
  }

  .ui-modal__body {
    padding: 12px 16px 18px;
  }
}
</style>
