<template>
  <div class="w-full">
    <div class="mx-auto w-full rounded-2xl bg-white">
      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="flex cursor-pointer w-full justify-between rounded-lg bg-purple-100 px-4 py-2 text-left text-sm font-medium text-purple-900 hover:bg-purple-200 focus:outline-none focus-visible:ring focus-visible:ring-purple-500/75"
        >
          <span>{{ t.advancedParameters }}</span>
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
              Modifying advanced settings can significantly impact performance and stability.
            </div>
            <RangeSlider name="tokens" :max="512" :step="1" v-model="store.state.max_length">
              {{ t.maxLength }}
            </RangeSlider>
            <RangeSlider name="beams" :max="10" :step="1" v-model="store.state.num_beams">
              {{ t.beams }}
            </RangeSlider>
            <RangeSlider name="threads" :max="maxThreads" :step="1" v-model="store.state.threads">
              {{ t.threads }}
            </RangeSlider>
            <div class="grid grid-cols-12">
              <span class="text-sm font-medium text-gray-900 col-span-4">{{ t.earlyStop }}</span>
              <label class="inline-flex items-center cursor-pointer col-span-8 place-content-end">
                <input type="checkbox" v-model="store.state.early_stopping" class="sr-only peer" />
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
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import RangeSlider from './Inputs/RangeSlider.vue'
import { useTranslatorStore } from '@/stores/translator'
import { computed } from 'vue'
import { messages } from '@/utils/i18n'
import type { LocaleCode } from '@/types/translation'

const props = withDefaults(
  defineProps<{
    locale?: LocaleCode
  }>(),
  { locale: 'en' },
)

const store = useTranslatorStore()
const maxThreads = navigator.hardwareConcurrency ?? 1
const t = computed(() => messages[props.locale])
</script>
