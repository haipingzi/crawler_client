<template>
  <el-input
    v-model="inputValue"
    :readonly="!isEditing"
    @dblclick="enableEditing"
    :class="{ 'filename-input': isEditing }"
    placeholder="请双击输入"
    @blur="disableEditing"
    v-bind="attrs"
  >
    <template #append>{{ props.ext }}</template>
  </el-input>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, useAttrs } from "vue";

const props = defineProps({
  value: {
    type: String,
  },
  ext: {
    type: String,
  },
});

const attrs = useAttrs();

const emit = defineEmits(["update:value", "rename"]);

const isEditing = ref(false);
const inputValue = ref(props.value);

watch(
  () => props.value,
  (newValue) => {
    inputValue.value = newValue;
  }
);

const enableEditing = () => {
  isEditing.value = true;
};

const disableEditing = () => {
  isEditing.value = false;
  emit("update:value", inputValue.value);
  emit("rename", inputValue.value);
};
</script>

<style scoped>
.filename-input {
  box-shadow: 0 0 0 2px #0f0 inset;
}
</style>
