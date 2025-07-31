import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/stock-logger';
import { CircuitBreaker } from '../circuit-breaker';
import { RetryManager, RetryConfig } from '../retry-manager';
import { cache } from '../cache';
import { Result } from '../../types';

const logger = new Logger('PolygonStockService');

// Types for Polygon API responses
export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  cik: string;
  composite_figi: string;
  share_class_figi: string;
  market_cap?: number;
  phone_number?: string;
  address?: {
    address1: string;
    city: string;
    state: string;
    postal_code: string;
  };
  description?: string;
  sic_code?: string;
  sic_description?: string;
  ticker_root?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
}

export interface PolygonFinancials {
  status: string;
  results: {
    ticker: string;
    period: string;
    calendar_date: string;
    financials: {
      income_statement?: {
        revenues?: {
          value: number;
          unit: string;
          label: string;
        };
        net_income?: {
          value: number;
          unit: string;
          label: string;
        };
        diluted_earnings_per_share?: {
          value: number;
          unit: string;
          label: string;
        };
      };
      balance_sheet?: {
        total_assets?: {
          value: number;
          unit: string;
          label: string;
        };
        total_liabilities?: {
          value: number;
          unit: string;
          label: string;
        };
        shareholders_equity?: {
          value: number;
          unit: string;
          label: string;
        };
      };
      cash_flow_statement?: {
        net_cash_flow?: {
          value: number;
          unit: string;
          label: string;
        };
      };
    };
  }[];
}

export interface PolygonSnapshot {
  status: string;
  ticker: {
    ticker: string;
    todaysChangePerc: number;
    todaysChange: number;
    updated: number;
    day: {
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw: number;
    };
    prevDay: {
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
      vw: number;
    };
  };
}

export interface StockScreenerData {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
  pe: number;
  forwardPE: number;
  currentRevenue: number;
  guidedRevenue: number;
  revenueGrowth: number;
  eps: number;
  forwardEps: number;
  priceToBook: number;
  debtToEquity: number;
}

