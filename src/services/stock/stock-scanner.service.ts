// Stock scanner service following CLAUDE.md specification
import { DatabaseService } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import { StockDataFetcher, StockFundamentals } from './stock-data-fetcher';
import winston from 'winston';

export interface ScannerConfig {
  momentumThreshold: number; // Minimum momentum score to flag
  valueThreshold: number; // Minimum value score to flag
  earningsChangeThreshold: {
    '1d': number;
    '5d': number;
    '30d': number;
  };
  peChangeThreshold: {
    '1d': number;
    '5d': number;
    '30d': number;
  };
}

export interface StockMetrics {
  symbolId: string;
  symbol: string;
  currentFundamentals: StockFundamentals;
  historicalFundamentals: StockFundamentals[];
  changes: {
    earnings_1d?: number;
    earnings_5d?: number;
    earnings_30d?: number;
    pe_1d?: number;
    pe_5d?: number;
    pe_30d?: number;
  };
  scores: {
    momentum: number;
    value: number;
    composite: number;
  };
  percentiles: {
    industry?: number;
    sector?: number;
  };
  alerts: string[];
}

export class StockScannerService {
  private config: ScannerConfig = {
    momentumThreshold: 70,
    valueThreshold: 70,
    earningsChangeThreshold: {
      '1d': 5,
      '5d': 10,
      '30d': 20
    },
    peChangeThreshold: {
      '1d': 5,
      '5d': 10,
      '30d': 15
    }
  };

  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private stockFetcher: StockDataFetcher,
    private logger: winston.Logger,
    config?: Partial<ScannerConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Main scanner method
  async scanStocks(symbolIds?: string[]): Promise<void> {
    this.logger.info('Starting stock scan', { symbolIds: symbolIds?.length || 'all' });

    try {
      // Get symbols to scan
      const symbols = await this.getSymbolsToScan(symbolIds);
      this.logger.info(`Scanning ${symbols.length} symbols`);

      // Batch process symbols
      const batchSize = 20;
      const scanDate = new Date();

      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        await this.processBatch(batch, scanDate);
        
        // Small delay between batches
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update scan metadata
      await this.updateScanMetadata(scanDate, symbols.length);

      // Clear cache
      await this.cache.deleteByPattern('stocks:scanner:*');

      this.logger.info('Stock scan completed', { 
        scanDate, 
        symbolsScanned: symbols.length 
      });
    } catch (error) {
      this.logger.error('Stock scan failed', error);
      throw error;
    }
  }

  // Process a batch of symbols
  private async processBatch(symbols: any[], scanDate: Date): Promise<void> {
    const symbolMap = new Map(symbols.map(s => [s.symbol, s]));
    
    // Fetch current fundamentals
    const currentData = await this.stockFetcher.fetchBulkWithFallback(
      symbols.map(s => s.symbol)
    );

    // Process each symbol
    const scanResults = [];
    
    for (const [symbol, fundamentals] of currentData) {
      try {
        const symbolData = symbolMap.get(symbol);
        if (!symbolData) continue;

        // Get historical data
        const historical = await this.getHistoricalFundamentals(symbolData.id);
        
        // Calculate metrics
        const metrics = await this.calculateMetrics(
          symbolData,
          fundamentals,
          historical
        );

        // Store fundamentals
        await this.storeFundamentals(symbolData.id, fundamentals);

        // Prepare scan result
        const scanResult = {
          symbol_id: symbolData.id,
          scan_date: scanDate,
          momentum_score: metrics.scores.momentum,
          value_score: metrics.scores.value,
          composite_score: metrics.scores.composite,
          earnings_change_1d: metrics.changes.earnings_1d,
          earnings_change_5d: metrics.changes.earnings_5d,
          earnings_change_30d: metrics.changes.earnings_30d,
          pe_change_1d: metrics.changes.pe_1d,
          pe_change_5d: metrics.changes.pe_5d,
          pe_change_30d: metrics.changes.pe_30d,
          industry_percentile: metrics.percentiles.industry,
          sector_percentile: metrics.percentiles.sector,
          alerts: metrics.alerts,
          metadata: {
            currentPrice: fundamentals.price,
            marketCap: fundamentals.marketCap,
            forwardPE: fundamentals.forwardPE,
            forwardEPS: fundamentals.forwardEPS
          }
        };

        scanResults.push(scanResult);
      } catch (error) {
        this.logger.error(`Failed to process ${symbol}`, error);
      }
    }

    // Bulk insert scan results
    if (scanResults.length > 0) {
      await this.insertScanResults(scanResults);
    }
  }

