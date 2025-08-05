import { Request, Response } from 'express';
import { db } from '../services/database/index';
import { StockDataFetcher } from '../services/stock/stock-data-fetcher';
import { FundamentalAnalyzer } from '../services/stock/fundamental-analyzer';
import { PeerComparisonEngine } from '../services/stock/peer-comparison-engine';
import { StockScannerJobs } from '../services/stock/stock-scanner-jobs';
import { DatabaseQueueService } from '../services/database/queue';
import { cache } from '../services/cache';
import { logger } from '../utils/logger';

// Initialize services
// const stockDataFetcher = new StockDataFetcher(logger);
const fundamentalAnalyzer = new FundamentalAnalyzer();
const peerComparisonEngine = new PeerComparisonEngine(cache);
const queueService = new DatabaseQueueService();

// Get list of tracked stock symbols
export async function getStockSymbols(req: Request, res: Response) {
  try {
    const { sector, industry, active = true } = req.query;
    
    let query = db.from('stock_symbols')
      .select('*')
      .order('symbol', { ascending: true });
    
    if (sector) {
      query = query.eq('sector', sector);
    }
    if (industry) {
      query = query.eq('industry', industry);
    }
    if (active !== undefined) {
      query = query.eq('is_active', active === 'true');
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Failed to get stock symbols', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stock symbols'
    });
  }
}

// Add new stock to track
export async function addStockSymbol(req: Request, res: Response) {
  try {
    const { symbol, name, exchange, sector, industry, marketCapCategory } = req.body;
    
    if (!symbol || !name) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and name are required'
      });
    }
    
    const { data, error } = await db
      .from('stock_symbols')
      .insert({
        symbol: symbol.toUpperCase(),
        name,
        exchange,
        sector,
        industry,
        market_cap_category: marketCapCategory
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          success: false,
          error: 'Stock symbol already exists'
        });
      }
      throw error;
    }
    
    // Queue initial data fetch
    await queueService.enqueue(
      StockScannerJobs.FETCH_FUNDAMENTALS,
      { symbols: [symbol.toUpperCase()] },
      2 // High priority for new symbols
    );
    
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Failed to add stock symbol', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add stock symbol'
    });
  }
}

// Get stock fundamentals
export async function getStockFundamentals(req: Request, res: Response) {
  try {
    const { symbol } = req.params;
    const { days = 30 } = req.query;
    
    // Get symbol ID
    const { data: symbolData, error: symbolError } = await db
      .from('stock_symbols')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();
    
    if (symbolError || !symbolData) {
      return res.status(404).json({
        success: false,
        error: 'Stock symbol not found'
      });
    }
    
    // Get fundamentals
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    const { data, error } = await db
      .from('stock_fundamentals')
      .select('*')
      .eq('symbol_id', symbolData.id)
      .gte('data_date', startDate.toISOString())
      .order('data_date', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Failed to get stock fundamentals', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stock fundamentals'
    });
  }
}

