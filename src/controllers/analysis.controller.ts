import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { Database } from '../types';
import { CacheService } from '../services/cache/cache.service';
import { OpenAIService } from '../services/ai/openai.service';
import { Logger } from 'winston';
import { queueService } from '../services/database/queue';
import { aiAnalysisService } from '../services/ai/analysis';

export class AnalysisController {
  constructor(
    private db: Database,
    private cache: CacheService,
    private aiService: OpenAIService,
    private logger: Logger
  ) {}

  // Transform database row to DailyAnalysis interface with camelCase
  private transformDbRowToDailyAnalysis(row: any): any {
    if (!row) return null;
    
    return {
      id: row.id,
      analysisDate: row.analysis_date,
      marketSentiment: row.market_sentiment,
      keyThemes: row.key_themes || [],
      overallSummary: row.overall_summary,
      aiAnalysis: row.ai_analysis || {},
      confidenceScore: row.confidence_score,
      sourcesAnalyzed: row.sources_analyzed,
      createdAt: row.created_at
    };
  }

  // Transform prediction database row to camelCase
  private transformDbRowToPrediction(row: any): any {
    if (!row) return null;
    
    return {
      id: row.id,
      dailyAnalysisId: row.daily_analysis_id,
      predictionType: row.prediction_type,
      predictionText: row.prediction_text,
      confidenceLevel: row.confidence_level,
      timeHorizon: row.time_horizon,
      predictionData: row.prediction_data || {},
      createdAt: row.created_at
    };
  }

  // Get daily analyses
  async getDailyAnalyses(req: Request, res: Response, next: NextFunction) {
    try {
      const { start_date, end_date, limit = 30, offset = 0 } = req.query;
      
      let query = 'SELECT * FROM daily_analysis WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (start_date) {
        query += ` AND analysis_date >= $${paramIndex}`;
        params.push(new Date(start_date as string));
        paramIndex++;
      }
      
      if (end_date) {
        query += ` AND analysis_date <= $${paramIndex}`;
        params.push(new Date(end_date as string));
        paramIndex++;
      }
      
      query += ` ORDER BY analysis_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), Number(offset));
      
      const analyses = await this.db.query(query, params);
      
      // Transform to camelCase
      const transformedAnalyses = analyses.map(row => this.transformDbRowToDailyAnalysis(row));
      
      res.json({
        success: true,
        data: transformedAnalyses,
        pagination: {
          limit: Number(limit),
          offset: Number(offset)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single daily analysis
  async getDailyAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const { date } = req.params;
      
      // Check cache first
      const cacheKey = `daily_analysis:${date}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }
      
