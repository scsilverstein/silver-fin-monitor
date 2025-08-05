// Enhanced Stock Scanner with Earnings Integration
import { StockScannerService, StockMetrics } from './stock-scanner.service';
import { DatabaseService } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import { StockDataFetcher } from './stock-data-fetcher';
import winston from 'winston';

export interface EnhancedStockMetrics extends StockMetrics {
  earningsData?: {
    eps_estimate: number;
    earnings_date: string;
    days_until_earnings: number;
    fiscal_quarter: number;
    fiscal_year: number;
    importance_rating: number;
    confirmed: boolean;
  };
  earningsScore?: {
    momentum: number;        // Based on days until earnings
    estimate_quality: number; // Based on confidence and importance
    historical_beat_rate: number; // Based on past earnings performance
    composite: number;       // Combined earnings-based score
  };
  alertFlags?: string[];     // Earnings-specific alerts
}

export class EnhancedStockScannerService extends StockScannerService {
  constructor(
    db: DatabaseService,
    cache: CacheService,
    stockFetcher: StockDataFetcher,
    logger: winston.Logger,
    config?: any
  ) {
    super(db, cache, stockFetcher, logger, config);
  }

  /**
   * Enhanced scan that includes earnings data
   */
  async scanStocksWithEarnings(symbolIds?: string[]): Promise<void> {
    this.logger.info('Starting enhanced stock scan with earnings integration');

    try {
      // Get symbols to scan
      const symbols = await this.getSymbolsToScan(symbolIds);
      this.logger.info(`Scanning ${symbols.length} symbols with earnings data`);

      // Batch process symbols with earnings enhancement
      const batchSize = 10;
      const scanDate = new Date();

      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        await this.processEnhancedBatch(batch, scanDate);
        
        // Small delay between batches
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Update scan metadata
      await this.updateScanMetadata(scanDate, symbols.length);

      // Clear cache
      await this.cache.deleteByPattern('stocks:scanner:*');

      this.logger.info('Enhanced stock scan completed', { 
        scanDate, 
        symbolsScanned: symbols.length 
      });
    } catch (error) {
      this.logger.error('Enhanced stock scan failed', error);
      throw error;
    }
  }

  /**
   * Process batch with earnings enhancement
   */
  private async processEnhancedBatch(symbols: any[], scanDate: Date): Promise<void> {
    const symbolMap = new Map(symbols.map(s => [s.symbol, s]));
    
    // Get earnings data for all symbols in batch
    const earningsData = await this.getBatchEarningsData(symbols.map(s => s.symbol));
    
    // Fetch current fundamentals (this will use existing Yahoo/Alpha Vantage providers)
    const currentData = await this.stockFetcher.fetchBulkWithFallback(
      symbols.map(s => s.symbol)
    );

    // Process each symbol with earnings enhancement
    const scanResults = [];
    
    for (const [symbol, fundamentals] of currentData) {
      try {
        const symbolData = symbolMap.get(symbol);
        if (!symbolData) continue;

        // Get earnings data for this symbol
        const symbolEarnings = earningsData.get(symbol);

        // Enhance fundamentals with earnings data
        const enhancedFundamentals = this.enhanceFundamentalsWithEarnings(
          fundamentals, 
          symbolEarnings
        );

        // Get historical data
        const historical = await this.getHistoricalFundamentals(symbolData.id);
        
        // Calculate enhanced metrics
        const enhancedMetrics = await this.calculateEnhancedMetrics(
          symbolData,
          enhancedFundamentals,
          historical,
          symbolEarnings
        );

        // Store enhanced fundamentals
        await this.storeEnhancedFundamentals(symbolData.id, enhancedFundamentals);

        // Prepare enhanced scan result
        const scanResult = {
          symbol_id: symbolData.id,
          scan_date: scanDate,
          momentum_score: enhancedMetrics.scores.momentum,
          value_score: enhancedMetrics.scores.value,
          composite_score: enhancedMetrics.scores.composite,
          earnings_change_1d: enhancedMetrics.changes.earnings_1d,
          earnings_change_5d: enhancedMetrics.changes.earnings_5d,
          earnings_change_30d: enhancedMetrics.changes.earnings_30d,
          pe_change_1d: enhancedMetrics.changes.pe_1d,
          pe_change_5d: enhancedMetrics.changes.pe_5d,
          pe_change_30d: enhancedMetrics.changes.pe_30d,
          industry_percentile: enhancedMetrics.percentiles.industry,
          sector_percentile: enhancedMetrics.percentiles.sector,
          alerts: enhancedMetrics.alerts,
          // Enhanced fields
          earnings_momentum_score: enhancedMetrics.earningsScore?.momentum,
          earnings_quality_score: enhancedMetrics.earningsScore?.estimate_quality,
          days_until_earnings: enhancedMetrics.earningsData?.days_until_earnings,
          next_earnings_date: enhancedMetrics.earningsData?.earnings_date,
          forward_eps_estimate: enhancedMetrics.earningsData?.eps_estimate,
          metadata: {
            currentPrice: enhancedFundamentals.price,
            marketCap: enhancedFundamentals.marketCap,
            forwardPE: enhancedFundamentals.forwardPE,
            forwardEPS: enhancedFundamentals.forwardEPS,
            hasEarningsData: !!symbolEarnings
          }
        };

        scanResults.push(scanResult);
      } catch (error) {
        this.logger.error(`Failed to process enhanced ${symbol}`, error);
      }
    }

    // Bulk insert enhanced scan results
    if (scanResults.length > 0) {
      await this.insertEnhancedScanResults(scanResults);
    }
  }