// Get scanner results with filters
export async function getScannerResults(req: Request, res: Response) {
  try {
    const {
      date,
      scanType,
      minScore,
      isSignificant,
      alertType,
      limit = 50,
      offset = 0
    } = req.query;
    
    let query = db
      .from('stock_scanner_results')
      .select(`
        *,
        stock_symbols!inner(symbol, name, sector, industry)
      `)
      .order('composite_score', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    
    if (date) {
      query = query.eq('scan_date', date);
    } else {
      // Default to latest scan date
      const { data: latestDate } = await db
        .from('stock_scanner_results')
        .select('scan_date')
        .order('scan_date', { ascending: false })
        .limit(1)
        .single();
      
      if (latestDate) {
        query = query.eq('scan_date', latestDate.scan_date);
      }
    }
    
    if (scanType) {
      query = query.eq('scan_type', scanType);
    }
    if (minScore) {
      query = query.gte('composite_score', Number(minScore));
    }
    if (isSignificant !== undefined) {
      query = query.eq('is_significant_change', isSignificant === 'true');
    }
    if (alertType) {
      query = query.eq('alert_type', alertType);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || [],
      meta: {
        total: count || 0,
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    logger.error('Failed to get scanner results', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve scanner results'
    });
  }
}

// Get significant alerts
export async function getStockAlerts(req: Request, res: Response) {
  try {
    const { days = 7, alertType } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    let query = db
      .from('stock_scanner_results')
      .select(`
        *,
        stock_symbols!inner(symbol, name, sector, industry)
      `)
      .eq('is_significant_change', true)
      .gte('scan_date', startDate.toISOString())
      .order('scan_date', { ascending: false })
      .order('composite_score', { ascending: false });
    
    if (alertType) {
      query = query.eq('alert_type', alertType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Group by alert type for better organization
    const groupedAlerts = (data || []).reduce((acc: any, alert: any) => {
      const type = alert.alert_type || 'other';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(alert);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: groupedAlerts,
      summary: {
        total: data?.length || 0,
        byType: Object.keys(groupedAlerts).reduce((acc: any, type: string) => {
          acc[type] = groupedAlerts[type].length;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    logger.error('Failed to get stock alerts', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stock alerts'
    });
  }
}

// Manually trigger stock scan
export async function triggerStockScan(req: Request, res: Response) {
  try {
    const { symbols, scanType = 'full' } = req.body;
    
    let jobId: string;
    
    if (scanType === 'full') {
      // Queue full daily scan
      jobId = await queueService.enqueue(
        StockScannerJobs.DAILY_SCAN,
        { forceRefresh: true },
        1 // High priority
      );
    } else if (symbols && Array.isArray(symbols)) {
      // Queue specific symbols
      jobId = await queueService.enqueue(
        StockScannerJobs.FETCH_FUNDAMENTALS,
        { symbols, priority: true },
        1
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid scan request'
      });
    }
    
    res.json({
      success: true,
      data: {
        jobId,
        message: 'Stock scan queued successfully'
      }
    });
  } catch (error) {
    logger.error('Failed to trigger stock scan', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger stock scan'
    });
  }
}

// Get peer comparison data
export async function getPeerComparison(req: Request, res: Response) {
  try {
    const { symbol } = req.params;
    
    // Get symbol ID
    const { data: symbolData, error: symbolError } = await db
      .from('stock_symbols')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();
    
    if (symbolError || !symbolData) {
      return res.status(404).json({
        success: false,
        error: 'Stock symbol not found'
      });
    }
    
    // Check cache first
    const cacheKey = `peer_comparison:${symbolData.id}:${new Date().toISOString().split('T')[0]}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }
    
    // Generate fresh comparison
    const result = await peerComparisonEngine.compareStock(symbolData.id);
    
    if (!result.success) {
      throw result.error;
    }
    
    res.json({
      success: true,
      data: result.data,
      cached: false
    });
  } catch (error) {
    logger.error('Failed to get peer comparison', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve peer comparison'
    });
  }
}

// Get watchlist stocks
export async function getWatchlist(req: Request, res: Response) {
  try {
    const { priority, active = true } = req.query;
    
    let query = db
      .from('stock_watchlist')
      .select(`
        *,
        stock_symbols!inner(symbol, name, sector, industry)
      `)
      .order('priority', { ascending: false })
      .order('added_at', { ascending: false });
    
    if (active !== undefined) {
      query = query.eq('is_active', active === 'true');
    }
    if (priority) {
      query = query.eq('priority', priority);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Failed to get watchlist', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve watchlist'
    });
  }
}

// Add stock to watchlist
export async function addToWatchlist(req: Request, res: Response) {
  try {
    const { symbol, reason, priority = 'medium', alertThreshold } = req.body;
    
    // Get symbol ID
    const { data: symbolData, error: symbolError } = await db
      .from('stock_symbols')
      .select('id')
      .eq('symbol', symbol.toUpperCase())
      .single();
    
    if (symbolError || !symbolData) {
      return res.status(404).json({
        success: false,
        error: 'Stock symbol not found'
      });
    }
    
    const { data, error } = await db
      .from('stock_watchlist')
      .insert({
        symbol_id: symbolData.id,
        reason,
        priority,
        alert_threshold: alertThreshold || {},
        added_by: req.user?.id || 'system' // Assuming user from auth middleware
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({
          success: false,
          error: 'Stock already in watchlist'
        });
      }
      throw error;
    }
    
    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Failed to add to watchlist', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to watchlist'
    });
  }
}

// Get top movers view
export async function getTopMovers(req: Request, res: Response) {
  try {
    const { limit = 10 } = req.query;
    
    const { data, error } = await db
      .from('v_stock_top_movers')
      .select('*')
      .limit(Number(limit));
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Failed to get top movers', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top movers'
    });
  }
}