      const analysis = await this.db.tables.dailyAnalysis.findOne({
        analysis_date: new Date(date)
      });
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found for this date'
        });
      }
      
      // Get associated predictions
      const predictions = await this.db.query(
        'SELECT * FROM predictions WHERE daily_analysis_id = $1 ORDER BY time_horizon',
        [(analysis as any).id]
      );
      
      // Transform both analysis and predictions to camelCase
      const transformedAnalysis = this.transformDbRowToDailyAnalysis(analysis);
      const transformedPredictions = predictions.map(row => this.transformDbRowToPrediction(row));
      
      const result = {
        ...transformedAnalysis,
        predictions: transformedPredictions
      };
      
      // Cache the result
      await this.cache.set(cacheKey, result, { ttl: 3600 });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate daily analysis
  async generateDailyAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const { date = new Date().toISOString().split('T')[0] } = req.body;
      
      // Check if analysis already exists
      const existing = await this.db.tables.dailyAnalysis.findOne({
        analysis_date: new Date(date)
      });
      
      if (existing && !req.body.force) {
        return res.status(409).json({
          success: false,
          error: 'Analysis already exists for this date. Use force=true to regenerate.'
        });
      }
      
      // Queue analysis generation
      const jobId = await queueService.enqueue('daily_analysis', {
        date: new Date(date),
        force: req.body.force || false
      }, 1);
      
      res.json({
        success: true,
        data: {
          jobId,
          message: 'Daily analysis generation queued',
          date
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get predictions
  async getPredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        analysis_id,
        prediction_type,
        time_horizon,
        start_date,
        end_date,
        limit = 50,
        offset = 0
      } = req.query;
      
      const filter: any = {};
      if (analysis_id) filter.daily_analysis_id = analysis_id;
      if (prediction_type) filter.prediction_type = prediction_type;
      if (time_horizon) filter.time_horizon = time_horizon;
      
      let predictions = await this.db.tables.predictions.findMany(filter, {
        orderBy: { field: 'created_at', ascending: false },
        limit: Number(limit),
        offset: Number(offset)
      });
      
      // Date filtering
      if (start_date || end_date) {
        predictions = predictions.filter(pred => {
          const createdAt = new Date((pred as any).created_at);
          if (start_date && createdAt < new Date(start_date as string)) return false;
          if (end_date && createdAt > new Date(end_date as string)) return false;
          return true;
        });
      }
      
      // Transform predictions to camelCase
      const transformedPredictions = predictions.map(row => this.transformDbRowToPrediction(row));
      
      res.json({
        success: true,
        data: transformedPredictions,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: await this.db.tables.predictions.count(filter)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single prediction
  async getPrediction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const prediction = await this.db.tables.predictions.findOne({ id });
      
      if (!prediction) {
        return res.status(404).json({
          success: false,
          error: 'Prediction not found'
        });
      }
      
      // Get associated analysis
      const analysis = await this.db.tables.dailyAnalysis.findOne({
        id: (prediction as any).daily_analysis_id
      });
      
      // Get comparison if exists
      const comparisons = await this.db.query(
        'SELECT * FROM prediction_comparisons WHERE prediction_id = $1 ORDER BY comparison_date DESC',
        [id]
      );
      
      // Transform data to camelCase
      const transformedPrediction = this.transformDbRowToPrediction(prediction);
      const transformedAnalysis = this.transformDbRowToDailyAnalysis(analysis);
      
      res.json({
        success: true,
        data: {
          ...transformedPrediction,
          analysis: transformedAnalysis,
          comparisons
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Compare prediction with actual outcome
  async comparePrediction(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { current_analysis_id } = req.body;
      
      if (!current_analysis_id) {
        return res.status(400).json({
          success: false,
          error: 'current_analysis_id is required'
        });
      }
      
      // Queue comparison job
      const jobId = await queueService.enqueue('prediction_compare', {
        predictionId: id,
        currentAnalysisId: current_analysis_id
      }, 2);
      
      res.json({
        success: true,
        data: {
          jobId,
          message: 'Prediction comparison queued'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get market sentiment trend
  async getMarketSentimentTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const { period = '30d' } = req.query;
      
      const trend = await this.db.query(`
        SELECT 
          DATE(analysis_date) as date,
          market_sentiment,
          confidence_score,
          COUNT(DISTINCT key_themes) as theme_count,
          sources_analyzed
        FROM daily_analysis
        WHERE analysis_date >= NOW() - INTERVAL '${period}'
        ORDER BY analysis_date DESC
      `);
      
      const sentimentDistribution = await this.db.query(`
        SELECT 
          market_sentiment,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM daily_analysis
        WHERE analysis_date >= NOW() - INTERVAL '${period}'
        GROUP BY market_sentiment
      `);
      
      res.json({
        success: true,
        data: {
          trend,
          distribution: sentimentDistribution,
          period
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get prediction accuracy metrics
  async getPredictionAccuracy(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        time_horizon,
        prediction_type,
        period = '90d'
      } = req.query;
      
      let query = `
        SELECT 
          p.time_horizon,
          p.prediction_type,
          AVG(pc.accuracy_score) as avg_accuracy,
          COUNT(*) as total_predictions,
          COUNT(pc.id) as evaluated_predictions,
          AVG(p.confidence_level) as avg_confidence,
          CORR(p.confidence_level, pc.accuracy_score) as confidence_correlation
        FROM predictions p
        LEFT JOIN prediction_comparisons pc ON p.id = pc.prediction_id
        WHERE p.created_at >= NOW() - INTERVAL '${period}'
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (time_horizon) {
        query += ` AND p.time_horizon = $${paramIndex}`;
        params.push(time_horizon);
        paramIndex++;
      }
      
      if (prediction_type) {
        query += ` AND p.prediction_type = $${paramIndex}`;
        params.push(prediction_type);
        paramIndex++;
      }
      
      query += ' GROUP BY p.time_horizon, p.prediction_type ORDER BY p.time_horizon';
      
      const accuracy = await this.db.query(query, params);
      
      // Get accuracy trend over time
      const trend = await this.db.query(`
        SELECT 
          DATE_TRUNC('week', pc.comparison_date) as week,
          AVG(pc.accuracy_score) as avg_accuracy,
          COUNT(*) as predictions_evaluated
        FROM prediction_comparisons pc
        JOIN predictions p ON pc.prediction_id = p.id
        WHERE pc.comparison_date >= NOW() - INTERVAL '${period}'
        GROUP BY week
        ORDER BY week DESC
      `);
      
      res.json({
        success: true,
        data: {
          accuracy_by_type: accuracy,
          accuracy_trend: trend,
          period
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get key themes analysis
  async getKeyThemes(req: Request, res: Response, next: NextFunction) {
    try {
      const { period = '7d', limit = 20 } = req.query;
      
      const themes = await this.db.query(`
        SELECT 
          unnest(key_themes) as theme,
          COUNT(*) as occurrence_count,
          COUNT(DISTINCT analysis_date) as days_mentioned,
          AVG(confidence_score) as avg_confidence
        FROM daily_analysis
        WHERE analysis_date >= NOW() - INTERVAL '${period}'
        GROUP BY theme
        ORDER BY occurrence_count DESC
        LIMIT $1
      `, [Number(limit)]);
      
      // Get theme evolution
      const evolution = await this.db.query(`
        SELECT 
          DATE(analysis_date) as date,
          unnest(key_themes) as theme
        FROM daily_analysis
        WHERE analysis_date >= NOW() - INTERVAL '${period}'
        AND key_themes @> ARRAY[(
          SELECT unnest(key_themes) as theme
          FROM daily_analysis
          WHERE analysis_date >= NOW() - INTERVAL '${period}'
          GROUP BY theme
          ORDER BY COUNT(*) DESC
          LIMIT 5
        )]
        ORDER BY date DESC
      `);
      
      res.json({
        success: true,
        data: {
          top_themes: themes,
          theme_evolution: evolution,
          period
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Generate predictions for existing analysis
  async generatePredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const { analysisId } = req.body;
      
      if (!analysisId) {
        return res.status(400).json({
          success: false,
          error: 'analysisId is required'
        });
      }
      
      const analysis = await this.db.tables.dailyAnalysis.findOne({
        id: analysisId
      });
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: 'Analysis not found'
        });
      }
      
      // Generate predictions immediately (for demo purposes)
      // In production, this should be queued
      const predictions = await aiAnalysisService.generatePredictions(analysis as any);
      
      res.json({
        success: true,
        data: {
          predictions,
          message: 'Predictions generated successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

// Create and export singleton instance
import { getDatabase } from '../services/database/db.service';
import { winstonLogger } from '../utils/logger';

const database = getDatabase(winstonLogger);
const cacheService = new CacheService(database, winstonLogger);
const aiService = new OpenAIService(database, cacheService, winstonLogger);

export const analysisController = new AnalysisController(database, cacheService, aiService, winstonLogger);

export default AnalysisController;