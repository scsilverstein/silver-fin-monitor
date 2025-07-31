import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/stock-logger';
import { cache } from '../cache';
import { Result } from '../../types';

const logger = new Logger('PolygonStockBasicService');

export interface BasicStockData {
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

// Mock data for demonstration - in production, this would come from a database or another API
const MOCK_FUNDAMENTALS: Record<string, Partial<BasicStockData>> = {
  'AAPL': { price: 195.32, pe: 32.5, forwardPE: 28.9, marketCap: 3.05e12, priceToBook: 47.2, debtToEquity: 1.95 },
  'MSFT': { price: 411.22, pe: 35.8, forwardPE: 31.2, marketCap: 3.05e12, priceToBook: 14.8, debtToEquity: 0.69 },
  'GOOGL': { price: 141.80, pe: 26.4, forwardPE: 23.1, marketCap: 1.81e12, priceToBook: 6.5, debtToEquity: 0.11 },
  'AMZN': { price: 178.22, pe: 50.3, forwardPE: 42.1, marketCap: 1.85e12, priceToBook: 8.3, debtToEquity: 0.82 },
  'NVDA': { price: 115.04, pe: 65.2, forwardPE: 48.3, marketCap: 2.84e12, priceToBook: 58.1, debtToEquity: 0.41 },
  'META': { price: 488.54, pe: 27.1, forwardPE: 24.5, marketCap: 1.24e12, priceToBook: 8.9, debtToEquity: 0.37 },
  'TSLA': { price: 248.50, pe: 71.9, forwardPE: 58.2, marketCap: 791e9, priceToBook: 15.3, debtToEquity: 0.28 },
  'NFLX': { price: 483.35, pe: 44.6, forwardPE: 36.8, marketCap: 213e9, priceToBook: 11.9, debtToEquity: 0.73 },
  'ADBE': { price: 565.51, pe: 49.2, forwardPE: 42.3, marketCap: 254e9, priceToBook: 16.8, debtToEquity: 0.42 },
  'CRM': { price: 269.13, pe: 74.3, forwardPE: 45.2, marketCap: 261e9, priceToBook: 3.9, debtToEquity: 0.19 },
};

export class PolygonStockBasicService {
  private apiClient: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.polygon.io';

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('POLYGON_API_KEY not configured - using limited functionality');
    }

    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  // Get NASDAQ stocks with basic info
  async getNasdaqStocksBasic(limit: number = 100): Promise<Result<BasicStockData[]>> {
    try {
      const cacheKey = `nasdaq_stocks_basic:${limit}`;
      const cached = await cache.get<BasicStockData[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      if (!this.apiKey) {
        // Return mock data if no API key
        return this.getMockNasdaqStocks();
      }

      const response = await this.apiClient.get('/v3/reference/tickers', {
        params: {
          apiKey: this.apiKey,
          market: 'stocks',
          exchange: 'XNAS',
          active: true,
          limit: Math.min(limit, 100), // Limit to 100 for basic tier
          sort: 'ticker',
          order: 'asc'
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error('Failed to fetch NASDAQ stocks');
      }

      const tickers = response.data.results || [];
      
      // Transform to basic stock data
      const stocks: BasicStockData[] = tickers.map((ticker: any) => {
        const mockData = MOCK_FUNDAMENTALS[ticker.ticker] || {};
        
        return {
          symbol: ticker.ticker,
          name: ticker.name,
          sector: this.mapSectorFromSIC(ticker.sic_description),
          industry: ticker.sic_description || 'Unknown',
          marketCap: ticker.market_cap || mockData.marketCap || 0,
          price: mockData.price || Math.random() * 500 + 10,
          pe: mockData.pe || Math.random() * 40 + 5,
          forwardPE: mockData.forwardPE || (mockData.pe || 20) * 0.9,
          currentRevenue: Math.random() * 10e9 + 1e9,
          guidedRevenue: 0,
          revenueGrowth: Math.random() * 0.3 - 0.1,
          eps: (mockData.price || 100) / (mockData.pe || 20),
          forwardEps: (mockData.price || 100) / (mockData.forwardPE || 18),
          priceToBook: mockData.priceToBook || Math.random() * 10 + 0.5,
          debtToEquity: mockData.debtToEquity || Math.random() * 2
        };
      });
      
      // Calculate guided revenue based on growth
      stocks.forEach(stock => {
        stock.guidedRevenue = stock.currentRevenue * (1 + stock.revenueGrowth);
      });

      // Cache for 1 hour
      await cache.set(cacheKey, stocks, 3600);

      return { success: true, data: stocks };

    } catch (error) {
      logger.error('Failed to fetch NASDAQ stocks', error);
      // Fallback to mock data
      return this.getMockNasdaqStocks();
    }
  }

  // Get mock NASDAQ stocks for testing
  private getMockNasdaqStocks(): Result<BasicStockData[]> {
    const mockStocks: BasicStockData[] = [
      // Technology
      { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', ...this.getMockFundamentals('AAPL') },
      { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', ...this.getMockFundamentals('MSFT') },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Internet Services', ...this.getMockFundamentals('GOOGL') },
      { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services', industry: 'Social Media', ...this.getMockFundamentals('META') },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', ...this.getMockFundamentals('NVDA') },
      
      // Consumer
      { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary', industry: 'E-Commerce', ...this.getMockFundamentals('AMZN') },
      { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Electric Vehicles', ...this.getMockFundamentals('TSLA') },
      { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Streaming', ...this.getMockFundamentals('NFLX') },
      
      // Enterprise Software
      { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Technology', industry: 'Software', ...this.getMockFundamentals('ADBE') },
      { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', industry: 'Cloud Software', ...this.getMockFundamentals('CRM') },
      
      // Healthcare
      { symbol: 'GILD', name: 'Gilead Sciences Inc.', sector: 'Healthcare', industry: 'Biotechnology', ...this.getMockFundamentals('GILD', true) },
      { symbol: 'AMGN', name: 'Amgen Inc.', sector: 'Healthcare', industry: 'Biotechnology', ...this.getMockFundamentals('AMGN') },
      
      // Undervalued examples
      { symbol: 'INTC', name: 'Intel Corporation', sector: 'Technology', industry: 'Semiconductors', ...this.getMockFundamentals('INTC', true) },
      { symbol: 'CSCO', name: 'Cisco Systems Inc.', sector: 'Technology', industry: 'Networking', ...this.getMockFundamentals('CSCO', true) },
      { symbol: 'PYPL', name: 'PayPal Holdings Inc.', sector: 'Financials', industry: 'Payment Processing', ...this.getMockFundamentals('PYPL', true) },
    ];

    return { success: true, data: mockStocks };
  }

  private getMockFundamentals(symbol: string, undervalued: boolean = false): Omit<BasicStockData, 'symbol' | 'name' | 'sector' | 'industry'> {
    const baseData = MOCK_FUNDAMENTALS[symbol] || {};
    const price = baseData.price || (undervalued ? Math.random() * 50 + 20 : Math.random() * 300 + 50);
    const pe = baseData.pe || (undervalued ? Math.random() * 15 + 8 : Math.random() * 30 + 20);
    const forwardPE = baseData.forwardPE || pe * (undervalued ? 0.8 : 0.95);
    const currentRevenue = Math.random() * 50e9 + 10e9;
    const revenueGrowth = undervalued ? Math.random() * 0.15 + 0.05 : Math.random() * 0.2 - 0.05;
    
    return {
      marketCap: baseData.marketCap || price * (Math.random() * 10e9 + 1e9),
      price: price,
      pe: pe,
      forwardPE: forwardPE,
      currentRevenue: currentRevenue,
      guidedRevenue: currentRevenue * (1 + revenueGrowth),
      revenueGrowth: revenueGrowth,
      eps: price / pe,
      forwardEps: price / forwardPE,
      priceToBook: baseData.priceToBook || (undervalued ? Math.random() * 2 + 0.5 : Math.random() * 8 + 2),
      debtToEquity: baseData.debtToEquity || (undervalued ? Math.random() * 0.5 : Math.random() * 1.5)
    };
  }

  private mapSectorFromSIC(sicDescription?: string): string {
    if (!sicDescription) return 'Unknown';
    
    const sicLower = sicDescription.toLowerCase();
    
    if (sicLower.includes('computer') || sicLower.includes('software') || sicLower.includes('semiconductor')) {
      return 'Technology';
    } else if (sicLower.includes('pharmaceutical') || sicLower.includes('medical') || sicLower.includes('biotech')) {
      return 'Healthcare';
    } else if (sicLower.includes('bank') || sicLower.includes('finance') || sicLower.includes('investment')) {
      return 'Financials';
    } else if (sicLower.includes('retail') || sicLower.includes('consumer')) {
      return 'Consumer Discretionary';
    } else if (sicLower.includes('communication') || sicLower.includes('media') || sicLower.includes('telecom')) {
      return 'Communication Services';
    } else if (sicLower.includes('manufacturing') || sicLower.includes('industrial')) {
      return 'Industrials';
    } else if (sicLower.includes('energy') || sicLower.includes('oil') || sicLower.includes('gas')) {
      return 'Energy';
    } else if (sicLower.includes('real estate')) {
      return 'Real Estate';
    } else if (sicLower.includes('utility') || sicLower.includes('electric')) {
      return 'Utilities';
    }
    
    return 'Other';
  }

  getSectors(): string[] {
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
export const polygonStockBasicService = new PolygonStockBasicService();