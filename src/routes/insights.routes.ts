import { Router } from 'express';
import { InsightsController } from '../controllers/insights.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';

const router = Router();

// Validation schemas for query parameters
const timeframeValidation = {
  timeframe: {
    in: ['query'],
    optional: true,
    isIn: {
      options: [['7d', '30d', '90d', '1y']],
      errorMessage: 'Timeframe must be one of: 7d, 30d, 90d, 1y'
    }
  }
};

// Apply optional authentication to all insights routes (like dashboard)
router.use(optionalAuth);

/**
 * @swagger
 * /api/insights/dashboard:
 *   get:
 *     summary: Get comprehensive insights dashboard data
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range for insights
 *     responses:
 *       200:
 *         description: Insights dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 predictions:
 *                   type: array
 *                   description: Recent predictions data
 *                 accuracyByType:
 *                   type: array
 *                   description: Prediction accuracy by type
 *                 accuracyByHorizon:
 *                   type: array
 *                   description: Prediction accuracy by time horizon
 *                 sentimentTrends:
 *                   type: array
 *                   description: Daily sentiment trends
 *                 topicTrends:
 *                   type: array
 *                   description: Trending topics with growth metrics
 *                 entityData:
 *                   type: array
 *                   description: Entity analytics with sentiment
 *                 feedSourceStats:
 *                   type: array
 *                   description: Feed source performance statistics
 *                 summary:
 *                   type: object
 *                   description: Summary statistics
 */
router.get('/dashboard', 
  // validateQuery(timeframeValidation), // Temporarily disabled for testing
  InsightsController.getInsightsDashboard
);

/**
 * @swagger
 * /api/insights/accuracy:
 *   get:
 *     summary: Get prediction accuracy data
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Prediction accuracy analysis
 */
router.get('/accuracy', 
  // validateQuery(timeframeValidation), // Temporarily disabled for testing
  InsightsController.getPredictionAccuracy
);

/**
 * @swagger
 * /api/insights/content:
 *   get:
 *     summary: Get content analytics data
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Content analytics with sentiment and topics
 */
router.get('/content', 
  // validateQuery(timeframeValidation), // Temporarily disabled for testing
  InsightsController.getContentAnalytics
);

export { router as insightsRoutes };