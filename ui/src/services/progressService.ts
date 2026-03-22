import apiClient from './apiClient'
import type { ProgressData } from '@/types'

export async function getProgress(skipCurrentImage: boolean = false): Promise<ProgressData> {
  const response = await apiClient.get<ProgressData>('/api/progress', {
    params: { skip_current_image: skipCurrentImage },
  })
  return response.data
}
