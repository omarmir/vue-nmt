<template>
  <div class="flex flex-col w-full gap-4">
    {{ english }}
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
    <GenerationConfig
      v-model="store.generationParams"
      v-model:threads="store.maxConcurrentWorkers"
    ></GenerationConfig>
    <div>
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
const store = useTranslatorStore()

const english = ref(`Hello`)
</script>
