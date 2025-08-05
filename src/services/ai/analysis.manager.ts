// Analysis manager for orchestrating AI analysis following CLAUDE.md specification
import { db } from '../database/index';
import { cache, cacheKeys, cacheTtl } from '../cache/index';
import { queueService } from '../database/queue';
import OpenAIService from './openai.service';
import { DailyAnalysis, ProcessedContent, Prediction, PredictionComparison } from '../../types';
import { createContextLogger } from '../../utils/logger';

const analysisLogger = createContextLogger('AnalysisManager');

export class AnalysisManager {
  private aiService: OpenAIService;

  constructor() {
    // Import required dependencies
    const { DatabaseService } = require('../database/db.service');
    const { CacheService } = require('../cache/cache.service');
    const winston = require('winston');
    
    // Create logger instance
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
    
    this.aiService = new OpenAIService(
      new DatabaseService(),
      new CacheService(),
      logger
    );
  }
  // Generate daily analysis for a specific date
  async generateDailyAnalysis(date: string): Promise<void> {
    analysisLogger.info('Starting daily analysis generation', { date });

    try {
      // Check if analysis already exists
      const { data: existing, error } = await db.from('daily_analysis')
        .select('id')
        .eq('analysis_date', date);
      
      if (error) throw error;

      if (existing.length > 0) {
        analysisLogger.warn('Analysis already exists for date', { date });
        return;
      }

      // Get processed content for the date
      const content = await this.getContentForDate(date);
      
      if (content.length === 0) {
        analysisLogger.warn('No content available for analysis', { date });
        throw new Error('No content available for analysis');
      }

      analysisLogger.info('Content retrieved for analysis', { 
        date, 
        count: content.length 
      });

      // Generate analysis using AI
      const analysisResult = await this.aiService.generateDailyAnalysis(new Date(date));

      // The analysis is already saved by the AI service
      const savedAnalysis = analysisResult;

      analysisLogger.info('Daily analysis saved', { 
        analysisId: savedAnalysis.id,
        date 
      });

      // Generate predictions
      await this.generatePredictions(savedAnalysis);

      // Invalidate cache
      await cache.delete(cacheKeys.dailyAnalysis(date));

      analysisLogger.info('Daily analysis generation completed', { 
        analysisId: savedAnalysis.id,
        date 
      });
    } catch (error) {
      analysisLogger.error('Failed to generate daily analysis', { 
        date, 
        error 
      });
      throw error;
    }
  }

  // Generate predictions for an analysis
  private async generatePredictions(analysis: DailyAnalysis): Promise<void> {
    analysisLogger.info('Generating predictions', { 
      analysisId: analysis.id 
    });

    try {
      // Generate predictions using AI
      const predictionsResult = await this.aiService.generatePredictions(analysis);

      // Schedule future comparisons for these predictions
      await this.schedulePredictionComparisons(predictionsResult);

      analysisLogger.info('Predictions saved', { 
        analysisId: analysis.id,
        count: predictionsResult.length 
      });

    } catch (error) {
      analysisLogger.error('Failed to generate predictions', { 
        analysisId: analysis.id,
        error 
      });
      // Don't throw - predictions are secondary to main analysis
    }
  }

