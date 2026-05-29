<template>
  <div class="flex w-full flex-col gap-4">
    <div class="flex flex-col gap-4">
      <TextArea
        name="source"
        :placeholder="sourcePlaceholder"
        v-model="source"
        :rows="12"
      >
        <template #label>{{ sourceHeading }}</template>
      </TextArea>
      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-gray-900">{{ outputHeading }}</h3>
        <div class="min-h-40 whitespace-pre-wrap py-2 text-gray-900">
          {{ store.outputText }}
        </div>
      </section>
    </div>

    <div class="flex flex-wrap gap-3">
      <PrimaryButton @click="store.translate(source)" :disabled="store.isTranslating || !store.isLoaded">
        {{ t.translate }}
      </PrimaryButton>
      <PrimaryButton
        theme="success"
        v-if="!store.isTranslating && isSupported && store.currentTranslation === 'txt'"
        @click="copyText()"
      >
        {{ copiedLabel }}
      </PrimaryButton>
      <PrimaryButton
        theme="success"
        v-if="!store.isTranslating && store.currentTranslation === 'txt'"
        @click="downloadText()"
      >
        {{ t.download }}
      </PrimaryButton>
    </div>

    <GenerationConfig :locale="locale" />
  </div>
</template>
<script lang="ts" setup>
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import TextArea from '@/components/Inputs/TextArea.vue'
import { computed, ref, type Ref } from 'vue'
import GenerationConfig from './GenerationConfig.vue'
import { useTranslatorStore } from '@/stores/translator'
import { useClipboard } from '@vueuse/core'
import { messages } from '@/utils/i18n'
import type { LocaleCode } from '@/types/translation'

const props = defineProps<{
  locale: LocaleCode
}>()

const store = useTranslatorStore()
const t = computed(() => messages[props.locale])

const { copy, copied, isSupported } = useClipboard()
const isCopied: Ref<boolean | null> = ref(null)

const source = ref(
  `Generating random paragraphs can be an excellent way for writers to get their creative flow going at the beginning of the day. The writer has no idea what topic the random paragraph will be about when it appears.`,
)

const sourceHeading = computed(() =>
  store.direction === 'fr-en' ? t.value.sourceFr : t.value.sourceEn,
)
const outputHeading = computed(() =>
  store.direction === 'fr-en' ? t.value.outputEn : t.value.outputFr,
)
const sourcePlaceholder = computed(() =>
  store.direction === 'fr-en'
    ? props.locale === 'fr'
      ? 'Saisissez le texte français ici'
      : 'Type French text here'
    : props.locale === 'fr'
      ? 'Saisissez le texte anglais ici'
      : 'Type English text here',
)
const copiedLabel = computed(() => (isCopied.value ? t.value.copied : t.value.copy))

const copyText = async () => {
  await copy(store.outputText)
  isCopied.value = copied.value
  setTimeout(() => {
    isCopied.value = null
  }, 5000)
}

const downloadText = () => {
  const blob = new Blob([store.outputText], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `translation-${store.direction}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
</script>
