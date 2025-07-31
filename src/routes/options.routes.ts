import { Router } from 'express';
import { OptionsController } from '../controllers/options.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';
import { QueueService } from '../services/queue.service';

export const createOptionsRoutes = (queueService: QueueService): Router => {
  const router = Router();
  const optionsController = new OptionsController(queueService);

  // All routes require authentication
  router.use(authMiddleware);

  /**
   * @route POST /api/options/tech-universe/initialize
   * @desc Initialize tech stock universe for options scanning
   * @access Private
   */
  router.post(
    '/tech-universe/initialize',
    optionsController.initializeTechUniverse
  );

  /**
   * @route GET /api/options/scan/latest
   * @desc Get latest tech options scan results
   * @access Private
   */
  router.get(
    '/scan/latest',
    optionsController.getLatestScanResults
  );

  /**
   * @route POST /api/options/scan/run
   * @desc Run comprehensive tech options scan
   * @access Private
   */
  router.post(
    '/scan/run',
    optionsController.runTechOptionsScan
  );

  /**
   * @route GET /api/options/chain/:symbol
   * @desc Get options chain for a tech stock symbol
   * @access Private
   */
  router.get(
    '/chain/:symbol',
    [
      param('symbol').isString().isUppercase().isLength({ min: 1, max: 10 }),
      query('expiration').optional().isISO8601(),
      query('minStrike').optional().isNumeric(),
      query('maxStrike').optional().isNumeric()
    ],
    validateRequest,
    optionsController.getOptionsChain
  );

  /**
   * @route GET /api/options/analyze/:contractId
   * @desc Analyze specific option contract
   * @access Private
   */
  router.get(
    '/analyze/:contractId',
    [
      param('contractId').isUUID()
    ],
    validateRequest,
    optionsController.analyzeOption
  );

  /**
   * @route GET /api/options/search
   * @desc Search options by criteria
   * @access Private
   */
  router.get(
    '/search',
    [
      query('minVolume').optional().isInt({ min: 0 }),
      query('minOpenInterest').optional().isInt({ min: 0 }),
      query('maxSpreadRatio').optional().isFloat({ min: 0, max: 1 }),
      query('minDTE').optional().isInt({ min: 0 }),
      query('maxDTE').optional().isInt({ min: 0 }),
      query('minIVRank').optional().isFloat({ min: 0, max: 100 }),
      query('maxIVRank').optional().isFloat({ min: 0, max: 100 }),
      query('minValueScore').optional().isFloat({ min: 0, max: 100 }),
      query('techOnly').optional().isBoolean()
    ],
    validateRequest,
    optionsController.searchOptions
  );

  /**
   * @route GET /api/options/unusual-activity
   * @desc Get unusual options activity for tech stocks
   * @access Private
   */
  router.get(
    '/unusual-activity',
    optionsController.getUnusualActivity
  );

  /**
   * @route GET /api/options/value-opportunities
   * @desc Get top value opportunities in tech options
   * @access Private
   */
  router.get(
    '/value-opportunities',
    [
      query('minScore').optional().isFloat({ min: 0, max: 100 })
    ],
    validateRequest,
    optionsController.getValueOpportunities
  );

  /**
   * @route GET /api/options/tech-categories
   * @desc Get overview of tech categories and their stocks
   * @access Private
   */
  router.get(
    '/tech-categories',
    optionsController.getTechCategoriesOverview
  );

  return router;
};

// Export for backward compatibility if needed
export default createOptionsRoutes;