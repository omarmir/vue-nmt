// import { pipeline, env } from '@huggingface/transformers'
// import { pipeline, env } from '../assets/wasm/transformers.web.min'
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1'



env.localModelPath = '/models'
env.allowRemoteModels = false
env.allowLocalModels = true
// if (env.backends.onnx.wasm) {
//   env.backends.onnx.wasm.wasmPaths = '/wasm/'
//   env.backends.onnx.wasm.proxy = false
// }


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

self.addEventListener('message', async (event) => {
  const message = event.data
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
