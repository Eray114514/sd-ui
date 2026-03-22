import apiClient from './apiClient'
import type { Model } from '@/types'

export async function getModels(): Promise<Model[]> {
  const response = await apiClient.get<Model[]>('/api/models')
  return response.data
}
