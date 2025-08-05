import { DatabaseService, getDatabase } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import { QueueService, JobType, QueueJob } from '../queue/queue.service';
import { OpenAIService } from '../ai/openai.service';
import RSSFeedProcessor from '../feeds/rss-feed-processor';
import winston from 'winston';
import { FeedSource } from '../feeds/base-feed-processor';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'worker.log' })
  ]
});

export class FeedProcessorWorker {
  private db: DatabaseService;
  private cache: CacheService;
  private queue: QueueService;
  private aiService: OpenAIService;
  private isRunning = false;

  constructor() {
    this.db = getDatabase(logger);
    this.cache = new CacheService(this.db, logger);
    this.queue = new QueueService(this.db, logger);
    this.aiService = new OpenAIService(this.db, this.cache, logger);
    
    // Register job handlers
    this.registerHandlers();
  }

  private registerHandlers() {
    // Feed fetch handler
    this.queue.registerHandler(JobType.FEED_FETCH, async (job: QueueJob) => {
      await this.processFeedFetch(job.payload);
    });

    // Content processing handler
    this.queue.registerHandler(JobType.CONTENT_PROCESS, async (job: QueueJob) => {
      await this.processContent(job.payload);
    });

    // Daily analysis handler
    this.queue.registerHandler(JobType.DAILY_ANALYSIS, async (job: QueueJob) => {
      await this.generateDailyAnalysis(job.payload);
    });

    // Prediction comparison handler
    this.queue.registerHandler(JobType.PREDICTION_COMPARE, async (job: QueueJob) => {
      await this.comparePrediction(job.payload);
    });

    // New job handlers for page-triggered tasks
    this.queue.registerHandler('feed_fetch_all', async (job: QueueJob) => {
      await this.processFeedFetchAll(job.payload);
    });

    this.queue.registerHandler('content_process_check', async (job: QueueJob) => {
      await this.processContentCheck(job.payload);
    });

    this.queue.registerHandler('prediction_check', async (job: QueueJob) => {
      await this.processPredictionCheck(job.payload);
    });
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Worker already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting feed processor worker');

    // Start queue processing
    await this.queue.startProcessing(1000); // Check every second

    // Schedule daily analysis
    this.scheduleDailyAnalysis();

    // Schedule cleanup
    this.scheduleCleanup();

    logger.info('Feed processor worker started');
  }

  async stop() {
    logger.info('Stopping feed processor worker');
    this.isRunning = false;
    await this.queue.stopProcessing();
    logger.info('Feed processor worker stopped');
  }

  // Job handlers
  private async processFeedFetch(payload: { sourceId: string }) {
    try {
      logger.info(`Processing feed fetch for source ${payload.sourceId}`);
      
      // Get feed source
      const source = await this.db.tables.feedSources.findOne({ 
        id: payload.sourceId,
        is_active: true 
      });
      
      if (!source) {
        throw new Error('Feed source not found or inactive');
      }

      // Create appropriate processor based on type
      let processor;
      const feedSource = source as any; // Type assertion for now
      switch (feedSource.type) {
        case 'rss':
          processor = new RSSFeedProcessor(
            feedSource as FeedSource,
            this.db,
            this.cache,
            logger
          );
          break;
        // Add other processor types here
        default:
          throw new Error(`Unsupported feed type: ${feedSource.type}`);
      }

      // Process the feed
      const processedContent = await processor.process();
      
      logger.info(`Processed ${processedContent.length} items from ${feedSource.name}`);

      // Queue content processing jobs for AI enhancement
      if (feedSource.config.extract_entities || feedSource.config.process_transcript) {
        for (const content of processedContent) {
          await this.queue.enqueue(JobType.CONTENT_PROCESS, {
            contentId: content.id
          }, { priority: 5 });
        }
      }
    } catch (error) {
      logger.error('Feed fetch error:', error);
      throw error;
    }
  }

  private async processContent(payload: { contentId: string }) {
    try {
      logger.info(`Processing content ${payload.contentId}`);
      
      // Get processed content
      const content = await this.db.tables.processedContent.findOne({
        id: payload.contentId
      });
      
      if (!content) {
        throw new Error('Content not found');
      }

      // Enhance with AI
      const enhanced = await this.aiService.enhanceContent((content as any).processed_text);
      
      // Update content with AI enhancements
      await this.db.tables.processedContent.update((content as any).id, {
        summary: enhanced.summary,
        key_topics: enhanced.key_topics,
        sentiment_score: enhanced.sentiment,
        entities: { ...(content as any).entities, ...enhanced.entities },
        processing_metadata: {
          ...(content as any).processing_metadata,
          ai_enhanced: true,
          ai_model: 'gpt-3.5-turbo'
        }
      });
      
      logger.info(`Enhanced content ${payload.contentId}`);
    } catch (error) {
      logger.error('Content processing error:', error);
      throw error;
    }
  }

