import { StockDataFetcher } from './stock-data-fetcher';
import { FundamentalAnalyzer } from './fundamental-analyzer';
import { PeerComparisonEngine } from './peer-comparison-engine';
import { cache } from '../cache';
import { DatabaseQueueService } from '../database/queue';
import { db } from '../database';
import { Logger } from '../../utils/stock-logger';

const logger = new Logger('StockScannerJobs');

export enum StockScannerJobs {
  FETCH_FUNDAMENTALS = 'stock_fetch_fundamentals',
  CALCULATE_CHANGES = 'stock_calculate_changes',
  PEER_COMPARISON = 'stock_peer_comparison',
  GENERATE_ALERTS = 'stock_generate_alerts',
  DAILY_SCAN = 'stock_daily_scan'
}

export class StockScannerJobProcessor {
  private dataFetcher: StockDataFetcher;
  private analyzer: FundamentalAnalyzer;
  private peerEngine: PeerComparisonEngine;
  private queueService: DatabaseQueueService;
  
  constructor(
    cacheService: typeof cache,
    queueService: DatabaseQueueService
  ) {
    this.dataFetcher = new StockDataFetcher(cacheService);
    this.analyzer = new FundamentalAnalyzer();
    this.peerEngine = new PeerComparisonEngine(cacheService);
    this.queueService = queueService;
  }
  
  async processJob(jobType: string, payload: any): Promise<void> {
    switch (jobType) {
      case StockScannerJobs.FETCH_FUNDAMENTALS:
        await this.processFetchFundamentals(payload);
        break;
      case StockScannerJobs.CALCULATE_CHANGES:
        await this.processCalculateChanges(payload);
        break;
      case StockScannerJobs.PEER_COMPARISON:
        await this.processPeerComparison(payload);
        break;
      case StockScannerJobs.GENERATE_ALERTS:
        await this.processGenerateAlerts(payload);
        break;
      case StockScannerJobs.DAILY_SCAN:
        await this.processDailyScan(payload);
        break;
      default:
        throw new Error(`Unknown stock scanner job type: ${jobType}`);
    }
  }
  
  private async processFetchFundamentals(payload: {
    symbols: string[];
    priority?: boolean;
  }): Promise<void> {
    const { symbols, priority = false } = payload;
    
    logger.info('Fetching fundamentals for stocks', { count: symbols.length });
    
    if (symbols.length === 1) {
      // Single symbol fetch
      const result = await this.dataFetcher.fetchAndStoreFundamentals(symbols[0]);
      if (!result.success) {
        throw new Error(`Failed to fetch ${symbols[0]}: ${result.error?.message}`);
      }
    } else {
      // Bulk fetch
      const results = await this.dataFetcher.fetchBulkFundamentals(symbols);
      
      // Check for failures
      const failures = Array.from(results.entries())
        .filter(([_, result]) => !result.success);
      
      if (failures.length > 0) {
        logger.warn('Some symbols failed to fetch', {
          failed: failures.map(([symbol]) => symbol)
        });
      }
      
      // Queue analysis for successfully fetched symbols
      const successes = Array.from(results.entries())
        .filter(([_, result]) => result.success)
        .map(([symbol]) => symbol);
      
      if (successes.length > 0) {
        await this.queueService.enqueue(
          StockScannerJobs.CALCULATE_CHANGES,
          { symbols: successes },
          priority ? 2 : 5,
          60 // 1 minute delay
        );
      }
    }
  }
  
  private async processCalculateChanges(payload: {
    symbols?: string[];
    date?: string;
  }): Promise<void> {
    let symbolIds: string[] = [];
    
    if (payload.symbols) {
      // Get symbol IDs from symbols
      const { data } = await db.getClient()
        .from('stock_symbols')
        .select('id')
        .in('symbol', payload.symbols);
      
      symbolIds = data?.map(d => d.id) || [];
    } else {
      // Get all active symbols
      const { data } = await db.getClient()
        .from('stock_symbols')
        .select('id')
        .eq('is_active', true);
      
      symbolIds = data?.map(d => d.id) || [];
    }
    
    logger.info('Calculating changes for stocks', { count: symbolIds.length });
    
    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < symbolIds.length; i += batchSize) {
      const batch = symbolIds.slice(i, i + batchSize);
      const results = await this.analyzer.analyzeBatch(batch);
      
      // Queue peer comparison for significant changes
      const significantChanges = Array.from(results.entries())
        .filter(([_, result]) => 
          result.success && 
          result.data.alerts.isSignificantChange
        )
        .map(([symbolId]) => symbolId);
      
      if (significantChanges.length > 0) {
        await this.queueService.enqueue(
          StockScannerJobs.PEER_COMPARISON,
          { symbolIds: significantChanges },
          3
        );
      }
    }
    
