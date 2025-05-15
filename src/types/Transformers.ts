export type ModelStatus =
  | {
      status: 'initiate' | 'download' | 'done'
      name: string
      file: string
    }
  | {
      file: string
      loaded: number
      name: string
      progress: number
      status: 'progress'
      total: number
    }
  | {
      status: 'ready'
      task: string
      model: string
    }

export type DownloadStatus = {
  loaded: number
  total: number
}

export type MarianGeneration = {
  max_length: number
  num_beams: number
  early_stopping: boolean
}

export type ModelTask =
  | {
      task: 'translate'
      input: string
      generation: MarianGeneration
      index: number
    }
  | {
      task: 'dispose'
    }

export type ModelOutput =
  | {
      status: 'update' | 'result'
      result: 'string'
      index: number
      workerId: string
    }
  | {
      status: 'error'
      error: string
    }
  | {
      status: 'ready'
    }
