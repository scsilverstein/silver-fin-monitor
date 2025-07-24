// Database-based cache service implementation following CLAUDE.md specification
import { Cache, Result } from '@/types';
import { db } from '@/services/database';
import { createContextLogger } from '@/utils/logger';
import config from '@/config';

const cacheLogger = createContextLogger('Cache');

export class DatabaseCacheService implements Cache {
  private defaultTtl: number;

  constructor(defaultTtl: number = config.cache.defaultTtl) {
    this.defaultTtl = defaultTtl;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      cacheLogger.debug('Cache get operation', { key });
      
      // Use the database function for cache retrieval
      const result = await db.query<{ value: T }>('SELECT cache_get($1) as value', [key]);
      
      if (!result || result.length === 0 || result[0]?.value === null) {
        cacheLogger.debug('Cache miss', { key });
        return null;
      }

      cacheLogger.debug('Cache hit', { key });
      return result[0]!.value;
    } catch (error) {
      // Silently handle database function not available errors
      if (error instanceof Error && error.message === 'DATABASE_FUNCTIONS_NOT_AVAILABLE') {
        // Cache functions not available, return null
        return null;
      }
      cacheLogger.error('Cache get error', { key, error });
      // Return null on cache errors to gracefully fallback
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTtl): Promise<void> {
    try {
      cacheLogger.debug('Cache set operation', { key, ttl });
      
      // Use the database function for cache storage
      await db.query('SELECT cache_set($1, $2, $3)', [
        key,
        JSON.stringify(value),
        ttl
      ]);
      
      cacheLogger.debug('Cache set successful', { key });
    } catch (error) {
      // Silently handle database function not available errors
      if (error instanceof Error && error.message === 'DATABASE_FUNCTIONS_NOT_AVAILABLE') {
        // Cache functions not available, skip caching
        return;
      }
      cacheLogger.error('Cache set error', { key, error });
      // Don't throw cache errors to avoid breaking application flow
    }
  }

  async delete(key: string): Promise<void> {
    try {
      cacheLogger.debug('Cache delete operation', { key });
      
      // Use the database function for cache deletion
      await db.query('SELECT cache_delete($1)', [key]);
      
      cacheLogger.debug('Cache delete successful', { key });
    } catch (error) {
      // Silently handle database function not available errors
      if (error instanceof Error && error.message === 'DATABASE_FUNCTIONS_NOT_AVAILABLE') {
        // Cache functions not available, skip deletion
        return;
      }
      cacheLogger.error('Cache delete error', { key, error });
      // Don't throw cache errors
    }
  }

  async clear(): Promise<void> {
    try {
      cacheLogger.info('Cache clear operation');
      
      // Clear all cache entries
      await db.query('DELETE FROM cache_store');
      
      cacheLogger.info('Cache cleared successfully');
    } catch (error) {
      cacheLogger.error('Cache clear error', error);
      throw error;
    }
  }

  // Cache-aside pattern helper
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTtl
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - fetch fresh data
      cacheLogger.debug('Cache miss, fetching fresh data', { key });
      const fresh = await fetchFn();
      
      // Store in cache (fire and forget)
      this.set(key, fresh, ttl).catch(error => {
        cacheLogger.warn('Failed to cache result', { key, error });
      });
      
      return fresh;
    } catch (error) {
      cacheLogger.error('Cache getOrSet error', { key, error });
      throw error;
    }
  }

  // Tag-based invalidation
  async invalidateByTag(tag: string): Promise<void> {
    try {
      cacheLogger.debug('Cache tag invalidation', { tag });
      
      // Delete all cache entries with keys containing the tag
      await db.query('DELETE FROM cache_store WHERE key LIKE $1', [`%${tag}%`]);
      
      cacheLogger.debug('Cache tag invalidation successful', { tag });
    } catch (error) {
      cacheLogger.error('Cache tag invalidation error', { tag, error });
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    totalSize: number;
  }> {
    try {
      const [totalResult, expiredResult] = await Promise.all([
        db.query<{ count: number }>('SELECT COUNT(*) as count FROM cache_store'),
        db.query<{ count: number }>('SELECT COUNT(*) as count FROM cache_store WHERE expires_at < NOW()')
      ]);

      return {
        totalEntries: totalResult[0]?.count || 0,
        expiredEntries: expiredResult[0]?.count || 0,
        totalSize: 0 // Would need to calculate JSON size if needed
      };
    } catch (error) {
      cacheLogger.error('Failed to get cache stats', error);
      return { totalEntries: 0, expiredEntries: 0, totalSize: 0 };
    }
  }

  // Cleanup expired entries
  async cleanup(): Promise<void> {
    try {
      cacheLogger.debug('Cache cleanup operation');
      
      const result = await db.query<{ count: number }>('SELECT cleanup_expired_data() as count');
      const cleanedCount = result[0]?.count || 0;
      
      cacheLogger.info('Cache cleanup completed', { cleanedCount });
    } catch (error) {
      cacheLogger.error('Cache cleanup error', error);
    }
  }

  // Health check
  async healthCheck(): Promise<Result<boolean>> {
    try {
      const testKey = 'health_check_test';
      const testValue = { timestamp: Date.now() };
      
      await this.set(testKey, testValue, 60);
      const retrieved = await this.get(testKey);
      await this.delete(testKey);
      
      const isHealthy = retrieved !== null && 
                       (retrieved as any).timestamp === testValue.timestamp;
      
      return { success: true, data: isHealthy };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

// Cache key builders for consistency
export const cacheKeys = {
  feedSource: (id: string) => `feed_source:${id}`,
  feedContent: (id: string) => `feed_content:${id}`,
  dailyAnalysis: (date: string) => `daily_analysis:${date}`,
  predictions: (analysisId: string) => `predictions:${analysisId}`,
  processingStats: () => 'processing_stats',
  queueStats: () => 'queue_stats',
  feedList: (filter: string) => `feed_list:${filter}`,
  contentList: (filter: string) => `content_list:${filter}`,
};

// Cache TTL constants
export const cacheTtl = {
  short: 300,      // 5 minutes
  medium: 1800,    // 30 minutes
  long: 3600,      // 1 hour
  veryLong: 86400, // 24 hours
  queueStats: 60,  // 1 minute for queue stats
} as const;

// Create and export cache instance
export const cache = new DatabaseCacheService();

export default cache;