// Analysis manager for orchestrating AI analysis following CLAUDE.md specification
import { db } from '@/services/database';
import { cache, cacheKeys, cacheTtl } from '@/services/cache';
import { queue } from '@/services/queue';
import { aiService } from './openai.service';
import { DailyAnalysis, ProcessedContent, Prediction, PredictionComparison } from '@/types';
import { createContextLogger } from '@/utils/logger';

const analysisLogger = createContextLogger('AnalysisManager');

export class AnalysisManager {
  // Generate daily analysis for a specific date
  async generateDailyAnalysis(date: string): Promise<void> {
    analysisLogger.info('Starting daily analysis generation', { date });

    try {
      // Check if analysis already exists
      const existing = await db.query<DailyAnalysis>(
        'SELECT id FROM daily_analysis WHERE analysis_date = $1',
        [date]
      );

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
      const analysisResult = await aiService.generateDailyAnalysis(content);
      
      if (!analysisResult.success || !analysisResult.data) {
        throw analysisResult.error || new Error('Failed to generate analysis');
      }

      // Save analysis to database
      const savedAnalysis = await db.create<DailyAnalysis>('daily_analysis', {
        analysisDate: new Date(date),
        marketSentiment: analysisResult.data.marketSentiment || 'neutral',
        keyThemes: analysisResult.data.keyThemes,
        overallSummary: analysisResult.data.overallSummary || '',
        aiAnalysis: analysisResult.data.aiAnalysis,
        confidenceScore: analysisResult.data.confidenceScore || 0.5,
        sourcesAnalyzed: analysisResult.data.sourcesAnalyzed
      });

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
      const predictionsResult = await aiService.generatePredictions(analysis);
      
      if (!predictionsResult.success || !predictionsResult.data) {
        throw predictionsResult.error || new Error('Failed to generate predictions');
      }

      // Save predictions to database
      for (const prediction of predictionsResult.data) {
        await db.create<Prediction>('predictions', {
          dailyAnalysisId: analysis.id,
          predictionType: prediction.predictionType || 'general',
          predictionText: prediction.predictionText || '',
          confidenceLevel: prediction.confidenceLevel || 0.5,
          timeHorizon: prediction.timeHorizon,
          predictionData: prediction.predictionData
        });
      }

      analysisLogger.info('Predictions saved', { 
        analysisId: analysis.id,
        count: predictionsResult.data.length 
      });

      // Queue future comparison jobs
      await this.schedulePredictionComparisons(predictionsResult.data);
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
      const prediction = await db.findById<Prediction>('predictions', predictionId);
      if (!prediction) {
        throw new Error(`Prediction not found: ${predictionId}`);
      }

      // Get current analysis for comparison date
      const analysisResult = await db.query<DailyAnalysis>(
        'SELECT * FROM daily_analysis WHERE analysis_date = $1',
        [comparisonDate]
      );

      if (!analysisResult || analysisResult.length === 0) {
        // No analysis for comparison date yet, reschedule
        analysisLogger.info('No analysis available for comparison, rescheduling', { 
          predictionId,
          comparisonDate 
        });
        
        await queue.enqueue('prediction_comparison', {
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
      const comparisonResult = await aiService.comparePredictions(
        prediction,
        currentAnalysis
      );

      if (!comparisonResult.success || !comparisonResult.data) {
        throw comparisonResult.error || new Error('Failed to compare prediction');
      }

      // Save comparison
      await db.create<PredictionComparison>('prediction_comparisons', {
        comparisonDate: new Date(comparisonDate),
        previousPredictionId: predictionId,
        currentAnalysisId: currentAnalysis.id,
        accuracyScore: comparisonResult.data.accuracyScore,
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

    const content = await db.query<ProcessedContent>(`
      SELECT 
        pc.*,
        rf.title,
        rf.published_at,
        rf.source_id,
        fs.type as source_type
      FROM processed_content pc
      JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
      JOIN feed_sources fs ON rf.source_id = fs.id
      WHERE rf.published_at >= $1 
      AND rf.published_at <= $2
      AND pc.processed_text IS NOT NULL
      AND pc.processed_text != 'Awaiting transcription'
      ORDER BY rf.published_at DESC
    `, [startOfDay, endOfDay]);

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
      await queue.enqueue('prediction_comparison', {
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
    
    // Get predictions that are due for comparison
    const duePredictions = await db.query<{
      id: string;
      created_at: Date;
      time_horizon: string;
    }>(`
      SELECT p.id, p.created_at, p.time_horizon
      FROM predictions p
      LEFT JOIN prediction_comparisons pc ON p.id = pc.previous_prediction_id
      WHERE pc.id IS NULL
      AND (
        (p.time_horizon = '1_week' AND p.created_at <= NOW() - INTERVAL '7 days') OR
        (p.time_horizon = '1_month' AND p.created_at <= NOW() - INTERVAL '1 month') OR
        (p.time_horizon = '3_months' AND p.created_at <= NOW() - INTERVAL '3 months') OR
        (p.time_horizon = '6_months' AND p.created_at <= NOW() - INTERVAL '6 months') OR
        (p.time_horizon = '1_year' AND p.created_at <= NOW() - INTERVAL '1 year')
      )
    `);

    analysisLogger.info('Found due predictions', { 
      count: duePredictions.length 
    });

    // Queue comparison for each due prediction
    for (const prediction of duePredictions) {
      await queue.enqueue('prediction_comparison', {
        predictionId: prediction.id,
        date: today
      }, 3);
    }
  }
}

// Export singleton instance
export const analysisManager = new AnalysisManager();