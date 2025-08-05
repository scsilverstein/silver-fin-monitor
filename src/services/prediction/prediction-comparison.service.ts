// Prediction comparison service following CLAUDE.md specification
import { DatabaseService } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import { OpenAIService } from '../ai/openai.service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface Prediction {
  id: string;
  daily_analysis_id: string;
  prediction_type: 'market_direction' | 'sector_performance' | 'economic_indicator' | 'geopolitical_event';
  prediction_text: string;
  confidence_level: number;
  time_horizon: '1_week' | '2_weeks' | '1_month' | '3_months' | '6_months' | '1_year';
  prediction_data: any;
  created_at: Date;
}

export interface PredictionComparison {
  id: string;
  prediction_id: string;
  comparison_date: Date;
  current_analysis_id: string;
  accuracy_score: number;
  outcome_description: string;
  comparison_analysis: any;
  created_at: Date;
}

export interface AccuracyMetrics {
  overall_accuracy: number;
  by_type: Record<string, number>;
  by_horizon: Record<string, number>;
  confidence_calibration: number;
  total_evaluated: number;
  total_pending: number;
}

export interface ComparisonResult {
  prediction: Prediction;
  actualOutcome: string;
  accuracyScore: number;
  analysis: {
    whatWasCorrect: string[];
    whatWasIncorrect: string[];
    keyFactors: string[];
    lessonsLearned: string[];
  };
  metadata: {
    daysElapsed: number;
    marketConditions: string;
    unexpectedEvents: string[];
  };
}

