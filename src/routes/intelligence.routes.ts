import { Router } from 'express';
import { IntelligenceController } from '../controllers/intelligence.controller';
import { authenticateToken } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Validation schemas
const timeframeSchema = z.object({
  query: z.object({
    timeframe: z.string().regex(/^\d+d$/).optional(),
    sources: z.string().optional()
  })
});

const entityNetworkSchema = z.object({
  query: z.object({
    timeframe: z.string().regex(/^\d+d$/).optional(),
    minMentions: z.string().regex(/^\d+$/).optional()
  })
});

const anomalyCalendarSchema = z.object({
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional()
  })
});

const narrativeMomentumSchema = z.object({
  query: z.object({
    timeframe: z.string().regex(/^(24h|7d|30d)$/).optional()
  })
});

const silenceDetectionSchema = z.object({
  query: z.object({
    lookbackDays: z.string().regex(/^\d+$/).optional()
  })
});

const languageComplexitySchema = z.object({
  query: z.object({
    timeframe: z.string().regex(/^(24h|7d|30d)$/).optional()
  })
});

// Routes
router.get(
  '/divergence',
  // authenticateToken, // Temporarily disabled for testing
  // validateQuery(timeframeSchema), // Temporarily disabled for testing
  IntelligenceController.getSignalDivergence
);

router.get(
  '/network',
  // authenticateToken, // Temporarily disabled for testing
  // validateQuery(entityNetworkSchema), // Temporarily disabled for testing
  IntelligenceController.getEntityNetwork
);

router.get(
  '/anomalies',
  // authenticateToken, // Temporarily disabled for testing
  // validateQuery(anomalyCalendarSchema), // Temporarily disabled for testing
  IntelligenceController.getAnomalyCalendar
);

router.get(
  '/predictive-matrix',
  // authenticateToken, // Temporarily disabled for testing
  IntelligenceController.getPredictiveMatrix
);

router.get(
  '/alerts',
  // authenticateToken, // Temporarily disabled for testing
  IntelligenceController.getIntelligenceAlerts
);

router.get(
  '/narrative-momentum',
  // authenticateToken, // Temporarily disabled for testing
  // validateQuery(narrativeMomentumSchema), // Temporarily disabled for testing
  IntelligenceController.getNarrativeMomentum
);

router.get(
  '/silence-detection',
  // authenticateToken, // Temporarily disabled for testing
  // validateQuery(silenceDetectionSchema), // Temporarily disabled for testing
  IntelligenceController.getSilenceDetection
);

router.get(
  '/language-complexity',
  // authenticateToken, // Temporarily disabled for testing
  // validateQuery(languageComplexitySchema), // Temporarily disabled for testing
  IntelligenceController.getLanguageComplexity
);

export default router;