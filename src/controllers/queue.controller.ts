// Queue management controller following CLAUDE.md specification
import { Request, Response } from 'express';
import { queueService } from '@/services/database/queue';
import { db } from '@/services/database/index';
import { cache, cacheKeys, cacheTtl } from '@/services/cache/index';
import { QueueJob, ApiResponse } from '@/types';
import { asyncHandler, NotFoundError } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';
import { queueWorker } from '@/services/workers/queue-worker';

const queueLogger = createContextLogger('QueueController');

export class QueueController {
  // Transform database row to QueueJob interface
  private transformDbRowToQueueJob(row: any): QueueJob {
    const job: QueueJob = {
      id: row.id,
      jobType: row.job_type,
      payload: row.payload,
      priority: row.priority,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      errorMessage: row.error_message || undefined,
      scheduledAt: row.scheduled_at, // Keep as string
      expiresAt: row.expires_at, // Keep as string
      createdAt: row.created_at // Keep as string
    };

    // Add optional fields only if they exist
    if (row.started_at) {
      job.startedAt = row.started_at; // Keep as string
    }
    if (row.completed_at) {
      job.completedAt = row.completed_at; // Keep as string
    }

    return job;
  }

  // Get queue statistics
  getQueueStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.debug('Getting queue stats');

    // Try cache first
    const cacheKey = cacheKeys.queueStats();
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      res.json({
        success: true,
        data: cached
      });
      return;
    }

    try {
      // Get all jobs and count them by status in memory
      // This is more reliable than multiple count queries
      const { data: allJobs, error } = await db.getClient()
        .from('job_queue')
        .select('status');
      
      if (error) {
        queueLogger.error('Failed to fetch job statuses', error);
        throw error;
      }

      // Count by status
      const statusCounts = {
        pending: 0,
        processing: 0,
        retry: 0,
        completed: 0,
        failed: 0,
        total: 0
      };

      if (allJobs) {
        allJobs.forEach(job => {
          if (job.status in statusCounts) {
            statusCounts[job.status as keyof typeof statusCounts]++;
          }
          statusCounts.total++;
        });
      }

      const statsResult = [statusCounts];
      
      if (!statsResult || statsResult.length === 0) {
        // Return default stats if query fails or table doesn't exist
        const defaultStats = {
          currentQueue: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            retry: 0
          },
          recentJobs: [],
          timestamp: new Date()
        };

        res.json({
          success: true,
          data: defaultStats
        });
        return;
      }

      const stats = statsResult[0];
      
      // Debug log to check stats structure
      queueLogger.debug('Raw stats from query', { stats });
      
      // Get recent jobs from the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: recentJobsData } = await db.getClient()
        .from('job_queue')
        .select('job_type, status, started_at, completed_at')
        .gte('created_at', oneDayAgo.toISOString())
        .limit(1000);

      // Group by job_type and status
      const jobGroups: Record<string, any> = {};
      if (recentJobsData) {
        recentJobsData.forEach(job => {
          const key = `${job.job_type}-${job.status}`;
          if (!jobGroups[key]) {
            jobGroups[key] = {
              job_type: job.job_type,
              status: job.status,
              count: 0,
              totalDuration: 0,
              durationCount: 0
            };
          }
          jobGroups[key].count++;
          
          if (job.started_at && job.completed_at) {
            const duration = (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000;
            jobGroups[key].totalDuration += duration;
            jobGroups[key].durationCount++;
          }
        });
      }

      const recentJobs = Object.values(jobGroups)
        .map(group => ({
          job_type: group.job_type,
          status: group.status,
          count: group.count,
          avg_duration: group.durationCount > 0 ? group.totalDuration / group.durationCount : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const queueStats = {
        currentQueue: {
          pending: Number(stats.pending) || 0,
          processing: Number(stats.processing) || 0,
          completed: Number(stats.completed) || 0,
          failed: Number(stats.failed) || 0,
          retry: Number(stats.retry) || 0,
          total: Number(stats.total) || 0
        },
        recentJobs: recentJobs.map(job => ({
          job_type: job.job_type,
          status: job.status,
          count: parseInt(job.count) || 0,
          avg_duration: parseFloat(String(job.avg_duration)) || 0
        })),
        timestamp: new Date()
      };

      // Cache the stats
      await cache.set(cacheKey, queueStats, cacheTtl.queueStats);

      res.json({
        success: true,
        data: queueStats
      });
    } catch (error) {
      queueLogger.error('Failed to get queue stats', error);
      
      // Return default stats on error
      const defaultStats = {
        currentQueue: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          retry: 0
        },
        recentJobs: [],
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: defaultStats
      });
    }
  });

  // Get queue processing status
  getQueueStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.debug('Getting queue status');

    // For now, return a simple status
    // In a full implementation, this would check if queue workers are running
    const status = {
      isProcessing: true, // Assume always processing for now
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: status
    });
  });

  // List recent jobs
  listJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { 
      status, 
      jobType,
      limit = 20, 
      offset = 0 
    } = req.query;
    
    queueLogger.debug('Listing jobs', { status, jobType, limit, offset });

    try {
      // Build filter object
      const filter: Record<string, any> = {};
      
      if (status && status !== 'all') {
        filter.status = status;
      }
      
      if (jobType && jobType !== 'all') {
        filter.job_type = jobType;
      }

      queueLogger.debug('Using filter', { filter });

      // Get total count first using the same filter
      const supabaseClient = db.getClient();
      let countQuery = supabaseClient.from('job_queue').select('*', { count: 'exact', head: true });
      
      // Apply the same filters to count query
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          countQuery = countQuery.eq(key, value);
        }
      });

      const { count: total, error: countError } = await countQuery;
      queueLogger.debug('Count result', { total, countError });

      if (countError) {
        queueLogger.error('Count query failed', countError);
        // Return empty result instead of throwing
        res.json({
          success: true,
          data: [],
          meta: {
            total: 0,
            page: 1,
            limit: Number(limit)
          }
        } as ApiResponse<QueueJob[]>);
        return;
      }

      // Get the actual jobs directly using Supabase client
      let dataQuery = supabaseClient.from('job_queue').select('*');
      
      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          dataQuery = dataQuery.eq(key, value);
        }
      });

      // Apply ordering
      dataQuery = dataQuery.order('created_at', { ascending: false });

      // Apply pagination
      const startRange = Number(offset);
      const endRange = startRange + Number(limit) - 1;
      dataQuery = dataQuery.range(startRange, endRange);

      const { data: rawJobs, error: dataError } = await dataQuery;
      
      if (dataError) {
        queueLogger.error('Data query failed', dataError);
        // Return empty result instead of throwing
        res.json({
          success: true,
          data: [],
          meta: {
            total: total || 0,
            page: Math.floor(Number(offset) / Number(limit)) + 1,
            limit: Number(limit)
          }
        } as ApiResponse<QueueJob[]>);
        return;
      }

      queueLogger.debug('Query result', { rawJobsCount: rawJobs?.length || 0, sample: rawJobs?.[0] });

      // Transform database rows to QueueJob interface
      const jobs = rawJobs?.map(row => this.transformDbRowToQueueJob(row)) || [];
      queueLogger.debug('Transformed jobs', { jobsCount: jobs.length });

      res.json({
        success: true,
        data: jobs,
        meta: {
          total: total || 0,
          page: Math.floor(Number(offset) / Number(limit)) + 1,
          limit: Number(limit)
        }
      } as ApiResponse<QueueJob[]>);
    } catch (error) {
      queueLogger.error('Failed to list jobs', error);
      // Return empty result on any error
      res.json({
        success: true,
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: Number(limit)
        }
      } as ApiResponse<QueueJob[]>);
    }
  });

  // Get job details
  getJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    queueLogger.debug('Getting job details', { id });

    const rawJob = await db.findById('job_queue', id!);
    
    if (!rawJob) {
      throw new NotFoundError('Job');
    }

    const job = this.transformDbRowToQueueJob(rawJob);

    res.json({
      success: true,
      data: job
    } as ApiResponse<QueueJob>);
  });

  // Enqueue a new job
  enqueueJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { jobType, payload = {}, priority = 5, delaySeconds = 0 } = req.body;
    
    queueLogger.info('Enqueuing job', { jobType, priority, delaySeconds });

    // Validate job type
    const validJobTypes = [
      'feed_fetch',
      'content_process',
      'daily_analysis',
      'prediction_comparison',
      'transcribe_audio',
      'generate_predictions',
      'cleanup'
    ];

    if (!validJobTypes.includes(jobType)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JOB_TYPE',
          message: `Invalid job type. Must be one of: ${validJobTypes.join(', ')}`
        }
      });
      return;
    }

    // Enqueue job
    const jobId = await queueService.enqueue(jobType, payload, priority, delaySeconds);

    queueLogger.info('Job enqueued', { jobId, jobType });

    res.status(201).json({
      success: true,
      data: {
        jobId,
        message: 'Job enqueued successfully'
      }
    });
  });

  // Retry a failed job
  retryJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    queueLogger.info('Retrying job', { id });

    // Get job details
    const rawJob = await db.findById('job_queue', id!);
    
    if (!rawJob) {
      throw new NotFoundError('Job');
    }

    const job = this.transformDbRowToQueueJob(rawJob);

    if (job.status !== 'failed') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JOB_STATUS',
          message: 'Can only retry failed jobs'
        }
      });
      return;
    }

    // Create new job with same parameters
    const newJobId = await queueService.enqueue(
      job.jobType,
      job.payload,
      job.priority,
      0
    );

    queueLogger.info('Job retry queued', { originalId: id, newJobId });

    res.json({
      success: true,
      data: {
        originalJobId: id,
        newJobId,
        message: 'Job retry queued successfully'
      }
    });
  });

  // Cancel a pending job
  cancelJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    queueLogger.info('Cancelling job', { id });

    // Update job status
    const result = await db.query(
      `UPDATE job_queue 
       SET status = 'failed', 
           error_message = 'Cancelled by user',
           completed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id]
    );

    if (!result || result.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_CANCEL',
          message: 'Job not found or not in pending status'
        }
      });
      return;
    }

    queueLogger.info('Job cancelled', { id });

    res.json({
      success: true,
      data: {
        message: 'Job cancelled successfully'
      }
    });
  });

  // Clear completed/failed jobs
  clearJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status = 'completed,failed', olderThan = 7 } = req.query;
    
    queueLogger.info('Clearing jobs', { status, olderThan });

    const statuses = (status as string).split(',');
    const validStatuses = ['completed', 'failed'];
    
    const invalidStatuses = statuses.filter(s => !validStatuses.includes(s));
    if (invalidStatuses.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Invalid status: ${invalidStatuses.join(', ')}`
        }
      });
      return;
    }

    // Delete old jobs
    const result = await db.query<{ count: number }>(`
      DELETE FROM job_queue 
      WHERE status = ANY($1::text[]) 
      AND completed_at < NOW() - INTERVAL '${Number(olderThan)} days'
      RETURNING id
    `, [statuses]);

    const deletedCount = result?.length || 0;

    queueLogger.info('Jobs cleared', { deletedCount });

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Cleared ${deletedCount} jobs`
      }
    });
  });

  // Delete a specific job
  deleteJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    queueLogger.info('Deleting job', { id });

    // Check if job exists and can be deleted
    const rawJob = await db.findById('job_queue', id!);
    
    if (!rawJob) {
      res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job not found'
        }
      });
      return;
    }

    const job = this.transformDbRowToQueueJob(rawJob);

    if (job.status === 'processing') {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DELETE_PROCESSING',
          message: 'Cannot delete job that is currently processing'
        }
      });
      return;
    }

    // Delete the job
    await db.delete('job_queue', id!);

    queueLogger.info('Job deleted', { id });

    res.json({
      success: true,
      data: {
        message: 'Job deleted successfully'
      }
    });
  });

  // Clear completed jobs
  clearCompleted = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { olderThan = 1 } = req.body;
    
    queueLogger.info('Clearing completed jobs', { olderThan });

    const result = await db.query<{ count: number }>(`
      DELETE FROM job_queue 
      WHERE status = 'completed' 
      AND completed_at < NOW() - INTERVAL '${Number(olderThan)} days'
      RETURNING id
    `);

    const deletedCount = result?.length || 0;

    queueLogger.info('Completed jobs cleared', { deletedCount });

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Cleared ${deletedCount} completed jobs`
      }
    });
  });

  // Clear failed jobs
  clearFailed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { olderThan = 1 } = req.body;
    
    queueLogger.info('Clearing failed jobs', { olderThan });

    const result = await db.query<{ count: number }>(`
      DELETE FROM job_queue 
      WHERE status = 'failed' 
      AND completed_at < NOW() - INTERVAL '${Number(olderThan)} days'
      RETURNING id
    `);

    const deletedCount = result?.length || 0;

    queueLogger.info('Failed jobs cleared', { deletedCount });

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Cleared ${deletedCount} failed jobs`
      }
    });
  });

  // Retry all failed jobs
  retryAllFailed = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.info('Retrying all failed jobs');

    // Get all failed jobs
    const rawFailedJobs = await db.findMany('job_queue', { status: 'failed' });
    const failedJobs = rawFailedJobs.map(row => this.transformDbRowToQueueJob(row));

    let retriedCount = 0;
    const errors: string[] = [];

    for (const job of failedJobs) {
      try {
        // Create new job with same parameters
        await queueService.enqueue(job.jobType, job.payload, job.priority, 0);
        retriedCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Job ${job.id}: ${errorMsg}`);
        queueLogger.error('Failed to retry job', { jobId: job.id, error: errorMsg });
      }
    }

    queueLogger.info('Failed jobs retry completed', { 
      total: failedJobs.length, 
      retried: retriedCount, 
      errors: errors.length 
    });

    res.json({
      success: true,
      data: {
        totalFailed: failedJobs.length,
        retriedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 10), // Only return first 10 errors
        message: `Retried ${retriedCount} out of ${failedJobs.length} failed jobs`
      }
    });
  });

  // Get worker status
  getWorkerStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.debug('Getting worker status');

    const status = queueWorker.getStatus();

    res.json({
      success: true,
      data: {
        worker: status,
        environment: {
          concurrency: process.env.JOB_CONCURRENCY || '3',
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      }
    });
  });

  // Start queue worker
  startWorker = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.info('Starting queue worker');

    try {
      await queueWorker.start();
      
      res.json({
        success: true,
        data: {
          message: 'Queue worker started successfully',
          status: queueWorker.getStatus()
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queueLogger.error('Failed to start worker', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to start queue worker: ${errorMessage}`
      });
    }
  });

  // Stop queue worker
  stopWorker = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.info('Stopping queue worker');

    try {
      await queueWorker.stop();
      
      res.json({
        success: true,
        data: {
          message: 'Queue worker stopped successfully',
          status: queueWorker.getStatus()
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queueLogger.error('Failed to stop worker', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to stop queue worker: ${errorMessage}`
      });
    }
  });

  // Restart queue worker
  restartWorker = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    queueLogger.info('Restarting queue worker');

    try {
      // Stop first
      await queueWorker.stop();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start again
      await queueWorker.start();
      
      res.json({
        success: true,
        data: {
          message: 'Queue worker restarted successfully',
          status: queueWorker.getStatus()
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queueLogger.error('Failed to restart worker', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: `Failed to restart queue worker: ${errorMessage}`
      });
    }
  });

  // Pause queue processing (legacy method - now stops worker)
  pauseQueue = asyncHandler(async (req: Request, res: Response, next: any): Promise<void> => {
    queueLogger.info('Pausing queue processing (stopping worker)');
    return this.stopWorker(req, res, next);
  });

  // Resume queue processing (legacy method - now starts worker)
  resumeQueue = asyncHandler(async (req: Request, res: Response, next: any): Promise<void> => {
    queueLogger.info('Resuming queue processing (starting worker)');
    return this.startWorker(req, res, next);
  });

  // Reset job (change status from failed/completed back to pending)
  resetJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    queueLogger.info('Resetting job', { jobId: id });

    try {
      // Update job status to pending and reset attempts
      const { data, error } = await db.getClient()
        .from('job_queue')
        .update({
          status: 'pending',
          attempts: 0,
          error_message: null,
          started_at: null,
          completed_at: null,
          scheduled_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new NotFoundError('Job not found');
      }

      // Clear cache
      await cache.delete(cacheKeys.queueStats());

      res.json({
        success: true,
        data: {
          message: 'Job reset successfully',
          job: this.transformDbRowToQueueJob(data)
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      queueLogger.error('Failed to reset job', { jobId: id, error: errorMessage });
      
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: errorMessage
        });
      } else {
        res.status(500).json({
          success: false,
          error: `Failed to reset job: ${errorMessage}`
        });
      }
    }
  });
}

export const queueController = new QueueController();