  // Calculate all metrics for a stock
  private async calculateMetrics(
    symbolData: any,
    current: StockFundamentals,
    historical: StockFundamentals[]
  ): Promise<StockMetrics> {
    // Calculate changes
    const changes = this.calculateChanges(current, historical);
    
    // Calculate scores
    const scores = this.calculateScores(changes, current);
    
    // Calculate peer percentiles
    const percentiles = await this.calculatePercentiles(
      symbolData,
      scores.composite
    );
    
    // Generate alerts
    const alerts = this.generateAlerts(changes, scores, percentiles);

    return {
      symbolId: symbolData.id,
      symbol: symbolData.symbol,
      currentFundamentals: current,
      historicalFundamentals: historical,
      changes,
      scores,
      percentiles,
      alerts
    };
  }

  // Calculate period-over-period changes
  private calculateChanges(
    current: StockFundamentals,
    historical: StockFundamentals[]
  ): StockMetrics['changes'] {
    const changes: StockMetrics['changes'] = {};

    // Sort historical by date descending
    const sorted = [...historical].sort((a, b) => 
      b.date.getTime() - a.date.getTime()
    );

    // 1-day changes
    const oneDayAgo = sorted.find(h => 
      this.daysDiff(h.date, current.date) >= 1
    );
    if (oneDayAgo) {
      if (current.forwardEPS && oneDayAgo.forwardEPS) {
        changes.earnings_1d = this.percentChange(
          oneDayAgo.forwardEPS,
          current.forwardEPS
        );
      }
      if (current.forwardPE && oneDayAgo.forwardPE) {
        changes.pe_1d = this.percentChange(
          oneDayAgo.forwardPE,
          current.forwardPE
        );
      }
    }

    // 5-day changes
    const fiveDaysAgo = sorted.find(h => 
      this.daysDiff(h.date, current.date) >= 5
    );
    if (fiveDaysAgo) {
      if (current.forwardEPS && fiveDaysAgo.forwardEPS) {
        changes.earnings_5d = this.percentChange(
          fiveDaysAgo.forwardEPS,
          current.forwardEPS
        );
      }
      if (current.forwardPE && fiveDaysAgo.forwardPE) {
        changes.pe_5d = this.percentChange(
          fiveDaysAgo.forwardPE,
          current.forwardPE
        );
      }
    }

    // 30-day changes
    const thirtyDaysAgo = sorted.find(h => 
      this.daysDiff(h.date, current.date) >= 30
    );
    if (thirtyDaysAgo) {
      if (current.forwardEPS && thirtyDaysAgo.forwardEPS) {
        changes.earnings_30d = this.percentChange(
          thirtyDaysAgo.forwardEPS,
          current.forwardEPS
        );
      }
      if (current.forwardPE && thirtyDaysAgo.forwardPE) {
        changes.pe_30d = this.percentChange(
          thirtyDaysAgo.forwardPE,
          current.forwardPE
        );
      }
    }

    return changes;
  }

  // Calculate momentum and value scores
  private calculateScores(
    changes: StockMetrics['changes'],
    current: StockFundamentals
  ): StockMetrics['scores'] {
    let momentumScore = 50; // Base score
    let valueScore = 50; // Base score

    // Momentum scoring based on earnings changes
    if (changes.earnings_1d !== undefined) {
      momentumScore += Math.min(changes.earnings_1d * 2, 20);
    }
    if (changes.earnings_5d !== undefined) {
      momentumScore += Math.min(changes.earnings_5d * 1.5, 15);
    }
    if (changes.earnings_30d !== undefined) {
      momentumScore += Math.min(changes.earnings_30d, 15);
    }

    // Value scoring based on P/E and changes
    if (current.forwardPE) {
      // Lower P/E is better for value
      if (current.forwardPE < 15) {
        valueScore += 20;
      } else if (current.forwardPE < 20) {
        valueScore += 10;
      } else if (current.forwardPE > 30) {
        valueScore -= 10;
      }
    }

    // Decreasing P/E is good for value
    if (changes.pe_5d !== undefined && changes.pe_5d < 0) {
      valueScore += Math.min(Math.abs(changes.pe_5d), 15);
    }
    if (changes.pe_30d !== undefined && changes.pe_30d < 0) {
      valueScore += Math.min(Math.abs(changes.pe_30d), 15);
    }

    // Normalize scores to 0-100
    momentumScore = Math.max(0, Math.min(100, momentumScore));
    valueScore = Math.max(0, Math.min(100, valueScore));

    // Composite score
    const compositeScore = (momentumScore * 0.6 + valueScore * 0.4);

    return {
      momentum: Math.round(momentumScore),
      value: Math.round(valueScore),
      composite: Math.round(compositeScore)
    };
  }

