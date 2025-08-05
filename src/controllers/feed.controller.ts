import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../services/database/db.service';
import { CacheService } from '../services/cache/cache.service';
import { QueueService, JobType } from '../services/queue/queue.service';
import winston from 'winston';
import { validationResult } from 'express-validator';

export class FeedController {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private queue: QueueService,
    private logger: winston.Logger
  ) {}

  // Get all feed sources
  async getFeedSources(req: Request, res: Response, next: NextFunction) {
    try {
      const { is_active, type, category } = req.query;
      
      // Build filter
      const filter: any = {};
      if (is_active !== undefined) filter.is_active = is_active === 'true';
      if (type) filter.type = type;
      
      // Check cache
      const cacheKey = `feed_sources:${JSON.stringify(filter)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }
      
      // Query database
      let feeds = await this.db.tables.feedSources.findMany(filter, {
        orderBy: { field: 'created_at', ascending: false }
      });
      
      // Filter by category if provided
      if (category) {
        feeds = feeds.filter((feed: any) => 
          feed.config?.categories?.includes(category as string)
        );
      }
      
      // Cache result
      await this.cache.set(cacheKey, feeds, { ttl: 300 }); // 5 minutes
      
      res.json({
        success: true,
        data: feeds,
        total: feeds.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single feed source
  async getFeedSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const feed = await this.db.tables.feedSources.findOne({ id });
      
      if (!feed) {
        return res.status(404).json({
          success: false,
          error: 'Feed source not found'
        });
      }
      
      res.json({
        success: true,
        data: feed
      });
    } catch (error) {
      next(error);
    }
  }

  // Create new feed source
  async createFeedSource(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { name, type, url, config } = req.body;
      
      // Check if URL already exists
      const existing = await this.db.tables.feedSources.findOne({ url });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Feed source with this URL already exists'
        });
      }
      
      const feedSource = await this.db.tables.feedSources.create({
        name,
        type,
        url,
        config: config || {},
        is_active: true
      });
      
      // Queue initial processing
      await this.queue.enqueue(JobType.FEED_FETCH, {
        sourceId: feedSource.id
      }, { priority: 2 });
      
      res.status(201).json({
        success: true,
        data: feedSource
      });
    } catch (error) {
      next(error);
    }
  }

  // Update feed source
  async updateFeedSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const feedSource = await this.db.tables.feedSources.update(id, updates);
      
      // Clear cache
      await this.cache.deleteByPattern('feed_sources:*');
      
      res.json({
        success: true,
        data: feedSource
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete feed source
  async deleteFeedSource(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      await this.db.tables.feedSources.delete(id);
      
      // Clear cache
      await this.cache.deleteByPattern('feed_sources:*');
      
      res.json({
        success: true,
        message: 'Feed source deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Process feed manually
  async processFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { priority = 1 } = req.body;
      
      const feed = await this.db.tables.feedSources.findOne({ id });
      if (!feed) {
        return res.status(404).json({
          success: false,
          error: 'Feed source not found'
        });
      }
      
      const jobId = await this.queue.enqueue(JobType.FEED_FETCH, {
        sourceId: id
      }, { priority });
      
      res.json({
        success: true,
        data: {
          jobId,
          message: 'Feed processing queued'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get processed content for a feed
  async getFeedContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0, start_date, end_date } = req.query;
      
      let query = `
        SELECT pc.*, rf.title, rf.published_at
        FROM processed_content pc
        JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
        WHERE rf.source_id = $1
      `;
      
      const params: any[] = [id];
      let paramIndex = 2;
      
      if (start_date) {
        query += ` AND rf.published_at >= $${paramIndex}`;
        params.push(new Date(start_date as string));
        paramIndex++;
      }
      
      if (end_date) {
        query += ` AND rf.published_at <= $${paramIndex}`;
        params.push(new Date(end_date as string));
        paramIndex++;
      }
      
      query += ` ORDER BY rf.published_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), Number(offset));
      
      const content = await this.db.query(query, params);
      
      res.json({
        success: true,
        data: content,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: await this.db.query(
            'SELECT COUNT(*) FROM raw_feeds WHERE source_id = $1',
            [id]
          ).then(r => r[0]?.count || 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get feed processing statistics
  async getFeedStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { period = '7d' } = req.query;
      
      const stats = await this.db.query(`
        SELECT 
          COUNT(DISTINCT rf.id) as total_items,
          COUNT(DISTINCT pc.id) as processed_items,
          AVG(pc.sentiment_score) as avg_sentiment,
          MIN(rf.published_at) as oldest_item,
          MAX(rf.published_at) as newest_item,
          COUNT(DISTINCT DATE(rf.published_at)) as active_days
        FROM raw_feeds rf
        LEFT JOIN processed_content pc ON rf.id = pc.raw_feed_id
        WHERE rf.source_id = $1
        AND rf.created_at >= NOW() - INTERVAL '${period}'
      `, [id]);
      
      const topTopics = await this.db.query(`
        SELECT unnest(key_topics) as topic, COUNT(*) as count
        FROM processed_content pc
        JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
        WHERE rf.source_id = $1
        AND rf.created_at >= NOW() - INTERVAL '${period}'
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
      `, [id]);
      
      res.json({
        success: true,
        data: {
          ...stats[0],
          top_topics: topTopics,
          period
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all raw feeds (unprocessed or processed)
  async getRawFeeds(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        source_id, 
        status, 
        limit = 100, 
        offset = 0,
        start_date,
        end_date 
      } = req.query;
      
      const filter: any = {};
      if (source_id) filter.source_id = source_id;
      if (status) filter.processing_status = status;
      
      let feeds = await this.db.tables.rawFeeds.findMany(filter, {
        orderBy: { field: 'published_at', ascending: false },
        limit: Number(limit),
        offset: Number(offset),
        select: `*, 
          (SELECT name FROM feed_sources WHERE id = raw_feeds.source_id) as source_name`
      });
      
      // Date filtering
      if (start_date || end_date) {
        feeds = feeds.filter((feed: any) => {
          const pubDate = new Date(feed.published_at);
          if (start_date && pubDate < new Date(start_date as string)) return false;
          if (end_date && pubDate > new Date(end_date as string)) return false;
          return true;
        });
      }
      
      res.json({
        success: true,
        data: feeds,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: await this.db.tables.rawFeeds.count(filter)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Process all pending feeds
  async processAllPending(req: Request, res: Response, next: NextFunction) {
    try {
      const { priority = 3 } = req.body;
      
      // Get all pending raw feeds
      const pendingFeeds = await this.db.query(`
        SELECT DISTINCT source_id 
        FROM raw_feeds 
        WHERE processing_status = 'pending'
      `);
      
      const jobs = await Promise.all(
        pendingFeeds.map(({ source_id }) =>
          this.queue.enqueue(JobType.FEED_FETCH, {
            sourceId: source_id
          }, { priority })
        )
      );
      
      res.json({
        success: true,
        data: {
          sources_queued: pendingFeeds.length,
          job_ids: jobs,
          message: 'Processing queued for all pending feeds'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default FeedController;