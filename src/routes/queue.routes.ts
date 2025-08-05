// Queue management routes following CLAUDE.md specification
import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { QueueService, JobType } from '../services/queue/queue.service';

const router = Router();

// Apply authentication to all queue routes
router.use(authenticateToken);

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

// Get queue statistics
router.get('/stats', async (req: any, res, next) => {
  try {
    const queue: QueueService = req.context.queue;
    
    const stats = await queue.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// Get queue processing status
router.get('/status', async (req: any, res, next) => {
  try {
    const queue: QueueService = req.context.queue;
    
    const isProcessing = queue.getProcessingStatus();
    
    res.json({
      success: true,
      data: {
        isProcessing,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
});

// List jobs with pagination and filtering
router.get('/jobs',
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'retry']),
  query('jobType').optional().isIn(Object.values(JobType)),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { status, jobType, limit = 50, offset = 0 } = req.query;
      const db = req.context.db;
      
      let query = 'SELECT * FROM job_queue WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
      
      if (jobType) {
        query += ` AND job_type = $${paramIndex}`;
        params.push(jobType);
        paramIndex++;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), Number(offset));
      
      const jobs = await db.query(query, params);
      
      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM job_queue WHERE 1=1';
      const countParams: any[] = [];
      paramIndex = 1;
      
      if (status) {
        countQuery += ` AND status = $${paramIndex}`;
        countParams.push(status);
        paramIndex++;
      }
      
      if (jobType) {
        countQuery += ` AND job_type = $${paramIndex}`;
        countParams.push(jobType);
      }
      
      const [{ count }] = await db.query(countQuery, countParams);
      
      res.json({
        success: true,
        data: jobs,
        meta: {
          total: Number(count),
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get specific job details
router.get('/jobs/:id',
  param('id').isUUID(),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const db = req.context.db;
      
      const [job] = await db.query(
        'SELECT * FROM job_queue WHERE id = $1',
        [id]
      );
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      
      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      next(error);
    }
  }
);

// Enqueue a new job (admin only)
router.post('/jobs',
  requireRole('admin'),
  body('jobType').isIn(Object.values(JobType)),
  body('payload').optional().isObject(),
  body('priority').optional().isInt({ min: 1, max: 10 }),
  body('delaySeconds').optional().isInt({ min: 0 }),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { jobType, payload = {}, priority = 5, delaySeconds = 0 } = req.body;
      const queue: QueueService = req.context.queue;
      
      const jobId = await queue.enqueue(jobType, payload, { 
        priority, 
        delaySeconds 
      });
      
      res.status(201).json({
        success: true,
        data: {
          jobId,
          message: 'Job enqueued successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Retry a specific job
router.post('/jobs/:id/retry',
  requireRole('admin'),
  param('id').isUUID(),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const db = req.context.db;
      const queue: QueueService = req.context.queue;
      
      // Get the failed job
      const [job] = await db.query(
        'SELECT * FROM job_queue WHERE id = $1 AND status IN ($2, $3)',
        [id, 'failed', 'retry']
      );
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found or not in failed state'
        });
      }
      
      // Enqueue a new job with the same payload
      const newJobId = await queue.enqueue(job.job_type, job.payload, {
        priority: job.priority || 5
      });
      
      res.json({
        success: true,
        data: {
          originalJobId: id,
          newJobId,
          message: 'Job retry queued successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Cancel a specific job
router.post('/jobs/:id/cancel',
  requireRole('admin'),
  param('id').isUUID(),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const db = req.context.db;
      
      // Update job status to failed
      const result = await db.query(
        `UPDATE job_queue 
         SET status = 'failed', 
             error_message = 'Cancelled by admin',
             completed_at = NOW()
         WHERE id = $1 AND status IN ('pending', 'retry')
         RETURNING id`,
        [id]
      );
      
      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Job not found or already processed'
        });
      }
      
      res.json({
        success: true,
        data: {
          message: 'Job cancelled successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a specific job (admin only)
router.delete('/jobs/:id',
  requireRole('admin'),
  param('id').isUUID(),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const db = req.context.db;
      
      const result = await db.query(
        'DELETE FROM job_queue WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          message: 'Job deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Clear jobs with filters (admin only)
router.delete('/jobs',
  requireRole('admin'),
  query('status').optional().isIn(['completed', 'failed']),
  query('olderThan').optional().isInt({ min: 1 }),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { status, olderThan = 7 } = req.query;
      const db = req.context.db;
      
      let query = 'DELETE FROM job_queue WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      } else {
        query += ` AND status IN ('completed', 'failed')`;
      }
      
      query += ` AND created_at < NOW() - INTERVAL '${Number(olderThan)} days'`;
      
      const result = await db.query(query + ' RETURNING id', params);
      
      res.json({
        success: true,
        data: {
          deletedCount: result.length,
          message: `Deleted ${result.length} jobs`
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Retry all failed jobs (admin only)
router.post('/retry/failed',
  requireRole('admin'),
  async (req: any, res, next) => {
    try {
      const db = req.context.db;
      const queue: QueueService = req.context.queue;
      
      // Get all failed jobs
      const failedJobs = await db.query(
        'SELECT * FROM job_queue WHERE status = $1 ORDER BY created_at DESC LIMIT 100',
        ['failed']
      );
      
      let retriedCount = 0;
      
      for (const job of failedJobs) {
        try {
          await queue.enqueue(job.job_type, job.payload, {
            priority: job.priority || 5
          });
          retriedCount++;
        } catch (error) {
          req.context.logger.error('Failed to retry job', { jobId: job.id, error });
        }
      }
      
      res.json({
        success: true,
        data: {
          retriedCount,
          totalFailed: failedJobs.length,
          message: `Retried ${retriedCount} out of ${failedJobs.length} failed jobs`
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Pause queue processing (admin only)
router.post('/pause',
  requireRole('admin'),
  async (req: any, res, next) => {
    try {
      const queue: QueueService = req.context.queue;
      
      await queue.stopProcessing();
      
      res.json({
        success: true,
        data: {
          message: 'Queue processing paused'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Resume queue processing (admin only)
router.post('/resume',
  requireRole('admin'),
  async (req: any, res, next) => {
    try {
      const queue: QueueService = req.context.queue;
      
      await queue.startProcessing();
      
      res.json({
        success: true,
        data: {
          message: 'Queue processing resumed'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;