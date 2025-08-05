// Content management controller following CLAUDE.md specification
import { Request, Response } from 'express';
import { db } from '@/services/database/index';
import { cache, cacheKeys, cacheTtl } from '@/services/cache/index';
import { ProcessedContent, RawFeed, ApiResponse } from '@/types';
import { asyncHandler } from '@/middleware/error';
import { NotFoundError } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';

const contentLogger = createContextLogger('ContentController');

export class ContentController {
  // Get processed content with filters
  listContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { 
      sourceId, 
      startDate, 
      endDate, 
      sentiment, 
      timeframe,
      limit = 10000, 
      offset = 0 
    } = req.query;
    
    contentLogger.debug('Listing content', { sourceId, startDate, endDate, sentiment, limit, offset });

    // Calculate date range from timeframe
    let calculatedStartDate = startDate;
    let calculatedEndDate = endDate;
    
    if (timeframe && !startDate && !endDate) {
      const now = new Date();
      calculatedEndDate = now.toISOString();
      
      switch (timeframe) {
        case '1d':
          calculatedStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          calculatedStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30d':
          calculatedStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          // 'all' - no date filter
          calculatedStartDate = undefined;
          calculatedEndDate = undefined;
          break;
      }
    }

    // Build cache key
    const cacheKey = cacheKeys.contentList(
      `${sourceId}-${calculatedStartDate}-${calculatedEndDate}-${sentiment}-${timeframe}-${limit}-${offset}`
    );
    
