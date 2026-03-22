export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ApiError {
  code: string
  message: string
  status?: number
  details?: unknown
}

export interface GenerateRequestPayload {
  prompt: string
  negative_prompt?: string | null
  styles?: string[]
  override_settings?: {
    sd_model_checkpoint?: string
  }
  width?: number
  height?: number
  n_iter?: number
  steps?: number
  cfg_scale?: number
  sampler_name?: string
  seed?: number
}

export interface GenerateResponse {
  success: boolean
  task?: {
    id: string
  }
  error?: string
}

export interface ProgressResponse {
  progress: number
  current_image: string | null
}

export interface DeleteAssetRequest {
  id: string
}

export interface UpdateAssetRequest {
  id: string
  isFavorite: boolean
}

export interface DeleteTaskRequest {
  id: string
}