export class PredictionComparisonService {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private aiService: OpenAIService,
    private logger: winston.Logger
  ) {}

  // Check and evaluate predictions that have reached their time horizon
  async evaluateDuePredictions(): Promise<void> {
    try {
      this.logger.info('Starting evaluation of due predictions');

      const duePredictions = await this.getDuePredictions();
      this.logger.info(`Found ${duePredictions.length} predictions due for evaluation`);

      for (const prediction of duePredictions) {
        try {
          await this.evaluatePrediction(prediction);
        } catch (error) {
          this.logger.error('Failed to evaluate prediction', { 
            predictionId: prediction.id, 
            error 
          });
        }
      }

      // Clear related caches
      await this.cache.deletePattern('predictions:accuracy:*');
      await this.cache.deletePattern('predictions:comparisons:*');
    } catch (error) {
      this.logger.error('Failed to evaluate due predictions', error);
      throw error;
    }
  }

  // Evaluate a specific prediction
  async evaluatePrediction(prediction: Prediction): Promise<PredictionComparison> {
    try {
      this.logger.info('Evaluating prediction', { 
        id: prediction.id, 
        type: prediction.prediction_type,
        horizon: prediction.time_horizon 
      });

      // Get current market analysis
      const currentAnalysis = await this.getCurrentAnalysis();
      
      // Get historical data for comparison
      const historicalData = await this.getHistoricalData(
        prediction.created_at,
        new Date(),
        prediction.prediction_type
      );

      // Use AI to compare prediction with actual outcome
      const comparison = await this.aiService.comparePrediction({
        prediction: {
          text: prediction.prediction_text,
          type: prediction.prediction_type,
          confidence: prediction.confidence_level,
          data: prediction.prediction_data,
          madeOn: prediction.created_at
        },
        currentState: {
          analysis: currentAnalysis,
          date: new Date()
        },
        historicalData,
        timeElapsed: this.calculateDaysElapsed(prediction.created_at, new Date())
      });

      // Store comparison result
      const comparisonResult = await this.storeComparison({
        prediction_id: prediction.id,
        comparison_date: new Date(),
        current_analysis_id: currentAnalysis.id,
        accuracy_score: comparison.accuracyScore,
        outcome_description: comparison.outcomeDescription,
        comparison_analysis: comparison.analysis
      });

      this.logger.info('Prediction evaluation completed', { 
        predictionId: prediction.id,
        accuracyScore: comparison.accuracyScore 
      });

      return comparisonResult;
    } catch (error) {
      this.logger.error('Failed to evaluate prediction', { 
        predictionId: prediction.id, 
        error 
      });
      throw error;
    }
  }

  // Get predictions due for evaluation
  private async getDuePredictions(): Promise<Prediction[]> {
    const query = `
      SELECT p.*
      FROM predictions p
      LEFT JOIN prediction_comparisons pc ON p.id = pc.prediction_id
      WHERE pc.id IS NULL
      AND (
        (p.time_horizon = '1_week' AND p.created_at <= NOW() - INTERVAL '7 days') OR
        (p.time_horizon = '2_weeks' AND p.created_at <= NOW() - INTERVAL '14 days') OR
        (p.time_horizon = '1_month' AND p.created_at <= NOW() - INTERVAL '30 days') OR
        (p.time_horizon = '3_months' AND p.created_at <= NOW() - INTERVAL '90 days') OR
        (p.time_horizon = '6_months' AND p.created_at <= NOW() - INTERVAL '180 days') OR
        (p.time_horizon = '1_year' AND p.created_at <= NOW() - INTERVAL '365 days')
      )
      ORDER BY p.created_at ASC
      LIMIT 50
    `;

    return this.db.query(query);
  }

  // Get current market analysis
  private async getCurrentAnalysis(): Promise<any> {
    const [analysis] = await this.db.query(
      'SELECT * FROM daily_analysis ORDER BY analysis_date DESC LIMIT 1'
    );
    
    if (!analysis) {
      throw new Error('No current analysis available');
    }

    return analysis;
  }

  // Get historical data for comparison
  private async getHistoricalData(
    startDate: Date,
    endDate: Date,
    predictionType: string
  ): Promise<any> {
    // Get relevant market data based on prediction type
    const data: any = {};

    // Get daily analyses
    data.analyses = await this.db.query(
      `SELECT * FROM daily_analysis 
       WHERE analysis_date BETWEEN $1 AND $2 
       ORDER BY analysis_date`,
      [startDate, endDate]
    );

    // Get relevant metrics based on prediction type
    switch (predictionType) {
      case 'market_direction':
        data.marketMetrics = await this.getMarketMetrics(startDate, endDate);
        break;
      case 'sector_performance':
        data.sectorMetrics = await this.getSectorMetrics(startDate, endDate);
        break;
      case 'economic_indicator':
        data.economicIndicators = await this.getEconomicIndicators(startDate, endDate);
        break;
      case 'geopolitical_event':
        data.geopoliticalEvents = await this.getGeopoliticalEvents(startDate, endDate);
        break;
    }

    return data;
  }

  // Store comparison result
  private async storeComparison(data: Omit<PredictionComparison, 'id' | 'created_at'>): Promise<PredictionComparison> {
    const id = uuidv4();
    const created_at = new Date();

    await this.db.query(
      `INSERT INTO prediction_comparisons 
       (id, prediction_id, comparison_date, current_analysis_id, 
        accuracy_score, outcome_description, comparison_analysis, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        data.prediction_id,
        data.comparison_date,
        data.current_analysis_id,
        data.accuracy_score,
        data.outcome_description,
        JSON.stringify(data.comparison_analysis),
        created_at
      ]
    );

    return {
      id,
      ...data,
      created_at
    };
  }

  // Calculate overall accuracy metrics
  async calculateAccuracyMetrics(): Promise<AccuracyMetrics> {
    try {
      const cacheKey = 'predictions:accuracy:overall';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Overall accuracy
      const [overall] = await this.db.query(
        'SELECT AVG(accuracy_score) as avg_accuracy, COUNT(*) as total FROM prediction_comparisons'
      );

      // Accuracy by type
      const byType = await this.db.query(
        `SELECT p.prediction_type, AVG(pc.accuracy_score) as accuracy, COUNT(*) as count
         FROM predictions p
         JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         GROUP BY p.prediction_type`
      );

      // Accuracy by time horizon
      const byHorizon = await this.db.query(
        `SELECT p.time_horizon, AVG(pc.accuracy_score) as accuracy, COUNT(*) as count
         FROM predictions p
         JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         GROUP BY p.time_horizon`
      );

      // Confidence calibration
      const calibration = await this.calculateConfidenceCalibration();

      // Count pending predictions
      const [pending] = await this.db.query(
        `SELECT COUNT(*) as count FROM predictions p
         LEFT JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         WHERE pc.id IS NULL`
      );

      const metrics: AccuracyMetrics = {
        overall_accuracy: overall?.avg_accuracy || 0,
        by_type: byType.reduce((acc: any, item: any) => {
          acc[item.prediction_type] = parseFloat(item.accuracy);
          return acc;
        }, {}),
        by_horizon: byHorizon.reduce((acc: any, item: any) => {
          acc[item.time_horizon] = parseFloat(item.accuracy);
          return acc;
        }, {}),
        confidence_calibration: calibration,
        total_evaluated: parseInt(overall?.total || '0'),
        total_pending: parseInt(pending?.count || '0')
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, metrics, { ttl: 3600 });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to calculate accuracy metrics', error);
      throw error;
    }
  }

  // Calculate confidence calibration
  private async calculateConfidenceCalibration(): Promise<number> {
    // Group predictions by confidence buckets and calculate actual accuracy
    const calibrationData = await this.db.query(
      `SELECT 
        FLOOR(p.confidence_level * 10) / 10 as confidence_bucket,
        AVG(pc.accuracy_score) as actual_accuracy,
        COUNT(*) as count
       FROM predictions p
       JOIN prediction_comparisons pc ON p.id = pc.prediction_id
       GROUP BY confidence_bucket
       HAVING COUNT(*) >= 5`
    );

    if (calibrationData.length === 0) {
      return 0;
    }

    // Calculate calibration score (closer to 1 is better)
    let totalDiff = 0;
    let totalWeight = 0;

    for (const bucket of calibrationData) {
      const expectedAccuracy = bucket.confidence_bucket;
      const actualAccuracy = bucket.actual_accuracy;
      const weight = bucket.count;

      totalDiff += Math.abs(expectedAccuracy - actualAccuracy) * weight;
      totalWeight += weight;
    }

    const avgDiff = totalWeight > 0 ? totalDiff / totalWeight : 0;
    return Math.max(0, 1 - avgDiff);
  }

  // Get detailed comparison history
  async getComparisonHistory(
    filters?: {
      predictionType?: string;
      timeHorizon?: string;
      startDate?: Date;
      endDate?: Date;
      minAccuracy?: number;
    }
  ): Promise<ComparisonResult[]> {
    try {
      let query = `
        SELECT 
          p.*,
          pc.*,
          da.market_sentiment as current_sentiment,
          da.key_themes as current_themes
        FROM prediction_comparisons pc
        JOIN predictions p ON pc.prediction_id = p.id
        JOIN daily_analysis da ON pc.current_analysis_id = da.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.predictionType) {
        query += ` AND p.prediction_type = $${paramIndex}`;
        params.push(filters.predictionType);
        paramIndex++;
      }

      if (filters?.timeHorizon) {
        query += ` AND p.time_horizon = $${paramIndex}`;
        params.push(filters.timeHorizon);
        paramIndex++;
      }

      if (filters?.startDate) {
        query += ` AND pc.comparison_date >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters?.endDate) {
        query += ` AND pc.comparison_date <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }

      if (filters?.minAccuracy !== undefined) {
        query += ` AND pc.accuracy_score >= $${paramIndex}`;
        params.push(filters.minAccuracy);
        paramIndex++;
      }

      query += ' ORDER BY pc.comparison_date DESC LIMIT 100';

      const results = await this.db.query(query, params);

      return results.map((row: any) => ({
        prediction: {
          id: row.id,
          daily_analysis_id: row.daily_analysis_id,
          prediction_type: row.prediction_type,
          prediction_text: row.prediction_text,
          confidence_level: row.confidence_level,
          time_horizon: row.time_horizon,
          prediction_data: row.prediction_data,
          created_at: row.created_at
        },
        actualOutcome: row.outcome_description,
        accuracyScore: row.accuracy_score,
        analysis: row.comparison_analysis,
        metadata: {
          daysElapsed: this.calculateDaysElapsed(row.created_at, row.comparison_date),
          marketConditions: row.current_sentiment,
          unexpectedEvents: row.comparison_analysis?.unexpectedEvents || []
        }
      }));
    } catch (error) {
      this.logger.error('Failed to get comparison history', error);
      throw error;
    }
  }

  // Helper methods
  private calculateDaysElapsed(startDate: Date, endDate: Date): number {
    const diff = endDate.getTime() - startDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private async getMarketMetrics(startDate: Date, endDate: Date): Promise<any> {
    // This would fetch actual market data (S&P 500, volatility, etc.)
    // For now, returning placeholder
    return {
      indices: [],
      volatility: [],
      volume: []
    };
  }

  private async getSectorMetrics(startDate: Date, endDate: Date): Promise<any> {
    // Fetch sector performance data
    return {
      sectors: [],
      rotations: []
    };
  }

  private async getEconomicIndicators(startDate: Date, endDate: Date): Promise<any> {
    // Fetch economic indicator data
    return {
      gdp: [],
      inflation: [],
      employment: []
    };
  }

  private async getGeopoliticalEvents(startDate: Date, endDate: Date): Promise<any> {
    // Fetch geopolitical events from content
    return {
      events: [],
      impacts: []
    };
  }

  // Generate prediction performance report
  async generatePerformanceReport(): Promise<any> {
    try {
      const metrics = await this.calculateAccuracyMetrics();
      const recentComparisons = await this.getComparisonHistory({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      });

      // Best and worst predictions
      const [bestPredictions] = await this.db.query(
        `SELECT p.*, pc.accuracy_score, pc.outcome_description
         FROM predictions p
         JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         ORDER BY pc.accuracy_score DESC
         LIMIT 10`
      );

      const [worstPredictions] = await this.db.query(
        `SELECT p.*, pc.accuracy_score, pc.outcome_description
         FROM predictions p
         JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         ORDER BY pc.accuracy_score ASC
         LIMIT 10`
      );

      // Trends over time
      const accuracyTrend = await this.db.query(
        `SELECT 
          DATE_TRUNC('week', pc.comparison_date) as week,
          AVG(pc.accuracy_score) as avg_accuracy,
          COUNT(*) as count
         FROM prediction_comparisons pc
         WHERE pc.comparison_date >= NOW() - INTERVAL '3 months'
         GROUP BY week
         ORDER BY week`
      );

      return {
        summary: {
          overallAccuracy: metrics.overall_accuracy,
          totalEvaluated: metrics.total_evaluated,
          totalPending: metrics.total_pending,
          confidenceCalibration: metrics.confidence_calibration
        },
        byType: metrics.by_type,
        byHorizon: metrics.by_horizon,
        recentPerformance: {
          last30Days: recentComparisons.length,
          avgAccuracy: recentComparisons.reduce((sum, c) => sum + c.accuracyScore, 0) / 
                      (recentComparisons.length || 1)
        },
        bestPredictions,
        worstPredictions,
        accuracyTrend,
        insights: await this.generateInsights(metrics, recentComparisons)
      };
    } catch (error) {
      this.logger.error('Failed to generate performance report', error);
      throw error;
    }
  }

  private async generateInsights(
    metrics: AccuracyMetrics,
    recentComparisons: ComparisonResult[]
  ): Promise<string[]> {
    const insights: string[] = [];

    // Overall performance
    if (metrics.overall_accuracy > 0.7) {
      insights.push('Predictions are performing well with over 70% accuracy');
    } else if (metrics.overall_accuracy < 0.5) {
      insights.push('Prediction accuracy is below 50%, consider model adjustments');
    }

    // Confidence calibration
    if (metrics.confidence_calibration > 0.8) {
      insights.push('Confidence levels are well-calibrated with actual outcomes');
    } else if (metrics.confidence_calibration < 0.5) {
      insights.push('Confidence levels need calibration - predictions are overconfident');
    }

    // Type performance
    const bestType = Object.entries(metrics.by_type)
      .sort(([,a], [,b]) => b - a)[0];
    if (bestType) {
      insights.push(`${bestType[0]} predictions are most accurate at ${(bestType[1] * 100).toFixed(1)}%`);
    }

    // Time horizon performance
    const bestHorizon = Object.entries(metrics.by_horizon)
      .sort(([,a], [,b]) => b - a)[0];
    if (bestHorizon) {
      insights.push(`${bestHorizon[0].replace('_', ' ')} predictions are most reliable`);
    }

    return insights;
  }
}

export default PredictionComparisonService;