  // Calculate peer percentiles
  private async calculatePercentiles(
    symbolData: any,
    compositeScore: number
  ): Promise<StockMetrics['percentiles']> {
    const percentiles: StockMetrics['percentiles'] = {};

    // Industry percentile
    if (symbolData.industry) {
      const industryScores = await this.db.query(
        `SELECT composite_score 
         FROM scanner_results sr
         JOIN stock_symbols ss ON sr.symbol_id = ss.id
         WHERE ss.industry = $1
         AND sr.scan_date = (
           SELECT MAX(scan_date) FROM scanner_results
         )`,
        [symbolData.industry]
      );

      if (industryScores.length > 0) {
        const scores = industryScores.map(r => r.composite_score).sort((a, b) => a - b);
        const position = scores.filter(s => s < compositeScore).length;
        percentiles.industry = Math.round((position / scores.length) * 100);
      }
    }

    // Sector percentile
    if (symbolData.sector) {
      const sectorScores = await this.db.query(
        `SELECT composite_score 
         FROM scanner_results sr
         JOIN stock_symbols ss ON sr.symbol_id = ss.id
         WHERE ss.sector = $1
         AND sr.scan_date = (
           SELECT MAX(scan_date) FROM scanner_results
         )`,
        [symbolData.sector]
      );

      if (sectorScores.length > 0) {
        const scores = sectorScores.map(r => r.composite_score).sort((a, b) => a - b);
        const position = scores.filter(s => s < compositeScore).length;
        percentiles.sector = Math.round((position / scores.length) * 100);
      }
    }

    return percentiles;
  }

  // Generate alerts based on metrics
  private generateAlerts(
    changes: StockMetrics['changes'],
    scores: StockMetrics['scores'],
    percentiles: StockMetrics['percentiles']
  ): string[] {
    const alerts: string[] = [];

    // Momentum alerts
    if (scores.momentum >= this.config.momentumThreshold) {
      alerts.push('earnings_momentum');
    }

    // Value alerts
    if (scores.value >= this.config.valueThreshold) {
      alerts.push('value_opportunity');
    }

    // Large earnings changes
    if (changes.earnings_5d && Math.abs(changes.earnings_5d) >= this.config.earningsChangeThreshold['5d']) {
      alerts.push(changes.earnings_5d > 0 ? 'earnings_surge' : 'earnings_decline');
    }

    // P/E ratio changes
    if (changes.pe_5d && Math.abs(changes.pe_5d) >= this.config.peChangeThreshold['5d']) {
      alerts.push(changes.pe_5d > 0 ? 'pe_expansion' : 'pe_contraction');
    }

    // Peer outperformance
    if (percentiles.industry && percentiles.industry >= 90) {
      alerts.push('industry_leader');
    }
    if (percentiles.sector && percentiles.sector >= 90) {
      alerts.push('sector_leader');
    }

    // Bearish divergence (high momentum but poor value)
    if (scores.momentum >= 70 && scores.value <= 30) {
      alerts.push('bearish_divergence');
    }

    return [...new Set(alerts)]; // Remove duplicates
  }

  // Helper methods
  private async getSymbolsToScan(symbolIds?: string[]): Promise<any[]> {
    if (symbolIds && symbolIds.length > 0) {
      return this.db.query(
        'SELECT * FROM stock_symbols WHERE id = ANY($1) AND is_active = true',
        [symbolIds]
      );
    } else {
      return this.db.query(
        'SELECT * FROM stock_symbols WHERE is_active = true'
      );
    }
  }

