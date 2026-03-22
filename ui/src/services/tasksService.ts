import apiClient from './apiClient'
import type { Task } from '@/types'

export async function getTasks(): Promise<Task[]> {
  const response = await apiClient.get<Task[]>('/api/tasks', {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
  return response.data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete('/api/tasks', { data: { id } })
}
