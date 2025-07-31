import { Request, Response } from 'express';
import { db } from '../services/database';
import { Logger } from '../utils/stock-logger';
import { cache } from '../services/cache';
import { OptionsScannerService } from '../services/options/options-scanner-service';
import { OptionsAnalysisEngine, ScanCriteria } from '../services/options/options-analysis-engine';
import { PolygonOptionsFetcher } from '../services/options/polygon-options-fetcher';
import { QueueService } from '../services/queue.service';

const logger = new Logger('OptionsController');

export class OptionsController {
  private scannerService: OptionsScannerService;
  private analysisEngine: OptionsAnalysisEngine;
  private polygonFetcher: PolygonOptionsFetcher;

  constructor(private queueService: QueueService) {
    this.scannerService = new OptionsScannerService(queueService);
    this.analysisEngine = new OptionsAnalysisEngine();
    this.polygonFetcher = new PolygonOptionsFetcher();
  }

  // Initialize tech stock universe
  initializeTechUniverse = async (req: Request, res: Response) => {
    try {
      const result = await this.scannerService.initializeTechStockUniverse();
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error?.message || 'Failed to initialize tech universe'
        });
      }

      res.json({
        success: true,
        data: {
          stocksAdded: result.data,
          message: 'Tech stock universe initialized successfully'
        }
      });
    } catch (error) {
      logger.error('Failed to initialize tech universe', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };

  // Get latest scanner results
  getLatestScanResults = async (req: Request, res: Response) => {
    try {
      // Check cache first
      const cached = await cache.get('tech_options_scan:latest');
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          cached: true
        });
      }

      // Get from database
      const { data: results, error } = await db.getClient()
        .from('v_tech_options_opportunities')
        .select('*')
        .limit(50);

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: {
          opportunities: results || [],
          scanDate: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get scan results', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve scan results'
      });
    }
  };

  // Run tech options scan
  runTechOptionsScan = async (req: Request, res: Response) => {
    try {
      // Queue the scan job
      await this.scannerService.queueScanJob();

      res.json({
        success: true,
        data: {
          message: 'Tech options scan queued successfully',
          jobId: Date.now().toString()
        }
      });
    } catch (error) {
      logger.error('Failed to queue scan', error);
      res.status(500).json({
        success: false,
        error: 'Failed to queue scan job'
      });
    }
  };

  // Get options chain for a symbol
  getOptionsChain = async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const { expiration, minStrike, maxStrike } = req.query;

      // Validate symbol exists in tech universe
      const { data: techStock } = await db.getClient()
        .from('tech_stock_universe')
        .select('*, stock_symbols!inner(symbol)')
        .eq('stock_symbols.symbol', symbol)
        .single();

      if (!techStock) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found in tech stock universe'
        });
      }

      // Check cache
      const cacheKey = `options_chain:${symbol}:${expiration || 'all'}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          cached: true
        });
      }

      // Fetch from database or API
      const { data: contracts, error } = await db.getClient()
        .from('options_contracts')
        .select(`
          *,
          options_market_data!inner(
            bid,
            ask,
            last_price,
            volume,
            open_interest,
            implied_volatility,
            delta,
            gamma,
            theta,
            vega
          )
        `)
        .eq('symbol_id', techStock.symbol_id)
        .eq('is_active', true)
        .order('expiration_date')
        .order('strike_price');

      if (error) {
        throw error;
      }

      // Group by expiration
      const chain = this.groupOptionsByExpiration(contracts || []);

      // Cache for 15 minutes
      await cache.set(cacheKey, chain, 900);

      res.json({
        success: true,
        data: {
          symbol,
          techCategory: techStock.tech_category,
          chain
        }
      });
    } catch (error) {
      logger.error('Failed to get options chain', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve options chain'
      });
    }
  };

  // Analyze specific option contract
  analyzeOption = async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;

      // Get contract details
      const { data: contract, error: contractError } = await db.getClient()
        .from('options_contracts')
        .select(`
          *,
          stock_symbols!inner(symbol)
        `)
        .eq('id', contractId)
        .single();

      if (contractError || !contract) {
        return res.status(404).json({
          success: false,
          error: 'Contract not found'
        });
      }

      // Get latest market data
      const { data: marketData, error: marketError } = await db.getClient()
        .from('options_market_data')
        .select('*')
        .eq('contract_id', contractId)
        .order('data_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (marketError || !marketData) {
        return res.status(404).json({
          success: false,
          error: 'No market data available for contract'
        });
      }

      // Prepare contract object for analysis
      const optionContract = {
        id: contract.id,
        symbolId: contract.symbol_id,
        symbol: contract.stock_symbols.symbol,
        optionType: contract.option_type,
        strikePrice: contract.strike_price,
        expirationDate: new Date(contract.expiration_date),
        daysToExpiration: Math.floor(
          (new Date(contract.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      };

      // Prepare market data
      const marketDataObj = {
        contractId: contract.id,
        bid: marketData.bid,
        ask: marketData.ask,
        lastPrice: marketData.last_price,
        markPrice: marketData.mark_price,
        volume: marketData.volume,
        openInterest: marketData.open_interest,
        impliedVolatility: marketData.implied_volatility,
        delta: marketData.delta,
        gamma: marketData.gamma,
        theta: marketData.theta,
        vega: marketData.vega,
        rho: marketData.rho,
        underlyingPrice: marketData.underlying_price
      };

      // Run analysis
      const analysisResult = await this.analysisEngine.analyzeOption(
        optionContract,
        marketDataObj
      );

      if (!analysisResult.success) {
        return res.status(500).json({
          success: false,
          error: analysisResult.error?.message || 'Analysis failed'
        });
      }

      res.json({
        success: true,
        data: {
          contract: optionContract,
          marketData: marketDataObj,
          analysis: analysisResult.data
        }
      });
    } catch (error) {
      logger.error('Failed to analyze option', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze option'
      });
    }
  };

  // Search options by criteria
  searchOptions = async (req: Request, res: Response) => {
    try {
      const criteria: ScanCriteria = {
        minVolume: parseInt(req.query.minVolume as string) || undefined,
        minOpenInterest: parseInt(req.query.minOpenInterest as string) || undefined,
        maxSpreadRatio: parseFloat(req.query.maxSpreadRatio as string) || undefined,
        minDaysToExpiration: parseInt(req.query.minDTE as string) || undefined,
        maxDaysToExpiration: parseInt(req.query.maxDTE as string) || undefined,
        minIVRank: parseFloat(req.query.minIVRank as string) || undefined,
        maxIVRank: parseFloat(req.query.maxIVRank as string) || undefined,
        minValueScore: parseFloat(req.query.minValueScore as string) || undefined,
        techCategoriesOnly: req.query.techOnly === 'true'
      };

      const scanResult = await this.analysisEngine.scanOptions(criteria);

      if (!scanResult.success) {
        return res.status(500).json({
          success: false,
          error: scanResult.error?.message || 'Scan failed'
        });
      }

      res.json({
        success: true,
        data: {
          count: scanResult.data?.length || 0,
          options: scanResult.data || []
        }
      });
    } catch (error) {
      logger.error('Failed to search options', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search options'
      });
    }
  };

  // Get unusual options activity
  getUnusualActivity = async (req: Request, res: Response) => {
    try {
      const { data: unusual, error } = await db.getClient()
        .from('options_scanner_results')
        .select(`
          *,
          options_contracts!inner(
            contract_symbol,
            option_type,
            strike_price,
            expiration_date
          ),
          stock_symbols!inner(symbol, name)
        `)
        .eq('is_unusual_activity', true)
        .gte('scan_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('volume', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: {
          count: unusual?.length || 0,
          unusualActivity: unusual || []
        }
      });
    } catch (error) {
      logger.error('Failed to get unusual activity', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve unusual activity'
      });
    }
  };

  // Get top value opportunities
  getValueOpportunities = async (req: Request, res: Response) => {
    try {
      const minScore = parseFloat(req.query.minScore as string) || 70;

      const { data: opportunities, error } = await db.getClient()
        .from('options_scanner_results')
        .select(`
          *,
          options_contracts!inner(
            contract_symbol,
            option_type,
            strike_price,
            expiration_date
          ),
          stock_symbols!inner(symbol, name, sector)
        `)
        .gte('value_score', minScore)
        .eq('stock_symbols.sector', 'Technology')
        .gte('scan_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('opportunity_score', { ascending: false })
        .limit(30);

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: {
          count: opportunities?.length || 0,
          opportunities: opportunities || []
        }
      });
    } catch (error) {
      logger.error('Failed to get value opportunities', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve value opportunities'
      });
    }
  };

  // Get tech categories overview
  getTechCategoriesOverview = async (req: Request, res: Response) => {
    try {
      const { data: categories, error } = await db.getClient()
        .from('tech_stock_universe')
        .select(`
          tech_category,
          count,
          stock_symbols!inner(symbol, name)
        `)
        .eq('is_active', true);

      if (error) {
        throw error;
      }

      // Group by category
      const overview = categories?.reduce((acc: any, item: any) => {
        const category = item.tech_category;
        if (!acc[category]) {
          acc[category] = {
            category,
            stocks: [],
            count: 0
          };
        }
        acc[category].stocks.push({
          symbol: item.stock_symbols.symbol,
          name: item.stock_symbols.name
        });
        acc[category].count++;
        return acc;
      }, {});

      res.json({
        success: true,
        data: Object.values(overview || {})
      });
    } catch (error) {
      logger.error('Failed to get categories overview', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve categories overview'
      });
    }
  };

  // Helper: Group options by expiration
  private groupOptionsByExpiration(contracts: any[]): any {
    const grouped: any = {};

    contracts.forEach(contract => {
      const expDate = contract.expiration_date;
      if (!grouped[expDate]) {
        grouped[expDate] = {
          expirationDate: expDate,
          daysToExpiration: Math.floor(
            (new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ),
          calls: [],
          puts: []
        };
      }

      const optionData = {
        contractId: contract.id,
        contractSymbol: contract.contract_symbol,
        strikePrice: contract.strike_price,
        bid: contract.options_market_data[0]?.bid || 0,
        ask: contract.options_market_data[0]?.ask || 0,
        lastPrice: contract.options_market_data[0]?.last_price || 0,
        volume: contract.options_market_data[0]?.volume || 0,
        openInterest: contract.options_market_data[0]?.open_interest || 0,
        impliedVolatility: contract.options_market_data[0]?.implied_volatility || 0,
        delta: contract.options_market_data[0]?.delta || null,
        gamma: contract.options_market_data[0]?.gamma || null,
        theta: contract.options_market_data[0]?.theta || null,
        vega: contract.options_market_data[0]?.vega || null
      };

      if (contract.option_type === 'call') {
        grouped[expDate].calls.push(optionData);
      } else {
        grouped[expDate].puts.push(optionData);
      }
    });

    // Sort strikes within each expiration
    Object.values(grouped).forEach((exp: any) => {
      exp.calls.sort((a: any, b: any) => a.strikePrice - b.strikePrice);
      exp.puts.sort((a: any, b: any) => a.strikePrice - b.strikePrice);
    });

    return Object.values(grouped);
  }
}