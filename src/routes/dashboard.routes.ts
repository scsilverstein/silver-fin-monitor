import { Router } from 'express';
import { dashboardController } from '@/controllers/dashboard.controller';
import { authenticateToken } from '@/middleware/auth';

const router = Router();

// All dashboard routes require authentication
// router.use(authenticateToken);  // Temporarily disabled for testing

// Dashboard overview
router.get('/overview', (req, res) => dashboardController.getOverview(req, res));

// Market trends
router.get('/trends', (req, res) => dashboardController.getTrends(req, res));

// Predictions
router.get('/predictions', (req, res) => dashboardController.getPredictions(req, res));

// Accuracy metrics
router.get('/accuracy', (req, res) => dashboardController.getAccuracy(req, res));

// Real-time statistics
router.get('/stats', (req, res) => dashboardController.getRealtimeStats(req, res));

// Analysis with source tracking
router.get('/analysis-with-sources', (req, res) => dashboardController.getAnalysisWithSources(req, res));

// Timeframe themes (week, month, year)
router.get('/themes', (req, res) => dashboardController.getTimeframeThemes(req, res));

// Transcription monitoring
router.get('/transcription', (req, res) => dashboardController.getTranscriptionStatus(req, res));

// Temporary cache clear route for testing
router.delete('/cache', async (req, res) => {
  const { cacheService } = await import('@/services/database/cache');
  await Promise.all([
    cacheService.delete('dashboard:overview'),
    cacheService.delete('dashboard:trends:7'),
    cacheService.delete('dashboard:accuracy')
  ]);
  res.json({ success: true, message: 'Dashboard cache cleared' });
});

export { router as dashboardRoutes };