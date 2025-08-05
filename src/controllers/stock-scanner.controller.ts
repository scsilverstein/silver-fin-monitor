// Stock scanner controller following CLAUDE.md specification
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../services/database/db.service';
import { CacheService } from '../services/cache/cache.service';
import { QueueService } from '../services/queue/queue.service';
import winston from 'winston';

export interface StockSymbol {
  id: string;
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StockFundamentals {
  id: string;
  symbol_id: string;
  date: Date;
  forward_pe?: number;
  trailing_pe?: number;
  forward_eps?: number;
  trailing_eps?: number;
  revenue?: number;
  earnings?: number;
  price?: number;
  market_cap?: number;
  metadata?: any;
  created_at: Date;
}

export interface ScannerResult {
  id: string;
  symbol: string;
  scan_date: Date;
  momentum_score: number;
  value_score: number;
  composite_score: number;
  earnings_change_1d?: number;
  earnings_change_5d?: number;
  earnings_change_30d?: number;
  pe_change_1d?: number;
  pe_change_5d?: number;
  pe_change_30d?: number;
  industry_percentile?: number;
  sector_percentile?: number;
  alerts?: string[];
  metadata?: any;
}

export class StockScannerController {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private queue: QueueService,
    private logger: winston.Logger
  ) {}

  // Get tracked stock symbols
  async getTrackedSymbols(req: Request, res: Response, next: NextFunction) {
    try {
      const { sector, industry, market_cap, is_active = true } = req.query;
      const cacheKey = `stocks:symbols:${JSON.stringify(req.query)}`;
      
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      let query = 'SELECT * FROM stock_symbols WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (is_active !== undefined) {
        query += ` AND is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (sector) {
        query += ` AND sector = $${paramIndex}`;
        params.push(sector);
        paramIndex++;
      }

      if (industry) {
        query += ` AND industry = $${paramIndex}`;
        params.push(industry);
        paramIndex++;
      }

      if (market_cap) {
        const marketCapRanges: any = {
          micro: [0, 300000000],
          small: [300000000, 2000000000],
          mid: [2000000000, 10000000000],
          large: [10000000000, 200000000000],
          mega: [200000000000, null]
        };
        
        const [min, max] = marketCapRanges[market_cap as string] || [0, null];
        query += ` AND market_cap >= $${paramIndex}`;
        params.push(min);
        paramIndex++;
        
        if (max) {
          query += ` AND market_cap < $${paramIndex}`;
          params.push(max);
          paramIndex++;
        }
      }

      query += ' ORDER BY symbol ASC';

      const symbols = await this.db.query(query, params);

      await this.cache.set(cacheKey, symbols, { ttl: 3600 }); // 1 hour

      res.json({
        success: true,
        data: symbols
      });
    } catch (error) {
      next(error);
    }
  }

  // Add new stock to track
  async addSymbol(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbol, name, sector, industry, market_cap } = req.body;

      // Check if symbol already exists
      const existing = await this.db.query(
        'SELECT id FROM stock_symbols WHERE symbol = $1',
        [symbol]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Symbol already exists'
        });
      }

      // Insert new symbol
      const [newSymbol] = await this.db.query(
        `INSERT INTO stock_symbols (symbol, name, sector, industry, market_cap, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [symbol, name, sector, industry, market_cap]
      );

      // Queue initial data fetch
      await this.queue.enqueue('stock_fetch_fundamentals', {
        symbolId: newSymbol.id,
        symbol: newSymbol.symbol
      }, { priority: 2 });

      // Invalidate cache
      await this.cache.deleteByPattern('stocks:symbols:*');

      res.status(201).json({
        success: true,
        data: newSymbol
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove stock from tracking
  async removeSymbol(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbol } = req.params;

      const result = await this.db.query(
        'UPDATE stock_symbols SET is_active = false WHERE symbol = $1 RETURNING id',
        [symbol]
      );

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      // Invalidate cache
      await this.cache.deleteByPattern('stocks:symbols:*');

      res.json({
        success: true,
        data: {
          message: 'Symbol deactivated successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get stock fundamentals
  async getFundamentals(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbol } = req.params;
      const { period = 'current' } = req.query;
      
      const cacheKey = `stocks:fundamentals:${symbol}:${period}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get symbol ID
      const [stockSymbol] = await this.db.query(
        'SELECT id FROM stock_symbols WHERE symbol = $1',
        [symbol]
      );

      if (!stockSymbol) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      let query = `
        SELECT * FROM stock_fundamentals 
        WHERE symbol_id = $1
      `;
      const params: any[] = [stockSymbol.id];

      switch (period) {
        case '1d':
          query += ' AND date >= CURRENT_DATE - INTERVAL \'1 day\'';
          break;
        case '5d':
          query += ' AND date >= CURRENT_DATE - INTERVAL \'5 days\'';
          break;
        case '30d':
          query += ' AND date >= CURRENT_DATE - INTERVAL \'30 days\'';
          break;
        case 'current':
        default:
          query += ' ORDER BY date DESC LIMIT 1';
          break;
      }

      if (period !== 'current') {
        query += ' ORDER BY date DESC';
      }

      const fundamentals = await this.db.query(query, params);

      const result = period === 'current' ? fundamentals[0] : fundamentals;

      await this.cache.set(cacheKey, result, { ttl: 1800 }); // 30 minutes

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get scanner results
  async getScannerResults(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        scan_type = 'all',
        min_score = 0,
        sector,
        industry,
        limit = 50,
        offset = 0,
        sort_by = 'composite_score',
        sort_order = 'desc'
      } = req.query;

      const cacheKey = `stocks:scanner:results:${JSON.stringify(req.query)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        const cachedData = cached as any;
        return res.json({
          success: true,
          data: cachedData.results,
          meta: cachedData.meta
        });
      }

      let query = `
        SELECT 
          sr.*,
          ss.symbol,
          ss.name,
          ss.sector,
          ss.industry,
          sf.forward_pe,
          sf.forward_eps,
          sf.price
        FROM scanner_results sr
        JOIN stock_symbols ss ON sr.symbol_id = ss.id
        LEFT JOIN LATERAL (
          SELECT * FROM stock_fundamentals
          WHERE symbol_id = ss.id
          ORDER BY date DESC
          LIMIT 1
        ) sf ON true
        WHERE sr.scan_date = (
          SELECT MAX(scan_date) FROM scanner_results
        )
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (scan_type !== 'all') {
        switch (scan_type) {
          case 'momentum':
            query += ` AND sr.momentum_score >= 70`;
            break;
          case 'value':
            query += ` AND sr.value_score >= 70`;
            break;
          case 'earnings_revision':
            query += ` AND (sr.earnings_change_5d > 5 OR sr.earnings_change_30d > 10)`;
            break;
        }
      }

      if (Number(min_score) > 0) {
        query += ` AND sr.composite_score >= $${paramIndex}`;
        params.push(Number(min_score));
        paramIndex++;
      }

      if (sector) {
        query += ` AND ss.sector = $${paramIndex}`;
        params.push(sector);
        paramIndex++;
      }

      if (industry) {
        query += ` AND ss.industry = $${paramIndex}`;
        params.push(industry);
        paramIndex++;
      }

      // Add sorting
      const validSortFields = [
        'composite_score', 'momentum_score', 'value_score',
        'earnings_change_1d', 'earnings_change_5d', 'earnings_change_30d',
        'pe_change_1d', 'pe_change_5d', 'pe_change_30d'
      ];
      
      const sortField = validSortFields.includes(sort_by as string) 
        ? `sr.${sort_by}` 
        : 'sr.composite_score';
      
      query += ` ORDER BY ${sortField} ${sort_order === 'asc' ? 'ASC' : 'DESC'}`;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), Number(offset));

      const results = await this.db.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) FROM scanner_results sr
        JOIN stock_symbols ss ON sr.symbol_id = ss.id
        WHERE sr.scan_date = (
          SELECT MAX(scan_date) FROM scanner_results
        )
      `;

      const countParams: any[] = [];
      paramIndex = 1;

      if (scan_type !== 'all') {
        switch (scan_type) {
          case 'momentum':
            countQuery += ` AND sr.momentum_score >= 70`;
            break;
          case 'value':
            countQuery += ` AND sr.value_score >= 70`;
            break;
          case 'earnings_revision':
            countQuery += ` AND (sr.earnings_change_5d > 5 OR sr.earnings_change_30d > 10)`;
            break;
        }
      }

      if (Number(min_score) > 0) {
        countQuery += ` AND sr.composite_score >= $${paramIndex}`;
        countParams.push(Number(min_score));
        paramIndex++;
      }

      if (sector) {
        countQuery += ` AND ss.sector = $${paramIndex}`;
        countParams.push(sector);
        paramIndex++;
      }

      if (industry) {
        countQuery += ` AND ss.industry = $${paramIndex}`;
        countParams.push(industry);
      }

      const [{ count }] = await this.db.query(countQuery, countParams);

      const response = {
        results,
        meta: {
          total: Number(count),
          limit: Number(limit),
          offset: Number(offset)
        }
      };

      await this.cache.set(cacheKey, response, { ttl: 900 }); // 15 minutes

      res.json({
        success: true,
        data: results,
        meta: response.meta
      });
    } catch (error) {
      next(error);
    }
  }

  // Get significant changes and alerts
  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        alert_type = 'all',
        min_change = 5,
        period = '5d',
        limit = 50
      } = req.query;

      const cacheKey = `stocks:alerts:${JSON.stringify(req.query)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      let changeField = '';
      switch (period) {
        case '1d':
          changeField = 'earnings_change_1d';
          break;
        case '5d':
          changeField = 'earnings_change_5d';
          break;
        case '30d':
          changeField = 'earnings_change_30d';
          break;
        default:
          changeField = 'earnings_change_5d';
      }

      let query = `
        SELECT 
          sr.*,
          ss.symbol,
          ss.name,
          ss.sector,
          ss.industry,
          array_agg(DISTINCT alert) as alerts
        FROM scanner_results sr
        JOIN stock_symbols ss ON sr.symbol_id = ss.id
        CROSS JOIN LATERAL unnest(sr.alerts) as alert
        WHERE sr.scan_date = (
          SELECT MAX(scan_date) FROM scanner_results
        )
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (alert_type !== 'all') {
        query += ` AND alert = $${paramIndex}`;
        params.push(alert_type);
        paramIndex++;
      }

      if (Number(min_change) > 0) {
        query += ` AND ABS(sr.${changeField}) >= $${paramIndex}`;
        params.push(Number(min_change));
        paramIndex++;
      }

      query += `
        GROUP BY sr.id, ss.symbol, ss.name, ss.sector, ss.industry
        ORDER BY ABS(sr.${changeField}) DESC
        LIMIT $${paramIndex}
      `;
      params.push(Number(limit));

      const alerts = await this.db.query(query, params);

      await this.cache.set(cacheKey, alerts, { ttl: 600 }); // 10 minutes

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  }

  // Manually trigger stock scan
  async triggerScan(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbols, force = false } = req.body;

      // Check if scan was recently run
      if (!force) {
        const [recentScan] = await this.db.query(
          'SELECT scan_date FROM scanner_results ORDER BY scan_date DESC LIMIT 1'
        );

        if (recentScan && new Date().getTime() - new Date(recentScan.scan_date).getTime() < 3600000) {
          return res.status(429).json({
            success: false,
            error: 'Scan was recently run. Use force=true to override.'
          });
        }
      }

      // Queue scan job
      const jobId = await this.queue.enqueue('stock_scanner_run', {
        symbols: symbols || null,
        triggerType: 'manual',
        userId: (req as any).user?.id
      }, { priority: 1 });

      res.json({
        success: true,
        data: {
          jobId,
          message: 'Stock scan queued successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get peer comparison data
  async getPeerComparison(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbol } = req.params;
      const { peer_type = 'industry', metrics = ['pe_ratio', 'earnings_growth'] } = req.query;

      const cacheKey = `stocks:peers:${symbol}:${peer_type}:${JSON.stringify(metrics)}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get target stock info
      const [targetStock] = await this.db.query(
        'SELECT * FROM stock_symbols WHERE symbol = $1',
        [symbol]
      );

      if (!targetStock) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      // Get peers based on type
      let peerQuery = 'SELECT * FROM stock_symbols WHERE is_active = true AND id != $1';
      const peerParams: any[] = [targetStock.id];
      let peerParamIndex = 2;

      switch (peer_type) {
        case 'industry':
          peerQuery += ` AND industry = $${peerParamIndex}`;
          peerParams.push(targetStock.industry);
          break;
        case 'sector':
          peerQuery += ` AND sector = $${peerParamIndex}`;
          peerParams.push(targetStock.sector);
          break;
        case 'market_cap':
          const capRange = 0.5; // 50% range
          peerQuery += ` AND market_cap BETWEEN $${peerParamIndex} AND $${peerParamIndex + 1}`;
          peerParams.push(
            targetStock.market_cap * (1 - capRange),
            targetStock.market_cap * (1 + capRange)
          );
          break;
      }

      const peers = await this.db.query(peerQuery, peerParams);

      // Get latest fundamentals for all stocks
      const allStockIds = [targetStock.id, ...peers.map((p: any) => p.id)];
      
      const fundamentalsQuery = `
        SELECT DISTINCT ON (symbol_id) 
          sf.*,
          ss.symbol
        FROM stock_fundamentals sf
        JOIN stock_symbols ss ON sf.symbol_id = ss.id
        WHERE sf.symbol_id = ANY($1)
        ORDER BY symbol_id, date DESC
      `;

      const fundamentals = await this.db.query(fundamentalsQuery, [allStockIds]);

      // Get scanner results
      const scannerQuery = `
        SELECT DISTINCT ON (symbol_id)
          sr.*,
          ss.symbol
        FROM scanner_results sr
        JOIN stock_symbols ss ON sr.symbol_id = ss.id
        WHERE sr.symbol_id = ANY($1)
        ORDER BY symbol_id, scan_date DESC
      `;

      const scannerResults = await this.db.query(scannerQuery, [allStockIds]);

      // Build comparison data
      const targetData = fundamentals.find((f: any) => f.symbol === symbol);
      const targetScanner = scannerResults.find((s: any) => s.symbol === symbol);

      const peerComparisons = peers.map((peer: any) => {
        const peerFundamentals = fundamentals.find((f: any) => f.symbol === peer.symbol);
        const peerScanner = scannerResults.find((s: any) => s.symbol === peer.symbol);

        return {
          symbol: peer.symbol,
          name: peer.name,
          fundamentals: peerFundamentals,
          scanner: peerScanner,
          relative_metrics: this.calculateRelativeMetrics(targetData, peerFundamentals, metrics as string[])
        };
      });

      const result = {
        target: {
          symbol: targetStock.symbol,
          name: targetStock.name,
          fundamentals: targetData,
          scanner: targetScanner
        },
        peers: peerComparisons,
        peer_type,
        metrics
      };

      await this.cache.set(cacheKey, result, { ttl: 3600 }); // 1 hour

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get watchlist
  async getWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      
      const watchlist = await this.db.query(
        `SELECT 
          w.*,
          ss.symbol,
          ss.name,
          ss.sector,
          ss.industry,
          sf.price,
          sf.forward_pe,
          sr.composite_score,
          sr.momentum_score,
          sr.value_score
        FROM watchlist w
        JOIN stock_symbols ss ON w.symbol_id = ss.id
        LEFT JOIN LATERAL (
          SELECT * FROM stock_fundamentals
          WHERE symbol_id = ss.id
          ORDER BY date DESC
          LIMIT 1
        ) sf ON true
        LEFT JOIN LATERAL (
          SELECT * FROM scanner_results
          WHERE symbol_id = ss.id
          ORDER BY scan_date DESC
          LIMIT 1
        ) sr ON true
        WHERE w.user_id = $1
        ORDER BY w.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: watchlist
      });
    } catch (error) {
      next(error);
    }
  }

  // Add to watchlist
  async addToWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { symbol, notes, target_price, alert_conditions } = req.body;

      // Get symbol ID
      const [stockSymbol] = await this.db.query(
        'SELECT id FROM stock_symbols WHERE symbol = $1',
        [symbol]
      );

      if (!stockSymbol) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      // Check if already in watchlist
      const existing = await this.db.query(
        'SELECT id FROM watchlist WHERE user_id = $1 AND symbol_id = $2',
        [userId, stockSymbol.id]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Symbol already in watchlist'
        });
      }