  private async getHistoricalFundamentals(symbolId: string): Promise<StockFundamentals[]> {
    const rows = await this.db.query(
      `SELECT * FROM stock_fundamentals 
       WHERE symbol_id = $1 
       AND date >= CURRENT_DATE - INTERVAL '35 days'
       ORDER BY date DESC`,
      [symbolId]
    );

    return rows.map(this.mapRowToFundamentals);
  }

  private async storeFundamentals(symbolId: string, fundamentals: StockFundamentals): Promise<void> {
    await this.db.query(
      `INSERT INTO stock_fundamentals (
        symbol_id, date, price, market_cap,
        forward_pe, trailing_pe, forward_eps, trailing_eps,
        revenue, earnings, volume, 
        day_high, day_low, fifty_two_week_high, fifty_two_week_low,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (symbol_id, date) DO UPDATE SET
        price = EXCLUDED.price,
        market_cap = EXCLUDED.market_cap,
        forward_pe = EXCLUDED.forward_pe,
        trailing_pe = EXCLUDED.trailing_pe,
        forward_eps = EXCLUDED.forward_eps,
        trailing_eps = EXCLUDED.trailing_eps,
        updated_at = NOW()`,
      [
        symbolId,
        fundamentals.date,
        fundamentals.price,
        fundamentals.marketCap,
        fundamentals.forwardPE,
        fundamentals.trailingPE,
        fundamentals.forwardEPS,
        fundamentals.trailingEPS,
        fundamentals.revenue,
        fundamentals.earnings,
        fundamentals.volume,
        fundamentals.dayHigh,
        fundamentals.dayLow,
        fundamentals.fiftyTwoWeekHigh,
        fundamentals.fiftyTwoWeekLow,
        JSON.stringify(fundamentals.metadata || {})
      ]
    );
  }

  private async insertScanResults(results: any[]): Promise<void> {
    const values = results.map((r, i) => {
      const base = i * 16;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, 
               $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, 
               $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16})`;
    }).join(', ');

    const params = results.flatMap(r => [
      r.symbol_id,
      r.scan_date,
      r.momentum_score,
      r.value_score,
      r.composite_score,
      r.earnings_change_1d,
      r.earnings_change_5d,
      r.earnings_change_30d,
      r.pe_change_1d,
      r.pe_change_5d,
      r.pe_change_30d,
      r.industry_percentile,
      r.sector_percentile,
      r.alerts,
      JSON.stringify(r.metadata || {}),
      new Date()
    ]);

    await this.db.query(
      `INSERT INTO scanner_results (
        symbol_id, scan_date, momentum_score, value_score, composite_score,
        earnings_change_1d, earnings_change_5d, earnings_change_30d,
        pe_change_1d, pe_change_5d, pe_change_30d,
        industry_percentile, sector_percentile, alerts, metadata, created_at
      ) VALUES ${values}`,
      params
    );
  }

  private async updateScanMetadata(scanDate: Date, symbolCount: number): Promise<void> {
    await this.db.query(
      `INSERT INTO scanner_metadata (scan_date, symbols_scanned, completed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (scan_date) DO UPDATE SET
         symbols_scanned = EXCLUDED.symbols_scanned,
         completed_at = NOW()`,
      [scanDate, symbolCount]
    );
  }

  private mapRowToFundamentals(row: any): StockFundamentals {
    return {
      symbol: row.symbol || '',
      date: row.date,
      price: row.price,
      marketCap: row.market_cap,
      forwardPE: row.forward_pe,
      trailingPE: row.trailing_pe,
      forwardEPS: row.forward_eps,
      trailingEPS: row.trailing_eps,
      revenue: row.revenue,
      earnings: row.earnings,
      volume: row.volume,
      dayHigh: row.day_high,
      dayLow: row.day_low,
      fiftyTwoWeekHigh: row.fifty_two_week_high,
      fiftyTwoWeekLow: row.fifty_two_week_low,
      metadata: row.metadata
    };
  }

  private percentChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
  }

  private daysDiff(date1: Date, date2: Date): number {
    const diff = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

export default StockScannerService;