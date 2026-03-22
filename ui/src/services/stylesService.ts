import apiClient from './apiClient'
import { apiCache, cacheKeys } from '@/lib/cache'
import { UI_CONSTANTS } from '@/constants'
import type { Style } from '@/types'

interface CachedStyles {
  data: Style[]
  timestamp: number
}

export async function getStyles(forceRefresh = false): Promise<Style[]> {
  if (!forceRefresh) {
    const cached = apiCache.get<CachedStyles>(cacheKeys.styles)
    if (cached && Date.now() - cached.timestamp < UI_CONSTANTS.CACHE.STYLES_TTL) {
      return cached.data
    }
  }

  const response = await apiClient.get<Style[]>('/api/styles')
  const data = response.data

  apiCache.set(cacheKeys.styles, {
    data,
    timestamp: Date.now(),
  } as CachedStyles)

  return data
}

export function invalidateStylesCache(): void {
  apiCache.invalidate(cacheKeys.styles)
}
