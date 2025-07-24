import { Request, Response } from 'express';
import { Database } from '@/types/database';
import { EarningsCalendarFilters } from '@/types/earnings';
import SecEarningsService from '@/services/earnings/sec-earnings.service';
import { logger } from '@/utils/logger';

export class EarningsController {
  private db: Database;
  private secEarningsService: SecEarningsService;

  constructor(db: Database) {
    this.db = db;
    this.secEarningsService = new SecEarningsService(db);
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

      // Use Supabase client
      const client = (this.db as any).getClient();
      let query = client.from('earnings_calendar').select('*', { count: 'exact' });

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
   * Get upcoming earnings (next 30 days)
   */
  getUpcomingEarnings = async (req: Request, res: Response): Promise<void> => {
    try {
      const { days = 30 } = req.query;
      const daysNum = parseInt(days as string);

      // Calculate date range
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysNum);

      // Use Supabase client
      const client = (this.db as any).getClient();
      const { data: earnings, error } = await client
        .from('earnings_calendar')
        .select('*')
        .gte('earnings_date', today.toISOString().split('T')[0])
        .lte('earnings_date', futureDate.toISOString().split('T')[0])
        .order('earnings_date', { ascending: true })
        .order('importance_rating', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch upcoming earnings: ${error.message}`);
      }

      res.json({
        success: true,
        data: earnings || []
      });
    } catch (error) {
      logger.error('Error getting upcoming earnings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get upcoming earnings'
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

      // Use Supabase client
      const client = (this.db as any).getClient();
      
      // Get earnings data
      const { data: earnings, error: earningsError } = await client
        .from('earnings_calendar')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .eq('earnings_date', date)
        .single();

      if (earningsError || !earnings) {
        res.status(404).json({
          success: false,
          error: 'Earnings data not found'
        });
        return;
      }

      // Get related reports
      const { data: reports, error: reportsError } = await client
        .from('earnings_reports')
        .select('*')
        .eq('earnings_calendar_id', earnings.id);

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

      // Use Supabase client
      const client = (this.db as any).getClient();
      
      // Get historical earnings for the company
      const { data: earnings, error } = await client
        .from('earnings_calendar')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .order('earnings_date', { ascending: false })
        .limit(parseInt(quarters as string));

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

      // Queue the refresh job
      const client = (this.db as any).getClient();
      const { error } = await client
        .from('job_queue')
        .insert({
          job_type: 'earnings_refresh',
          payload: { tickers: limitedTickers },
          priority: 2
        });

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
   * Get earnings calendar for a specific month (for calendar view)
   */
  getEarningsCalendarMonth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { year, month } = req.params;

      if (!year || !month) {
        res.status(400).json({
          success: false,
          error: 'Year and month are required'
        });
        return;
      }

      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      // Get last day of the month (month is 1-based, but Date constructor uses 0-based)
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      // Use Supabase client to fetch earnings data
      const client = (this.db as any).getClient();
      const { data: earnings, error } = await client
        .from('earnings_calendar')
        .select('*')
        .gte('earnings_date', startDate)
        .lte('earnings_date', endDate)
        .order('earnings_date', { ascending: true })
        .order('importance_rating', { ascending: false })
        .order('symbol', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch earnings data: ${error.message}`);
      }

      // Group by date
      const calendarData = earnings.reduce((acc: any, item: any) => {
        if (!acc[item.earnings_date]) {
          acc[item.earnings_date] = [];
        }
        acc[item.earnings_date].push({
          id: item.id,
          symbol: item.symbol,
          company_name: item.company_name,
          earnings_date: item.earnings_date,
          time_of_day: item.time_of_day,
          importance_rating: item.importance_rating,
          status: item.status,
          confirmed: item.confirmed,
          has_reports: false,
          fiscal_quarter: item.fiscal_quarter,
          fiscal_year: item.fiscal_year
        });
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          year: parseInt(year),
          month: parseInt(month),
          calendar: calendarData
        }
      });
    } catch (error) {
      logger.error('Error getting earnings calendar month:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get earnings calendar month'
      });
    }
  };

  /**
   * Setup earnings data (temporary endpoint)
   */
  setupEarningsData = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Setting up earnings data...');
      
      // Use Supabase client to insert data
      const client = (this.db as any).getClient();
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

      // Insert using Supabase client
      const { data: inserted, error } = await client
        .from('earnings_calendar')
        .insert(earningsData)
        .select();
      
      if (error) {
        throw new Error(`Failed to insert earnings data: ${error.message}`);
      }
      
      res.json({
        success: true,
        message: 'Earnings data setup completed',
        count: inserted.length
      });
    } catch (error) {
      logger.error('Error setting up earnings data:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to setup earnings data'
      });
    }
  };

  /**
   * Debug endpoint to check earnings data
   */
  debugEarningsData = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check total count using Supabase
      const client = (this.db as any).getClient();
      const { count: totalCount, error: countError } = await client
        .from('earnings_calendar')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        throw new Error(`Failed to count earnings data: ${countError.message}`);
      }
      
      // Check January 2025 data
      const { data: janData, error: janError } = await client
        .from('earnings_calendar')
        .select('*')
        .gte('earnings_date', '2025-01-01')
        .lte('earnings_date', '2025-01-31')
        .order('earnings_date', { ascending: true })
        .order('importance_rating', { ascending: false })
        .limit(10);
      
      if (janError) {
        throw new Error(`Failed to fetch January data: ${janError.message}`);
      }

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
        error: error.message || 'Failed to debug earnings data'
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

      const client = (this.db as any).getClient();
      
      // Get the earnings report
      const { data: report, error: reportError } = await client
        .from('earnings_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError || !report) {
        res.status(404).json({
          success: false,
          error: 'Earnings report not found'
        });
        return;
      }

      // Get the report sections
      const { data: sections, error: sectionsError } = await client
        .from('earnings_report_sections')
        .select('*')
        .eq('earnings_report_id', reportId)
        .order('section_order', { ascending: true });

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