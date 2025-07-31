import { db } from '../database';
import { Logger } from '../../utils/stock-logger';
import { PolygonOptionsFetcher } from './polygon-options-fetcher';
import { OptionsAnalysisEngine, ScanCriteria, ValueAnalysis } from './options-analysis-engine';
import { cache } from '../cache';
import { Result } from '../../types';
import { QueueService } from '../queue.service';

const logger = new Logger('OptionsScannerService');

export interface TechStockOptions {
  symbol: string;
  companyName: string;
  techCategory: string;
  topOptions: OptionOpportunity[];
}

export interface OptionOpportunity {
  contractSymbol: string;
  optionType: 'call' | 'put';
  strikePrice: number;
  expirationDate: string;
  daysToExpiration: number;
  currentPrice: number;
  underlyingPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  valueScore: number;
  opportunityScore: number;
  riskAdjustedScore: number;
  recommendedStrategy: string;
  strategyRationale: string;
  expectedReturn?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ScannerResults {
  scanDate: Date;
  totalContractsAnalyzed: number;
  topOpportunities: OptionOpportunity[];
  byCategory: Map<string, TechStockOptions[]>;
  marketOverview: {
    avgImpliedVolatility: number;
    unusualActivity: OptionOpportunity[];
    highValueOpportunities: OptionOpportunity[];
    upcomingEarnings: Array<{
      symbol: string;
      earningsDate: Date;
      optionsActivity: string;
    }>;
  };
}

export class OptionsScannerService {
  private polygonFetcher: PolygonOptionsFetcher;
  private analysisEngine: OptionsAnalysisEngine;
  private queueService: QueueService;

  constructor(queueService: QueueService) {
    this.polygonFetcher = new PolygonOptionsFetcher();
    this.analysisEngine = new OptionsAnalysisEngine();
    this.queueService = queueService;
  }

