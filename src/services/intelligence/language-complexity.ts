import { supabase } from '../database/client';
import { logger } from '../../utils/logger';

export interface LanguageComplexityAnalysis {
  id: string;
  entityName: string;
  entityType: 'company' | 'person' | 'topic' | 'document';
  timeframe: string;
  
  // Core complexity metrics
  complexityScore: number; // 0-1, higher = more complex/evasive
  readabilityScore: number; // 0-1, higher = more readable
  uncertaintyLevel: number; // 0-1, higher = more uncertain
  evasivenessFactor: number; // 0-1, higher = more evasive
  
  // Linguistic analysis
  linguisticMetrics: {
    averageWordsPerSentence: number;
    averageSyllablesPerWord: number;
    lexicalDiversity: number; // Type-token ratio
    sentenceComplexity: number;
    passiveVoiceRatio: number;
    modalVerbUsage: number; // "might", "could", "would" etc
    hedgingLanguage: number; // "perhaps", "seemingly", "appears"
    qualifierDensity: number; // "very", "quite", "rather"
  };
  
  // Sentiment and confidence patterns
  confidenceMetrics: {
    assertivenessScore: number;
    confidenceLanguage: number;
    certaintyIndicators: number;
    tentativeLanguage: number;
    deflectionPatterns: number;
  };
  
  // Communication anomalies
  anomalyDetection: {
    deviationFromBaseline: number;
    unusualPatterns: string[];
    communicationShifts: {
      direction: 'more_complex' | 'less_complex' | 'stable';
      magnitude: number;
      timeframe: string;
    };
    redFlags: {
      type: 'excessive_hedging' | 'passive_deflection' | 'complexity_spike' | 'jargon_overload';
      severity: 'low' | 'medium' | 'high';
      description: string;
    }[];
  };
  
  // Historical context
  historicalComparison: {
    baseline: {
      averageComplexity: number;
      typicalReadability: number;
      normalUncertainty: number;
    };
    trends: {
      complexityTrend: 'increasing' | 'decreasing' | 'stable';
      confidenceTrend: 'increasing' | 'decreasing' | 'stable';
      communicationClarity: 'improving' | 'degrading' | 'stable';
    };
    significantEvents: {
      event: string;
      date: string;
      complexityChange: number;
      context: string;
    }[];
  };
  
  // Predictive insights
  riskAssessment: {
    communicationRisk: 'low' | 'medium' | 'high' | 'critical';
    probabilityOfConcern: number;
    timeToEvent: number; // Estimated hours
    suggestedActions: string[];
    monitoringPriority: 'low' | 'medium' | 'high';
  };
  
  // Sample analysis
  examples: {
    complex: string[];
    evasive: string[];
    uncertain: string[];
    clear: string[];
  };
  
  timestamp: string;
  analysisDate: string;
}

export interface LanguageAlert {
  id: string;
  entityName: string;
  alertType: 'complexity_spike' | 'evasiveness_increase' | 'confidence_drop' | 'communication_shift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  
  trigger: {
    metric: string;
    currentValue: number;
    baselineValue: number;
    deviationSigmas: number;
    threshold: number;
  };
  
  analysis: {
    description: string;
    context: string;
    examples: string[];
    possibleCauses: string[];
  };
  
  recommendations: {
    immediate: string[];
    monitoring: string[];
    investigation: string[];
  };
  
  timestamp: string;
}

class LanguageComplexityService {
  private readonly COMPLEXITY_THRESHOLD = 0.7; // Above this = concerning
  private readonly UNCERTAINTY_THRESHOLD = 0.6;
  private readonly DEVIATION_THRESHOLD = 2.0; // Standard deviations
  
  // Common linguistic patterns
  private readonly HEDGING_WORDS = [
    'perhaps', 'maybe', 'possibly', 'potentially', 'seemingly', 'apparently', 
    'presumably', 'supposedly', 'allegedly', 'reportedly', 'suggests', 'indicates'
  ];
  