    // Try cache first
    const cached = await cache.get<{ content: ProcessedContent[]; total: number }>(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached.content,
        meta: {
          total: cached.total,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit)
        }
      } as ApiResponse<ProcessedContent[]>);
      return;
    }

    try {
      // Use Supabase client directly
      const client = db.getClient();
      
      // Build the query - simplified to avoid nested join issues
      let query = client
        .from('processed_content')
        .select('*', { count: 'exact' });

      // For source filtering, we need to get raw_feed_ids first
      let rawFeedIds: string[] | null = null;
      if (sourceId || calculatedStartDate || calculatedEndDate) {
        // Get raw feed IDs that match our criteria
        let feedQuery = client.from('raw_feeds').select('id');
        
        if (sourceId) {
          feedQuery = feedQuery.eq('source_id', sourceId);
        }
        if (calculatedStartDate) {
          feedQuery = feedQuery.gte('published_at', calculatedStartDate);
        }
        if (calculatedEndDate) {
          feedQuery = feedQuery.lte('published_at', calculatedEndDate);
        }
        
        const { data: feeds, error: feedError } = await feedQuery;
        if (feedError) {
          throw new Error(`Failed to fetch raw feeds: ${feedError.message}`);
        }
        
        rawFeedIds = feeds?.map(f => f.id) || [];
        
        // If we have feed IDs, filter by them
        if (rawFeedIds.length > 0) {
          query = query.in('raw_feed_id', rawFeedIds);
        } else {
          // No matching feeds, return empty result
          res.json({
            success: true,
            data: [],
            meta: {
              total: 0,
              page: 1,
              limit: Number(limit)
            }
          } as ApiResponse<ProcessedContent[]>);
          return;
        }
      }

      if (sentiment) {
        const sentimentRange = {
          positive: [0.3, 1],
          negative: [-1, -0.3],
          neutral: [-0.3, 0.3]
        };
        const range = sentimentRange[sentiment as keyof typeof sentimentRange];
        if (range) {
          query = query.gte('sentiment_score', range[0]).lte('sentiment_score', range[1]);
        }
      }

      // Apply ordering and pagination
      // Note: Supabase doesn't support ordering by foreign table fields directly
      // We'll order by created_at instead and handle sorting in memory if needed
      query = query
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Execute query
      const { data: content, error, count: total } = await query;

      if (error) {
        contentLogger.error('Failed to fetch content', { error });
        throw new Error(`Failed to fetch content: ${error.message}`);
      }

      // Transform the data structure - no nested data now
      const transformedContent = (content || []).map(item => ({
        ...item,
        // These fields will be null since we don't have the join
        title: null,
        published_at: null,
        source_id: null,
        source_name: null,
        source_type: null
      }));

      contentLogger.debug('Content fetched', { count: transformedContent.length, total });

      // Cache the result
      await cache.set(cacheKey, { content: transformedContent, total: total || 0 }, cacheTtl.medium);

      res.json({
        success: true,
        data: transformedContent,
        meta: {
          total: total || 0,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit)
        }
      } as ApiResponse<ProcessedContent[]>);
    } catch (error) {
      contentLogger.error('Error listing content', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'CONTENT_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch content'
        }
      });
    }
  });

  // Get single content item
  getContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    contentLogger.debug('Getting content', { id });

    // Try cache first
    const cacheKey = cacheKeys.feedContent(id!);
    const cached = await cache.get<ProcessedContent>(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      } as ApiResponse<ProcessedContent>);
      return;
    }

    // Get from database using Supabase
    const client = db.getClient();
    const { data: result, error } = await client
      .from('processed_content')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      contentLogger.error('Failed to get content', { error });
      throw new Error(`Failed to get content: ${error.message}`);
    }

    if (!result) {
      throw new NotFoundError('Content');
    }

    const content = result;

    // Cache the result
    await cache.set(cacheKey, content, cacheTtl.long);

    res.json({
      success: true,
      data: content
    } as ApiResponse<ProcessedContent>);
  });

  // Search content
  searchContent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q, limit = 20, offset = 0 } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query is required'
        }
      });
      return;
    }

    contentLogger.debug('Searching content', { query: q, limit, offset });

    try {
      const client = db.getClient();
      
      // For now, use a simple text search since full-text search requires specific setup
      // We'll search in summary
      const { data: content, error, count } = await client
        .from('processed_content')
        .select('*', { count: 'exact' })
        .ilike('summary', `%${q}%`)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      // Content is already in the right format
      const transformedContent = content || [];

      res.json({
        success: true,
        data: transformedContent,
        meta: {
          total: count || 0,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit),
          query: q
        }
      } as ApiResponse<ProcessedContent[]>);
    } catch (error) {
      contentLogger.error('Search error', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: error instanceof Error ? error.message : 'Search failed'
        }
      });
    }
  });

  // Get content by feed source
  getContentBySource = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sourceId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    contentLogger.debug('Getting content by source', { sourceId, limit, offset });

    // Verify source exists
    const source = await db.findById('feed_sources', sourceId!);
    if (!source) {
      throw new NotFoundError('Feed source');
    }

    // Use Supabase client directly for the query
    const client = db.getClient();
    
    // Get content with joins using Supabase
    // First, get raw feeds for this source
    const { data: rawFeeds, error: feedError } = await client
      .from('raw_feeds')
      .select('id')
      .eq('source_id', sourceId!);
    
    if (feedError) {
      throw new Error(`Failed to get feeds: ${feedError.message}`);
    }
    
    const feedIds = rawFeeds?.map(f => f.id) || [];
    
    // Now get processed content for these feeds
    const { data: content, error, count } = await client
      .from('processed_content')
      .select('*', { count: 'exact' })
      .in('raw_feed_id', feedIds)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      contentLogger.error('Failed to get content by source', { error });
      throw new Error(`Failed to get content: ${error.message}`);
    }

    // Content is already in the right format, no transformation needed
    const transformedContent = content || [];

    res.json({
      success: true,
      data: transformedContent,
      meta: {
        total: count || 0,
        page: Math.floor(Number(offset) / Number(limit)) + 1,
        limit: Number(limit),
        sourceId
      }
    } as ApiResponse<ProcessedContent[]>);
  });

  // Get content statistics
  getContentStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    
    contentLogger.debug('Getting content stats', { startDate, endDate });

    try {
      const client = db.getClient();
      
      // Build query for content - simplified
      const { data: content, error } = await client
        .from('processed_content')
        .select('id, raw_feed_id, sentiment_score, key_topics');

      if (error) {
        throw new Error(`Failed to get stats: ${error.message}`);
      }

      // Calculate statistics manually
      const stats = {
        total_content: content?.length || 0,
        // We can't get active sources without the join, so let's estimate
        active_sources: 0, // Will need a separate query if this is important
        avg_sentiment: content?.length 
          ? content.reduce((sum, c) => sum + (c.sentiment_score || 0), 0) / content.length 
          : 0,
        positive_count: content?.filter(c => c.sentiment_score > 0.3).length || 0,
        negative_count: content?.filter(c => c.sentiment_score < -0.3).length || 0,
        neutral_count: content?.filter(c => c.sentiment_score >= -0.3 && c.sentiment_score <= 0.3).length || 0,
        top_topics: Array.from(new Set(
          content?.flatMap(c => c.key_topics || [])
        )).slice(0, 10)
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      contentLogger.error('Stats error', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get stats'
        }
      });
    }
  });
}

export const contentController = new ContentController();