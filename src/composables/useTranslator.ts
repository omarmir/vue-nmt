import { pipeline, env } from '@xenova/transformers'

// Variables to track overall download progress
// let fileProgressDetails = new Map(); // Stores filename -> { loaded: bytes, total: bytes }
// let overallExpectedTotalBytes = 0;   // Sum of 'total' for all files we've seen a progress event for
// let overallDownloadedBytes = 0;      // Sum of 'loaded' for all files
const cores = window.navigator.hardwareConcurrency ?? 1
// Specify a custom location for models (defaults to '/models/').
//env.localModelPath = '/models'
// Disable the loading of remote models from the Hugging Face Hub:
//env.allowRemoteModels = true

// const aiWorker = new Worker('/worker.js', { type: 'module' })

// aiWorker.postMessage({
//   action: 'download',
//   task: 'translation',
//   model: 'Xenova/opus-mt-en-fr',
// })

export function useTranslator() {
  // const progressCallback = (data) => {
  //   console.log(data)
  // }

  // const download = async () => {
  //   // await pipeline('translation', 'Xenova/opus-mt-en-fr', {
  //   //   progress_callback: progressCallback,
  //   // })
  //   aiWorker.postMessage({
  //     action: 'download',
  //     task: 'translation',
  //     model: 'Xenova/opus-mt-en-fr',
  //   })
  // }
  return {
    cores,
  }
}
