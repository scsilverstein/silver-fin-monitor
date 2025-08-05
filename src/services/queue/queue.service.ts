import { DatabaseService } from '../database/db.service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface QueueJob {
  job_id: string;
  job_type: string;
  payload: any;
  priority: number;
  attempts: number;
}

export interface EnqueueOptions {
  priority?: number;
  delaySeconds?: number;
  maxAttempts?: number;
}

export enum JobType {
  FEED_FETCH = 'feed_fetch',
  CONTENT_PROCESS = 'content_process',
  DAILY_ANALYSIS = 'daily_analysis',
  GENERATE_PREDICTIONS = 'generate_predictions',
  PREDICTION_COMPARE = 'prediction_compare',
  STOCK_FETCH = 'stock_fetch',
  TECHNICAL_ANALYSIS = 'technical_analysis',
  ALERT_CHECK = 'alert_check',
  EMAIL_SEND = 'email_send'
}

export class QueueService {
  private isProcessing = false;
  private shouldStop = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private jobHandlers: Map<string, (job: QueueJob) => Promise<void>> = new Map();

  constructor(
    private db: DatabaseService,
    private logger: winston.Logger
  ) {}

  // Register job handler
  registerHandler(jobType: string, handler: (job: QueueJob) => Promise<void>): void {
    this.jobHandlers.set(jobType, handler);
    this.logger.info(`Registered handler for job type: ${jobType}`);
  }

  // Add job to queue with deduplication
  async enqueue(
    jobType: string,
    payload: any,
    options: EnqueueOptions = {}
  ): Promise<string> {
    try {
      // Check for duplicate jobs before enqueuing
      const isDuplicate = await this.checkDuplicateJob(jobType, payload);
      if (isDuplicate) {
        this.logger.info(`Skipping duplicate job (type: ${jobType})`);
        return isDuplicate;
      }

      const result = await this.db.query<{ job_id: string }>(
        'SELECT enqueue_job($1, $2, $3, $4) as job_id',
        [
          jobType,
          JSON.stringify(payload),
          options.priority || 5,
          options.delaySeconds || 0
        ]
      );

      const jobId = result[0]?.job_id;
      this.logger.info(`Job enqueued: ${jobId} (type: ${jobType})`);
      return jobId;
    } catch (error) {
      this.logger.error('Failed to enqueue job:', error);
      throw error;
    }
  }

  // Check for duplicate jobs based on job type and payload
  private async checkDuplicateJob(jobType: string, payload: any): Promise<string | null> {
    // Define deduplication rules for different job types
    let query = '';
    let params: any[] = [];

    switch (jobType) {
      case JobType.FEED_FETCH:
        // For feed fetch, check if there's already a pending/processing job for the same source
        query = `
          SELECT id 
          FROM job_queue 
          WHERE job_type = $1 
          AND status IN ('pending', 'processing', 'retry')
          AND payload->>'sourceId' = $2
          LIMIT 1
        `;
        params = [jobType, payload.sourceId];
        break;

      case JobType.CONTENT_PROCESS:
        // For content processing, check if there's already a job for the same raw feed item
        // Handle different payload structures (contentId, rawFeedId, or sourceId+externalId)
        if (payload.contentId) {
          query = `
            SELECT id 
            FROM job_queue 
            WHERE job_type = $1 
            AND status IN ('pending', 'processing', 'retry')
            AND payload->>'contentId' = $2
            LIMIT 1
          `;
          params = [jobType, payload.contentId];
        } else if (payload.rawFeedId) {
          query = `
            SELECT id 
            FROM job_queue 
            WHERE job_type = $1 
            AND status IN ('pending', 'processing', 'retry')
            AND payload->>'rawFeedId' = $2
            LIMIT 1
          `;
          params = [jobType, payload.rawFeedId];
        } else if (payload.sourceId && payload.externalId) {
          query = `
            SELECT id 
            FROM job_queue 
            WHERE job_type = $1 
            AND status IN ('pending', 'processing', 'retry')
            AND payload->>'sourceId' = $2
            AND payload->>'externalId' = $3
            LIMIT 1
          `;
          params = [jobType, payload.sourceId, payload.externalId];
        } else {
          // No identifiable unique key, allow the job
          return null;
        }
        break;

      case JobType.DAILY_ANALYSIS:
        // For daily analysis, check if there's already a job for the same date
        query = `
          SELECT id 
          FROM job_queue 
          WHERE job_type = $1 
          AND status IN ('pending', 'processing', 'retry')
          AND payload->>'date' = $2
          LIMIT 1
        `;
        params = [jobType, payload.date];
        break;

      case JobType.GENERATE_PREDICTIONS:
        // For prediction generation, check if there's already a job for the same analysis date
        const analysisDateKey = payload.analysisDate || payload.date;
        if (analysisDateKey) {
          query = `
            SELECT id 
            FROM job_queue 
            WHERE job_type = $1 
            AND status IN ('pending', 'processing', 'retry')
            AND (payload->>'analysisDate' = $2 OR payload->>'date' = $2)
            LIMIT 1
          `;
          params = [jobType, analysisDateKey];
        } else if (payload.analysisId) {
          query = `
            SELECT id 
            FROM job_queue 
            WHERE job_type = $1 
            AND status IN ('pending', 'processing', 'retry')
            AND payload->>'analysisId' = $2
            LIMIT 1
          `;
          params = [jobType, payload.analysisId];
        } else {
          return null;
        }
        break;

      case JobType.PREDICTION_COMPARE:
        // For prediction comparison, check if there's already a job for the same prediction
        query = `
          SELECT id 
          FROM job_queue 
          WHERE job_type = $1 
          AND status IN ('pending', 'processing', 'retry')
          AND payload->>'predictionId' = $2
          LIMIT 1
        `;
        params = [jobType, payload.predictionId];
        break;

      default:
        // For other job types, allow duplicates
        return null;
    }

    const result = await this.db.query<{ id: string }>(query, params);
    return result.length > 0 ? result[0].id : null;
  }

