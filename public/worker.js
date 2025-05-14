// Web Worker
import {
  pipeline,
  env,
} from "/transformers@2.17.1.js"
env.localModelPath = '/models'
env.allowLocalModels = true
env.allowRemoteModels = false

var translator
var task
var model

const progressCallback = (data) => {
  console.log(data)
  self.postMessage({
    status: 'downloading',
    result: data,
  })
}

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
  console.log(message)

  if (message.action == 'download') {
    task = message.task
    model = message.model

    translator = await pipeline(task, model, {
      progress_callback: progressCallback,
    })

    self.postMessage({
      status: 'ready',
      task: task,
      model: model,
    })
  } else if (message.action == 'translate') {
    const output = await translator(message.input, {
      // Secret ingredient
      ...message.generation,
      callback_function: updateCallback,
    })

    resultCallback(output[0].translation_text)
  }
})
