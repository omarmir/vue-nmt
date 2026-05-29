import type { DownloadStatus, ModelOutput, ModelStatus } from '@/types/Transformers'
import type { GlossarySet, MaskedGlossaryText, TranslationDirection } from '@/types/translation'
import { computed, ref, toRaw, type Ref } from 'vue'
import Worker from '../workers/worker.js?worker'
import { nanoid } from 'nanoid'
import { SmartTextSplitter, type SentenceEntry } from '@/lib/nlp'
import { defineStore } from 'pinia'
import JSZip from 'jszip'
import { extractSentences, loadXmlDocs, reconstructFile, type NodeMaps } from '@/utils/document'
import { useStorage } from '@vueuse/core'
import {
  activeEntriesForDirection,
  getSelectedGlossarySetId,
  listGlossarySets,
  maskTextWithGlossary,
  setSelectedGlossarySetId,
} from '@/utils/glossary'
import { recommendWorkerCount, splitQueueIntoBatches } from '@/utils/worker-planning'

type QueueEntry = SentenceEntry & {
  glossary?: MaskedGlossaryText
}

type WorkerPoolItem = {
  workerId: string
  worker: Worker
  status: 'loading' | 'free' | 'working' | 'disposed'
  initial: boolean
  model: string
}

const modelForDirection = (direction: TranslationDirection) =>
  direction === 'fr-en' ? 'opus-mt-fr-en' : 'opus-mt-en-fr'