  private readonly MODAL_VERBS = [
    'might', 'could', 'would', 'should', 'may', 'can', 'must', 'will', 'shall'
  ];
  
  private readonly QUALIFIERS = [
    'very', 'quite', 'rather', 'somewhat', 'fairly', 'relatively', 'generally',
    'typically', 'usually', 'often', 'frequently', 'occasionally'
  ];
  
  private readonly UNCERTAINTY_INDICATORS = [
    'uncertain', 'unclear', 'ambiguous', 'complex', 'challenging', 'difficult',
    'unprecedented', 'evolving', 'dynamic', 'volatile', 'unpredictable'
  ];

  /**
   * Analyze language complexity for all entities in timeframe
   */
  async analyzeLanguageComplexity(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<LanguageComplexityAnalysis[]> {
    try {
      logger.info('Starting language complexity analysis', { timeframe });

      const endTime = new Date();
      const startTime = new Date();
      
      switch (timeframe) {
        case '24h':
          startTime.setHours(startTime.getHours() - 24);
          break;
        case '7d':
          startTime.setDate(startTime.getDate() - 7);
          break;
        case '30d':
          startTime.setDate(startTime.getDate() - 30);
          break;
      }

      // Get processed content with sufficient text for analysis
      const { data: contentData, error } = await supabase
        .from('processed_content')
        .select(`
          id,
          processed_text,
          key_topics,
          sentiment_score,
          entities,
          created_at,
          raw_feeds!inner(
            feed_sources!inner(
              name,
              type,
              config
            )
          )
        `)
        .gte('created_at', startTime.toISOString())
        .not('processed_text', 'is', null);

      if (error) throw error;

      // Filter content with sufficient text length
      const substantialContent = contentData?.filter(content => 
        content.processed_text && content.processed_text.length > 200
      ) || [];

      // Group by entity for analysis
      const entityGroups = await this.groupContentByEntity(substantialContent);
      
      // Analyze each entity
      const analyses: LanguageComplexityAnalysis[] = [];
      
      for (const [entityName, entityContent] of entityGroups.entries()) {
        if (entityContent.length >= 2) { // Need multiple data points
          const analysis = await this.analyzeEntityLanguage(entityName, entityContent, timeframe);
          if (analysis) {
            analyses.push(analysis);
          }
        }
      }

      return analyses.sort((a, b) => b.complexityScore - a.complexityScore);

    } catch (error) {
      logger.error('Language complexity analysis failed:', error);
      throw error;
    }
  }

  /**
   * Group content by entity mentions
   */
  private async groupContentByEntity(contentData: any[]): Promise<Map<string, any[]>> {
    const entityGroups = new Map<string, any[]>();
    
    contentData.forEach(content => {
      const entities = content.entities || {};
      const allEntities = [
        ...(entities.companies || []),
        ...(entities.people || []),
        ...(content.key_topics || [])
      ];
      
      // Add source name as an entity too
      const sourceName = content.raw_feeds?.feed_sources?.name;
      if (sourceName) {
        allEntities.push(sourceName);
      }
      
      allEntities.forEach(entity => {
        if (entity && entity.length > 2) {
          if (!entityGroups.has(entity)) {
            entityGroups.set(entity, []);
          }
          entityGroups.get(entity)!.push(content);
        }
      });
    });
    
    return entityGroups;
  }

  /**
   * Analyze language complexity for a specific entity
   */
  private async analyzeEntityLanguage(
    entityName: string,
    entityContent: any[],
    timeframe: string
  ): Promise<LanguageComplexityAnalysis | null> {
    try {
      // Combine all text for the entity
      const combinedText = entityContent
        .map(content => content.processed_text)
        .join(' ');

      if (combinedText.length < 500) return null; // Need substantial text

      // Perform linguistic analysis
      const linguisticMetrics = this.analyzeLinguisticMetrics(combinedText);
      const confidenceMetrics = this.analyzeConfidenceMetrics(combinedText);
      
      // Calculate core scores
      const complexityScore = this.calculateComplexityScore(linguisticMetrics);
      const readabilityScore = this.calculateReadabilityScore(linguisticMetrics);
      const uncertaintyLevel = this.calculateUncertaintyLevel(combinedText, confidenceMetrics);
      const evasivenessFactor = this.calculateEvasivenessFactor(linguisticMetrics, confidenceMetrics);
      
      // Get historical baseline
      const historicalComparison = await this.getHistoricalComparison(entityName, {
        complexityScore,
        readabilityScore,
        uncertaintyLevel
      });
      
      // Detect anomalies
      const anomalyDetection = this.detectAnomalies(
        { complexityScore, readabilityScore, uncertaintyLevel, evasivenessFactor },
        historicalComparison.baseline
      );
      
      // Assess risk
      const riskAssessment = this.assessCommunicationRisk(
        complexityScore,
        uncertaintyLevel,
        anomalyDetection
      );
      
      // Extract examples
      const examples = this.extractExamples(combinedText);

      return {
        id: `lang-complexity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityName,
        entityType: this.classifyEntityType(entityName),
        timeframe,
        
        complexityScore,
        readabilityScore,
        uncertaintyLevel,
        evasivenessFactor,
        
        linguisticMetrics,
        confidenceMetrics,
        anomalyDetection,
        historicalComparison,
        riskAssessment,
        examples,
        
        timestamp: new Date().toISOString(),
        analysisDate: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to analyze language for entity ${entityName}:`, error);
      return null;
    }
  }

  /**
   * Analyze linguistic metrics from text
   */
  private analyzeLinguisticMetrics(text: string): LanguageComplexityAnalysis['linguisticMetrics'] {
    const sentences = this.splitIntoSentences(text);
    const words = this.splitIntoWords(text);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    
    // Calculate metrics
    const averageWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const averageSyllablesPerWord = this.calculateAverageSyllables(words);
    const lexicalDiversity = uniqueWords.size / Math.max(words.length, 1);
    const sentenceComplexity = this.calculateSentenceComplexity(sentences);
    const passiveVoiceRatio = this.calculatePassiveVoiceRatio(sentences);
    const modalVerbUsage = this.calculateWordUsage(text, this.MODAL_VERBS);
    const hedgingLanguage = this.calculateWordUsage(text, this.HEDGING_WORDS);
    const qualifierDensity = this.calculateWordUsage(text, this.QUALIFIERS);
    
    return {
      averageWordsPerSentence,
      averageSyllablesPerWord,
      lexicalDiversity,
      sentenceComplexity,
      passiveVoiceRatio,
      modalVerbUsage,
      hedgingLanguage,
      qualifierDensity
    };
  }

  /**
   * Analyze confidence-related metrics
   */
  private analyzeConfidenceMetrics(text: string): LanguageComplexityAnalysis['confidenceMetrics'] {
    const sentences = this.splitIntoSentences(text);
    
    // Count confident vs tentative language
    const assertivePatterns = [
      'will', 'is', 'are', 'definitely', 'certainly', 'clearly', 'obviously',
      'undoubtedly', 'absolutely', 'confident', 'sure', 'expect'
    ];
    
    const tentativePatterns = [
      'might', 'may', 'could', 'perhaps', 'possibly', 'potentially',
      'seems', 'appears', 'suggests', 'indicates', 'likely'
    ];
    
    const deflectionPatterns = [
      'it depends', 'circumstances', 'context', 'varies', 'complex',
      'difficult to say', 'hard to predict', 'uncertain'
    ];
    
    const assertivenessScore = this.calculateWordUsage(text, assertivePatterns);
    const confidenceLanguage = this.calculateConfidenceLanguage(sentences);
    const certaintyIndicators = this.calculateWordUsage(text, assertivePatterns);
    const tentativeLanguage = this.calculateWordUsage(text, tentativePatterns);
    const deflectionPatterns_score = this.calculatePhraseUsage(text, deflectionPatterns);
    
    return {
      assertivenessScore,
      confidenceLanguage,
      certaintyIndicators,
      tentativeLanguage,
      deflectionPatterns: deflectionPatterns_score
    };
  }

  /**
   * Calculate overall complexity score
   */
  private calculateComplexityScore(metrics: LanguageComplexityAnalysis['linguisticMetrics']): number {
    // Weighted combination of complexity factors
    const factors = [
      { value: Math.min(metrics.averageWordsPerSentence / 25, 1), weight: 0.2 },
      { value: Math.min(metrics.averageSyllablesPerWord / 3, 1), weight: 0.2 },
      { value: 1 - metrics.lexicalDiversity, weight: 0.15 }, // Lower diversity = higher complexity
      { value: metrics.sentenceComplexity, weight: 0.15 },
      { value: metrics.passiveVoiceRatio, weight: 0.1 },
      { value: metrics.hedgingLanguage, weight: 0.1 },
      { value: metrics.qualifierDensity, weight: 0.1 }
    ];
    
    return factors.reduce((sum, factor) => sum + (factor.value * factor.weight), 0);
  }

  /**
   * Calculate readability score (inverse of complexity for some metrics)
   */
  private calculateReadabilityScore(metrics: LanguageComplexityAnalysis['linguisticMetrics']): number {
    // Simplified Flesch-like readability
    const flesch = 206.835 - (1.015 * metrics.averageWordsPerSentence) - (84.6 * metrics.averageSyllablesPerWord);
    return Math.max(0, Math.min(1, flesch / 100));
  }

  /**
   * Calculate uncertainty level
   */
  private calculateUncertaintyLevel(text: string, confidenceMetrics: LanguageComplexityAnalysis['confidenceMetrics']): number {
    const uncertaintyWords = this.calculateWordUsage(text, this.UNCERTAINTY_INDICATORS);
    
    return Math.min(1, (
      confidenceMetrics.tentativeLanguage * 0.3 +
      confidenceMetrics.deflectionPatterns * 0.25 +
      uncertaintyWords * 0.25 +
      (1 - confidenceMetrics.assertivenessScore) * 0.2
    ));
  }

  /**
   * Calculate evasiveness factor
   */
  private calculateEvasivenessFactor(
    linguisticMetrics: LanguageComplexityAnalysis['linguisticMetrics'],
    confidenceMetrics: LanguageComplexityAnalysis['confidenceMetrics']
  ): number {
    return Math.min(1, (
      linguisticMetrics.passiveVoiceRatio * 0.25 +
      linguisticMetrics.hedgingLanguage * 0.25 +
      confidenceMetrics.deflectionPatterns * 0.3 +
      linguisticMetrics.qualifierDensity * 0.2
    ));
  }

  /**
   * Detect communication anomalies
   */
  private detectAnomalies(
    current: { complexityScore: number; readabilityScore: number; uncertaintyLevel: number; evasivenessFactor: number },
    baseline: { averageComplexity: number; typicalReadability: number; normalUncertainty: number }
  ): LanguageComplexityAnalysis['anomalyDetection'] {
    const deviationFromBaseline = Math.abs(current.complexityScore - baseline.averageComplexity);
    const complexityChange = current.complexityScore - baseline.averageComplexity;
    
    const unusualPatterns: string[] = [];
    const redFlags: LanguageComplexityAnalysis['anomalyDetection']['redFlags'] = [];
    
    // Detect patterns
    if (current.complexityScore > this.COMPLEXITY_THRESHOLD) {
      unusualPatterns.push('High complexity language detected');
      redFlags.push({
        type: 'complexity_spike',
        severity: current.complexityScore > 0.8 ? 'high' : 'medium',
        description: `Language complexity ${(current.complexityScore * 100).toFixed(0)}% above normal`
      });
    }
    
    if (current.evasivenessFactor > 0.6) {
      unusualPatterns.push('Increased evasive language patterns');
      redFlags.push({
        type: 'passive_deflection',
        severity: current.evasivenessFactor > 0.8 ? 'high' : 'medium',
        description: 'High use of passive voice and deflection patterns'
      });
    }
    
    if (current.uncertaintyLevel > this.UNCERTAINTY_THRESHOLD) {
      unusualPatterns.push('Elevated uncertainty indicators');
    }
    
    const communicationShifts = {
      direction: (complexityChange > 0.1 ? 'more_complex' : 
                complexityChange < -0.1 ? 'less_complex' : 'stable') as 'more_complex' | 'less_complex' | 'stable',
      magnitude: Math.abs(complexityChange),
      timeframe: 'vs baseline'
    };
    
    return {
      deviationFromBaseline,
      unusualPatterns,
      communicationShifts,
      redFlags
    };
  }

  /**
   * Assess communication risk
   */
  private assessCommunicationRisk(
    complexityScore: number,
    uncertaintyLevel: number,
    anomalyDetection: LanguageComplexityAnalysis['anomalyDetection']
  ): LanguageComplexityAnalysis['riskAssessment'] {
    let riskScore = 0;
    
    // Factor in complexity
    if (complexityScore > 0.8) riskScore += 3;
    else if (complexityScore > 0.6) riskScore += 2;
    else if (complexityScore > 0.4) riskScore += 1;
    
    // Factor in uncertainty
    if (uncertaintyLevel > 0.7) riskScore += 2;
    else if (uncertaintyLevel > 0.5) riskScore += 1;
    
    // Factor in red flags
    riskScore += anomalyDetection.redFlags.filter(flag => flag.severity === 'high').length * 2;
    riskScore += anomalyDetection.redFlags.filter(flag => flag.severity === 'medium').length;
    
    const communicationRisk = riskScore >= 6 ? 'critical' :
                             riskScore >= 4 ? 'high' :
                             riskScore >= 2 ? 'medium' : 'low';
    
    const probabilityOfConcern = Math.min(0.95, riskScore / 8);
    
    const suggestedActions = this.generateSuggestedActions(communicationRisk, anomalyDetection);
    
    return {
      communicationRisk,
      probabilityOfConcern,
      timeToEvent: this.estimateTimeToEvent(riskScore),
      suggestedActions,
      monitoringPriority: communicationRisk === 'critical' ? 'high' :
                         communicationRisk === 'high' ? 'high' :
                         communicationRisk === 'medium' ? 'medium' : 'low'
    };
  }

  /**
   * Generate language complexity alerts
   */
  async generateLanguageAlerts(analyses: LanguageComplexityAnalysis[]): Promise<LanguageAlert[]> {
    const alerts: LanguageAlert[] = [];
    
    for (const analysis of analyses) {
      // Check for complexity spikes
      if (analysis.complexityScore > this.COMPLEXITY_THRESHOLD && 
          analysis.anomalyDetection.deviationFromBaseline > 0.3) {
        alerts.push(this.createAlert(
          analysis,
          'complexity_spike',
          'High language complexity detected',
          analysis.complexityScore
        ));
      }
      
      // Check for evasiveness increases
      if (analysis.evasivenessFactor > 0.6) {
        alerts.push(this.createAlert(
          analysis,
          'evasiveness_increase',
          'Increased evasive communication patterns',
          analysis.evasivenessFactor
        ));
      }
      
      // Check for confidence drops
      if (analysis.uncertaintyLevel > this.UNCERTAINTY_THRESHOLD) {
        alerts.push(this.createAlert(
          analysis,
          'confidence_drop',
          'Elevated uncertainty in communications',
          analysis.uncertaintyLevel
        ));
      }
    }
    
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Helper methods for linguistic analysis
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private splitIntoWords(text: string): string[] {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }

  private calculateAverageSyllables(words: string[]): number {
    const totalSyllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);
    return totalSyllables / Math.max(words.length, 1);
  }

  private countSyllables(word: string): number {
    // Simple syllable counting heuristic
    const vowels = word.match(/[aeiouAEIOU]/g);
    let count = vowels ? vowels.length : 1;
    if (word.endsWith('e')) count--;
    return Math.max(1, count);
  }

  private calculateSentenceComplexity(sentences: string[]): number {
    // Count complex sentences (with subordinate clauses, multiple commas, etc.)
    const complexSentences = sentences.filter(sentence => {
      const commas = (sentence.match(/,/g) || []).length;
      const subordinators = (sentence.match(/\b(although|because|since|while|if|when|that|which|who)\b/gi) || []).length;
      return commas >= 2 || subordinators >= 1;
    }).length;
    
    return complexSentences / Math.max(sentences.length, 1);
  }

  private calculatePassiveVoiceRatio(sentences: string[]): number {
    // Simple passive voice detection
    const passiveSentences = sentences.filter(sentence => 
      /\b(was|were|been|being)\s+\w+ed\b/i.test(sentence) ||
      /\bis\s+\w+ed\b/i.test(sentence)
    ).length;
    
    return passiveSentences / Math.max(sentences.length, 1);
  }

  private calculateWordUsage(text: string, words: string[]): number {
    const textWords = this.splitIntoWords(text);
    const matches = textWords.filter(word => 
      words.some(target => word.includes(target.toLowerCase()))
    ).length;
    
    return matches / Math.max(textWords.length, 1);
  }

  private calculatePhraseUsage(text: string, phrases: string[]): number {
    let matches = 0;
    const lowerText = text.toLowerCase();
    
    phrases.forEach(phrase => {
      const regex = new RegExp(phrase.toLowerCase(), 'g');
      const phrasematches = lowerText.match(regex);
      if (phrasematches) matches += phrasematches.length;
    });
    
    return matches / Math.max(text.length / 100, 1); // Normalize by text length
  }

  private calculateConfidenceLanguage(sentences: string[]): number {
    const confidentSentences = sentences.filter(sentence =>
      /\b(will|definitely|certainly|clearly|obviously|confident|sure|expect)\b/i.test(sentence)
    ).length;
    
    return confidentSentences / Math.max(sentences.length, 1);
  }

  private async getHistoricalComparison(entityName: string, current: any): Promise<LanguageComplexityAnalysis['historicalComparison']> {
    // This would query historical language patterns in production
    // For now, return mock baseline with realistic variations
    const baseComplexity = 0.3 + Math.random() * 0.2;
    
    return {
      baseline: {
        averageComplexity: baseComplexity,
        typicalReadability: 0.7 - baseComplexity * 0.5,
        normalUncertainty: 0.2 + Math.random() * 0.2
      },
      trends: {
        complexityTrend: current.complexityScore > baseComplexity + 0.1 ? 'increasing' : 
                        current.complexityScore < baseComplexity - 0.1 ? 'decreasing' : 'stable',
        confidenceTrend: current.uncertaintyLevel > 0.4 ? 'decreasing' : 
                        current.uncertaintyLevel < 0.2 ? 'increasing' : 'stable',
        communicationClarity: current.complexityScore > baseComplexity + 0.2 ? 'degrading' :
                             current.complexityScore < baseComplexity - 0.1 ? 'improving' : 'stable'
      },
      significantEvents: [
        {
          event: 'Earnings Call',
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          complexityChange: -0.1,
          context: 'More direct communication style during earnings'
        }
      ]
    };
  }

  private generateSuggestedActions(
    riskLevel: string, 
    anomalies: LanguageComplexityAnalysis['anomalyDetection']
  ): string[] {
    const actions = ['Monitor communication patterns closely'];
    
    if (riskLevel === 'critical' || riskLevel === 'high') {
      actions.push('Review recent announcements for clarity issues');
      actions.push('Cross-reference with insider trading activity');
      actions.push('Check for pending regulatory filings');
    }
    
    if (anomalies.redFlags.some(flag => flag.type === 'complexity_spike')) {
      actions.push('Analyze technical language for jargon increases');
    }
    
    if (anomalies.redFlags.some(flag => flag.type === 'passive_deflection')) {
      actions.push('Look for responsibility deflection patterns');
    }
    
    return actions;
  }

  private estimateTimeToEvent(riskScore: number): number {
    // Higher risk = shorter time to potential event
    if (riskScore >= 6) return 24; // 1 day
    if (riskScore >= 4) return 72; // 3 days
    if (riskScore >= 2) return 168; // 1 week
    return 336; // 2 weeks
  }

  private extractExamples(text: string): LanguageComplexityAnalysis['examples'] {
    const sentences = this.splitIntoSentences(text);
    
    const complex = sentences.filter(s => s.split(' ').length > 20).slice(0, 3);
    const evasive = sentences.filter(s => 
      /\b(might|could|perhaps|possibly|seems|appears)\b/i.test(s)
    ).slice(0, 3);
    const uncertain = sentences.filter(s =>
      /\b(uncertain|unclear|complex|challenging|difficult)\b/i.test(s)
    ).slice(0, 3);
    const clear = sentences.filter(s => 
      s.split(' ').length < 15 && 
      /\b(will|is|are|definitely|clearly)\b/i.test(s)
    ).slice(0, 3);
    
    return { complex, evasive, uncertain, clear };
  }

  private createAlert(
    analysis: LanguageComplexityAnalysis,
    alertType: LanguageAlert['alertType'],
    description: string,
    triggerValue: number
  ): LanguageAlert {
    const severity = triggerValue > 0.8 ? 'critical' :
                    triggerValue > 0.6 ? 'high' :
                    triggerValue > 0.4 ? 'medium' : 'low';
    
    return {
      id: `lang-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityName: analysis.entityName,
      alertType,
      severity,
      confidence: analysis.riskAssessment.probabilityOfConcern,
      
      trigger: {
        metric: alertType,
        currentValue: triggerValue,
        baselineValue: analysis.historicalComparison.baseline.averageComplexity,
        deviationSigmas: analysis.anomalyDetection.deviationFromBaseline / 0.1, // Approximate
        threshold: this.COMPLEXITY_THRESHOLD
      },
      
      analysis: {
        description,
        context: `${analysis.entityName} showing ${alertType.replace('_', ' ')}`,
        examples: analysis.examples.complex.concat(analysis.examples.evasive).slice(0, 3),
        possibleCauses: [
          'Upcoming announcement preparation',
          'Regulatory pressure response',
          'Internal uncertainty increase',
          'PR strategy shift'
        ]
      },
      
      recommendations: {
        immediate: analysis.riskAssessment.suggestedActions.slice(0, 2),
        monitoring: ['Track language patterns daily', 'Set up communication alerts'],
        investigation: ['Review recent executive communications', 'Analyze competitor language patterns']
      },
      
      timestamp: new Date().toISOString()
    };
  }

  private classifyEntityType(entity: string): LanguageComplexityAnalysis['entityType'] {
    // Simple classification - would be more sophisticated in production
    const companyPatterns = /inc\.|corp\.|llc|company|technologies|systems|group/i;
    const personPatterns = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
    
    if (companyPatterns.test(entity)) return 'company';
    if (personPatterns.test(entity)) return 'person';
    
    // Check against known entities
    const knownCompanies = ['Apple', 'Microsoft', 'Google', 'Tesla', 'NVIDIA', 'Amazon'];
    const knownPeople = ['Jerome Powell', 'Janet Yellen', 'Elon Musk', 'Warren Buffett'];
    
    if (knownCompanies.some(c => entity.includes(c))) return 'company';
    if (knownPeople.some(p => entity.includes(p))) return 'person';
    
    return 'topic';
  }
}

export const languageComplexityService = new LanguageComplexityService();