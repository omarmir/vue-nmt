import type { DownloadStatus, ModelOutput, ModelStatus } from '@/types/Transformers'
import { computed, ref, watch, type Ref } from 'vue'
import Worker from '../workers/worker.js?worker'
import { nanoid } from 'nanoid'
import { SmartTextSplitter, type SentenceEntry } from '@/lib/nlp'
import { defineStore } from 'pinia'
import JSZip from 'jszip'
import { extractSentences, loadXmlDocs, reconstructFile, type NodeMaps } from '@/utils/document'
import { useStorage } from '@vueuse/core'

export const useTranslatorStore = defineStore('translator', () => {
  const fileProgressDetails = ref(new Map<string, DownloadStatus>())
  const activeWorkersPool: Array<{
    workerId: string
    worker: Worker | undefined
    status: 'free' | 'working' | 'disposed'
    initial: boolean
  }> = []
  const isLoaded = ref(false)
  const cores = window.navigator.hardwareConcurrency ?? 1
  const smartTextSplitter = new SmartTextSplitter()
  const sentenceQueue: Ref<SentenceEntry[]> = ref([])
  const translatedSentences: Ref<string[]> = ref([])
  const isTranslating = ref(false)
  const state = useStorage('vue-nmt', {
    max_length: 512,
    num_beams: 5,
    early_stopping: true,
    threads: Math.max(1, cores - 2),
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
  let translationStartTime = 0

  const checkIfAllDone = () => {
    const queueEmpty = sentenceQueue.value.length === 0
    const allFree = activeWorkersPool.every((worker) => worker.status !== 'working')
    if (queueEmpty && allFree) {
      activeWorkersPool.forEach((worker) => {
        if (!worker.worker || worker.initial) return
        worker.worker.postMessage('dispose')
        worker.status = 'disposed'
        console.log('disposing:', worker.workerId)
        worker.worker.onmessage = null
        worker.worker.terminate()
        worker.worker = undefined
        console.log('dispose', worker.workerId)
      })
      isTranslating.value = false
      // If we were doing a doc, reconstruct immediately
      if (currentTranslation.value === 'doc' && currentDocContext) {
        const { nodeMaps, docs, zip, fileName, mimeType } = currentDocContext
        // reconstructFile updates zip and triggers download
        reconstructFile(nodeMaps, translatedSentences.value, docs, zip, fileName, mimeType)
      }

      if (translationStartTime > 0) {
        executionTime.value = Date.now() - translationStartTime
        translationStartTime = 0 // Reset for next translation
      }

      currentDocContext = null
    }
  }

  const startTimer = () => {
    translationStartTime = Date.now()
    executionTime.value = 0
  }

  const processSentenceQueue = () => {
    if (sentenceQueue.value.length <= 0) {
      checkIfAllDone()
      return
    }

    const translating = sentenceQueue.value[0]

    if (!translating.shouldTranslate) {
      translatedSentences.value[translating.index] = translating.text
      sentenceQueue.value.splice(0, 1)
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
    sentenceQueue.value.splice(0, 1)

    worker.status = 'working'
    worker.worker.postMessage({
      task: 'translate',
      input: translating.text,
      generation: {
        max_length: state.value.max_length,
        early_stopping: state.value.early_stopping,
        num_beams: state.value.num_beams,
      },
      index: translating.index,
      workerId: activeWorkersPool[currWorker].workerId,
    })
  }

  const spawnWorkers = () => {
    const activeWorkers = activeWorkersPool.filter((work) => work.status === 'free').length
    const workersMax = Math.max(
      Math.min(
        state.value.threads - activeWorkers,
        sentenceQueue.value.filter((sen) => sen.shouldTranslate).length - activeWorkers,
      ),
      1,
    )

    if (sentenceQueue.value.length === activeWorkers) {
      activeWorkersPool.forEach((worker) => {
        if (worker.worker && worker.status === 'free') processSentenceQueue()
      })
      return
    }

    for (let i = 0; i < workersMax; i++) {
      const worker = new Worker()
      attachListeners(worker)
    }
  }

  const translate = async (input: string) => {
    currentTranslation.value = 'txt'

    if (input.trim() === '') {
      return
    }

    isTranslating.value = true
    startTimer()

    const newSentences = await smartTextSplitter.getSentenceMap(input.trim())

    sentenceQueue.value.push(...newSentences)

    translatedSentences.value = []

    spawnWorkers()
  }

  const attachListeners = (worker: Worker) => {
    worker.onmessage = (event: MessageEvent<ModelOutput>) => {
      if (event.data.status === 'ready') {
        const workerId = nanoid()
        activeWorkersPool.push({ workerId, worker, status: 'free', initial: false })
        processSentenceQueue()
      } else if (event.data.status === 'result') {
        // console.log(event.data)
        translatedSentences.value[event.data.index] = event.data.result
        // translatedSentences.value.splice(event.data.index, 1, event.data.result)
        const workerId = event.data.workerId
        const currWorker = activeWorkersPool.findIndex((worker) => worker.workerId === workerId)
        activeWorkersPool[currWorker].status = 'free'
        processSentenceQueue()
      } else if (event.data.status === 'update') {
        // console.log(event.data)
        const originalText = translatedSentences.value[event.data.index] ?? ''
        translatedSentences.value[event.data.index] = originalText + event.data.result

        // translatedSentences.value.splice(event.data.index, 1, originalText + event.data.result)
      }
    }
  }

  const download = async () => {
    const worker = new Worker()
    worker.onmessage = (event: MessageEvent<ModelStatus | ModelOutput>) => {
      if (event.data.status !== 'downloading') {
        worker.onmessage = null
        attachListeners(worker)
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
        const workerId = nanoid()
        activeWorkersPool.push({ workerId, worker, status: 'free', initial: true })
        isLoaded.value = true
      }
    }
  }

  const total = computed(() =>
    Array.from(fileProgressDetails.value.values()).reduce((sum, { total }) => sum + total, 0),
  )

  const loaded = computed(() =>
    Array.from(fileProgressDetails.value.values()).reduce((sum, { loaded }) => sum + loaded, 0),
  )

  const outputText = computed(() => {
    if (currentTranslation.value !== 'txt') return 'French text will appear here'
    // return 'French text will appear here'
    return translatedSentences.value.join('')
  })

  const translateDocument = async (file: File) => {
    currentTranslation.value = 'doc'

    isTranslating.value = true
    startTimer()

    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // load & extract
    const docs = await loadXmlDocs(zip)
    const { nodeMaps, queue } = await extractSentences(docs, smartTextSplitter)
    // console.log('que', queue)
    // console.log('nodemaps', nodeMaps)

    // setup queue and results
    sentenceQueue.value = queue.slice()
    translatedSentences.value = []

    spawnWorkers()

    await new Promise<void>((resolve) => {
      const stop = watch(isTranslating, (val) => {
        if (!val) {
          stop()
          resolve()
        }
      })
    })

    await reconstructFile(nodeMaps, translatedSentences.value, docs, zip, file.name, file.type)
  }

  download()

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
    state,
    translateDocument,
    currentTranslation,
    executionTime,
  }
})
