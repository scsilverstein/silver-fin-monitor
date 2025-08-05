// Feed management controller following CLAUDE.md specification
import { Request, Response } from 'express';
import { db } from '@/services/database/index';
import { cache, cacheKeys, cacheTtl } from '@/services/cache/index';
import QueueService, { JobType } from '@/services/queue/queue.service';
import { DatabaseService } from '@/services/database/db.service';
import { FeedSource, CreateFeedSourceData, UpdateFeedSourceData, ApiResponse, FeedConfig } from '@/types';
import { asyncHandler } from '@/middleware/error';
import { NotFoundError, ConflictError } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';
import winston from 'winston';

const feedLogger = createContextLogger('FeedController');

// Create queue service instance with deduplication
const dbService = new DatabaseService(
  { 
    url: process.env.SUPABASE_URL || '', 
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
  },
  feedLogger as winston.Logger
);
const queueService = new QueueService(dbService, feedLogger as winston.Logger);

export class FeedController {
  // Transform database row to FeedSource interface
  private transformDbRowToFeedSource(row: any): FeedSource {
    const feedSource: FeedSource = {
      id: row.id,
      name: row.name,
      type: row.type,
      url: row.url,
      isActive: row.is_active,
      config: row.config || {},
      createdAt: new Date(row.created_at)
    };
    
    // Only add optional fields if they exist
    if (row.last_processed_at) {
      feedSource.lastProcessedAt = new Date(row.last_processed_at);
    }
    if (row.updated_at) {
      feedSource.updatedAt = new Date(row.updated_at);
    }
    
    return feedSource;
  }

