import { Router } from 'express';
import { db } from '@/services/database';
import EarningsController from '@/controllers/earnings.controller';
import { authenticateToken } from '@/middleware/auth';

const router = Router();
const earningsController = new EarningsController(db);

// Apply authentication to all routes
// router.use(authenticateToken); // Temporarily disabled for testing

  /**
   * @swagger
   * /api/earnings/calendar:
   *   get:
   *     summary: Get earnings calendar with filters
   *     tags: [Earnings]
   *     parameters:
   *       - in: query
   *         name: symbol
   *         schema:
   *           type: string
   *         description: Filter by stock symbol
   *       - in: query
   *         name: start_date
   *         schema:
   *           type: string
   *           format: date
   *         description: Start date (YYYY-MM-DD)
   *       - in: query
   *         name: end_date
   *         schema:
   *           type: string
   *           format: date
   *         description: End date (YYYY-MM-DD)
   *       - in: query
   *         name: importance_min
   *         schema:
   *           type: integer
   *           minimum: 0
   *           maximum: 5
   *         description: Minimum importance rating
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [scheduled, reported, delayed, cancelled]
   *         description: Filter by status
   *       - in: query
   *         name: confirmed_only
   *         schema:
   *           type: boolean
   *         description: Only confirmed earnings dates
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 100
   *         description: Number of results to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of results to skip
   *     responses:
   *       200:
   *         description: Earnings calendar data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/EarningsCalendar'
   *                 meta:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     offset:
   *                       type: integer
   *                     hasMore:
   *                       type: boolean
   */
  router.get('/calendar', earningsController.getEarningsCalendar);

  /**
   * @swagger
   * /api/earnings/upcoming:
   *   get:
   *     summary: Get upcoming earnings (next 30 days by default)
   *     tags: [Earnings]
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *         description: Number of days to look ahead
   *     responses:
   *       200:
   *         description: Upcoming earnings data
   */
  router.get('/upcoming', earningsController.getUpcomingEarnings);

  /**
   * @swagger
   * /api/earnings/{symbol}/{date}:
   *   get:
   *     summary: Get comprehensive earnings data including reports
   *     tags: [Earnings]
   *     parameters:
   *       - in: path
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *         description: Stock symbol
   *       - in: path
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         description: Earnings date (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: Comprehensive earnings data
   *       404:
   *         description: Earnings data not found
   */
  router.get('/:symbol/:date', earningsController.getEarningsWithReports);

  /**
   * @swagger
   * /api/earnings/performance/{symbol}:
   *   get:
   *     summary: Get earnings performance statistics for a company
   *     tags: [Earnings]
   *     parameters:
   *       - in: path
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *         description: Stock symbol
   *       - in: query
   *         name: quarters
   *         schema:
   *           type: integer
   *           default: 8
   *         description: Number of quarters to analyze
   *     responses:
   *       200:
   *         description: Earnings performance statistics
   */
  router.get('/performance/:symbol', earningsController.getEarningsPerformanceStats);

  /**
   * @swagger
   * /api/earnings/calendar/{year}/{month}:
   *   get:
   *     summary: Get earnings calendar for a specific month (calendar view)
   *     tags: [Earnings]
   *     parameters:
   *       - in: path
   *         name: year
   *         required: true
   *         schema:
   *           type: integer
   *         description: Year (YYYY)
   *       - in: path
   *         name: month
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 12
   *         description: Month (1-12)
   *     responses:
   *       200:
   *         description: Monthly earnings calendar data
   */
  router.get('/calendar/:year/:month', earningsController.getEarningsCalendarMonth);

  // Debug endpoint (temporary)
  router.get('/debug', earningsController.debugEarningsData);
  
  // Setup endpoint (temporary) 
  router.post('/setup', earningsController.setupEarningsData);

  /**
   * @swagger
   * /api/earnings/reports/{reportId}:
   *   get:
   *     summary: Get detailed earnings report content
   *     tags: [Earnings]
   *     parameters:
   *       - in: path
   *         name: reportId
   *         required: true
   *         schema:
   *           type: string
   *         description: Earnings report ID
   *     responses:
   *       200:
   *         description: Detailed earnings report
   *       404:
   *         description: Report not found
   */
  router.get('/reports/:reportId', earningsController.getEarningsReport);

  /**
   * @swagger
   * /api/earnings/refresh:
   *   post:
   *     summary: Manually trigger earnings data refresh
   *     tags: [Earnings]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               tickers:
   *                 type: array
   *                 items:
   *                   type: string
   *                 example: ["AAPL", "MSFT", "GOOGL"]
   *     responses:
   *       200:
   *         description: Refresh job queued successfully
   */
  router.post('/refresh', earningsController.refreshEarningsData);

export const earningsRoutes = router;