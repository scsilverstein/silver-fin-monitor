import { Database } from '../../types';
import { CacheService } from '../cache/cache.service';
import { Logger } from 'winston';
import { queueService } from '../database/queue';
import { SmartUpdateService, UpdateStrategy, UpdateStrategies } from '../update/smart-update.service';

interface FeedUpdateConfig {
  maxConcurrentUpdates: number;
  batchSize: number;
  priorityBoost: number;
}

interface FeedSourceWithStatus {
  id: string;
  name: string;
  url: string;
  type: string;
  lastProcessedAt?: Date;
  updateFrequency: string;
  isActive: boolean;
  processingStatus?: 'idle' | 'processing' | 'failed';
  nextUpdateAt?: Date;
}

export class FeedUpdateService {
  private smartUpdater: SmartUpdateService;
  private activeUpdates = new Set<string>();
  private updateConfig: FeedUpdateConfig = {
    maxConcurrentUpdates: 3,
    batchSize: 10,
    priorityBoost: 2
  };
  
  constructor(
    private db: Database,
    private cache: CacheService,
    private logger: Logger
  ) {
    this.smartUpdater = new SmartUpdateService(db, cache, logger);
  }
  
  /**
   * Get feeds with smart update logic
   */
  async getFeedsWithUpdate(
    userId?: string,
    forceRefresh = false
  ): Promise<{
    feeds: FeedSourceWithStatus[];
    updating: string[];
    stale: string[];
  }> {
    const cacheKey = `feeds:all:${userId || 'public'}`;
    
    // Determine update strategy based on context
    const strategy = this.getUpdateStrategy(forceRefresh);
    
    const fetchFeeds = async (): Promise<FeedSourceWithStatus[]> => {
      // Get all active feeds
      const feeds = await this.db.query<FeedSourceWithStatus>(
        `SELECT 
          fs.*,
          (
            SELECT COUNT(*) 
            FROM raw_feeds rf 
            WHERE rf.source_id = fs.id 
            AND rf.created_at > NOW() - INTERVAL '24 hours'
          ) as recent_items,
          (
            SELECT MAX(created_at)
            FROM raw_feeds rf
            WHERE rf.source_id = fs.id
          ) as last_item_date
        FROM feed_sources fs
        WHERE fs.is_active = true
        ORDER BY fs.name`
      );
      
      // Check which feeds need updates
      const feedsWithStatus = await Promise.all(
        feeds.map(async (feed) => {
          const status = await this.checkFeedStatus(feed);
          return { ...feed, ...status };
        })
      );
      
      // Queue updates for stale feeds
      const staleFeeds = feedsWithStatus.filter(f => this.isFeedStale(f));
      if (staleFeeds.length > 0) {
        await this.queueFeedUpdates(staleFeeds, userId);
      }
      
      return feedsWithStatus;
    };
    
    // Use smart update service
    const result = await this.smartUpdater.getDataWithUpdate(
      cacheKey,
      fetchFeeds,
      strategy,
      { type: 'feed', id: 'all', userId }
    );
    
    // Identify updating and stale feeds
    const updating = result.data.filter(f => 
      f.processingStatus === 'processing' || this.activeUpdates.has(f.id)
    ).map(f => f.id);
    
    const stale = result.data.filter(f => 
      this.isFeedStale(f) && f.processingStatus !== 'processing'
    ).map(f => f.id);
    
    return {
      feeds: result.data,
      updating,
      stale
    };
  }
  
  /**
   * Trigger update for specific feed
   */
  async triggerFeedUpdate(
    feedId: string,
    userId?: string,
    priority = 'normal'
  ): Promise<{ jobId: string; estimatedTime: number }> {
    try {
      // Check if already updating
      if (this.activeUpdates.has(feedId)) {
        throw new Error('Feed update already in progress');
      }
      
      // Mark as updating
      this.activeUpdates.add(feedId);
      
      // Get feed details
      const feed = await this.db.query(
        'SELECT * FROM feed_sources WHERE id = $1',
        [feedId]
      );
      
      if (!feed[0]) {
        throw new Error('Feed not found');
      }
      
      // Calculate priority based on staleness and user request
      const priorityScore = this.calculatePriority(feed[0], priority === 'high');
      
      // Queue the update job
      const jobId = await queueService.enqueue('feed_sync', {
        sourceId: feedId,
        syncType: 'incremental',
        priority: priorityScore,
        requestedBy: userId,
        context: {
          userTriggered: true,
          timestamp: new Date()
        }
      }, priorityScore);
      
      // Estimate completion time based on feed type
      const estimatedTime = this.estimateUpdateTime(feed[0].type);
      
      // Clear feed from active updates after timeout
      setTimeout(() => {
        this.activeUpdates.delete(feedId);
      }, estimatedTime + 30000); // Add 30s buffer
      
      return { jobId, estimatedTime };
      
    } catch (error) {
      this.activeUpdates.delete(feedId);
      throw error;
    }
  }
  
