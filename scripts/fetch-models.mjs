import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const root = new URL('..', import.meta.url)
const modelRoot = new URL('public/models/', root)
const hfBase = 'https://huggingface.co'

const modelFiles = [
  'config.json',
  'generation_config.json',
  'quantize_config.json',
  'source.spm',
  'special_tokens_map.json',
  'target.spm',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.json',
  'onnx/decoder_model_merged_quantized.onnx',
  'onnx/encoder_model_quantized.onnx',
]

const models = {
  'opus-mt-en-fr': {
    repo: 'Xenova/opus-mt-en-fr',
    files: modelFiles,
  },
  'opus-mt-fr-en': {
    repo: 'Xenova/opus-mt-fr-en',
    files: modelFiles,
  },
}

const args = new Set(process.argv.slice(2))
const force = args.has('--force')
const requestedModels = [...args].filter((arg) => !arg.startsWith('--'))
const selectedModels = requestedModels.length > 0 ? requestedModels : Object.keys(models)

for (const model of selectedModels) {
  if (!models[model]) {
    throw new Error(`Unknown model "${model}". Expected one of: ${Object.keys(models).join(', ')}`)
  }
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function modelUrl(repo, file) {
  return `${hfBase}/${repo}/resolve/main/${file}`
}

async function download(url, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true })
  const tempPath = `${outputPath}.tmp`
  await rm(tempPath, { force: true })

  const headers = { 'User-Agent': 'vue-nmt-model-fetcher' }
  if (process.env.HF_TOKEN) headers.Authorization = `Bearer ${process.env.HF_TOKEN}`

  const response = await fetch(url, { headers })
  if (!response.ok || !response.body) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath))
  await rename(tempPath, outputPath)
}

for (const model of selectedModels) {
  const { repo, files } = models[model]
  for (const file of files) {
    const outputPath = join(modelRoot.pathname, model, file)
    if (!force && (await exists(outputPath))) {
      console.log(`skip ${model}/${file}`)
      continue
    }

    console.log(`fetch ${model}/${file}`)
    await download(modelUrl(repo, file), outputPath)
  }
}

console.log('Model fetch complete.')
