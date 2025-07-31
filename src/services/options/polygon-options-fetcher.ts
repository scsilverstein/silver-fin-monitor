import axios, { AxiosInstance } from 'axios';
import { db } from '../database';
import { Logger } from '../../utils/stock-logger';
import { CircuitBreaker } from '../circuit-breaker';
import { RetryManager, RetryConfig } from '../retry-manager';
import { cache } from '../cache';
import { Result } from '../../types';

const logger = new Logger('PolygonOptionsFetcher');

// Types for Polygon API responses
interface PolygonOptionsContract {
  ticker: string;
  underlying_ticker: string;
  contract_type: 'call' | 'put';
  strike_price: number;
  expiration_date: string;
  shares_per_contract: number;
  exercise_style: 'american' | 'european';
}

interface PolygonOptionsQuote {
  ticker: string;
  bid: number;
  ask: number;
  last: number;
  bid_size: number;
  ask_size: number;
  volume: number;
  open_interest: number;
  implied_volatility?: number;
  underlying_price?: number;
  timestamp: number;
}

interface PolygonOptionsChain {
  status: string;
  results: PolygonOptionsContract[];
  next_url?: string;
}

interface PolygonGreeks {
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  implied_volatility?: number;
}

interface PolygonOptionsSnapshot {
  status: string;
  results: {
    ticker: string;
    details: PolygonOptionsContract;
    last_quote: PolygonOptionsQuote;
    greeks?: PolygonGreeks;
  }[];
}

export interface OptionsDataPoint {
  contractId: string;
  bid: number;
  ask: number;
  lastPrice: number;
  markPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  underlyingPrice: number;
  timestamp: Date;
}

