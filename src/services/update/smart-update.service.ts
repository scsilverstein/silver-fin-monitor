import { Database } from '../../types';
import { CacheService } from '../cache/cache.service';
import { Logger } from 'winston';
import { queueService } from '../database/queue';

export interface UpdateStrategy {
  cacheFirst: boolean;
  backgroundRefresh: boolean;
  staleWhileRevalidate: boolean;
  maxStaleAge: number; // milliseconds
  minRefreshInterval: number; // milliseconds
  ttl?: number; // cache TTL in seconds
}

export interface UpdateResult<T> {
  data: T;
  isStale: boolean;
  updating: boolean;
  cacheHit: boolean;
  lastUpdated?: Date;
}

export interface UpdateContext {
  type: 'feed' | 'analysis' | 'prediction' | 'stock';
  id: string;
  userId?: string;
}

// Default strategies for different data types
export const UpdateStrategies = {
  // Live data - aggressive updates
  LIVE_FEED: {
    cacheFirst: true,
    backgroundRefresh: true,
    staleWhileRevalidate: true,
    maxStaleAge: 5 * 60 * 1000, // 5 minutes
    minRefreshInterval: 60 * 1000, // 1 minute
    ttl: 300 // 5 minutes
  },
  
  // Today's analysis - moderate updates
  TODAY_ANALYSIS: {
    cacheFirst: true,
    backgroundRefresh: true,
    staleWhileRevalidate: true,
    maxStaleAge: 60 * 60 * 1000, // 1 hour
    minRefreshInterval: 5 * 60 * 1000, // 5 minutes
    ttl: 3600 // 1 hour
  },
  
  // Historical data - rarely changes
  HISTORICAL: {
    cacheFirst: true,
    backgroundRefresh: false,
    staleWhileRevalidate: false,
    maxStaleAge: 24 * 60 * 60 * 1000, // 24 hours
    minRefreshInterval: 60 * 60 * 1000, // 1 hour
    ttl: 86400 // 24 hours
  },
  
  // User-triggered refresh
  FORCE_REFRESH: {
    cacheFirst: false,
    backgroundRefresh: false,
    staleWhileRevalidate: false,
    maxStaleAge: 0,
    minRefreshInterval: 0,
    ttl: 3600
  }
};

export class SmartUpdateService {
  private updateInProgress = new Map<string, Promise<any>>();
  private lastUpdateTime = new Map<string, number>();
  private updateQueue = new Map<string, NodeJS.Timeout>();
  
  constructor(
    private db: Database,
    private cache: CacheService,
    private logger: Logger
  ) {}
  
