import apiClient from './apiClient'
import type { Task } from '@/types'
import { apiCache } from '@/lib/cache'

const TASKS_CACHE_KEY = 'api:tasks'
const LOCAL_STORAGE_KEY = 'tasks_cache'
const CACHE_EXPIRY = 1000 * 60 * 5 // 5分钟缓存

export async function getTasks(): Promise<Task[]> {
  // 尝试从内存缓存获取
  const cachedTasks = apiCache.get<Task[]>(TASKS_CACHE_KEY)
  if (cachedTasks) {
    return cachedTasks
  }

  // 尝试从localStorage获取（仅在客户端）
  if (typeof window !== 'undefined') {
    try {
      const storedData = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (storedData) {
        const { tasks, timestamp } = JSON.parse(storedData)
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          // 缓存有效，同时更新内存缓存
          apiCache.set(TASKS_CACHE_KEY, tasks)
          return tasks
        }
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error)
    }
  }

  const response = await apiClient.get<Task[]>('/api/tasks', {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })

  // 缓存任务数据
  apiCache.set(TASKS_CACHE_KEY, response.data)
  
  // 存储到localStorage（仅在客户端）
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        tasks: response.data,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }

  return response.data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete('/api/tasks', { data: { id } })
  // 删除任务后清除缓存
  clearTasksCache()
}

// 手动清除任务缓存
export function clearTasksCache(): void {
  apiCache.invalidate(TASKS_CACHE_KEY)
  // 仅在客户端清除localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }
}
