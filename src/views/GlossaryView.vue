<template>
  <main class="flex flex-col gap-6">
    <section>
      <h2 class="text-xl font-semibold">{{ t.glossaryTitle }}</h2>
      <p class="mt-2 max-w-3xl text-sm text-gray-700">{{ t.glossaryIntro }}</p>
    </section>

    <section class="rounded-md border border-gray-200 p-4">
      <h3 class="text-lg font-semibold">{{ t.csv }}</h3>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <PrimaryButton theme="success" @click="downloadTemplate">{{ t.downloadTemplate }}</PrimaryButton>
        <label class="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">
          {{ t.importCsv }}
          <input class="sr-only" type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" @change="importCsv" />
        </label>
      </div>
    </section>

    <section class="flex flex-col gap-4">
      <div class="flex flex-wrap gap-3">
        <PrimaryButton @click="addSet">{{ t.addSet }}</PrimaryButton>
        <PrimaryButton theme="danger" @click="clearAll">{{ t.clearSets }}</PrimaryButton>
      </div>

      <article
        v-for="set in sets"
        :key="set.id"
        class="rounded-md border border-gray-200 p-4"
      >
        <label class="grid gap-1 text-sm font-medium">
          {{ t.setName }}
          <input
            v-model="set.name"
            class="rounded-md border border-gray-300 p-2"
            type="text"
          />
        </label>

        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left">
                <th class="p-2">{{ t.enabled }}</th>
                <th class="p-2">{{ t.englishTerm }}</th>
                <th class="p-2">{{ t.frenchTerm }}</th>
                <th class="p-2">{{ t.deleteRow }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in set.entries" :key="entry.id" class="border-b border-gray-100">
                <td class="p-2">
                  <input v-model="entry.enabled" type="checkbox" />
                </td>
                <td class="p-2">
                  <input v-model="entry.english" class="w-full rounded-md border border-gray-300 p-2" type="text" />
                </td>
                <td class="p-2">
                  <input v-model="entry.french" class="w-full rounded-md border border-gray-300 p-2" type="text" />
                </td>
                <td class="p-2">
                  <button class="text-sm font-medium text-red-700 hover:underline" type="button" @click="deleteRow(set.id, entry.id)">
                    {{ t.deleteRow }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <PrimaryButton @click="addRow(set.id)">{{ t.addRow }}</PrimaryButton>
          <PrimaryButton theme="success" @click="saveSet(set)">{{ t.saveSet }}</PrimaryButton>
          <PrimaryButton theme="success" @click="downloadSet(set)">{{ t.downloadCurrent }}</PrimaryButton>
          <PrimaryButton theme="danger" @click="deleteSetById(set.id)">{{ t.deleteSet }}</PrimaryButton>
        </div>
      </article>
    </section>

    <p class="min-h-6 text-sm" :class="messageType === 'error' ? 'text-red-700' : 'text-emerald-700'">
      {{ message }}
    </p>
  </main>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PrimaryButton from '@/components/Inputs/PrimaryButton.vue'
import { messages, normalizeLocale } from '@/utils/i18n'
import {
  clearGlossarySets,
  createGlossaryEntry,
  createGlossarySet,
  deleteGlossarySet,
  exportGlossaryCsv,
  listGlossarySets,
  parseGlossaryCsv,
  saveGlossarySet,
} from '@/utils/glossary'
import type { GlossarySet } from '@/types/translation'

const route = useRoute()
const locale = computed(() => normalizeLocale(route.params.locale))
const t = computed(() => messages[locale.value])
const sets = ref<GlossarySet[]>([])
const message = ref('')
const messageType = ref<'info' | 'error' | 'success'>('info')

const loadSets = async () => {
  sets.value = await listGlossarySets()
  if (!sets.value.length) {
    sets.value = [createGlossarySet({ name: t.value.newSet, entries: [createGlossaryEntry()] })]
  }
}

const show = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
  message.value = text
  messageType.value = type
}

const addSet = () => {
  sets.value.push(createGlossarySet({ name: t.value.newSet, entries: [createGlossaryEntry()] }))
}

const addRow = (setId: string) => {
  const set = sets.value.find((item) => item.id === setId)
  set?.entries.push(createGlossaryEntry())
}

const deleteRow = (setId: string, entryId: string) => {
  const set = sets.value.find((item) => item.id === setId)
  if (!set) return
  set.entries = set.entries.filter((entry) => entry.id !== entryId)
  if (!set.entries.length) set.entries.push(createGlossaryEntry())
}

const saveSet = async (set: GlossarySet) => {
  const useful = set.entries.filter((entry) => entry.english || entry.french)
  if (!useful.length) {
    show(t.value.emptyRow, 'error')
    return
  }
  const saved = await saveGlossarySet({ ...set, entries: useful })
  sets.value = sets.value.map((item) => (item.id === saved.id ? saved : item))
  show(t.value.saved, 'success')
}

const deleteSetById = async (setId: string) => {
  if (!confirm(t.value.confirmDelete)) return
  await deleteGlossarySet(setId)
  sets.value = sets.value.filter((set) => set.id !== setId)
  if (!sets.value.length) sets.value = [createGlossarySet({ name: t.value.newSet, entries: [createGlossaryEntry()] })]
  show(t.value.deleted, 'success')
}

const clearAll = async () => {
  if (!confirm(t.value.confirmClear)) return
  await clearGlossarySets()
  sets.value = [createGlossarySet({ name: t.value.newSet, entries: [createGlossaryEntry()] })]
  show(t.value.cleared, 'success')
}

const importCsv = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const entries = parseGlossaryCsv(await file.text())
  const target = sets.value[0] || createGlossarySet({ name: t.value.newSet })
  target.entries = entries.length ? entries : [createGlossaryEntry()]
  if (!sets.value.length) sets.value = [target]
  show(t.value.imported, 'success')
}

const downloadTemplate = () => {
  download('nmt-glossary-template.csv', 'english,french\n')
}

const downloadSet = (set: GlossarySet) => {
  download(`${safeFileName(set.name)}.csv`, exportGlossaryCsv(set.entries))
}

const download = (name: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const safeFileName = (value: string) =>
  (String(value || 'glossary').trim() || 'glossary')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLocaleLowerCase() || 'glossary'

onMounted(loadSets)
</script>
