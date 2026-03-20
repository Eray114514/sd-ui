interface CacheEntry<T> {
  data: T
  timestamp: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private ttl: number

  constructor(ttlSeconds: number = 10) {
    this.ttl = ttlSeconds * 1000
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

export const apiCache = new MemoryCache(10)

export const cacheKeys = {
  models: 'api:models',
  styles: 'api:styles',
  assets: (cursor?: string) => cursor ? `api:assets:${cursor}` : 'api:assets',
  settings: 'api:settings',
} as const