  /**
   * Get earnings data for a batch of symbols
   */
  private async getBatchEarningsData(symbols: string[]): Promise<Map<string, any>> {
    const earningsMap = new Map();

    try {
      const result = await this.db.query(`
        SELECT 
          symbol,
          eps_estimate,
          earnings_date,
          fiscal_quarter,
          fiscal_year,
          importance_rating,
          confirmed,
          (earnings_date::date - CURRENT_DATE)::integer as days_until_earnings
        FROM earnings_calendar
        WHERE symbol = ANY($1)
          AND earnings_date >= CURRENT_DATE
          AND eps_estimate IS NOT NULL
        ORDER BY symbol, earnings_date ASC
      `, [symbols]);

      // Group by symbol, taking the next earnings date for each
      const symbolGroups: { [key: string]: any[] } = {};
      result.forEach(row => {
        if (!symbolGroups[row.symbol]) {
          symbolGroups[row.symbol] = [];
        }
        symbolGroups[row.symbol].push(row);
      });

      // Take the earliest earnings date for each symbol
      Object.keys(symbolGroups).forEach(symbol => {
        const earliestEarnings = symbolGroups[symbol][0]; // Already sorted by earnings_date ASC
        earningsMap.set(symbol, {
          eps_estimate: parseFloat(earliestEarnings.eps_estimate),
          earnings_date: earliestEarnings.earnings_date,
          days_until_earnings: earliestEarnings.days_until_earnings,
          fiscal_quarter: earliestEarnings.fiscal_quarter,
          fiscal_year: earliestEarnings.fiscal_year,
          importance_rating: earliestEarnings.importance_rating,
          confirmed: earliestEarnings.confirmed
        });
      });

    } catch (error) {
      this.logger.error('Failed to fetch batch earnings data', error);
    }

    return earningsMap;
  }

  /**
   * Enhance fundamentals with earnings data
   */
  private enhanceFundamentalsWithEarnings(fundamentals: any, earningsData: any): any {
    const enhanced = { ...fundamentals };

    if (earningsData) {
      // Use earnings calendar EPS estimate if available
      enhanced.forwardEPS = earningsData.eps_estimate;
      
      // Recalculate forward P/E with earnings calendar data
      if (enhanced.price > 0 && earningsData.eps_estimate > 0) {
        enhanced.forwardPE = enhanced.price / earningsData.eps_estimate;
      }

      // Add earnings metadata
      enhanced.metadata = {
        ...enhanced.metadata,
        earningsSource: 'calendar',
        nextEarningsDate: earningsData.earnings_date,
        daysUntilEarnings: earningsData.days_until_earnings
      };
    }

    return enhanced;
  }

