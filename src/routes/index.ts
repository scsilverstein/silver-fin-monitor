// API routes following CLAUDE.md specification
import { Router } from 'express';
import { authenticateToken, requireRole, optionalAuth, requireSubscription, checkUsageLimit, incrementUsage } from '../middleware/auth';
// import { validate, validateQuery, validateUUID, schemas, querySchemas } from '../middleware/validation';
// import { rateLimiters } from '../middleware/rateLimit';

// Temporary validation placeholders to prevent crashes
const validate = (schema: any) => (req: any, res: any, next: any) => next();
const validateQuery = (schema: any) => (req: any, res: any, next: any) => next();
const validateUUID = (param: string) => (req: any, res: any, next: any) => next();
const schemas = {} as any;
const querySchemas = {} as any;
const rateLimiters = { read: (req: any, res: any, next: any) => next(), write: (req: any, res: any, next: any) => next(), expensive: (req: any, res: any, next: any) => next() };
// import { queueService } from '@/services/database/queue';

// Import controllers - some are pre-instantiated singletons, others are classes
import { authController } from '../controllers/auth.controller';
import { feedController } from '../controllers/feeds.controller';
import { contentController } from '../controllers/content.controller';
import { queueController } from '../controllers/queue.controller';
import { entityAnalyticsController } from '../controllers/entity-analytics.controller';
import { subscriptionController } from '../controllers/subscription.controller';
import { adminController } from '../controllers/admin.controller';
import { transcriptionController } from '../controllers/transcription.controller';
import { whisperController } from '../controllers/whisper.controller';
import { analysisController } from '../controllers/analysis.controller';

// Services are initialized within the controllers that need them
// No need to initialize them here

// Controllers are already instantiated as singletons in their respective files
// No need to instantiate them here

// Bind controller methods to preserve 'this' context (if needed)
// Note: The singleton controllers already have their context bound

// Import dashboard routes
import { dashboardRoutes } from './dashboard.routes';
import { insightsRoutes } from './insights.routes';
import { earningsRoutes } from './earnings.routes';
import intelligenceRoutes from './intelligence.routes';
import stockRoutes from './stock.routes';
import { createOptionsRoutes } from './options.routes';
import analysisRoutes from './analysis.routes';

const router = Router();

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      service: 'silver-fin-monitor'
    }
  });
});

// Test endpoint for debugging feeds issue (no auth for testing)
// router.get('/test-feeds', testFeedsEndpoint);

