<template>
  <div class="grid grid-cols-12 items-center">
    <label for="default-range" class="block col-span-4 text-sm font-medium text-gray-900">
      <slot></slot>
      ({{ model }})
    </label>
    <input
      :id="name"
      type="range"
      :disabled
      v-model.number="model"
      :min
      :max
      :step
      class="w-full h-2 col-span-8 bg-gray-200 rounded-lg appearance-none cursor-pointer"
    />
  </div>
</template>
<script setup lang="ts">
const {
  name,
  disabled = undefined,
  value,
  min = 1,
  max,
  step,
} = defineProps<{
  name: string
  disabled?: boolean | undefined
  value?: number
  min?: number
  max: number
  step: number
}>()

const model = defineModel<number>()
if (value) model.value = value
</script>