  // Compare prediction with actual outcome
  async comparePrediction(predictionId: string, comparisonDate: string): Promise<void> {
    analysisLogger.info('Comparing prediction', { 
      predictionId, 
      comparisonDate 
    });

    try {
      // Get prediction
      const { data: prediction, error: predError } = await db.from('predictions')
        .select('*')
        .eq('id', predictionId)
        .single();
        
      if (predError || !prediction) {
        throw new Error(`Prediction not found: ${predictionId}`);
      }

      // Get current analysis for comparison date
      const { data: analysisResult, error: analysisError } = await db.from('daily_analysis')
        .select('*')
        .eq('analysis_date', comparisonDate);
        
      if (analysisError) throw analysisError;

      if (!analysisResult || analysisResult.length === 0) {
        // No analysis for comparison date yet, reschedule
        analysisLogger.info('No analysis available for comparison, rescheduling', { 
          predictionId,
          comparisonDate 
        });
        
        await queueService.enqueue('prediction_comparison', {
          predictionId,
          date: comparisonDate
        }, 5, 86400); // Retry in 24 hours
        
        return;
      }

      const currentAnalysis = analysisResult[0]!;

      // Check if comparison already exists
      const existingComparison = await db.query(
        'SELECT id FROM prediction_comparisons WHERE previous_prediction_id = $1',
        [predictionId]
      );

      if (existingComparison.length > 0) {
        analysisLogger.info('Comparison already exists', { predictionId });
        return;
      }

      // Compare using AI
      const comparisonResult = await this.aiService.comparePredictions(
        prediction,
        currentAnalysis
      );

      if (!comparisonResult.success || !comparisonResult.data) {
        throw comparisonResult.error || new Error('Failed to compare prediction');
      }

      // Save comparison
      const { error: compError } = await db.from('prediction_comparisons').insert({
        comparison_date: new Date(comparisonDate),
        previous_prediction_id: predictionId,
        current_analysis_id: currentAnalysis.id,
        accuracy_score: comparisonResult.data.accuracyScore,
        outcomeDescription: comparisonResult.data.outcomeDescription,
        comparisonAnalysis: comparisonResult.data.comparisonAnalysis
      });

      analysisLogger.info('Prediction comparison saved', { 
        predictionId,
        accuracy: comparisonResult.data.accuracyScore 
      });
    } catch (error) {
      analysisLogger.error('Failed to compare prediction', { 
        predictionId,
        error 
      });
      throw error;
    }
  }

  // Get processed content for a specific date
  private async getContentForDate(date: string): Promise<ProcessedContent[]> {
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;

    const { data: content, error } = await db.from('processed_content')
      .select(`
        *,
        raw_feeds!inner (
          title,
          published_at,
          source_id,
          feed_sources!inner (
            type
          )
        )
      `)
      .gte('raw_feeds.published_at', startOfDay)
      .lte('raw_feeds.published_at', endOfDay)
      .not('processed_text', 'is', null)
      .neq('processed_text', 'Awaiting transcription')
      .order('raw_feeds(published_at)', { ascending: false });
      
    if (error) throw error;

    return content;
  }

  // Schedule future prediction comparisons
  private async schedulePredictionComparisons(predictions: Prediction[]): Promise<void> {
    for (const prediction of predictions) {
      // Calculate comparison date based on time horizon
      const comparisonDate = this.calculateComparisonDate(
        prediction.createdAt || new Date(),
        prediction.timeHorizon
      );

      // Calculate delay in seconds
      const delayMs = comparisonDate.getTime() - Date.now();
      const delaySeconds = Math.max(0, Math.floor(delayMs / 1000));

      // Queue comparison job
      await queueService.enqueue('prediction_comparison', {
        predictionId: prediction.id,
        date: comparisonDate.toISOString().split('T')[0]
      }, 3, delaySeconds);

      analysisLogger.debug('Scheduled prediction comparison', { 
        predictionId: prediction.id,
        timeHorizon: prediction.timeHorizon,
        comparisonDate 
      });
    }
  }

  // Calculate when to compare prediction based on time horizon
  private calculateComparisonDate(createdAt: Date, timeHorizon: string): Date {
    const created = new Date(createdAt);
    
    switch (timeHorizon) {
      case '1_week':
        created.setDate(created.getDate() + 7);
        break;
      case '1_month':
        created.setMonth(created.getMonth() + 1);
        break;
      case '3_months':
        created.setMonth(created.getMonth() + 3);
        break;
      case '6_months':
        created.setMonth(created.getMonth() + 6);
        break;
      case '1_year':
        created.setFullYear(created.getFullYear() + 1);
        break;
    }
    
    return created;
  }

  // Run daily analysis for today
  async runDailyAnalysis(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]!;
    await this.generateDailyAnalysis(today);
  }

  // Compare all due predictions
  async compareAllDuePredictions(): Promise<void> {
    analysisLogger.info('Checking for due predictions');

    const today = new Date().toISOString().split('T')[0];
    
    // Get predictions that are due for comparison - using RPC for complex query
    const { data: duePredictions, error } = await db.rpc('get_due_predictions');
    
    if (error) {
      analysisLogger.error('Failed to get due predictions', { error });
      return;
    }

    analysisLogger.info('Found due predictions', { 
      count: duePredictions.length 
    });

    // Queue comparison for each due prediction
    for (const prediction of duePredictions) {
      await queueService.enqueue('prediction_comparison', {
        predictionId: prediction.id,
        date: today
      }, 3);
    }
  }
}

// Export singleton instance
export const analysisManager = new AnalysisManager();