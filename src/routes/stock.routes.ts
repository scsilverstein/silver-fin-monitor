import { Router } from 'express';
import {
  getStockSymbols,
  addStockSymbol,
  getStockFundamentals,
  getScannerResults,
  getStockAlerts,
  triggerStockScan,
  getPeerComparison,
  getWatchlist,
  addToWatchlist,
  getTopMovers
} from '@/controllers/stock.controller';
import { authenticateToken as authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { body, query, param } from 'express-validator';

const router = Router();

// Stock symbols endpoints
router.get('/symbols',
  authenticate,
  query('sector').optional().isString(),
  query('industry').optional().isString(),
  query('active').optional().isBoolean(),
  validateRequest,
  getStockSymbols
);

router.post('/symbols',
  authenticate,
  body('symbol').notEmpty().isString().toUpperCase(),
  body('name').notEmpty().isString(),
  body('exchange').optional().isString(),
  body('sector').optional().isString(),
  body('industry').optional().isString(),
  body('marketCapCategory').optional().isIn(['micro', 'small', 'mid', 'large', 'mega']),
  validateRequest,
  addStockSymbol
);

// Stock fundamentals
router.get('/fundamentals/:symbol',
  authenticate,
  param('symbol').notEmpty().isString(),
  query('days').optional().isInt({ min: 1, max: 365 }),
  validateRequest,
  getStockFundamentals
);

// Scanner results
router.get('/scanner/results',
  authenticate,
  query('date').optional().isISO8601(),
  query('scanType').optional().isIn(['earnings_momentum', 'pe_anomaly', 'peer_relative']),
  query('minScore').optional().isFloat({ min: 0, max: 100 }),
  query('isSignificant').optional().isBoolean(),
  query('alertType').optional().isIn(['bullish_momentum', 'bearish_divergence', 'value_opportunity']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  validateRequest,
  getScannerResults
);

// Stock alerts
router.get('/scanner/alerts',
  authenticate,
  query('days').optional().isInt({ min: 1, max: 30 }),
  query('alertType').optional().isIn(['bullish_momentum', 'bearish_divergence', 'value_opportunity']),
  validateRequest,
  getStockAlerts
);

// Trigger manual scan
router.post('/scanner/run',
  authenticate,
  body('scanType').optional().isIn(['full', 'symbols']),
  body('symbols').optional().isArray(),
  body('symbols.*').optional().isString(),
  validateRequest,
  triggerStockScan
);

// Peer comparison
router.get('/peers/:symbol',
  authenticate,
  param('symbol').notEmpty().isString(),
  validateRequest,
  getPeerComparison
);

// Watchlist
router.get('/watchlist',
  authenticate,
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('active').optional().isBoolean(),
  validateRequest,
  getWatchlist
);

router.post('/watchlist',
  authenticate,
  body('symbol').notEmpty().isString().toUpperCase(),
  body('reason').optional().isString(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('alertThreshold').optional().isObject(),
  validateRequest,
  addToWatchlist
);

// Top movers
router.get('/top-movers',
  authenticate,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validateRequest,
  getTopMovers
);

export default router;