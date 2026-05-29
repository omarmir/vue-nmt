import type { SentenceEntry } from '@/lib/nlp'
import { SmartTextSplitter } from '@/lib/nlp'
import saveAs from 'file-saver'
import JSZip from 'jszip'

export type NodeMaps = { path: string; node: Element; indices: number[] }

export const loadXmlDocs = async (zip: JSZip): Promise<Record<string, Document>> => {
  const docs: Record<string, Document> = {}
  const xmlPaths = [
    /word\/document\.xml$/,
    /ppt\/slides\/slide\d+\.xml$/,
    /ppt\/notesSlides\/notesSlide\d+\.xml$/,
  ]
  const tasks: Promise<void>[] = []

  zip.forEach((path, entry) => {
    if (xmlPaths.some((re) => re.test(path))) {
      tasks.push(
        entry.async('string').then((content) => {
          docs[path] = new DOMParser().parseFromString(content, 'application/xml')
        }),
      )
    }
  })

  await Promise.all(tasks)
  return docs
}

export const extractSentences = async (
  docs: Record<string, Document>,
  splitter: SmartTextSplitter,
): Promise<{
  nodeMaps: Array<{ path: string; node: Element; indices: number[] }>
  queue: SentenceEntry[]
}> => {
  const nodeMaps: Array<NodeMaps> = []
  const queue: SentenceEntry[] = []
  let idx = 0

  for (const [path, doc] of Object.entries(docs)) {
    const nodes = [
      ...Array.from(doc.getElementsByTagName('w:t')),
      ...Array.from(doc.getElementsByTagName('a:t')),
      ...Array.from(doc.getElementsByTagName('t')),
    ]

    for (const node of nodes) {
      const raw = node.textContent || ''
      const sentenceEntries = await splitter.getSentenceMap(raw)
      if (sentenceEntries.length === 0) continue

      const indices: number[] = []
      for (const entry of sentenceEntries) {
        queue.push({ text: entry.text, index: idx, shouldTranslate: entry.shouldTranslate })
        indices.push(idx)
        idx++
      }

      nodeMaps.push({ path, node, indices })
    }
  }

  return { nodeMaps, queue }
}

export const reconstructFile = async (
  nodeMaps: NodeMaps[],
  translatedSentences: string[],
  docs: Record<string, Document>,
  zip: JSZip,
  name: string,
  type: string,
) => {
  // write back translations
  nodeMaps.forEach(({ node, indices }) => {
    node.textContent = indices.map((i) => translatedSentences[i] || '').join('')
  })

  // update zip and download
  Object.entries(docs).forEach(([path, doc]) => {
    zip.file(path, new XMLSerializer().serializeToString(doc))
  })
  const out = await zip.generateAsync({ type: 'blob', mimeType: type })
  saveAs(out, name.replace(/(\.docx|\.pptx)$/, '_translated$1'))
}
