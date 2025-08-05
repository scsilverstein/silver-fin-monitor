// Polygon.io + Earnings Calendar Integration Service
import { PolygonStockFetcher } from './polygon-stock-fetcher';
import { StockFundamentals } from './stock-data-fetcher';
import { DatabaseService } from '../database/db.service';
import winston from 'winston';

export interface EnhancedStockFundamentals extends StockFundamentals {
  forwardEarningsData?: {
    eps_estimate: number;
    earnings_date: string;
    days_until_earnings: number;
    fiscal_quarter: number;
    fiscal_year: number;
    confidence_level: 'high' | 'medium' | 'low';
  };
  earningsHistory?: {
    quarters: number;
    average_beat_rate: number;
    last_surprise_percent: number;
  };
  financialMetrics?: {
    revenue_ttm: number;
    revenue_growth_yoy: number;
    eps_ttm: number;
    eps_growth_yoy: number;
    profit_margin: number;
    roe: number;
    debt_to_equity: number;
  };
}

export class PolygonEarningsIntegrationService {
  private polygonFetcher: PolygonStockFetcher;

  constructor(
    private db: DatabaseService,
    private logger: winston.Logger,
    polygonApiKey: string
  ) {
    this.polygonFetcher = new PolygonStockFetcher(logger, polygonApiKey);
  }

  /**
   * Fetch enhanced stock fundamentals with earnings integration
   */
  async fetchEnhancedFundamentals(symbol: string): Promise<EnhancedStockFundamentals> {
    try {
      // Get base fundamentals from Polygon
      const baseFundamentals = await this.polygonFetcher.fetchFundamentals(symbol);
      
      // Get forward earnings from our earnings calendar
      const forwardEarnings = await this.getForwardEarningsFromDB(symbol);
      
      // Get earnings history for confidence scoring
      const earningsHistory = await this.getEarningsHistoryFromDB(symbol);
      
      // Get latest financial metrics from Polygon
      const financialMetrics = await this.getFinancialMetricsFromPolygon(symbol);
      
      // Combine all data sources
      return this.combineEnhancedData(
        baseFundamentals,
        forwardEarnings,
        earningsHistory,
        financialMetrics
      );
    } catch (error) {
      this.logger.error('Enhanced fundamentals fetch error', { symbol, error });
      throw error;
    }
  }

  /**
   * Batch fetch enhanced fundamentals for multiple symbols
   */
  async fetchBulkEnhancedFundamentals(symbols: string[]): Promise<Map<string, EnhancedStockFundamentals>> {
    const results = new Map<string, EnhancedStockFundamentals>();
    
    // Process in batches of 10 to avoid overwhelming the APIs
    const batchSize = 10;
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async symbol => {
        try {
          const enhanced = await this.fetchEnhancedFundamentals(symbol);
          results.set(symbol, enhanced);
          this.logger.info(`✓ Enhanced data fetched for ${symbol}`);
        } catch (error) {
          this.logger.error(`Failed to fetch enhanced data for ${symbol}`, error);
          // Don't add to results if failed
        }
      });

      await Promise.all(batchPromises);
      
