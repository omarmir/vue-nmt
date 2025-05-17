<template>
  <div class="flex flex-col w-full gap-4">
    <FilePicker
      v-model="file"
      help-text="Select a PPTX/DOCX file to translate"
      name="file-picker"
      label="File"
    ></FilePicker>
    <PrimaryButton
      class="w-full"
      @click="translateDoc()"
      :disabled="store.isTranslating || !store.isLoaded"
    >
      Translate
    </PrimaryButton>
    <GenerationConfig></GenerationConfig>
    <LoadingTranslation :is-shown="store.isTranslating"></LoadingTranslation>
    <ProgressBar
      v-if="store.isTranslating"
      :total="store.sentenceQueue.length + store.translatedSentences.length"
      :loaded="store.translatedSentences.length"
      :holdback="10"
      :release="false"
    ></ProgressBar>
  </div>
</template>
<script setup lang="ts">
import { ref, type Ref } from 'vue'
import FilePicker from './Inputs/FilePicker.vue'
import { useTranslatorStore } from '@/stores/translator'
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import LoadingTranslation from './LoadingTranslation.vue'
import GenerationConfig from './GenerationConfig.vue'
import ProgressBar from './Inputs/ProgressBar.vue'

const store = useTranslatorStore()
const file: Ref<File | null> = ref(null)

const translateDoc = () => {
  if (file.value) store.translateDocument(file.value)
}
</script>