  private async generateDailyAnalysis(payload: { date: Date; force?: boolean }) {
    try {
      const date = new Date(payload.date);
      logger.info(`Generating daily analysis for ${date.toISOString()}`);
      
      // Check if already exists
      if (!payload.force) {
        const existing = await this.db.tables.dailyAnalysis.findOne({
          analysis_date: date
        });
        
        if (existing) {
          logger.info('Daily analysis already exists');
          return;
        }
      }
      
      // Generate analysis
      const analysis = await this.aiService.generateDailyAnalysis(date);
      
      // Generate predictions
      const predictions = await this.aiService.generatePredictions(analysis);
      
      logger.info(`Generated daily analysis with ${predictions.length} predictions`);
      
      // Queue prediction comparisons for past predictions
      await this.queuePredictionComparisons(analysis);
    } catch (error) {
      logger.error('Daily analysis generation error:', error);
      throw error;
    }
  }

  private async comparePrediction(payload: { 
    predictionId: string; 
    currentAnalysisId: string;
  }) {
    try {
      logger.info(`Comparing prediction ${payload.predictionId}`);
      
      const currentAnalysis = await this.db.tables.dailyAnalysis.findOne({
        id: payload.currentAnalysisId
      });
      
      if (!currentAnalysis) {
        throw new Error('Current analysis not found');
      }
      
      const comparison = await this.aiService.comparePredictions(
        payload.predictionId,
        currentAnalysis as any
      );
      
      logger.info(`Completed prediction comparison with accuracy ${comparison.accuracy_score}`);
    } catch (error) {
      logger.error('Prediction comparison error:', error);
      throw error;
    }
  }