// Debug endpoint for signal divergence data structure
router.get('/debug/signal-divergence-data', async (req, res) => {
  try {
    const { supabase } = await import('../services/database/client');
    
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 7);

    const { data: contentData, error } = await supabase
      .from('processed_content')
      .select(`
        sentiment_score,
        created_at,
        raw_feeds(
          feed_sources(
            name,
            type
          )
        )
      `)
      .gte('created_at', startTime.toISOString())
      .not('sentiment_score', 'is', null)
      .limit(5);

    res.json({
      success: true,
      data: {
        error: error,
        count: contentData?.length || 0,
        sample: contentData?.[0] || null,
        structure: contentData?.map(item => ({
          sentiment: item.sentiment_score,
          created_at: item.created_at,
          raw_feeds: item.raw_feeds,
          source_name: item.raw_feeds?.[0]?.feed_sources?.[0]?.name
        })).slice(0, 3) || []
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Diagnostic endpoint for intelligence data (no auth for testing)
router.get('/diagnostic/intelligence-data', async (req, res) => {
  try {
    const { supabase } = await import('../services/database/client');
    
    // Check processed content
    const { data: contentStats, error: contentError } = await supabase
      .from('processed_content')
      .select('id, processed_text, sentiment_score, entities, key_topics, created_at')
      .limit(5);

    if (contentError) {
      throw contentError;
    }

    // Get total counts
    const { count: totalContent } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true });

    const { count: withEntities } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true })
      .not('entities', 'is', null);

    const { count: withSentiment } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true })
      .not('sentiment_score', 'is', null);

    // Check recent content (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentContent } = await supabase
      .from('processed_content')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    // Sample entity analysis
    const { data: entitySamples } = await supabase
      .from('processed_content')
      .select('entities')
      .not('entities', 'is', null)
      .limit(10);

    let entitiesAnalysis = {
      uniqueEntities: 0,
      companies: 0,
      people: 0,
      sampleCompanies: [],
      samplePeople: []
    };

    if (entitySamples && entitySamples.length > 0) {
      const allEntities = new Set<string>();
      const companiesSet = new Set<string>();
      const peopleSet = new Set<string>();

      entitySamples.forEach(sample => {
        const entities = sample.entities || {};
        
        (entities.companies || []).forEach((c: string) => {
          companiesSet.add(c);
          allEntities.add(c);
        });
        
        (entities.people || []).forEach((p: string) => {
          peopleSet.add(p);
          allEntities.add(p);
        });
      });

      entitiesAnalysis = {
        uniqueEntities: allEntities.size,
        companies: companiesSet.size,
        people: peopleSet.size,
        sampleCompanies: Array.from(companiesSet).slice(0, 5),
        samplePeople: Array.from(peopleSet).slice(0, 5)
      };
    }

    // Intelligence readiness assessment
    const readiness = {
      signalDivergence: (withSentiment || 0) >= 10,
      entityNetwork: (withEntities || 0) >= 10,
      narrativeMomentum: (recentContent || 0) >= 5,
      silenceDetection: (totalContent || 0) >= 50,
      languageComplexity: contentStats?.filter(c => c.processed_text && c.processed_text.length > 200).length >= 5
    };

    res.json({
      success: true,
      data: {
        summary: {
          totalContent: totalContent || 0,
          withEntities: withEntities || 0,
          withSentiment: withSentiment || 0,
          recentContent: recentContent || 0
        },
        sampleContent: contentStats?.[0] ? {
          hasText: !!contentStats[0].processed_text,
          textLength: contentStats[0].processed_text?.length || 0,
          hasSentiment: contentStats[0].sentiment_score !== null,
          hasEntities: !!contentStats[0].entities,
          hasTopics: !!contentStats[0].key_topics,
          sampleEntities: contentStats[0].entities
        } : null,
        entitiesAnalysis,
        intelligenceReadiness: readiness,
        recommendations: {
          needMoreData: (totalContent || 0) < 50,
          needMoreRecent: (recentContent || 0) < 10,
          needBetterEntities: (withEntities || 0) < (totalContent || 0) * 0.5
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Debug endpoint to check auth status
router.get('/debug/auth', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      authenticated: true,
      user: req.user,
      headers: {
        authorization: req.get('authorization') ? 'Bearer [REDACTED]' : 'none',
        'content-type': req.get('content-type')
      }
    }
  });
});

// Temporary test route for feed items
// router.get('/test-feed-items/:id', feedController.getFeedItems);

// Auth routes (public)
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refreshToken);
// router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/password-reset-request', authController.requestPasswordReset);

// User profile routes (authenticated)
router.get('/auth/me', authenticateToken, authController.getCurrentUser);
router.put('/auth/profile', authenticateToken, authController.updateProfile);
router.put('/auth/password', authenticateToken, authController.changePassword);

// Subscription routes (authenticated)
router.get('/subscription', authenticateToken, subscriptionController.getSubscription);
router.get('/subscription/usage', authenticateToken, subscriptionController.getUsage);
router.get('/subscription/plans', subscriptionController.getPlans);
router.post('/subscription/checkout', authenticateToken, subscriptionController.createCheckoutSession);
router.post('/subscription/cancel', authenticateToken, subscriptionController.cancelSubscription);

// API key management routes (Professional+ only)
router.post('/api-keys', authenticateToken, requireSubscription('professional'), subscriptionController.generateApiKey);
router.get('/api-keys', authenticateToken, requireSubscription('professional'), subscriptionController.listApiKeys);
router.delete('/api-keys/:keyId', authenticateToken, requireSubscription('professional'), subscriptionController.revokeApiKey);

// Stripe webhook (public)
router.post('/webhooks/stripe', subscriptionController.handleWebhook);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

// Insights routes
router.use('/insights', insightsRoutes);

// Earnings routes
router.use('/earnings', earningsRoutes);

// Intelligence routes
router.use('/intelligence', intelligenceRoutes);

// Stock scanner routes (renamed from stock-screener)
import stockScannerRoutes from './stock-scanner.routes';

// Stock scanner routes
router.use('/stocks', stockScannerRoutes);

// Analysis routes
router.use('/analysis', analysisRoutes);

// Queue routes (admin only)
router.get(
  '/queue/stats',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.getQueueStats
);

router.get(
  '/queue/status',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.getQueueStatus
);

router.get(
  '/queue/jobs',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.listJobs
);

router.get(
  '/queue/jobs/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.read,
  queueController.getJob
);

router.post(
  '/queue/jobs',
  authenticateToken,
  requireRole('admin'),
  validate(schemas.enqueueJob),
  rateLimiters.write,
  queueController.enqueueJob
);

router.post(
  '/queue/jobs/:id/retry',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.retryJob
);

router.post(
  '/queue/jobs/:id/cancel',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.cancelJob
);

router.delete(
  '/queue/jobs/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.deleteJob
);

router.delete(
  '/queue/jobs',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.clearJobs
);

router.post(
  '/queue/clear/completed',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.clearCompleted
);

router.post(
  '/queue/clear/failed',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.clearFailed
);

router.post(
  '/queue/retry/failed',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.retryAllFailed
);

router.post(
  '/queue/pause',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.pauseQueue
);

router.post(
  '/queue/resume',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.resumeQueue
);

// ========================
// Queue Worker Management Routes (Admin only)
// ========================

router.get(
  '/queue/worker/status',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.getWorkerStatus
);

router.post(
  '/queue/worker/start',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.startWorker
);

router.post(
  '/queue/worker/stop',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.stopWorker
);

router.post(
  '/queue/worker/restart',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.restartWorker
);

router.post(
  '/queue/jobs/:id/reset',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.resetJob
);

// Feed routes
router.get(
  '/feeds',
  authenticateToken,
  rateLimiters.read,
  feedController.listFeeds
);

router.get(
  '/feeds/stats',
  authenticateToken,
  rateLimiters.read,
  feedController.getFeedStats
);

// More specific route MUST come before less specific route
router.get(
  '/feeds/:id/items',
  authenticateToken,
  validateUUID('id'),
  rateLimiters.read,
  feedController.getFeedItems
);

router.get(
  '/feeds/:id',
  authenticateToken,
  validateUUID('id'),
  rateLimiters.read,
  feedController.getFeed
);

router.post(
  '/feeds',
  authenticateToken,
  requireRole('admin'),
  validate(schemas.createFeedSource),
  rateLimiters.write,
  feedController.createFeed
);

router.put(
  '/feeds/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  validate(schemas.updateFeedSource),
  rateLimiters.write,
  feedController.updateFeed
);

router.delete(
  '/feeds/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  feedController.deleteFeed
);

router.post(
  '/feeds/:id/process',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.expensive,
  feedController.processFeed
);

router.post(
  '/feeds/:id/items/:itemId/process',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  validateUUID('itemId'),
  rateLimiters.expensive,
  feedController.processFeedItem
);

router.post(
  '/feeds/historical-backfill',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.expensive,
  feedController.startHistoricalBackfill
);

// Debug endpoint to check loaded routes
router.get('/debug/loaded-routes', (req, res) => {
  const routes: any[] = [];
  
  // Function to extract routes from a router
  const extractRoutes = (stack: any[], prefix = '') => {
    stack.forEach((layer: any) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods);
        routes.push({
          path: prefix + layer.route.path,
          methods: methods,
          name: layer.name
        });
      } else if (layer.name === 'router' && layer.handle.stack) {
        // Extract the router path from the regexp
        const routerPath = layer.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\/g, '')
          .replace('^', '');
        extractRoutes(layer.handle.stack, prefix + '/' + routerPath);
      }
    });
  };
  
  extractRoutes(router.stack);
  
  res.json({
    success: true,
    totalRoutes: routes.length,
    routes: routes,
    stockScreenerLoaded: !!stockScannerRoutes
  });
});

