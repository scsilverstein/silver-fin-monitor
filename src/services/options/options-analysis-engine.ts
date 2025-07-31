import { db } from '../database';
import { Logger } from '../../utils/stock-logger';
import { cache } from '../cache';
import { Result } from '../../types';

const logger = new Logger('OptionsAnalysisEngine');

// Types for analysis
export interface OptionsContract {
  id: string;
  symbolId: string;
  symbol: string;
  optionType: 'call' | 'put';
  strikePrice: number;
  expirationDate: Date;
  daysToExpiration: number;
}

export interface MarketData {
  contractId: string;
  bid: number;
  ask: number;
  lastPrice: number;
  markPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  underlyingPrice: number;
}

export interface ValueAnalysis {
  contractId: string;
  intrinsicValue: number;
  timeValue: number;
  theoreticalValue: number;
  marketPrice: number;
  valueDiscrepancy: number;
  breakEvenPrice: number;
  maxProfit: number;
  maxLoss: number;
  riskRewardRatio: number;
  probabilityITM: number;
  probabilityProfit: number;
  expectedValue: number;
  ivRank: number;
  ivPercentile: number;
  volumeLiquidityScore: number;
  spreadQualityScore: number;
  valueScore: number;
  opportunityScore: number;
  riskAdjustedScore: number;
  recommendedStrategy: string;
  strategyRationale: string;
}

export interface ScanCriteria {
  minVolume?: number;
  minOpenInterest?: number;
  maxSpreadRatio?: number;
  minDaysToExpiration?: number;
  maxDaysToExpiration?: number;
  minIVRank?: number;
  maxIVRank?: number;
  minValueScore?: number;
  sectors?: string[];
  techCategoriesOnly?: boolean;
}

export class OptionsAnalysisEngine {
  private readonly riskFreeRate: number = 0.045; // Current T-bill rate

  // Analyze single option contract
  async analyzeOption(
    contract: OptionsContract,
    marketData: MarketData
  ): Promise<Result<ValueAnalysis>> {
    try {
      // Calculate intrinsic and time value
      const intrinsicValue = this.calculateIntrinsicValue(
        contract.optionType,
        contract.strikePrice,
        marketData.underlyingPrice
      );
      const timeValue = marketData.markPrice - intrinsicValue;

      // Calculate theoretical value using Black-Scholes
      const theoreticalValue = await this.calculateTheoreticalValue(
        contract,
        marketData
      );

      // Value discrepancy
      const valueDiscrepancy = marketData.markPrice > 0 
        ? (theoreticalValue - marketData.markPrice) / marketData.markPrice
        : 0;

      // Risk/Reward metrics
      const breakEvenPrice = this.calculateBreakEven(
        contract.optionType,
        contract.strikePrice,
        marketData.markPrice
      );

      const { maxProfit, maxLoss } = this.calculateProfitLoss(
        contract.optionType,
        contract.strikePrice,
        marketData.markPrice
      );

      const riskRewardRatio = maxLoss !== 0 ? Math.abs(maxProfit / maxLoss) : 0;

      // Probability calculations
      const probabilityITM = await this.calculateProbabilityITM(
        contract,
        marketData
      );

      const probabilityProfit = await this.calculateProbabilityProfit(
        contract,
        marketData,
        breakEvenPrice
      );

      const expectedValue = this.calculateExpectedValue(
        probabilityProfit,
        maxProfit,
        maxLoss
      );

      // IV metrics
      const { ivRank, ivPercentile } = await this.calculateIVMetrics(
        contract.id,
        marketData.impliedVolatility
      );

      // Liquidity and spread scores
      const volumeLiquidityScore = this.calculateLiquidityScore(
        marketData.volume,
        marketData.openInterest
      );

      const spreadQualityScore = this.calculateSpreadScore(
        marketData.bid,
        marketData.ask,
        marketData.markPrice
      );

      // Composite scores
      const scores = this.calculateCompositeScores({
        ivRank,
        ivPercentile,
        volumeLiquidityScore,
        spreadQualityScore,
        valueDiscrepancy,
        daysToExpiration: contract.daysToExpiration,
        probabilityProfit
      });

      // Strategy recommendation
      const { strategy, rationale } = this.recommendStrategy(
        contract,
        marketData,
        scores,
        ivRank
      );

      const analysis: ValueAnalysis = {
        contractId: contract.id,
        intrinsicValue,
        timeValue,
        theoreticalValue,
        marketPrice: marketData.markPrice,
        valueDiscrepancy,
        breakEvenPrice,
        maxProfit,
        maxLoss,
        riskRewardRatio,
        probabilityITM,
        probabilityProfit,
        expectedValue,
        ivRank,
        ivPercentile,
        volumeLiquidityScore,
        spreadQualityScore,
        valueScore: scores.valueScore,
        opportunityScore: scores.opportunityScore,
        riskAdjustedScore: scores.riskAdjustedScore,
        recommendedStrategy: strategy,
        strategyRationale: rationale
      };

      // Store analysis in database
      await this.storeAnalysis(analysis);

      return { success: true, data: analysis };

    } catch (error) {
      logger.error('Failed to analyze option', error);
      return { success: false, error: error as Error };
    }
  }