      // Add to watchlist
      const [watchlistItem] = await this.db.query(
        `INSERT INTO watchlist (user_id, symbol_id, notes, target_price, alert_conditions)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, stockSymbol.id, notes, target_price, alert_conditions]
      );

      res.status(201).json({
        success: true,
        data: watchlistItem
      });
    } catch (error) {
      next(error);
    }
  }

  // Remove from watchlist
  async removeFromWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { symbol } = req.params;

      // Get symbol ID
      const [stockSymbol] = await this.db.query(
        'SELECT id FROM stock_symbols WHERE symbol = $1',
        [symbol]
      );

      if (!stockSymbol) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      const result = await this.db.query(
        'DELETE FROM watchlist WHERE user_id = $1 AND symbol_id = $2 RETURNING id',
        [userId, stockSymbol.id]
      );

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not in watchlist'
        });
      }

      res.json({
        success: true,
        data: {
          message: 'Symbol removed from watchlist'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get scanner statistics
  async getScannerStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { period = '7d' } = req.query;
      const cacheKey = `stocks:scanner:stats:${period}`;
      
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      const periodDays = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;

      // Get scan statistics
      const scanStats = await this.db.query(
        `SELECT 
          COUNT(DISTINCT scan_date) as scan_count,
          COUNT(DISTINCT symbol_id) as symbols_scanned,
          AVG(composite_score) as avg_composite_score,
          AVG(momentum_score) as avg_momentum_score,
          AVG(value_score) as avg_value_score
        FROM scanner_results
        WHERE scan_date >= CURRENT_DATE - INTERVAL '${periodDays} days'`
      );

      // Get top performers
      const topPerformers = await this.db.query(
        `SELECT 
          ss.symbol,
          ss.name,
          AVG(sr.composite_score) as avg_score,
          MAX(sr.composite_score) as max_score,
          COUNT(*) as scan_count
        FROM scanner_results sr
        JOIN stock_symbols ss ON sr.symbol_id = ss.id
        WHERE sr.scan_date >= CURRENT_DATE - INTERVAL '${periodDays} days'
        GROUP BY ss.symbol, ss.name
        ORDER BY avg_score DESC
        LIMIT 10`
      );

      // Get alert distribution
      const alertDistribution = await this.db.query(
        `SELECT 
          alert,
          COUNT(*) as count
        FROM scanner_results sr
        CROSS JOIN LATERAL unnest(sr.alerts) as alert
        WHERE sr.scan_date >= CURRENT_DATE - INTERVAL '${periodDays} days'
        GROUP BY alert
        ORDER BY count DESC`
      );

      const stats = {
        period,
        overview: scanStats[0],
        topPerformers,
        alertDistribution,
        lastScanDate: await this.getLastScanDate()
      };

      await this.cache.set(cacheKey, stats, { ttl: 1800 }); // 30 minutes

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // Get change history for a symbol
  async getChangeHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbol } = req.params;
      const { metric = 'both', period = '30d' } = req.query;

      const cacheKey = `stocks:history:${symbol}:${metric}:${period}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get symbol ID
      const [stockSymbol] = await this.db.query(
        'SELECT id FROM stock_symbols WHERE symbol = $1',
        [symbol]
      );

      if (!stockSymbol) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      const periodDays = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '180d': 180,
        '1y': 365
      }[period as string] || 30;

