<template>
  <button
    :disabled
    :class="theme"
    class="disabled:cursor-not-allowed focus:ring-4 font-medium rounded-lg text-sm px-5 py-2.5 text-center cursor-pointer"
    :type="isSubmit ? 'submit' : 'button'"
  >
    <slot></slot>
  </button>
</template>
<script setup lang="ts">
const { isSubmit = false, theme = 'primary' } = defineProps<{
  isSubmit?: boolean
  disabled?: boolean | undefined
  theme?: 'primary' | 'danger' | 'warning' | 'success'
}>()
</script>
<style lang="css" scoped>
@reference '../../assets/main.css';

button.primary {
  @apply text-white disabled:bg-blue-400 disabled:dark:bg-blue-500 bg-blue-700 hover:bg-blue-800 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800;
}
button.danger {
  @apply bg-red-600 text-white hover:bg-red-700 focus:ring-4 focus:ring-red-300 disabled:bg-red-400 disabled:dark:bg-red-500 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-800;
}
button.warning {
  @apply bg-amber-600 text-white hover:bg-amber-700 focus:ring-4 focus:ring-amber-300 disabled:bg-amber-400 disabled:dark:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-700 dark:focus:ring-amber-800;
}
button.success {
  @apply text-white disabled:bg-emerald-400 disabled:dark:bg-emerald-500 bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-300 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-800;
}
</style>
