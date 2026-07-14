// ─── Backend reference-data cache ────────────────────────────────────────────
// In-memory TTL cache for read-only reference tables that change infrequently.
//
// Cached tables: operators, hosts, routes, vehicles, models
// NOT cached:    demo_master, demo_backlog, post_demo, notification_log
//
// TTL: 10 minutes (config.cache.ttlMs)
// Invalidation: call refCache.invalidate(key) or refCache.invalidatePrefix(prefix)
//   after any write to a reference table.

import { config } from './config/index.js'

interface CacheEntry<T> {
  data:      T
  expiresAt: number
}

class RefCache {
  private readonly store = new Map<string, CacheEntry<unknown>>()
  private readonly ttl:   number

  constructor(ttlMs: number) {
    this.ttl = ttlMs
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.data
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, expiresAt: Date.now() + this.ttl })
  }

  /** Remove one specific cache entry. */
  invalidate(key: string): void {
    this.store.delete(key)
  }

  /** Remove all entries whose key starts with `prefix`. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix + ':')) this.store.delete(key)
    }
  }

  /** Wipe the entire cache (e.g. after a bulk admin operation). */
  invalidateAll(): void {
    this.store.clear()
  }

  /** Current number of live (non-expired) entries — for health/debug. */
  size(): number {
    const now = Date.now()
    let count = 0
    for (const entry of this.store.values()) {
      if (now <= entry.expiresAt) count++
    }
    return count
  }
}

// Singleton — one cache shared across all requests
export const refCache = new RefCache(config.cache.ttlMs)
