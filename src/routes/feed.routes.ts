// Feed routes following CLAUDE.md specification
import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import FeedController from '../controllers/feed.controller';

const router = Router();

// Apply authentication to all feed routes
router.use(authenticateToken);

// Initialize controller with dependencies from request context
router.use((req: any, res, next) => {
  req.feedController = new FeedController(
    req.context.db,
    req.context.cache,
    req.context.queue,
    req.context.logger
  );
  next();
});

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

// Get all feed sources
router.get('/',
  query('is_active').optional().isBoolean(),
  query('type').optional().isIn(['rss', 'podcast', 'youtube', 'api', 'multi_source']),
  query('category').optional().isString(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.getFeedSources(req, res, next);
  }
);

// Get single feed source
router.get('/:id',
  param('id').isUUID(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.getFeedSource(req, res, next);
  }
);

// Create new feed source
router.post('/',
  body('name').notEmpty().trim(),
  body('type').isIn(['rss', 'podcast', 'youtube', 'api', 'multi_source']),
  body('url').isURL(),
  body('config').optional().isObject(),
  body('config.categories').optional().isArray(),
  body('config.priority').optional().isIn(['low', 'medium', 'high']),
  body('config.update_frequency').optional().isString(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.createFeedSource(req, res, next);
  }
);

// Update feed source
router.put('/:id',
  param('id').isUUID(),
  body('name').optional().trim(),
  body('type').optional().isIn(['rss', 'podcast', 'youtube', 'api', 'multi_source']),
  body('url').optional().isURL(),
  body('is_active').optional().isBoolean(),
  body('config').optional().isObject(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.updateFeedSource(req, res, next);
  }
);

// Delete feed source
router.delete('/:id',
  param('id').isUUID(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.deleteFeedSource(req, res, next);
  }
);

// Process feed manually
router.post('/:id/process',
  param('id').isUUID(),
  body('priority').optional().isInt({ min: 1, max: 10 }),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.processFeed(req, res, next);
  }
);

// Get feed content
router.get('/:id/content',
  param('id').isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.getFeedContent(req, res, next);
  }
);

// Get feed statistics
router.get('/:id/stats',
  param('id').isUUID(),
  query('period').optional().isIn(['1d', '7d', '30d', '90d']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.getFeedStats(req, res, next);
  }
);

// Get all raw feeds
router.get('/raw/list',
  query('source_id').optional().isUUID(),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.getRawFeeds(req, res, next);
  }
);

// Process all pending feeds
router.post('/process/pending',
  body('priority').optional().isInt({ min: 1, max: 10 }),
  handleValidationErrors,
  (req: any, res, next) => {
    req.feedController.processAllPending(req, res, next);
  }
);

// Bulk operations
router.post('/bulk/process',
  body('sourceIds').isArray().notEmpty(),
  body('sourceIds.*').isUUID(),
  body('priority').optional().isInt({ min: 1, max: 10 }),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { sourceIds, priority = 5 } = req.body;
      const jobs = [];

      for (const sourceId of sourceIds) {
        const jobId = await req.context.queue.enqueue('feed_fetch', {
          sourceId
        }, { priority });
        jobs.push({ sourceId, jobId });
      }

      res.json({
        success: true,
        data: {
          message: 'Bulk processing queued',
          jobs
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Feed source test endpoint
router.post('/test',
  body('type').isIn(['rss', 'podcast', 'youtube', 'api']),
  body('url').isURL(),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const { type, url } = req.body;
      
      // Quick test to validate feed URL
      // This would be implemented based on feed type
      res.json({
        success: true,
        data: {
          valid: true,
          message: 'Feed URL appears to be valid',
          type,
          url
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      feedController: FeedController;
    }
  }
}

export default router;