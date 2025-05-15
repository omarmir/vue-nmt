<template>
  <div class="w-full bg-gray-200 rounded-full h-2.5">
    <div class="bg-blue-600 h-2.5 rounded-full" :style="`width: ${progress}%`"></div>
  </div>
</template>
<script lang="ts" setup>
import { computed } from 'vue'

const { loaded, total } = defineProps<{ loaded: number; total: number }>()
const progress = computed(() => (loaded / total) * 100)
</script>
