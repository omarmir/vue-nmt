<template>
  <div class="flex flex-col w-full gap-4">
    <TextArea
      name="english"
      placeholder="Type in your english content here"
      v-model="english"
      :rows="12"
    >
      <template #label> English </template>
    </TextArea>
    <PrimaryButton
      class="w-full"
      @click="store.translate(english)"
      :disabled="store.isTranslating || !store.isLoaded"
    >
      Translate
    </PrimaryButton>
    <GenerationConfig></GenerationConfig>
    <LoadingTranslation :is-shown="store.isTranslating"></LoadingTranslation>
    <div class="flex flex-row place-content-end">
      <PrimaryButton
        theme="success"
        v-if="!store.isTranslating && isSupported && store.currentTranslation === 'txt'"
        @click="copyText()"
      >
        <template #icon v-if="isCopied">
          <TransitionRoot
            :show="isCopied"
            enter="transition-opacity duration-75"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="transition-opacity duration-150"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                fill-rule="evenodd"
                d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18m-.232-5.36l5-6l-1.536-1.28l-4.3 5.159l-2.225-2.226l-1.414 1.414l3 3l.774.774z"
                clip-rule="evenodd"
              />
            </svg>
          </TransitionRoot>
          <TransitionRoot
            :show="!isCopied"
            enter="transition-opacity duration-75"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="transition-opacity duration-150"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                fill-rule="evenodd"
                d="M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0M7.293 16.707a1 1 0 0 1 0-1.414L10.586 12L7.293 8.707a1 1 0 0 1 1.414-1.414L12 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414L13.414 12l3.293 3.293a1 1 0 0 1-1.414 1.414L12 13.414l-3.293 3.293a1 1 0 0 1-1.414 0"
                clip-rule="evenodd"
              />
            </svg>
          </TransitionRoot>
        </template>
        Copy to clipboard
      </PrimaryButton>
    </div>
    <div class="whitespace-pre-wrap">
      {{ store.outputText }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import TextArea from '@/components/Inputs/TextArea.vue'
import { ref, type Ref } from 'vue'
import GenerationConfig from './GenerationConfig.vue'
import { useTranslatorStore } from '@/stores/translator'
import LoadingTranslation from './LoadingTranslation.vue'
import { useClipboard } from '@vueuse/core'
import { TransitionRoot } from '@headlessui/vue'

const store = useTranslatorStore()

const { copy, copied, isSupported } = useClipboard()
const isCopied: Ref<boolean | null> = ref(null)

const english = ref(
  `Generating random paragraphs can be an excellent way for writers to get their creative flow going at the beginning of the day. The writer has no idea what topic the random paragraph will be about when it appears. This forces the writer to use creativity to complete one of three common writing challenges. The writer can use the paragraph as the first one of a short story and build upon it. A second option is to use the random paragraph somewhere in a short story they create. The third option is to have the random paragraph be the ending paragraph in a short story. No matter which of these challenges is undertaken, the writer is forced to use creativity to incorporate the paragraph into their writing.\n\nA random paragraph can also be an excellent way for a writer to tackle writers' block. Writing block can often happen due to being stuck with a current project that the writer is trying to complete. By inserting a completely random paragraph from which to begin, it can take down some of the issues that may have been causing the writers' block in the first place.`,
)

const copyText = async () => {
  await copy(store.outputText)
  isCopied.value = copied.value
  setTimeout(() => {
    isCopied.value = null
  }, 5000)
}
</script>
