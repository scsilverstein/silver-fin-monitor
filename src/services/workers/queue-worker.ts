import { processFeed } from '../feeds/processor';
import { contentProcessor } from '../content/processor';
import { aiAnalysisService } from '../ai/analysis';
import { logger } from '@/utils/logger';
import { db } from '../database/index';
import { cache } from '../cache';
import { PredictionComparisonService } from '../prediction/prediction-comparison.service';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import { OpenAIService } from '../ai/openai.service';
import winston from 'winston';
import QueueService, { JobType } from '../queue/queue.service';

// Create services with dependencies
const dbService = new DatabaseService(
  { 
    url: process.env.SUPABASE_URL || '', 
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
  },
  logger as winston.Logger
);
const cacheService = new CacheService(dbService, logger as winston.Logger);
const openaiService = new OpenAIService(
  dbService,
  cacheService,
  logger as winston.Logger
);

// Create queue service instance with deduplication
const queueService = new QueueService(dbService, logger as winston.Logger);

const predictionComparisonService = new PredictionComparisonService(
  dbService,
  cacheService,
  openaiService,
  logger as winston.Logger
);

interface JobHandlers {
  [key: string]: (payload: any) => Promise<void>;
}

export class QueueWorker {
  private isRunning = false;
  private shouldStop = false;
  private processInterval: NodeJS.Timeout | null = null;
  private concurrency: number;
  private activeJobs: Set<string> = new Set();
  private workerPromises: Promise<void>[] = [];

  constructor() {
    // Get concurrency from environment or default to 5
    this.concurrency = parseInt(process.env.JOB_CONCURRENCY || '5', 10);
    // Limit max concurrency to prevent excessive load
    if (this.concurrency > 20) {
      logger.warn('Very high concurrency detected, limiting to 20 workers', { requested: this.concurrency });
      this.concurrency = 20;
    }
  }

