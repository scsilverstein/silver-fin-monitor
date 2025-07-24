import { db } from '../database';
import { Logger } from '../../utils/stock-logger';
import { CircuitBreaker } from '../circuit-breaker';
import { RetryManager, RetryConfig } from '../retry-manager';
import { cache } from '../cache';
import { Result } from '../../types';

const logger = new Logger('StockDataFetcher');

// Types
export interface StockSymbol {
  id: string;
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  marketCapCategory?: string;
  isActive: boolean;
}

export interface StockFundamentals {
  symbolId: string;
  dataDate: Date;
  
  // Earnings data
  earningsPerShare?: number;
  forwardEarningsPerShare?: number;
  earningsGrowthRate?: number;
  
  // P/E ratios
  peRatio?: number;
  forwardPeRatio?: number;
  pegRatio?: number;
  
  // Price and volume
  price?: number;
  volume?: number;
  marketCap?: number;
  
  // Additional metrics
  revenue?: number;
  revenueGrowthRate?: number;
  profitMargin?: number;
  bookValuePerShare?: number;
  priceToBook?: number;
  roe?: number;
}

export interface StockDataProvider {
  name: string;
  fetchFundamentals(symbol: string): Promise<StockFundamentals>;
  fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>>;
  isHealthy(): Promise<boolean>;
}

// Yahoo Finance Provider
class YahooFinanceProvider implements StockDataProvider {
  name = 'yahoo';
  private circuitBreaker: CircuitBreaker;
  private retryManager: RetryManager;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    backoff: 'exponential',
    delay: 1000,
    maxDelay: 30000
  };
  
  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      name: 'yahoo_finance',
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000 // 5 minutes
    });
    
    this.retryManager = new RetryManager();
  }
  
  async fetchFundamentals(symbol: string): Promise<StockFundamentals> {
    return this.circuitBreaker.execute(async () => {
      return this.retryManager.executeWithRetry(async () => {
        // Implementation would use Yahoo Finance API
        // For now, returning mock data structure
        const response = await this.makeApiCall(symbol);
        return this.transformResponse(response);
      }, this.retryConfig);
    });
  }
  
  async fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>> {
    const results = new Map<string, StockFundamentals>();
    
    // Batch requests to avoid rate limiting
    const batchSize = 20;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (symbol) => {
          try {
            const data = await this.fetchFundamentals(symbol);
            return { symbol, data };
          } catch (error) {
            logger.error(`Failed to fetch data for ${symbol}`, error);
            return null;
          }
        })
      );
      
      batchResults
        .filter(result => result !== null)
        .forEach(({ symbol, data }) => results.set(symbol, data));
      
      // Rate limiting delay
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
  
  private async makeApiCall(symbol: string): Promise<any> {
    // This would be the actual API call
    // Using mock for now
    const mockData = {
      symbol,
      regularMarketPrice: 150.00,
      regularMarketVolume: 10000000,
      marketCap: 1000000000,
      trailingPE: 25.5,
      forwardPE: 22.3,
      epsTrailingTwelveMonths: 5.88,
      epsForward: 6.73,
      bookValue: 45.23,
      returnOnEquity: 0.235
    };
    
    return mockData;
  }
  
  private transformResponse(response: any): StockFundamentals {
    return {
      symbolId: '', // Will be set by the fetcher
      dataDate: new Date(),
      earningsPerShare: response.epsTrailingTwelveMonths,
      forwardEarningsPerShare: response.epsForward,
      peRatio: response.trailingPE,
      forwardPeRatio: response.forwardPE,
      price: response.regularMarketPrice,
      volume: response.regularMarketVolume,
      marketCap: response.marketCap,
      bookValuePerShare: response.bookValue,
      priceToBook: response.regularMarketPrice / response.bookValue,
      roe: response.returnOnEquity
    };
  }
  
  async isHealthy(): Promise<boolean> {
    return !this.circuitBreaker.isOpen();
  }
}

// Alpha Vantage Provider (Alternative)
class AlphaVantageProvider implements StockDataProvider {
  name = 'alpha_vantage';
  private apiKey: string;
  private circuitBreaker: CircuitBreaker;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.circuitBreaker = new CircuitBreaker({
      name: 'alpha_vantage',
      failureThreshold: 3,
      resetTimeout: 120000 // 2 minutes
    });
  }
  
  async fetchFundamentals(symbol: string): Promise<StockFundamentals> {
    return this.circuitBreaker.execute(async () => {
      // Alpha Vantage API implementation
      const response = await this.makeApiCall(symbol);
      return this.transformResponse(response);
    });
  }
  
  async fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>> {
    const results = new Map<string, StockFundamentals>();
    
    // Alpha Vantage has strict rate limits (5 calls/minute for free tier)
    for (const symbol of symbols) {
      try {
        const data = await this.fetchFundamentals(symbol);
        results.set(symbol, data);
        
        // Rate limiting: 12 seconds between calls for free tier
        await new Promise(resolve => setTimeout(resolve, 12000));
      } catch (error) {
        logger.error(`Alpha Vantage failed for ${symbol}`, error);
      }
    }
    
    return results;
  }
  
  private async makeApiCall(symbol: string): Promise<any> {
    // Actual API implementation would go here
    return {};
  }
  
  private transformResponse(response: any): StockFundamentals {
    // Transform Alpha Vantage response format
    return {} as StockFundamentals;
  }
  
  async isHealthy(): Promise<boolean> {
    return !this.circuitBreaker.isOpen();
  }
}