  // Initialize tech stock universe
  async initializeTechStockUniverse(): Promise<Result<number>> {
    try {
      // Define comprehensive tech stock list
      const techStocks = [
        // Mega Cap Tech
        { symbol: 'AAPL', name: 'Apple Inc.', category: 'hardware', priority: 10 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', category: 'software', priority: 10 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', category: 'internet', priority: 10 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', category: 'cloud', priority: 10 },
        { symbol: 'META', name: 'Meta Platforms Inc.', category: 'social_media', priority: 10 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', category: 'semiconductor', priority: 10 },
        { symbol: 'TSLA', name: 'Tesla Inc.', category: 'ev_tech', priority: 9 },
        
        // Large Cap Software
        { symbol: 'CRM', name: 'Salesforce Inc.', category: 'cloud', priority: 9 },
        { symbol: 'ORCL', name: 'Oracle Corporation', category: 'enterprise_software', priority: 8 },
        { symbol: 'ADBE', name: 'Adobe Inc.', category: 'software', priority: 9 },
        { symbol: 'NOW', name: 'ServiceNow Inc.', category: 'cloud', priority: 8 },
        { symbol: 'INTU', name: 'Intuit Inc.', category: 'software', priority: 8 },
        { symbol: 'UBER', name: 'Uber Technologies', category: 'platform', priority: 8 },
        
        // Semiconductors
        { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'semiconductor', priority: 9 },
        { symbol: 'INTC', name: 'Intel Corporation', category: 'semiconductor', priority: 8 },
        { symbol: 'AVGO', name: 'Broadcom Inc.', category: 'semiconductor', priority: 8 },
        { symbol: 'QCOM', name: 'QUALCOMM Inc.', category: 'semiconductor', priority: 8 },
        { symbol: 'MU', name: 'Micron Technology', category: 'semiconductor', priority: 7 },
        { symbol: 'MRVL', name: 'Marvell Technology', category: 'semiconductor', priority: 7 },
        
        // Cloud & SaaS
        { symbol: 'SNOW', name: 'Snowflake Inc.', category: 'cloud', priority: 8 },
        { symbol: 'DDOG', name: 'Datadog Inc.', category: 'cloud', priority: 7 },
        { symbol: 'TEAM', name: 'Atlassian Corporation', category: 'software', priority: 7 },
        { symbol: 'WDAY', name: 'Workday Inc.', category: 'cloud', priority: 7 },
        { symbol: 'PANW', name: 'Palo Alto Networks', category: 'cybersecurity', priority: 8 },
        { symbol: 'CRWD', name: 'CrowdStrike Holdings', category: 'cybersecurity', priority: 8 },
        
        // E-commerce & Fintech
        { symbol: 'SHOP', name: 'Shopify Inc.', category: 'e_commerce', priority: 7 },
        { symbol: 'SQ', name: 'Block Inc.', category: 'fintech', priority: 7 },
        { symbol: 'PYPL', name: 'PayPal Holdings', category: 'fintech', priority: 8 },
        { symbol: 'COIN', name: 'Coinbase Global', category: 'crypto', priority: 6 },
        
        // Growth Tech
        { symbol: 'NET', name: 'Cloudflare Inc.', category: 'cloud', priority: 7 },
        { symbol: 'RBLX', name: 'Roblox Corporation', category: 'gaming', priority: 6 },
        { symbol: 'PLTR', name: 'Palantir Technologies', category: 'data_analytics', priority: 7 },
        { symbol: 'ZM', name: 'Zoom Video Communications', category: 'communication', priority: 6 },
        { symbol: 'ROKU', name: 'Roku Inc.', category: 'streaming', priority: 6 },
        { symbol: 'SNAP', name: 'Snap Inc.', category: 'social_media', priority: 6 },
        
        // EV & Battery Tech
        { symbol: 'RIVN', name: 'Rivian Automotive', category: 'ev_tech', priority: 6 },
        { symbol: 'LCID', name: 'Lucid Group', category: 'ev_tech', priority: 5 },
        { symbol: 'NIO', name: 'NIO Inc.', category: 'ev_tech', priority: 5 },
        
        // Emerging Tech
        { symbol: 'AI', name: 'C3.ai Inc.', category: 'ai', priority: 6 },
        { symbol: 'PATH', name: 'UiPath Inc.', category: 'automation', priority: 5 },
        { symbol: 'DOCN', name: 'DigitalOcean Holdings', category: 'cloud', priority: 5 }
      ];

      let added = 0;

      for (const stock of techStocks) {
        // First ensure the symbol exists in stock_symbols
        const { data: symbolData } = await db.getClient()
          .from('stock_symbols')
          .select('id')
          .eq('symbol', stock.symbol)
          .single();

        let symbolId: string;

        if (!symbolData) {
          // Add to stock_symbols first
          const { data: newSymbol, error: symbolError } = await db.getClient()
            .from('stock_symbols')
            .insert({
              symbol: stock.symbol,
              name: stock.name,
              sector: 'Technology',
              is_active: true
            })
            .select('id')
            .single();

          if (symbolError || !newSymbol) {
            logger.error(`Failed to add symbol ${stock.symbol}`, symbolError);
            continue;
          }
          symbolId = newSymbol.id;
        } else {
          symbolId = symbolData.id;
        }

        // Add to tech stock universe
        const { error } = await db.getClient()
          .from('tech_stock_universe')
          .upsert({
            symbol_id: symbolId,
            tech_category: stock.category,
            scan_priority: stock.priority,
            options_liquidity_tier: stock.priority >= 8 ? 'high' : stock.priority >= 6 ? 'medium' : 'low',
            preferred_strategies: this.getPreferredStrategies(stock.category),
            min_volume_threshold: stock.priority >= 8 ? 100 : 50,
            min_open_interest_threshold: stock.priority >= 8 ? 500 : 200,
            is_active: true
          }, {
            onConflict: 'symbol_id'
          });

        if (!error) {
          added++;
        } else {
          logger.error(`Failed to add ${stock.symbol} to tech universe`, error);
        }
      }

      logger.info(`Added ${added} tech stocks to universe`);
      return { success: true, data: added };

    } catch (error) {
      logger.error('Failed to initialize tech stock universe', error);
      return { success: false, error: error as Error };
    }
  }

  // Get preferred strategies based on tech category
  private getPreferredStrategies(category: string): string[] {
    const strategies: Record<string, string[]> = {
      'semiconductor': ['long_call', 'call_spread', 'covered_call'],
      'cloud': ['long_call', 'put_spread', 'iron_condor'],
      'software': ['covered_call', 'call_spread', 'calendar_spread'],
      'ai': ['long_call', 'straddle', 'strangle'],
      'ev_tech': ['long_call', 'long_put', 'straddle'],
      'cybersecurity': ['long_call', 'call_spread', 'protective_put'],
      'fintech': ['iron_condor', 'put_spread', 'covered_call'],
      'social_media': ['straddle', 'strangle', 'calendar_spread'],
      'e_commerce': ['covered_call', 'put_spread', 'iron_butterfly'],
      'gaming': ['long_call', 'long_put', 'straddle']
    };

    return strategies[category] || ['covered_call', 'long_call', 'put_spread'];
  }

  // Comprehensive tech options scan
  async scanTechOptions(): Promise<Result<ScannerResults>> {
    try {
      logger.info('Starting comprehensive tech options scan');

      // Fetch options for all tech stocks
      const techOptionsResult = await this.polygonFetcher.fetchTechStockOptions(7, 90);
      
      if (!techOptionsResult.success || !techOptionsResult.data) {
        return { success: false, error: new Error('Failed to fetch tech options') };
      }

      const allAnalyses: ValueAnalysis[] = [];
      const byCategory = new Map<string, TechStockOptions[]>();
      let totalContractsAnalyzed = 0;

      // Process each stock's options
      for (const [symbol, contracts] of techOptionsResult.data.entries()) {
        logger.info(`Analyzing ${contracts.length} contracts for ${symbol}`);

        // Store contracts in database
        await this.polygonFetcher.storeOptionsContracts(contracts);

        // Get contract symbols for quote fetching
        const contractSymbols = contracts.map(c => c.ticker);
        
        // Fetch real-time quotes
        const quotes = await this.polygonFetcher.fetchOptionsQuotes(contractSymbols);
        
        // Store market data
        await this.polygonFetcher.storeMarketData(quotes);

        // Analyze high-volume, liquid options
        const criteria: ScanCriteria = {
          minVolume: 50,
          minOpenInterest: 100,
          maxSpreadRatio: 0.20,
          minDaysToExpiration: 7,
          maxDaysToExpiration: 90
        };

        const scanResult = await this.analysisEngine.scanOptions(criteria);
        
        if (scanResult.success && scanResult.data) {
          allAnalyses.push(...scanResult.data);
          totalContractsAnalyzed += scanResult.data.length;
        }
      }

      // Process analyses into opportunities
      const opportunities = this.processAnalyses(allAnalyses);
      
      // Group by tech category
      const categorizedOpportunities = await this.categorizeOpportunities(opportunities);
      
      // Identify unusual activity
      const unusualActivity = this.findUnusualActivity(opportunities);
      
      // Find high value opportunities
      const highValueOpportunities = opportunities
        .filter(o => o.valueScore >= 80 && o.opportunityScore >= 75)
        .slice(0, 20);

      // Check for upcoming earnings
      const upcomingEarnings = await this.checkUpcomingEarnings(opportunities);

      const results: ScannerResults = {
        scanDate: new Date(),
        totalContractsAnalyzed,
        topOpportunities: opportunities.slice(0, 50),
        byCategory: categorizedOpportunities,
        marketOverview: {
          avgImpliedVolatility: this.calculateAvgIV(opportunities),
          unusualActivity,
          highValueOpportunities,
          upcomingEarnings
        }
      };

      // Store scanner results
      await this.storeScannerResults(results);

      // Cache results
      await cache.set('tech_options_scan:latest', results, 3600); // 1 hour

      logger.info(`Tech options scan complete. Analyzed ${totalContractsAnalyzed} contracts`);
      return { success: true, data: results };

    } catch (error) {
      logger.error('Tech options scan failed', error);
      return { success: false, error: error as Error };
    }
  }

  // Process analyses into opportunities
  private processAnalyses(analyses: ValueAnalysis[]): OptionOpportunity[] {
    return analyses.map(analysis => {
      // Get contract details from analysis
      const opportunity: OptionOpportunity = {
        contractSymbol: analysis.contractId, // This would need contract details lookup
        optionType: 'call', // Would need to be determined from contract
        strikePrice: 0, // Would need contract details
        expirationDate: '', // Would need contract details
        daysToExpiration: 0, // Would need calculation
        currentPrice: analysis.marketPrice,
        underlyingPrice: 0, // Would need market data
        volume: 0, // Would need market data
        openInterest: 0, // Would need market data
        impliedVolatility: analysis.ivRank / 100,
        valueScore: analysis.valueScore,
        opportunityScore: analysis.opportunityScore,
        riskAdjustedScore: analysis.riskAdjustedScore,
        recommendedStrategy: analysis.recommendedStrategy,
        strategyRationale: analysis.strategyRationale,
        expectedReturn: analysis.expectedValue,
        riskLevel: this.calculateRiskLevel(analysis)
      };

      return opportunity;
    }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  // Calculate risk level
  private calculateRiskLevel(analysis: ValueAnalysis): 'low' | 'medium' | 'high' {
    if (analysis.ivRank > 80 || analysis.spreadQualityScore < 50) {
      return 'high';
    }
    if (analysis.ivRank > 50 || analysis.riskAdjustedScore < 60) {
      return 'medium';
    }
    return 'low';
  }

  // Categorize opportunities by tech category
  private async categorizeOpportunities(
    opportunities: OptionOpportunity[]
  ): Promise<Map<string, TechStockOptions[]>> {
    const categoryMap = new Map<string, TechStockOptions[]>();

    // This would need actual implementation to group by symbol and category
    // For now, returning empty map
    return categoryMap;
  }

  // Find unusual options activity
  private findUnusualActivity(opportunities: OptionOpportunity[]): OptionOpportunity[] {
    return opportunities.filter(opp => {
      // Unusual volume (volume > 2x open interest)
      const volumeRatio = opp.openInterest > 0 ? opp.volume / opp.openInterest : 0;
      return volumeRatio > 2 || opp.volume > 10000;
    }).slice(0, 10);
  }

  // Calculate average implied volatility
  private calculateAvgIV(opportunities: OptionOpportunity[]): number {
    if (opportunities.length === 0) return 0;
    const sum = opportunities.reduce((acc, opp) => acc + opp.impliedVolatility, 0);
    return sum / opportunities.length;
  }

  // Check for upcoming earnings
  private async checkUpcomingEarnings(
    opportunities: OptionOpportunity[]
  ): Promise<Array<{ symbol: string; earningsDate: Date; optionsActivity: string }>> {
    // This would integrate with earnings calendar data
    // For now, returning empty array
    return [];
  }

  // Store scanner results in database
  private async storeScannerResults(results: ScannerResults): Promise<void> {
    try {
      // Store top opportunities
      for (const opportunity of results.topOpportunities.slice(0, 100)) {
        // This would need proper contract ID lookup
        logger.info(`Storing scanner result for ${opportunity.contractSymbol}`);
      }
    } catch (error) {
      logger.error('Failed to store scanner results', error);
    }
  }

  // Queue scanning job
  async queueScanJob(): Promise<void> {
    await this.queueService.addJob('options_scan', {
      type: 'tech_options_comprehensive',
      timestamp: new Date()
    }, {
      priority: 5,
      attempts: 3
    });
  }
}