  /**
   * Get data with smart update logic
   */
  async getDataWithUpdate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    strategy: UpdateStrategy,
    context?: UpdateContext
  ): Promise<UpdateResult<T>> {
    try {
      // 1. Check cache first
      const cached = await this.cache.get<T>(key);
      const cacheMetadata = await this.getCacheMetadata(key);
      const isStale = this.isDataStale(cacheMetadata, strategy);
      
      // 2. Return fresh cache immediately
      if (cached && !isStale) {
        this.logger.debug('Cache hit - fresh data', { key, age: cacheMetadata.age });
        
        // Schedule proactive refresh if needed
        if (strategy.backgroundRefresh) {
          this.scheduleProactiveRefresh(key, fetchFn, strategy, context);
        }
        
        return {
          data: cached,
          isStale: false,
          updating: false,
          cacheHit: true,
          lastUpdated: cacheMetadata.createdAt
        };
      }
      
      // 3. Handle stale-while-revalidate
      if (cached && strategy.staleWhileRevalidate) {
        this.logger.debug('Serving stale data while revalidating', { key });
        
        // Trigger background update
        this.triggerBackgroundUpdate(key, fetchFn, strategy, context);
        
        return {
          data: cached,
          isStale: true,
          updating: true,
          cacheHit: true,
          lastUpdated: cacheMetadata.createdAt
        };
      }
      
      // 4. Fetch fresh data (with deduplication)
      this.logger.debug('Cache miss or expired - fetching fresh data', { key });
      const data = await this.fetchWithDeduplication(key, fetchFn, strategy, context);
      
      return {
        data,
        isStale: false,
        updating: false,
        cacheHit: false,
        lastUpdated: new Date()
      };
      
    } catch (error) {
      this.logger.error('Smart update failed', { key, error });
      
      // Try to return stale data on error
      const cached = await this.cache.get<T>(key);
      if (cached) {
        return {
          data: cached,
          isStale: true,
          updating: false,
          cacheHit: true,
          lastUpdated: new Date()
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Fetch data with request deduplication
   */
  private async fetchWithDeduplication<T>(
    key: string,
    fetchFn: () => Promise<T>,
    strategy: UpdateStrategy,
    context?: UpdateContext
  ): Promise<T> {
    // Check if update is already in progress
    const inProgress = this.updateInProgress.get(key);
    if (inProgress) {
      this.logger.debug('Update already in progress - waiting', { key });
      return inProgress;
    }
    
    // Check minimum refresh interval
    const lastUpdate = this.lastUpdateTime.get(key) || 0;
    const timeSinceUpdate = Date.now() - lastUpdate;
    
    if (timeSinceUpdate < strategy.minRefreshInterval) {
      this.logger.debug('Too soon to update - returning cached data', { 
        key, 
        timeSinceUpdate, 
        minInterval: strategy.minRefreshInterval 
      });
      
      const cached = await this.cache.get<T>(key);
      if (cached) return cached;
    }
    
    // Start new update
    const updatePromise = this.performUpdate(key, fetchFn, strategy);
    this.updateInProgress.set(key, updatePromise);
    
    try {
      const result = await updatePromise;
      this.lastUpdateTime.set(key, Date.now());
      
      // Track update metrics
      if (context) {
        await this.trackUpdateMetrics(context, 'success');
      }
      
      return result;
    } catch (error) {
      // Track failure metrics
      if (context) {
        await this.trackUpdateMetrics(context, 'failure');
      }
      throw error;
    } finally {
      this.updateInProgress.delete(key);
    }
  }
  
  /**
   * Perform the actual update
   */
  private async performUpdate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    strategy: UpdateStrategy
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const data = await fetchFn();
      
      // Cache the result
      await this.cache.set(key, data, { ttl: strategy.ttl || 3600 });
      
      // Store metadata
      await this.setCacheMetadata(key, {
        createdAt: new Date(),
        fetchDuration: Date.now() - startTime
      });
      
      this.logger.debug('Update completed', { 
        key, 
        duration: Date.now() - startTime 
      });
      
      return data;
    } catch (error) {
      this.logger.error('Update failed', { key, error });
      throw error;
    }
  }
  
  /**
   * Trigger background update without waiting
   */
  private triggerBackgroundUpdate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    strategy: UpdateStrategy,
    context?: UpdateContext
  ): void {
    // Queue the update to avoid thundering herd
    const existingTimeout = this.updateQueue.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      this.fetchWithDeduplication(key, fetchFn, strategy, context)
        .catch(error => {
          this.logger.error('Background update failed', { key, error });
        })
        .finally(() => {
          this.updateQueue.delete(key);
        });
    }, 100); // Small delay to batch requests
    
    this.updateQueue.set(key, timeout);
  }
  
  /**
   * Schedule proactive refresh before data becomes stale
   */
  private scheduleProactiveRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    strategy: UpdateStrategy,
    context?: UpdateContext
  ): void {
    const cacheAge = this.getCacheAge(key);
    const timeUntilStale = strategy.maxStaleAge - cacheAge;
    const refreshTime = timeUntilStale * 0.8; // Refresh at 80% of max age
    
    if (refreshTime > 0) {
      setTimeout(() => {
        this.triggerBackgroundUpdate(key, fetchFn, strategy, context);
      }, refreshTime);
    }
  }
  
  /**
   * Check if data is stale
   */
  private isDataStale(
    metadata: { age: number; createdAt?: Date },
    strategy: UpdateStrategy
  ): boolean {
    return metadata.age > strategy.maxStaleAge;
  }
  
  /**
   * Get cache metadata
   */
  private async getCacheMetadata(key: string): Promise<{
    age: number;
    createdAt?: Date;
  }> {
    const metaKey = `${key}:meta`;
    const meta = await this.cache.get<{ createdAt: string; fetchDuration: number }>(metaKey);
    
    if (meta) {
      const createdAt = new Date(meta.createdAt);
      return {
        age: Date.now() - createdAt.getTime(),
        createdAt
      };
    }
    
    return { age: Infinity };
  }
  
  /**
   * Set cache metadata
   */
  private async setCacheMetadata(
    key: string,
    metadata: { createdAt: Date; fetchDuration: number }
  ): Promise<void> {
    const metaKey = `${key}:meta`;
    await this.cache.set(metaKey, metadata, { ttl: 86400 }); // 24 hour TTL
  }
  
  /**
   * Get cache age in milliseconds
   */
  private getCacheAge(key: string): number {
    const lastUpdate = this.lastUpdateTime.get(key);
    return lastUpdate ? Date.now() - lastUpdate : Infinity;
  }
  
  /**
   * Track update metrics for monitoring
   */
  private async trackUpdateMetrics(
    context: UpdateContext,
    status: 'success' | 'failure'
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO update_metrics 
         (type, resource_id, user_id, status, timestamp)
         VALUES ($1, $2, $3, $4, NOW())`,
        [context.type, context.id, context.userId || null, status]
      );
    } catch (error) {
      this.logger.error('Failed to track update metrics', { error });
    }
  }
  
  /**
   * Clear cache and force refresh
   */
  async invalidateAndRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Clear cache
    await this.cache.delete(key);
    await this.cache.delete(`${key}:meta`);
    
    // Clear tracking
    this.lastUpdateTime.delete(key);
    this.updateInProgress.delete(key);
    
    // Fetch fresh data
    return this.fetchWithDeduplication(key, fetchFn, UpdateStrategies.FORCE_REFRESH);
  }
  
  /**
   * Batch update multiple keys
   */
  async batchUpdate<T>(
    updates: Array<{
      key: string;
      fetchFn: () => Promise<T>;
      strategy: UpdateStrategy;
    }>
  ): Promise<Map<string, UpdateResult<T>>> {
    const results = new Map<string, UpdateResult<T>>();
    
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async ({ key, fetchFn, strategy }) => {
          try {
            const result = await this.getDataWithUpdate(key, fetchFn, strategy);
            return { key, result };
          } catch (error) {
            this.logger.error('Batch update failed for key', { key, error });
            return { key, error };
          }
        })
      );
      
      batchResults.forEach(({ key, result, error }) => {
        if (!error) {
          results.set(key, result);
        }
      });
    }
    
    return results;
  }
}

// Create singleton instance
export const createSmartUpdateService = (
  db: Database,
  cache: CacheService,
  logger: Logger
): SmartUpdateService => {
  return new SmartUpdateService(db, cache, logger);
};