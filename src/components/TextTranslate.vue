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
    <PrimaryButton class="w-full" @click="translateText" :disabled="isTranslating || !isLoaded">
      Translate
    </PrimaryButton>
    <GenerationConfig
      v-model="generationParams"
      v-model:threads="maxConcurrentWorkers"
    ></GenerationConfig>
    <div>
      {{ outputText }}
    </div>
  </div>
</template>
<script lang="ts" setup>
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import TextArea from '@/components/Inputs/TextArea.vue'
import { useTranslator } from '@/composables/useTranslator'
import { ref, watch } from 'vue'
import GenerationConfig from './GenerationConfig.vue'
const { translate, outputText, isTranslating, isLoaded, generationParams, maxConcurrentWorkers } =
  useTranslator()

const english = ref(`Hello`)

const translateText = () => translate(english.value)

watch(outputText, (val) => {
  console.log('Watched outputText in component:', val)
})
</script>
