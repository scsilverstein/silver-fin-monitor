// Stock data fetcher service following CLAUDE.md specification
import axios from 'axios';
import { CircuitBreaker, CircuitState } from '../circuit-breaker/circuit-breaker';
import winston from 'winston';

export interface StockDataProvider {
  name: string;
  priority: number;
  isHealthy(): Promise<boolean>;
  fetchFundamentals(symbol: string): Promise<StockFundamentals>;
  fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>>;
}

export interface StockFundamentals {
  symbol: string;
  date: Date;
  price: number;
  marketCap: number;
  forwardPE?: number;
  trailingPE?: number;
  forwardEPS?: number;
  trailingEPS?: number;
  revenue?: number;
  earnings?: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  metadata?: any;
}

// Yahoo Finance Provider
export class YahooFinanceProvider implements StockDataProvider {
  name = 'Yahoo Finance';
  priority = 1;
  private circuitBreaker: CircuitBreaker;
  private baseUrl = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';

  constructor(private logger: winston.Logger) {
    this.circuitBreaker = new CircuitBreaker(
      'YahooFinanceProvider',
      this.logger,
      {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 120000 // 2 minutes
      }
    );
  }

  async isHealthy(): Promise<boolean> {
    return this.circuitBreaker.getState() !== CircuitState.OPEN;
  }

