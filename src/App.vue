<template>
  <div class="flex flex-col max-w-6xl m-auto mt-10 gap-10 px-5">
    <header>
      <h1 class="text-2xl font-bold">Neural Machine Translation (NMT): English to French</h1>
      <small>
        All data (text or files) remain on your computer. This is a client side application.
        <br />
        Created by
        <a
          target="_blank"
          href="https://github.com/omarmir/"
          class="text-blue-500 hover:underline hover:text-blue-700"
          >Omar Mir</a
        >
      </small>
    </header>
    <RouterView />
  </div>
</template>
<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>