      // Get fundamentals history
      const fundamentalsHistory = await this.db.query(
        `SELECT 
          date,
          forward_pe,
          trailing_pe,
          forward_eps,
          trailing_eps,
          price
        FROM stock_fundamentals
        WHERE symbol_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ORDER BY date DESC`,
        [stockSymbol.id]
      );

      // Get scanner history
      const scannerHistory = await this.db.query(
        `SELECT 
          scan_date,
          momentum_score,
          value_score,
          composite_score,
          earnings_change_1d,
          earnings_change_5d,
          earnings_change_30d,
          pe_change_1d,
          pe_change_5d,
          pe_change_30d
        FROM scanner_results
        WHERE symbol_id = $1
        AND scan_date >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ORDER BY scan_date DESC`,
        [stockSymbol.id]
      );

      const history = {
        symbol,
        period,
        metric,
        fundamentals: metric === 'pe_ratio' || metric === 'both' ? fundamentalsHistory : [],
        scanner: metric === 'earnings' || metric === 'both' ? scannerHistory : []
      };

      await this.cache.set(cacheKey, history, { ttl: 3600 }); // 1 hour

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk add symbols
  async bulkAddSymbols(req: Request, res: Response, next: NextFunction) {
    try {
      const { symbols } = req.body;
      const added = [];
      const errors = [];

      for (const symbolData of symbols) {
        try {
          // Check if symbol already exists
          const existing = await this.db.query(
            'SELECT id FROM stock_symbols WHERE symbol = $1',
            [symbolData.symbol]
          );

          if (existing.length > 0) {
            errors.push({
              symbol: symbolData.symbol,
              error: 'Already exists'
            });
            continue;
          }

          // Insert new symbol
          const [newSymbol] = await this.db.query(
            `INSERT INTO stock_symbols (symbol, name, sector, industry, market_cap, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING *`,
            [
              symbolData.symbol,
              symbolData.name,
              symbolData.sector,
              symbolData.industry,
              symbolData.market_cap
            ]
          );

          added.push(newSymbol);

          // Queue initial data fetch
          await this.queue.enqueue('stock_fetch_fundamentals', {
            symbolId: newSymbol.id,
            symbol: newSymbol.symbol
          }, { priority: 3 });
        } catch (error) {
          errors.push({
            symbol: symbolData.symbol,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Invalidate cache
      if (added.length > 0) {
        await this.cache.deleteByPattern('stocks:symbols:*');
      }

      res.status(errors.length > 0 ? 207 : 201).json({
        success: errors.length === 0,
        data: {
          added,
          errors,
          summary: {
            requested: symbols.length,
            added: added.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get sector performance
  async getSectorPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const { period = '5d' } = req.query;
      const cacheKey = `stocks:sectors:performance:${period}`;
      
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      const changeField = period === '1d' ? 'earnings_change_1d' :
                         period === '5d' ? 'earnings_change_5d' :
                         period === '30d' ? 'earnings_change_30d' :
                         'earnings_change_5d';

      const sectorPerformance = await this.db.query(
        `SELECT 
          ss.sector,
          COUNT(DISTINCT ss.id) as stock_count,
          AVG(sr.composite_score) as avg_composite_score,
          AVG(sr.momentum_score) as avg_momentum_score,
          AVG(sr.value_score) as avg_value_score,
          AVG(sr.${changeField}) as avg_earnings_change,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sr.${changeField}) as median_earnings_change,
          MAX(sr.${changeField}) as max_earnings_change,
          MIN(sr.${changeField}) as min_earnings_change
        FROM scanner_results sr
        JOIN stock_symbols ss ON sr.symbol_id = ss.id
        WHERE sr.scan_date = (
          SELECT MAX(scan_date) FROM scanner_results
        )
        AND ss.sector IS NOT NULL
        GROUP BY ss.sector
        ORDER BY avg_composite_score DESC`
      );

      await this.cache.set(cacheKey, sectorPerformance, { ttl: 1800 }); // 30 minutes

      res.json({
        success: true,
        data: sectorPerformance
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to calculate relative metrics
  private calculateRelativeMetrics(target: any, peer: any, metrics: string[]): any {
    if (!target || !peer) return {};

    const relative: any = {};

    for (const metric of metrics) {
      switch (metric) {
        case 'pe_ratio':
          if (target.forward_pe && peer.forward_pe) {
            relative.pe_ratio_diff = peer.forward_pe - target.forward_pe;
            relative.pe_ratio_percent = ((peer.forward_pe - target.forward_pe) / target.forward_pe) * 100;
          }
          break;
        case 'earnings_growth':
          if (target.forward_eps && target.trailing_eps && peer.forward_eps && peer.trailing_eps) {
            const targetGrowth = ((target.forward_eps - target.trailing_eps) / Math.abs(target.trailing_eps)) * 100;
            const peerGrowth = ((peer.forward_eps - peer.trailing_eps) / Math.abs(peer.trailing_eps)) * 100;
            relative.earnings_growth_diff = peerGrowth - targetGrowth;
          }
          break;
        case 'market_cap':
          if (target.market_cap && peer.market_cap) {
            relative.market_cap_ratio = peer.market_cap / target.market_cap;
          }
          break;
      }
    }

    return relative;
  }

  // Helper method to get last scan date
  private async getLastScanDate(): Promise<Date | null> {
    const [result] = await this.db.query(
      'SELECT MAX(scan_date) as last_scan FROM scanner_results'
    );
    return result?.last_scan || null;
  }
}

export default StockScannerController;