export const useTranslatorStore = defineStore('translator', () => {
  const fileProgressDetails = ref(new Map<string, DownloadStatus & { model?: string }>())
  const activeWorkersPool: WorkerPoolItem[] = []
  const isLoaded = ref(false)
  const activeModel = ref<string | null>(null)
  const cores = window.navigator.hardwareConcurrency ?? 1
  const deviceMemory = (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null
  const smartTextSplitter = new SmartTextSplitter()
  const sentenceQueue: Ref<QueueEntry[]> = ref([])
  const pendingBatches: Ref<Array<{ id: string; items: QueueEntry[]; weight: number }>> = ref([])
  const translatedSentences: Ref<string[]> = ref([])
  const isTranslating = ref(false)
  const direction = useStorage<TranslationDirection>('nmt-direction', 'en-fr')
  const glossarySets: Ref<GlossarySet[]> = ref([])
  const selectedGlossarySetId = ref(getSelectedGlossarySetId())
  const statusMessage = ref('')
  const translatedDocument = ref<{ blob: Blob; name: string } | null>(null)
  const state = useStorage('nmt-config', {
    max_length: 512,
    num_beams: 4,
    early_stopping: true,
    threads: Math.min(8, Math.max(1, Math.round(cores / 2))),
  })

  const currentTranslation: Ref<'doc' | 'txt' | null> = ref(null)
  let currentDocContext: {
    nodeMaps: NodeMaps[]
    docs: Record<string, Document>
    zip: JSZip
    fileName: string
    mimeType: string
  } | null = null

  const executionTime = ref(0)
  const completedCount = ref(0)
  const totalSegments = ref(0)
  const activeWorkerCount = ref(0)
  let translationStartTime = 0
  let isFinishing = false

  const requiredModel = computed(() => modelForDirection(direction.value))

  const disposeWorkers = (includeInitial = false) => {
    for (const item of activeWorkersPool) {
      if (item.initial && !includeInitial) continue
      if (item.status === 'disposed') continue
      item.status = 'disposed'
      item.worker.postMessage({ task: 'dispose' })
      item.worker.onmessage = null
      item.worker.terminate()
    }

    for (let index = activeWorkersPool.length - 1; index >= 0; index--) {
      if (activeWorkersPool[index].status === 'disposed') activeWorkersPool.splice(index, 1)
    }
  }

  const resetTranslationState = () => {
    sentenceQueue.value = []
    pendingBatches.value = []
    translatedSentences.value = []
    completedCount.value = 0
    totalSegments.value = 0
    activeWorkerCount.value = 0
    currentDocContext = null
    translatedDocument.value = null
    isFinishing = false
    translationStartTime = 0
    executionTime.value = 0
    isTranslating.value = false
  }

  const startTimer = () => {
    translationStartTime = Date.now()
    executionTime.value = 0
  }

  const finishTranslation = async () => {
    if (isFinishing) return
    isFinishing = true
    isTranslating.value = false
    disposeWorkers(false)

    if (currentTranslation.value === 'doc' && currentDocContext) {
      const { nodeMaps, docs, zip, fileName, mimeType } = currentDocContext
      translatedDocument.value = await reconstructFile(
        nodeMaps,
        translatedSentences.value,
        docs,
        zip,
        fileName,
        mimeType,
      )
    }

    if (translationStartTime > 0) {
      executionTime.value = Date.now() - translationStartTime
      translationStartTime = 0
    }

    currentDocContext = null
    isFinishing = false
  }

  const checkIfAllDone = () => {
    if (!isTranslating.value || isFinishing) return
    const allIdle = activeWorkersPool.every((worker) => worker.status !== 'working' && worker.status !== 'loading')
    if (pendingBatches.value.length > 0 || !allIdle) return
    finishTranslation().catch((error) => {
      statusMessage.value = error?.message || String(error)
      isTranslating.value = false
      isFinishing = false
      disposeWorkers(false)
    })
  }

  const processQueue = () => {
    if (!isTranslating.value) return

    while (pendingBatches.value.length > 0) {
      const worker = activeWorkersPool.find(
        (item) => item.status === 'free' && item.model === requiredModel.value,
      )
      if (!worker) break

      const batch = pendingBatches.value.shift()
      if (!batch) break
      worker.status = 'working'
      worker.worker.postMessage({
        task: 'translate-batch',
        batchId: batch.id,
        model: worker.model,
        workerId: worker.workerId,
        items: batch.items.map(cloneQueueEntryForWorker),
        generation: {
          max_length: state.value.max_length,
          early_stopping: state.value.early_stopping,
          num_beams: state.value.num_beams,
        },
      })
    }

    checkIfAllDone()
  }

  const cloneQueueEntryForWorker = (entry: QueueEntry) => {
    const rawEntry = toRaw(entry)
    return {
      index: rawEntry.index,
      text: rawEntry.text,
      shouldTranslate: rawEntry.shouldTranslate,
      glossary: rawEntry.glossary
        ? {
            text: rawEntry.glossary.text,
            replacements: rawEntry.glossary.replacements.map((replacement) => ({
              id: replacement.id,
              source: replacement.source,
              target: replacement.target,
            })),
          }
        : undefined,
    }
  }

  const attachListeners = (poolItem: WorkerPoolItem) => {
    poolItem.worker.onmessage = (event: MessageEvent<ModelOutput | ModelStatus>) => {
      if (event.data.status === 'init') {
        poolItem.worker.postMessage({
          task: 'model',
          model: poolItem.model,
        })
        return
      }

      if (event.data.status === 'downloading') {
        const result = event.data.result
        if (!('file' in result)) return
        const key = `${poolItem.model}/${result.file}`
        const existing = fileProgressDetails.value.get(key) || { loaded: 0, total: 0, model: poolItem.model }
        if (result.status === 'initiate') {
          fileProgressDetails.value.set(key, existing)
        } else if (result.status === 'progress') {
          fileProgressDetails.value.set(key, {
            loaded: Math.max(existing.loaded, result.loaded || 0),
            total: Math.max(existing.total, result.total || 0),
            model: poolItem.model,
          })
        } else if (result.status === 'done') {
          fileProgressDetails.value.set(key, {
            loaded: existing.total || existing.loaded || 1,
            total: existing.total || existing.loaded || 1,
            model: poolItem.model,
          })
        }
        return
      }

      if (event.data.status === 'ready') {
        poolItem.status = 'free'
        activeModel.value = 'model' in event.data && event.data.model ? event.data.model : poolItem.model
        isLoaded.value = activeModel.value === requiredModel.value
        processQueue()
        return
      }

      if (event.data.status === 'result') {
        translatedSentences.value[event.data.index] = event.data.result
        completedCount.value += 1
        return
      }

      if (event.data.status === 'batch-complete') {
        poolItem.status = 'free'
        processQueue()
        return
      }

      if (event.data.status === 'error') {
        poolItem.status = 'free'
        statusMessage.value = event.data.error
        isTranslating.value = false
        disposeWorkers(false)
      }
    }
  }

  const createWorker = (initial = false) => {
    const worker = new Worker()
    const poolItem: WorkerPoolItem = {
      workerId: nanoid(),
      worker,
      status: 'loading',
      initial,
      model: requiredModel.value,
    }
    activeWorkersPool.push(poolItem)
    attachListeners(poolItem)
    return poolItem
  }

  const ensureModel = async () => {
    if (activeModel.value && activeModel.value !== requiredModel.value) {
      disposeWorkers(true)
      activeModel.value = null
      isLoaded.value = false
      fileProgressDetails.value.clear()
    }

    if (
      isLoaded.value &&
      activeWorkersPool.some((worker) => worker.status === 'free' && worker.model === requiredModel.value)
    ) {
      return
    }

    if (!activeWorkersPool.some((worker) => worker.status === 'loading' || worker.status === 'free')) {
      createWorker(true)
    }
  }

  const desiredWorkerCount = (queue = sentenceQueue.value) => {
    const translatable = queue.filter((item) => item.shouldTranslate).length
    return recommendWorkerCount({
      segmentCount: translatable,
      maxWorkers: state.value.threads,
      hardwareConcurrency: cores,
      deviceMemory,
    })
  }

  const ensureTranslationWorkers = (needed = desiredWorkerCount()) => {
    const active = activeWorkersPool.filter((worker) => worker.status !== 'disposed').length
    for (let index = active; index < needed; index++) createWorker(false)
    activeWorkerCount.value = needed
  }

  const refreshGlossarySets = async () => {
    glossarySets.value = await listGlossarySets()
    if (
      selectedGlossarySetId.value &&
      !glossarySets.value.some((set) => set.id === selectedGlossarySetId.value)
    ) {
      selectedGlossarySetId.value = ''
      setSelectedGlossarySetId('')
    }
  }

  const setSelectedGlossary = (id: string) => {
    selectedGlossarySetId.value = id
    setSelectedGlossarySetId(id)
  }

  const applyGlossaryToQueue = async (queue: SentenceEntry[]): Promise<QueueEntry[]> => {
    await refreshGlossarySets()
    const set = glossarySets.value.find((item) => item.id === selectedGlossarySetId.value)
    const active = activeEntriesForDirection(set?.entries || [], direction.value)
    if (!active.length) return queue.map((item) => ({ ...item }))

    return queue.map((item) => {
      if (!item.shouldTranslate) return { ...item }
      const masked = maskTextWithGlossary(item.text, active)
      return masked ? { ...item, glossary: masked } : { ...item }
    })
  }

  const startQueue = async (queue: SentenceEntry[], mode: 'txt' | 'doc') => {
    const preparedQueue = await applyGlossaryToQueue(queue)
    if (!preparedQueue.some((item) => item.shouldTranslate)) return

    await ensureModel()
    currentTranslation.value = mode
    sentenceQueue.value = preparedQueue
    translatedSentences.value = []
    completedCount.value = 0
    totalSegments.value = preparedQueue.length

    for (const item of preparedQueue) {
      if (!item.shouldTranslate) {
        translatedSentences.value[item.index] = item.text
        completedCount.value += 1
      }
    }

    const translatable = preparedQueue.filter((item) => item.shouldTranslate)
    const workerCount = desiredWorkerCount(preparedQueue)
    pendingBatches.value = splitQueueIntoBatches(translatable, workerCount)
    activeWorkerCount.value = workerCount
    isTranslating.value = true
    statusMessage.value = ''
    startTimer()
    ensureTranslationWorkers(workerCount)
    processQueue()
  }

  const translate = async (input: string) => {
    if (input.trim() === '') return
    translatedDocument.value = null
    const newSentences = await smartTextSplitter.getSentenceMap(input.trim())
    await startQueue(newSentences, 'txt')
  }

  const translateDocument = async (file: File) => {
    if (!/\.(docx|pptx)$/i.test(file.name)) {
      statusMessage.value = 'Only DOCX and PPTX files are supported.'
      return
    }

    translatedDocument.value = null
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    const docs = await loadXmlDocs(zip)
    const { nodeMaps, queue } = await extractSentences(docs, smartTextSplitter)

    currentDocContext = {
      nodeMaps,
      docs,
      zip,
      fileName: file.name,
      mimeType: file.type,
    }

    await startQueue(queue, 'doc')
  }

  const setDirection = async (nextDirection: TranslationDirection) => {
    if (direction.value === nextDirection) return
    resetTranslationState()
    direction.value = nextDirection
    disposeWorkers(true)
    activeModel.value = null
    isLoaded.value = false
    fileProgressDetails.value.clear()
    await ensureModel()
  }

  const total = computed(() =>
    Array.from(fileProgressDetails.value.values()).reduce((sum, { total }) => sum + total, 0),
  )

  const loaded = computed(() =>
    Array.from(fileProgressDetails.value.values()).reduce((sum, { loaded }) => sum + loaded, 0),
  )

  const outputPlaceholder = computed(() =>
    direction.value === 'fr-en' ? 'English text will appear here' : 'French text will appear here',
  )

  const outputText = computed(() => {
    if (currentTranslation.value !== 'txt') return outputPlaceholder.value
    return translatedSentences.value.join('') || outputPlaceholder.value
  })

  const sourceLabel = computed(() => (direction.value === 'fr-en' ? 'French' : 'English'))
  const outputLabel = computed(() => (direction.value === 'fr-en' ? 'English' : 'French'))

  const downloadTranslatedDocument = () => {
    if (!translatedDocument.value) return
    const url = URL.createObjectURL(translatedDocument.value.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = translatedDocument.value.name
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  ensureModel()
  refreshGlossarySets()

  return {
    cores,
    ensureModel,
    translate,
    fileProgressDetails,
    loaded,
    total,
    isLoaded,
    activeModel,
    requiredModel,
    outputText,
    outputPlaceholder,
    translatedSentences,
    isTranslating,
    sentenceQueue,
    pendingBatches,
    activeWorkersPool,
    state,
    translateDocument,
    currentTranslation,
    executionTime,
    completedCount,
    totalSegments,
    activeWorkerCount,
    direction,
    setDirection,
    sourceLabel,
    outputLabel,
    glossarySets,
    selectedGlossarySetId,
    setSelectedGlossary,
    refreshGlossarySets,
    statusMessage,
    translatedDocument,
    downloadTranslatedDocument,
  }
})
