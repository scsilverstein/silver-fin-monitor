/**
 * AI Validation and Self-Correction System
 * Implements reasoning validation, self-correction, and quality assurance
 */

import { logger } from '../../utils/logger.js';
import { supabase } from '../database/index.js';
import { EnhancedAnalysisResult, EnsemblePrediction } from './enhanced-analysis.js';

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: ValidationIssue[];
  corrections: any[];
  qualityScore: number;
}

interface ValidationIssue {
  type: 'logical_consistency' | 'confidence_calibration' | 'evidence_support' | 'bias_detection' | 'completeness';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
  affectedField: string;
}

interface ReasoningValidation {
  step: number;
  isLogical: boolean;
  evidenceStrength: number;
  consistencyScore: number;
  biasIndicators: string[];
  gaps: string[];
}

interface BiasDetection {
  overconfidenceBias: number;
  confirmationBias: number;
  anchioringBias: number;
  availabilityBias: number;
  recentRecencyBias: number;
}

interface QualityMetrics {
  logicalConsistency: number;
  evidenceQuality: number;
  completeness: number;
  objectivity: number;
  calibration: number;
  overallScore: number;
}

export class ValidationSystem {
  private readonly QUALITY_THRESHOLDS = {
    excellent: 0.85,
    good: 0.70,
    acceptable: 0.55,
    poor: 0.40
  };

  private readonly BIAS_THRESHOLDS = {
    low: 0.3,
    medium: 0.6,
    high: 0.8
  };

  /**
   * Comprehensive Analysis Validation
   */
  async validateAnalysis(analysis: EnhancedAnalysisResult): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const corrections: any[] = [];

    // 1. Validate reasoning chain
    const reasoningValidation = this.validateReasoningChain(analysis.reasoning_chain);
    
    // 2. Check confidence calibration
    const calibrationIssues = this.validateConfidenceCalibration(analysis);
    
    // 3. Detect cognitive biases
    const biasDetection = this.detectCognitiveBiases(analysis);
    
    // 4. Validate evidence support
    const evidenceValidation = this.validateEvidenceSupport(analysis);
    
    // 5. Check completeness
    const completenessValidation = this.validateCompleteness(analysis);
    
    // 6. Logical consistency check
    const consistencyValidation = this.validateLogicalConsistency(analysis);

    // Aggregate all issues
    issues.push(
      ...calibrationIssues,
      ...this.convertBiasToIssues(biasDetection),
      ...evidenceValidation.issues,
      ...completenessValidation.issues,
      ...consistencyValidation.issues
    );

    // Generate corrections
    if (issues.length > 0) {
      corrections.push(...await this.generateCorrections(analysis, issues));
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore({
      logicalConsistency: consistencyValidation.score,
      evidenceQuality: evidenceValidation.score,
      completeness: completenessValidation.score,
      objectivity: 1 - this.calculateOverallBias(biasDetection),
      calibration: calibrationIssues.length === 0 ? 1.0 : 0.5,
      overallScore: 0
    });

    const isValid = qualityScore.overallScore >= this.QUALITY_THRESHOLDS.acceptable;

    logger.info('Analysis validation completed', {
      metadata: [{
        isValid,
        qualityScore: qualityScore.overallScore,
        issuesCount: issues.length,
        correctionsCount: corrections.length
      }]
    });

    return {
      isValid,
      confidence: qualityScore.overallScore,
      issues,
      corrections,
      qualityScore: qualityScore.overallScore
    };
  }

  /**
   * Prediction Validation
   */
  async validatePrediction(prediction: EnsemblePrediction): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const corrections: any[] = [];

    // 1. Validate methodology consistency
    const methodologyIssues = this.validateMethodologyConsistency(prediction);
    
    // 2. Check probability distributions
    const probabilityIssues = this.validateProbabilityDistributions(prediction);
    
    // 3. Validate confidence calibration
    const calibrationIssues = this.validatePredictionCalibration(prediction);
    
