const transformersURL = new URL('/transformers/transformers.min.js?raw', import.meta.url).href
const { pipeline, env } = await import(transformersURL);

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


let translatorPromise = pipeline('translation', 'opus-mt-en-fr', {
  device: 'wasm', // or 'wasm'
}) // initialize once

const updateCallback = (beams) => {
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


self.addEventListener('message', /** @param {MessageEvent<ModelTask>} event */ async (event) => {
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

  const translator = await translatorPromise

  try {
    const output = await translator(inputText, {
      callback_function: updateCallback,
    })

    resultCallback(output[0].translation_text)
  } catch (err) {
    self.postMessage({
      status: 'error',
      error: err.message || 'Unknown error during translation',
    })
  }
})
