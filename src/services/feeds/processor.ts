import { supabase } from '../database/client';
import { logger } from '@/utils/logger';
import { RSSProcessor } from './processors/rss';
import { PodcastProcessor } from './processors/podcast';
import { YouTubeProcessor } from './processors/youtube';
import { APIProcessor } from './processors/api';
import { MultiSourceProcessor } from './processors/multi-source';
import { RedditProcessor } from './reddit.processor';
import QueueService, { JobType } from '../queue/queue.service';
import { DatabaseService } from '../database/db.service';
import winston from 'winston';

// Create queue service instance with deduplication
const dbService = new DatabaseService(
  { 
    url: process.env.SUPABASE_URL || '', 
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
  },
  logger as winston.Logger
);
const queueService = new QueueService(dbService, logger as winston.Logger);

export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'podcast' | 'youtube' | 'api' | 'multi_source' | 'reddit';
  url: string;
  config: any;
  is_active: boolean;
  last_processed_at: string | null;
}

export interface RawFeed {
  id: string;
  source_id: string;
  title: string;
  description: string;
  content: string;
  published_at: string;
  external_id: string;
  metadata: any;
  processing_status: string;
}

export async function processFeed(sourceId: string): Promise<void> {
  try {
    logger.info('Processing feed', { sourceId });

    // Get feed source
    const { data: source, error } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (error || !source) {
      throw new Error(`Feed source not found: ${sourceId}`);
    }

    if (!source.is_active) {
      logger.info('Feed source is inactive, skipping', { sourceId });
      return;
    }

    // Process based on type
    let processor;
    
    // Check if this is a reddit feed using the workaround
    const isRedditWorkaround = source.type === 'api' && source.config?.feedSubtype === 'reddit';
    
    if (isRedditWorkaround) {
      logger.info('Processing API feed as Reddit (workaround)', { sourceId });
      processor = new RedditProcessor(source);
    } else {
      switch (source.type) {
        case 'rss':
          processor = new RSSProcessor(source);
          break;
        case 'podcast':
          processor = new PodcastProcessor(source);
          break;
        case 'youtube':
          processor = new YouTubeProcessor(source);
          break;
        case 'api':
          processor = new APIProcessor(source);
          break;
        case 'multi_source':
          processor = new MultiSourceProcessor(source);
          break;
        case 'reddit':
          processor = new RedditProcessor(source);
          break;
        default:
          throw new Error(`Unsupported feed type: ${source.type}`);
      }
    }

    // Fetch and process new items
    const newItems = await processor.fetchLatest();
    logger.info('Fetched new items', { sourceId, count: newItems.length });

    // Save raw feeds
    for (const item of newItems) {
      const { error: insertError } = await supabase
        .from('raw_feeds')
        .insert({
          source_id: source.id,
          title: item.title,
          description: item.description,
          content: item.content,
          published_at: item.publishedAt || item.pubDate || new Date().toISOString(),
          external_id: item.externalId,
          metadata: item.metadata,
          processing_status: 'pending'
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        logger.error('Failed to insert raw feed', { error: insertError });
      } else if (!insertError) {
        // Queue for content processing
        await queueService.enqueue(JobType.CONTENT_PROCESS, {
          sourceId: source.id,
          externalId: item.externalId
        }, { priority: 2 });
      }
    }

    // Update last processed time
    await supabase
      .from('feed_sources')
      .update({ last_processed_at: new Date().toISOString() })
      .eq('id', sourceId);

    logger.info('Feed processing completed', { sourceId, itemsProcessed: newItems.length });
  } catch (error) {
    logger.error('Feed processing failed', { sourceId, error });
    throw error;
  }
}

export async function processAllActiveFeeds(): Promise<void> {
  try {
    const { data: sources, error } = await supabase
      .from('feed_sources')
      .select('id, name, priority')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) throw error;

    logger.info('Processing all active feeds', { count: sources?.length || 0 });

    // Queue all feeds for processing
    for (const source of sources || []) {
      await queueService.enqueue(JobType.FEED_FETCH, {
        sourceId: source.id
      }, { priority: source.priority === 'high' ? 1 : source.priority === 'medium' ? 5 : 8 });
    }
  } catch (error) {
    logger.error('Failed to process active feeds', { error });
    throw error;
  }
}