  // Calculate intrinsic value
  private calculateIntrinsicValue(
    optionType: 'call' | 'put',
    strikePrice: number,
    underlyingPrice: number
  ): number {
    if (optionType === 'call') {
      return Math.max(0, underlyingPrice - strikePrice);
    } else {
      return Math.max(0, strikePrice - underlyingPrice);
    }
  }

  // Black-Scholes option pricing
  private async calculateTheoreticalValue(
    contract: OptionsContract,
    marketData: MarketData
  ): Promise<number> {
    const S = marketData.underlyingPrice;
    const K = contract.strikePrice;
    const T = contract.daysToExpiration / 365;
    const r = this.riskFreeRate;
    const sigma = marketData.impliedVolatility || 0.3; // Default 30% if not available

    // Black-Scholes formula
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);

    const Nd1 = this.normalCDF(d1);
    const Nd2 = this.normalCDF(d2);

    if (contract.optionType === 'call') {
      return S * Nd1 - K * Math.exp(-r * T) * Nd2;
    } else {
      return K * Math.exp(-r * T) * this.normalCDF(-d2) - S * this.normalCDF(-d1);
    }
  }

  // Normal cumulative distribution function
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  // Calculate break-even price
  private calculateBreakEven(
    optionType: 'call' | 'put',
    strikePrice: number,
    premium: number
  ): number {
    if (optionType === 'call') {
      return strikePrice + premium;
    } else {
      return strikePrice - premium;
    }
  }

  // Calculate max profit and loss
  private calculateProfitLoss(
    optionType: 'call' | 'put',
    strikePrice: number,
    premium: number
  ): { maxProfit: number; maxLoss: number } {
    const maxLoss = -premium * 100; // Loss is premium paid (multiplied by contract size)

    let maxProfit: number;
    if (optionType === 'call') {
      maxProfit = Infinity; // Theoretically unlimited for calls
    } else {
      maxProfit = (strikePrice - premium) * 100; // Limited to strike - premium for puts
    }

    return { maxProfit, maxLoss };
  }

  // Calculate probability of finishing in the money
  private async calculateProbabilityITM(
    contract: OptionsContract,
    marketData: MarketData
  ): Promise<number> {
    const S = marketData.underlyingPrice;
    const K = contract.strikePrice;
    const T = contract.daysToExpiration / 365;
    const r = this.riskFreeRate;
    const sigma = marketData.impliedVolatility || 0.3;

    const d2 = (Math.log(S / K) + (r - sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));

    if (contract.optionType === 'call') {
      return this.normalCDF(d2);
    } else {
      return this.normalCDF(-d2);
    }
  }

  // Calculate probability of profit
  private async calculateProbabilityProfit(
    contract: OptionsContract,
    marketData: MarketData,
    breakEvenPrice: number
  ): Promise<number> {
    const S = marketData.underlyingPrice;
    const B = breakEvenPrice;
    const T = contract.daysToExpiration / 365;
    const r = this.riskFreeRate;
    const sigma = marketData.impliedVolatility || 0.3;

    const d = (Math.log(S / B) + (r - sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));

    if (contract.optionType === 'call') {
      return this.normalCDF(d);
    } else {
      return this.normalCDF(-d);
    }
  }

  // Calculate expected value
  private calculateExpectedValue(
    probabilityProfit: number,
    maxProfit: number,
    maxLoss: number
  ): number {
    // Simplified expected value calculation
    // In reality, this would integrate over the entire profit/loss distribution
    const avgProfit = maxProfit === Infinity ? 1000 : maxProfit * 0.3; // Conservative estimate
    return probabilityProfit * avgProfit + (1 - probabilityProfit) * maxLoss;
  }

  // Calculate IV rank and percentile
  private async calculateIVMetrics(
    contractId: string,
    currentIV: number
  ): Promise<{ ivRank: number; ivPercentile: number }> {
    try {
      const result = await db.getClient().rpc('calculate_iv_metrics', {
        p_contract_id: contractId,
        p_current_iv: currentIV
      });

      if (result.data && result.data.length > 0) {
        return {
          ivRank: result.data[0].iv_rank || 50,
          ivPercentile: result.data[0].iv_percentile || 50
        };
      }

      return { ivRank: 50, ivPercentile: 50 };

    } catch (error) {
      logger.error('Failed to calculate IV metrics', error);
      return { ivRank: 50, ivPercentile: 50 };
    }
  }

  // Calculate liquidity score
  private calculateLiquidityScore(volume: number, openInterest: number): number {
    const volumeScore = Math.min(volume / 1000, 100); // Score based on 1000+ volume
    const oiScore = Math.min(openInterest / 5000, 100); // Score based on 5000+ OI
    const ratioScore = openInterest > 0 ? Math.min((volume / openInterest) * 20, 100) : 0;

    return (volumeScore * 0.4 + oiScore * 0.4 + ratioScore * 0.2);
  }

  // Calculate spread quality score
  private calculateSpreadScore(bid: number, ask: number, mark: number): number {
    if (bid <= 0 || ask <= 0 || mark <= 0) return 0;

    const spread = ask - bid;
    const spreadRatio = spread / mark;

    // Lower spread ratio = higher score
    if (spreadRatio <= 0.01) return 100;      // <= 1% spread
    if (spreadRatio <= 0.02) return 90;       // <= 2% spread
    if (spreadRatio <= 0.05) return 75;       // <= 5% spread
    if (spreadRatio <= 0.10) return 50;       // <= 10% spread
    if (spreadRatio <= 0.20) return 25;       // <= 20% spread
    return 10;                                 // > 20% spread
  }

  // Calculate composite scores
  private calculateCompositeScores(metrics: {
    ivRank: number;
    ivPercentile: number;
    volumeLiquidityScore: number;
    spreadQualityScore: number;
    valueDiscrepancy: number;
    daysToExpiration: number;
    probabilityProfit: number;
  }): { valueScore: number; opportunityScore: number; riskAdjustedScore: number } {
    // Value score - focuses on pricing efficiency
    const valueScore = Math.min(100, Math.max(0,
      (100 - metrics.ivRank) * 0.25 +                    // Lower IV = better value
      metrics.spreadQualityScore * 0.25 +                // Tight spreads
      metrics.volumeLiquidityScore * 0.25 +              // Good liquidity
      (metrics.valueDiscrepancy > 0 ? 50 : 0) * 0.25     // Underpriced options
    ));

    // Opportunity score - focuses on profit potential
    const dteScore = Math.min(100, Math.max(0,
      metrics.daysToExpiration >= 30 && metrics.daysToExpiration <= 60 ? 100 :
      metrics.daysToExpiration >= 15 && metrics.daysToExpiration <= 90 ? 75 : 50
    ));

    const opportunityScore = Math.min(100, Math.max(0,
      metrics.probabilityProfit * 100 * 0.3 +            // High probability of profit
      metrics.volumeLiquidityScore * 0.2 +               // Active trading
      dteScore * 0.2 +                                   // Optimal time frame
      metrics.ivPercentile * 0.15 +                      // Current IV position
      (metrics.valueDiscrepancy > 0.1 ? 100 : 50) * 0.15 // Significant underpricing
    ));

    // Risk-adjusted score
    const riskAdjustedScore = Math.min(100, Math.max(0,
      valueScore * 0.35 +
      opportunityScore * 0.35 +
      (100 - metrics.ivRank) * 0.15 +                    // Lower IV = lower risk
      metrics.spreadQualityScore * 0.15                  // Better liquidity = lower risk
    ));

    return { valueScore, opportunityScore, riskAdjustedScore };
  }

  // Recommend trading strategy
  private recommendStrategy(
    contract: OptionsContract,
    marketData: MarketData,
    scores: { valueScore: number; opportunityScore: number; riskAdjustedScore: number },
    ivRank: number
  ): { strategy: string; rationale: string } {
    const moneyness = (marketData.underlyingPrice - contract.strikePrice) / marketData.underlyingPrice;
    const isITM = contract.optionType === 'call' ? moneyness > 0 : moneyness < 0;
    const isOTM = !isITM;

    // High IV environment strategies
    if (ivRank > 70) {
      if (contract.optionType === 'call' && isOTM) {
        return {
          strategy: 'sell_covered_call',
          rationale: 'High IV provides premium income opportunity. OTM calls offer good risk/reward for covered positions.'
        };
      }
      if (contract.optionType === 'put' && isOTM) {
        return {
          strategy: 'sell_cash_secured_put',
          rationale: 'High IV premiums make put selling attractive for acquiring stock at lower prices.'
        };
      }
    }

    // Low IV environment strategies
    if (ivRank < 30 && scores.valueScore > 70) {
      if (contract.daysToExpiration > 45) {
        return {
          strategy: contract.optionType === 'call' ? 'long_call' : 'long_put',
          rationale: 'Low IV makes options cheap. Good value with time for directional move.'
        };
      }
    }

    // High opportunity score strategies
    if (scores.opportunityScore > 80) {
      if (marketData.volume > marketData.openInterest * 0.5) {
        return {
          strategy: 'day_trade_momentum',
          rationale: 'High volume relative to OI suggests active momentum trading opportunity.'
        };
      }
    }

    // Default balanced strategy
    if (scores.riskAdjustedScore > 60) {
      return {
        strategy: 'vertical_spread',
        rationale: 'Balanced risk/reward profile suitable for current market conditions.'
      };
    }

    return {
      strategy: 'monitor_only',
      rationale: 'Conditions not optimal for entry. Continue monitoring for better opportunity.'
    };
  }

  // Store analysis results
  private async storeAnalysis(analysis: ValueAnalysis): Promise<void> {
    try {
      await db.getClient()
        .from('options_value_analysis')
        .insert({
          contract_id: analysis.contractId,
          analysis_timestamp: new Date(),
          intrinsic_value: analysis.intrinsicValue,
          time_value: analysis.timeValue,
          theoretical_value: analysis.theoreticalValue,
          market_price: analysis.marketPrice,
          value_discrepancy: analysis.valueDiscrepancy,
          breakeven_price: analysis.breakEvenPrice,
          max_profit: analysis.maxProfit === Infinity ? null : analysis.maxProfit,
          max_loss: analysis.maxLoss,
          risk_reward_ratio: analysis.riskRewardRatio,
          probability_itm: analysis.probabilityITM,
          probability_profit: analysis.probabilityProfit,
          expected_value: analysis.expectedValue,
          iv_rank: analysis.ivRank,
          iv_percentile: analysis.ivPercentile,
          volume_liquidity_score: analysis.volumeLiquidityScore,
          spread_quality_score: analysis.spreadQualityScore,
          value_score: analysis.valueScore,
          opportunity_score: analysis.opportunityScore,
          risk_adjusted_score: analysis.riskAdjustedScore,
          recommended_strategy: analysis.recommendedStrategy,
          strategy_rationale: analysis.strategyRationale,
          model_used: 'black_scholes',
          confidence_level: 85
        });
    } catch (error) {
      logger.error('Failed to store analysis', error);
    }
  }

  // Scan options based on criteria
  async scanOptions(criteria: ScanCriteria): Promise<Result<ValueAnalysis[]>> {
    try {
      const cacheKey = `options_scan:${JSON.stringify(criteria)}`;
      const cached = await cache.get<ValueAnalysis[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Build query based on criteria
      let query = db.getClient()
        .from('options_contracts')
        .select(`
          *,
          stock_symbols!inner(symbol, name, sector),
          options_market_data!inner(*)
        `)
        .eq('is_active', true)
        .order('options_market_data.volume', { ascending: false });

      // Apply filters
      if (criteria.minDaysToExpiration) {
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + criteria.minDaysToExpiration);
        query = query.gte('expiration_date', minDate.toISOString());
      }

      if (criteria.maxDaysToExpiration) {
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + criteria.maxDaysToExpiration);
        query = query.lte('expiration_date', maxDate.toISOString());
      }

      if (criteria.minVolume) {
        query = query.gte('options_market_data.volume', criteria.minVolume);
      }

      if (criteria.minOpenInterest) {
        query = query.gte('options_market_data.open_interest', criteria.minOpenInterest);
      }

      if (criteria.techCategoriesOnly) {
        query = query.in('stock_symbols.sector', ['Technology', 'Communication Services']);
      }

      const { data: contracts, error } = await query.limit(100);

      if (error) {
        throw error;
      }

      // Analyze each contract
      const analyses: ValueAnalysis[] = [];
      
      for (const contract of contracts || []) {
        const optionContract: OptionsContract = {
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

        const latestMarketData = contract.options_market_data[0];
        if (latestMarketData) {
          const marketData: MarketData = {
            contractId: contract.id,
            bid: latestMarketData.bid,
            ask: latestMarketData.ask,
            lastPrice: latestMarketData.last_price,
            markPrice: latestMarketData.mark_price,
            volume: latestMarketData.volume,
            openInterest: latestMarketData.open_interest,
            impliedVolatility: latestMarketData.implied_volatility,
            delta: latestMarketData.delta,
            gamma: latestMarketData.gamma,
            theta: latestMarketData.theta,
            vega: latestMarketData.vega,
            rho: latestMarketData.rho,
            underlyingPrice: latestMarketData.underlying_price
          };

          const analysisResult = await this.analyzeOption(optionContract, marketData);
          if (analysisResult.success && analysisResult.data) {
            // Apply score filters
            if (!criteria.minValueScore || analysisResult.data.valueScore >= criteria.minValueScore) {
              analyses.push(analysisResult.data);
            }
          }
        }
      }

      // Sort by opportunity score
      analyses.sort((a, b) => b.opportunityScore - a.opportunityScore);

      // Cache for 15 minutes
      await cache.set(cacheKey, analyses, 900);

      return { success: true, data: analyses };

    } catch (error) {
      logger.error('Failed to scan options', error);
      return { success: false, error: error as Error };
    }
  }
}