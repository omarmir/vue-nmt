import type { DownloadStatus, ModelStatus } from '@/types/Transformers'
import { pipeline, env } from '@xenova/transformers'
import { ref } from 'vue'

// Variables to track overall download progress
const fileProgressDetails = new Map<string, DownloadStatus>() // Stores filename -> { loaded: bytes, total: bytes }
const overallExpectedTotalBytes = ref(0) // Sum of 'total' for all files we've seen a progress event for
const overallDownloadedBytes = ref(0) // Sum of 'loaded' for all files
const cores = window.navigator.hardwareConcurrency ?? 1
// Specify a custom location for models (defaults to '/models/').
env.localModelPath = '/models'
// Disable the loading of remote models from the Hugging Face Hub:
env.allowRemoteModels = true
env.backends.onnx.wasm.wasmPaths = '/wasm/'
// const aiWorker = new Worker('/worker.js', { type: 'module' })

export function useTranslator() {
  const progressCallback = (data: ModelStatus) => {
    if (data.status === 'initiate') {
      fileProgressDetails.set(data.file, { loaded: 0, total: 0 })
    } else if (data.status === 'progress') {
      fileProgressDetails.set(data.file, { loaded: data.loaded, total: data.total })
    } else if (data.status === 'done') {
      const file = fileProgressDetails.get(data.file)
      fileProgressDetails.set(data.file, { loaded: file?.loaded ?? 1, total: file?.total ?? 1 })
    }
  }

  const download = async () => {
    await pipeline('translation', 'opus-mt-en-fr', {
      progress_callback: progressCallback,
    })
  }
  return {
    cores,
    download,
  }
}
