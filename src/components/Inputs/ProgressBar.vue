<template>
  <div class="w-full bg-gray-200 rounded-full h-2.5">
    <div
      class="bg-blue-600 h-2.5 rounded-full"
      :style="`width: ${progress - (release ? 0 : holdback)}%`"
    ></div>
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'

const { loaded, total, holdback, release } = defineProps<{
  loaded: number
  total: number
  holdback: number
  release: boolean
}>()
const progress = computed(() => (loaded / total) * 100)
</script>
