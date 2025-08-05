// Stock scanner routes following CLAUDE.md specification
import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware';
import StockScannerController from '../controllers/stock-scanner.controller';

const router = Router();

// Apply authentication to all stock scanner routes
router.use(authenticateToken);

// Initialize controller with dependencies from request context
router.use((req: any, res, next) => {
  req.stockScannerController = new StockScannerController(
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

// Get tracked stock symbols
router.get('/symbols',
  query('sector').optional().isString(),
  query('industry').optional().isString(),
  query('market_cap').optional().isIn(['micro', 'small', 'mid', 'large', 'mega']),
  query('is_active').optional().isBoolean(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getTrackedSymbols(req, res, next);
  }
);

// Add new stock to track
router.post('/symbols',
  body('symbol').notEmpty().isUppercase().trim(),
  body('name').optional().trim(),
  body('sector').optional().trim(),
  body('industry').optional().trim(),
  body('market_cap').optional().isNumeric(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.addSymbol(req, res, next);
  }
);

// Remove stock from tracking
router.delete('/symbols/:symbol',
  param('symbol').isUppercase(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.removeSymbol(req, res, next);
  }
);

// Get stock fundamentals
router.get('/fundamentals/:symbol',
  param('symbol').isUppercase(),
  query('period').optional().isIn(['current', '1d', '5d', '30d']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getFundamentals(req, res, next);
  }
);

// Get scanner results
router.get('/results',
  query('scan_type').optional().isIn(['momentum', 'value', 'earnings_revision', 'all']),
  query('min_score').optional().isFloat({ min: 0, max: 100 }),
  query('sector').optional().isString(),
  query('industry').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('offset').optional().isInt({ min: 0 }),
  query('sort_by').optional().isIn(['composite_score', 'momentum_score', 'value_score', 'change_1d', 'change_5d', 'change_30d']),
  query('sort_order').optional().isIn(['asc', 'desc']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getScannerResults(req, res, next);
  }
);

// Get significant changes and alerts
router.get('/alerts',
  query('alert_type').optional().isIn(['earnings_momentum', 'value_opportunity', 'bearish_divergence', 'all']),
  query('min_change').optional().isFloat({ min: 0 }),
  query('period').optional().isIn(['1d', '5d', '30d']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getAlerts(req, res, next);
  }
);

// Manually trigger stock scan
router.post('/scan',
  body('symbols').optional().isArray(),
  body('symbols.*').optional().isUppercase(),
  body('force').optional().isBoolean(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.triggerScan(req, res, next);
  }
);

// Get peer comparison data
router.get('/peers/:symbol',
  param('symbol').isUppercase(),
  query('peer_type').optional().isIn(['industry', 'sector', 'market_cap', 'custom']),
  query('metrics').optional().isArray(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getPeerComparison(req, res, next);
  }
);

// Get watchlist
router.get('/watchlist',
  query('user_id').optional().isUUID(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getWatchlist(req, res, next);
  }
);

// Add to watchlist
router.post('/watchlist',
  body('symbol').isUppercase().notEmpty(),
  body('notes').optional().trim(),
  body('target_price').optional().isFloat({ min: 0 }),
  body('alert_conditions').optional().isObject(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.addToWatchlist(req, res, next);
  }
);

// Remove from watchlist
router.delete('/watchlist/:symbol',
  param('symbol').isUppercase(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.removeFromWatchlist(req, res, next);
  }
);

// Get scanner statistics
router.get('/stats',
  query('period').optional().isIn(['1d', '7d', '30d', '90d']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getScannerStats(req, res, next);
  }
);

// Get change history for a symbol
router.get('/history/:symbol',
  param('symbol').isUppercase(),
  query('metric').optional().isIn(['earnings', 'pe_ratio', 'both']),
  query('period').optional().isIn(['7d', '30d', '90d', '180d', '1y']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getChangeHistory(req, res, next);
  }
);

// Bulk add symbols
router.post('/symbols/bulk',
  body('symbols').isArray().notEmpty(),
  body('symbols.*.symbol').isUppercase().notEmpty(),
  body('symbols.*.name').optional().trim(),
  body('symbols.*.sector').optional().trim(),
  body('symbols.*.industry').optional().trim(),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.bulkAddSymbols(req, res, next);
  }
);

// Get sector performance
router.get('/sectors/performance',
  query('period').optional().isIn(['1d', '5d', '30d', '90d']),
  handleValidationErrors,
  (req: any, res, next) => {
    req.stockScannerController.getSectorPerformance(req, res, next);
  }
);

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      stockScannerController: StockScannerController;
    }
  }
}

export default router;