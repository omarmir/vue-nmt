import type { DownloadStatus, ModelStatus } from '@/types/Transformers'
import { pipeline, env } from '@huggingface/transformers'
import { computed, ref } from 'vue'
import Worker from '../workers/worker.js?worker'

// Variables to track overall download progress
const fileProgressDetails = ref(new Map<string, DownloadStatus>())
const ready = 'vue-nmt-ready'
fileProgressDetails.value.set(ready, { loaded: 0, total: 100 }) // Just to account for the delay

const cores = window.navigator.hardwareConcurrency ?? 1
// @ts-expect-error This exists - not sure why it thinks it doesn't
const ram = window.navigator.deviceMemory

env.localModelPath = '/models'
env.allowRemoteModels = false
env.allowLocalModels = true
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/wasm/'
  env.backends.onnx.wasm.proxy = false
}

export function useTranslator() {
  const outputText = ref('')
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

  // const worker = new Worker(new URL('/worker.js', import.meta.url), {
  //   type: 'module',
  // })

  const worker = new Worker()

  worker.onmessage = (event: MessageEvent) => {
    const message = event.data
    console.log(message)
    if (message.status === 'update') {
      outputText.value = message.result
    } else if (message.status === 'result') {
      outputText.value = message.result
    }
  }

  const generation = {
    max_length: 512,
    num_beams: 5,
    early_stopping: true,
  }

  const translate = async (input: string) => {
    console.log('compose', input)
    if (input.trim() === '') {
      outputText.value = ''
      return
    }
    worker.postMessage({
      input: input,
      generation: generation,
    })
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

  return {
    cores,
    download,
    ram,
    translate,
    fileProgressDetails,
    loaded,
    total,
    isLoaded,
  }
}
