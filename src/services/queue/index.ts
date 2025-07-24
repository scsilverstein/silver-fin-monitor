// Database-based queue service implementation following CLAUDE.md specification
import { Queue, QueueJob, Result } from '@/types';
import { db } from '@/services/database';
import { createContextLogger, logQueueOperation } from '@/utils/logger';
import config from '@/config';

const queueLogger = createContextLogger('Queue');

export class DatabaseQueueService implements Queue {
  private isProcessing = false;
  private shouldStop = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    // Bind methods to preserve context
    this.processJobs = this.processJobs.bind(this);
    this.stop = this.stop.bind(this);
  }

  async enqueue(
    jobType: string,
    payload: Record<string, any>,
    priority: number = config.queue.defaultPriority,
    delaySeconds: number = 0
  ): Promise<string> {
    try {
      queueLogger.debug('Enqueuing job', { jobType, priority, delaySeconds });
      
      const result = await db.query<{ job_id: string }>(
        'SELECT enqueue_job($1, $2, $3, $4) as job_id',
        [jobType, JSON.stringify(payload), priority, delaySeconds]
      );

      const jobId = result[0]?.job_id;
      if (!jobId) {
        throw new Error('Failed to enqueue job - no job ID returned');
      }

      logQueueOperation(jobId, jobType, 'enqueued', { priority, delaySeconds });
      return jobId;
    } catch (error) {
      queueLogger.error('Failed to enqueue job', { jobType, error });
      throw error;
    }
  }

  async dequeue(): Promise<QueueJob | null> {
    try {
      const result = await db.query<{
        job_id: string;
        job_type: string;
        payload: Record<string, any>;
        priority: number;
        attempts: number;
      }>('SELECT * FROM dequeue_job()');

      if (!result || result.length === 0) {
        return null;
      }

      const job = result[0]!;
      const queueJob: QueueJob = {
        id: job.job_id,
        jobType: job.job_type,
        priority: job.priority,
        payload: job.payload,
        status: 'processing',
        attempts: job.attempts,
        maxAttempts: config.queue.maxRetries,
        scheduledAt: new Date(),
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        createdAt: new Date()
      };

      logQueueOperation(queueJob.id, queueJob.jobType, 'dequeued', { 
        attempts: queueJob.attempts 
      });
      
      return queueJob;
    } catch (error) {
      queueLogger.error('Failed to dequeue job', error);
      return null;
    }
  }

  async complete(jobId: string): Promise<boolean> {
    try {
      queueLogger.debug('Completing job', { jobId });
      
      const result = await db.query<{ success: boolean }>(
        'SELECT complete_job($1) as success',
        [jobId]
      );

      const success = result[0]?.success || false;
      
      if (success) {
        logQueueOperation(jobId, 'unknown', 'completed');
      } else {
        queueLogger.warn('Job completion returned false', { jobId });
      }

      return success;
    } catch (error) {
      queueLogger.error('Failed to complete job', { jobId, error });
      return false;
    }
  }

  async fail(jobId: string, errorMessage: string): Promise<boolean> {
    try {
      queueLogger.debug('Failing job', { jobId, errorMessage });
      
      const result = await db.query<{ success: boolean }>(
        'SELECT fail_job($1, $2) as success',
        [jobId, errorMessage]
      );

      const success = result[0]?.success || false;
      
      if (success) {
        logQueueOperation(jobId, 'unknown', 'failed', { errorMessage });
      } else {
        queueLogger.warn('Job failure returned false', { jobId });
      }

      return success;
    } catch (error) {
      queueLogger.error('Failed to fail job', { jobId, error });
      return false;
    }
  }

  async getStats(): Promise<Record<string, number>> {
    try {
      const result = await db.query<{ status: string; count: number }>(
        'SELECT * FROM get_queue_stats()'
      );

      const stats: Record<string, number> = {};
      result.forEach(row => {
        stats[row.status] = Number(row.count);
      });

      return stats;
    } catch (error) {
      queueLogger.error('Failed to get queue stats', error);
      return {};
    }
  }

  // Job processing worker
  async processJobs(): Promise<void> {
    if (this.isProcessing) {
      queueLogger.warn('Job processing already running');
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;
    queueLogger.info('Starting job processing worker');

    while (!this.shouldStop) {
      try {
        const job = await this.dequeue();
        
        if (!job) {
          // No jobs available, wait before checking again
          await this.sleep(1000);
          continue;
        }

        try {
          await this.executeJob(job);
          await this.complete(job.id);
          queueLogger.info('Job completed successfully', { 
            jobId: job.id, 
            jobType: job.jobType 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.fail(job.id, errorMessage);
          queueLogger.error('Job execution failed', { 
            jobId: job.id, 
            jobType: job.jobType, 
            error: errorMessage 
          });
        }
      } catch (error) {
        queueLogger.error('Queue processing error', error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }

    this.isProcessing = false;
    queueLogger.info('Job processing worker stopped');
  }

  // Start continuous job processing
  start(): void {
    if (this.processingInterval) {
      queueLogger.warn('Queue processing already started');
      return;
    }

    queueLogger.info('Starting queue processing');
    this.processJobs().catch(error => {
      queueLogger.error('Queue processing crashed', error);
    });
  }

  // Graceful shutdown
  async stop(): Promise<void> {
    queueLogger.info('Stopping queue processing');
    this.shouldStop = true;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null as any;
    }
    
    // Wait for current processing to finish
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (this.isProcessing && attempts < maxAttempts) {
      await this.sleep(1000);
      attempts++;
    }
    
    if (this.isProcessing) {
      queueLogger.warn('Force stopping queue processing after timeout');
    }
    
    queueLogger.info('Queue processing stopped');
  }

  // Execute a job based on its type
  private async executeJob(job: QueueJob): Promise<void> {
    queueLogger.debug('Executing job', { jobId: job.id, jobType: job.jobType });
    
    switch (job.jobType) {
      case 'feed_fetch':
        await this.executeFeedFetch(job);
        break;
      case 'content_process':
        await this.executeContentProcess(job);
        break;
      case 'daily_analysis':
        await this.executeDailyAnalysis(job);
        break;
      case 'prediction_comparison':
        await this.executePredictionComparison(job);
        break;
      case 'cleanup':
        await this.executeCleanup(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }
  }

  // Job execution methods
  private async executeFeedFetch(job: QueueJob): Promise<void> {
    const { feedManager } = await import('@/services/feeds');
    const { sourceId, sourceIds } = job.payload;
    
    if (sourceId) {
      await feedManager.processFeedSource(sourceId);
    } else if (sourceIds && Array.isArray(sourceIds)) {
      for (const id of sourceIds) {
        await feedManager.processFeedSource(id);
      }
    } else {
      // Process all feeds
      await feedManager.processAllFeeds();
    }
  }

  private async executeContentProcess(job: QueueJob): Promise<void> {
    const { feedManager } = await import('@/services/feeds');
    const { rawFeedId } = job.payload;
    
    if (!rawFeedId) {
      throw new Error('rawFeedId is required for content processing');
    }
    
    await feedManager.processContent(rawFeedId);
  }

  private async executeDailyAnalysis(job: QueueJob): Promise<void> {
    const { analysisManager } = await import('@/services/ai');
    const { date } = job.payload;
    
    if (date) {
      await analysisManager.generateDailyAnalysis(date);
    } else {
      await analysisManager.runDailyAnalysis();
    }
  }

  private async executePredictionComparison(job: QueueJob): Promise<void> {
    const { analysisManager } = await import('@/services/ai');
    const { predictionId, date } = job.payload;
    
    if (!predictionId) {
      // Compare all due predictions
      await analysisManager.compareAllDuePredictions();
    } else {
      await analysisManager.comparePrediction(predictionId, date || new Date().toISOString().split('T')[0]);
    }
  }

  private async executeCleanup(job: QueueJob): Promise<void> {
    queueLogger.info('Running cleanup job', { jobId: job.id });
    
    try {
      // Clean up expired cache entries and old jobs
      const cleanedCount = await db.query<{ count: number }>(
        'SELECT cleanup_expired_data() as count'
      );
      
      queueLogger.info('Cleanup completed', { 
        jobId: job.id, 
        cleanedCount: cleanedCount[0]?.count || 0 
      });
    } catch (error) {
      queueLogger.error('Cleanup job failed', { jobId: job.id, error });
      throw error;
    }
  }

  // Utility method for sleeping
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check
  async healthCheck(): Promise<Result<boolean>> {
    try {
      const stats = await this.getStats();
      
      // Check if we can get stats and queue is responding
      const isHealthy = typeof stats === 'object' && stats !== null;
      
      return { success: true, data: isHealthy };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

// Create and export queue instance
export const queue = new DatabaseQueueService();

export default queue;