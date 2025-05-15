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
import { ref } from 'vue'

const { translate } = useTranslator()

const english = ref('')

const translateText = () => translate(english.value)
</script>