export class PolygonStockService {
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
      name: 'polygon_stocks',
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    });

    this.retryManager = new RetryManager();
  }

  // Get list of NASDAQ stocks
  async getNasdaqStocks(limit: number = 1000): Promise<Result<PolygonTickerDetails[]>> {
    try {
      const cacheKey = `nasdaq_stocks:${limit}`;
      const cached = await cache.get<PolygonTickerDetails[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const response = await this.circuitBreaker.execute(async () => {
        return this.retryManager.executeWithRetry(async () => {
          return await this.apiClient.get('/v3/reference/tickers', {
            params: {
              apiKey: this.apiKey,
              market: 'stocks',
              exchange: 'XNAS', // NASDAQ
              active: true,
              limit: limit,
              sort: 'ticker',
              order: 'asc'
            }
          });
        }, this.retryConfig);
      });

      if (response.data.status !== 'OK') {
        return { success: false, error: new Error('Failed to fetch NASDAQ stocks') };
      }

      const stocks = response.data.results || [];
      
      // Cache for 1 hour
      await cache.set(cacheKey, stocks, 3600);

      logger.info(`Fetched ${stocks.length} NASDAQ stocks`);
      return { success: true, data: stocks };

    } catch (error) {
      logger.error('Failed to fetch NASDAQ stocks', error);
      return { success: false, error: error as Error };
    }
  }

  // Get detailed ticker info
  async getTickerDetails(symbol: string): Promise<Result<PolygonTickerDetails>> {
    try {
      const cacheKey = `ticker_details:${symbol}`;
      const cached = await cache.get<PolygonTickerDetails>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const response = await this.circuitBreaker.execute(async () => {
        return this.retryManager.executeWithRetry(async () => {
          return await this.apiClient.get(`/v3/reference/tickers/${symbol}`, {
            params: { apiKey: this.apiKey }
          });
        }, this.retryConfig);
      });

      if (response.data.status !== 'OK') {
        return { success: false, error: new Error(`Failed to fetch details for ${symbol}`) };
      }

      const details = response.data.results;
      
      // Cache for 24 hours
      await cache.set(cacheKey, details, 86400);

      return { success: true, data: details };

    } catch (error) {
      logger.error(`Failed to fetch ticker details for ${symbol}`, error);
      return { success: false, error: error as Error };
    }
  }

  // Get latest snapshot for a ticker
  async getSnapshot(symbol: string): Promise<Result<PolygonSnapshot>> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return this.retryManager.executeWithRetry(async () => {
          return await this.apiClient.get(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`, {
            params: { apiKey: this.apiKey }
          });
        }, this.retryConfig);
      });

      if (response.data.status !== 'OK') {
        return { success: false, error: new Error(`Failed to fetch snapshot for ${symbol}`) };
      }

      return { success: true, data: response.data };

    } catch (error: any) {
      // Handle authorization errors gracefully
      if (error.response?.data?.status === 'NOT_AUTHORIZED') {
        logger.warn(`Snapshot endpoint not available for ${symbol} - using fallback`);
        // Return a mock snapshot for now
        return {
          success: true,
          data: {
            status: 'OK',
            ticker: {
              ticker: symbol,
              todaysChangePerc: 0,
              todaysChange: 0,
              updated: Date.now(),
              day: {
                o: 0,
                h: 0,
                l: 0,
                c: 0,
                v: 0,
                vw: 0
              },
              prevDay: {
                o: 0,
                h: 0,
                l: 0,
                c: 0,
                v: 0,
                vw: 0
              }
            }
          }
        };
      }
      logger.error(`Failed to fetch snapshot for ${symbol}`, error);
      return { success: false, error: error as Error };
    }
  }

  // Get financials for a ticker
  async getFinancials(symbol: string): Promise<Result<PolygonFinancials>> {
    try {
      const cacheKey = `financials:${symbol}`;
      const cached = await cache.get<PolygonFinancials>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const response = await this.circuitBreaker.execute(async () => {
        return this.retryManager.executeWithRetry(async () => {
          return await this.apiClient.get('/vX/reference/financials', {
            params: {
              apiKey: this.apiKey,
              ticker: symbol,
              limit: 4, // Last 4 quarters
              timeframe: 'quarterly',
              order: 'desc'
            }
          });
        }, this.retryConfig);
      });

      if (response.data.status !== 'OK') {
        return { success: false, error: new Error(`Failed to fetch financials for ${symbol}`) };
      }

      // Cache for 24 hours
      await cache.set(cacheKey, response.data, 86400);

      return { success: true, data: response.data };

    } catch (error) {
      logger.error(`Failed to fetch financials for ${symbol}`, error);
      return { success: false, error: error as Error };
    }
  }

  // Get stock screener data for multiple symbols
  async getStockScreenerData(symbols: string[]): Promise<Result<StockScreenerData[]>> {
    try {
      const results: StockScreenerData[] = [];
      
      // Process in batches to avoid rate limiting
      const batchSize = 20;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (symbol) => {
          try {
            // Get ticker details
            const detailsResult = await this.getTickerDetails(symbol);
            if (!detailsResult.success || !detailsResult.data) return null;
            
            // Get snapshot for current price (may return mock data if not authorized)
            const snapshotResult = await this.getSnapshot(symbol);
            if (!snapshotResult.success || !snapshotResult.data) return null;
            
            // Get financials
            const financialsResult = await this.getFinancials(symbol);
            
            const details = detailsResult.data;
            const snapshot = snapshotResult.data.ticker;
            const financials = financialsResult.success ? financialsResult.data : null;
            
            // Calculate metrics from available data
            const latestQuarter = financials?.results?.[0];
            const previousQuarter = financials?.results?.[1];
            
            const currentRevenue = latestQuarter?.financials?.income_statement?.revenues?.value || 0;
            const previousRevenue = previousQuarter?.financials?.income_statement?.revenues?.value || 0;
            const revenueGrowth = previousRevenue > 0 ? (currentRevenue - previousRevenue) / previousRevenue : 0;
            
            const eps = latestQuarter?.financials?.income_statement?.diluted_earnings_per_share?.value || 0;
            const price = snapshot.day.c;
            const pe = eps > 0 ? price / (eps * 4) : 0; // Annualized P/E
            
            // For forward P/E and other forward-looking metrics, we'd need analyst estimates
            // which are not available in basic Polygon API
            const forwardPE = pe * 0.9; // Placeholder: assume 10% earnings growth
            const forwardEps = eps * 1.1;
            const guidedRevenue = currentRevenue * 1.05; // Placeholder: assume 5% revenue growth
            
            // Calculate price-to-book
            const totalAssets = latestQuarter?.financials?.balance_sheet?.total_assets?.value || 0;
            const totalLiabilities = latestQuarter?.financials?.balance_sheet?.total_liabilities?.value || 0;
            const bookValue = totalAssets - totalLiabilities;
            const sharesOutstanding = details.market_cap && price > 0 ? details.market_cap / price : 0;
            const bookValuePerShare = sharesOutstanding > 0 ? bookValue / sharesOutstanding : 0;
            const priceToBook = bookValuePerShare > 0 ? price / bookValuePerShare : 0;
            
            // Calculate debt-to-equity
            const equity = latestQuarter?.financials?.balance_sheet?.shareholders_equity?.value || 0;
            const debtToEquity = equity > 0 ? totalLiabilities / equity : 0;
            
            const stockData: StockScreenerData = {
              symbol: symbol,
              name: details.name,
              sector: details.sic_description || 'Unknown',
              industry: details.sic_description || 'Unknown',
              marketCap: details.market_cap || 0,
              price: price,
              pe: pe,
              forwardPE: forwardPE,
              currentRevenue: currentRevenue,
              guidedRevenue: guidedRevenue,
              revenueGrowth: revenueGrowth,
              eps: eps,
              forwardEps: forwardEps,
              priceToBook: priceToBook,
              debtToEquity: debtToEquity
            };
            
            return stockData;
            
          } catch (error) {
            logger.error(`Failed to process ${symbol}`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(r => r !== null) as StockScreenerData[]);
        
        // Rate limiting: wait between batches
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      logger.info(`Fetched screener data for ${results.length} stocks`);
      return { success: true, data: results };
      
    } catch (error) {
      logger.error('Failed to fetch stock screener data', error);
      return { success: false, error: error as Error };
    }
  }

  // Get sectors list
  async getSectors(): Promise<string[]> {
    // Polygon doesn't have a direct sectors endpoint, so we'll use a predefined list
    return [
      'Technology',
      'Healthcare',
      'Financials',
      'Consumer Discretionary',
      'Communication Services',
      'Industrials',
      'Consumer Staples',
      'Energy',
      'Utilities',
      'Real Estate',
      'Materials'
    ];
  }
}

// Export singleton instance
export const polygonStockService = new PolygonStockService();