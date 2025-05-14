<template>
  <main>
    cores: {{ cores }}
    <div class="w-full">
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
              Translate Text
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
              Translate Document
            </button>
          </Tab>
        </TabList>

        <TabPanels class="mt-2">
          <TabPanel
            :class="[
              'rounded-xl bg-white p-3',
              'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
            ]"
          >
            <TextTranslate></TextTranslate>
          </TabPanel>
          <TabPanel
            :class="[
              'rounded-xl bg-white p-3',
              'ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
            ]"
          >
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  </main>
</template>
<script setup lang="ts">
import TextTranslate from '@/components/TextTranslate.vue'
import { useTranslator } from '@/composables/useTranslator'
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
const { cores, download } = useTranslator()
download()
</script>
