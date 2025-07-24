import { db } from '../database';
import { Logger } from '../../utils/stock-logger';
import { Result } from '../../types';

const logger = new Logger('FundamentalAnalyzer');

// Types
export interface ChangeMetrics {
  earnings_change_1d?: number;
  earnings_change_5d?: number;
  earnings_change_30d?: number;
  forward_pe_change_1d?: number;
  forward_pe_change_5d?: number;
  forward_pe_change_30d?: number;
}

export interface StockScanResult {
  symbolId: string;
  scanDate: Date;
  scanType: 'earnings_momentum' | 'pe_anomaly' | 'peer_relative';
  changeMetrics: ChangeMetrics;
  peerMetrics: {
    peVsSectorPercentile?: number;
    peVsIndustryPercentile?: number;
    earningsGrowthVsSectorPercentile?: number;
  };
  scores: {
    momentumScore: number;
    valueScore: number;
    compositeScore: number;
  };
  alerts: {
    isSignificantChange: boolean;
    alertType?: 'bullish_momentum' | 'bearish_divergence' | 'value_opportunity';
    alertMessage?: string;
  };
  confidenceLevel: number;
}

export interface HistoricalData {
  date: Date;
  earningsPerShare?: number;
  forwardEarningsPerShare?: number;
  peRatio?: number;
  forwardPeRatio?: number;
  price?: number;
}