  // Scheduled tasks
  private scheduleDailyAnalysis() {
    // Schedule daily analysis at 6 AM UTC
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setUTCHours(6, 0, 0, 0);
    
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const delay = scheduledTime.getTime() - now.getTime();
    
    setTimeout(async () => {
      await this.queue.enqueue(JobType.DAILY_ANALYSIS, {
        date: new Date()
      }, { priority: 1 });
      
      // Reschedule for tomorrow
      setInterval(async () => {
        await this.queue.enqueue(JobType.DAILY_ANALYSIS, {
          date: new Date()
        }, { priority: 1 });
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, delay);
    
    logger.info(`Daily analysis scheduled for ${scheduledTime.toISOString()}`);
  }

  private scheduleCleanup() {
    // Run cleanup every hour
    setInterval(async () => {
      try {
        const jobsDeleted = await this.queue.cleanupOldJobs();
        const cacheDeleted = await this.cache.cleanup();
        
        logger.info(`Cleanup completed: ${jobsDeleted} jobs, ${cacheDeleted} cache entries`);
      } catch (error) {
        logger.error('Cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  private async queuePredictionComparisons(currentAnalysis: any) {
    try {
      // Find predictions that should be evaluated
      const predictionsToEvaluate = await this.db.query(`
        SELECT p.* 
        FROM predictions p
        LEFT JOIN prediction_comparisons pc ON p.id = pc.prediction_id
        WHERE pc.id IS NULL
        AND (
          (p.time_horizon = '1_week' AND p.created_at <= NOW() - INTERVAL '7 days')
          OR (p.time_horizon = '2_weeks' AND p.created_at <= NOW() - INTERVAL '14 days')
          OR (p.time_horizon = '1_month' AND p.created_at <= NOW() - INTERVAL '30 days')
          OR (p.time_horizon = '3_months' AND p.created_at <= NOW() - INTERVAL '90 days')
          OR (p.time_horizon = '6_months' AND p.created_at <= NOW() - INTERVAL '180 days')
          OR (p.time_horizon = '1_year' AND p.created_at <= NOW() - INTERVAL '365 days')
        )
        LIMIT 50
      `);
      
      for (const prediction of predictionsToEvaluate) {
        await this.queue.enqueue(JobType.PREDICTION_COMPARE, {
          predictionId: prediction.id,
          currentAnalysisId: currentAnalysis.id
        }, { priority: 3 });
      }
      
      logger.info(`Queued ${predictionsToEvaluate.length} predictions for comparison`);
    } catch (error) {
      logger.error('Error queueing prediction comparisons:', error);
    }
  }

  // Process all feeds
  async processAllFeeds() {
    try {
      const activeFeeds = await this.db.tables.feedSources.findMany({
        is_active: true
      });
      
      logger.info(`Processing ${activeFeeds.length} active feeds`);
      
      for (const feed of activeFeeds) {
        await this.queue.enqueue(JobType.FEED_FETCH, {
          sourceId: (feed as any).id
        }, { 
          priority: (feed as any).config.priority === 'high' ? 1 : 
                   (feed as any).config.priority === 'medium' ? 3 : 5
        });
      }
    } catch (error) {
      logger.error('Error processing all feeds:', error);
    }
  }

  // New handler methods for page-triggered tasks
  private async processFeedFetchAll(payload: { 
    triggeredBy: string; 
    timestamp: string;
  }) {
    try {
      logger.info(`Processing feed_fetch_all triggered by ${payload.triggeredBy}`);
      
      // Check if we need to process all feeds
      const activeFeeds = await this.db.tables.feedSources.findMany({
        is_active: true
      });
      
      logger.info(`Found ${activeFeeds.length} active feeds to process`);
      
      // Check each feed to see if it needs refreshing
      for (const feed of activeFeeds) {
        const feedData = feed as any;
        const lastProcessed = feedData.last_processed_at;
        const updateFrequency = feedData.config?.update_frequency || 'hourly';
        
        // Calculate if feed needs update based on its frequency
        const now = new Date();
        const shouldUpdate = this.shouldUpdateFeed(lastProcessed, updateFrequency, now);
        
        if (shouldUpdate) {
          await this.queue.enqueue(JobType.FEED_FETCH, {
            sourceId: feedData.id
          }, {
            priority: feedData.config?.priority === 'high' ? 1 : 
                     feedData.config?.priority === 'medium' ? 3 : 5
          });
          logger.info(`Queued feed ${feedData.name} for processing`);
        } else {
          logger.debug(`Skipping feed ${feedData.name} - recently processed`);
        }
      }
    } catch (error) {
      logger.error('Error in processFeedFetchAll:', error);
      throw error;
    }
  }

  private async processContentCheck(payload: {
    triggeredBy: string;
    timestamp: string;
  }) {
    try {
      logger.info(`Processing content_process_check triggered by ${payload.triggeredBy}`);
      
      // Find unprocessed content
      const unprocessedContent = await this.db.query(`
        SELECT id FROM processed_content 
        WHERE (entities IS NULL OR entities = '{}')
        AND created_at > NOW() - INTERVAL '7 days'
        LIMIT 50
      `);
      
      logger.info(`Found ${unprocessedContent.length} unprocessed content items`);
      
      // Queue them for processing
      for (const content of unprocessedContent) {
        await this.queue.enqueue(JobType.CONTENT_PROCESS, {
          contentId: content.id
        }, { priority: 5 });
      }
      
      // Also check for raw feeds that haven't been processed
      const unprocessedFeeds = await this.db.query(`
        SELECT id, source_id, external_id FROM raw_feeds 
        WHERE processing_status = 'pending'
        AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 50
      `);
      
      logger.info(`Found ${unprocessedFeeds.length} unprocessed raw feeds`);
      
      // Queue them for content processing
      for (const feed of unprocessedFeeds) {
        await this.queue.enqueue(JobType.CONTENT_PROCESS, {
          rawFeedId: feed.id,
          sourceId: feed.source_id,
          externalId: feed.external_id
        }, { priority: 4 });
      }
    } catch (error) {
      logger.error('Error in processContentCheck:', error);
      throw error;
    }
  }

  private async processPredictionCheck(payload: {
    triggeredBy: string;
    timestamp: string;
  }) {
    try {
      logger.info(`Processing prediction_check triggered by ${payload.triggeredBy}`);
      
      // Check if we need to generate predictions for today
      const today = new Date().toISOString().split('T')[0];
      const todayAnalysis = await this.db.tables.dailyAnalysis.findOne({
        analysis_date: today
      });
      
      if (todayAnalysis) {
        // Check if predictions exist
        const predictions = await this.db.query(
          'SELECT COUNT(*) as count FROM predictions WHERE daily_analysis_id = $1',
          [(todayAnalysis as any).id]
        );
        
        if (predictions[0].count === 0) {
          logger.info('No predictions for today, generating...');
          await this.queue.enqueue('generate_predictions', {
            analysisId: (todayAnalysis as any).id,
            analysisDate: today
          }, { priority: 2 });
        }
      }
      
      // Also check for due prediction comparisons
      await this.queuePredictionComparisons(todayAnalysis || { id: null });
    } catch (error) {
      logger.error('Error in processPredictionCheck:', error);
      throw error;
    }
  }

  private shouldUpdateFeed(lastProcessed: Date | null, frequency: string, now: Date): boolean {
    if (!lastProcessed) return true;
    
    const lastTime = new Date(lastProcessed).getTime();
    const nowTime = now.getTime();
    const diffMinutes = (nowTime - lastTime) / (1000 * 60);
    
    switch (frequency) {
      case '15min':
        return diffMinutes >= 15;
      case '30min':
        return diffMinutes >= 30;
      case 'hourly':
        return diffMinutes >= 60;
      case '4hours':
        return diffMinutes >= 240;
      case 'daily':
        return diffMinutes >= 1440;
      case 'weekly':
        return diffMinutes >= 10080;
      default:
        return diffMinutes >= 60; // Default to hourly
    }
  }
}

// Start worker if run directly
if (require.main === module) {
  const worker = new FeedProcessorWorker();
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await worker.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await worker.stop();
    process.exit(0);
  });
  
  // Start the worker
  worker.start().catch(error => {
    logger.error('Worker startup error:', error);
    process.exit(1);
  });
}

export default FeedProcessorWorker;