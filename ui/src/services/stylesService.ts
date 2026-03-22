import apiClient from './apiClient'
import type { Style } from '@/types'

export async function getStyles(): Promise<Style[]> {
  const response = await apiClient.get<Style[]>('/api/styles')
  return response.data
}