  private handlers: JobHandlers = {
    feed_fetch: async (payload) => {
      await processFeed(payload.sourceId);
    },
    
    content_process: async (payload) => {
      // If we already have the raw feed ID, use it directly
      if (payload.rawFeedId) {
        await contentProcessor.processContent(payload.rawFeedId);
        return;
      }
      
      // Otherwise, look it up based on source and external ID
      const { data: rawFeed } = await db.getClient()
        .from('raw_feeds')
        .select('id')
        .eq('source_id', payload.sourceId)
        .eq('external_id', payload.externalId)
        .single();

      if (rawFeed) {
        await contentProcessor.processContent(rawFeed.id);
      }
    },
    
    daily_analysis: async (payload) => {
      const date = payload?.date ? new Date(payload.date) : new Date();
      const forceRegenerate = payload?.forceRegenerate || false;
      await aiAnalysisService.runDailyAnalysis(date, forceRegenerate);
    },
    
    generate_predictions: async (payload) => {
      if (payload.analysisDate) {
        await aiAnalysisService.generatePredictions(payload.analysisDate);
      } else {
        logger.error('Missing analysisDate in generate_predictions payload');
      }
    },
    
    prediction_compare: async (payload) => {
      const { predictionId, analysisDate } = payload;
      
      if (!predictionId || !analysisDate) {
        logger.error('Invalid prediction comparison payload', payload);
        throw new Error('Missing required fields: predictionId, analysisDate');
      }
      
      try {
        logger.info('Starting prediction comparison', { predictionId, analysisDate });
        
        // Get the prediction to compare
        const prediction = await db.findById('predictions', predictionId);
        if (!prediction) {
          throw new Error(`Prediction not found: ${predictionId}`);
        }
        
        // Get the current analysis for comparison
        const currentAnalysis = await db.findById('daily_analysis', analysisDate);
        if (!currentAnalysis) {
          throw new Error(`Daily analysis not found for date: ${analysisDate}`);
        }
        
        // Compare prediction with actual outcome
        const comparisonResult = await predictionComparisonService.evaluatePrediction(
          prediction as any
        );
        
        // Store comparison result
        await db.create('prediction_comparisons', {
          id: uuidv4(),
          comparison_date: new Date(),
          previous_prediction_id: predictionId,
          current_analysis_id: (currentAnalysis as any).id,
          accuracy_score: comparisonResult.accuracy_score,
          outcome_description: comparisonResult.outcome_description,
          comparison_analysis: comparisonResult.comparison_analysis,
          created_at: new Date()
        });
        
        logger.info('Prediction comparison completed', { 
          predictionId, 
          accuracyScore: comparisonResult.accuracy_score 
        });
      } catch (error) {
        logger.error('Prediction comparison failed', { predictionId, error });
        throw error;
      }
    },
    
    // New handlers for page-triggered tasks
    feed_fetch_all: async (payload) => {
      const { triggeredBy, timestamp } = payload;
      logger.info('Processing feed_fetch_all', { triggeredBy, timestamp });
      
      try {
        // Get all active feeds
        const { data: activeFeeds, error } = await db.getClient()
          .from('feed_sources')
          .select('*')
          .eq('is_active', true);
          
        if (error) throw error;
        
        logger.info(`Found ${activeFeeds?.length || 0} active feeds to check`);
        
        // Check each feed to see if it needs refreshing
        for (const feed of activeFeeds || []) {
          const lastProcessed = feed.last_processed_at ? new Date(feed.last_processed_at) : null;
          const updateFrequency = feed.config?.update_frequency || 'hourly';
          const now = new Date();
          
          // Calculate if feed needs update
          const shouldUpdate = !lastProcessed || (() => {
            const diffMinutes = (now.getTime() - lastProcessed.getTime()) / (1000 * 60);
            switch (updateFrequency) {
              case '15min': return diffMinutes >= 15;
              case '30min': return diffMinutes >= 30;
              case 'hourly': return diffMinutes >= 60;
              case '4hours': return diffMinutes >= 240;
              case 'daily': return diffMinutes >= 1440;
              case 'weekly': return diffMinutes >= 10080;
              default: return diffMinutes >= 60;
            }
          })();
          
          if (shouldUpdate) {
            await queueService.enqueue('feed_fetch', {
              sourceId: feed.id
            }, {
              priority: feed.config?.priority === 'high' ? 1 : 
                       feed.config?.priority === 'medium' ? 3 : 5
            });
            logger.info(`Queued feed ${feed.name} for processing`);
          }
        }
      } catch (error) {
        logger.error('Error in feed_fetch_all:', error);
        throw error;
      }
    },
    
    content_process_check: async (payload) => {
      const { triggeredBy, timestamp } = payload;
      logger.info('Processing content_process_check', { triggeredBy, timestamp });
      
      try {
        // Find unprocessed content
        const { data: unprocessedContent, error: contentError } = await db.getClient()
          .from('processed_content')
          .select('id')
          .or('entities.is.null,entities.eq.{}')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(50);
          
        if (contentError) throw contentError;
        
        logger.info(`Found ${unprocessedContent?.length || 0} unprocessed content items`);
        
        // Queue them for processing
        for (const content of unprocessedContent || []) {
          await queueService.enqueue('content_process', {
            contentId: content.id
          }, { priority: 5 });
        }
        
        // Also check for raw feeds that haven't been processed
        const { data: unprocessedFeeds, error: feedError } = await db.getClient()
          .from('raw_feeds')
          .select('id, source_id, external_id')
          .eq('processing_status', 'pending')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(50);
          
        if (feedError) throw feedError;
        
        logger.info(`Found ${unprocessedFeeds?.length || 0} unprocessed raw feeds`);
        
        // Queue them for content processing
        for (const feed of unprocessedFeeds || []) {
          await queueService.enqueue('content_process', {
            rawFeedId: feed.id,
            sourceId: feed.source_id,
            externalId: feed.external_id
          }, { priority: 4 });
        }
      } catch (error) {
        logger.error('Error in content_process_check:', error);
        throw error;
      }
    },
    
    prediction_check: async (payload) => {
      const { triggeredBy, timestamp } = payload;
      logger.info('Processing prediction_check', { triggeredBy, timestamp });
      
      try {
        // Check if we need to generate predictions for today
        const today = new Date().toISOString().split('T')[0];
        const { data: todayAnalysis } = await db.getClient()
          .from('daily_analysis')
          .select('*')
          .eq('analysis_date', today)
          .single();
          
        if (todayAnalysis) {
          // Check if predictions exist
          const { data: predictions, error } = await db.getClient()
            .from('predictions')
            .select('id')
            .eq('daily_analysis_id', todayAnalysis.id);
            
          if (!error && (!predictions || predictions.length === 0)) {
            logger.info('No predictions for today, generating...');
            await queueService.enqueue('generate_predictions', {
              analysisId: todayAnalysis.id,
              analysisDate: today
            }, { priority: 2 });
          }
        }
        
        // Check for due prediction comparisons
        const { data: duePredictions } = await db.getClient()
          .from('predictions')
          .select('*')
          .is('prediction_comparisons.id', null)
          .or(
            `time_horizon.eq.1_week,created_at.lte.${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}`,
            `time_horizon.eq.1_month,created_at.lte.${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`,
            `time_horizon.eq.3_months,created_at.lte.${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}`
          )
          .limit(20);
          
        logger.info(`Found ${duePredictions?.length || 0} predictions due for comparison`);
        
        for (const prediction of duePredictions || []) {
          await queueService.enqueue('prediction_compare', {
            predictionId: prediction.id,
            analysisDate: today
          }, { priority: 3 });
        }
      } catch (error) {
        logger.error('Error in prediction_check:', error);
        throw error;
      }
    },
    
    transcribe_audio: async (payload) => {
      const { feedId, audioUrl, title } = payload;
      const jobStartTime = Date.now();
      
      if (!feedId || !audioUrl) {
        logger.error('Invalid transcription job payload', payload);
        throw new Error('Missing required fields: feedId, audioUrl');
      }
      
      try {
        logger.info('Starting audio transcription job with Netlify background function', { 
          feedId, 
          audioUrl, 
          title: title || 'Unknown',
          jobStartTime
        });

        // Import Netlify Whisper service
        const { netlifyWhisperService } = await import('../transcription/netlify-whisper.service');
        
        // Check if Netlify service is available
        const isAvailable = await netlifyWhisperService.isAvailable();
        if (!isAvailable) {
          logger.warn('Netlify Whisper service not available, falling back to local Whisper');
          
          // Fallback to local Whisper if available
          const { whisperService } = await import('../transcription/whisper.service');
          const localAvailable = await whisperService.isAvailable();
          
          if (localAvailable) {
            logger.info('Using local Whisper service as fallback');
            const result = await whisperService.transcribeAudio(audioUrl, feedId);
            
            // Update the raw feed with transcribed content
            await db.getClient()
              .from('raw_feeds')
              .update({
                content: result.text,
                metadata: {
                  ...payload.originalMetadata,
                  transcriptionComplete: true,
                  transcriptionLanguage: result.language,
                  audioUrl: audioUrl,
                  needsTranscription: false,
                  transcriptionMethod: 'local_whisper'
                },
                processing_status: 'pending', // Ready for content processing
                updated_at: new Date().toISOString()
              })
              .eq('id', feedId);
            
            // Process the transcribed content
            await contentProcessor.processContent(feedId);
            
            logger.info('Transcription completed with local Whisper', { feedId });
            return;
          }
          
          throw new Error('No transcription service available (neither Netlify nor local)');
        }
        
        logger.info('Netlify Whisper service available, queuing background transcription', { feedId });
        
        // Queue transcription in Netlify background function
        const result = await netlifyWhisperService.transcribeAudio(audioUrl, feedId, {
          title,
          originalMetadata: payload.originalMetadata
        });
        
        if (!result.success) {
          throw result.error || new Error('Failed to queue transcription');
        }
        
        logger.info('Transcription queued successfully in Netlify background function', {
          feedId,
          jobId: result.data.jobId,
          title: title || 'Unknown'
        });
        
        // The background function will handle:
        // 1. Downloading and transcribing the audio
        // 2. Updating the raw_feeds table with the transcript
        // 3. Queuing the content_process job
        
        // Monitor transcription progress (optional)
        const monitorProgress = async () => {
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes with 5 second intervals
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            const status = await netlifyWhisperService.getTranscriptionStatus(feedId);
            if (status.success && status.data) {
              logger.info('Transcription progress', {
                feedId,
                status: status.data.status,
                progress: status.data.progress
              });
              
              if (status.data.status === 'completed') {
                logger.info('Background transcription completed', { feedId });
                break;
              } else if (status.data.status === 'failed') {
                logger.error('Background transcription failed', { 
                  feedId, 
                  error: status.data.error 
                });
                break;
              }
            }
            
            attempts++;
          }
          
          if (attempts >= maxAttempts) {
            logger.warn('Stopped monitoring transcription progress after timeout', { feedId });
          }
        };
        
        // Start monitoring in background (don't await)
        monitorProgress().catch(error => {
          logger.error('Error monitoring transcription progress', { feedId, error });
        });
        
        const totalJobDuration = Date.now() - jobStartTime;
        logger.info('Transcription job delegated to Netlify background function', {
          feedId,
          title: title || 'Unknown',
          jobDurationMs: totalJobDuration
        });
        
      } catch (error) {
        const jobDuration = Date.now() - jobStartTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.error('Transcription job failed', { 
          feedId,
          audioUrl,
          title: title || 'Unknown',
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          jobDurationMs: jobDuration
        });

        // Update feed status to failed
        try {
          await db.getClient()
            .from('raw_feeds')
            .update({ 
              processing_status: 'failed',
              metadata: {
                ...payload.originalMetadata,
                transcriptionError: errorMessage,
                transcriptionAttempted: true,
                failedAt: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', feedId);
        } catch (updateError) {
          logger.error('Failed to update feed status after transcription error', {
            feedId,
            updateError
          });
        }
        
        throw error;
      }
    },

    // Stock scanner jobs
    stock_fetch_fundamentals: async (payload) => {
      const { StockScannerJobProcessor } = await import('../stock/stock-scanner-jobs');
      const processor = new StockScannerJobProcessor(cache, queueService);
      await processor.processJob('stock_fetch_fundamentals', payload);
    },

    stock_calculate_changes: async (payload) => {
      const { StockScannerJobProcessor } = await import('../stock/stock-scanner-jobs');
      const processor = new StockScannerJobProcessor(cache, queueService);
      await processor.processJob('stock_calculate_changes', payload);
    },

    stock_peer_comparison: async (payload) => {
      const { StockScannerJobProcessor } = await import('../stock/stock-scanner-jobs');
      const processor = new StockScannerJobProcessor(cache, queueService);
      await processor.processJob('stock_peer_comparison', payload);
    },

    stock_generate_alerts: async (payload) => {
      const { StockScannerJobProcessor } = await import('../stock/stock-scanner-jobs');
      const processor = new StockScannerJobProcessor(cache, queueService);
      await processor.processJob('stock_generate_alerts', payload);
    },

    stock_daily_scan: async (payload) => {
      const { StockScannerJobProcessor } = await import('../stock/stock-scanner-jobs');
      const processor = new StockScannerJobProcessor(cache, queueService);
      await processor.processJob('stock_daily_scan', payload);
    },

    // Options scanner jobs
    options_scan: async (payload) => {
      const { optionsJobHandlers } = await import('../options/options-scanner-jobs');
      await optionsJobHandlers.options_scan(payload, queueService);
    },

    option_analysis: async (payload) => {
      const { optionsJobHandlers } = await import('../options/options-scanner-jobs');
      await optionsJobHandlers.option_analysis(payload, queueService);
    },

    unusual_options_activity: async (payload) => {
      const { optionsJobHandlers } = await import('../options/options-scanner-jobs');
      await optionsJobHandlers.unusual_options_activity(payload, queueService);
    },

    schedule_daily_options_scan: async (payload) => {
      const { optionsJobHandlers } = await import('../options/options-scanner-jobs');
      await optionsJobHandlers.schedule_daily_options_scan(payload, queueService);
    },

    options_alerts: async (payload) => {
      const { optionsJobHandlers } = await import('../options/options-scanner-jobs');
      await optionsJobHandlers.options_alerts(payload, queueService);
    }
  };

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Queue worker is already running');
      return;
    }

    logger.info('Starting queue worker', { concurrency: this.concurrency });
    this.isRunning = true;
    this.shouldStop = false;

    // Start multiple concurrent workers
    for (let i = 0; i < this.concurrency; i++) {
      const workerPromise = this.processJobsWorker(i).catch(error => {
        logger.error('Queue worker crashed', { workerId: i, error });
      });
      this.workerPromises.push(workerPromise);
    }

    // Also set up periodic tasks
    this.setupPeriodicTasks();
  }

