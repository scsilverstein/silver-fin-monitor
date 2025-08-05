import { db } from '../database';
import { Logger } from '../../utils/stock-logger';
import { Result } from '../../types';
import { cache } from '../cache';

const logger = new Logger('PeerComparisonEngine');

// Types
export interface PeerGroup {
  symbolId: string;
  peerSymbolIds: string[];
  relationshipType: 'sector' | 'industry' | 'market_cap' | 'custom';
  similarityScores: Map<string, number>;
}

export interface PeerMetrics {
  symbolId: string;
  metric: string;
  value: number;
  percentile: number;
  peerCount: number;
  mean: number;
  median: number;
  stdDev: number;
}

export interface ComparisonResult {
  symbol: string;
  metrics: {
    peRatio?: PeerMetrics;
    forwardPeRatio?: PeerMetrics;
    earningsGrowth?: PeerMetrics;
    priceToBook?: PeerMetrics;
    roe?: PeerMetrics;
  };
  peerGroups: {
    industry: PeerGroup;
    sector: PeerGroup;
    marketCap: PeerGroup;
  };
  interpretation: {
    overallRating: 'undervalued' | 'fairly_valued' | 'overvalued';
    confidence: number;
    keyInsights: string[];
  };
}

export interface StockClassification {
  id: string;
  symbol: string;
  sector: string;
  industry: string;
  marketCapCategory: string;
}

// Pure functions for statistical calculations
export const calculatePercentile = (
  value: number,
  sortedValues: number[]
): number => {
  if (sortedValues.length === 0) return 50;
  
  const index = sortedValues.findIndex(v => v >= value);
  if (index === -1) return 100;
  if (index === 0) return 0;
  
  return (index / sortedValues.length) * 100;
};

export const calculateStats = (values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
} => {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, median, stdDev };
};

// Determine if a stock is an outlier based on z-score
export const isOutlier = (value: number, mean: number, stdDev: number): boolean => {
  if (stdDev === 0) return false;
  const zScore = Math.abs((value - mean) / stdDev);
  return zScore > 2; // More than 2 standard deviations
};

// Calculate similarity score between two stocks
export const calculateSimilarity = (
  stock1: StockClassification,
  stock2: StockClassification
): number => {
  let score = 0;
  
  // Same industry: 50 points
  if (stock1.industry === stock2.industry) {
    score += 50;
  }
  // Same sector but different industry: 30 points
  else if (stock1.sector === stock2.sector) {
    score += 30;
  }
  
  // Same market cap category: 30 points
  if (stock1.marketCapCategory === stock2.marketCapCategory) {
    score += 30;
  }
  // Adjacent market cap: 15 points
  else if (areAdjacentMarketCaps(stock1.marketCapCategory, stock2.marketCapCategory)) {
    score += 15;
  }
  
  // Add additional criteria here (e.g., geographic region, growth rate similarity)
  
  return Math.min(score, 100);
};

const areAdjacentMarketCaps = (cap1: string, cap2: string): boolean => {
  const order = ['micro', 'small', 'mid', 'large', 'mega'];
  const index1 = order.indexOf(cap1);
  const index2 = order.indexOf(cap2);
  return Math.abs(index1 - index2) === 1;
};

// Main peer comparison engine
export class PeerComparisonEngine {
  constructor(private cacheService: typeof cache) {}
  