  async fetchFundamentals(symbol: string): Promise<StockFundamentals> {
    return this.circuitBreaker.execute(async () => {
      try {
        const modules = [
          'financialData',
          'defaultKeyStatistics',
          'price',
          'summaryDetail',
          'earnings'
        ].join(',');

        const response = await axios.get(this.baseUrl + `/${symbol}`, {
          params: {
            modules,
            crumb: await this.getCrumb()
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 10000
        });

        const data = response.data.quoteSummary.result[0];
        
        return this.parseYahooData(symbol, data);
      } catch (error) {
        this.logger.error('Yahoo Finance fetch error', { symbol, error });
        throw error;
      }
    });
  }

  async fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>> {
    const results = new Map<string, StockFundamentals>();
    
    // Yahoo doesn't have a great bulk API, so we batch with rate limiting
    const batchSize = 5;
    const delay = 1000; // 1 second between batches

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(symbol => 
        this.fetchFundamentals(symbol)
          .then(data => results.set(symbol, data))
          .catch(error => {
            this.logger.error(`Failed to fetch ${symbol}`, error);
            // Store null for failed symbols to track them
            results.set(symbol, null);
            // Don't re-throw to allow other symbols in batch to complete
          })
      );

      await Promise.all(batchPromises);
      
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  private async getCrumb(): Promise<string> {
    // In a real implementation, this would fetch a valid crumb token
    // For now, return a placeholder
    return 'dummy-crumb';
  }

  private parseYahooData(symbol: string, data: any): StockFundamentals {
    const price = data.price || {};
    const financialData = data.financialData || {};
    const defaultKeyStatistics = data.defaultKeyStatistics || {};
    const summaryDetail = data.summaryDetail || {};

    return {
      symbol,
      date: new Date(),
      price: price.regularMarketPrice?.raw || 0,
      marketCap: price.marketCap?.raw || 0,
      forwardPE: defaultKeyStatistics.forwardPE?.raw,
      trailingPE: defaultKeyStatistics.trailingPE?.raw,
      forwardEPS: defaultKeyStatistics.forwardEps?.raw,
      trailingEPS: defaultKeyStatistics.trailingEps?.raw,
      revenue: financialData.totalRevenue?.raw,
      earnings: financialData.ebitda?.raw,
      volume: price.regularMarketVolume?.raw || 0,
      dayHigh: price.regularMarketDayHigh?.raw || 0,
      dayLow: price.regularMarketDayLow?.raw || 0,
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw || 0,
      fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw || 0,
      metadata: {
        currency: price.currency,
        exchange: price.exchangeName,
        quoteType: price.quoteType
      }
    };
  }
}

// Alpha Vantage Provider
export class AlphaVantageProvider implements StockDataProvider {
  name = 'Alpha Vantage';
  priority = 2;
  private circuitBreaker: CircuitBreaker;
  private baseUrl = 'https://www.alphavantage.co/query';
  private apiKey: string;

  constructor(private logger: winston.Logger, apiKey: string) {
    this.apiKey = apiKey;
    this.circuitBreaker = new CircuitBreaker(
      'AlphaVantageProvider',
      this.logger,
      {
        failureThreshold: 3,
        resetTimeout: 300000, // 5 minutes (API has strict rate limits)
        monitoringPeriod: 600000 // 10 minutes
      }
    );
  }

  async isHealthy(): Promise<boolean> {
    return this.circuitBreaker.getState() !== CircuitState.OPEN && !!this.apiKey;
  }

  async fetchFundamentals(symbol: string): Promise<StockFundamentals> {
    return this.circuitBreaker.execute(async () => {
      try {
        // Fetch quote data
        const quoteResponse = await axios.get(this.baseUrl, {
          params: {
            function: 'GLOBAL_QUOTE',
            symbol,
            apikey: this.apiKey
          },
          timeout: 10000
        });

        // Fetch overview data
        const overviewResponse = await axios.get(this.baseUrl, {
          params: {
            function: 'OVERVIEW',
            symbol,
            apikey: this.apiKey
          },
          timeout: 10000
        });

        return this.parseAlphaVantageData(symbol, quoteResponse.data, overviewResponse.data);
      } catch (error) {
        this.logger.error('Alpha Vantage fetch error', { symbol, error });
        throw error;
      }
    });
  }

  async fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>> {
    const results = new Map<string, StockFundamentals>();
    
    // Alpha Vantage has very strict rate limits (5 calls/minute for free tier)
    const delay = 12000; // 12 seconds between calls

    for (const symbol of symbols) {
      try {
        const data = await this.fetchFundamentals(symbol);
        results.set(symbol, data);
      } catch (error) {
        this.logger.error(`Failed to fetch ${symbol}`, error);
      }

      if (symbols.indexOf(symbol) < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  private parseAlphaVantageData(symbol: string, quoteData: any, overviewData: any): StockFundamentals {
    const quote = quoteData['Global Quote'] || {};
    const overview = overviewData || {};

    return {
      symbol,
      date: new Date(),
      price: parseFloat(quote['05. price']) || 0,
      marketCap: parseFloat(overview.MarketCapitalization) || 0,
      forwardPE: parseFloat(overview.ForwardPE) || undefined,
      trailingPE: parseFloat(overview.TrailingPE) || undefined,
      forwardEPS: parseFloat(overview.ForwardAnnualDividendYield) || undefined,
      trailingEPS: parseFloat(overview.EPS) || undefined,
      revenue: parseFloat(overview.RevenueTTM) || undefined,
      earnings: parseFloat(overview.EBITDA) || undefined,
      volume: parseInt(quote['06. volume']) || 0,
      dayHigh: parseFloat(quote['03. high']) || 0,
      dayLow: parseFloat(quote['04. low']) || 0,
      fiftyTwoWeekHigh: parseFloat(overview['52WeekHigh']) || 0,
      fiftyTwoWeekLow: parseFloat(overview['52WeekLow']) || 0,
      metadata: {
        currency: 'USD',
        exchange: overview.Exchange,
        sector: overview.Sector,
        industry: overview.Industry
      }
    };
  }
}

// Main Stock Data Fetcher with fallback
export class StockDataFetcher {
  private providers: StockDataProvider[] = [];

  constructor(
    private logger: winston.Logger,
    providers?: StockDataProvider[]
  ) {
    if (providers) {
      this.providers = providers.sort((a, b) => a.priority - b.priority);
    } else {
      // Default providers
      this.providers = [
        new YahooFinanceProvider(logger),
        // Only add Alpha Vantage if API key is available
        ...(process.env.ALPHA_VANTAGE_API_KEY 
          ? [new AlphaVantageProvider(logger, process.env.ALPHA_VANTAGE_API_KEY)]
          : [])
      ];
    }
  }

  async fetchWithFallback(symbol: string): Promise<StockFundamentals> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      if (await provider.isHealthy()) {
        try {
          this.logger.info(`Fetching ${symbol} from ${provider.name}`);
          const data = await provider.fetchFundamentals(symbol);
          
          // Validate data
          if (this.isValidFundamentals(data)) {
            return data;
          } else {
            throw new Error('Invalid data received');
          }
        } catch (error) {
          this.logger.warn(`Provider ${provider.name} failed for ${symbol}`, error);
          errors.push(error as Error);
        }
      } else {
        this.logger.warn(`Provider ${provider.name} is unhealthy, skipping`);
      }
    }

    // All providers failed
    throw new Error(`All providers failed for ${symbol}: ${errors.map(e => e.message).join(', ')}`);
  }

  async fetchBulkWithFallback(symbols: string[]): Promise<Map<string, StockFundamentals>> {
    const results = new Map<string, StockFundamentals>();
    const failedSymbols: string[] = [];

    // Try bulk fetch with primary provider first
    const primaryProvider = this.providers[0];
    if (primaryProvider && await primaryProvider.isHealthy()) {
      try {
        const bulkResults = await primaryProvider.fetchBulkFundamentals(symbols);
        bulkResults.forEach((data, symbol) => {
          if (this.isValidFundamentals(data)) {
            results.set(symbol, data);
          } else {
            failedSymbols.push(symbol);
          }
        });
      } catch (error) {
        this.logger.error('Bulk fetch failed, falling back to individual fetches', error);
        failedSymbols.push(...symbols);
      }
    } else {
      failedSymbols.push(...symbols);
    }

    // Fetch failed symbols individually with fallback
    for (const symbol of failedSymbols) {
      try {
        const data = await this.fetchWithFallback(symbol);
        results.set(symbol, data);
      } catch (error) {
        this.logger.error(`Failed to fetch ${symbol} with all providers`, error);
      }
    }

    return results;
  }

  private isValidFundamentals(data: StockFundamentals): boolean {
    return !!(
      data &&
      data.symbol &&
      data.date &&
      data.price > 0 &&
      data.marketCap >= 0
    );
  }

  // Get provider health status
  async getProvidersHealth(): Promise<{ provider: string; healthy: boolean }[]> {
    const health = [];
    
    for (const provider of this.providers) {
      health.push({
        provider: provider.name,
        healthy: await provider.isHealthy()
      });
    }

    return health;
  }
}

export default StockDataFetcher;