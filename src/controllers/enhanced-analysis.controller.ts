/**
 * Enhanced Analysis Controller
 * Integrates advanced AI prompting, validation, and ensemble methods
 */

import { Request, Response } from 'express';
import { db } from '@/services/database';
import { logger } from '@/utils/logger';
import { EnhancedAnalysisService } from '../services/ai/enhanced-analysis';
import { ValidationSystem } from '../services/ai/validation-system';
import { AnalysisContext } from '../services/ai/enhanced-prompts';

export class EnhancedAnalysisController {
  private enhancedAnalysisService = new EnhancedAnalysisService();
  private validationSystem = new ValidationSystem();

  /**
   * Generate Enhanced Daily Analysis with Advanced Reasoning
   */
  async generateEnhancedDailyAnalysis(req: Request, res: Response) {
    try {
      const { date = new Date().toISOString().split('T')[0] } = req.body;
      
      logger.info('Starting enhanced daily analysis', {
        metadata: [{ date, requestedBy: 'api' }]
      });

      // 1. Get processed content for analysis
      const client = db.getClient();
      const { data: processedContent, error: contentError } = await client
        .from('processed_content')
        .select(`
          *,
          raw_feeds!inner(
            source_id,
            title,
            published_at,
            feed_sources!inner(name, type)
          )
        `)
        .gte('created_at', date)
        .lt('created_at', new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (contentError) throw contentError;

      if (!processedContent || processedContent.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No processed content available for analysis'
        });
      }

      // 2. Prepare analysis context
      const context: AnalysisContext = {
        contentCount: processedContent.length,
        timeframe: '24 hours',
        sources: [...new Set(processedContent.map(item => 
          item.raw_feeds?.feed_sources?.name
        ).filter(Boolean))],
        marketConditions: await this.detectMarketRegime()
      };

      // 3. Generate enhanced analysis with Chain-of-Thought reasoning
      const enhancedAnalysis = await this.enhancedAnalysisService.generateEnhancedAnalysis(
        processedContent,
        context
      );

      // 4. Validate analysis quality and detect biases
      const validationResult = await this.validationSystem.validateAnalysis(enhancedAnalysis);

      // 5. Apply corrections if needed
      let finalAnalysis = enhancedAnalysis;
      if (!validationResult.isValid && validationResult.corrections.length > 0) {
        logger.info('Applying analysis corrections', {
          metadata: [{
            issuesFound: validationResult.issues.length,
            correctionsApplied: validationResult.corrections.length,
            qualityScore: validationResult.qualityScore
          }]
        });

        // Re-generate analysis with corrections applied
        finalAnalysis = await this.applyAnalysisCorrections(enhancedAnalysis, validationResult.corrections);
      }

      // 6. Generate SWOT analysis
      const entities = this.extractTopEntities(processedContent);
      const swotAnalysis = await this.enhancedAnalysisService.generateSWOTAnalysis(
        entities,
        { analysis: finalAnalysis, content: processedContent }
      );

      // 7. Generate scenario analysis
      const scenarioAnalysis = await this.enhancedAnalysisService.generateScenarioAnalysis(
        finalAnalysis,
        '1_month'
      );

      // 8. Store enhanced analysis in database
      const { data: storedAnalysis, error: storeError } = await client
        .from('daily_analysis')
        .insert({
          analysis_date: date,
          market_sentiment: finalAnalysis.market_sentiment,
          key_themes: finalAnalysis.key_themes,
          overall_summary: finalAnalysis.overall_summary,
          ai_analysis: {
            reasoning_chain: finalAnalysis.reasoning_chain,
            market_drivers: finalAnalysis.market_drivers,
            risk_factors: finalAnalysis.risk_factors,
            opportunities: finalAnalysis.opportunities,
            geopolitical_context: finalAnalysis.geopolitical_context,
            economic_indicators: finalAnalysis.economic_indicators,
            alternative_scenarios: finalAnalysis.alternative_scenarios,
            swot_analysis: swotAnalysis,
            scenario_analysis: scenarioAnalysis
          },
          confidence_score: finalAnalysis.confidence_score,
          sources_analyzed: context.contentCount,
          reasoning_chain: finalAnalysis.reasoning_chain,
          alternative_scenarios: finalAnalysis.alternative_scenarios,
          assumptions: finalAnalysis.assumptions,
          uncertainties: finalAnalysis.uncertainties,
          conviction_level: finalAnalysis.conviction_level,
          time_sensitivity: finalAnalysis.time_sensitivity,
          methodology_used: 'enhanced_cot_reasoning',
          source_credibility_weighted: true
        })
        .select()
        .single();

      if (storeError) throw storeError;

      // 9. Store validation results for meta-learning
      await this.storeValidationResults(storedAnalysis.id, validationResult);

      logger.info('Enhanced daily analysis completed', {
        metadata: [{
          analysisId: storedAnalysis.id,
          qualityScore: validationResult.qualityScore,
          reasoning_steps: finalAnalysis.reasoning_chain.length,
          confidence: finalAnalysis.confidence_score,
          conviction: finalAnalysis.conviction_level
        }]
      });

      res.json({
        success: true,
        data: {
          analysis: storedAnalysis,
          validation: {
            qualityScore: validationResult.qualityScore,
            isValid: validationResult.isValid,
            issuesFound: validationResult.issues.length
          },
          swot: swotAnalysis,
          scenarios: scenarioAnalysis,
          metadata: {
            contentProcessed: context.contentCount,
            sourcesAnalyzed: context.sources.length,
            methodologyUsed: 'enhanced_cot_reasoning'
          }
        }
      });

    } catch (error) {
      logger.error('Enhanced daily analysis failed', {
        metadata: [{ error: error.message }]
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate enhanced analysis',
        details: error.message
      });
    }
  }

  /**
   * Generate Ensemble Predictions with Multi-Methodology Approach
   */
  async generateEnsemblePredictions(req: Request, res: Response) {
    try {
      const { analysisId, timeHorizons = ['1_week', '1_month', '3_months'] } = req.body;

      // 1. Get the analysis
      const client = db.getClient();
      const { data: analysis, error: analysisError } = await client
        .from('daily_analysis')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (analysisError) throw analysisError;

      const predictions = [];

      // 2. Generate ensemble predictions for each time horizon
      for (const timeHorizon of timeHorizons) {
        logger.info('Generating ensemble prediction', {
          metadata: [{ analysisId, timeHorizon }]
        });

        const ensemblePrediction = await this.enhancedAnalysisService.generateEnsemblePredictions(
          analysis,
          timeHorizon
        );

        // 3. Validate prediction quality
        const predictionValidation = await this.validationSystem.validatePrediction(ensemblePrediction);

        // 4. Apply corrections if needed
        let finalPrediction = ensemblePrediction;
        if (!predictionValidation.isValid) {
          finalPrediction = await this.applyPredictionCorrections(
            ensemblePrediction, 
            predictionValidation.corrections
          );
        }

        // 5. Store prediction in database
        const { data: storedPrediction, error: predictionError } = await client
          .from('predictions')
          .insert({
            daily_analysis_id: analysisId,
            prediction_type: finalPrediction.ensemble_prediction.prediction_type,
            prediction_text: finalPrediction.ensemble_prediction.prediction_text,
            confidence_level: finalPrediction.ensemble_prediction.confidence_level,
            time_horizon: timeHorizon,
            prediction_data: {
              ensemble_data: finalPrediction,
              methodology_breakdown: finalPrediction.methodology_predictions,
              uncertainty_factors: finalPrediction.uncertainty_factors,
              confidence_calibration: finalPrediction.confidence_calibration
            },
            ensemble_data: finalPrediction,
            methodology_breakdown: finalPrediction.methodology_predictions,
            uncertainty_factors: finalPrediction.uncertainty_factors,
            measurable_outcomes: finalPrediction.ensemble_prediction.measurable_outcomes,
            confidence_calibration: finalPrediction.confidence_calibration,
            evaluation_metrics: {
              validation_score: predictionValidation.qualityScore,
              methodology_count: finalPrediction.methodology_predictions.length,
              ensemble_confidence: finalPrediction.ensemble_prediction.confidence_level
            }
          })
          .select()
          .single();

        if (predictionError) throw predictionError;

        predictions.push({
          prediction: storedPrediction,
          validation: predictionValidation,
          timeHorizon
        });
      }

      logger.info('Ensemble predictions generated', {
        metadata: [{
          analysisId,
          predictionsGenerated: predictions.length,
          timeHorizons: timeHorizons.join(', ')
        }]
      });

      res.json({
        success: true,
        data: {
          predictions,
          summary: {
            total: predictions.length,
            validated: predictions.filter(p => p.validation.isValid).length,
            averageQuality: predictions.reduce((sum, p) => sum + p.validation.qualityScore, 0) / predictions.length
          }
        }
      });

    } catch (error) {
      logger.error('Ensemble prediction generation failed', {
        metadata: [{ error: error.message }]
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate ensemble predictions',
        details: error.message
      });
    }
  }

  /**
   * Evaluate Prediction Accuracy with Meta-Learning
   */
  async evaluatePredictionAccuracy(req: Request, res: Response) {
    try {
      const { predictionId, actualOutcome, evaluationNotes } = req.body;

      // 1. Get the original prediction
      const client = db.getClient();
      const { data: prediction, error: predictionError } = await client
        .from('predictions')
        .select(`
          *,
          daily_analysis!inner(*)
        `)
        .eq('id', predictionId)
        .single();

      if (predictionError) throw predictionError;

      // 2. Get current market state for comparison
      const currentMarketState = await this.getCurrentMarketState();

      // 3. Calculate time elapsed
      const timeElapsed = this.calculateTimeElapsed(prediction.created_at);

      // 4. Generate AI-powered accuracy evaluation
      const accuracyEvaluation = await this.enhancedAnalysisService.evaluatePredictionAccuracy(
        prediction,
        { actualOutcome, currentMarketState, evaluationNotes },
        timeElapsed
      );

      // 5. Store accuracy evaluation
      const { data: storedEvaluation, error: evaluationError } = await client
        .from('prediction_accuracy')
        .insert({
          prediction_id: predictionId,
          evaluation_date: new Date().toISOString().split('T')[0],
          accuracy_type: 'comprehensive',
          accuracy_score: accuracyEvaluation.accuracy_scores.overall_accuracy,
          actual_outcome: actualOutcome,
          prediction_text: prediction.prediction_text,
          error_analysis: accuracyEvaluation.error_analysis,
          contributing_factors: Object.values(accuracyEvaluation.methodology_performance),
          lessons_learned: accuracyEvaluation.lessons_learned.what_worked.concat(
            accuracyEvaluation.lessons_learned.what_failed
          )
        })
        .select()
        .single();

      if (evaluationError) throw evaluationError;

      // 6. Update meta-learning database
      await this.updateMetaLearningInsights(accuracyEvaluation);

      logger.info('Prediction accuracy evaluated', {
        metadata: [{
          predictionId,
          accuracy: accuracyEvaluation.accuracy_scores.overall_accuracy,
          outcome: accuracyEvaluation.prediction_assessment.outcome
        }]
      });

      res.json({
        success: true,
        data: {
          evaluation: storedEvaluation,
          detailedAnalysis: accuracyEvaluation,
          insights: {
            accuracy: accuracyEvaluation.accuracy_scores,
            lessons: accuracyEvaluation.lessons_learned,
            improvements: accuracyEvaluation.future_recommendations
          }
        }
      });

    } catch (error) {
      logger.error('Prediction accuracy evaluation failed', {
        metadata: [{ error: error.message }]
      });

      res.status(500).json({
        success: false,
        error: 'Failed to evaluate prediction accuracy',
        details: error.message
      });
    }
  }

  /**
   * Get Analysis Quality Metrics
   */
  async getAnalysisQualityMetrics(req: Request, res: Response) {
    try {
      const { startDate, endDate, limit = 10000 } = req.query;

      // Get quality metrics from recent analyses
      const client = db.getClient();
      const { data: qualityData, error } = await client
        .from('meta_learning_insights')
        .select('*')
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (error) throw error;

      // Calculate aggregate metrics
      const metrics = this.calculateAggregateQualityMetrics(qualityData || []);

      res.json({
        success: true,
        data: {
          metrics,
          timeline: qualityData,
          summary: {
            totalAnalyses: qualityData?.length || 0,
            averageQuality: metrics.averageQualityScore,
            improvementTrend: metrics.qualityTrend
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get quality metrics', {
        metadata: [{ error: error.message }]
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve quality metrics',
        details: error.message
      });
    }
  }

  /**
   * Get Methodology Performance
   */
  async getMethodologyPerformance(req: Request, res: Response) {
    try {
      // Use the database function to get methodology performance
      const client = db.getClient();
      const { data: performance, error } = await client
        .rpc('get_methodology_performance');

      if (error) throw error;

      res.json({
        success: true,
        data: {
          methodologies: performance,
          recommendations: this.generateMethodologyRecommendations(performance)
        }
      });

    } catch (error) {
      logger.error('Failed to get methodology performance', {
        metadata: [{ error: error.message }]
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve methodology performance',
        details: error.message
      });
    }
  }

  // Private helper methods

  private async detectMarketRegime(): Promise<'bullish' | 'bearish' | 'neutral' | 'volatile'> {
    try {
      const client = db.getClient();
      const { data: regimeData } = await client.rpc('detect_market_regime');
      return regimeData || 'neutral';
    } catch (error) {
      logger.warn('Market regime detection failed', { metadata: [{ error: error.message }] });
      return 'neutral';
    }
  }

  private extractTopEntities(content: any[]): any[] {
    const entityMap = new Map();
    
    content.forEach(item => {
      if (item.entities && Array.isArray(item.entities)) {
        item.entities.forEach((entity: any) => {
          const key = `${entity.type}:${entity.name}`;
          if (entityMap.has(key)) {
            entityMap.get(key).mentions++;
          } else {
            entityMap.set(key, {
              name: entity.name,
              type: entity.type,
              mentions: 1,
              sentiment: item.sentiment_score || 0
            });
          }
        });
      }
    });

    return Array.from(entityMap.values())
      .sort((a, b) => b.mentions - a.mentions);
  }

  private async applyAnalysisCorrections(analysis: any, corrections: any[]): Promise<any> {
    // Apply corrections to analysis
    let correctedAnalysis = { ...analysis };

    corrections.forEach(correction => {
      if (correction.field === 'confidence_score' && correction.suggestedValue) {
        correctedAnalysis.confidence_score = correction.suggestedValue;
      }
      // Add more correction logic as needed
    });

    return correctedAnalysis;
  }

  private async applyPredictionCorrections(prediction: any, corrections: any[]): Promise<any> {
    // Apply corrections to prediction
    let correctedPrediction = { ...prediction };

    corrections.forEach(correction => {
      // Apply specific corrections based on field
      if (correction.field.includes('confidence_level')) {
        // Adjust confidence level
        correctedPrediction.ensemble_prediction.confidence_level = 
          Math.max(0.1, Math.min(1.0, correctedPrediction.ensemble_prediction.confidence_level * 0.9));
      }
    });

    return correctedPrediction;
  }

  private async storeValidationResults(analysisId: string, validation: any): Promise<void> {
    try {
      const client = db.getClient();
      await client
        .from('meta_learning_insights')
        .insert({
          accuracy_scores: { validation_quality: validation.qualityScore },
          methodology_performance: { enhanced_analysis: 'completed' },
          error_analysis: { issues_found: validation.issues.length },
          lessons_learned: { validation_applied: validation.corrections.length > 0 },
          calibration_adjustments: {},
          meta_insights: {
            analysis_id: analysisId,
            quality_score: validation.qualityScore,
            issues_detected: validation.issues
          }
        });
    } catch (error) {
      logger.error('Failed to store validation results', {
        metadata: [{ error: error.message }]
      });
    }
  }

  private async getCurrentMarketState(): Promise<any> {
    const client = db.getClient();
    const { data: latestAnalysis } = await client
      .from('daily_analysis')
      .select('*')
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single();

    return latestAnalysis || {};
  }

  private calculateTimeElapsed(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'same day';
    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    return `${Math.floor(diffDays / 30)} months`;
  }

  private async updateMetaLearningInsights(evaluation: any): Promise<void> {
    // Store insights in meta-learning database for continuous improvement
    try {
      const client = db.getClient();
      await client
        .from('meta_learning_insights')
        .insert({
          accuracy_scores: evaluation.accuracy_scores,
          methodology_performance: evaluation.methodology_performance,
          error_analysis: evaluation.error_analysis,
          lessons_learned: evaluation.lessons_learned,
          calibration_adjustments: evaluation.calibration_adjustments,
          meta_insights: evaluation.meta_learning_insights
        });
    } catch (error) {
      logger.error('Failed to update meta-learning insights', {
        metadata: [{ error: error.message }]
      });
    }
  }

  private calculateAggregateQualityMetrics(data: any[]): any {
    if (!data || data.length === 0) {
      return {
        averageQualityScore: 0,
        qualityTrend: 'no_data'
      };
    }

    const qualityScores = data.map(item => 
      item.accuracy_scores?.validation_quality || 0.5
    );

    const averageQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    
    // Calculate trend (simplified)
    const recentScores = qualityScores.slice(0, Math.floor(qualityScores.length / 2));
    const olderScores = qualityScores.slice(Math.floor(qualityScores.length / 2));
    
    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
    
    const qualityTrend = recentAvg > olderAvg + 0.05 ? 'improving' : 
                        recentAvg < olderAvg - 0.05 ? 'declining' : 'stable';

    return {
      averageQualityScore,
      qualityTrend,
      totalAnalyses: data.length,
      recentQuality: recentAvg,
      historicalQuality: olderAvg
    };
  }

  private generateMethodologyRecommendations(performance: any[]): any[] {
    const recommendations: any[] = [];

    performance.forEach(method => {
      if (method.avg_accuracy < 0.6) {
        recommendations.push({
          methodology: method.methodology,
          type: 'improvement_needed',
          suggestion: 'Consider reducing weight or improving methodology',
          priority: 'high'
        });
      } else if (method.avg_accuracy > 0.8) {
        recommendations.push({
          methodology: method.methodology,
          type: 'high_performer',
          suggestion: 'Consider increasing weight in ensemble',
          priority: 'medium'
        });
      }
    });

    return recommendations;
  }
}

export default new EnhancedAnalysisController();