// Main Stock Data Fetcher Service
export class StockDataFetcher {
  private providers: StockDataProvider[];
  private cacheService: typeof cache;
  private primaryProvider!: StockDataProvider; // Using definite assignment assertion
  
  constructor(cacheService: typeof cache) {
    this.cacheService = cacheService;
    
    // Initialize providers in priority order
    this.providers = [
      new YahooFinanceProvider(),
      // Add Alpha Vantage if API key is available
      ...(process.env.ALPHA_VANTAGE_API_KEY 
        ? [new AlphaVantageProvider(process.env.ALPHA_VANTAGE_API_KEY)]
        : [])
    ];
    
    // Ensure we always have at least one provider
    if (this.providers.length === 0) {
      throw new Error('No stock data providers available');
    }
    
    this.primaryProvider = this.providers[0] as StockDataProvider;
  }
  
  async fetchAndStoreFundamentals(symbol: string): Promise<Result<StockFundamentals>> {
    try {
      // Check cache first
      const cacheKey = `stock_fundamentals:${symbol}:${new Date().toISOString().split('T')[0]}`;
      const cached = await this.cacheService.get<StockFundamentals>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
      
      // Get symbol ID from database
      const { data: symbolData, error: symbolError } = await db.getClient()
        .from('stock_symbols')
        .select('id')
        .eq('symbol', symbol)
        .single();
      
      if (symbolError || !symbolData) {
        return { success: false, error: new Error(`Symbol ${symbol} not found`) };
      }
      
      // Try primary provider first
      let fundamentals: StockFundamentals | null = null;
      let lastError: Error | null = null;
      
      for (const provider of this.providers) {
        try {
          if (await provider.isHealthy()) {
            fundamentals = await provider.fetchFundamentals(symbol);
            fundamentals.symbolId = symbolData.id;
            
            // Store in database
            await this.storeFundamentals(fundamentals);
            
            // Cache the result
            await this.cacheService.set(cacheKey, fundamentals, 3600); // 1 hour
            
            logger.info(`Successfully fetched ${symbol} using ${provider.name}`);
            break;
          }
        } catch (error) {
          lastError = error as Error;
          logger.warn(`Provider ${provider.name} failed for ${symbol}`, error);
        }
      }
      
      if (!fundamentals) {
        return { 
          success: false, 
          error: lastError || new Error('All providers failed') 
        };
      }
      
      return { success: true, data: fundamentals };
      
    } catch (error) {
      logger.error('Failed to fetch fundamentals', error);
      return { success: false, error: error as Error };
    }
  }
  
  async fetchBulkFundamentals(symbols: string[]): Promise<Map<string, Result<StockFundamentals>>> {
    const results = new Map<string, Result<StockFundamentals>>();
    
    // Use the healthiest provider for bulk operations
    const healthyProvider = await this.getHealthiestProvider();
    if (!healthyProvider) {
      symbols.forEach(symbol => {
        results.set(symbol, { 
          success: false, 
          error: new Error('No healthy providers available') 
        });
      });
      return results;
    }
    
    try {
      const bulkData = await healthyProvider.fetchBulkFundamentals(symbols);
      
      for (const symbol of symbols) {
        const data = bulkData.get(symbol);
        if (data) {
          // Get symbol ID and store
          const { data: symbolData } = await db.getClient()
            .from('stock_symbols')
            .select('id')
            .eq('symbol', symbol)
            .single();
          
          if (symbolData) {
            data.symbolId = symbolData.id;
            await this.storeFundamentals(data);
            results.set(symbol, { success: true, data });
          }
        } else {
          results.set(symbol, { 
            success: false, 
            error: new Error('No data returned') 
          });
        }
      }
    } catch (error) {
      logger.error('Bulk fetch failed', error);
      symbols.forEach(symbol => {
        if (!results.has(symbol)) {
          results.set(symbol, { success: false, error: error as Error });
        }
      });
    }
    
    return results;
  }
  
  private async storeFundamentals(data: StockFundamentals): Promise<void> {
    const { error } = await db.getClient()
      .from('stock_fundamentals')
      .upsert({
        symbol_id: data.symbolId,
        data_date: data.dataDate,
        earnings_per_share: data.earningsPerShare,
        forward_earnings_per_share: data.forwardEarningsPerShare,
        earnings_growth_rate: data.earningsGrowthRate,
        pe_ratio: data.peRatio,
        forward_pe_ratio: data.forwardPeRatio,
        peg_ratio: data.pegRatio,
        price: data.price,
        volume: data.volume,
        market_cap: data.marketCap,
        revenue: data.revenue,
        revenue_growth_rate: data.revenueGrowthRate,
        profit_margin: data.profitMargin,
        book_value_per_share: data.bookValuePerShare,
        price_to_book: data.priceToBook,
        roe: data.roe,
        data_source: this.primaryProvider.name
      }, {
        onConflict: 'symbol_id,data_date,data_source'
      });
    
    if (error) {
      throw new Error(`Failed to store fundamentals: ${error.message}`);
    }
  }
  
  private async getHealthiestProvider(): Promise<StockDataProvider | null> {
    for (const provider of this.providers) {
      if (await provider.isHealthy()) {
        return provider;
      }
    }
    return null;
  }
  
  async getProviderHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const provider of this.providers) {
      health[provider.name] = await provider.isHealthy();
    }
    
    return health;
  }
}