    // 4. Check measurable outcomes
    const outcomeIssues = this.validateMeasurableOutcomes(prediction);
    
    // 5. Validate uncertainty quantification
    const uncertaintyIssues = this.validateUncertaintyQuantification(prediction);

    issues.push(
      ...methodologyIssues,
      ...probabilityIssues,
      ...calibrationIssues,
      ...outcomeIssues,
      ...uncertaintyIssues
    );

    const qualityScore = this.calculatePredictionQuality(prediction, issues);
    const isValid = qualityScore >= this.QUALITY_THRESHOLDS.acceptable;

    if (issues.length > 0) {
      corrections.push(...await this.generatePredictionCorrections(prediction, issues));
    }

    return {
      isValid,
      confidence: qualityScore,
      issues,
      corrections,
      qualityScore
    };
  }

  /**
   * Validate Reasoning Chain Logic
   */
  private validateReasoningChain(reasoningChain: any[]): ReasoningValidation[] {
    return reasoningChain.map((step, index) => {
      const isLogical = this.checkStepLogic(step, index);
      const evidenceStrength = this.evaluateEvidenceStrength(step);
      const consistencyScore = this.checkStepConsistency(step, reasoningChain);
      const biasIndicators = this.detectStepBiases(step);
      const gaps = this.identifyReasoningGaps(step);

      return {
        step: index + 1,
        isLogical,
        evidenceStrength,
        consistencyScore,
        biasIndicators,
        gaps
      };
    });
  }

  /**
   * Check Step Logic
   */
  private checkStepLogic(step: any, index: number): boolean {
    // Check if step has required components
    const hasEvidence = step.evidence && Array.isArray(step.evidence) && step.evidence.length > 0;
    const hasAnalysis = step.analysis && step.analysis.length > 50;
    const hasConfidence = step.confidence && step.confidence >= 0.1 && step.confidence <= 1.0;
    
    // Check logical flow
    const logicalKeywords = ['because', 'therefore', 'since', 'given that', 'as a result'];
    const hasLogicalFlow = logicalKeywords.some(keyword => 
      step.analysis?.toLowerCase().includes(keyword)
    );

    return hasEvidence && hasAnalysis && hasConfidence && (index === 0 || hasLogicalFlow);
  }

  /**
   * Evaluate Evidence Strength
   */
  private evaluateEvidenceStrength(step: any): number {
    if (!step.evidence || !Array.isArray(step.evidence)) return 0;

    let strength = 0;
    const evidenceCount = step.evidence.length;
    
    // Evidence quantity score
    strength += Math.min(0.4, evidenceCount * 0.1);
    
    // Evidence quality score
    step.evidence.forEach((evidence: string) => {
      // Check for quantitative evidence
      if (/\d+/.test(evidence)) strength += 0.1;
      
      // Check for specific sources
      if (evidence.toLowerCase().includes('source') || evidence.toLowerCase().includes('according to')) {
        strength += 0.1;
      }
      
      // Check for comparative evidence
      if (evidence.toLowerCase().includes('compared to') || evidence.toLowerCase().includes('vs')) {
        strength += 0.05;
      }
    });

    return Math.min(1.0, strength);
  }

  /**
   * Check Step Consistency
   */
  private checkStepConsistency(step: any, allSteps: any[]): number {
    // Check confidence consistency
    const stepConfidence = step.confidence || 0.5;
    const avgConfidence = allSteps.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / allSteps.length;
    const confidenceConsistency = 1 - Math.abs(stepConfidence - avgConfidence);

    // Check sentiment consistency in analysis
    const positiveWords = ['good', 'strong', 'positive', 'bullish', 'optimistic'];
    const negativeWords = ['bad', 'weak', 'negative', 'bearish', 'pessimistic'];
    
    const stepSentiment = this.calculateTextSentiment(step.analysis, positiveWords, negativeWords);
    const avgSentiment = allSteps.reduce((sum, s) => 
      sum + this.calculateTextSentiment(s.analysis || '', positiveWords, negativeWords), 0
    ) / allSteps.length;
    
    const sentimentConsistency = 1 - Math.abs(stepSentiment - avgSentiment) / 2;

    return (confidenceConsistency + sentimentConsistency) / 2;
  }

  /**
   * Calculate text sentiment score
   */
  private calculateTextSentiment(text: string, positiveWords: string[], negativeWords: string[]): number {
    if (!text) return 0;
    
    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    const totalSentimentWords = positiveCount + negativeCount;
    if (totalSentimentWords === 0) return 0;
    
    return (positiveCount - negativeCount) / totalSentimentWords;
  }

  /**
   * Detect Cognitive Biases
   */
  private detectCognitiveBiases(analysis: EnhancedAnalysisResult): BiasDetection {
    return {
      overconfidenceBias: this.detectOverconfidenceBias(analysis),
      confirmationBias: this.detectConfirmationBias(analysis),
      anchioringBias: this.detectAnchoringBias(analysis),
      availabilityBias: this.detectAvailabilityBias(analysis),
      recentRecencyBias: this.detectRecencyBias(analysis)
    };
  }

  /**
   * Detect Overconfidence Bias
   */
  private detectOverconfidenceBias(analysis: EnhancedAnalysisResult): number {
    // High confidence with low evidence diversity
    const confidence = analysis.confidence_score;
    const uncertaintyMentions = analysis.uncertainties?.length || 0;
    const assumptionsMentions = analysis.assumptions?.length || 0;
    
    // If confidence is high but uncertainties/assumptions are not acknowledged
    if (confidence > 0.8 && uncertaintyMentions < 2 && assumptionsMentions < 2) {
      return 0.8;
    }
    
    // Check reasoning chain for overconfident language
    const overconfidentPhrases = ['certainly', 'definitely', 'without doubt', 'clearly', 'obviously'];
    const reasoningText = analysis.reasoning_chain?.map(step => step.analysis || '').join(' ').toLowerCase();
    const overconfidentCount = overconfidentPhrases.filter(phrase => 
      reasoningText.includes(phrase)
    ).length;
    
    return Math.min(1.0, overconfidentCount * 0.2 + (confidence > 0.9 ? 0.3 : 0));
  }

  /**
   * Detect Confirmation Bias
   */
  private detectConfirmationBias(analysis: EnhancedAnalysisResult): number {
    // Look for alternative viewpoints consideration
    const alternativeScenarios = analysis.alternative_scenarios?.length || 0;
    const uncertainties = analysis.uncertainties?.length || 0;
    
    // Check if contrarian views are mentioned
    const contraryPhrases = ['however', 'on the other hand', 'alternatively', 'contrary to'];
    const reasoningText = analysis.reasoning_chain?.map(step => step.analysis || '').join(' ').toLowerCase();
    const contraryMentions = contraryPhrases.filter(phrase => 
      reasoningText.includes(phrase)
    ).length;
    
    // High bias if no alternatives considered
    if (alternativeScenarios === 0 && uncertainties < 2 && contraryMentions === 0) {
      return 0.8;
    }
    
    return Math.max(0, 0.6 - (alternativeScenarios * 0.2) - (contraryMentions * 0.1));
  }

  /**
   * Detect Anchoring Bias
   */
  private detectAnchoringBias(analysis: EnhancedAnalysisResult): number {
    // Check if analysis heavily references specific numbers or percentages early on
    const firstStep = analysis.reasoning_chain?.[0]?.analysis || '';
    const numberMatches = firstStep.match(/\d+\.?\d*%?/g) || [];
    
    // If many specific numbers in first step, potential anchoring
    if (numberMatches.length > 3) {
      return 0.6;
    }
    
    // Check for phrases indicating anchoring to specific values
    const anchoringPhrases = ['based on', 'starting from', 'given the'];
    const anchoringCount = anchoringPhrases.filter(phrase => 
      firstStep.toLowerCase().includes(phrase)
    ).length;
    
    return Math.min(1.0, anchoringCount * 0.3 + numberMatches.length * 0.1);
  }

  /**
   * Detect Availability Bias
   */
  private detectAvailabilityBias(analysis: EnhancedAnalysisResult): number {
    // Check for over-reliance on recent events or easily recalled information
    const recentPhrases = ['recently', 'latest', 'current', 'just announced', 'breaking'];
    const reasoningText = analysis.reasoning_chain?.map(step => step.analysis || '').join(' ').toLowerCase();
    
    const recentMentions = recentPhrases.filter(phrase => 
      reasoningText.includes(phrase)
    ).length;
    
    // Check time sensitivity - immediate sensitivity might indicate availability bias
    const isImmediate = analysis.time_sensitivity === 'immediate';
    
    return Math.min(1.0, recentMentions * 0.15 + (isImmediate ? 0.3 : 0));
  }

  /**
   * Detect Recency Bias
   */
  private detectRecencyBias(analysis: EnhancedAnalysisResult): number {
    // Similar to availability bias but specifically for recent time periods
    const timeReferences = ['today', 'yesterday', 'this week', 'past few days'];
    const reasoningText = analysis.reasoning_chain?.map(step => step.analysis || '').join(' ').toLowerCase();
    
    const recentTimeRefs = timeReferences.filter(ref => 
      reasoningText.includes(ref)
    ).length;
    
    // Check if historical context is missing
    const historicalPhrases = ['historically', 'in the past', 'previous', 'long-term'];
    const historicalRefs = historicalPhrases.filter(phrase => 
      reasoningText.includes(phrase)
    ).length;
    
    if (recentTimeRefs > 2 && historicalRefs === 0) {
      return 0.7;
    }
    
    return Math.min(1.0, recentTimeRefs * 0.2 - historicalRefs * 0.1);
  }

  /**
   * Validate Confidence Calibration
   */
  private validateConfidenceCalibration(analysis: EnhancedAnalysisResult): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const confidence = analysis.confidence_score;
    
    // Check if confidence matches conviction level
    const convictionMap = { high: 0.8, medium: 0.6, low: 0.4 };
    const expectedConfidence = convictionMap[analysis.conviction_level] || 0.6;
    
    if (Math.abs(confidence - expectedConfidence) > 0.3) {
      issues.push({
        type: 'confidence_calibration',
        severity: 'medium',
        description: `Confidence score (${confidence}) doesn't match conviction level (${analysis.conviction_level})`,
        suggestion: `Adjust confidence to align with conviction level or revise conviction assessment`,
        affectedField: 'confidence_score'
      });
    }
    
    // Check if high confidence is supported by evidence
    if (confidence > 0.8) {
      const evidenceCount = analysis.reasoning_chain?.reduce((count, step) => 
        count + (step.evidence?.length || 0), 0
      ) || 0;
      
      if (evidenceCount < 6) {
        issues.push({
          type: 'confidence_calibration',
          severity: 'high',
          description: `High confidence (${confidence}) not supported by sufficient evidence (${evidenceCount} items)`,
          suggestion: 'Reduce confidence or provide more supporting evidence',
          affectedField: 'confidence_score'
        });
      }
    }
    
    return issues;
  }

  /**
   * Generate Corrections
   */
  private async generateCorrections(
    analysis: EnhancedAnalysisResult, 
    issues: ValidationIssue[]
  ): Promise<any[]> {
    const corrections: any[] = [];
    
    for (const issue of issues) {
      switch (issue.type) {
        case 'confidence_calibration':
          corrections.push({
            field: issue.affectedField,
            currentValue: analysis.confidence_score,
            suggestedValue: this.calculateCalibratedConfidence(analysis),
            reason: issue.description
          });
          break;
          
        case 'logical_consistency':
          corrections.push({
            field: 'reasoning_chain',
            issue: issue.description,
            suggestion: issue.suggestion
          });
          break;
          
        case 'completeness':
          corrections.push({
            field: issue.affectedField,
            missing: issue.description,
            suggestion: issue.suggestion
          });
          break;
      }
    }
    
    return corrections;
  }

  /**
   * Calculate calibrated confidence
   */
  private calculateCalibratedConfidence(analysis: EnhancedAnalysisResult): number {
    const evidenceStrength = analysis.reasoning_chain?.reduce((sum, step) => 
      sum + this.evaluateEvidenceStrength(step), 0
    ) / (analysis.reasoning_chain?.length || 1);
    
    const uncertaintyPenalty = (analysis.uncertainties?.length || 0) * 0.05;
    const assumptionPenalty = (analysis.assumptions?.length || 0) * 0.03;
    
    const calibratedConfidence = evidenceStrength - uncertaintyPenalty - assumptionPenalty;
    
    return Math.max(0.1, Math.min(1.0, calibratedConfidence));
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(metrics: QualityMetrics): QualityMetrics {
    metrics.overallScore = (
      metrics.logicalConsistency * 0.25 +
      metrics.evidenceQuality * 0.25 +
      metrics.completeness * 0.20 +
      metrics.objectivity * 0.15 +
      metrics.calibration * 0.15
    );
    
    return metrics;
  }

  /**
   * Calculate overall bias score
   */
  private calculateOverallBias(biases: BiasDetection): number {
    return (
      biases.overconfidenceBias * 0.3 +
      biases.confirmationBias * 0.25 +
      biases.anchioringBias * 0.2 +
      biases.availabilityBias * 0.15 +
      biases.recentRecencyBias * 0.1
    );
  }

  /**
   * Convert bias detection to validation issues
   */
  private convertBiasToIssues(biases: BiasDetection): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    Object.entries(biases).forEach(([biasType, score]) => {
      if (score > this.BIAS_THRESHOLDS.medium) {
        issues.push({
          type: 'bias_detection',
          severity: score > this.BIAS_THRESHOLDS.high ? 'high' : 'medium',
          description: `${biasType} detected with score ${score.toFixed(2)}`,
          suggestion: this.getBiasMitigationSuggestion(biasType),
          affectedField: 'reasoning_chain'
        });
      }
    });
    
    return issues;
  }

  /**
   * Get bias mitigation suggestions
   */
  private getBiasMitigationSuggestion(biasType: string): string {
    const suggestions: Record<string, string> = {
      overconfidenceBias: 'Consider more uncertainties and alternative scenarios',
      confirmationBias: 'Actively seek contradictory evidence and viewpoints',
      anchioringBias: 'Consider multiple reference points and base rates',
      availabilityBias: 'Include systematic data review beyond recent events',
      recentRecencyBias: 'Include historical context and long-term patterns'
    };
    
    return suggestions[biasType] || 'Review for potential cognitive bias';
  }

  // Additional validation methods for predictions, evidence support, etc.
  // ... (continuing with similar validation patterns)

  /**
   * Validate Evidence Support
   */
  private validateEvidenceSupport(analysis: EnhancedAnalysisResult): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let totalEvidence = 0;
    let qualityEvidence = 0;

    analysis.reasoning_chain?.forEach((step, index) => {
      const evidenceCount = step.evidence?.length || 0;
      totalEvidence += evidenceCount;
      
      if (evidenceCount === 0) {
        issues.push({
          type: 'evidence_support',
          severity: 'high',
          description: `Step ${index + 1} lacks supporting evidence`,
          suggestion: 'Add specific data points, sources, or examples to support this reasoning step',
          affectedField: `reasoning_chain[${index}].evidence`
        });
      } else {
        // Check evidence quality
        step.evidence?.forEach((evidence: string) => {
          if (evidence.length > 20 && (/\d+/.test(evidence) || evidence.toLowerCase().includes('source'))) {
            qualityEvidence++;
          }
        });
      }
    });

    const evidenceQualityScore = totalEvidence > 0 ? qualityEvidence / totalEvidence : 0;

    return {
      score: evidenceQualityScore,
      issues
    };
  }

  /**
   * Validate Completeness
   */
  private validateCompleteness(analysis: EnhancedAnalysisResult): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let completenessScore = 0;

    // Check required fields
    const requiredFields = [
      'market_sentiment',
      'key_themes',
      'risk_factors',
      'opportunities',
      'market_drivers',
      'overall_summary'
    ];

    requiredFields.forEach(field => {
      const value = analysis[field as keyof EnhancedAnalysisResult];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        issues.push({
          type: 'completeness',
          severity: 'medium',
          description: `Missing or empty ${field}`,
          suggestion: `Provide comprehensive ${field} based on the analysis`,
          affectedField: field
        });
      } else {
        completenessScore += 1;
      }
    });

    completenessScore = completenessScore / requiredFields.length;

    // Check reasoning chain completeness
    if (!analysis.reasoning_chain || analysis.reasoning_chain.length < 3) {
      issues.push({
        type: 'completeness',
        severity: 'high',
        description: 'Insufficient reasoning steps',
        suggestion: 'Provide at least 3 comprehensive reasoning steps',
        affectedField: 'reasoning_chain'
      });
    }

    return {
      score: completenessScore,
      issues
    };
  }

  /**
   * Validate Logical Consistency
   */
  private validateLogicalConsistency(analysis: EnhancedAnalysisResult): { score: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    let consistencyScore = 1.0;

    // Check sentiment consistency
    const sentimentMap = { bullish: 1, bearish: -1, neutral: 0 };
    const overallSentiment = sentimentMap[analysis.market_sentiment] || 0;

    // Check if opportunities align with sentiment
    const opportunitiesCount = analysis.opportunities?.length || 0;
    const risksCount = analysis.risk_factors?.length || 0;

    if (overallSentiment > 0 && risksCount > opportunitiesCount * 2) {
      issues.push({
        type: 'logical_consistency',
        severity: 'medium',
        description: 'Bullish sentiment inconsistent with risk/opportunity balance',
        suggestion: 'Review sentiment assessment or rebalance risks and opportunities',
        affectedField: 'market_sentiment'
      });
      consistencyScore -= 0.2;
    }

    if (overallSentiment < 0 && opportunitiesCount > risksCount * 2) {
      issues.push({
        type: 'logical_consistency',
        severity: 'medium',
        description: 'Bearish sentiment inconsistent with risk/opportunity balance',
        suggestion: 'Review sentiment assessment or rebalance risks and opportunities',
        affectedField: 'market_sentiment'
      });
      consistencyScore -= 0.2;
    }

    // Check confidence vs uncertainty consistency
    if (analysis.confidence_score > 0.8 && (analysis.uncertainties?.length || 0) > 5) {
      issues.push({
        type: 'logical_consistency',
        severity: 'medium',
        description: 'High confidence inconsistent with many uncertainties',
        suggestion: 'Lower confidence score or reduce identified uncertainties',
        affectedField: 'confidence_score'
      });
      consistencyScore -= 0.2;
    }

    return {
      score: Math.max(0, consistencyScore),
      issues
    };
  }

  /**
   * Additional prediction validation methods
   */
  private validateMethodologyConsistency(prediction: EnsemblePrediction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Check if methodology weights sum to 1
    const weightSum = Object.values(prediction.methodology_weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      issues.push({
        type: 'logical_consistency',
        severity: 'high',
        description: `Methodology weights sum to ${weightSum}, should sum to 1.0`,
        suggestion: 'Normalize methodology weights to sum to 1.0',
        affectedField: 'methodology_weights'
      });
    }

    return issues;
  }

  private validateProbabilityDistributions(prediction: EnsemblePrediction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    const probDist = prediction.ensemble_prediction.probability_distribution;
    const probSum = Object.values(probDist).reduce((sum, prob) => sum + prob, 0);
    
    if (Math.abs(probSum - 1.0) > 0.01) {
      issues.push({
        type: 'logical_consistency',
        severity: 'high',
        description: `Probability distribution sums to ${probSum}, should sum to 1.0`,
        suggestion: 'Normalize probability distribution to sum to 1.0',
        affectedField: 'ensemble_prediction.probability_distribution'
      });
    }

    return issues;
  }

  private validatePredictionCalibration(prediction: EnsemblePrediction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    const confidence = prediction.ensemble_prediction.confidence_level;
    const veryLikelyProb = prediction.ensemble_prediction.probability_distribution.very_likely;
    
    // High confidence should correlate with high "very_likely" probability
    if (confidence > 0.8 && veryLikelyProb < 0.3) {
      issues.push({
        type: 'confidence_calibration',
        severity: 'medium',
        description: 'High confidence not reflected in probability distribution',
        suggestion: 'Align confidence level with probability distribution',
        affectedField: 'ensemble_prediction.confidence_level'
      });
    }

    return issues;
  }

  private validateMeasurableOutcomes(prediction: EnsemblePrediction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    const outcomes = prediction.ensemble_prediction.measurable_outcomes;
    if (!outcomes || outcomes.length === 0) {
      issues.push({
        type: 'completeness',
        severity: 'high',
        description: 'No measurable outcomes defined',
        suggestion: 'Define specific, measurable outcomes for prediction validation',
        affectedField: 'ensemble_prediction.measurable_outcomes'
      });
    }

    return issues;
  }

  private validateUncertaintyQuantification(prediction: EnsemblePrediction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    if (!prediction.uncertainty_factors || prediction.uncertainty_factors.length === 0) {
      issues.push({
        type: 'completeness',
        severity: 'medium',
        description: 'No uncertainty factors identified',
        suggestion: 'Identify and document key uncertainty factors',
        affectedField: 'uncertainty_factors'
      });
    }

    return issues;
  }

  private calculatePredictionQuality(prediction: EnsemblePrediction, issues: ValidationIssue[]): number {
    let qualityScore = 1.0;
    
    // Deduct for each issue based on severity
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': qualityScore -= 0.3; break;
        case 'high': qualityScore -= 0.2; break;
        case 'medium': qualityScore -= 0.1; break;
        case 'low': qualityScore -= 0.05; break;
      }
    });

    return Math.max(0, qualityScore);
  }

  private async generatePredictionCorrections(
    prediction: EnsemblePrediction,
    issues: ValidationIssue[]
  ): Promise<any[]> {
    const corrections: any[] = [];
    
    issues.forEach(issue => {
      corrections.push({
        field: issue.affectedField,
        issue: issue.description,
        suggestion: issue.suggestion,
        severity: issue.severity
      });
    });

    return corrections;
  }

  private detectStepBiases(step: any): string[] {
    const biases: string[] = [];
    const analysis = step.analysis || '';
    
    // Simple bias detection based on language patterns
    if (/certainly|definitely|obviously/.test(analysis.toLowerCase())) {
      biases.push('overconfidence');
    }
    
    if (!/however|but|although/.test(analysis.toLowerCase())) {
      biases.push('confirmation_bias');
    }
    
    return biases;
  }

  private identifyReasoningGaps(step: any): string[] {
    const gaps: string[] = [];
    
    if (!step.evidence || step.evidence.length === 0) {
      gaps.push('missing_evidence');
    }
    
    if (!step.key_findings || step.key_findings.length === 0) {
      gaps.push('missing_findings');
    }
    
    return gaps;
  }
}

export { ValidationResult, ValidationIssue, QualityMetrics, BiasDetection };