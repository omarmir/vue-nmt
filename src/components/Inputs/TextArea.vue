<template>
  <div>
    <label :for="name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
      <slot name="label"></slot>
      <span v-if="required" class="text-red-600">*</span>
    </label>
    <textarea
      :id="name"
      v-model="model"
      type="text"
      :rows
      :name
      class="disabled:bg-gray-200 p-2.5 shadow-sm bg-white border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 block w-full"
      :placeholder
      :disabled
      :required
    ></textarea>
    <p class="text-xs mt-2 text-red-600">
      <slot name="errors"></slot>
    </p>
  </div>
</template>
<script setup lang="ts">
const {
  name,
  placeholder,
  required = false,
  disabled = undefined,
  value,
  rows = 4,
} = defineProps<{
  name: string
  placeholder?: string
  required?: boolean
  disabled?: boolean | undefined
  value?: string
  rows?: number
}>()

const model = defineModel<string>()
if (value) model.value = value
</script>