/* TEMPORARILY DISABLED - SECTIONS BELOW ARE DUPLICATES OR NEED FIXING
// Options scanner routes - Pass queueService from server initialization
// Note: This requires queueService to be available in the route setup
// router.use('/options', createOptionsRoutes(queueService));

// Feed stats route (must come before :id routes)
router.get(
  '/feeds/stats',
  authenticateToken,
  rateLimiters.read,
  feedController.getFeedStats
);

// More specific routes before generic :id routes
router.get(
  '/feeds/:id/items',
  authenticateToken,
  validateUUID('id'),
  rateLimiters.read,
  feedController.getFeedItems
);

router.get(
  '/feeds/:id',
  authenticateToken,
  validateUUID('id'),
  rateLimiters.read,
  feedController.getFeed
);

router.post(
  '/feeds',
  authenticateToken,
  requireRole('admin'),
  validate(schemas.createFeedSource),
  rateLimiters.write,
  feedController.createFeed
);

router.put(
  '/feeds/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  validate(schemas.updateFeedSource),
  rateLimiters.write,
  feedController.updateFeed
);

router.delete(
  '/feeds/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  feedController.deleteFeed
);

router.post(
  '/feeds/:id/process',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.expensive,
  feedController.processFeed
);

// Process individual feed item
router.post(
  '/feeds/:id/items/:itemId/process',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  validateUUID('itemId'),
  rateLimiters.expensive,
  feedController.processFeedItem
);

// Historical backfill endpoint
router.post(
  '/feeds/historical-backfill',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.expensive,
  feedController.startHistoricalBackfill
);

// Content routes with authentication
router.get(
  '/content',
  authenticateToken,
  rateLimiters.read,
  contentController.listContent
);

// More specific routes before generic :id routes
router.get(
  '/content/search',
  authenticateToken,
  rateLimiters.read,
  contentController.searchContent
);

router.get(
  '/content/stats',
  authenticateToken,
  rateLimiters.read,
  contentController.getContentStats
);

router.get(
  '/content/source/:sourceId',
  authenticateToken,
  validateUUID('sourceId'),
  rateLimiters.read,
  contentController.getContentBySource
);

router.get(
  '/content/:id',
  authenticateToken,
  validateUUID('id'),
  rateLimiters.read,
  contentController.getContent
);

// Analysis routes
router.get(
  '/analysis',
  authenticateToken,
  validateQuery(querySchemas.analysisFilter),
  rateLimiters.read,
  analysisController.listAnalyses
);

router.get(
  '/analysis/latest',
  optionalAuth,
  rateLimiters.read,
  analysisController.getLatestAnalysis
);

router.get(
  '/analysis/:date',
  authenticateToken,
  rateLimiters.read,
  analysisController.getAnalysisByDate
);

// Timeframe analysis routes
router.get(
  '/analysis/timeframes/available',
  optionalAuth,
  rateLimiters.read,
  analysisController.getAvailableTimeframes
);

router.get(
  '/analysis/timeframes/recommended',
  optionalAuth,
  rateLimiters.read,
  analysisController.getRecommendedTimeframe
);

router.get(
  '/analysis/timeframe',
  authenticateToken,
  rateLimiters.read,
  analysisController.getTimeframeAnalysis
);

router.post(
  '/analysis/trigger',
  authenticateToken,
  // requireSubscription('professional'), // Temporarily disabled for testing
  validate(schemas.triggerAnalysis),
  // checkUsageLimit('daily_analysis'), // Temporarily disabled for testing
  rateLimiters.write, // Changed from expensive to write for testing
  analysisController.triggerAnalysis
  // incrementUsage // Temporarily disabled for testing
);

router.get(
  '/analysis/:analysisId/predictions',
  authenticateToken,
  validateUUID('analysisId'),
  rateLimiters.read,
  analysisController.getPredictions
);

router.post(
  '/analysis/:analysisId/predictions',
  authenticateToken,
  requireSubscription('professional'),
  validateUUID('analysisId'),
  checkUsageLimit('prediction_generation'),
  rateLimiters.expensive,
  analysisController.generatePredictions,
  incrementUsage
);

// Prediction routes
router.get(
  '/predictions',
  authenticateToken,
  // validateQuery(querySchemas.pagination),  // Temporarily disabled for debugging
  rateLimiters.read,
  analysisController.listPredictions
);

router.get(
  '/predictions/accuracy',
  authenticateToken,
  rateLimiters.read,
  analysisController.getPredictionAccuracy
);

router.post(
  '/predictions/:predictionId/compare',
  authenticateToken,
  // requireRole('admin'),
  validateUUID('predictionId'),
  rateLimiters.expensive,
  analysisController.comparePrediction
);

// Weekly and Monthly Analysis Routes (temporarily without auth for testing)
router.post(
  '/analysis/generate/weekly',
  // authenticateToken,
  // requireRole('admin'),
  // rateLimiters.expensive,
  analysisController.generateWeeklyAnalysis
);

router.post(
  '/analysis/generate/monthly',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.expensive,
  analysisController.generateMonthlyAnalysis
);

router.get(
  '/analysis/timeframe',
  // authenticateToken,
  // rateLimiters.read,
  analysisController.listTimeframeAnalyses
);

router.get(
  '/analysis/timeframe/:id',
  authenticateToken,
  validateUUID('id'),
  rateLimiters.read,
  analysisController.getTimeframeAnalysisById
);

// Queue routes (admin only)
router.get(
  '/queue/stats',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.getQueueStats
);

router.get(
  '/queue/status',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.getQueueStatus
);

router.get(
  '/queue/jobs',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.listJobs
);

router.get(
  '/queue/jobs/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.read,
  queueController.getJob
);

router.post(
  '/queue/jobs',
  authenticateToken,
  requireRole('admin'),
  validate(schemas.enqueueJob),
  rateLimiters.write,
  queueController.enqueueJob
);

router.post(
  '/queue/jobs/:id/retry',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.retryJob
);

router.post(
  '/queue/jobs/:id/cancel',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.cancelJob
);

router.delete(
  '/queue/jobs/:id',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.deleteJob
);

router.delete(
  '/queue/jobs',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.clearJobs
);

router.post(
  '/queue/clear/completed',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.clearCompleted
);

router.post(
  '/queue/clear/failed',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.clearFailed
);

router.post(
  '/queue/retry/failed',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.retryAllFailed
);

router.post(
  '/queue/pause',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.pauseQueue
);

router.post(
  '/queue/resume',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.resumeQueue
);

// ========================
// Queue Worker Management Routes (Admin only)
// ========================

router.get(
  '/queue/worker/status',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  queueController.getWorkerStatus
);

router.post(
  '/queue/worker/start',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.startWorker
);

router.post(
  '/queue/worker/stop',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.stopWorker
);

router.post(
  '/queue/worker/restart',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  queueController.restartWorker
);

router.post(
  '/queue/jobs/:id/reset',
  authenticateToken,
  requireRole('admin'),
  validateUUID('id'),
  rateLimiters.write,
  queueController.resetJob
);

// NOTE: Whisper routes are commented out in the disabled section below

// ========================
// Transcription Routes (Admin only)
// ========================

router.get(
  '/transcription/status/:feedId',
  authenticateToken,
  requireRole('admin'),
  validateUUID('feedId'),
  rateLimiters.read,
  transcriptionController.getTranscriptionStatus
);

router.get(
  '/transcription/active',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  transcriptionController.getActiveTranscriptions
);

router.post(
  '/transcription/cancel/:feedId',
  authenticateToken,
  requireRole('admin'),
  validateUUID('feedId'),
  rateLimiters.write,
  transcriptionController.cancelTranscription
);

router.post(
  '/transcription/retry/:feedId',
  authenticateToken,
  requireRole('admin'),
  validateUUID('feedId'),
  rateLimiters.write,
  transcriptionController.retryTranscription
);

router.get(
  '/transcription/stats',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  transcriptionController.getTranscriptionStats
);

router.get(
  '/transcription/health',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  transcriptionController.checkServiceHealth
);

// ========================
// Entity Analytics Routes (Professional+ only)
// ========================

router.get(
  '/entity-analytics/dashboard',
  // authenticateToken, // Temporarily disabled for testing
  // requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.getDashboardData
);

router.get(
  '/entity-analytics/entity/:entityName',
  // authenticateToken, // Temporarily disabled for testing
  // requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.getEntityAnalytics
);

router.get(
  '/entity-analytics/trending',
  authenticateToken,
  requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.getTrendingEntities
);

router.post(
  '/entity-analytics/compare',
  authenticateToken,
  requireSubscription('professional'),
  rateLimiters.write,
  entityAnalyticsController.compareEntities
);

router.get(
  '/entity-analytics/entity/:entityName/mentions',
  authenticateToken,
  requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.getEntityMentions
);

router.get(
  '/entity-analytics/insights/:entityName',
  authenticateToken,
  requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.getEntityInsights
);

router.get(
  '/entity-analytics/insights',
  authenticateToken,
  requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.getEntityInsights
);

router.get(
  '/entity-analytics/search',
  authenticateToken,
  requireSubscription('professional'),
  rateLimiters.read,
  entityAnalyticsController.searchEntities
);

// ========================
// Admin Routes (Admin only)
// ========================

// User management
router.get(
  '/admin/users',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  adminController.listUsers
);

router.get(
  '/admin/users/:userId',
  authenticateToken,
  requireRole('admin'),
  validateUUID('userId'),
  rateLimiters.read,
  adminController.getUser
);

router.put(
  '/admin/users/:userId',
  authenticateToken,
  requireRole('admin'),
  validateUUID('userId'),
  rateLimiters.write,
  adminController.updateUser
);

router.delete(
  '/admin/users/:userId',
  authenticateToken,
  requireRole('admin'),
  validateUUID('userId'),
  rateLimiters.write,
  adminController.deleteUser
);

router.post(
  '/admin/users/:userId/reset-password',
  authenticateToken,
  requireRole('admin'),
  validateUUID('userId'),
  rateLimiters.write,
  adminController.resetUserPassword
);

router.post(
  '/admin/users/:userId/grant-subscription',
  authenticateToken,
  requireRole('admin'),
  validateUUID('userId'),
  rateLimiters.write,
  adminController.grantSubscription
);

// Admin user creation
router.post(
  '/admin/create-admin',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  adminController.createAdminUser
);

// System statistics
router.get(
  '/admin/stats',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  adminController.getSystemStats
);

// Historical analysis backfill
router.post(
  '/admin/backfill-analysis',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.write,
  adminController.backfillHistoricalAnalysis
);

// Backfill status
router.get(
  '/admin/backfill-status',
  authenticateToken,
  requireRole('admin'),
  rateLimiters.read,
  adminController.getBackfillStatus
);

*/ // END TEMPORARILY DISABLED

// Export versioned API routes
export const apiV1 = router;