export class PolygonOptionsFetcher {
  private apiClient: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private retryManager: RetryManager;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.polygon.io';
  
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    backoff: 'exponential',
    delay: 1000,
    maxDelay: 30000
  };

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('POLYGON_API_KEY not configured');
    }

    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.circuitBreaker = new CircuitBreaker({
      name: 'polygon_options',
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    });

    this.retryManager = new RetryManager();
  }

  // Fetch options chain for a specific underlying symbol
  async fetchOptionsChain(
    symbol: string,
    expirationDate?: string,
    strikePrice?: number
  ): Promise<Result<PolygonOptionsContract[]>> {
    return this.circuitBreaker.execute(async () => {
      return this.retryManager.executeWithRetry(async () => {
        try {
          const params: any = {
            apiKey: this.apiKey,
            underlying_ticker: symbol,
            limit: 1000
          };

          if (expirationDate) {
            params.expiration_date = expirationDate;
          }
          if (strikePrice) {
            params.strike_price = strikePrice;
          }

          const response = await this.apiClient.get<PolygonOptionsChain>(
            `/v3/reference/options/contracts`,
            { params }
          );

          if (response.data.status !== 'OK') {
            throw new Error(`Polygon API error: ${response.data.status}`);
          }

          // Handle pagination if needed
          let allContracts = response.data.results || [];
          let nextUrl = response.data.next_url;

          while (nextUrl && allContracts.length < 5000) { // Limit to prevent excessive calls
            const nextResponse = await this.apiClient.get<PolygonOptionsChain>(nextUrl);
            if (nextResponse.data.results) {
              allContracts = [...allContracts, ...nextResponse.data.results];
            }
            nextUrl = nextResponse.data.next_url;
          }

          logger.info(`Fetched ${allContracts.length} options contracts for ${symbol}`);
          return { success: true, data: allContracts };

        } catch (error) {
          logger.error(`Failed to fetch options chain for ${symbol}`, error);
          return { success: false, error: error as Error };
        }
      }, this.retryConfig);
    });
  }

  // Fetch real-time quotes for multiple option contracts
  async fetchOptionsQuotes(contractSymbols: string[]): Promise<Map<string, OptionsDataPoint>> {
    const results = new Map<string, OptionsDataPoint>();
    
    // Batch requests to avoid rate limiting (Polygon allows 5 requests/second on basic tier)
    const batchSize = 100;
    
    for (let i = 0; i < contractSymbols.length; i += batchSize) {
      const batch = contractSymbols.slice(i, i + batchSize);
      
      try {
        const response = await this.circuitBreaker.execute(async () => {
          return this.retryManager.executeWithRetry(async () => {
            return await this.apiClient.get<PolygonOptionsSnapshot>(
              `/v3/snapshot/options/${batch.join(',')}`,
              { params: { apiKey: this.apiKey } }
            );
          }, this.retryConfig);
        });

        if (response.data.status === 'OK' && response.data.results) {
          for (const result of response.data.results) {
            const quote = result.last_quote;
            const greeks = result.greeks;
            
            const dataPoint: OptionsDataPoint = {
              contractId: result.ticker,
              bid: quote.bid,
              ask: quote.ask,
              lastPrice: quote.last,
              markPrice: (quote.bid + quote.ask) / 2,
              volume: quote.volume,
              openInterest: quote.open_interest,
              impliedVolatility: quote.implied_volatility || greeks?.implied_volatility,
              delta: greeks?.delta,
              gamma: greeks?.gamma,
              theta: greeks?.theta,
              vega: greeks?.vega,
              rho: greeks?.rho,
              underlyingPrice: quote.underlying_price || 0,
              timestamp: new Date(quote.timestamp)
            };
            
            results.set(result.ticker, dataPoint);
          }
        }
        
        // Rate limiting: wait 200ms between batches (5 requests/second)
        if (i + batchSize < contractSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        logger.error(`Failed to fetch quotes for batch starting at ${i}`, error);
      }
    }
    
    return results;
  }

  // Fetch historical options data for analysis
  async fetchHistoricalOptionsData(
    contractSymbol: string,
    from: Date,
    to: Date
  ): Promise<Result<OptionsDataPoint[]>> {
    try {
      const cacheKey = `options_historical:${contractSymbol}:${from.toISOString()}:${to.toISOString()}`;
      const cached = await cache.get<OptionsDataPoint[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const response = await this.circuitBreaker.execute(async () => {
        return this.retryManager.executeWithRetry(async () => {
          return await this.apiClient.get(`/v2/aggs/ticker/${contractSymbol}/range/1/day/${from.toISOString().split('T')[0]}/${to.toISOString().split('T')[0]}`, {
            params: {
              apiKey: this.apiKey,
              adjusted: true,
              sort: 'asc'
            }
          });
        }, this.retryConfig);
      });

      if (response.data.status !== 'OK') {
        return { success: false, error: new Error('Failed to fetch historical data') };
      }

      const historicalData: OptionsDataPoint[] = response.data.results.map((bar: any) => ({
        contractId: contractSymbol,
        bid: bar.c, // Using close as approximation
        ask: bar.c,
        lastPrice: bar.c,
        markPrice: bar.c,
        volume: bar.v,
        openInterest: 0, // Not available in aggregates
        underlyingPrice: 0, // Would need separate call
        timestamp: new Date(bar.t)
      }));

      // Cache for 24 hours
      await cache.set(cacheKey, historicalData, 86400);

      return { success: true, data: historicalData };

    } catch (error) {
      logger.error(`Failed to fetch historical data for ${contractSymbol}`, error);
      return { success: false, error: error as Error };
    }
  }

  // Store options contracts in database
  async storeOptionsContracts(contracts: PolygonOptionsContract[]): Promise<Result<number>> {
    try {
      let stored = 0;

      for (const contract of contracts) {
        // Get symbol ID
        const { data: symbolData } = await db.getClient()
          .from('stock_symbols')
          .select('id')
          .eq('symbol', contract.underlying_ticker)
          .single();

        if (!symbolData) {
          logger.warn(`Symbol ${contract.underlying_ticker} not found in database`);
          continue;
        }

        // Insert or update contract
        const { error } = await db.getClient()
          .from('options_contracts')
          .upsert({
            symbol_id: symbolData.id,
            contract_symbol: contract.ticker,
            option_type: contract.contract_type,
            strike_price: contract.strike_price,
            expiration_date: contract.expiration_date,
            multiplier: contract.shares_per_contract || 100,
            exercise_style: contract.exercise_style || 'american',
            is_active: true,
            metadata: {
              polygon_ticker: contract.ticker,
              last_sync: new Date().toISOString()
            }
          }, {
            onConflict: 'contract_symbol'
          });

        if (!error) {
          stored++;
        } else {
          logger.error(`Failed to store contract ${contract.ticker}`, error);
        }
      }

      logger.info(`Stored ${stored} options contracts`);
      return { success: true, data: stored };

    } catch (error) {
      logger.error('Failed to store options contracts', error);
      return { success: false, error: error as Error };
    }
  }

  // Store market data in database
  async storeMarketData(data: Map<string, OptionsDataPoint>): Promise<Result<number>> {
    try {
      let stored = 0;

      for (const [contractSymbol, dataPoint] of data.entries()) {
        // Get contract ID
        const { data: contractData } = await db.getClient()
          .from('options_contracts')
          .select('id')
          .eq('contract_symbol', contractSymbol)
          .single();

        if (!contractData) {
          logger.warn(`Contract ${contractSymbol} not found in database`);
          continue;
        }

        // Insert market data
        const { error } = await db.getClient()
          .from('options_market_data')
          .insert({
            contract_id: contractData.id,
            data_timestamp: dataPoint.timestamp,
            bid: dataPoint.bid,
            ask: dataPoint.ask,
            last_price: dataPoint.lastPrice,
            mark_price: dataPoint.markPrice,
            volume: dataPoint.volume,
            open_interest: dataPoint.openInterest,
            implied_volatility: dataPoint.impliedVolatility,
            delta: dataPoint.delta,
            gamma: dataPoint.gamma,
            theta: dataPoint.theta,
            vega: dataPoint.vega,
            rho: dataPoint.rho,
            underlying_price: dataPoint.underlyingPrice,
            data_source: 'polygon'
          });

        if (!error) {
          stored++;
        } else {
          logger.error(`Failed to store market data for ${contractSymbol}`, error);
        }
      }

      logger.info(`Stored market data for ${stored} contracts`);
      return { success: true, data: stored };

    } catch (error) {
      logger.error('Failed to store market data', error);
      return { success: false, error: error as Error };
    }
  }

  // Fetch options for tech stocks specifically
  async fetchTechStockOptions(
    minDaysToExpiration: number = 7,
    maxDaysToExpiration: number = 90
  ): Promise<Result<Map<string, PolygonOptionsContract[]>>> {
    try {
      // Get active tech stocks from database
      const { data: techStocks } = await db.getClient()
        .from('tech_stock_universe')
        .select('symbol_id, stock_symbols!inner(symbol)')
        .eq('is_active', true)
        .order('scan_priority', { ascending: false })
        .limit(50); // Start with top 50 tech stocks

      if (!techStocks || techStocks.length === 0) {
        return { success: false, error: new Error('No tech stocks found in universe') };
      }

      const results = new Map<string, PolygonOptionsContract[]>();
      const today = new Date();
      const minExpiration = new Date(today.getTime() + minDaysToExpiration * 24 * 60 * 60 * 1000);
      const maxExpiration = new Date(today.getTime() + maxDaysToExpiration * 24 * 60 * 60 * 1000);

      for (const stock of techStocks) {
        const symbol = stock.stock_symbols.symbol;
        logger.info(`Fetching options for tech stock: ${symbol}`);

        const chainResult = await this.fetchOptionsChain(symbol);
        
        if (chainResult.success && chainResult.data) {
          // Filter contracts by expiration date
          const filteredContracts = chainResult.data.filter(contract => {
            const expDate = new Date(contract.expiration_date);
            return expDate >= minExpiration && expDate <= maxExpiration;
          });

          if (filteredContracts.length > 0) {
            results.set(symbol, filteredContracts);
          }
        }

        // Rate limiting between symbols
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`Fetched options for ${results.size} tech stocks`);
      return { success: true, data: results };

    } catch (error) {
      logger.error('Failed to fetch tech stock options', error);
      return { success: false, error: error as Error };
    }
  }

  // Check API health
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/v1/marketstatus/now', {
        params: { apiKey: this.apiKey }
      });
      return response.data.status === 'OK';
    } catch (error) {
      logger.error('Health check failed', error);
      return false;
    }
  }
}