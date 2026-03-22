export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Task {
  id: string
  prompt: string
  negative_prompt: string | null
  styles: string
  sampler_name: string
  scheduler: string
  steps: number
  cfg_scale: number
  width: number
  height: number
  n_iter: number
  batch_size: number
  seed: number
  model_checkpoint: string
  status: TaskStatus
  error: string | null
  createdAt: Date | string
  updatedAt: Date | string
  images?: GeneratedImage[]
}

export interface GeneratedImage {
  id: string
  path: string
  isFavorite: boolean
  taskId: string
  createdAt: Date | string
}

export interface ImageWithTask extends GeneratedImage {
  task: TaskWithPartial
}

export interface TaskWithPartial extends Task {
  [key: string]: unknown
}

export interface SystemConfig {
  id: string
  imageDir: string
  updatedAt: Date | string
}

export interface Model {
  id: string
  name: string
  createdAt?: Date | string
}

export interface Style {
  id: string
  name: string
  createdAt?: Date | string
}

export interface ProgressData {
  progress: number
  current_image: string | null
}

export interface ParsedErrorDetails {
  message: string
  timestamp: string
  elapsedTime: string
  requestInfo: {
    url: string
    method: string
    payload?: {
      steps: number
      width: number
      height: number
      n_iter: number
      model: string
    }
  }
  errorDetails: {
    code: string
    status: string
    responseData: unknown
    stack: string
  }
}
