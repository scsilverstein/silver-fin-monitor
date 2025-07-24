// Smart Caching System with Prefetching and Optimization
import { useCallback, useEffect, useRef, useState } from 'react';

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  tags: string[];
  dependencies: string[];
  expiresAt?: number;
  stale?: boolean;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  priority?: 'low' | 'normal' | 'high' | 'critical';
  tags?: string[];
  dependencies?: string[];
  staleWhileRevalidate?: boolean;
  maxAge?: number;
  maxSize?: number;
  serialize?: boolean;
}

export interface PrefetchRule {
  pattern: RegExp | string;
  prefetchKeys: (key: string) => string[];
  condition?: () => boolean;
  priority?: 'low' | 'normal' | 'high';
  delay?: number;
}

class SmartCacheService {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 100 * 1024 * 1024; // 100MB default
  private currentSize = 0;
  private accessLog = new Map<string, number[]>();
  private prefetchRules: PrefetchRule[] = [];
  private prefetchQueue = new Set<string>();
  private revalidationQueue = new Set<string>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metrics = {
    hits: 0,
    misses: 0,
    prefetchHits: 0,
    evictions: 0,
    totalRequests: 0,
  };

  constructor(maxSize = 100 * 1024 * 1024) {
    this.maxSize = maxSize;
    this.startCleanup();
    this.registerDefaultPrefetchRules();
  }

