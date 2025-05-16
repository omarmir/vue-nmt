const transformersURL = new URL('/transformers/transformers.min.js?raw', import.meta.url).href
const { pipeline, env, TextStreamer } = await import(transformersURL)

// import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

env.localModelPath = '/models'
env.allowRemoteModels = false
env.allowLocalModels = true
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/transformers/'
  env.backends.onnx.wasm.proxy = false
}

/**
 * @typedef {Object} MarianGeneration
 * @property {number} max_length
 * @property {number} num_beams
 * @property {boolean} early_stopping
 */

/**
 * @typedef {Object} TranslateTask
 * @property {'translate'} task
 * @property {string} input
 * @property {MarianGeneration} generation
 * @property {number} index
 * @property {string} workerId
 */

/**
 * @typedef {Object} DisposeTask
 * @property {'dispose'} task
 */

/**
 * @typedef {TranslateTask | DisposeTask} ModelTask
 */

// let translator // <- move this outside so updateCallback can access it
const translator = await pipeline('translation', 'opus-mt-en-fr')
self.postMessage({
  status: 'ready', // this will fire everytime its ready
})

const updateCallback = (text, index, workerId) => {
  self.postMessage({
    status: 'update',
    index,
    result: text,
    workerId,
  })
}

const resultCallback = (text, index, workerId) => {
  self.postMessage({
    status: 'result',
    index,
    result: text,
    workerId,
  })
}

self.addEventListener(
  'message',
  /** @param {MessageEvent<ModelTask>} event */ async (event) => {
    const message = event.data

    if (message.task === 'dispose') {
      if (translator) translator.dispose()
      return
    }

    const inputText = message.input
    if (typeof inputText !== 'string' || inputText.trim() === '') {
      self.postMessage({
        status: 'error',
        error: 'Invalid input: expected a non-empty string.',
      })
      return
    }

    // translator = await translatorPromise
    const streamer = new TextStreamer(translator.tokenizer, {
      skip_prompt: true,
      // Optionally, do something with the text (e.g., write to a textbox)
      callback_function: (text) => updateCallback(text, message.index, message.workerId),
    })

    try {
      const output = await translator(inputText, {
        ...message.generation,
        streamer,
      })

      resultCallback(output[0].translation_text, message.index, message.workerId)
    } catch (err) {
      self.postMessage({
        status: 'error',
        error: err.message || 'Unknown error during translation',
      })
    }
  },
)
