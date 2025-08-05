import { DatabaseService } from '../database/db.service';
import winston from 'winston';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  compress?: boolean; // Whether to compress large values
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
}

export class CacheService {
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor(
    private db: DatabaseService,
    private logger: winston.Logger
  ) {}

  // Get value from cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.db.query<{ value: any }>(
        'SELECT cache_get($1) as value',
        [key]
      );

      const value = result[0]?.value;
      
      if (value) {
        this.stats.hits++;
        this.logger.debug(`Cache hit: ${key}`);
        return value as T;
      } else {
        this.stats.misses++;
        this.logger.debug(`Cache miss: ${key}`);
        return null;
      }
    } catch (error) {
      this.logger.error('Cache get error:', error);
      return null;
    }
  }

  // Set value in cache
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const ttl = options.ttl || 3600; // Default 1 hour
      
      await this.db.query(
        'SELECT cache_set($1, $2, $3)',
        [key, JSON.stringify(value), ttl]
      );

      // Store tags if provided
      if (options.tags && options.tags.length > 0) {
        await this.storeTags(key, options.tags);
      }

      this.logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error('Cache set error:', error);
    }
  }

  // Delete from cache
  async delete(key: string): Promise<void> {
    try {
      await this.db.query('SELECT cache_delete($1)', [key]);
      this.logger.debug(`Cache delete: ${key}`);
    } catch (error) {
      this.logger.error('Cache delete error:', error);
    }
  }

  // Delete multiple keys
  async deleteMany(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.delete(key));
    await Promise.all(promises);
  }

  // Delete by pattern
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const result = await this.db.query<{ count: number }>(
        `DELETE FROM cache_store 
         WHERE key LIKE $1 
         RETURNING key`,
        [pattern]
      );
      
      const count = result.length;
      this.logger.info(`Deleted ${count} cache entries matching pattern: ${pattern}`);
      return count;
    } catch (error) {
      this.logger.error('Cache delete by pattern error:', error);
      return 0;
    }
  }

  // Delete by tags
  async deleteByTags(tags: string[]): Promise<number> {
    try {
      const result = await this.db.query<{ key: string }>(
        `DELETE FROM cache_store 
         WHERE key IN (
           SELECT DISTINCT cache_key 
           FROM cache_tags 
           WHERE tag = ANY($1)
         )
         RETURNING key`,
        [tags]
      );
      
      const count = result.length;
      this.logger.info(`Deleted ${count} cache entries with tags: ${tags.join(', ')}`);
      return count;
    } catch (error) {
      this.logger.error('Cache delete by tags error:', error);
      return 0;
    }
  }

  // Cache-aside pattern helper
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    let cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetchFn();
    
    // Store in cache
    await this.set(key, fresh, options);
    
    return fresh;
  }

  // Multi-get
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    const promises = keys.map(async key => {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    });

    await Promise.all(promises);
    return results;
  }

  // Multi-set
  async setMany<T>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>
  ): Promise<void> {
    const promises = entries.map(entry =>
      this.set(entry.key, entry.value, entry.options)
    );
    await Promise.all(promises);
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      await this.db.query('TRUNCATE TABLE cache_store');
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  // Get cache statistics
  async getStats(): Promise<CacheStats> {
    try {
      const result = await this.db.query<{ 
        total_keys: number; 
        total_size: number;
      }>(
        `SELECT 
          COUNT(*) as total_keys,
          COALESCE(SUM(pg_column_size(value)), 0) as total_size
         FROM cache_store 
         WHERE expires_at > NOW()`
      );

      const hitRate = this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys: result[0]?.total_keys || 0,
        memoryUsage: result[0]?.total_size || 0
      };
    } catch (error) {
      this.logger.error('Get cache stats error:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 0
      };
    }
  }

  // Cleanup expired entries
  async cleanup(): Promise<number> {
    try {
      const result = await this.db.query<{ count: number }>(
        'SELECT cleanup_expired_data() as count'
      );
      
      const count = result[0]?.count || 0;
      this.logger.info(`Cleaned up ${count} expired cache entries`);
      return count;
    } catch (error) {
      this.logger.error('Cache cleanup error:', error);
      return 0;
    }
  }

  // Store cache tags
  private async storeTags(key: string, tags: string[]): Promise<void> {
    try {
      if (tags.length === 0) return;
      
      // Use parameterized queries to avoid SQL injection
      for (const tag of tags) {
        await this.db.query(
          `INSERT INTO cache_tags (cache_key, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [key, tag]
        );
      }
    } catch (error) {
      this.logger.error('Store cache tags error:', error);
    }
  }

  // Generate cache key with namespace
  generateKey(namespace: string, ...parts: any[]): string {
    const keyParts = [namespace, ...parts.map(p => String(p))];
    return keyParts.join(':');
  }

  // Generate hash key for complex objects
  generateHashKey(namespace: string, obj: any): string {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(obj))
      .digest('hex')
      .substring(0, 16);
    return `${namespace}:${hash}`;
  }

  // Warm cache with predefined data
  async warmCache(
    warmupFunctions: Array<{
      key: string;
      fetchFn: () => Promise<any>;
      options?: CacheOptions;
    }>
  ): Promise<void> {
    this.logger.info('Starting cache warmup...');
    
    const promises = warmupFunctions.map(async ({ key, fetchFn, options }) => {
      try {
        const data = await fetchFn();
        await this.set(key, data, options);
        this.logger.debug(`Warmed cache: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to warm cache for ${key}:`, error);
      }
    });

    await Promise.all(promises);
    this.logger.info('Cache warmup completed');
  }

  // Invalidation patterns
  async invalidatePattern(pattern: string): Promise<void> {
    await this.deleteByPattern(pattern);
  }

  async invalidateTags(tags: string[]): Promise<void> {
    await this.deleteByTags(tags);
  }

  // Reset statistics
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
  }
}

// Cache key builders for common use cases
export class CacheKeys {
  static feedSource(id: string): string {
    return `feed_source:${id}`;
  }

  static processedContent(id: string): string {
    return `processed_content:${id}`;
  }

  static dailyAnalysis(date: string): string {
    return `daily_analysis:${date}`;
  }

  static prediction(id: string): string {
    return `prediction:${id}`;
  }

  static stockData(symbol: string, date: string): string {
    return `stock_data:${symbol}:${date}`;
  }

  static technicalIndicator(symbol: string, indicator: string, date: string): string {
    return `technical:${symbol}:${indicator}:${date}`;
  }

  static userSession(userId: string): string {
    return `session:${userId}`;
  }

  static apiResponse(endpoint: string, params: any): string {
    const paramHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex')
      .substring(0, 8);
    return `api:${endpoint}:${paramHash}`;
  }
}

export default CacheService;