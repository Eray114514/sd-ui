import apiClient from './apiClient'
import type { GenerateRequestPayload } from '@/types/api'

export interface GeneratePayload extends GenerateRequestPayload {
  sampler_name?: string
  scheduler?: string
  batch_size?: number
}

export async function generate(payload: GeneratePayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ 
    success: boolean; 
    data?: { task?: { id: string } }; 
    error?: { message: string } 
  }>(
    '/api/generate',
    {
      ...payload,
      negative_prompt: payload.negative_prompt || '',
    }
  )
  if (!response.data.success || !response.data.data?.task) {
    throw new Error(response.data.error?.message || 'Failed to create task')
  }
  return { id: response.data.data.task.id }
}
