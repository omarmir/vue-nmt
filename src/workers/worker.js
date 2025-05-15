const transformersURL = new URL('/transformers/transformers.min.js?raw', import.meta.url).href
const { pipeline, env } = await import(transformersURL)

// import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

// import {
//   pipeline,
//   env,
// } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1"

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
 */

/**
 * @typedef {Object} DisposeTask
 * @property {'dispose'} task
 */

/**
 * @typedef {TranslateTask | DisposeTask} ModelTask
 */

let translator // <- move this outside so updateCallback can access it
const translatorPromise = pipeline('translation', 'opus-mt-en-fr')

const updateCallback = (beams) => {
  console.log('update')
  const decodedText = translator.tokenizer.decode(beams[0].output_token_ids, {
    skip_special_tokens: true,
  })

  self.postMessage({
    status: 'update',
    result: decodedText,
  })
}

const resultCallback = (output) => {
  self.postMessage({
    status: 'result',
    result: output,
  })
}

self.addEventListener('message', async (event) => {
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

  translator = await translatorPromise

  try {
    // const output = await translator(inputText, {
    //   callback_function: updateCallback,
    //   ...message.generation,
    // })

    const output = await translator(inputText, {
      ...message.generation,
      callback_function: function (beams) {
        console.log('update')
        const decodedText = pipeline.tokenizer.decode(beams[0].output_token_ids, {
          skip_special_tokens: true,
        })

        self.postMessage({
          type: 'update',
          target: data.elementIdToUpdate,
          data: decodedText,
        })
      },
    })

    resultCallback(output[0].translation_text)
  } catch (err) {
    self.postMessage({
      status: 'error',
      error: err.message || 'Unknown error during translation',
    })
  }
})
