import type {
  DownloadStatus,
  MarianGeneration,
  ModelOutput,
  ModelStatus,
} from '@/types/Transformers'
import { computed, ref, type Ref } from 'vue'
import Worker from '../workers/worker.js?worker'
import { nanoid } from 'nanoid'
import { SmartTextSplitter, type SentenceEntry } from '@/lib/nlp'

// Variables to track overall download progress
const fileProgressDetails = ref(new Map<string, DownloadStatus>())
const ready = 'vue-nmt-ready'
fileProgressDetails.value.set(ready, { loaded: 0, total: 100 }) // Just to account for the delay
const activeWorkersPool: Array<{
  workerId: string
  worker: Worker | undefined
  status: 'free' | 'working' | 'disposed'
}> = []

const cores = window.navigator.hardwareConcurrency ?? 1

export function useTranslator(generationParams?: MarianGeneration) {
  const smartTextSplitter = new SmartTextSplitter()
  const maxConcurrentWorkers = Math.max(1, cores - 2)
  const sentenceQueue: SentenceEntry[] = []
  const translatedSentences: Ref<string[]> = ref([])
  const isTranslating = ref(false)

  const checkIfAllDone = () => {
    const queueEmpty = sentenceQueue.length === 0
    const allFree = activeWorkersPool.every((worker) => worker.status !== 'working')
    if (queueEmpty && allFree) {
      activeWorkersPool.forEach((worker) => {
        if (!worker.worker) return
        worker.worker.postMessage('dispose')
        worker.status = 'disposed'
        console.log('disposing:', worker.workerId)
        worker.worker.onmessage = null
        worker.worker.terminate()
        worker.worker = undefined
        console.log('dispose', worker.workerId)
      })
      isTranslating.value = false
    }
  }

  const processSentenceQueue = () => {
    if (sentenceQueue.length <= 0) {
      checkIfAllDone()
      return
    }

    const translating = sentenceQueue[0]

    if (!translating.shouldTranslate) {
      translatedSentences.value[translating.index] = translating.text
      sentenceQueue.splice(0, 1)
      processSentenceQueue()
      return
    }

    const currWorker = activeWorkersPool.findIndex((worker) => worker.status === 'free')
    if (currWorker === -1) {
      return // No free worker yet, wait for one to become free - this should happen when the next one becomes free
    }

    const worker = activeWorkersPool[currWorker]
    if (worker.worker === undefined) {
      return
    }
    sentenceQueue.splice(0, 1)

    worker.status = 'working'
    worker.worker.postMessage({
      task: 'translate',
      input: translating.text,
      generation: generationParams ?? {},
      index: translating.index,
      workerId: activeWorkersPool[currWorker].workerId,
    })
  }

  const translate = async (input: string) => {
    if (input.trim() === '') {
      return
    }

    isTranslating.value = true

    const newSentences = await smartTextSplitter.getSentenceMap(input.trim())

    sentenceQueue.push(...newSentences)

    translatedSentences.value = Array.from({ length: newSentences.length })

    const workersMax = Math.min(maxConcurrentWorkers, sentenceQueue.length)

    for (let i = 0; i < workersMax; i++) {
      const worker = new Worker()
      attachListeners(worker)
    }
  }

  const attachListeners = (worker: Worker, initialWorker: boolean = false) => {
    worker.onmessage = (event: MessageEvent<ModelOutput>) => {
      if (event.data.status === 'ready') {
        const workerId = nanoid()
        activeWorkersPool.push({ workerId, worker, status: 'free' })
        if (!initialWorker) processSentenceQueue()
      } else if (event.data.status === 'result') {
        // console.log(event.data)
        translatedSentences.value[event.data.index] = event.data.result
        const workerId = event.data.workerId
        const currWorker = activeWorkersPool.findIndex((worker) => worker.workerId === workerId)
        activeWorkersPool[currWorker].status = 'free'
        if (!initialWorker) processSentenceQueue()
      } else if (event.data.status === 'update') {
        // console.log(event.data)
        const originalText = translatedSentences.value[event.data.index] ?? ''
        translatedSentences.value[event.data.index] = originalText + event.data.result
      }
    }
  }

  const total = computed(() =>
    Array.from(fileProgressDetails.value.values()).reduce((sum, { total }) => sum + total, 0),
  )

  const loaded = computed(() =>
    Array.from(fileProgressDetails.value.values()).reduce((sum, { loaded }) => sum + loaded, 0),
  )

  const isLoaded = computed(() => loaded.value === total.value)

  // Function to trigger the download and caching of the model

  const download = async () => {
    const worker = new Worker()
    worker.onmessage = (event: MessageEvent<ModelStatus | ModelOutput>) => {
      if (event.data.status !== 'downloading') {
        worker.onmessage = null
        attachListeners(worker, true)
        return
      }
      if (event.data.result.status === 'initiate') {
        fileProgressDetails.value.set(event.data.result.file, { loaded: 0, total: 0 })
      } else if (event.data.result.status === 'progress') {
        fileProgressDetails.value.set(event.data.result.file, {
          loaded: event.data.result.loaded,
          total: event.data.result.total,
        })
      } else if (event.data.result.status === 'done') {
        const file = fileProgressDetails.value.get(event.data.result.file)
        fileProgressDetails.value.set(event.data.result.file, {
          loaded: file?.loaded ?? 1,
          total: file?.total ?? 1,
        })
      } else if (event.data.result.status === 'ready') {
        fileProgressDetails.value.set(ready, { loaded: 100, total: 100 })
        const workerId = nanoid()
        activeWorkersPool.push({ workerId, worker, status: 'free' })
      }
    }
  }

  const outputText = computed(() => translatedSentences.value.join(''))

  return {
    cores,
    download,
    translate,
    fileProgressDetails,
    loaded,
    total,
    isLoaded,
    outputText,
    translatedSentences,
    isTranslating,
    sentenceQueue,
    activeWorkersPool,
  }
}
