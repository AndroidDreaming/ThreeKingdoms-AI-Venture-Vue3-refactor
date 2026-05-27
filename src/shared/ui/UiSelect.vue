<template>
  <div class="ui-select" :class="{ 'is-disabled': disabled }">
    <span v-if="prefixLabel" class="ui-select__prefix">{{ prefixLabel }}</span>
    <select
      class="ui-select__native"
      :disabled="disabled"
      :value="normalizedValue"
      @change="onChange"
    >
      <option value="">{{ placeholder || '请选择' }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <button
      v-if="clearable && normalizedValue"
      type="button"
      class="ui-select__clear"
      :disabled="disabled"
      @click="clear"
    >
      清空
    </button>
  </div>
</template>

<script>
export default {
  name: 'UiSelect',
  props: {
    modelValue: {
      type: [String, Number],
      default: ''
    },
    options: {
      type: Array,
      default: () => []
    },
    disabled: {
      type: Boolean,
      default: false
    },
    clearable: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: ''
    },
    prefixLabel: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'change'],
  computed: {
    normalizedValue() {
      return this.modelValue === null || this.modelValue === undefined ? '' : this.modelValue;
    }
  },
  methods: {
    onChange(event) {
      const value = event.target.value || '';
      this.$emit('update:modelValue', value);
      this.$emit('change', value);
    },
    clear() {
      this.$emit('update:modelValue', '');
      this.$emit('change', '');
    }
  }
};
</script>

<style scoped lang="less">
.ui-select {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.07), rgba(255, 244, 227, 0.03)),
    rgba(37, 28, 24, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.04),
    0 10px 22px rgba(0, 0, 0, 0.1);
}

.ui-select__prefix {
  color: #cdb393;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.ui-select__native {
  flex: 1 1 auto;
  width: 100%;
  min-height: 42px;
  border: 0;
  outline: none;
  background: transparent;
  color: #f4eadb;
  font-size: 15px;
  appearance: none;
}

.ui-select__native option {
  color: #201814;
}

.ui-select__clear {
  border: 0;
  background: transparent;
  color: #cdb393;
  cursor: pointer;
  font-size: 12px;
}

.ui-select.is-disabled {
  opacity: .58;
}
</style>
