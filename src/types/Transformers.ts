export type ModelStatus =
  | {
      status: 'downloading'
      result:
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
    }
  | {
      status: 'init'
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