// Pure function for percentage change calculation
export const calculatePercentChange = (
  current: number | undefined,
  previous: number | undefined
): number | undefined => {
  if (current === undefined || previous === undefined || previous === 0) {
    return undefined;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

// Pure function for calculating all change metrics
export const calculateChangeMetrics = (
  current: HistoricalData,
  historical: Map<number, HistoricalData>
): ChangeMetrics => {
  const oneDayAgo = historical.get(1);
  const fiveDaysAgo = historical.get(5);
  const thirtyDaysAgo = historical.get(30);
  
  return {
    earnings_change_1d: calculatePercentChange(
      current.forwardEarningsPerShare,
      oneDayAgo?.forwardEarningsPerShare
    ),
    earnings_change_5d: calculatePercentChange(
      current.forwardEarningsPerShare,
      fiveDaysAgo?.forwardEarningsPerShare
    ),
    earnings_change_30d: calculatePercentChange(
      current.forwardEarningsPerShare,
      thirtyDaysAgo?.forwardEarningsPerShare
    ),
    forward_pe_change_1d: calculatePercentChange(
      current.forwardPeRatio,
      oneDayAgo?.forwardPeRatio
    ),
    forward_pe_change_5d: calculatePercentChange(
      current.forwardPeRatio,
      fiveDaysAgo?.forwardPeRatio
    ),
    forward_pe_change_30d: calculatePercentChange(
      current.forwardPeRatio,
      thirtyDaysAgo?.forwardPeRatio
    ),
  };
};

// Calculate momentum score based on earnings changes
export const calculateMomentumScore = (changes: ChangeMetrics): number => {
  const weights = {
    oneDay: 0.2,
    fiveDay: 0.3,
    thirtyDay: 0.5
  };
  
  let score = 50; // Base score
  
  // Earnings momentum
  if (changes.earnings_change_1d !== undefined) {
    score += Math.min(Math.max(changes.earnings_change_1d * weights.oneDay, -10), 10);
  }
  if (changes.earnings_change_5d !== undefined) {
    score += Math.min(Math.max(changes.earnings_change_5d * weights.fiveDay, -15), 15);
  }
  if (changes.earnings_change_30d !== undefined) {
    score += Math.min(Math.max(changes.earnings_change_30d * weights.thirtyDay, -25), 25);
  }
  
  // Ensure score is between 0 and 100
  return Math.min(Math.max(score, 0), 100);
};

// Calculate value score based on P/E changes and peer comparison
export const calculateValueScore = (
  changes: ChangeMetrics,
  peerPercentile: number | undefined
): number => {
  let score = 50; // Base score
  
  // P/E improvement (lower is better)
  if (changes.forward_pe_change_30d !== undefined) {
    // Negative change in P/E is positive for value
    score += Math.min(Math.max(-changes.forward_pe_change_30d * 0.5, -25), 25);
  }
  
  // Peer comparison (lower percentile is better value)
  if (peerPercentile !== undefined) {
    // If in bottom 30% of peers, add to value score
    if (peerPercentile < 30) {
      score += (30 - peerPercentile) * 0.5;
    }
    // If in top 30% of peers, subtract from value score
    else if (peerPercentile > 70) {
      score -= (peerPercentile - 70) * 0.5;
    }
  }
  
  return Math.min(Math.max(score, 0), 100);
};

// Determine alert type based on metrics
export const determineAlertType = (
  changes: ChangeMetrics,
  momentumScore: number,
  valueScore: number,
  peerPercentile?: number
): { type?: string; message?: string; isSignificant: boolean } => {
  const significantThreshold = 10; // 10% change threshold
  
  // Check for significant earnings momentum
  const hasStrongEarningsMomentum = 
    (changes.earnings_change_30d && changes.earnings_change_30d > significantThreshold) ||
    (changes.earnings_change_5d && changes.earnings_change_5d > significantThreshold / 2);
  
  // Check for value opportunity
  const hasValueOpportunity = 
    valueScore > 70 && 
    peerPercentile !== undefined && 
    peerPercentile < 30;
  
  // Check for bearish divergence
  const hasBearishDivergence = 
    (changes.earnings_change_30d && changes.earnings_change_30d < -significantThreshold) &&
    (changes.forward_pe_change_30d && changes.forward_pe_change_30d > significantThreshold);
  
  if (hasStrongEarningsMomentum && momentumScore > 70) {
    return {
      type: 'bullish_momentum',
      message: 'Strong earnings momentum detected with positive revisions',
      isSignificant: true
    };
  }
  
  if (hasValueOpportunity) {
    return {
      type: 'value_opportunity',
      message: 'Potential value opportunity: Low P/E relative to peers with improving metrics',
      isSignificant: true
    };
  }
  
  if (hasBearishDivergence) {
    return {
      type: 'bearish_divergence',
      message: 'Warning: Earnings declining while valuation expanding',
      isSignificant: true
    };
  }
  
  // Check if any individual metric crosses threshold
  const isSignificant = Object.values(changes).some(
    change => change !== undefined && Math.abs(change) > significantThreshold
  );
  
  return { isSignificant };
};

// Main analyzer class
export class FundamentalAnalyzer {
  async analyzeStock(symbolId: string): Promise<Result<StockScanResult>> {
    try {
      // Fetch current and historical data
      const historicalData = await this.fetchHistoricalData(symbolId, 31);
      if (!historicalData.success) {
        return historicalData;
      }
      
      const { current, historical } = historicalData.data;
      
      // Calculate changes
      const changeMetrics = calculateChangeMetrics(current, historical);
      
      // Get peer comparison data
      const peerData = await this.fetchPeerComparison(symbolId);
      
      // Calculate scores
      const momentumScore = calculateMomentumScore(changeMetrics);
      const valueScore = calculateValueScore(
        changeMetrics,
        peerData.data?.peVsIndustryPercentile
      );
      const compositeScore = (momentumScore * 0.6) + (valueScore * 0.4);
      
      // Determine alerts
      const alertInfo = determineAlertType(
        changeMetrics,
        momentumScore,
        valueScore,
        peerData.data?.peVsIndustryPercentile
      );
      
      // Calculate confidence based on data completeness
      const dataPoints = Object.values(changeMetrics).filter(v => v !== undefined).length;
      const maxDataPoints = 6;
      const confidenceLevel = (dataPoints / maxDataPoints) * 100;
      
      const result: StockScanResult = {
        symbolId,
        scanDate: new Date(),
        scanType: 'earnings_momentum',
        changeMetrics,
        peerMetrics: peerData.data || {},
        scores: {
          momentumScore,
          valueScore,
          compositeScore
        },
        alerts: {
          isSignificantChange: alertInfo.isSignificant,
          alertType: alertInfo.type as any,
          alertMessage: alertInfo.message
        },
        confidenceLevel
      };
      
      // Store the result
      await this.storeScanResult(result);
      
      return { success: true, data: result };
      
    } catch (error) {
      logger.error('Failed to analyze stock', error);
      return { success: false, error: error as Error };
    }
  }
  
  private async fetchHistoricalData(
    symbolId: string,
    days: number
  ): Promise<Result<{ current: HistoricalData; historical: Map<number, HistoricalData> }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await db.getClient()
        .from('stock_fundamentals')
        .select('*')
        .eq('symbol_id', symbolId)
        .gte('data_date', startDate.toISOString())
        .order('data_date', { ascending: false });
      
      if (error || !data || data.length === 0) {
        return { 
          success: false, 
          error: new Error('No historical data found') 
        };
      }
      
      // Map data by days ago
      const historical = new Map<number, HistoricalData>();
      const current = data[0];
      const currentDate = new Date(current.data_date);
      
      data.forEach(record => {
        const recordDate = new Date(record.data_date);
        const daysAgo = Math.floor(
          (currentDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        historical.set(daysAgo, {
          date: recordDate,
          earningsPerShare: record.earnings_per_share,
          forwardEarningsPerShare: record.forward_earnings_per_share,
          peRatio: record.pe_ratio,
          forwardPeRatio: record.forward_pe_ratio,
          price: record.price
        });
      });
      
      return {
        success: true,
        data: {
          current: historical.get(0)!,
          historical
        }
      };
      
    } catch (error) {
      logger.error('Failed to fetch historical data', error);
      return { success: false, error: error as Error };
    }
  }
  
  private async fetchPeerComparison(symbolId: string): Promise<Result<any>> {
    try {
      // Get peer percentiles from database function
      const { data: peData } = await db.getClient().rpc('calculate_peer_percentile', {
        p_symbol_id: symbolId,
        p_metric_name: 'forward_pe_ratio',
        p_comparison_type: 'industry'
      });
      
      const { data: sectorData } = await db.getClient().rpc('calculate_peer_percentile', {
        p_symbol_id: symbolId,
        p_metric_name: 'forward_pe_ratio',
        p_comparison_type: 'sector'
      });
      
      return {
        success: true,
        data: {
          peVsIndustryPercentile: peData,
          peVsSectorPercentile: sectorData
        }
      };
      
    } catch (error) {
      logger.warn('Failed to fetch peer comparison', error);
      return { success: true, data: {} }; // Don't fail analysis if peer data unavailable
    }
  }
  
  private async storeScanResult(result: StockScanResult): Promise<void> {
    const { error } = await db.getClient()
      .from('stock_scanner_results')
      .upsert({
        symbol_id: result.symbolId,
        scan_date: result.scanDate,
        scan_type: result.scanType,
        earnings_change_1d: result.changeMetrics.earnings_change_1d,
        earnings_change_5d: result.changeMetrics.earnings_change_5d,
        earnings_change_30d: result.changeMetrics.earnings_change_30d,
        forward_pe_change_1d: result.changeMetrics.forward_pe_change_1d,
        forward_pe_change_5d: result.changeMetrics.forward_pe_change_5d,
        forward_pe_change_30d: result.changeMetrics.forward_pe_change_30d,
        pe_vs_sector_percentile: result.peerMetrics.peVsSectorPercentile,
        pe_vs_industry_percentile: result.peerMetrics.peVsIndustryPercentile,
        earnings_growth_vs_sector_percentile: result.peerMetrics.earningsGrowthVsSectorPercentile,
        momentum_score: result.scores.momentumScore,
        value_score: result.scores.valueScore,
        composite_score: result.scores.compositeScore,
        is_significant_change: result.alerts.isSignificantChange,
        alert_type: result.alerts.alertType,
        alert_message: result.alerts.alertMessage,
        confidence_level: result.confidenceLevel,
        analysis_metadata: {
          dataPoints: Object.values(result.changeMetrics).filter(v => v !== undefined).length,
          scanTimestamp: new Date()
        }
      }, {
        onConflict: 'symbol_id,scan_date,scan_type'
      });
    
    if (error) {
      throw new Error(`Failed to store scan result: ${error.message}`);
    }
  }
  
  // Batch analysis for multiple stocks
  async analyzeBatch(symbolIds: string[]): Promise<Map<string, Result<StockScanResult>>> {
    const results = new Map<string, Result<StockScanResult>>();
    
    // Process in parallel with concurrency limit
    const concurrencyLimit = 10;
    for (let i = 0; i < symbolIds.length; i += concurrencyLimit) {
      const batch = symbolIds.slice(i, i + concurrencyLimit);
      
      const batchResults = await Promise.all(
        batch.map(symbolId => this.analyzeStock(symbolId))
      );
      
      batch.forEach((symbolId, index) => {
        results.set(symbolId, batchResults[index]);
      });
    }
    
    return results;
  }
}