<template>
  <div>
    <label :for="name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
      <slot name="label"></slot>
      <span v-if="required" class="text-red-600">*</span>
    </label>
    <div class="flex space-x-2 items-start">
      <textarea
        :id="name"
        v-model="model"
        type="text"
        :rows
        :name
        class="disabled:bg-gray-200 dark:disabled:bg-gray-900 shadow-sm bg-white border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-1 focus:outline-none focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        :placeholder
        :disabled
        :required
      ></textarea>
      <div class="pt-2">
        <slot name="toolip"></slot>
      </div>
    </div>
    <p class="text-xs mt-2 text-red-600 dark:text-red-300">
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
