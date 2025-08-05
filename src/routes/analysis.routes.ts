// Analysis routes following CLAUDE.md specification
import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import AnalysisController from '../controllers/analysis.controller';

const router = Router();

// Apply authentication to all analysis routes
router.use(authenticateToken);

// Initialize controller with dependencies from request context
router.use((req: any, res, next) => {
  req.analysisController = new AnalysisController(
    req.context.db,
    req.context.cache,
    req.context.queue,
    req.context.aiService,
    // req.context.logger
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

// Get daily analyses
router.get('/',
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getDailyAnalyses(req, res, next);
  }
);

// Get latest analysis
router.get('/latest', (req: any, res, next) => {
  req.analysisController.getDailyAnalysis(req, { 
    ...res, 
    params: { date: new Date().toISOString().split('T')[0] } 
  }, next);
});

// Get single daily analysis by date
router.get('/:date',
  param('date').matches(/^\d{4}-\d{2}-\d{2}$/),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getDailyAnalysis(req, res, next);
  }
);

// Generate daily analysis
router.post('/generate',
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('force').optional().isBoolean(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.generateDailyAnalysis(req, res, next);
  }
);

// Get all predictions
router.get('/predictions',
  query('analysis_id').optional().isUUID(),
  query('prediction_type').optional().isIn(['market_direction', 'sector_performance', 'economic_indicator', 'geopolitical_event']),
  query('time_horizon').optional().isIn(['1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year']),
  query('start_date').optional().isISO8601(),
  query('end_date').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('offset').optional().isInt({ min: 0 }),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getPredictions(req, res, next);
  }
);

// Get single prediction
router.get('/predictions/:id',
  param('id').isUUID(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getPrediction(req, res, next);
  }
);

// Generate predictions for analysis
router.post('/predictions/generate',
  body('analysisId').isUUID(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.generatePredictions(req, res, next);
  }
);

// Compare prediction with outcome
router.post('/predictions/:id/compare',
  param('id').isUUID(),
  body('current_analysis_id').isUUID(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.comparePrediction(req, res, next);
  }
);

// Get market sentiment trend
router.get('/sentiment/trend',
  query('period').optional().isIn(['7d', '30d', '90d', '180d', '1y']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getMarketSentimentTrend(req, res, next);
  }
);

// Get prediction accuracy metrics
router.get('/accuracy',
  query('time_horizon').optional().isIn(['1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year']),
  query('prediction_type').optional().isString(),
  query('period').optional().isIn(['30d', '90d', '180d', '1y']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getPredictionAccuracy(req, res, next);
  }
);

// Get key themes analysis
router.get('/themes',
  query('period').optional().isIn(['1d', '7d', '30d', '90d']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.getKeyThemes(req, res, next);
  }
);

// Trigger analysis for specific date
router.post('/trigger',
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('force').optional().isBoolean(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.analysisController.generateDailyAnalysis(req, res, next);
  }
);

// Get analysis by ID (alternative to date)
router.get('/by-id/:id',
  param('id').isUUID(),
  handleValidationErrors,
  async (req: any, res, next) => {
    try {
      const analysis = await req.context.db.tables.dailyAnalysis.findOne({ 
        id: req.params.id 
      });
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found'
        });
      }

      // Get associated predictions
      const predictions = await req.context.db.query(
        'SELECT * FROM predictions WHERE daily_analysis_id = $1 ORDER BY time_horizon',
        [analysis.id]
      );

      // Transform to camelCase to match frontend expectations
      const transformedAnalysis = {
        id: analysis.id,
        analysisDate: analysis.analysis_date,
        marketSentiment: analysis.market_sentiment,
        keyThemes: analysis.key_themes || [],
        overallSummary: analysis.overall_summary,
        aiAnalysis: analysis.ai_analysis || {},
        confidenceScore: analysis.confidence_score,
        sourcesAnalyzed: analysis.sources_analyzed,
        createdAt: analysis.created_at
      };

      const transformedPredictions = predictions.map((pred: any) => ({
        id: pred.id,
        dailyAnalysisId: pred.daily_analysis_id,
        predictionType: pred.prediction_type,
        predictionText: pred.prediction_text,
        confidenceLevel: pred.confidence_level,
        timeHorizon: pred.time_horizon,
        predictionData: pred.prediction_data || {},
        createdAt: pred.created_at
      }));

      res.json({
        success: true,
        data: {
          ...transformedAnalysis,
          predictions: transformedPredictions
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get analysis statistics
router.get('/stats/overview', async (req: any, res, next) => {
  try {
    const stats = await req.context.db.query(`
      SELECT 
        COUNT(*) as total_analyses,
        COUNT(DISTINCT DATE_TRUNC('month', analysis_date)) as months_covered,
        AVG(confidence_score) as avg_confidence,
        AVG(sources_analyzed) as avg_sources,
        MAX(analysis_date) as latest_analysis,
        MIN(analysis_date) as earliest_analysis
      FROM daily_analysis
    `);

    const sentimentDistribution = await req.context.db.query(`
      SELECT 
        market_sentiment,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM daily_analysis
      GROUP BY market_sentiment
    `);

    res.json({
      success: true,
      data: {
        overview: stats[0],
        sentimentDistribution
      }
    });
  } catch (error) {
    next(error);
  }
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      analysisController: AnalysisController;
    }
  }
}

export default router;