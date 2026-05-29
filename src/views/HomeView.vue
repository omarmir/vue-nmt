<template>
  <main class="flex flex-col gap-6">
    <section class="grid gap-4 rounded-md border border-gray-200 p-4 md:grid-cols-2">
      <div>
        <h2 class="text-lg font-semibold">{{ t.model }}</h2>
        <p class="text-sm text-gray-700">
          <span v-if="!store.isLoaded">{{ t.modelLoading }}</span>
          <span v-else>{{ t.modelReady }}</span>
        </p>
        <ProgressBar
          class="mt-3"
          :loaded="store.loaded"
          :total="store.total"
          :holdback="10"
          :release="store.isLoaded"
        />
      </div>

      <div class="grid gap-3">
        <label class="grid gap-1 text-sm font-medium text-gray-900">
          {{ t.direction }}
          <select
            class="rounded-md border border-gray-300 bg-white p-2 text-sm"
            :value="store.direction"
            @change="changeDirection"
          >
            <option value="en-fr">{{ directionLabel('en-fr', locale) }}</option>
            <option value="fr-en">{{ directionLabel('fr-en', locale) }}</option>
          </select>
        </label>

        <label class="grid gap-1 text-sm font-medium text-gray-900">
          {{ t.glossarySet }}
          <select
            class="rounded-md border border-gray-300 bg-white p-2 text-sm"
            :value="store.selectedGlossarySetId"
            @change="changeGlossary"
          >
            <option value="">{{ t.noGlossary }}</option>
            <option v-for="set in store.glossarySets" :key="set.id" :value="set.id">
              {{ set.name }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <section class="rounded-md border border-gray-200 p-4">
      <h2 class="text-lg font-semibold">{{ t.progress }}</h2>
      <p class="text-sm text-gray-700">
        <span v-if="store.statusMessage" class="text-red-700">{{ store.statusMessage }}</span>
        <span v-else-if="store.isTranslating">{{ t.translating }}</span>
        <span v-else-if="store.currentTranslation">{{ t.complete }}</span>
        <span v-else>{{ t.chooseWorkflow }}</span>
      </p>
      <ProgressBar
        class="mt-3"
        :total="Math.max(store.totalSegments, 1)"
        :loaded="store.completedCount"
        :holdback="0"
        :release="!store.isTranslating"
      />
      <div class="mt-4 grid gap-3 sm:grid-cols-4">
        <article class="rounded-md bg-gray-50 p-3">
          <span class="text-xs text-gray-600">{{ t.segments }}</span>
          <strong class="block text-lg">{{ store.totalSegments }}</strong>
        </article>
        <article class="rounded-md bg-gray-50 p-3">
          <span class="text-xs text-gray-600">{{ t.translated }}</span>
          <strong class="block text-lg">{{ store.completedCount }}</strong>
        </article>
        <article class="rounded-md bg-gray-50 p-3">
          <span class="text-xs text-gray-600">{{ t.workers }}</span>
          <strong class="block text-lg">{{ store.activeWorkerCount }}</strong>
        </article>
        <article class="rounded-md bg-gray-50 p-3">
          <span class="text-xs text-gray-600">{{ t.elapsed }}</span>
          <strong class="block text-lg">{{ (store.executionTime / 1000).toFixed(1) }}s</strong>
        </article>
      </div>
    </section>

    <TabGroup>
      <TabList class="flex space-x-1 rounded-md bg-blue-100 p-1">
        <Tab as="template" v-slot="{ selected }" class="cursor-pointer">
          <button
            :class="[
              'w-full rounded-sm py-2.5 text-sm font-medium leading-5',
              'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
              selected
                ? 'bg-white text-blue-700 shadow'
                : 'text-blue-800 hover:bg-white/[0.12] hover:text-blue-500',
            ]"
          >
            {{ t.textWorkflow }}
          </button>
        </Tab>
        <Tab as="template" v-slot="{ selected }" class="cursor-pointer">
          <button
            :class="[
              'w-full rounded-sm py-2.5 text-sm font-medium leading-5',
              'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
              selected
                ? 'bg-white text-blue-700 shadow'
                : 'text-blue-800 hover:bg-white/[0.12] hover:text-blue-500',
            ]"
          >
            {{ t.docWorkflow }}
          </button>
        </Tab>
      </TabList>

      <TabPanels class="mt-2">
        <TabPanel :unmount="false">
          <TextTranslate :locale="locale" />
        </TabPanel>
        <TabPanel :unmount="false">
          <FileTranslate :locale="locale" />
        </TabPanel>
      </TabPanels>
    </TabGroup>
  </main>
</template>
<script setup lang="ts">
import TextTranslate from '@/components/TextTranslate.vue'
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
import ProgressBar from '@/components/Inputs/ProgressBar.vue'
import { useTranslatorStore } from '@/stores/translator'
import FileTranslate from '@/components/FileTranslate.vue'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { directionLabel, messages, normalizeLocale } from '@/utils/i18n'
import type { TranslationDirection } from '@/types/translation'

const route = useRoute()
const locale = computed(() => normalizeLocale(route.params.locale))
const t = computed(() => messages[locale.value])
const store = useTranslatorStore()

const changeDirection = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as TranslationDirection
  store.setDirection(value)
}

const changeGlossary = (event: Event) => {
  store.setSelectedGlossary((event.target as HTMLSelectElement).value)
}

onMounted(() => {
  store.refreshGlossarySets()
})
</script>