  // Bulk enqueue jobs with deduplication
  async enqueueBatch(
    jobs: Array<{ type: string; payload: any; options?: EnqueueOptions }>
  ): Promise<string[]> {
    const jobIds: string[] = [];
    
    // Process jobs sequentially to ensure proper deduplication
    for (const job of jobs) {
      try {
        const jobId = await this.enqueue(job.type, job.payload, job.options);
        jobIds.push(jobId);
      } catch (error) {
        this.logger.error(`Failed to enqueue batch job: ${job.type}`, error);
        // Continue with other jobs even if one fails
      }
    }
    
    return jobIds;
  }

  // Start processing jobs
  async startProcessing(intervalMs: number = 1000): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Queue processing already started');
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;
    this.logger.info('Starting queue processing');

    // Process jobs immediately and then at intervals
    this.processNextJob();
    this.processingInterval = setInterval(() => {
      if (!this.shouldStop) {
        this.processNextJob();
      }
    }, intervalMs);
  }

  // Stop processing jobs
  async stopProcessing(): Promise<void> {
    this.shouldStop = true;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for current job to finish
    while (this.isProcessing) {
      await this.sleep(100);
    }

    this.logger.info('Queue processing stopped');
  }

  // Dequeue a job for processing (public method for QueueWorker)
  async dequeue(): Promise<QueueJob | null> {
    try {
      const jobs = await this.db.query<QueueJob>('SELECT * FROM dequeue_job()');
      return jobs.length > 0 ? jobs[0] : null;
    } catch (error) {
      this.logger.error('Failed to dequeue job:', error);
      throw error;
    }
  }

  // Complete a job (public method for QueueWorker)
  async complete(jobId: string): Promise<void> {
    try {
      await this.db.query('SELECT complete_job($1)', [jobId]);
      this.logger.info(`Job completed: ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to complete job ${jobId}:`, error);
      throw error;
    }
  }

  // Fail a job (public method for QueueWorker)
  async fail(jobId: string, errorMessage: string): Promise<void> {
    try {
      await this.db.query('SELECT fail_job($1, $2)', [jobId, errorMessage]);
      this.logger.error(`Job failed: ${jobId} - ${errorMessage}`);
    } catch (error) {
      this.logger.error(`Failed to mark job as failed ${jobId}:`, error);
      throw error;
    }
  }

  // Process next available job
  private async processNextJob(): Promise<void> {
    if (this.shouldStop) return;

    try {
      const job = await this.dequeue();
      
      if (!job) {
        return; // No jobs available
      }

      this.logger.info(`Processing job ${job.job_id} (type: ${job.job_type})`);

      try {
        await this.executeJob(job);
        await this.complete(job.job_id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.fail(job.job_id, errorMessage);
      }
    } catch (error) {
      this.logger.error('Queue processing error:', error);
    }
  }

  // Execute a specific job
  private async executeJob(job: QueueJob): Promise<void> {
    const handler = this.jobHandlers.get(job.job_type);
    
    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.job_type}`);
    }

    const startTime = Date.now();
    await handler(job);
    const duration = Date.now() - startTime;
    
    this.logger.info(`Job ${job.job_id} completed in ${duration}ms`);
  }


  // Get job status
  async getJobStatus(jobId: string): Promise<any> {
    const results = await this.db.tables.jobQueue.findMany({ id: jobId });
    return results[0] || null;
  }

  // Get queue statistics
  async getQueueStats(): Promise<any> {
    const stats = await this.db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
      FROM job_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `);

    const totalJobs = await this.db.tables.jobQueue.count();
    const pendingJobs = await this.db.tables.jobQueue.count({ status: 'pending' });

    return {
      total: totalJobs,
      pending: pendingJobs,
      statusBreakdown: stats,
      isProcessing: this.isProcessing
    };
  }

  // Public getter for processing status
  getProcessingStatus(): boolean {
    return this.isProcessing;
  }

  // Get queue statistics
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retry: number;
    total: number;
  }> {
    const result = await this.db.query<{
      status: string;
      count: string;
    }>(`
      SELECT status, COUNT(*) as count
      FROM job_queue
      GROUP BY status
    `);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retry: 0,
      total: 0
    };

    result.forEach(row => {
      const count = parseInt(row.count, 10);
      stats[row.status as keyof typeof stats] = count;
      stats.total += count;
    });

    return stats;
  }

  // Clean up old jobs
  async cleanupOldJobs(daysToKeep: number = 7): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      `DELETE FROM job_queue 
       WHERE status IN ('completed', 'failed') 
       AND completed_at < NOW() - INTERVAL '${daysToKeep} days'
       RETURNING id`
    );
    
    const count = result.length;
    this.logger.info(`Cleaned up ${count} old jobs`);
    return count;
  }

  // Retry failed jobs
  async retryFailedJobs(jobType?: string): Promise<number> {
    let query = `
      UPDATE job_queue 
      SET status = 'retry', 
          scheduled_at = NOW() + INTERVAL '1 minute',
          error_message = NULL
      WHERE status = 'failed' 
      AND attempts < max_attempts
    `;

    const params: any[] = [];
    if (jobType) {
      query += ' AND job_type = $1';
      params.push(jobType);
    }

    query += ' RETURNING id';

    const result = await this.db.query(query, params);
    const count = result.length;
    
    this.logger.info(`Retrying ${count} failed jobs`);
    return count;
  }

  // Schedule recurring job
  async scheduleRecurringJob(
    jobType: string,
    payload: any,
    cronExpression: string,
    options: EnqueueOptions = {}
  ): Promise<void> {
    // Store recurring job configuration
    await this.db.tables.recurringJobs.create({
      job_type: jobType,
      payload,
      cron_expression: cronExpression,
      options,
      is_active: true
    });

    this.logger.info(`Scheduled recurring job: ${jobType} (${cronExpression})`);
  }

  // Dead letter queue operations
  async getDeadLetterJobs(limit: number = 100): Promise<any[]> {
    return this.db.query(
      `SELECT * FROM job_queue 
       WHERE status = 'failed' 
       AND attempts >= max_attempts 
       ORDER BY completed_at DESC 
       LIMIT $1`,
      [limit]
    );
  }

  async reprocessDeadLetterJob(jobId: string): Promise<string> {
    const dlqJobs = await this.db.query(
      'SELECT * FROM job_queue WHERE id = $1 AND status = \'failed\'',
      [jobId]
    );

    if (dlqJobs.length === 0) {
      throw new Error('Job not found in dead letter queue');
    }

    const originalJob = dlqJobs[0];
    return this.enqueue(
      originalJob.job_type,
      originalJob.payload,
      {
        priority: 1,
        maxAttempts: 3
      }
    );
  }

  // Circuit breaker for job types
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  getCircuitBreaker(jobType: string): CircuitBreaker {
    if (!this.circuitBreakers.has(jobType)) {
      this.circuitBreakers.set(jobType, new CircuitBreaker(jobType, this.logger));
    }
    return this.circuitBreakers.get(jobType)!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  constructor(
    private name: string,
    private logger: winston.Logger
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime!.getTime() > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.logger.info(`Circuit breaker closed for ${this.name}`);
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      this.logger.error(`Circuit breaker opened for ${this.name}`);
    }
  }

  getState(): string {
    return this.state;
  }
}

export default QueueService;