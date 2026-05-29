<template>
  <div class="flex flex-col max-w-6xl m-auto mt-10 gap-10 px-5 pb-16">
    <header class="flex flex-col gap-4 border-b border-gray-200 pb-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 class="text-2xl font-bold">{{ t.appTitle }}</h1>
          <p class="mt-2 max-w-3xl text-sm text-gray-700">{{ t.appSubtitle }}</p>
          <p class="text-sm text-gray-600">{{ t.privacy }}</p>
        </div>
        <RouterLink
          class="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
          :to="{ name: route.name === 'glossary' ? 'glossary' : 'home', params: { locale: otherLocale } }"
        >
          {{ t.language }}
        </RouterLink>
      </div>
      <nav class="flex gap-4 text-sm font-medium">
        <RouterLink class="text-blue-700 hover:underline" :to="{ name: 'home', params: { locale } }">
          {{ t.workspace }}
        </RouterLink>
        <RouterLink class="text-blue-700 hover:underline" :to="{ name: 'glossary', params: { locale } }">
          {{ t.glossary }}
        </RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { messages, normalizeLocale } from '@/utils/i18n'

const route = useRoute()
const locale = computed(() => normalizeLocale(route.params.locale))
const otherLocale = computed(() => (locale.value === 'fr' ? 'en' : 'fr'))
const t = computed(() => messages[locale.value])
</script>
