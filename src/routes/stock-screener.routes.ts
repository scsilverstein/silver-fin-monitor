import { Router } from 'express';
import { stockScreenerController } from '@/controllers/stock-screener.controller';

const router = Router();

// All routes require authentication
// Authentication temporarily disabled for testing

/**
 * @route   GET /api/v1/stocks/screener
 * @desc    Get undervalued NASDAQ stocks with filters
 * @access  Private
 */
router.get('/screener', stockScreenerController.getUndervaluedStocks);

/**
 * @route   GET /api/v1/stocks/sectors
 * @desc    Get list of available sectors
 * @access  Private
 */
router.get('/sectors', stockScreenerController.getSectors);

export default router;