      // Rate limiting delay
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return results;
  }

  /**
   * Get forward earnings data from our earnings calendar database
   */
  private async getForwardEarningsFromDB(symbol: string): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT 
          eps_estimate,
          earnings_date,
          fiscal_quarter,
          fiscal_year,
          confirmed,
          importance_rating,
          (earnings_date::date - CURRENT_DATE)::integer as days_until_earnings
        FROM earnings_calendar
        WHERE symbol = $1
          AND earnings_date >= CURRENT_DATE
          AND eps_estimate IS NOT NULL
        ORDER BY earnings_date ASC
        LIMIT 1
      `, [symbol]);

      if (result.length > 0) {
        const earnings = result[0];
        return {
          eps_estimate: parseFloat(earnings.eps_estimate),
          earnings_date: earnings.earnings_date,
          days_until_earnings: earnings.days_until_earnings,
          fiscal_quarter: earnings.fiscal_quarter,
          fiscal_year: earnings.fiscal_year,
          confidence_level: this.calculateConfidenceLevel(
            earnings.confirmed,
            earnings.importance_rating,
            earnings.days_until_earnings
          )
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to get forward earnings from DB for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get historical earnings performance for confidence scoring
   */
  private async getEarningsHistoryFromDB(symbol: string): Promise<any> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as quarters,
          AVG(CASE 
            WHEN eps_actual IS NOT NULL AND eps_estimate IS NOT NULL 
            THEN CASE WHEN eps_actual > eps_estimate THEN 1 ELSE 0 END 
          END) as beat_rate,
          (
            SELECT 
              CASE 
                WHEN eps_estimate IS NOT NULL AND eps_estimate != 0 
                THEN ((eps_actual - eps_estimate) / ABS(eps_estimate)) * 100
                ELSE 0 
              END
            FROM earnings_calendar ec2
            WHERE ec2.symbol = $1
              AND ec2.eps_actual IS NOT NULL
              AND ec2.eps_estimate IS NOT NULL
            ORDER BY ec2.earnings_date DESC
            LIMIT 1
          ) as last_surprise_percent
        FROM earnings_calendar
        WHERE symbol = $1
          AND eps_actual IS NOT NULL
          AND earnings_date >= CURRENT_DATE - INTERVAL '2 years'
      `, [symbol]);

      if (result.length > 0 && result[0].quarters > 0) {
        return {
          quarters: parseInt(result[0].quarters),
          average_beat_rate: parseFloat(result[0].beat_rate) || 0,
          last_surprise_percent: parseFloat(result[0].last_surprise_percent) || 0
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to get earnings history for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get comprehensive financial metrics from Polygon
   */
  private async getFinancialMetricsFromPolygon(symbol: string): Promise<any> {
    try {
      // This would use Polygon's financials API
      // For now, return null - would need full Polygon financials integration
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get financial metrics from Polygon for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Calculate confidence level for forward earnings
   */
  private calculateConfidenceLevel(
    confirmed: boolean,
    importanceRating: number,
    daysUntilEarnings: number
  ): 'high' | 'medium' | 'low' {
    let score = 0;
    
    // Confirmed earnings get higher score
    if (confirmed) score += 30;
    
    // Importance rating (1-5 scale)
    score += (importanceRating || 3) * 10;
    
    // Closer earnings dates are more reliable
    if (daysUntilEarnings <= 7) score += 20;
    else if (daysUntilEarnings <= 30) score += 10;
    else if (daysUntilEarnings <= 90) score += 5;
    
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Combine all data sources into enhanced fundamentals
   */
  private combineEnhancedData(
    baseFundamentals: StockFundamentals,
    forwardEarnings: any,
    earningsHistory: any,
    financialMetrics: any
  ): EnhancedStockFundamentals {
    const enhanced: EnhancedStockFundamentals = {
      ...baseFundamentals
    };

    // Add forward earnings data
    if (forwardEarnings) {
      enhanced.forwardEarningsData = forwardEarnings;
      
      // Update forward EPS and PE if we have better data
      enhanced.forwardEPS = forwardEarnings.eps_estimate;
      if (enhanced.price > 0 && forwardEarnings.eps_estimate > 0) {
        enhanced.forwardPE = enhanced.price / forwardEarnings.eps_estimate;
      }
    }

    // Add earnings history
    if (earningsHistory) {
      enhanced.earningsHistory = earningsHistory;
    }

    // Add financial metrics
    if (financialMetrics) {
      enhanced.financialMetrics = financialMetrics;
    }

    // Update metadata
    enhanced.metadata = {
      ...enhanced.metadata,
      hasForwardEarnings: !!forwardEarnings,
      forwardEarningsConfidence: forwardEarnings?.confidence_level,
      earningsBeatRate: earningsHistory?.average_beat_rate,
      dataEnhanced: true,
      lastEnhanced: new Date().toISOString()
    };

    return enhanced;
  }

  /**
   * Update forward earnings estimates in the database
   */
  async updateForwardEarningsEstimates(symbol: string, newEstimate: number, source: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE earnings_calendar 
        SET 
          eps_estimate = $2,
          last_updated = NOW(),
          data_source = $3
        WHERE symbol = $1
          AND earnings_date >= CURRENT_DATE
          AND earnings_date = (
            SELECT MIN(earnings_date) 
            FROM earnings_calendar 
            WHERE symbol = $1 AND earnings_date >= CURRENT_DATE
          )
      `, [symbol, newEstimate, source]);
      
      this.logger.info(`Updated forward earnings estimate for ${symbol}: $${newEstimate}`);
    } catch (error) {
      this.logger.error(`Failed to update forward earnings for ${symbol}`, error);
      throw error;
    }
  }

  /**
   * Get stocks with earnings in the next N days
   */
  async getStocksWithUpcomingEarnings(days: number = 30): Promise<string[]> {
    try {
      const result = await this.db.query(`
        SELECT DISTINCT symbol
        FROM earnings_calendar
        WHERE earnings_date >= CURRENT_DATE
          AND earnings_date <= CURRENT_DATE + INTERVAL '${days} days'
          AND eps_estimate IS NOT NULL
        ORDER BY symbol
      `);

      return result.map(row => row.symbol);
    } catch (error) {
      this.logger.error('Failed to get stocks with upcoming earnings', error);
      return [];
    }
  }

  /**
   * Health check for the integration service
   */
  async healthCheck(): Promise<{
    polygonHealth: any;
    databaseHealth: boolean;
    earningsDataCount: number;
  }> {
    try {
      const polygonHealth = await this.polygonFetcher.getHealthStatus();
      
      let databaseHealth = true;
      let earningsDataCount = 0;
      
      try {
        const result = await this.db.query(`
          SELECT COUNT(*) as count 
          FROM earnings_calendar 
          WHERE earnings_date >= CURRENT_DATE
        `);
        earningsDataCount = parseInt(result[0].count);
      } catch (error) {
        databaseHealth = false;
      }

      return {
        polygonHealth,
        databaseHealth,
        earningsDataCount
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }
}

export default PolygonEarningsIntegrationService;