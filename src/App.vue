<template>
  <div class="flex flex-col max-w-6xl m-auto mt-10 gap-10 px-5">
    <header>
      <h1 class="text-2xl font-bold">Neural Machine Translation (NMT): English to French</h1>
    </header>
    <RouterView />
  </div>
</template>
<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>
