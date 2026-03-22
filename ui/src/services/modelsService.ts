import apiClient from './apiClient'
import { apiCache, cacheKeys } from '@/lib/cache'
import { UI_CONSTANTS } from '@/constants'
import type { Model } from '@/types'

interface CachedModels {
  data: Model[]
  timestamp: number
}

export async function getModels(forceRefresh = false): Promise<Model[]> {
  if (!forceRefresh) {
    const cached = apiCache.get<CachedModels>(cacheKeys.models)
    if (cached && Date.now() - cached.timestamp < UI_CONSTANTS.CACHE.MODELS_TTL) {
      return cached.data
    }
  }

  const response = await apiClient.get<Model[]>('/api/models')
  const data = response.data

  apiCache.set(cacheKeys.models, {
    data,
    timestamp: Date.now(),
  } as CachedModels)

  return data
}

export function invalidateModelsCache(): void {
  apiCache.invalidate(cacheKeys.models)
}
