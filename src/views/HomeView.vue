<template>
  <main>
    <div class="pb-4">
      <div class="text-blue-500 font-bold">
        <span v-if="!store.isLoaded">Loading Model...</span>
        <span v-else>Model Loaded</span>
      </div>
      <ProgressBar
        :loaded="store.loaded"
        :total="store.total"
        :holdback="10"
        :release="store.isLoaded"
      ></ProgressBar>
    </div>
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
          <TabPanel>
            <TextTranslate></TextTranslate>
          </TabPanel>
          <TabPanel>
            <FileTranslate></FileTranslate>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  </main>
</template>
<script setup lang="ts">
import TextTranslate from '@/components/TextTranslate.vue'
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue'
import ProgressBar from '@/components/Inputs/ProgressBar.vue'
import { useTranslatorStore } from '@/stores/translator'
import FileTranslate from '@/components/FileTranslate.vue'

const store = useTranslatorStore()
</script>
