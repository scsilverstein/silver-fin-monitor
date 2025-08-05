/**
 * Enhanced AI Analysis Service with Advanced Reasoning Frameworks
 * Implements Chain-of-Thought, SWOT Analysis, Scenario Planning, and Meta-Learning
 */

import OpenAI from 'openai';
import { db } from '../database/index';
import { logger } from '../../utils/logger.js';
import {
  createAdvancedAnalysisPrompt,
  createPredictionPrompt,
  createAccuracyEvaluationPrompt,
  createSWOTAnalysisPrompt,
  createScenarioAnalysisPrompt,
  AnalysisContext,
  StructuredAnalysis,
  ReasoningStep
} from './enhanced-prompts.js';

interface EnhancedAnalysisResult {
  reasoning_chain: ReasoningStep[];
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence_score: number;
  key_themes: string[];
  risk_factors: string[];
  opportunities: string[];
  market_drivers: string[];
  geopolitical_context: string;
  economic_indicators: string[];
  overall_summary: string;
  assumptions: string[];
  uncertainties: string[];
  alternative_scenarios: Array<{
    scenario: string;
    probability: number;
    description: string;
  }>;
  conviction_level: 'high' | 'medium' | 'low';
  time_sensitivity: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
}

interface EnsemblePrediction {
  methodology_predictions: Array<{
    method: string;
    prediction: string;
    confidence: number;
    probability_range: { lower: number; upper: number };
    reasoning: string;
    key_assumptions: string[];
    risk_factors: string[];
    catalysts: string[];
  }>;
  ensemble_prediction: {
    prediction_text: string;
    confidence_level: number;
    probability_distribution: {
      very_likely: number;
      likely: number;
      possible: number;
      unlikely: number;
    };
    time_horizon: string;
    prediction_type: string;
    measurable_outcomes: Array<{
      metric: string;
      target_value: string;
      timeframe: string;
      success_criteria: string;
    }>;
  };
  methodology_weights: Record<string, number>;
  uncertainty_factors: string[];
  model_limitations: string[];
  update_triggers: string[];
  confidence_calibration: {
    overconfidence_check: string;
    base_rate_consideration: string;
    outside_view: string;
  };
}

interface AccuracyEvaluation {
  accuracy_scores: {
    overall_accuracy: number;
    directional_accuracy: number;
    magnitude_accuracy: number;
    timing_accuracy: number;
    confidence_calibration: number;
  };
  prediction_assessment: {
    outcome: 'correct' | 'partially_correct' | 'incorrect';
    accuracy_description: string;
    confidence_evaluation: string;
    surprise_factors: string[];
  };
  methodology_performance: {
    best_performing_method: string;
    worst_performing_method: string;
    ensemble_vs_individual: string;
    context_factors: string[];
  };
  error_analysis: {
    error_type: string;
    systematic_biases: string[];
    random_factors: string[];
    model_limitations: string[];
  };
  lessons_learned: {
    what_worked: string[];
    what_failed: string[];
    missing_information: string[];
    process_improvements: string[];
  };
  calibration_adjustments: {
    methodology_weight_changes: Record<string, number>;
    confidence_scoring_adjustment: string;
    uncertainty_factor_updates: string[];
    prediction_framework_updates: string[];
  };
  meta_learning_insights: {
    prediction_patterns: string[];
    market_regime_dependency: string;
    data_quality_impact: string;
    external_factor_influence: string;
  };
  future_recommendations: {
    information_sources: string[];
    methodology_adjustments: string[];
    confidence_calibration: string[];
    prediction_frequency: string;
  };
}

