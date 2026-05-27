<template>
  <textarea
    class="ui-textarea"
    :value="modelValue"
    :rows="rows"
    :disabled="disabled"
    :placeholder="placeholder"
    @input="$emit('update:modelValue', $event.target.value)"
    @keydown.enter.exact="$emit('enter', $event)"
  ></textarea>
</template>

<script>
export default {
  name: 'UiTextarea',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    rows: {
      type: Number,
      default: 3
    },
    disabled: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'enter']
};
</script>

<style scoped lang="less">
.ui-textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(224, 189, 137, 0.14);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 244, 227, 0.07), rgba(255, 244, 227, 0.03)),
    rgba(37, 28, 24, 0.92);
  box-shadow:
    inset 0 1px 0 rgba(255, 244, 227, 0.04),
    0 10px 22px rgba(0, 0, 0, 0.1);
  color: #f4eadb;
  font-size: 16px;
  line-height: 1.7;
  resize: vertical;
  outline: none;
}
</style>
