// Polygon.io Stock Data Fetcher - Primary data source for stock scanner
import axios from 'axios';
import { CircuitBreaker, CircuitState } from '../circuit-breaker/circuit-breaker';
import winston from 'winston';
import { StockFundamentals } from './stock-data-fetcher';

export interface PolygonStockQuote {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  active: boolean;
  currency_name: string;
  cik?: string;
  composite_figi?: string;
  share_class_figi?: string;
  last_updated_utc: string;
}

export interface PolygonFinancials {
  ticker: string;
  period: string;
  calendar_date: string;
  report_period: string;
  updated: string;
  financials: {
    balance_sheet?: any;
    cash_flow_statement?: any;
    income_statement?: {
      basic_earnings_per_share?: { value: number };
      diluted_earnings_per_share?: { value: number };
      revenues?: { value: number };
      net_income_loss?: { value: number };
    };
  };
}

export interface PolygonSnapshot {
  ticker: string;
  todaysChangePerc: number;
  todaysChange: number;
  updated: number;
  timeframe: string;
  market_status: string;
  fmv?: number;
  session?: {
    change: number;
    change_percent: number;
    early_trading_change: number;
    early_trading_change_percent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
    volume: number;
  };
  last_quote?: {
    last_updated: number;
    timeframe: string;
    bid: number;
    bid_size: number;
    ask: number;
    ask_size: number;
    exchange: number;
  };
  last_trade?: {
    conditions: number[];
    exchange: number;
    price: number;
    sip_timestamp: number;
    size: number;
    timeframe: string;
  };
  min?: {
    av: number;
    c: number;
    h: number;
    l: number;
    o: number;
    t: number;
    v: number;
    vw: number;
  };
  prevDay?: {
    c: number;
    h: number;
    l: number;
    o: number;
    v: number;
    vw: number;
  };
  value?: number;
}

export class PolygonStockFetcher {
  private apiKey: string;
  private baseUrl = 'https://api.polygon.io';
  private circuitBreaker: CircuitBreaker;
  private rateLimitDelay = 1000; // 1 second between requests for free tier

  constructor(private logger: winston.Logger, apiKey: string) {
    this.apiKey = apiKey;
    this.circuitBreaker = new CircuitBreaker(
      'PolygonStockFetcher',
      this.logger,
      {
        failureThreshold: 5,
        resetTimeout: 300000, // 5 minutes
        monitoringPeriod: 600000 // 10 minutes
      }
    );
  }

  async isHealthy(): Promise<boolean> {
    return this.circuitBreaker.getState() !== CircuitState.OPEN && !!this.apiKey;
  }

  /**
   * Fetch stock fundamentals using Polygon's snapshot and financials APIs
   */
  async fetchFundamentals(symbol: string): Promise<StockFundamentals> {
    return this.circuitBreaker.execute(async () => {
      try {
        // Get current snapshot data
        const snapshot = await this.fetchSnapshot(symbol);
        
        // Get latest financials (for EPS data)
        const financials = await this.fetchLatestFinancials(symbol);
        
        // Get forward earnings from our earnings calendar
        const forwardEarnings = await this.getForwardEarnings(symbol);

        return this.combineDataSources(symbol, snapshot, financials, forwardEarnings);
      } catch (error) {
        this.logger.error('Polygon fundamentals fetch error', { symbol, error });
        throw error;
      }
    });
  }

  /**
   * Fetch bulk fundamentals for multiple symbols
   */
  async fetchBulkFundamentals(symbols: string[]): Promise<Map<string, StockFundamentals>> {
    const results = new Map<string, StockFundamentals>();
    
    // Process in batches to respect rate limits
    const batchSize = 5;
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(symbol => 
        this.fetchFundamentals(symbol)
          .then(data => results.set(symbol, data))
          .catch(error => {
            this.logger.error(`Failed to fetch ${symbol}`, error);
            // Don't add to results if failed
          })
      );

      await Promise.all(batchPromises);
      
      // Rate limiting delay
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    return results;
  }

  /**
   * Fetch current market snapshot for a symbol
   */
  private async fetchSnapshot(symbol: string): Promise<PolygonSnapshot> {
    const url = `${this.baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`;
    
    const response = await axios.get(url, {
      params: { apikey: this.apiKey },
      timeout: 10000
    });

    if (response.data.status !== 'OK' || !response.data.results) {
      throw new Error(`Polygon snapshot error: ${response.data.status}`);
    }

    return response.data.results;
  }