  async compareStock(symbolId: string): Promise<Result<ComparisonResult>> {
    try {
      // Get stock classification
      const classification = await this.getStockClassification(symbolId);
      if (!classification.success) {
        return { success: false, error: classification.error };
      }
      
      // Find peer groups
      const peerGroups = await this.findPeerGroups(classification.data);
      
      // Get metrics for comparison
      const metricsResult = await this.compareMetrics(
        symbolId,
        peerGroups
      );
      
      if (!metricsResult.success) {
        return metricsResult;
      }
      
      // Generate interpretation
      const interpretation = this.interpretResults(
        metricsResult.data,
        peerGroups
      );
      
      const result: ComparisonResult = {
        symbol: classification.data.symbol,
        metrics: metricsResult.data,
        peerGroups,
        interpretation
      };
      
      // Cache the result
      const cacheKey = `peer_comparison:${symbolId}:${new Date().toISOString().split('T')[0]}`;
      await this.cacheService.set(cacheKey, result, 3600); // 1 hour cache
      
      return { success: true, data: result };
      
    } catch (error) {
      logger.error('Failed to compare stock', error);
      return { success: false, error: error as Error };
    }
  }
  
  private async getStockClassification(
    symbolId: string
  ): Promise<Result<StockClassification>> {
    try {
      const { data, error } = await (db as any).getClient()
        .from('stock_symbols')
        .select('id, symbol, sector, industry, market_cap_category')
        .eq('id', symbolId)
        .single();
      
      if (error || !data) {
        return { 
          success: false, 
          error: new Error('Stock not found') 
        };
      }
      
      return {
        success: true,
        data: {
          id: data.id,
          symbol: data.symbol,
          sector: data.sector,
          industry: data.industry,
          marketCapCategory: data.market_cap_category
        }
      };
      
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
  
  private async findPeerGroups(
    stock: StockClassification
  ): Promise<{
    industry: PeerGroup;
    sector: PeerGroup;
    marketCap: PeerGroup;
  }> {
    // Find industry peers
    const industryPeers = await this.findPeersByClassification(
      stock,
      'industry'
    );
    
    // Find sector peers
    const sectorPeers = await this.findPeersByClassification(
      stock,
      'sector'
    );
    
    // Find market cap peers
    const marketCapPeers = await this.findPeersByClassification(
      stock,
      'market_cap'
    );
    
    return {
      industry: industryPeers,
      sector: sectorPeers,
      marketCap: marketCapPeers
    };
  }
  
  private async findPeersByClassification(
    stock: StockClassification,
    type: 'industry' | 'sector' | 'market_cap'
  ): Promise<PeerGroup> {
    let query = (db as any).getClient()
      .from('stock_symbols')
      .select('id, symbol, sector, industry, market_cap_category')
      .eq('is_active', true)
      .neq('id', stock.id);
    
    // Apply filters based on type
    switch (type) {
      case 'industry':
        query = query.eq('industry', stock.industry);
        break;
      case 'sector':
        query = query.eq('sector', stock.sector);
        break;
      case 'market_cap':
        query = query.eq('market_cap_category', stock.marketCapCategory);
        break;
    }
    
    const { data, error } = await query;
    
    if (error || !data) {
      logger.warn(`Failed to find ${type} peers`, error);
      return {
        symbolId: stock.id,
        peerSymbolIds: [],
        relationshipType: type,
        similarityScores: new Map()
      };
    }
    
    // Calculate similarity scores
    const similarityScores = new Map<string, number>();
    const peerSymbolIds: string[] = [];
    
    data.forEach(peer => {
      const similarity = calculateSimilarity(stock, {
        id: peer.id,
        symbol: peer.symbol,
        sector: peer.sector,
        industry: peer.industry,
        marketCapCategory: peer.market_cap_category
      });
      
      similarityScores.set(peer.id, similarity);
      peerSymbolIds.push(peer.id);
    });
    
    // Store peer relationships in database
    await this.storePeerRelationships(
      stock.id,
      peerSymbolIds,
      type,
      similarityScores
    );
    
    return {
      symbolId: stock.id,
      peerSymbolIds,
      relationshipType: type,
      similarityScores
    };
  }
  
  private async compareMetrics(
    symbolId: string,
    peerGroups: any
  ): Promise<Result<any>> {
    try {
      const metrics: any = {};
      
      // Compare each metric type
      const metricTypes = [
        { name: 'forward_pe_ratio', field: 'forwardPeRatio' },
        { name: 'pe_ratio', field: 'peRatio' },
        { name: 'earnings_growth', field: 'earningsGrowth' },
        { name: 'price_to_book', field: 'priceToBook' },
        { name: 'roe', field: 'roe' }
      ];
      
      for (const { name, field } of metricTypes) {
        // Get metric for target stock and industry peers
        const industryComparison = await this.compareMetricWithPeers(
          symbolId,
          peerGroups.industry.peerSymbolIds,
          name
        );
        
        if (industryComparison.success) {
          metrics[field] = industryComparison.data;
        }
      }
      
      return { success: true, data: metrics };
      
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
  
  private async compareMetricWithPeers(
    symbolId: string,
    peerIds: string[],
    metricName: string
  ): Promise<Result<PeerMetrics>> {
    try {
      if (peerIds.length === 0) {
        return { 
          success: false, 
          error: new Error('No peers for comparison') 
        };
      }
      
      // Get latest fundamentals for all stocks
      const allIds = [symbolId, ...peerIds];
      const { data, error } = await (db as any).getClient()
        .from('stock_fundamentals')
        .select('symbol_id, ' + this.getMetricColumn(metricName))
        .in('symbol_id', allIds)
        .eq('data_date', new Date().toISOString().split('T')[0]);
      
      if (error || !data) {
        return { 
          success: false, 
          error: new Error('Failed to fetch peer metrics') 
        };
      }
      
      // Extract values
      const targetValue = data.find(d => d.symbol_id === symbolId)?.[metricName];
      if (targetValue === undefined) {
        return { 
          success: false, 
          error: new Error('Target metric not found') 
        };
      }
      
      const peerValues = data
        .filter(d => d.symbol_id !== symbolId && d[metricName] !== null)
        .map(d => d[metricName])
        .sort((a, b) => a - b);
      
      const stats = calculateStats(peerValues);
      const percentile = calculatePercentile(targetValue, peerValues);
      
      return {
        success: true,
        data: {
          symbolId,
          metric: metricName,
          value: targetValue,
          percentile,
          peerCount: peerValues.length,
          mean: stats.mean,
          median: stats.median,
          stdDev: stats.stdDev
        }
      };
      
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
  
  private getMetricColumn(metricName: string): string {
    const columnMap: Record<string, string> = {
      'forward_pe_ratio': 'forward_pe_ratio',
      'pe_ratio': 'pe_ratio',
      'earnings_growth': 'earnings_growth_rate',
      'price_to_book': 'price_to_book',
      'roe': 'roe'
    };
    
    return columnMap[metricName] || metricName;
  }
  
  private interpretResults(
    metrics: any,
    peerGroups: any
  ): {
    overallRating: 'undervalued' | 'fairly_valued' | 'overvalued';
    confidence: number;
    keyInsights: string[];
  } {
    const insights: string[] = [];
    let undervaluedScore = 0;
    let overvaluedScore = 0;
    let dataPoints = 0;
    
    // Analyze P/E ratio
    if (metrics.forwardPeRatio) {
      const pe = metrics.forwardPeRatio;
      dataPoints++;
      
      if (pe.percentile < 30) {
        undervaluedScore += 2;
        insights.push(`Forward P/E in bottom 30% of peers (${pe.percentile.toFixed(0)}th percentile)`);
      } else if (pe.percentile > 70) {
        overvaluedScore += 2;
        insights.push(`Forward P/E in top 30% of peers (${pe.percentile.toFixed(0)}th percentile)`);
      }
      
      if (isOutlier(pe.value, pe.mean, pe.stdDev)) {
        insights.push('P/E ratio is a statistical outlier compared to peers');
      }
    }
    
    // Analyze ROE
    if (metrics.roe) {
      const roe = metrics.roe;
      dataPoints++;
      
      if (roe.percentile > 70) {
        undervaluedScore += 1;
        insights.push(`Strong ROE in top 30% of peers`);
      } else if (roe.percentile < 30) {
        overvaluedScore += 1;
        insights.push(`Weak ROE in bottom 30% of peers`);
      }
    }
    
    // Analyze Price to Book
    if (metrics.priceToBook) {
      const pb = metrics.priceToBook;
      dataPoints++;
      
      if (pb.percentile < 30) {
        undervaluedScore += 1;
        insights.push(`Price/Book ratio suggests potential value`);
      }
    }
    
    // Determine overall rating
    let overallRating: 'undervalued' | 'fairly_valued' | 'overvalued';
    const netScore = undervaluedScore - overvaluedScore;
    
    if (netScore >= 2) {
      overallRating = 'undervalued';
    } else if (netScore <= -2) {
      overallRating = 'overvalued';
    } else {
      overallRating = 'fairly_valued';
    }
    
    // Calculate confidence based on data completeness and peer count
    const peerCounts = Object.values(metrics)
      .filter(m => m && typeof m === 'object' && 'peerCount' in m);
    const avgPeerCount = peerCounts.length > 0 
      ? peerCounts.reduce((sum, m) => sum + (m.peerCount || 0), 0) / peerCounts.length
      : 0;
    
    const confidence = Math.min(
      (dataPoints / 5) * 50 + // 50% weight on data completeness
      (Math.min(avgPeerCount, 20) / 20) * 50, // 50% weight on peer count
      100
    );
    
    return {
      overallRating,
      confidence,
      keyInsights: insights
    };
  }
  
  private async storePeerRelationships(
    symbolId: string,
    peerIds: string[],
    type: string,
    similarityScores: Map<string, number>
  ): Promise<void> {
    const relationships = peerIds.map(peerId => ({
      symbol_id: symbolId,
      peer_symbol_id: peerId,
      relationship_type: type,
      similarity_score: similarityScores.get(peerId) || 0
    }));
    
    if (relationships.length > 0) {
      const { error } = await (db as any).getClient()
        .from('stock_peer_groups')
        .upsert(relationships, {
          onConflict: 'symbol_id,peer_symbol_id,relationship_type'
        });
      
      if (error) {
        logger.warn('Failed to store peer relationships', error);
      }
    }
  }
  
  // Get top/bottom performers in peer group
  async getPeerPerformers(
    symbolId: string,
    metric: string,
    limit: number = 5
  ): Promise<Result<Array<{
    symbol: string;
    value: number;
    percentile: number;
  }>>> {
    try {
      // Get peer group
      const { data: peers } = await (db as any).getClient()
        .from('stock_peer_groups')
        .select('peer_symbol_id')
        .eq('symbol_id', symbolId)
        .eq('relationship_type', 'industry');
      
      if (!peers || peers.length === 0) {
        return { success: true, data: [] };
      }
      
      const peerIds = peers.map(p => p.peer_symbol_id);
      
      // Get metric values for all peers
      const { data: metrics } = await (db as any).getClient()
        .from('stock_fundamentals')
        .select(`
          symbol_id,
          ${this.getMetricColumn(metric)},
          stock_symbols!inner(symbol)
        `)
        .in('symbol_id', [symbolId, ...peerIds])
        .eq('data_date', new Date().toISOString().split('T')[0])
        .order(this.getMetricColumn(metric), { ascending: true })
        .limit(limit * 2); // Get both top and bottom
      
      if (!metrics) {
        return { success: true, data: [] };
      }
      
      // Format results
      const results = metrics.map((m, index) => ({
        symbol: m.stock_symbols.symbol,
        value: m[this.getMetricColumn(metric)],
        percentile: (index / metrics.length) * 100
      }));
      
      return { success: true, data: results };
      
    } catch (error) {
      logger.error('Failed to get peer performers', error);
      return { success: false, error: error as Error };
    }
  }
}