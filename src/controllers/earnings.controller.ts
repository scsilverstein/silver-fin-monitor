import { Request, Response } from 'express';
import { Database } from '@/types';
import { EarningsCalendarFilters } from '@/types/earnings';
import SecEarningsService from '@/services/earnings/sec-earnings.service';
import { logger } from '@/utils/logger';

export class EarningsController {
  private db: Database;
  private secEarningsService: SecEarningsService;

  constructor(db: Database) {
    this.db = db;
    this.secEarningsService = new SecEarningsService(db as any); // Type assertion to bypass type mismatch temporarily
  }

  /**
   * Get earnings calendar for a specific month
   */
  getEarningsCalendarMonth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { year, month } = req.params;
      
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      // Validate year and month
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        res.status(400).json({
          success: false,
          error: 'Invalid year or month'
        });
        return;
      }

      // Get earnings data for the specified month using database helper methods  
      const startDate = `${yearNum}-${monthNum.toString().padStart(2, '0')}-01`;
      const endDate = new Date(yearNum, monthNum, 0); // Last day of month
      const endDateStr = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${endDate.getDate().toString().padStart(2, '0')}`;
      
      // Use findMany with date filtering
      const earningsData = await this.db.findMany('earnings_calendar', {}, {
        // We'll filter the results manually since complex date filtering might not work
      });

      // Filter and group by date
      const calendarData: Record<string, any[]> = {};
      
      if (earningsData && Array.isArray(earningsData)) {
        earningsData.forEach((row: any) => {
          const earningDate = new Date(row.earnings_date);
          const earningYear = earningDate.getFullYear();
          const earningMonth = earningDate.getMonth() + 1;
          
          // Only include earnings for the requested month/year
          if (earningYear === yearNum && earningMonth === monthNum) {
            const dateStr = row.earnings_date;
            if (!calendarData[dateStr]) {
              calendarData[dateStr] = [];
            }
            calendarData[dateStr].push(row);
          }
        });
      }

      res.json({
        success: true,
        data: calendarData,
        meta: {
          year: yearNum,
          month: monthNum,
          totalDays: Object.keys(calendarData).length,
          totalEarnings: Object.values(calendarData).reduce((sum, day) => sum + day.length, 0)
        }
      });
    } catch (error) {
      logger.error('Unexpected error in getEarningsCalendarMonth:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }


  /**
   * Get earnings calendar with optional filters
   */
  getEarningsCalendar = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        symbol,
        start_date,
        end_date,
        importance_min,
        status,
        confirmed_only,
        limit = 10000,
        offset = 0
      } = req.query;

      // Use Supabase client via database interface
      let query = this.db.from('earnings_calendar').select('*', { count: 'exact' });

      // Apply filters
      if (symbol) {
        query = query.eq('symbol', symbol);
      }

      if (start_date) {
        query = query.gte('earnings_date', start_date);
      }

      if (end_date) {
        query = query.lte('earnings_date', end_date);
      }

      if (importance_min) {
        query = query.gte('importance_rating', parseInt(importance_min as string));
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (confirmed_only === 'true') {
        query = query.eq('confirmed', true);
      }

      // Apply ordering
      query = query
        .order('earnings_date', { ascending: true })
        .order('importance_rating', { ascending: false })
        .order('symbol', { ascending: true });

      // Apply pagination
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data: earnings, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch earnings calendar: ${error.message}`);
      }

      res.json({
        success: true,
        data: earnings || [],
        meta: {
          total: count || 0,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (count || 0) > offsetNum + (earnings?.length || 0)
        }
      });
    } catch (error) {
      logger.error('Error getting earnings calendar:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get earnings calendar'
      });
    }
  };

  /**
   * Get upcoming earnings (uses direct query as fallback)
   */
  getUpcomingEarnings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { days = '30' } = req.query;
      
      const daysNum = parseInt(days as string);
      
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        res.status(400).json({
          success: false,
          error: 'Invalid days parameter. Must be between 1 and 365.'
        });
        return;
      }

      // Calculate date range
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysNum);
      
      const todayStr = today.toISOString().split('T')[0];
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Use direct query since RPC functions may not be available
      logger.info('Fetching upcoming earnings', { 
        days: daysNum, 
        dateRange: { start: todayStr, end: futureDateStr } 
      });
      
      const queryResult = await this.db
        .from('earnings_calendar')
        .select('*')
        .gte('earnings_date', todayStr)
        .lte('earnings_date', futureDateStr)
        .eq('status', 'scheduled')
        .order('earnings_date', { ascending: true })
        .order('importance_rating', { ascending: false });
        
      const data = queryResult.data;
      const error = queryResult.error;

      if (error) {
        logger.error('Error fetching upcoming earnings:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch upcoming earnings'
        });
        return;
      }

      res.json({
        success: true,
        data: data || [],
        meta: {
          days: daysNum,
          count: data?.length || 0,
          queryDate: new Date().toISOString(),
          dateRange: {
            start: todayStr,
            end: futureDateStr
          }
        }
      });
    } catch (error) {
      logger.error('Unexpected error in getUpcomingEarnings:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  /**
   * Get earnings with reports for a specific company and date
   */
  getEarningsWithReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol, date } = req.params;

      if (!symbol || !date) {
        res.status(400).json({
          success: false,
          error: 'Symbol and date are required'
        });
        return;
      }

      // Get earnings data using database interface
      const earningsResult = await this.db
        .from('earnings_calendar')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .eq('earnings_date', date)
        .limit(1);
        
      const earnings = earningsResult.data?.[0];
      const earningsError = earningsResult.error;

      if (earningsError || !earnings) {
        res.status(404).json({
          success: false,
          error: 'Earnings data not found'
        });
        return;
      }

      // Get related reports
      const reportsResult = await this.db
        .from('earnings_reports')
        .select('*')
        .eq('earnings_calendar_id', earnings.id);
        
      const reports = reportsResult.data;
      const reportsError = reportsResult.error;

      const earningsData = {
        ...earnings,
        reports: reports || []
      };

      res.json({
        success: true,
        data: earningsData
      });
    } catch (error) {
      logger.error('Error getting earnings with reports:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get earnings with reports'
      });
    }
  };

  /**
   * Get earnings performance stats for a company
   */
  getEarningsPerformanceStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.params;
      const { quarters = 8 } = req.query;

      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
        return;
      }

      // Get historical earnings for the company using database interface
      const queryResult = await this.db
        .from('earnings_calendar')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .order('earnings_date', { ascending: false })
        .limit(parseInt(quarters as string));
        
      const earnings = queryResult.data;
      const error = queryResult.error;

      if (error) {
        throw new Error(`Failed to fetch earnings stats: ${error.message}`);
      }

      // Calculate stats
      const stats = {
        symbol: symbol.toUpperCase(),
        total_earnings: earnings?.length || 0,
        quarters_analyzed: parseInt(quarters as string),
        average_importance: earnings?.length 
          ? earnings.reduce((sum, e) => sum + (e.importance_rating || 0), 0) / earnings.length 
          : 0,
        latest_earnings_date: earnings?.[0]?.earnings_date || null,
        earnings_history: earnings || []
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting earnings performance stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get earnings performance stats'
      });
    }
  };

  /**
   * Manually trigger earnings data refresh for specific companies
   */
  refreshEarningsData = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tickers } = req.body;

      if (!tickers || !Array.isArray(tickers)) {
        res.status(400).json({
          success: false,
          error: 'Tickers array is required'
        });
        return;
      }

      // Limit to 10 tickers per request to avoid overwhelming the system
      const limitedTickers = tickers.slice(0, 10);

      // Queue the refresh job using database interface
      const refreshResult = await this.db
        .from('job_queue')  
        .insert({
          job_type: 'earnings_refresh',
          payload: { tickers: limitedTickers },
          priority: 2
        });
        
      const error = refreshResult.error;

      if (error) {
        throw new Error(`Failed to queue refresh job: ${error.message}`);
      }

      res.json({
        success: true,
        message: `Queued earnings refresh for ${limitedTickers.length} tickers`,
        tickers: limitedTickers
      });
    } catch (error) {
      logger.error('Error queuing earnings refresh:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to queue earnings refresh'
      });
    }
  };


  /**
   * Setup earnings data (temporary endpoint)
   */
  setupEarningsData = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Setting up earnings data...');
      
      // Use Supabase client via database interface to insert data
      const earningsData = [
        // Tech Giants
        { symbol: 'AAPL', company_name: 'Apple Inc.', earnings_date: '2025-01-28', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'MSFT', company_name: 'Microsoft Corporation', earnings_date: '2025-01-24', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'GOOGL', company_name: 'Alphabet Inc.', earnings_date: '2025-01-30', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'AMZN', company_name: 'Amazon.com Inc.', earnings_date: '2025-01-31', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'META', company_name: 'Meta Platforms Inc.', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        
        // Finance
        { symbol: 'JPM', company_name: 'JPMorgan Chase & Co.', earnings_date: '2025-01-15', time_of_day: 'before_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'BAC', company_name: 'Bank of America Corp.', earnings_date: '2025-01-16', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'GS', company_name: 'Goldman Sachs Group Inc.', earnings_date: '2025-01-17', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        
        // Healthcare
        { symbol: 'JNJ', company_name: 'Johnson & Johnson', earnings_date: '2025-01-23', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'PFE', company_name: 'Pfizer Inc.', earnings_date: '2025-01-28', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        
        // Energy
        { symbol: 'XOM', company_name: 'Exxon Mobil Corp.', earnings_date: '2025-01-31', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'CVX', company_name: 'Chevron Corporation', earnings_date: '2025-01-25', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        
        // Consumer
        { symbol: 'WMT', company_name: 'Walmart Inc.', earnings_date: '2025-01-21', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'PG', company_name: 'Procter & Gamble Co.', earnings_date: '2025-01-22', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'KO', company_name: 'Coca-Cola Company', earnings_date: '2025-01-14', time_of_day: 'before_market', importance_rating: 3, status: 'scheduled', confirmed: true },
        
        // Semiconductors
        { symbol: 'NVDA', company_name: 'NVIDIA Corporation', earnings_date: '2025-01-22', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'TSM', company_name: 'Taiwan Semiconductor', earnings_date: '2025-01-16', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'INTC', company_name: 'Intel Corporation', earnings_date: '2025-01-23', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        
        // Streaming & Entertainment
        { symbol: 'NFLX', company_name: 'Netflix Inc.', earnings_date: '2025-01-21', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        { symbol: 'DIS', company_name: 'Walt Disney Company', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true },
        
        // Automotive
        { symbol: 'TSLA', company_name: 'Tesla Inc.', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
        { symbol: 'F', company_name: 'Ford Motor Company', earnings_date: '2025-01-27', time_of_day: 'after_market', importance_rating: 3, status: 'scheduled', confirmed: true },
        { symbol: 'GM', company_name: 'General Motors Company', earnings_date: '2025-01-28', time_of_day: 'before_market', importance_rating: 3, status: 'scheduled', confirmed: true }
      ];

      // Insert using database helper methods
      const inserted = [];
      for (const item of earningsData) {
        try {
          const result = await this.db.create('earnings_calendar', item);
          inserted.push(result);
        } catch (error) {
          logger.warn(`Failed to insert earnings for ${item.symbol}:`, error);
          // Continue with other records
        }
      }
      
      res.json({
        success: true,
        message: 'Earnings data setup completed',
        count: inserted.length,
        attempted: earningsData.length
      });
    } catch (error) {
      logger.error('Error setting up earnings data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup earnings data'
      });
    }
  };

  /**
   * Debug endpoint to check earnings data
   */
  debugEarningsData = async (req: Request, res: Response): Promise<void> => {
    try {
      // Debug: Check what methods are available on this.db
      logger.info('Database methods:', Object.getOwnPropertyNames(this.db));
      logger.info('Database constructor:', this.db.constructor.name);
      logger.info('Has from method:', typeof this.db.from);
      logger.info('Has getClient method:', typeof this.db.getClient);
      logger.info('Has findMany method:', typeof this.db.findMany);
      logger.info('Has create method:', typeof this.db.create);
      
      // Get all earnings data using database helper methods
      const allEarnings = await this.db.findMany('earnings_calendar');
      const totalCount = allEarnings ? allEarnings.length : 0;
      
      // Filter January 2025 data manually
      const janData = allEarnings ? allEarnings.filter((item: any) => {
        const date = new Date(item.earnings_date);
        return date.getFullYear() === 2025 && date.getMonth() === 0; // January is month 0
      }).slice(0, 10) : [];

      res.json({
        success: true,
        data: {
          totalCount: totalCount,
          viewExists: false, // Views need to be created via migrations
          januaryData: janData,
          januaryCount: janData.length
        }
      });
    } catch (error) {
      logger.error('Error in debug earnings data:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to debug earnings data'
      });
    }
  };

  /**
   * Get earnings report content
   */
  getEarningsReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;

      if (!reportId) {
        res.status(400).json({
          success: false,
          error: 'Report ID is required'
        });
        return;
      }

      // Get the earnings report using database interface
      const reportResult = await this.db
        .from('earnings_reports')
        .select('*')
        .eq('id', reportId)
        .limit(1);
        
      const report = reportResult.data?.[0];
      const reportError = reportResult.error;

      if (reportError || !report) {
        res.status(404).json({
          success: false,
          error: 'Earnings report not found'
        });
        return;
      }

      // Get the report sections
      const sectionsResult = await this.db
        .from('earnings_report_sections')
        .select('*')
        .eq('earnings_report_id', reportId)
        .order('section_order', { ascending: true });
        
      const sections = sectionsResult.data;
      const sectionsError = sectionsResult.error;

      const reportData = {
        ...report,
        sections: sections || []
      };

      res.json({
        success: true,
        data: reportData
      });
    } catch (error) {
      logger.error('Error getting earnings report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get earnings report'
      });
    }
  };
}

export default EarningsController;