  // Get cached data
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.metrics.totalRequests++;
      this.triggerPrefetch(key);
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.metrics.misses++;
      this.metrics.totalRequests++;
      return null;
    }

    // Update access info
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.updateAccessLog(key);

    // Check if stale
    if (entry.stale) {
      this.scheduleRevalidation(key);
    }

    this.metrics.hits++;
    this.metrics.totalRequests++;
    this.triggerPrefetch(key);

    return entry.data;
  }

  // Set cached data
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const size = this.calculateSize(data);
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      lastAccessed: now,
      accessCount: 1,
      size,
      priority: options.priority || 'normal',
      tags: options.tags || [],
      dependencies: options.dependencies || [],
      expiresAt: options.ttl ? now + options.ttl : options.maxAge ? now + options.maxAge : undefined,
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.currentSize -= this.cache.get(key)!.size;
    }

    // Ensure we have space
    this.ensureSpace(size);

    this.cache.set(key, entry);
    this.currentSize += size;
    this.updateAccessLog(key);
  }

  // Delete cached data
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
      this.accessLog.delete(key);
      return true;
    }
    return false;
  }

  // Clear cache by tags
  clearByTag(tag: string): number {
    let cleared = 0;
    for (const [key, entry] of this.cache) {
      if (entry.tags.includes(tag)) {
        this.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  // Invalidate dependencies
  invalidateDependencies(dependency: string): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache) {
      if (entry.dependencies.includes(dependency)) {
        entry.stale = true;
        invalidated++;
      }
    }
    return invalidated;
  }

  // Prefetch data
  async prefetch<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<void> {
    if (this.cache.has(key) || this.prefetchQueue.has(key)) {
      return;
    }

    this.prefetchQueue.add(key);

    try {
      // Add delay for non-critical prefetches
      if (options.priority !== 'critical' && options.priority !== 'high') {
        await this.waitForIdle();
      }

      const data = await fetcher();
      this.set(key, data, options);
      this.metrics.prefetchHits++;
    } catch (error) {
      console.warn(`Prefetch failed for key: ${key}`, error);
    } finally {
      this.prefetchQueue.delete(key);
    }
  }

  // Preload related data
  async preload<T>(keys: string[], fetcher: (key: string) => Promise<T>, options: CacheOptions = {}): Promise<void> {
    const uncachedKeys = keys.filter(key => !this.cache.has(key));
    
    if (uncachedKeys.length === 0) return;

    // Batch load with concurrency control
    const batchSize = 3;
    for (let i = 0; i < uncachedKeys.length; i += batchSize) {
      const batch = uncachedKeys.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (key) => {
          try {
            const data = await fetcher(key);
            this.set(key, data, options);
          } catch (error) {
            console.warn(`Preload failed for key: ${key}`, error);
          }
        })
      );

      // Yield control between batches
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Register prefetch rule
  addPrefetchRule(rule: PrefetchRule): void {
    this.prefetchRules.push(rule);
  }

  // Trigger prefetch based on rules
  private triggerPrefetch(accessedKey: string): void {
    for (const rule of this.prefetchRules) {
      const matches = typeof rule.pattern === 'string' 
        ? accessedKey.includes(rule.pattern)
        : rule.pattern.test(accessedKey);

      if (matches && (!rule.condition || rule.condition())) {
        const keysToPreload = rule.prefetchKeys(accessedKey);
        
        setTimeout(() => {
          keysToPreload.forEach(key => {
            if (!this.cache.has(key) && !this.prefetchQueue.has(key)) {
              // This would need to be connected to your data fetching layer
              this.schedulePrefetch(key, rule.priority || 'low');
            }
          });
        }, rule.delay || 0);
      }
    }
  }

  // Schedule prefetch (placeholder - would need data fetching integration)
  private schedulePrefetch(key: string, priority: 'low' | 'normal' | 'high'): void {
    // This would be integrated with your API layer
    console.log(`Scheduling prefetch for ${key} with priority ${priority}`);
  }

  // Calculate data size
  private calculateSize(data: any): number {
    if (data === null || data === undefined) return 0;
    
    if (typeof data === 'string') {
      return data.length * 2; // UTF-16
    }
    
    if (typeof data === 'object') {
      try {
        return JSON.stringify(data).length * 2;
      } catch {
        return 1000; // Fallback estimate
      }
    }
    
    return 100; // Default estimate for primitives
  }

  // Ensure we have space for new entry
  private ensureSpace(requiredSize: number): void {
    if (this.currentSize + requiredSize <= this.maxSize) {
      return;
    }

    // LRU + Priority eviction strategy
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, ...entry }))
      .sort((a, b) => {
        // Priority first
        const priorityWeight = { low: 1, normal: 2, high: 3, critical: 4 };
        const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then by access frequency and recency
        const aScore = a.accessCount * 0.3 + (Date.now() - a.lastAccessed) * -0.7;
        const bScore = b.accessCount * 0.3 + (Date.now() - b.lastAccessed) * -0.7;
        
        return aScore - bScore;
      });

    // Evict entries until we have space
    let freedSpace = 0;
    for (const entry of entries) {
      if (freedSpace >= requiredSize) break;
      
      freedSpace += entry.size;
      this.delete(entry.key);
      this.metrics.evictions++;
    }
  }

  // Update access log for analytics
  private updateAccessLog(key: string): void {
    const now = Date.now();
    const log = this.accessLog.get(key) || [];
    log.push(now);
    
    // Keep only last 100 accesses
    if (log.length > 100) {
      log.splice(0, log.length - 100);
    }
    
    this.accessLog.set(key, log);
  }

  // Schedule revalidation for stale data
  private scheduleRevalidation(key: string): void {
    if (this.revalidationQueue.has(key)) return;
    
    this.revalidationQueue.add(key);
    
    // Revalidate in background
    setTimeout(() => {
      this.revalidationQueue.delete(key);
      // This would trigger a background refresh
      console.log(`Revalidating stale data for key: ${key}`);
    }, 100);
  }

  // Wait for browser idle time
  private waitForIdle(): Promise<void> {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 16); // Fallback to next frame
      }
    });
  }

  // Register default prefetch rules
  private registerDefaultPrefetchRules(): void {
    // Dashboard data prefetching
    this.addPrefetchRule({
      pattern: /^dashboard/,
      prefetchKeys: (key) => [
        'dashboard:widgets',
        'dashboard:metrics',
        'dashboard:charts'
      ],
      condition: () => true,
      priority: 'normal'
    });

    // List item prefetching
    this.addPrefetchRule({
      pattern: /^feeds:page:(\d+)/,
      prefetchKeys: (key) => {
        const match = key.match(/^feeds:page:(\d+)/);
        if (match) {
          const page = parseInt(match[1]);
          return [
            `feeds:page:${page + 1}`,
            `feeds:page:${page + 2}`
          ];
        }
        return [];
      },
      condition: () => true,
      priority: 'low',
      delay: 500
    });

    // Related content prefetching
    this.addPrefetchRule({
      pattern: /^content:(\d+)/,
      prefetchKeys: (key) => {
        const match = key.match(/^content:(\d+)/);
        if (match) {
          const id = parseInt(match[1]);
          return [
            `content:${id + 1}`,
            `content:${id - 1}`,
            `content:related:${id}`
          ];
        }
        return [];
      },
      condition: () => true,
      priority: 'low',
      delay: 1000
    });
  }

  // Start cleanup interval
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  // Get cache statistics
  getStats() {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests) * 100 
      : 0;

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      utilizationPercent: Math.round((this.currentSize / this.maxSize) * 100),
      totalEntries: this.cache.size,
      prefetchQueueSize: this.prefetchQueue.size,
      revalidationQueueSize: this.revalidationQueue.size,
    };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.accessLog.clear();
    this.currentSize = 0;
    this.prefetchQueue.clear();
    this.revalidationQueue.clear();
  }

  // Destroy cache service
  destroy(): void {
    this.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global cache instance
const smartCache = new SmartCacheService();

// React hook for using smart cache
export const useSmartCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & {
    enabled?: boolean;
    refetchOnMount?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  } = {}
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async (force = false) => {
    if (!options.enabled && options.enabled !== undefined) return;

    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (!force) {
        const cached = smartCache.get<T>(key);
        if (cached) {
          setData(cached);
          setLoading(false);
          return cached;
        }
      }

      // Check stale time
      if (!force && options.staleTime && Date.now() - lastFetch < options.staleTime) {
        setLoading(false);
        return data;
      }

      // Fetch fresh data
      const result = await fetcherRef.current();
      smartCache.set(key, result, options);
      setData(result);
      setLastFetch(Date.now());
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      // Return stale data if available
      const staleData = smartCache.get<T>(key);
      if (staleData) {
        setData(staleData);
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [key, options, lastFetch, data]);

  // Initial fetch
  useEffect(() => {
    if (options.refetchOnMount !== false) {
      fetchData();
    }
  }, [fetchData, options.refetchOnMount]);

  // Refetch interval
  useEffect(() => {
    if (options.refetchInterval) {
      const interval = setInterval(() => {
        fetchData();
      }, options.refetchInterval);

      return () => clearInterval(interval);
    }
  }, [fetchData, options.refetchInterval]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);
  
  const invalidate = useCallback(() => {
    smartCache.delete(key);
    setData(null);
    setLastFetch(0);
  }, [key]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidate,
    isStale: options.staleTime ? Date.now() - lastFetch > options.staleTime : false,
  };
};

// Cache utilities
export const cacheUtils = {
  // Preload multiple keys
  preload: <T>(keys: string[], fetcher: (key: string) => Promise<T>, options?: CacheOptions) => {
    return smartCache.preload(keys, fetcher, options);
  },

  // Prefetch single key
  prefetch: <T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions) => {
    return smartCache.prefetch(key, fetcher, options);
  },

  // Clear by tag
  clearByTag: (tag: string) => {
    return smartCache.clearByTag(tag);
  },

  // Invalidate dependencies
  invalidateDependencies: (dependency: string) => {
    return smartCache.invalidateDependencies(dependency);
  },

  // Get cache stats
  getStats: () => {
    return smartCache.getStats();
  },

  // Add prefetch rule
  addPrefetchRule: (rule: PrefetchRule) => {
    smartCache.addPrefetchRule(rule);
  },
};

export default smartCache;