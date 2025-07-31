import { Request, Response } from 'express';
import { polygonHttpService } from '@/services/polygon/polygon-http.service';
import { asyncHandler } from '@/middleware/error';
import { createContextLogger } from '@/utils/logger';

const logger = createContextLogger('StockScreenerController');

interface StockScreenerFilters {
  sector?: string;
  minPE?: number;
  maxPE?: number;
  minForwardPE?: number;
  maxForwardPE?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
}

export const stockScreenerController = {
  /**
   * Get undervalued NASDAQ stocks with filters
   */
  getUndervaluedStocks: asyncHandler(async (req: Request, res: Response) => {
    try {
      const filters: StockScreenerFilters = {
        sector: req.query.sector as string,
        minPE: req.query.minPE ? parseFloat(req.query.minPE as string) : undefined,
        maxPE: req.query.maxPE ? parseFloat(req.query.maxPE as string) : undefined,
        minForwardPE: req.query.minForwardPE ? parseFloat(req.query.minForwardPE as string) : undefined,
        maxForwardPE: req.query.maxForwardPE ? parseFloat(req.query.maxForwardPE as string) : undefined,
        minMarketCap: req.query.minMarketCap ? parseFloat(req.query.minMarketCap as string) : undefined,
        maxMarketCap: req.query.maxMarketCap ? parseFloat(req.query.maxMarketCap as string) : undefined,
      };

      logger.info('Fetching undervalued stocks with filters', filters);

      // Get NASDAQ stocks from Polygon HTTP Service
      const stocksResult = await polygonHttpService.getRealNasdaqStocks(50);
      
      if (!stocksResult.success || !stocksResult.data) {
        throw new Error('Failed to fetch NASDAQ stocks');
      }

      let stockData = stocksResult.data;
      logger.info(`Processing ${stockData.length} NASDAQ stocks`);

      // Apply filters
      let filteredStocks = stockData;

      if (filters.sector && filters.sector !== 'All Sectors') {
        filteredStocks = filteredStocks.filter(stock => 
          stock.sector.toLowerCase() === filters.sector!.toLowerCase()
        );
      }

      if (filters.minPE !== undefined) {
        filteredStocks = filteredStocks.filter(stock => stock.pe > 0 && stock.pe >= filters.minPE!);
      }

      if (filters.maxPE !== undefined) {
        filteredStocks = filteredStocks.filter(stock => stock.pe > 0 && stock.pe <= filters.maxPE!);
      }

      if (filters.minForwardPE !== undefined) {
        filteredStocks = filteredStocks.filter(stock => stock.forwardPE > 0 && stock.forwardPE >= filters.minForwardPE!);
      }

      if (filters.maxForwardPE !== undefined) {
        filteredStocks = filteredStocks.filter(stock => stock.forwardPE > 0 && stock.forwardPE <= filters.maxForwardPE!);
      }

      if (filters.minMarketCap !== undefined) {
        filteredStocks = filteredStocks.filter(stock => stock.marketCap >= filters.minMarketCap!);
      }

      if (filters.maxMarketCap !== undefined) {
        filteredStocks = filteredStocks.filter(stock => stock.marketCap <= filters.maxMarketCap!);
      }

      // Sort by value metrics (low P/E first, then by market cap)
      filteredStocks.sort((a, b) => {
        // First sort by P/E (lower is better)
        const aPE = a.pe > 0 ? a.pe : 999;
        const bPE = b.pe > 0 ? b.pe : 999;
        if (aPE !== bPE) return aPE - bPE;
        
        // Then by market cap (higher first)
        return b.marketCap - a.marketCap;
      });

      res.json({
        success: true,
        data: filteredStocks,
        meta: {
          total: filteredStocks.length,
          filters: filters
        }
      });
    } catch (error) {
      logger.error('Error in stock screener:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stock data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }),

  /**
   * Get list of sectors
   */
  getSectors: asyncHandler(async (req: Request, res: Response) => {
    try {
      const sectors = polygonHttpService.getSectors();

      res.json({
        success: true,
        data: sectors
      });
    } catch (error) {
      logger.error('Error fetching sectors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sectors'
      });
    }
  })
};