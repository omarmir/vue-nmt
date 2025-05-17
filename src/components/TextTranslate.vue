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
    <div class="whitespace-pre-wrap">
      {{ store.outputText }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import TextArea from '@/components/Inputs/TextArea.vue'
import { ref } from 'vue'
import GenerationConfig from './GenerationConfig.vue'
import { useTranslatorStore } from '@/stores/translator'
import LoadingTranslation from './LoadingTranslation.vue'
const store = useTranslatorStore()

const english = ref(
  `Generating random paragraphs can be an excellent way for writers to get their creative flow going at the beginning of the day. The writer has no idea what topic the random paragraph will be about when it appears. This forces the writer to use creativity to complete one of three common writing challenges. The writer can use the paragraph as the first one of a short story and build upon it. A second option is to use the random paragraph somewhere in a short story they create. The third option is to have the random paragraph be the ending paragraph in a short story. No matter which of these challenges is undertaken, the writer is forced to use creativity to incorporate the paragraph into their writing.\n\nA random paragraph can also be an excellent way for a writer to tackle writers' block. Writing block can often happen due to being stuck with a current project that the writer is trying to complete. By inserting a completely random paragraph from which to begin, it can take down some of the issues that may have been causing the writers' block in the first place.`,
)
</script>
