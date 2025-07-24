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
      // First, find a job to process
      const { data: jobs, error: selectError } = await supabase
        .from('job_queue')
        .select('*')
        .in('status', ['pending', 'retry'])
        .lte('scheduled_at', new Date().toISOString())
        .lt('attempts', 3)
        .order('priority', { ascending: true })
        .order('scheduled_at', { ascending: true })
        .limit(1);

      if (selectError || !jobs || jobs.length === 0) {
        return null;
      }

      const job = jobs[0];

      // Update the job to mark it as processing
      const { error: updateError } = await supabase
        .from('job_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1
        })
        .eq('id', job.id)
        .eq('status', job.status); // Ensure it hasn't been picked up by another worker

      if (updateError) {
        logger.error('Failed to update job status', { error: updateError });
        return null;
      }

      return {
        job_id: job.id,
        job_type: job.job_type,
        payload: job.payload,
        priority: job.priority,
        attempts: job.attempts + 1
      };
    } catch (error) {
      logger.error('Dequeue error', { error });
      return null;
    }
  }

  async complete(jobId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('job_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
        
      if (error) throw error;
      logger.info('Job completed', { jobId });
    } catch (error) {
      logger.error('Failed to complete job', { jobId, error });
      throw error;
    }
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    try {
      // First get the job to check attempts
      const { data: job, error: fetchError } = await supabase
        .from('job_queue')
        .select('attempts, max_attempts')
        .eq('id', jobId)
        .single();

      if (fetchError || !job) {
        throw new Error('Job not found');
      }

      if (job.attempts >= job.max_attempts) {
        // Max attempts reached, mark as failed
        const { error } = await supabase
          .from('job_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
          
        if (error) throw error;
      } else {
        // Retry with exponential backoff
        const retryDelay = Math.pow(2, job.attempts) * 60; // minutes
        const scheduledAt = new Date();
        scheduledAt.setSeconds(scheduledAt.getSeconds() + retryDelay);

        const { error } = await supabase
          .from('job_queue')
          .update({
            status: 'retry',
            error_message: errorMessage,
            scheduled_at: scheduledAt.toISOString()
          })
          .eq('id', jobId);
          
        if (error) throw error;
      }
      
      logger.info('Job marked as failed', { jobId });
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
    const { cacheService } = await import('../cache');
    
    const processor = new StockScannerJobProcessor(cacheService, this);
    await processor.processJob(jobType, payload);
  }
}

export const queueService = new DatabaseQueueService();