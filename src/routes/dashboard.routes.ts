import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All dashboard routes require authentication
// router.use(authenticateToken);  // Temporarily disabled for testing

// Dashboard overview
router.get('/overview', (req, res, next) => dashboardController.getOverview(req, res, next));

// Market trends
router.get('/trends', (req, res, next) => dashboardController.getTrends(req, res, next));

// Predictions
router.get('/predictions', (req, res, next) => dashboardController.getPredictions(req, res, next));

// Accuracy metrics
router.get('/accuracy', (req, res, next) => dashboardController.getAccuracy(req, res, next));

// Real-time statistics
router.get('/stats', (req, res, next) => dashboardController.getRealtimeStats(req, res, next));

// // Analysis with source tracking
// router.get('/analysis-with-sources', (req, res, next) => dashboardController.getAnalysisWithSources(req, res, next));

// Timeframe themes (week, month, year)
router.get('/themes', (req, res, next) => dashboardController.getThemes(req, res, next));

// // Transcription monitoring
// router.get('/transcription', (req, res, next) => dashboardController.getTranscriptionStatus(req, res, next));

// Temporary cache clear route for testing
router.delete('/cache', async (req, res) => {
  const { cacheService } = await import('../services/database/cache');
  await Promise.all([
    cacheService.delete('dashboard:overview'),
    cacheService.delete('dashboard:trends:7'),
    cacheService.delete('dashboard:accuracy')
  ]);
  res.json({ success: true, message: 'Dashboard cache cleared' });
});

export { router as dashboardRoutes };