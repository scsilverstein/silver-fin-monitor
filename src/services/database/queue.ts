import { supabase } from './client';
import { logger } from '@/utils/logger';

export interface QueueJob {
  job_id: string;
  job_type: string;
  payload: any;
  priority: number;
  attempts: number;
}

export class DatabaseQueueService {
  private isProcessing = false;
  private shouldStop = false;

  async enqueue(jobType: string, payload: any, priority: number = 5, delaySeconds: number = 0): Promise<string> {
    try {
      const scheduledAt = new Date();
      scheduledAt.setSeconds(scheduledAt.getSeconds() + delaySeconds);

      const { data, error } = await supabase
        .from('job_queue')
        .insert({
          job_type: jobType,
          payload: payload,
          priority,
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
          attempts: 0,
          max_attempts: 3
        })
        .select('id')
        .single();

      if (error) throw error;
      
      logger.info('Job enqueued', { jobType, jobId: data.id });
      return data.id;
    } catch (error) {
      logger.error('Failed to enqueue job', { jobType, error });
      throw error;
    }
  }

  async processJobs(): Promise<void> {
    this.isProcessing = true;
    this.shouldStop = false;

    while (!this.shouldStop) {
      try {
        const job = await this.dequeue();
        
        if (!job) {
          await this.sleep(1000);
          continue;
        }

        try {
          await this.executeJob(job);
          await this.complete(job.job_id);
          logger.info('Job completed', { jobId: job.job_id, jobType: job.job_type });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.fail(job.job_id, errorMessage);
          logger.error('Job failed', { jobId: job.job_id, error: errorMessage });
        }
      } catch (error) {
        logger.error('Queue processing error', { error });
        await this.sleep(5000);
      }
    }

    this.isProcessing = false;
  }

  async stop(): Promise<void> {
    this.shouldStop = true;
    
    while (this.isProcessing) {
      await this.sleep(100);
    }
  }

  async dequeue(): Promise<QueueJob | null> {
    try {
      // Use the atomic database function to dequeue a job
      const { data, error } = await supabase
        .rpc('dequeue_job');

      if (error) {
        logger.error('Failed to dequeue job', { error });
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const job = data[0];
      
      logger.debug('Job dequeued', { 
        jobId: job.job_id, 
        jobType: job.job_type,
        attempts: job.attempts 
      });

      return {
        job_id: job.job_id,
        job_type: job.job_type,
        payload: job.payload,
        priority: job.priority,
        attempts: job.attempts
      };
    } catch (error) {
      logger.error('Dequeue error', { error });
      return null;
    }
  }

  async complete(jobId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .rpc('complete_job', { job_id: jobId });
        
      if (error) throw error;
      
      if (!data) {
        logger.warn('Job not found or already completed', { jobId });
      } else {
        logger.info('Job marked as completed', { jobId });
      }
    } catch (error) {
      logger.error('Failed to complete job', { jobId, error });
      throw error;
    }
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .rpc('fail_job', { 
          job_id: jobId, 
          error_msg: errorMessage 
        });
        
      if (error) throw error;
      
      if (!data) {
        logger.warn('Job not found or already failed', { jobId });
      } else {
        logger.info('Job marked as failed/retry', { jobId, errorMessage });
      }
    } catch (error) {
      logger.error('Failed to mark job as failed', { jobId, error });
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeJob(job: QueueJob) {
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
    
    // Check if it's a stock scanner job
    if (job.job_type.startsWith('stock_')) {
      await this.processStockScannerJob(job.job_type, payload);
      return;
    }
    
    switch (job.job_type) {
      case 'feed_fetch':
        await this.processFeedFetch(payload);
        break;
      case 'content_process':
        await this.processContent(payload);
        break;
      case 'daily_analysis':
        await this.generateDailyAnalysis(payload);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }

  private async processFeedFetch(payload: any): Promise<void> {
    // This will be implemented by the feed service
    const { processFeed } = await import('../feeds/processor');
    await processFeed(payload.sourceId);
  }

  private async processContent(payload: any): Promise<void> {
    // This will be implemented by the content processor
    const { contentProcessor } = await import('../content/processor');
    await contentProcessor.processContent(payload.feedId);
  }

  private async generateDailyAnalysis(payload: any): Promise<void> {
    // This will be implemented by the AI analysis service
    const { aiAnalysisService } = await import('../ai/analysis');
    await aiAnalysisService.runDailyAnalysis(payload.date ? new Date(payload.date) : new Date());
  }

  private async processStockScannerJob(jobType: string, payload: any): Promise<void> {
    // Lazy load the stock scanner processor to avoid circular dependencies
    const { StockScannerJobProcessor } = await import('../stock/stock-scanner-jobs');
    const { cache } = await import('../cache');
    
    const processor = new StockScannerJobProcessor(cache, this);
    await processor.processJob(jobType, payload);
  }
}

export const queueService = new DatabaseQueueService();