import { queueService } from '../database/queue';
import { processFeed } from '../feeds/processor';
import { contentProcessor } from '../content/processor';
import { aiAnalysisService } from '../ai/analysis';
import { logger } from '@/utils/logger';
import { db } from '../database';
import { cache } from '../cache';

interface JobHandlers {
  [key: string]: (payload: any) => Promise<void>;
}

export class QueueWorker {
  private isRunning = false;
  private shouldStop = false;
  private processInterval: NodeJS.Timeout | null = null;

  private handlers: JobHandlers = {
    feed_fetch: async (payload) => {
      await processFeed(payload.sourceId);
    },
    
    content_process: async (payload) => {
      // Get raw feed ID based on source and external ID
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
      // TODO: Implement prediction comparison
      logger.info('Prediction comparison not yet implemented', payload);
    },
    
    transcribe_audio: async (payload) => {
      const { feedId, audioUrl, title } = payload;
      const jobStartTime = Date.now();
      
      if (!feedId || !audioUrl) {
        logger.error('Invalid transcription job payload', payload);
        throw new Error('Missing required fields: feedId, audioUrl');
      }
      
      try {
        logger.info('Starting audio transcription job', { 
          feedId, 
          audioUrl, 
          title: title || 'Unknown',
          jobStartTime
        });

        // Update raw feed status to indicate transcription in progress
        await db.getClient()
          .from('raw_feeds')
          .update({ 
            processing_status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', feedId);
        
        // Dynamically import to avoid loading if not needed
        const { whisperService } = await import('../transcription/whisper.service');
        
        // Check if Whisper is available
        const isAvailable = await whisperService.isAvailable();
        if (!isAvailable) {
          const errorMsg = 'Whisper service not available for transcription job';
          logger.error(errorMsg, { feedId, audioUrl });
          
          // Update feed status to failed
          await db.getClient()
            .from('raw_feeds')
            .update({ 
              processing_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', feedId);
          
          throw new Error(errorMsg);
        }
        
        logger.info('Whisper service available, starting transcription', { feedId });
        
        // Perform transcription with progress logging
        const transcriptionStartTime = Date.now();
        const result = await whisperService.transcribeAudio(audioUrl, feedId);
        const transcriptionDuration = Date.now() - transcriptionStartTime;
        
        logger.info('Transcription completed successfully', {
          feedId,
          title: title || 'Unknown',
          textLength: result.text.length,
          language: result.language,
          transcriptionDurationMs: transcriptionDuration,
          charactersPerSecond: Math.round(result.text.length / (transcriptionDuration / 1000))
        });

        // Update the raw feed with transcribed content
        const { error: updateError } = await db.getClient()
          .from('raw_feeds')
          .update({
            content: result.text,
            metadata: {
              ...payload.originalMetadata,
              transcriptionComplete: true,
              transcriptionLanguage: result.language,
              transcriptionDurationMs: transcriptionDuration,
              audioUrl: audioUrl,
              needsTranscription: false
            },
            processing_status: 'pending', // Ready for content processing
            updated_at: new Date().toISOString()
          })
          .eq('id', feedId);

        if (updateError) {
          logger.error('Failed to update feed with transcription', { 
            feedId, 
            error: updateError 
          });
          throw updateError;
        }

        logger.info('Raw feed updated with transcription, starting content processing', { feedId });
        
        // Process the transcribed content
        await contentProcessor.processContent(feedId);
        
        const totalJobDuration = Date.now() - jobStartTime;
        logger.info('Transcription job completed successfully', {
          feedId,
          title: title || 'Unknown',
          totalJobDurationMs: totalJobDuration,
          transcriptionDurationMs: transcriptionDuration,
          processingDurationMs: totalJobDuration - transcriptionDuration
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
    }
  };

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Queue worker is already running');
      return;
    }

    logger.info('Starting queue worker');
    this.isRunning = true;
    this.shouldStop = false;

    // Process jobs continuously
    this.processJobs().catch(error => {
      logger.error('Queue worker crashed', { error });
      this.isRunning = false;
    });

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

    // Wait for current processing to finish
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Queue worker stopped');
  }

  private async processJobs(): Promise<void> {
    while (!this.shouldStop) {
      try {
        // Get next job from queue
        const job = await queueService.dequeue();

        if (!job) {
          // No jobs available, wait a bit
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        logger.info('Processing job', { 
          jobId: job.job_id,
          jobType: job.job_type,
          attempts: job.attempts 
        });

        // Execute job handler
        const handler = this.handlers[job.job_type];
        if (!handler) {
          throw new Error(`No handler for job type: ${job.job_type}`);
        }

        try {
          await handler(job.payload);
          await queueService.complete(job.job_id);
          logger.info('Job completed successfully', { jobId: job.job_id });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await queueService.fail(job.job_id, errorMessage);
          logger.error('Job failed', { jobId: job.job_id, error });
        }

      } catch (error) {
        logger.error('Queue processing error', { error });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.isRunning = false;
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
          await queueService.enqueue('feed_fetch', { sourceId: source.id }, 5);
        }
      }
    });

    // Run analysis every 4 hours (same as feed processing)
    this.scheduleTask('analysis_generation', 4 * 60 * 60 * 1000, async () => {
      logger.info('Running 4-hourly analysis and predictions');
      const currentDate = new Date();
      
      // Queue analysis with current timestamp to ensure uniqueness
      await queueService.enqueue('daily_analysis', { 
        date: currentDate,
        timestamp: currentDate.getTime() // Add timestamp for uniqueness
      }, 1);
      
      // Also queue prediction generation immediately after
      setTimeout(async () => {
        await queueService.enqueue('generate_predictions', { 
          analysisDate: currentDate.toISOString().split('T')[0],
          timestamp: currentDate.getTime()
        }, 1);
      }, 30000); // Wait 30 seconds to let analysis complete
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