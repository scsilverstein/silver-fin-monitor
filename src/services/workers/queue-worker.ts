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