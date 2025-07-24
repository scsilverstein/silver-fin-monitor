// Feed processor factory and manager following CLAUDE.md specification
import { FeedSource, BaseFeedProcessorDeps, FeedProcessor } from '@/types';
import { db } from '@/services/database';
import { cache } from '@/services/cache';
import { queue } from '@/services/queue';
import { logger, createContextLogger } from '@/utils/logger';
import { RSSProcessor } from './rss.processor';
import { PodcastProcessor } from './podcast.processor';
import { YouTubeProcessor } from './youtube.processor';
import { APIProcessor } from './api.processor';
import { MultiSourceProcessor } from './multi-source.processor';

const feedLogger = createContextLogger('FeedManager');

// Factory to create appropriate processor based on feed type
export class FeedProcessorFactory {
  static create(source: FeedSource, deps: BaseFeedProcessorDeps): FeedProcessor {
    switch (source.type) {
      case 'rss':
        return new RSSProcessor(source, deps);
      
      case 'podcast':
        return new PodcastProcessor(source, deps);
      
      case 'youtube':
        return new YouTubeProcessor(source, deps);
      
      case 'api':
        return new APIProcessor(source, deps);
      
      case 'multi_source':
        return new MultiSourceProcessor(source, deps);
      
      default:
        throw new Error(`Unknown feed type: ${source.type}`);
    }
  }
}

// Feed processing manager
export class FeedManager {
  private processingDeps: BaseFeedProcessorDeps;

  constructor() {
    this.processingDeps = {
      db,
      cache,
      logger
    };
  }

  // Process a single feed source
  async processFeedSource(sourceId: string): Promise<void> {
    feedLogger.info('Processing feed source', { sourceId });

    try {
      // Get feed source
      const source = await db.findById<FeedSource>('feed_sources', sourceId);
      if (!source) {
        throw new Error(`Feed source not found: ${sourceId}`);
      }

      if (!source.isActive) {
        feedLogger.warn('Feed source is not active', { sourceId });
        return;
      }

      // Create processor
      const processor = FeedProcessorFactory.create(source, this.processingDeps);

      // Fetch latest feeds
      const rawFeeds = await processor.fetchLatest();
      feedLogger.info('Fetched raw feeds', { 
        sourceId, 
        count: rawFeeds.length 
      });

      // Queue content processing for each feed
      for (const rawFeed of rawFeeds) {
        await queue.enqueue('content_process', {
          rawFeedId: rawFeed.id
        }, 5);
      }

      feedLogger.info('Feed source processing completed', { 
        sourceId,
        newItems: rawFeeds.length 
      });
    } catch (error) {
      feedLogger.error('Feed source processing error', { 
        sourceId, 
        error 
      });
      throw error;
    }
  }

  // Process content for a raw feed
  async processContent(rawFeedId: string): Promise<void> {
    feedLogger.info('Processing content', { rawFeedId });

    try {
      // Get raw feed with source info
      const result = await db.query<any>(`
        SELECT rf.*, fs.type as source_type, fs.config as source_config
        FROM raw_feeds rf
        JOIN feed_sources fs ON rf.source_id = fs.id
        WHERE rf.id = $1
      `, [rawFeedId]);

      if (!result || result.length === 0) {
        throw new Error(`Raw feed not found: ${rawFeedId}`);
      }

      const rawFeed = result[0];
      
      // Create temporary source object for processor
      const source: FeedSource = {
        id: rawFeed.source_id,
        name: 'temp',
        type: rawFeed.source_type,
        url: '',
        isActive: true,
        config: rawFeed.source_config,
        createdAt: new Date()
      };

      // Create processor
      const processor = FeedProcessorFactory.create(source, this.processingDeps);

      // Process content
      const processResult = await processor.processContent(rawFeed);
      
      if (!processResult.success) {
        throw processResult.error || new Error('Content processing failed');
      }

      feedLogger.info('Content processing completed', { 
        rawFeedId,
        processedId: processResult.data?.id 
      });
    } catch (error) {
      feedLogger.error('Content processing error', { 
        rawFeedId, 
        error 
      });
      
      // Update feed status to failed
      await db.update('raw_feeds', rawFeedId, {
        processing_status: 'failed',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          errorTime: new Date()
        }
      });
      
      throw error;
    }
  }

  // Process all active feeds
  async processAllFeeds(): Promise<void> {
    feedLogger.info('Processing all active feeds');

    try {
      // Get all active feed sources
      const sources = await db.findMany<FeedSource>('feed_sources', {
        is_active: true
      });

      feedLogger.info('Found active feed sources', { 
        count: sources.length 
      });

      // Queue processing for each source
      for (const source of sources) {
        // Check update frequency
        if (this.shouldProcessFeed(source)) {
          await queue.enqueue('feed_fetch', {
            sourceId: source.id
          }, this.getPriority(source.config.priority));
        }
      }

      feedLogger.info('All feeds queued for processing');
    } catch (error) {
      feedLogger.error('Error processing all feeds', error);
      throw error;
    }
  }

  // Check if feed should be processed based on update frequency
  private shouldProcessFeed(source: FeedSource): boolean {
    if (!source.lastProcessedAt) {
      return true;
    }

    const lastProcessed = new Date(source.lastProcessedAt).getTime();
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessed;

    // Parse update frequency
    const frequency = this.parseUpdateFrequency(source.config.updateFrequency);
    
    return timeSinceLastProcess >= frequency;
  }

  // Parse update frequency string to milliseconds
  private parseUpdateFrequency(frequency: string): number {
    const units: Record<string, number> = {
      min: 60 * 1000,
      minute: 60 * 1000,
      minutes: 60 * 1000,
      hour: 60 * 60 * 1000,
      hours: 60 * 60 * 1000,
      hourly: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };

    // Handle specific formats
    if (frequency === '15min') return 15 * 60 * 1000;
    if (frequency === 'twice_weekly') return 3.5 * 24 * 60 * 60 * 1000;

    // Parse general format (e.g., "4 hours", "30 minutes")
    const match = frequency.match(/(\d+)\s*(\w+)/);
    if (match && match[1] && match[2]) {
      const num = match[1];
      const unit = match[2];
      const unitKey = unit.toLowerCase() as keyof typeof units;
      const multiplier = units[unitKey];
      if (multiplier !== undefined) {
        return parseInt(num) * multiplier;
      }
    }

    // Default to hourly if can't parse
    return units.hourly || (60 * 60 * 1000);
  }

  // Convert priority string to number
  private getPriority(priority: string): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'medium':
        return 5;
      case 'low':
        return 8;
      default:
        return 5;
    }
  }
}

// Export singleton instance
export const feedManager = new FeedManager();

// Export processor classes for direct use if needed
export { RSSProcessor, PodcastProcessor, YouTubeProcessor, APIProcessor, MultiSourceProcessor };