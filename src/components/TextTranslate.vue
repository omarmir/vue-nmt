<template>
  <div class="flex flex-col w-full gap-4">
    <TextArea name="english" placeholder="Type in your english content here" v-model="english">
      <template #label> English </template>
    </TextArea>
    <PrimaryButton class="w-full" @click="translateText" :disabled="isTranslating">
      Translate
    </PrimaryButton>
    <PrimaryButton class="w-full" @click="splitText" :disabled="isTranslating">
      Split
    </PrimaryButton>
    <div>
      {{ outputText ? outputText : 'Translated french will apear here' }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import TextArea from '@/components/Inputs/TextArea.vue'
import { useTranslator } from '@/composables/useTranslator'
import type { MarianGeneration } from '@/types/Transformers'
import { ref } from 'vue'

const generation: MarianGeneration = {
  max_length: 512,
  num_beams: 5,
  early_stopping: true,
}

const { translate, outputText, isTranslating, splitSentence } = useTranslator(generation)

const english = ref(
  'Generating random paragraphs can be an excellent way for writers to get their creative flow going at the beginning of the day. The writer has no idea what topic the random paragraph will be about when it appears. This forces the writer to use creativity to complete one of three common writing challenges. The writer can use the paragraph as the first one of a short story and build upon it. A second option is to use the random paragraph somewhere in a short story they create. The third option is to have the random paragraph be the ending paragraph in a short story. No matter which of these challenges is undertaken, the writer is forced to use creativity to incorporate the paragraph into their writing.',
)

const translateText = () => translate(english.value)

const splitText = async () => await splitSentence(english.value)
</script>