  /**
   * Batch update multiple feeds
   */
  async batchUpdateFeeds(
    feedIds: string[],
    userId?: string
  ): Promise<Map<string, { jobId: string; status: string }>> {
    const results = new Map<string, { jobId: string; status: string }>();
    
    // Process in batches to avoid overwhelming the queue
    for (let i = 0; i < feedIds.length; i += this.updateConfig.batchSize) {
      const batch = feedIds.slice(i, i + this.updateConfig.batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (feedId) => {
          try {
            const { jobId } = await this.triggerFeedUpdate(feedId, userId, 'normal');
            return { feedId, jobId, status: 'queued' };
          } catch (error) {
            return { 
              feedId, 
              jobId: null, 
              status: error.message || 'failed' 
            };
          }
        })
      );
      
      batchResults.forEach(({ feedId, jobId, status }) => {
        results.set(feedId, { jobId, status });
      });
      
      // Small delay between batches
      if (i + this.updateConfig.batchSize < feedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }
  
  /**
   * Check feed update status
   */
  private async checkFeedStatus(feed: FeedSourceWithStatus): Promise<{
    processingStatus: 'idle' | 'processing' | 'failed';
    nextUpdateAt: Date;
  }> {
    // Check if there's an active job for this feed
    const activeJob = await this.db.query(
      `SELECT * FROM job_queue 
       WHERE job_type = 'feed_sync' 
       AND payload->>'sourceId' = $1
       AND status IN ('pending', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [feed.id]
    );
    
    if (activeJob[0]) {
      return {
        processingStatus: activeJob[0].status === 'processing' ? 'processing' : 'idle',
        nextUpdateAt: null
      };
    }
    
    // Check last failed job
    const failedJob = await this.db.query(
      `SELECT * FROM job_queue 
       WHERE job_type = 'feed_sync' 
       AND payload->>'sourceId' = $1
       AND status = 'failed'
       AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC
       LIMIT 1`,
      [feed.id]
    );
    
    const processingStatus = failedJob[0] ? 'failed' : 'idle';
    const nextUpdateAt = this.calculateNextUpdateTime(feed);
    
    return { processingStatus, nextUpdateAt };
  }
  
  /**
   * Determine if feed is stale
   */
  private isFeedStale(feed: FeedSourceWithStatus): boolean {
    if (!feed.lastProcessedAt) return true;
    
    const ageMs = Date.now() - new Date(feed.lastProcessedAt).getTime();
    const maxAge = this.getMaxAgeForFrequency(feed.updateFrequency);
    
    return ageMs > maxAge;
  }
  
  /**
   * Get max age based on update frequency
   */
  private getMaxAgeForFrequency(frequency: string): number {
    const frequencies: Record<string, number> = {
      'realtime': 5 * 60 * 1000,        // 5 minutes
      'hourly': 60 * 60 * 1000,         // 1 hour
      'daily': 24 * 60 * 60 * 1000,     // 24 hours
      'weekly': 7 * 24 * 60 * 60 * 1000 // 7 days
    };
    
    return frequencies[frequency] || frequencies.daily;
  }
  
  /**
   * Calculate next update time
   */
  private calculateNextUpdateTime(feed: FeedSourceWithStatus): Date {
    const lastProcessed = feed.lastProcessedAt ? new Date(feed.lastProcessedAt) : new Date();
    const interval = this.getMaxAgeForFrequency(feed.updateFrequency);
    
    return new Date(lastProcessed.getTime() + interval);
  }
  
  /**
   * Get update strategy based on context
   */
  private getUpdateStrategy(forceRefresh: boolean): UpdateStrategy {
    if (forceRefresh) {
      return UpdateStrategies.FORCE_REFRESH;
    }
    
    return {
      cacheFirst: true,
      backgroundRefresh: true,
      staleWhileRevalidate: true,
      maxStaleAge: 5 * 60 * 1000, // 5 minutes
      minRefreshInterval: 60 * 1000, // 1 minute
      ttl: 300 // 5 minutes
    };
  }
  
  /**
   * Calculate priority for feed update
   */
  private calculatePriority(feed: any, userRequested: boolean): number {
    let priority = 5; // Default medium priority
    
    // User requested gets boost
    if (userRequested) {
      priority -= this.updateConfig.priorityBoost;
    }
    
    // Adjust based on update frequency
    switch (feed.update_frequency) {
      case 'realtime':
        priority -= 2;
        break;
      case 'hourly':
        priority -= 1;
        break;
      case 'weekly':
        priority += 1;
        break;
    }
    
    // Adjust based on staleness
    if (feed.last_processed_at) {
      const ageHours = (Date.now() - new Date(feed.last_processed_at).getTime()) / (60 * 60 * 1000);
      if (ageHours > 24) priority -= 1;
      if (ageHours > 72) priority -= 1;
    }
    
    return Math.max(1, Math.min(10, priority));
  }
  
  /**
   * Estimate update time based on feed type
   */
  private estimateUpdateTime(feedType: string): number {
    const estimates: Record<string, number> = {
      'rss': 5000,      // 5 seconds
      'podcast': 15000, // 15 seconds (includes potential transcription)
      'youtube': 10000, // 10 seconds
      'api': 3000       // 3 seconds
    };
    
    return estimates[feedType] || 10000;
  }
  
  /**
   * Queue updates for stale feeds
   */
  private async queueFeedUpdates(
    staleFeeds: FeedSourceWithStatus[],
    userId?: string
  ): Promise<void> {
    // Sort by priority and staleness
    const prioritized = staleFeeds.sort((a, b) => {
      const aPriority = this.calculatePriority(a, false);
      const bPriority = this.calculatePriority(b, false);
      return aPriority - bPriority;
    });
    
    // Queue top N feeds based on max concurrent updates
    const toQueue = prioritized.slice(0, this.updateConfig.maxConcurrentUpdates);
    
    for (const feed of toQueue) {
      try {
        await queueService.enqueue('feed_sync', {
          sourceId: feed.id,
          syncType: 'incremental',
          priority: this.calculatePriority(feed, false),
          context: {
            autoTriggered: true,
            requestedBy: userId,
            timestamp: new Date()
          }
        });
      } catch (error) {
        this.logger.error('Failed to queue feed update', { 
          feedId: feed.id, 
          error 
        });
      }
    }
  }
}

// Create singleton instance
export const createFeedUpdateService = (
  db: Database,
  cache: CacheService,
  logger: Logger
): FeedUpdateService => {
  return new FeedUpdateService(db, cache, logger);
};