export class EnhancedAnalysisService {
  private openai: OpenAI;
  private fallbackModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4'];
  private currentModelIndex = 0;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Enhanced Daily Analysis with Chain-of-Thought Reasoning
   */
  async generateEnhancedAnalysis(
    processedContent: any[],
    context: AnalysisContext
  ): Promise<EnhancedAnalysisResult> {
    try {
      // Prepare content with enhanced context
      const enrichedContent = this.enrichContentContext(processedContent);
      
      // Create advanced prompt with Chain-of-Thought reasoning
      const prompt = createAdvancedAnalysisPrompt(enrichedContent, context);
      
      // Execute analysis with fallback model support
      const response = await this.executeWithFallback(prompt, {
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response) as EnhancedAnalysisResult;
      
      // Validate and enhance the analysis
      const validatedAnalysis = this.validateAnalysisStructure(analysis);
      
      // Store reasoning chain for meta-learning
      await this.storeReasoningChain(validatedAnalysis, context);
      
      logger.info('Enhanced analysis generated successfully', {
        metadata: [{
          reasoning_steps: validatedAnalysis.reasoning_chain.length,
          confidence: validatedAnalysis.confidence_score,
          conviction: validatedAnalysis.conviction_level
        }]
      });

      return validatedAnalysis;
    } catch (error) {
      logger.error('Enhanced analysis generation failed', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
      throw error;
    }
  }

  /**
   * Multi-Methodology Ensemble Predictions
   */
  async generateEnsemblePredictions(
    analysis: EnhancedAnalysisResult,
    timeHorizon: string
  ): Promise<EnsemblePrediction> {
    try {
      // Get historical predictions for calibration
      const previousPredictions = await this.getHistoricalPredictions(timeHorizon);
      
      // Create ensemble prediction prompt
      const prompt = createPredictionPrompt(analysis, timeHorizon, previousPredictions);
      
      // Execute prediction with ensemble methods
      const response = await this.executeWithFallback(prompt, {
        response_format: { type: 'json_object' }
      });

      const prediction = JSON.parse(response) as EnsemblePrediction;
      
      // Apply meta-learning adjustments
      const calibratedPrediction = await this.applyMetaLearningCalibration(prediction);
      
      // Store prediction for future evaluation
      await this.storePredictionForEvaluation(calibratedPrediction, analysis);
      
      logger.info('Ensemble prediction generated', {
        metadata: [{
          methodologies: prediction.methodology_predictions.length,
          ensemble_confidence: prediction.ensemble_prediction.confidence_level,
          time_horizon: timeHorizon
        }]
      });

      return calibratedPrediction;
    } catch (error) {
      logger.error('Ensemble prediction generation failed', {
        metadata: [{ error: error instanceof Error ? error.message : String(error), timeHorizon }]
      });
      throw error;
    }
  }

  /**
   * SWOT Analysis Integration
   */
  async generateSWOTAnalysis(
    entities: any[],
    marketContext: any
  ): Promise<any> {
    try {
      const prompt = createSWOTAnalysisPrompt(entities, marketContext);
      
      const response = await this.executeWithFallback(prompt, {
        response_format: { type: 'json_object' }
      });

      const swotAnalysis = JSON.parse(response);
      
      logger.info('SWOT analysis generated', {
        metadata: [{
          entities_analyzed: entities.length,
          strengths: swotAnalysis.swot_analysis?.strengths?.length || 0,
          weaknesses: swotAnalysis.swot_analysis?.weaknesses?.length || 0,
          opportunities: swotAnalysis.swot_analysis?.opportunities?.length || 0,
          threats: swotAnalysis.swot_analysis?.threats?.length || 0
        }]
      });

      return swotAnalysis;
    } catch (error) {
      logger.error('SWOT analysis generation failed', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
      throw error;
    }
  }

  /**
   * Scenario Planning Analysis
   */
  async generateScenarioAnalysis(
    baseAnalysis: EnhancedAnalysisResult,
    timeHorizon: string
  ): Promise<any> {
    try {
      const prompt = createScenarioAnalysisPrompt(baseAnalysis, timeHorizon);
      
      const response = await this.executeWithFallback(prompt, {
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });

      const scenarioAnalysis = JSON.parse(response);
      
      // Validate probability distribution
      const totalProbability = scenarioAnalysis.scenarios?.reduce(
        (sum: number, scenario: any) => sum + scenario.probability, 0
      ) || 0;
      
      if (Math.abs(totalProbability - 1.0) > 0.05) {
        logger.warn('Scenario probability distribution does not sum to 1.0', {
          metadata: [{ total_probability: totalProbability }]
        });
      }

      logger.info('Scenario analysis generated', {
        metadata: [{
          scenarios_count: scenarioAnalysis.scenarios?.length || 0,
          probability_sum: totalProbability,
          time_horizon: timeHorizon
        }]
      });

      return scenarioAnalysis;
    } catch (error) {
      logger.error('Scenario analysis generation failed', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
      throw error;
    }
  }

  /**
   * Prediction Accuracy Evaluation and Meta-Learning
   */
  async evaluatePredictionAccuracy(
    originalPrediction: any,
    currentMarketState: any,
    timeElapsed: string
  ): Promise<AccuracyEvaluation> {
    try {
      const prompt = createAccuracyEvaluationPrompt(
        originalPrediction,
        currentMarketState,
        timeElapsed
      );
      
      const response = await this.executeWithFallback(prompt, {
        temperature: 0.2, // Lower temperature for objective evaluation
        response_format: { type: 'json_object' }
      });

      const evaluation = JSON.parse(response) as AccuracyEvaluation;
      
      // Apply meta-learning updates
      await this.updateMetaLearningDatabase(evaluation);
      
      // Update methodology weights based on performance
      await this.updateMethodologyWeights(evaluation.calibration_adjustments);
      
      logger.info('Prediction accuracy evaluated', {
        metadata: [{
          overall_accuracy: evaluation.accuracy_scores.overall_accuracy,
          outcome: evaluation.prediction_assessment.outcome,
          error_type: evaluation.error_analysis.error_type
        }]
      });

      return evaluation;
    } catch (error) {
      logger.error('Prediction accuracy evaluation failed', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
      throw error;
    }
  }

  /**
   * Execute AI request with fallback model support
   */
  private async executeWithFallback(
    prompt: string,
    options: any,
    retryCount = 0
  ): Promise<string> {
    const maxRetries = this.fallbackModels.length;
    
    try {
      const currentModel = this.fallbackModels[this.currentModelIndex];
      
      const completion = await this.openai.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'user', content: prompt }],
        ...options
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.warn(`Model ${this.fallbackModels[this.currentModelIndex]} failed`, {
        metadata: [{ error: error instanceof Error ? error.message : String(error), retry_count: retryCount }]
      });

      if (retryCount < maxRetries - 1) {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.fallbackModels.length;
        return await this.executeWithFallback(prompt, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * Enrich content with additional context
   */
  private enrichContentContext(content: any[]): any[] {
    return content.map(item => ({
      ...item,
      // Add computed fields
      content_age_hours: item.published_at ? 
        Math.floor((Date.now() - new Date(item.published_at).getTime()) / (1000 * 60 * 60)) : null,
      sentiment_strength: Math.abs(item.sentiment_score || 0),
      entity_count: item.entities?.length || 0,
      topic_count: item.key_topics?.length || 0,
      // Add source credibility scoring
      source_credibility: this.calculateSourceCredibility(item.source_name),
      // Add content quality scoring
      content_quality: this.calculateContentQuality(item)
    }));
  }

  /**
   * Calculate source credibility score
   */
  private calculateSourceCredibility(sourceName: string): number {
    const credibilityMap: Record<string, number> = {
      'Financial Times': 0.95,
      'Wall Street Journal': 0.95,
      'Bloomberg': 0.92,
      'Reuters': 0.90,
      'CNBC': 0.85,
      'MarketWatch': 0.80,
      'Yahoo Finance': 0.75,
      // Add more sources as needed
    };
    
    return credibilityMap[sourceName] || 0.70; // Default credibility
  }

  /**
   * Calculate content quality score
   */
  private calculateContentQuality(item: any): number {
    let score = 0.5; // Base score
    
    // Adjust for content length
    const contentLength = (item.processed_text || '').length;
    if (contentLength > 500) score += 0.1;
    if (contentLength > 1000) score += 0.1;
    
    // Adjust for entity count
    const entityCount = item.entities?.length || 0;
    if (entityCount > 3) score += 0.1;
    if (entityCount > 6) score += 0.1;
    
    // Adjust for topic count
    const topicCount = item.key_topics?.length || 0;
    if (topicCount > 2) score += 0.1;
    
    // Adjust for recency
    if (item.content_age_hours !== null && item.content_age_hours < 24) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Validate analysis structure and fill gaps
   */
  private validateAnalysisStructure(analysis: EnhancedAnalysisResult): EnhancedAnalysisResult {
    // Ensure all required fields exist
    const validated = {
      ...analysis,
      reasoning_chain: analysis.reasoning_chain || [],
      key_themes: analysis.key_themes || [],
      risk_factors: analysis.risk_factors || [],
      opportunities: analysis.opportunities || [],
      market_drivers: analysis.market_drivers || [],
      economic_indicators: analysis.economic_indicators || [],
      assumptions: analysis.assumptions || [],
      uncertainties: analysis.uncertainties || [],
      alternative_scenarios: analysis.alternative_scenarios || [],
      confidence_score: Math.max(0.1, Math.min(1.0, analysis.confidence_score || 0.5)),
      conviction_level: analysis.conviction_level || 'medium',
      time_sensitivity: analysis.time_sensitivity || 'medium_term'
    };

    // Validate reasoning chain
    if (validated.reasoning_chain.length < 3) {
      logger.warn('Insufficient reasoning steps in analysis', {
        metadata: [{ steps: validated.reasoning_chain.length }]
      });
    }

    return validated;
  }

  /**
   * Store reasoning chain for meta-learning
   */
  private async storeReasoningChain(
    analysis: EnhancedAnalysisResult,
    context: AnalysisContext
  ): Promise<void> {
    try {
      await db
        .from('reasoning_chains')
        .insert({
          analysis_date: new Date().toISOString().split('T')[0],
          reasoning_steps: analysis.reasoning_chain,
          confidence_score: analysis.confidence_score,
          conviction_level: analysis.conviction_level,
          content_count: context.contentCount,
          timeframe: context.timeframe,
          market_conditions: context.marketConditions
        });
    } catch (error) {
      logger.error('Failed to store reasoning chain', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
    }
  }

  /**
   * Get historical predictions for calibration
   */
  private async getHistoricalPredictions(timeHorizon: string): Promise<any[]> {
    try {
      const { data, error } = await db
        .from('predictions')
        .select('*')
        .eq('time_horizon', timeHorizon)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get historical predictions', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
      return [];
    }
  }

  /**
   * Apply meta-learning calibration to predictions
   */
  private async applyMetaLearningCalibration(
    prediction: EnsemblePrediction
  ): Promise<EnsemblePrediction> {
    try {
      // Get methodology performance weights from meta-learning database
      const { data: weights } = await db
        .from('methodology_weights')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (weights?.weights) {
        // Apply learned weights to ensemble prediction
        const updatedWeights = {
          ...prediction.methodology_weights,
          ...weights.weights
        };
        
        // Recalculate ensemble confidence based on weighted performance
        const weightedConfidence = prediction.methodology_predictions.reduce(
          (sum, pred) => sum + (pred.confidence * (updatedWeights[pred.method.toLowerCase()] || 0.2)),
          0
        );

        return {
          ...prediction,
          methodology_weights: updatedWeights,
          ensemble_prediction: {
            ...prediction.ensemble_prediction,
            confidence_level: Math.min(1.0, weightedConfidence)
          }
        };
      }

      return prediction;
    } catch (error) {
      logger.error('Meta-learning calibration failed', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
      return prediction;
    }
  }

  /**
   * Store prediction for future evaluation
   */
  private async storePredictionForEvaluation(
    prediction: EnsemblePrediction,
    analysis: EnhancedAnalysisResult
  ): Promise<void> {
    try {
      await db
        .from('prediction_evaluations')
        .insert({
          prediction_data: prediction,
          analysis_context: analysis,
          created_at: new Date().toISOString(),
          evaluation_date: this.calculateEvaluationDate(prediction.ensemble_prediction.time_horizon),
          methodology_weights: prediction.methodology_weights
        });
    } catch (error) {
      logger.error('Failed to store prediction for evaluation', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
    }
  }

  /**
   * Update meta-learning database with evaluation results
   */
  private async updateMetaLearningDatabase(evaluation: AccuracyEvaluation): Promise<void> {
    try {
      await db
        .from('meta_learning_insights')
        .insert({
          accuracy_scores: evaluation.accuracy_scores,
          methodology_performance: evaluation.methodology_performance,
          error_analysis: evaluation.error_analysis,
          lessons_learned: evaluation.lessons_learned,
          calibration_adjustments: evaluation.calibration_adjustments,
          meta_insights: evaluation.meta_learning_insights,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to update meta-learning database', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
    }
  }

  /**
   * Update methodology weights based on performance
   */
  private async updateMethodologyWeights(adjustments: any): Promise<void> {
    try {
      await db
        .from('methodology_weights')
        .insert({
          weights: adjustments.methodology_weight_changes,
          confidence_adjustment: adjustments.confidence_scoring_adjustment,
          uncertainty_factors: adjustments.uncertainty_factor_updates,
          framework_updates: adjustments.prediction_framework_updates,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to update methodology weights', {
        metadata: [{ error: error instanceof Error ? error.message : String(error) }]
      });
    }
  }

  /**
   * Calculate when to evaluate a prediction
   */
  private calculateEvaluationDate(timeHorizon: string): string {
    const now = new Date();
    let evaluationDate = new Date(now);

    switch (timeHorizon) {
      case '1_week':
        evaluationDate.setDate(now.getDate() + 7);
        break;
      case '1_month':
        evaluationDate.setMonth(now.getMonth() + 1);
        break;
      case '3_months':
        evaluationDate.setMonth(now.getMonth() + 3);
        break;
      case '6_months':
        evaluationDate.setMonth(now.getMonth() + 6);
        break;
      case '1_year':
        evaluationDate.setFullYear(now.getFullYear() + 1);
        break;
      default:
        evaluationDate.setDate(now.getDate() + 7);
    }

    return evaluationDate.toISOString().split('T')[0];
  }
}

export { EnhancedAnalysisResult, EnsemblePrediction, AccuracyEvaluation };