  async stop(): Promise<void> {
    logger.info('Stopping queue worker');
    this.shouldStop = true;

    // Clear periodic tasks
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    // Wait for all worker promises to finish
    await Promise.all(this.workerPromises);
    
    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      logger.info('Waiting for active jobs to complete', { activeJobs: this.activeJobs.size });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isRunning = false;
    logger.info('Queue worker stopped');
  }

  private async processJobsWorker(workerId: number): Promise<void> {
    logger.info('Starting worker', { workerId });

    while (!this.shouldStop) {
      try {
        // Get next job from queue
        const job = await queueService.dequeue();

        if (!job) {
          // No jobs available, wait a bit
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Track active job
        this.activeJobs.add(job.job_id);

        logger.info('Processing job', { 
          workerId,
          jobId: job.job_id,
          jobType: job.job_type,
          attempts: job.attempts,
          activeJobs: this.activeJobs.size
        });

        // Execute job handler
        const handler = this.handlers[job.job_type];
        if (!handler) {
          this.activeJobs.delete(job.job_id);
          throw new Error(`No handler for job type: ${job.job_type}`);
        }

        try {
          await handler(job.payload);
          await queueService.complete(job.job_id);
          logger.info('Job completed successfully', { 
            workerId,
            jobId: job.job_id,
            jobType: job.job_type,
            activeJobs: this.activeJobs.size - 1
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await queueService.fail(job.job_id, errorMessage);
          logger.error('Job failed', { 
            workerId,
            jobId: job.job_id,
            jobType: job.job_type,
            error: errorMessage 
          });
        } finally {
          // Remove from active jobs
          this.activeJobs.delete(job.job_id);
        }

      } catch (error) {
        logger.error('Queue processing error', { workerId, error });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    logger.info('Worker stopped', { workerId });
  }

  // Method to get current worker status
  getStatus() {
    return {
      isRunning: this.isRunning,
      concurrency: this.concurrency,
      activeJobs: this.activeJobs.size,
      activeJobIds: Array.from(this.activeJobs),
      workerCount: this.workerPromises.length
    };
  }

  private setupPeriodicTasks(): void {
    // Process feeds every 4 hours
    this.scheduleTask('process_feeds', 4 * 60 * 60 * 1000, async () => {
      logger.info('Running periodic feed processing');
      
      // Get all active feed sources
      const { data: sources } = await db.getClient()
        .from('feed_sources')
        .select('id')
        .eq('is_active', true);

      if (sources) {
        for (const source of sources) {
          await queueService.enqueue(JobType.FEED_FETCH, { sourceId: source.id }, { priority: 5 });
        }
      }
    });

    // Run smarter analysis checks every 4 hours (same as feed processing)
    this.scheduleTask('analysis_generation', 4 * 60 * 60 * 1000, async () => {
      logger.info('Running 4-hourly smart analysis check');
      const today = new Date().toISOString().split('T')[0];
      
      // Check if analysis exists and how old it is
      const { data: existingAnalysis } = await supabase
        .from('daily_analysis')
        .select('id, created_at')
        .eq('analysis_date', today)
        .single();

      // Count processed content today
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { data: todayContent } = await supabase
        .from('processed_content')
        .select('id')
        .gte('created_at', startOfDay.toISOString());

      const contentCount = todayContent?.length || 0;
      const hasOldAnalysis = existingAnalysis && 
        new Date(existingAnalysis.created_at).getTime() < Date.now() - 6 * 60 * 60 * 1000;

      logger.info('4-hourly analysis check', { 
        today, 
        contentCount, 
        hasExistingAnalysis: !!existingAnalysis,
        hasOldAnalysis 
      });

      // Only queue if we have enough content and either no analysis or old analysis
      if (contentCount >= 5 && (!existingAnalysis || hasOldAnalysis)) {
        // Check if already queued to avoid duplicates
        const { data: existingJobs } = await supabase
          .from('job_queue')
          .select('id')
          .eq('job_type', 'daily_analysis')
          .in('status', ['pending', 'processing', 'retry'])
          .contains('payload', { date: today });

        if (!existingJobs || existingJobs.length === 0) {
          await queueService.enqueue('daily_analysis', { 
            date: today,
            forceRegenerate: !!existingAnalysis,
            source: '4hourly_periodic_check',
            contentCount
          }, 1); // High priority
          
          logger.info('🧠 Queued analysis from 4-hourly check', { today, contentCount });

          // Queue prediction generation with proper delay
          await queueService.enqueue('generate_predictions', { 
            analysisDate: today,
            source: '4hourly_periodic_check'
          }, 2, 300); // Medium priority, 5 minute delay
          
          logger.info('🔮 Queued predictions from 4-hourly check', { today });
        } else {
          logger.info('Analysis already queued, skipping 4-hourly trigger', { today });
        }
      } else {
        logger.info('4-hourly check: conditions not met for analysis trigger', { 
          contentCount, 
          hasExistingAnalysis: !!existingAnalysis,
          hasOldAnalysis 
        });
      }
    });

    // Clean up old data daily at 2 AM UTC
    this.scheduleDailyTask(2, 0, async () => {
      logger.info('Running cleanup');
      await db.getClient().rpc('cleanup_expired_data');
    });
  }

  private scheduleTask(name: string, intervalMs: number, task: () => Promise<void>): void {
    // Run immediately on start
    task().catch(error => logger.error(`Periodic task ${name} failed`, { error }));

    // Then schedule for regular intervals
    setInterval(() => {
      if (!this.shouldStop) {
        task().catch(error => logger.error(`Periodic task ${name} failed`, { error }));
      }
    }, intervalMs);
  }

  private scheduleDailyTask(hour: number, minute: number, task: () => Promise<void>): void {
    const runTask = () => {
      const now = new Date();
      const scheduled = new Date();
      scheduled.setUTCHours(hour, minute, 0, 0);

      // If scheduled time has passed today, run tomorrow
      if (scheduled <= now) {
        scheduled.setDate(scheduled.getDate() + 1);
      }

      const delay = scheduled.getTime() - now.getTime();

      setTimeout(() => {
        if (!this.shouldStop) {
          task().catch(error => logger.error('Daily task failed', { error }));
          // Schedule next run
          runTask();
        }
      }, delay);
    };

    runTask();
  }
}

// Export singleton instance
export const queueWorker = new QueueWorker();