  // Get all feed sources
  listFeeds = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type, category, isActive, limit = 1000, offset = 0 } = req.query;
    
    feedLogger.info('Listing feeds - START', { type, category, isActive, limit, offset });

    try {
      // Get feeds from database using Supabase client directly
      feedLogger.info('Getting database client');
      const client = db.getClient();
      
      feedLogger.info('Building query');
      let query = client.from('feed_sources').select('*', { count: 'exact' });
      
      if (type) query = query.eq('type', type);
      if (isActive !== undefined) query = query.eq('is_active', isActive === 'true');
      
      query = query
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      feedLogger.info('Executing database query');
      const { data: feeds, error, count } = await query;
      
      if (error) {
        feedLogger.error('Database error fetching feeds', { error });
        throw new Error(`Failed to fetch feeds: ${error.message}`);
      }
      
      feedLogger.info('Database query successful', { 
        feedCount: feeds?.length, 
        totalCount: count 
      });
      
      const total = count || 0;
      const rawFeeds = feeds || [];
      
      // Transform database rows to match TypeScript interface
      feedLogger.info('Transforming database rows', { rawFeedCount: rawFeeds.length });
      const transformedFeeds = rawFeeds.map((row, index) => {
        try {
          feedLogger.debug(`Transforming row ${index}`, { 
            id: row.id, 
            name: row.name,
            hasLastProcessedAt: !!row.last_processed_at,
            hasUpdatedAt: !!row.updated_at
          });
          return this.transformDbRowToFeedSource(row);
        } catch (transformError) {
          feedLogger.error(`Error transforming row ${index}`, { 
            error: transformError, 
            row: row 
          });
          throw transformError;
        }
      });

      feedLogger.info('Transformation successful', { transformedCount: transformedFeeds.length });

      const response = {
        success: true,
        data: transformedFeeds,
        meta: {
          total,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit)
        }
      } as ApiResponse<FeedSource[]>;

      feedLogger.info('Sending successful response');
      res.json(response);
    } catch (error) {
      feedLogger.error('Error in listFeeds', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  });

  // Get single feed source
  getFeed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    feedLogger.debug('Getting feed', { id });

    // Try cache first
    const cacheKey = cacheKeys.feedSource(id!);
    const cached = await cache.get<FeedSource>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<FeedSource>);
      return;
    }

    // Get from database
    const feed = await db.findById<FeedSource>('feed_sources', id!);
    
    if (!feed) {
      throw new NotFoundError('Feed source');
    }

    // Transform the response to ensure camelCase fields
    const transformedFeed = this.transformDbRowToFeedSource(feed);

    // Cache the result
    await cache.set(cacheKey, transformedFeed, cacheTtl.long);

    res.json({
      success: true,
      data: transformedFeed
    } as ApiResponse<FeedSource>);
  });

  // Create new feed source
  createFeed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Enhanced logging for debugging
    feedLogger.info('=== CREATE FEED START ===', {
      method: req.method,
      path: req.path,
      headers: {
        'content-type': req.get('content-type'),
        'authorization': req.get('authorization') ? 'Bearer [REDACTED]' : 'none',
        'origin': req.get('origin'),
        'user-agent': req.get('user-agent')
      },
      rawBody: req.body,
      user: req.user
    });
    
    const data: CreateFeedSourceData = req.body;
    
    feedLogger.info('Parsed feed data', { 
      name: data.name, 
      type: data.type,
      url: data.url,
      config: data.config,
      hasConfig: !!data.config,
      configKeys: data.config ? Object.keys(data.config) : []
    });

    try {
      // Log request body for debugging
      feedLogger.debug('Request body', { body: req.body });

      // Ensure database is connected
      const healthCheck = await db.healthCheck();
      if (!healthCheck.success) {
        feedLogger.error('Database health check failed', healthCheck.error);
        throw new Error('Database connection error');
      }

      // Check for duplicate URL using db.findMany
      feedLogger.debug('Checking for duplicate URL', { url: data.url });
      const existingFeeds = await db.findMany<FeedSource>('feed_sources', { url: data.url });
      feedLogger.debug('Duplicate check result', { count: existingFeeds?.length || 0 });
      
      if (existingFeeds && existingFeeds.length > 0) {
        feedLogger.warn('Duplicate feed URL found', { url: data.url, existingId: existingFeeds[0].id });
        throw new ConflictError('Feed source with this URL already exists');
      }

      // Create feed source with snake_case fields for database
      const defaultConfig: FeedConfig = {
        categories: data.config?.categories || ['general'],
        priority: data.config?.priority || 'medium',
        updateFrequency: data.config?.updateFrequency || 'hourly',
        ...(data.config || {})
      } as FeedConfig;
      
      const createData = {
        name: data.name,
        type: data.type,
        url: data.url,
        config: defaultConfig,
        is_active: true  // Note: Using snake_case for database
      };
      
      feedLogger.debug('Creating feed with data', { createData });
      const feed = await db.create<FeedSource>('feed_sources', createData);
      feedLogger.debug('Feed created', { feed });

      if (!feed) {
        throw new Error('Feed source creation returned no data');
      }

      // Transform the response to ensure camelCase fields
      const transformedFeed = this.transformDbRowToFeedSource(feed);
      feedLogger.debug('Transformed feed', { transformedFeed });

      // Invalidate feed list cache
      await cache.invalidateByTag('feed_list');

      // Queue initial fetch
      try {
        feedLogger.info('Queueing initial fetch job', { sourceId: transformedFeed.id });
        await queueService.enqueue(JobType.FEED_FETCH, { sourceId: transformedFeed.id }, { priority: 1 });
        feedLogger.info('Queue job created successfully');
      } catch (queueError) {
        feedLogger.error('Failed to queue initial fetch job', queueError);
        // Don't fail the entire request if queueing fails
      }

      feedLogger.info('Feed source created successfully', { id: transformedFeed.id, name: transformedFeed.name });

      res.status(201).json({
        success: true,
        data: transformedFeed
      } as ApiResponse<FeedSource>);
    } catch (error) {
      feedLogger.error('Failed to create feed', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      
      if (error instanceof ConflictError) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: error.message
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'FEED_CREATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create feed source'
          }
        });
      }
    }
  });

  // Update feed source
  updateFeed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data: UpdateFeedSourceData = req.body;
    
    feedLogger.info('Updating feed source', { id, updates: Object.keys(data) });

    // Check if feed exists
    const existing = await db.findById<FeedSource>('feed_sources', id!);
    if (!existing) {
      throw new NotFoundError('Feed source');
    }

    // Update feed source
    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.isActive !== undefined) updateData.is_active = data.isActive; // Note: Using snake_case for DB column
    if (data.config !== undefined) {
      updateData.config = { ...existing.config, ...data.config };
    }
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    feedLogger.debug('Update data prepared', { id, updateData });

    const updated = await db.update<FeedSource>('feed_sources', id!, updateData);

    // Transform the response to ensure camelCase fields using the same method as listFeeds
    const transformedFeed = this.transformDbRowToFeedSource(updated);

    // Invalidate caches
    await cache.delete(cacheKeys.feedSource(id!));
    await cache.invalidateByTag('feed_list');

    feedLogger.info('Feed source updated', { id, isActive: transformedFeed.isActive });

    res.json({
      success: true,
      data: transformedFeed
    } as ApiResponse<FeedSource>);
  });

  // Delete feed source
  deleteFeed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    feedLogger.info('Deleting feed source', { id });

    // Check if feed exists
    const existing = await db.findById<FeedSource>('feed_sources', id!);
    if (!existing) {
      throw new NotFoundError('Feed source');
    }

    // Delete feed source (cascades to related data)
    await db.delete('feed_sources', id!);

    // Invalidate caches
    await cache.delete(cacheKeys.feedSource(id!));
    await cache.invalidateByTag('feed_list');

    feedLogger.info('Feed source deleted', { id });

    res.status(204).send();
  });

  // Trigger feed processing
  processFeed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    feedLogger.info('Triggering feed processing', { id });

    // Check if feed exists and is active
    const feed = await db.findById<FeedSource>('feed_sources', id!);
    if (!feed) {
      throw new NotFoundError('Feed source');
    }

    // Check if feed is active (handle both field formats)
    const isActive = feed.isActive !== undefined ? feed.isActive : (feed as any).is_active;
    if (!isActive) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FEED_INACTIVE',
          message: 'Feed source is not active'
        }
      });
      return;
    }

    // Queue processing job
    const jobId = await queueService.enqueue(JobType.FEED_FETCH, { sourceId: id! }, { priority: 2 });

    feedLogger.info('Feed processing queued', { id, jobId });

    res.json({
      success: true,
      data: {
        jobId,
        message: 'Feed processing queued successfully'
      }
    });
  });

  // Get feed processing stats
  getFeedStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    feedLogger.debug('Getting feed stats');

    // Try cache first
    const cacheKey = cacheKeys.processingStats();
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      });
      return;
    }

    // Get stats from database
    const stats = await db.query<any>('SELECT * FROM get_processing_stats()');

    // Cache the result
    await cache.set(cacheKey, stats[0], cacheTtl.short);

    res.json({
      success: true,
      data: stats[0]
    });
  });

  // Get raw feed items for a feed source
  getFeedItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    feedLogger.debug('Getting feed items', { id, limit, offset });

    // Verify feed exists
    const feed = await db.findById<FeedSource>('feed_sources', id!);
    if (!feed) {
      throw new NotFoundError('Feed source');
    }

    // Get raw feed items with processing status using Supabase
    const client = db.getClient();
    
    const { data: items, error, count } = await client
      .from('raw_feeds')
      .select(`
        *,
        processed_content (
          id,
          processed_text,
          sentiment_score,
          key_topics,
          summary
        )
      `, { count: 'exact' })
      .eq('source_id', id!)
      .order('published_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      feedLogger.error('Failed to get feed items', { error });
      throw new Error(`Failed to get feed items: ${error.message}`);
    }

    // Transform the data to include processing status
    const transformedItems = (items || []).map(item => {
      const processedContentData = item.processed_content?.[0] || null;
      const isAudioContent = !!(item.metadata?.audioUrl || item.metadata?.duration);
      
      // For audio content, check if we have a transcription
      // The transcription is stored in the raw_feeds.content field for audio content
      const hasAudioTranscription = isAudioContent && 
        (item.metadata?.hasTranscript === true || 
         item.metadata?.transcription?.completed === true ||
         (item.content && item.content.length > 100)); // Has substantial content
      
      // For now, consider text processing as processed content for non-audio
      const hasTextProcessing = processedContentData && processedContentData.processed_text;
      
      // Audio content is only processed if it has been transcribed
      const isAudioProcessed = isAudioContent && hasAudioTranscription;
      
      return {
        ...item,
        isProcessed: isAudioProcessed || (!isAudioContent && !!processedContentData),
        hasTranscription: hasAudioTranscription,
        isAudioContent,
        hasTextProcessing,
        processingData: processedContentData,
        // For audio content, the transcription is in the content field
        // For non-audio, we use the processed_text from processed_content
        transcription: isAudioContent && hasAudioTranscription ? item.content : 
                      (!isAudioContent && processedContentData?.processed_text ? processedContentData.processed_text : null),
        processed_content: undefined // Remove the nested array
      };
    });

    res.json({
      success: true,
      data: transformedItems,
      meta: {
        total: count || 0,
        page: Math.floor(Number(offset) / Number(limit)) + 1,
        limit: Number(limit)
      }
    } as ApiResponse<any[]>);
  });

  // Process individual feed item
  processFeedItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, itemId } = req.params;
    
    feedLogger.info('Processing individual feed item', { feedId: id, itemId });

    // Verify feed exists
    const feed = await db.findById<FeedSource>('feed_sources', id!);
    if (!feed) {
      throw new NotFoundError('Feed source');
    }

    // Check if feed is active
    const isActive = feed.isActive !== undefined ? feed.isActive : (feed as any).is_active;
    if (!isActive) {
      res.status(400).json({
        success: false,
        error: {
          code: 'FEED_INACTIVE',
          message: 'Feed source is not active'
        }
      });
      return;
    }

    // Verify item exists and belongs to this feed
    const client = db.getClient();
    const { data: item, error } = await client
      .from('raw_feeds')
      .select('*')
      .eq('id', itemId)
      .eq('source_id', id!)
      .single();

    if (error || !item) {
      throw new NotFoundError('Feed item');
    }

    // Allow reprocessing of completed items
    if (item.processing_status === 'completed') {
      feedLogger.info('Reprocessing completed feed item', { feedId: id, itemId });
    }

    // Check if this is audio content that needs transcription
    const isAudioContent = !!(item.metadata?.audioUrl || item.metadata?.audio_url || item.metadata?.duration);
    const hasTranscript = item.content && item.content.length > 100 && item.content !== 'Transcript pending';
    const needsTranscription = isAudioContent && !hasTranscript;

    let jobId: string;
    
    if (needsTranscription) {
      // Queue transcription job for audio content
      feedLogger.info('Queuing audio transcription job', { feedId: id, itemId });
      jobId = await queueService.enqueue('transcribe_audio', {
        feedId: itemId,
        audioUrl: item.metadata?.audioUrl || item.metadata?.audio_url,
        title: item.title
      }, { priority: 1 }); // High priority for manual processing
    } else if (isAudioContent && hasTranscript) {
      // Audio content with transcript - process the content
      feedLogger.info('Processing transcribed audio content', { feedId: id, itemId });
      jobId = await queueService.enqueue(JobType.CONTENT_PROCESS, {
        rawFeedId: itemId,
        sourceId: id!,
        priority: 'manual' // Mark as manually triggered
      }, { priority: 1 }); // High priority for manual processing
    } else {
      // Queue regular content processing job
      jobId = await queueService.enqueue(JobType.CONTENT_PROCESS, {
        rawFeedId: itemId,
        sourceId: id!,
        priority: 'manual' // Mark as manually triggered
      }, { priority: 1 }); // High priority for manual processing
    }

    feedLogger.info('Feed item processing queued', { feedId: id, itemId, jobId });

    res.json({
      success: true,
      data: {
        jobId,
        feedId: id,
        itemId,
        message: 'Feed item processing has been queued'
      }
    });
  });

  // Start historical backfill
  startHistoricalBackfill = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { daysBack = 7, forceRefetch = true, generatePredictions = true, generateAnalysis = true } = req.body;
    
    feedLogger.info('Starting historical backfill', { daysBack, forceRefetch, generatePredictions, generateAnalysis });

    try {
      // Get all active feed sources
      const client = db.getClient();
      const { data: sources, error } = await client
        .from('feed_sources')
        .select('*')
        .eq('is_active', true);
        
      if (error || !sources) {
        throw new Error(`Failed to fetch feed sources: ${error?.message}`);
      }
      
      feedLogger.info(`Found ${sources.length} active feed sources for backfill`);
      
      // Queue fetch jobs for each source with historical flag
      let jobsQueued = 0;
      for (const source of sources) {
        const jobId = await queueService.enqueue(JobType.FEED_FETCH, {
          sourceId: source.id,
          historical: true,
          daysBack,
          forceRefetch
        }, { priority: 1 }); // High priority
        
        if (jobId) {
          jobsQueued++;
        }
      }
      
      // Optionally queue analysis generation
      if (generateAnalysis) {
        // Queue analysis for each day
        for (let i = daysBack; i >= 0; i--) {
          const analysisDate = new Date();
          analysisDate.setDate(analysisDate.getDate() - i);
          
          await queueService.enqueue(JobType.DAILY_ANALYSIS, {
            date: analysisDate,
            forceRegenerate: true
          }, { priority: 2 }); // Medium priority
        }
      }
      
      feedLogger.info(`Historical backfill queued: ${jobsQueued} feed jobs`);
      
      res.json({
        success: true,
        data: {
          message: `Historical backfill started for ${daysBack} days`,
          jobsQueued,
          sources: sources.length
        }
      });
    } catch (error) {
      feedLogger.error('Failed to start historical backfill', { error });
      throw error;
    }
  });
}

export const feedController = new FeedController();

// Simple test endpoint to debug the issue
export const testFeedsEndpoint = async (req: any, res: any) => {
  try {
    feedLogger.info('Test endpoint called');
    
    // Test 1: Check if db is available
    feedLogger.info('Testing db availability');
    const client = db.getClient();
    feedLogger.info('Got database client');
    
    // Test 2: Simple query
    const { data, error, count } = await client
      .from('feed_sources')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(1);
    
    feedLogger.info('Query result', { 
      hasData: !!data, 
      dataLength: data?.length, 
      hasError: !!error,
      count 
    });
    
    if (error) {
      feedLogger.error('Query error', { error });
      return res.json({
        success: false,
        error: error.message
      });
    }
    
    res.json({
      success: true,
      message: 'Test successful',
      data: {
        feedCount: count,
        firstFeed: data?.[0]
      }
    });
  } catch (error) {
    feedLogger.error('Test endpoint error', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};