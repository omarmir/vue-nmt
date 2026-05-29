<template>
  <div class="flex w-full flex-col gap-4">
    <FilePicker
      v-model="file"
      :help-text="t.fileHelp"
      name="file-picker"
      :label="t.selectedFile"
    />
    <PrimaryButton
      class="w-full"
      @click="translateDoc()"
      :disabled="store.isTranslating || !store.isLoaded"
    >
      {{ t.startTranslation }}
    </PrimaryButton>
    <GenerationConfig :locale="locale" />
    <LoadingTranslation :is-shown="store.isTranslating" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, type Ref } from 'vue'
import FilePicker from './Inputs/FilePicker.vue'
import { useTranslatorStore } from '@/stores/translator'
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import LoadingTranslation from './LoadingTranslation.vue'
import GenerationConfig from './GenerationConfig.vue'
import { messages } from '@/utils/i18n'
import type { LocaleCode } from '@/types/translation'

const props = defineProps<{
  locale: LocaleCode
}>()

const store = useTranslatorStore()
const t = computed(() => messages[props.locale])
const file: Ref<File | null> = ref(null)

const translateDoc = () => {
  if (file.value) store.translateDocument(file.value)
  else store.statusMessage = t.value.noFile
}
</script>
