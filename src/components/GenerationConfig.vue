<template>
  <div class="w-full">
    <div class="mx-auto w-full rounded-2xl bg-white">
      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="flex cursor-pointer w-full justify-between rounded-lg bg-purple-100 px-4 py-2 text-left text-sm font-medium text-purple-900 hover:bg-purple-200 focus:outline-none focus-visible:ring focus-visible:ring-purple-500/75"
        >
          <span>Advanced Parameters</span>
          <div :class="open ? 'rotate-180 transform' : ''" class="h-5 w-5 text-purple-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="m6 15l6-6l6 6"
              />
            </svg>
          </div>
        </DisclosureButton>
        <DisclosurePanel class="px-4 pb-2 pt-4 text-sm">
          <div class="flex flex-col gap-4">
            <div>
              Modifying advanced settings can significantly impact the performance, stability, or
              security of the system. These options are intended for experienced users.
            </div>
            <RangeSlider name="tokens" :max="maxLength" :step="1" v-model="marianGen.max_length">
              Maximum Length
            </RangeSlider>
            <RangeSlider name="beams" :max="10" :step="1" v-model="marianGen.num_beams">
              Beams
            </RangeSlider>
            <RangeSlider name="threads" :max="maxThreads" :step="1" v-model="threads">
              Threads
            </RangeSlider>
            <div class="grid grid-cols-12">
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 col-span-4"
                >Early stop</span
              >
              <label class="inline-flex items-center cursor-pointer col-span-8 place-content-end">
                <input type="checkbox" v-model="marianGen.early_stopping" class="sr-only peer" />
                <div
                  class="relative w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600"
                ></div>
              </label>
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>
  </div>
</template>
<script lang="ts" setup>
import type { MarianGeneration } from '@/types/Transformers'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import RangeSlider from './Inputs/RangeSlider.vue'
const marianGen = defineModel<MarianGeneration>({
  required: true,
})

const threads = defineModel<number>('threads', { required: true })

const maxThreads = threads.value
const maxLength = marianGen.value.max_length
</script>