  /**
   * Calculate enhanced metrics including earnings scores
   */
  private async calculateEnhancedMetrics(
    symbolData: any,
    fundamentals: any,
    historical: any[],
    earningsData: any
  ): Promise<EnhancedStockMetrics> {
    // Get base metrics
    const baseMetrics = await super.calculateMetrics(symbolData, fundamentals, historical) as any;

    // Add earnings data
    if (earningsData) {
      baseMetrics.earningsData = earningsData;
      baseMetrics.earningsScore = this.calculateEarningsScore(earningsData);
      baseMetrics.alertFlags = this.generateEarningsAlerts(earningsData, fundamentals);
      
      // Enhance base scores with earnings momentum
      if (baseMetrics.earningsScore) {
        baseMetrics.scores.momentum += baseMetrics.earningsScore.momentum * 0.2; // 20% boost from earnings
        baseMetrics.scores.composite = (baseMetrics.scores.momentum * 0.6 + baseMetrics.scores.value * 0.4);
      }
    }

    return baseMetrics;
  }

  /**
   * Calculate earnings-specific scores
   */
  private calculateEarningsScore(earningsData: any): any {
    let momentumScore = 0;
    let qualityScore = 50; // Base score
    
    // Momentum based on days until earnings
    if (earningsData.days_until_earnings <= 7) {
      momentumScore = 30; // High momentum for earnings within a week
    } else if (earningsData.days_until_earnings <= 30) {
      momentumScore = 20; // Medium momentum for earnings within a month
    } else if (earningsData.days_until_earnings <= 90) {
      momentumScore = 10; // Low momentum for earnings within a quarter
    }

    // Quality based on importance and confirmation
    qualityScore += (earningsData.importance_rating || 3) * 10; // 0-50 points for importance
    if (earningsData.confirmed) qualityScore += 20; // 20 points for confirmed earnings

    // Normalize quality score to 0-100
    qualityScore = Math.min(100, qualityScore);

    const compositeScore = (momentumScore * 0.6 + qualityScore * 0.4);

    return {
      momentum: Math.round(momentumScore),
      estimate_quality: Math.round(qualityScore),
      historical_beat_rate: 0, // Would need historical earnings beat data
      composite: Math.round(compositeScore)
    };
  }

  /**
   * Generate earnings-specific alerts
   */
  private generateEarningsAlerts(earningsData: any, fundamentals: any): string[] {
    const alerts: string[] = [];

    // Earnings timing alerts
    if (earningsData.days_until_earnings <= 7) {
      alerts.push('earnings_this_week');
    } else if (earningsData.days_until_earnings <= 30) {
      alerts.push('earnings_this_month');
    }

    // High importance earnings
    if (earningsData.importance_rating >= 5) {
      alerts.push('high_importance_earnings');
    }

    // Valuation vs earnings alerts
    if (fundamentals.forwardPE && fundamentals.forwardPE < 10) {
      alerts.push('low_pe_before_earnings');
    } else if (fundamentals.forwardPE && fundamentals.forwardPE > 50) {
      alerts.push('high_pe_before_earnings');
    }

    return alerts;
  }

  /**
   * Store enhanced fundamentals with earnings integration
   */
  private async storeEnhancedFundamentals(symbolId: string, fundamentals: any): Promise<void> {
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
        metadata = EXCLUDED.metadata,
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

  /**
   * Insert enhanced scan results with earnings data
   */
  private async insertEnhancedScanResults(results: any[]): Promise<void> {
    // This would need an enhanced scanner_results table or additional fields
    // For now, use the existing table structure and store earnings data in metadata
    const enhancedResults = results.map(r => ({
      ...r,
      metadata: JSON.stringify({
        ...r.metadata,
        earnings_momentum_score: r.earnings_momentum_score,
        earnings_quality_score: r.earnings_quality_score,
        days_until_earnings: r.days_until_earnings,
        next_earnings_date: r.next_earnings_date,
        forward_eps_estimate: r.forward_eps_estimate
      })
    }));

    // Use parent class method with enhanced data
    await super.insertScanResults(enhancedResults);
  }

  /**
   * Get stocks with upcoming earnings for priority scanning
   */
  async getStocksWithUpcomingEarnings(days: number = 30): Promise<string[]> {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT ec.symbol
        FROM earnings_calendar ec
        JOIN stock_symbols ss ON ec.symbol = ss.symbol
        WHERE ec.earnings_date >= CURRENT_DATE
          AND ec.earnings_date <= CURRENT_DATE + INTERVAL '${days} days'
          AND ec.eps_estimate IS NOT NULL
          AND ss.is_active = true
        ORDER BY ec.symbol
      `);

      return result.map(row => row.symbol);
    } catch (error) {
      this.logger.error('Failed to get stocks with upcoming earnings', error);
      return [];
    }
  }
}

export default EnhancedStockScannerService;