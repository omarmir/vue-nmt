<template>
  <div class="flex flex-col w-full gap-4">
    <TextArea name="english" placeholder="Type in your english content here" v-model="english">
      <template #label> English </template>
    </TextArea>
    <PrimaryButton class="w-full" @click="translateText"> Translate </PrimaryButton>
    <TextArea name="french" placeholder="Your french content will output here" :disabled="true">
      <template #label> French </template>
    </TextArea>
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

const { translate } = useTranslator(generation)

const english = ref('')

const translateText = () => translate(english.value)
</script>
