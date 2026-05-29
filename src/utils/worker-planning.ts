export function recommendWorkerCount({
  segmentCount,
  maxWorkers,
  hardwareConcurrency,
  deviceMemory,
}: {
  segmentCount?: number
  maxWorkers?: number
  hardwareConcurrency?: number
  deviceMemory?: number | null
} = {}) {
  const safeSegmentCount = Math.max(0, Number(segmentCount) || 0)
  const safeMaxWorkers = Math.max(1, Number(maxWorkers) || 1)
  const safeHardware = Math.max(1, Number(hardwareConcurrency) || 1)
  const segmentCap = safeSegmentCount < 10 ? 1 : safeSegmentCount < 30 ? 2 : safeSegmentCount < 80 ? 4 : 8
  const cpuCap = safeHardware <= 4 ? Math.max(1, safeHardware - 1) : Math.max(1, safeHardware - 2)
  const perWorkerGb = 0.5
  const memoryCap =
    Number.isFinite(deviceMemory) && Number(deviceMemory) > 0
      ? Math.max(1, Math.floor((Number(deviceMemory) * 0.65) / perWorkerGb))
      : 8

  return Math.max(1, Math.min(safeMaxWorkers, segmentCap, cpuCap, memoryCap, 8))
}

export function splitQueueIntoBatches<T extends { text: string; glossary?: { text: string } }>(
  items: T[],
  workerCount: number,
) {
  const batches = Array.from({ length: Math.max(1, workerCount) }, (_, index) => ({
    id: `batch-${Date.now()}-${index}`,
    items: [] as T[],
    weight: 0,
  }))

  for (const item of items) {
    const target = batches.reduce((best, batch) => (batch.weight < best.weight ? batch : best), batches[0])
    target.items.push(item)
    target.weight += Math.max(1, String(item.glossary?.text || item.text || '').length)
  }

  return batches.filter((batch) => batch.items.length > 0)
}