    // Queue alert generation
    await this.queueService.enqueue(
      StockScannerJobs.GENERATE_ALERTS,
      { date: payload.date || new Date().toISOString() },
      4,
      300 // 5 minute delay
    );
  }
  
  private async processPeerComparison(payload: {
    symbolIds: string[];
  }): Promise<void> {
    const { symbolIds } = payload;
    
    logger.info('Running peer comparison', { count: symbolIds.length });
    
    for (const symbolId of symbolIds) {
      try {
        await this.peerEngine.compareStock(symbolId);
      } catch (error) {
        logger.error('Peer comparison failed', { symbolId, error });
      }
    }
  }
  
  private async processGenerateAlerts(payload: {
    date: string;
    thresholds?: {
      change1d?: number;
      change5d?: number;
      change30d?: number;
    };
  }): Promise<void> {
    const date = payload.date || new Date().toISOString();
    const thresholds = payload.thresholds || {
      change1d: 5,
      change5d: 10,
      change30d: 20
    };
    
    logger.info('Generating alerts', { date, thresholds });
    
    // Get significant changes from database function
    const { data, error } = await db.getClient().rpc('detect_significant_changes', {
      p_threshold_1d: thresholds.change1d,
      p_threshold_5d: thresholds.change5d,
      p_threshold_30d: thresholds.change30d
    });
    
    if (error) {
      throw new Error(`Failed to detect changes: ${error.message}`);
    }
    
    if (data && data.length > 0) {
      logger.info('Significant changes detected', { count: data.length });
      
      // Here you could:
      // 1. Send notifications
      // 2. Update watchlists
      // 3. Trigger other workflows
      
      // For now, just log them
      data.forEach((alert: any) => {
        logger.info('Stock alert', {
          symbolId: alert.symbol_id,
          type: alert.change_type,
          magnitude: alert.change_magnitude,
          message: alert.alert_message
        });
      });
    }
  }
  
  private async processDailyScan(payload: {
    forceRefresh?: boolean;
  }): Promise<void> {
    logger.info('Starting daily stock scan');
    
    // Get all active symbols
    const { data: symbols, error } = await db.getClient()
      .from('stock_symbols')
      .select('symbol')
      .eq('is_active', true);
    
    if (error || !symbols) {
      throw new Error('Failed to fetch active symbols');
    }
    
    const symbolList = symbols.map(s => s.symbol);
    logger.info('Active symbols for scanning', { count: symbolList.length });
    
    // Chunk symbols for batch processing
    const chunkSize = 20;
    const chunks = [];
    for (let i = 0; i < symbolList.length; i += chunkSize) {
      chunks.push(symbolList.slice(i, i + chunkSize));
    }
    
    // Queue fundamental fetching for each chunk
    for (let i = 0; i < chunks.length; i++) {
      await this.queueService.enqueue(
        StockScannerJobs.FETCH_FUNDAMENTALS,
        { 
          symbols: chunks[i],
          priority: true 
        },
        1, // High priority
        i * 60 // Stagger by 1 minute per chunk
      );
    }
    
    // Queue change calculation to run after all fetching
    await this.queueService.enqueue(
      StockScannerJobs.CALCULATE_CHANGES,
      { date: new Date().toISOString() },
      2,
      chunks.length * 60 + 300 // After all chunks + 5 minutes
    );
  }
}

// Cron job schedules
export const stockScannerCronJobs = [
  {
    name: 'daily-stock-scan',
    schedule: '0 7 * * 1-5', // 7 AM weekdays
    job: {
      type: StockScannerJobs.DAILY_SCAN,
      payload: { forceRefresh: false }
    }
  },
  {
    name: 'intraday-update',
    schedule: '0 10,14 * * 1-5', // 10 AM and 2 PM weekdays
    job: {
      type: StockScannerJobs.FETCH_FUNDAMENTALS,
      payload: { 
        symbols: 'watchlist', // Special indicator to fetch watchlist symbols
        priority: true 
      }
    }
  }
];

// Utility function to get watchlist symbols
export async function getWatchlistSymbols(): Promise<string[]> {
  const { data } = await db.getClient()
    .from('stock_watchlist')
    .select(`
      symbol_id,
      stock_symbols!inner(symbol)
    `)
    .eq('is_active', true)
    .eq('priority', 'high');
  
  return data?.map(d => d.stock_symbols.symbol) || [];
}