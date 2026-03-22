import apiClient from './apiClient'
import type { GenerateRequestPayload } from '@/types/api'

export interface GeneratePayload extends GenerateRequestPayload {
  sampler_name?: string
  scheduler?: string
  batch_size?: number
}

export async function generate(payload: GeneratePayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ success: boolean; task?: { id: string }; error?: string }>(
    '/api/generate',
    {
      ...payload,
      negative_prompt: payload.negative_prompt || '',
    }
  )
  if (!response.data.success || !response.data.task) {
    throw new Error(response.data.error || 'Failed to create task')
  }
  return { id: response.data.task.id }
}
