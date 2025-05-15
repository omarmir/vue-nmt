import type {
  DownloadStatus,
  MarianGeneration,
  ModelOutput,
  ModelStatus,
} from '@/types/Transformers'
import { computed, ref, type Ref } from 'vue'
import Worker from '../workers/worker.js?worker'
import { nanoid } from 'nanoid'

const transformersURL = new URL('/transformers/transformers.min.js?raw', import.meta.url).href
const { pipeline, env } = await import(transformersURL)

env.localModelPath = '/models'
env.allowRemoteModels = false
env.allowLocalModels = true
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/transformers/'
  env.backends.onnx.wasm.proxy = false
}

// Variables to track overall download progress
const fileProgressDetails = ref(new Map<string, DownloadStatus>())
const ready = 'vue-nmt-ready'
fileProgressDetails.value.set(ready, { loaded: 0, total: 100 }) // Just to account for the delay

const cores = window.navigator.hardwareConcurrency ?? 1

export function useTranslator(generationParams?: MarianGeneration) {
  const maxConcurrentWorkers = Math.max(1, cores - 2)
  const sentenceQueue: Array<{ text: string; index: number }> = []
  const activeWorkersPool: Array<{
    workerId: string
    worker: Worker | undefined
    status: 'free' | 'working' | 'disposed'
  }> = []
  const translatedSentences: Ref<Array<string>> = ref([])
  const isTranslating = ref(false)

  const processSentenceQueue = () => {
    console.log(sentenceQueue)
    if (sentenceQueue.length > 0) {
      const translating = sentenceQueue[0]

      const currWorker = activeWorkersPool.findIndex((worker) => worker.status === 'free')
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

      worker.worker.onmessage = (event: MessageEvent<ModelOutput>) => {
        if (event.data.status === 'result') {
          console.log(event.data)
          translatedSentences.value[event.data.index] = event.data.result
          const workerId = event.data.workerId
          const currWorker = activeWorkersPool.findIndex((worker) => worker.workerId === workerId)
          activeWorkersPool[currWorker].status = 'free'
          processSentenceQueue()
        } else if (event.data.status === 'update') {
          console.log(event.data)
          const originalText = translatedSentences.value[event.data.index] ?? ''
          translatedSentences.value[event.data.index] = originalText + event.data.result
        }
      }
    } else {
      activeWorkersPool.forEach((worker) => {
        if (worker.status === 'free') {
          if (!worker.worker) return
          worker.worker.postMessage('dispose')
          worker.status = 'disposed'
          console.log('disposing:', worker.workerId)
          worker.worker.onmessage = null
          worker.worker.terminate()
          worker.worker = undefined
        }
      })
      isTranslating.value = false
    }
  }

  const progressCallback = (data: ModelStatus) => {
    if (data.status === 'initiate') {
      fileProgressDetails.value.set(data.file, { loaded: 0, total: 0 })
    } else if (data.status === 'progress') {
      fileProgressDetails.value.set(data.file, { loaded: data.loaded, total: data.total })
    } else if (data.status === 'done') {
      const file = fileProgressDetails.value.get(data.file)
      fileProgressDetails.value.set(data.file, {
        loaded: file?.loaded ?? 1,
        total: file?.total ?? 1,
      })
    } else if (data.status === 'ready') {
      fileProgressDetails.value.set(ready, { loaded: 100, total: 100 })
    }
  }

  const translate = async (input: string) => {
    if (input.trim() === '') {
      return
    }

    isTranslating.value = true

    const sentences = splitIntoSentences(input.trim())
    sentenceQueue.push(...sentences.map((s, i) => ({ text: s, index: i })))

    const workersMax = Math.min(maxConcurrentWorkers, sentenceQueue.length)

    for (let i = 0; i < workersMax; i++) {
      const worker = new Worker()
      worker.onmessage = (event: MessageEvent<ModelOutput>) => {
        if (event.data.status === 'ready') {
          const workerId = nanoid()
          activeWorkersPool.push({ workerId, worker, status: 'free' })
          processSentenceQueue()
        }
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
    try {
      // console.log('Attempting to load (and cache) model: opus-mt-en-fr');
      const translator = await pipeline('translation', 'opus-mt-en-fr', {
        progress_callback: progressCallback,
      })
      await translator.dispose() // This is the key step to free memory
    } catch (error) {
      console.error('Failed to load model during download phase:', error)
      return
    }
  }

  // Function to split text into sentences (moved here to be accessible by useTranslator)
  function splitIntoSentences(text: string): string[] {
    if (!text) {
      return []
    }
    // Split by common sentence-ending punctuation followed by zero or more whitespace characters.
    // Uses a positive lookbehind (?<=[.!?]) to ensure the punctuation is kept in the resulting segments.
    const sentences = text.split(/(?<=[.!?])\s*/)
    // Filter out any empty strings and trim whitespace.
    translatedSentences.value = Array.from({ length: sentences.length })
    return sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0)
  }

  const outputText = computed(() => {
    return translatedSentences.value.join(' ')
  })

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
  }
}