  /**
   * Fetch latest financial data for EPS calculations
   */
  private async fetchLatestFinancials(symbol: string): Promise<PolygonFinancials | null> {
    try {
      const url = `${this.baseUrl}/vX/reference/financials`;
      
      const response = await axios.get(url, {
        params: {
          'ticker': symbol,
          'period': 'quarterly',
          'limit': 1,
          'sort': 'report_period',
          'order': 'desc',
          'apikey': this.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === 'OK' && response.data.results?.length > 0) {
        return response.data.results[0];
      }
      
      return null;
    } catch (error) {
      this.logger.warn(`Failed to fetch financials for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get forward earnings estimates from our earnings calendar
   */
  private async getForwardEarnings(symbol: string): Promise<{ eps_estimate: number; earnings_date: string } | null> {
    try {
      // This would integrate with your Supabase database
      // For now, return null - this should be implemented based on your database setup
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get forward earnings for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Combine data from different Polygon endpoints into StockFundamentals format
   */
  private combineDataSources(
    symbol: string, 
    snapshot: PolygonSnapshot, 
    financials: PolygonFinancials | null,
    forwardEarnings: { eps_estimate: number; earnings_date: string } | null
  ): StockFundamentals {
    // Extract current price and volume from snapshot
    const currentPrice = snapshot.last_trade?.price || snapshot.session?.close || 0;
    const volume = snapshot.session?.volume || snapshot.min?.v || 0;
    const dayHigh = snapshot.session?.high || snapshot.min?.h || currentPrice;
    const dayLow = snapshot.session?.low || snapshot.min?.l || currentPrice;
    const previousClose = snapshot.session?.previous_close || snapshot.prevDay?.c || currentPrice;

    // Extract EPS from financials
    let trailingEPS: number | undefined;
    let revenue: number | undefined;
    
    if (financials?.financials?.income_statement) {
      const income = financials.financials.income_statement;
      trailingEPS = income.diluted_earnings_per_share?.value || income.basic_earnings_per_share?.value;
      revenue = income.revenues?.value;
    }

    // Calculate forward P/E if we have forward EPS
    let forwardPE: number | undefined;
    let forwardEPS: number | undefined;
    
    if (forwardEarnings?.eps_estimate && currentPrice > 0) {
      forwardEPS = forwardEarnings.eps_estimate;
      forwardPE = currentPrice / forwardEPS;
    }

    // Calculate trailing P/E
    let trailingPE: number | undefined;
    if (trailingEPS && currentPrice > 0 && trailingEPS > 0) {
      trailingPE = currentPrice / trailingEPS;
    }

    // Estimate market cap (this would need shares outstanding from another endpoint)
    const estimatedShares = 1000000000; // Placeholder - should fetch actual shares outstanding
    const marketCap = currentPrice * estimatedShares;

    return {
      symbol,
      date: new Date(),
      price: currentPrice,
      marketCap,
      forwardPE,
      trailingPE,
      forwardEPS,
      trailingEPS,
      revenue,
      earnings: financials?.financials?.income_statement?.net_income_loss?.value,
      volume,
      dayHigh,
      dayLow,
      fiftyTwoWeekHigh: dayHigh, // Placeholder - would need historical data
      fiftyTwoWeekLow: dayLow,   // Placeholder - would need historical data
      metadata: {
        currency: 'USD',
        exchange: snapshot.market,
        lastUpdated: new Date(snapshot.updated).toISOString(),
        hasForwardEarnings: !!forwardEarnings,
        forwardEarningsDate: forwardEarnings?.earnings_date,
        dataSource: 'polygon'
      }
    };
  }

  /**
   * Get all available tickers (for building stock symbols list)
   */
  async fetchAllTickers(limit: number = 1000): Promise<PolygonStockQuote[]> {
    try {
      const url = `${this.baseUrl}/v3/reference/tickers`;
      
      const response = await axios.get(url, {
        params: {
          'market': 'stocks',
          'active': 'true',
          'limit': limit,
          'apikey': this.apiKey
        },
        timeout: 30000
      });

      if (response.data.status === 'OK' && response.data.results) {
        return response.data.results;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to fetch all tickers', error);
      throw error;
    }
  }

  /**
   * Get detailed company information
   */
  async fetchCompanyDetails(symbol: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/v3/reference/tickers/${symbol}`;
      
      const response = await axios.get(url, {
        params: { apikey: this.apiKey },
        timeout: 10000
      });

      if (response.data.status === 'OK' && response.data.results) {
        return response.data.results;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to fetch company details for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get provider health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; circuitState: string; apiKeyValid: boolean }> {
    return {
      healthy: await this.isHealthy(),
      circuitState: this.circuitBreaker.getState(),
      apiKeyValid: !!this.apiKey
    };
  }
}

export default PolygonStockFetcher;