<template>
  <div class="flex flex-col gap-2">
    <label :id="`${name}-label`" :for="name" class="font-medium text-gray-900">
      {{ label }}
    </label>
    <input
      :id="name"
      accept=".pptx,.docx"
      type="file"
      :name
      :placeholder="helpText"
      :required
      :aria-describedby="`${name}-help`"
      :aria-labelledby="`${name}-label`"
      class="file:cursor-pointer hover:file:text-blue-500 block hover:file:bg-blue-200 rounded-md w-full border border-blue-700 file:text-blue-700 text-sm shadow-sm file:me-4 file:border-0 file:bg-blue-100 file:px-4 file:py-2.5 focus:z-10 focus:border-blue-500 focus:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
      @change="onFileChange"
    />
  </div>
</template>
<script setup lang="ts">
const model = defineModel<File | null>({ required: true })
const {
  helpText,
  name,
  label,
  required = false,
} = defineProps<{
  helpText: string
  name: string
  label: string
  required?: boolean
}>()

const onFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) model.value = file
}
</script>
