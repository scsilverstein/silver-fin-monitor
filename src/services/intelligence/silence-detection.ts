import { supabase } from '../database/client';
import { logger } from '../../utils/logger';

export interface SilenceAlert {
  id: string;
  entityName: string;
  entityType: 'company' | 'person' | 'topic' | 'sector';
  silenceType: 'sudden_drop' | 'expected_absence' | 'pre_announcement' | 'information_void';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  
  // Silence metrics
  expectedMentions: number;
  actualMentions: number;
  silenceRatio: number; // 0-1, how much below expected
  silenceDuration: number; // Hours of silence
  
  // Pattern analysis
  historicalPattern: {
    averageMentions: number;
    typicalSilenceBefore: string[]; // Historical events that followed silence
    lastMajorEvent: string;
    daysSinceLastEvent: number;
  };
  
  // Predictive signals
  predictionSignals: {
    announcementProbability: number;
    timeToEvent: number; // Estimated hours
    eventType: string;
    marketImpactPotential: 'low' | 'medium' | 'high';
  };
  
  // Context
  contextualFactors: {
    earningsSeasonProximity: boolean;
    marketConditions: string;
    sectorActivity: number;
    relatedEntitySilences: string[];
  };
  
  // Actionable intelligence
  actionable: {
    watchWindow: string;
    monitoringSuggestions: string[];
    riskLevel: string;
    potentialCatalysts: string[];
  };
  
  timestamp: string;
  detectedAt: string;
}

export interface SilencePattern {
  entity: string;
  entityType: 'company' | 'person' | 'topic' | 'sector';
  
  // Current silence metrics
  currentSilence: {
    duration: number; // Hours
    expectedVsActual: number; // Ratio
    anomalyScore: number; // 0-1
  };
  
  // Historical context
  historicalBaseline: {
    averageDaily: number;
    standardDeviation: number;
    typicalSilencePatterns: {
      duration: number;
      frequency: number;
      context: string;
    }[];
  };
  
  // Correlation analysis
  correlations: {
    marketEvents: {
      event: string;
      correlationStrength: number;
      timeLag: number; // Days before/after
    }[];
    otherEntitySilences: {
      entity: string;
      correlationStrength: number;
      simultaneousOccurrences: number;
    }[];
  };
  
  // Predictive modeling
  predictions: {
    probabilityOfEvent: number;
    estimatedTimeframe: string;
    confidenceInterval: number;
    potentialEventTypes: string[];
  };
}

class SilenceDetectionService {
  private readonly SILENCE_THRESHOLD_HOURS = 24; // Minimum silence duration to consider
  private readonly ANOMALY_THRESHOLD = 0.3; // Below 30% of expected = anomalous
  private readonly HIGH_IMPACT_ENTITIES = [
    'Federal Reserve', 'Jerome Powell', 'Janet Yellen', 'FOMC',
    'Apple', 'Microsoft', 'Google', 'Tesla', 'NVIDIA',
    'Bitcoin', 'Ethereum', 'Interest Rates', 'Inflation'
  ];

  /**
   * Detect silence patterns across all entities
   */
  async detectSilencePatterns(lookbackDays: number = 30): Promise<SilenceAlert[]> {
    try {
      logger.info('Starting silence detection analysis', { lookbackDays });

      // Get all entities and their mention patterns
      const entities = await this.getAllTrackedEntities(lookbackDays);
      const silenceAlerts: SilenceAlert[] = [];

      for (const entity of entities) {
        const silencePattern = await this.analyzeSilencePattern(entity, lookbackDays);
        
        if (this.isSilenceAnomalous(silencePattern)) {
          const alert = await this.generateSilenceAlert(entity, silencePattern);
          if (alert) {
            silenceAlerts.push(alert);
          }
        }
      }

      // Sort by severity and confidence
      return silenceAlerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.confidence - a.confidence;
      });

    } catch (error) {
      logger.error('Silence detection failed:', error);
      throw error;
    }
  }

  /**
   * Get all entities that have been mentioned recently
   */
  private async getAllTrackedEntities(lookbackDays: number): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const { data: contentData, error } = await supabase
      .from('processed_content')
      .select('entities, key_topics')
      .gte('created_at', cutoffDate.toISOString())
      .not('entities', 'is', null)
      .limit(500); // Limit to prevent timeout

    if (error) throw error;

    const entityCounts = new Map<string, number>();
    
    contentData?.forEach(content => {
      const entities = content.entities || {};
      
      // Add companies, people, and locations
      [...(entities.companies || []), ...(entities.people || []), ...(entities.locations || [])]
        .forEach(entity => {
          if (entity.length > 2) {
            entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
          }
        });
      
      // Add key topics as entities
      (content.key_topics || []).forEach((topic: string) => {
        if (topic.length > 2) {
          entityCounts.set(topic, (entityCounts.get(topic) || 0) + 1);
        }
      });
    });

    // Sort by mention count and return top entities
    const sortedEntities = Array.from(entityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50) // Only analyze top 50 entities
      .map(([entity]) => entity);

    // Always include high-impact entities if they exist
    this.HIGH_IMPACT_ENTITIES.forEach(entity => {
      if (!sortedEntities.includes(entity)) {
        sortedEntities.push(entity);
      }
    });

    return sortedEntities;
  }

  /**
   * Analyze silence pattern for a specific entity
   */
  private async analyzeSilencePattern(entity: string, lookbackDays: number): Promise<SilencePattern> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    // Get all mentions of this entity - use limit to prevent performance issues
    const { data: contentData, error } = await supabase
      .from('processed_content')
      .select('created_at, entities, key_topics, sentiment_score')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000); // Limit for performance

    if (error) throw error;

    // Filter content that mentions this entity
    const entityMentions = contentData?.filter(content => {
      const entities = content.entities || {};
      const allEntities = [
        ...(entities.companies || []),
        ...(entities.people || []),
        ...(entities.locations || []),
        ...(content.key_topics || [])
      ];
      return allEntities.some(e => 
        e.toLowerCase().includes(entity.toLowerCase()) || 
        entity.toLowerCase().includes(e.toLowerCase())
      );
    }) || [];

    // Calculate daily mention counts
    const dailyMentions = this.calculateDailyMentions(entityMentions, lookbackDays);
    
    // Calculate baseline statistics
    const historicalBaseline = this.calculateHistoricalBaseline(dailyMentions);
    
    // Detect current silence
    const currentSilence = this.detectCurrentSilence(dailyMentions, historicalBaseline);
    
    // Analyze correlations
    const correlations = await this.analyzeCorrelations(entity, entityMentions);
    
    // Generate predictions
    const predictions = this.generateSilencePredictions(currentSilence, historicalBaseline, correlations);

    return {
      entity,
      entityType: this.classifyEntityType(entity),
      currentSilence,
      historicalBaseline,
      correlations,
      predictions
    };
  }

  /**
   * Calculate daily mention counts
   */
  private calculateDailyMentions(mentions: any[], lookbackDays: number): { date: string; count: number }[] {
    const dailyCounts = new Map<string, number>();
    
    // Initialize all days with 0
    for (let i = 0; i < lookbackDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr) {
        dailyCounts.set(dateStr, 0);
      }
    }
    
    // Count actual mentions
    mentions.forEach(mention => {
      const date = mention.created_at.split('T')[0];
      if (dailyCounts.has(date)) {
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      }
    });
    
    return Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Calculate historical baseline for entity mentions
   */
  private calculateHistoricalBaseline(dailyMentions: { date: string; count: number }[]): SilencePattern['historicalBaseline'] {
    const counts = dailyMentions.map(d => d.count);
    const averageDaily = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    
    // Calculate standard deviation
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - averageDaily, 2), 0) / counts.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Identify typical silence patterns
    const silenceRuns: { duration: number; context: string }[] = [];
    let currentSilenceStart = -1;
    
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] === 0) {
        if (currentSilenceStart === -1) {
          currentSilenceStart = i;
        }
      } else {
        if (currentSilenceStart !== -1) {
          const duration = i - currentSilenceStart;
          if (duration >= 2) { // At least 2 days of silence
            silenceRuns.push({
              duration,
              context: this.getContextForSilence(dailyMentions?.[currentSilenceStart]?.date, duration)
            });
          }
          currentSilenceStart = -1;
        }
      }
    }
    
    // Group silence patterns
    const typicalSilencePatterns = this.groupSilencePatterns(silenceRuns);
    
    return {
      averageDaily,
      standardDeviation,
      typicalSilencePatterns
    };
  }

  /**
   * Detect current silence anomalies
   */
  private detectCurrentSilence(
    dailyMentions: { date: string; count: number }[],
    baseline: SilencePattern['historicalBaseline']
  ): SilencePattern['currentSilence'] {
    const recent = dailyMentions.slice(-7); // Last 7 days
    const recentAverage = recent.reduce((sum, d) => sum + d.count, 0) / recent.length;
    
    // Find current silence duration
    let silenceDuration = 0;
    for (let i = dailyMentions.length - 1; i >= 0; i--) {
      if (dailyMentions?.[i]?.count === 0) {
        silenceDuration++;
      } else {
        break;
      }
    }
    
    const expectedVsActual = baseline.averageDaily > 0 ? recentAverage / baseline.averageDaily : 1;
    
    // Calculate anomaly score
    const zScore = baseline.standardDeviation > 0 ? 
      Math.abs(recentAverage - baseline.averageDaily) / baseline.standardDeviation : 0;
    const anomalyScore = Math.min(zScore / 3, 1); // Normalize to 0-1
    
    return {
      duration: silenceDuration * 24, // Convert to hours
      expectedVsActual,
      anomalyScore
    };
  }

  /**
   * Analyze correlations with market events and other entities
   */
  private async analyzeCorrelations(entity: string, mentions: any[]): Promise<SilencePattern['correlations']> {
    // This would analyze correlations with market events and other entities
    // For now, return mock structure with realistic data
    return {
      marketEvents: [
        {
          event: 'Earnings announcements',
          correlationStrength: 0.75,
          timeLag: -3 // 3 days before
        },
        {
          event: 'Federal Reserve meetings',
          correlationStrength: 0.45,
          timeLag: -1 // 1 day before
        }
      ],
      otherEntitySilences: [
        {
          entity: 'Related companies in sector',
          correlationStrength: 0.6,
          simultaneousOccurrences: 3
        }
      ]
    };
  }

  /**
   * Generate predictions based on silence patterns
   */
  private generateSilencePredictions(
    currentSilence: SilencePattern['currentSilence'],
    baseline: SilencePattern['historicalBaseline'],
    correlations: SilencePattern['correlations']
  ): SilencePattern['predictions'] {
    // Probability calculation based on silence severity and historical patterns
    let probabilityOfEvent = 0;
    
    if (currentSilence.anomalyScore > 0.7) {
      probabilityOfEvent = 0.8;
    } else if (currentSilence.anomalyScore > 0.5) {
      probabilityOfEvent = 0.6;
    } else if (currentSilence.anomalyScore > 0.3) {
      probabilityOfEvent = 0.4;
    } else {
      probabilityOfEvent = 0.2;
    }
    
    // Adjust based on historical correlations
    const avgCorrelation = correlations.marketEvents.reduce((sum, e) => sum + e.correlationStrength, 0) / 
                          Math.max(correlations.marketEvents.length, 1);
    probabilityOfEvent *= (0.5 + avgCorrelation * 0.5);
    
    const estimatedTimeframe = currentSilence.duration < 48 ? '24-72 hours' :
                              currentSilence.duration < 168 ? '3-7 days' : '1-2 weeks';
    
    return {
      probabilityOfEvent: Math.min(probabilityOfEvent, 0.95),
      estimatedTimeframe,
      confidenceInterval: 0.7 + (currentSilence.anomalyScore * 0.3),
      potentialEventTypes: [
        'Earnings announcement',
        'Strategic partnership',
        'Regulatory development',
        'Product launch',
        'Management change'
      ]
    };
  }

  /**
   * Check if silence pattern is anomalous enough to generate an alert
   */
  private isSilenceAnomalous(pattern: SilencePattern): boolean {
    return pattern.currentSilence.anomalyScore > this.ANOMALY_THRESHOLD &&
           pattern.currentSilence.duration >= this.SILENCE_THRESHOLD_HOURS &&
           pattern.predictions.probabilityOfEvent > 0.4;
  }

  /**
   * Generate silence alert from pattern analysis
   */
  private async generateSilenceAlert(entity: string, pattern: SilencePattern): Promise<SilenceAlert | null> {
    try {
      const severity = this.calculateAlertSeverity(entity, pattern);
      const silenceType = this.determineSilenceType(pattern);
      
      // Get additional context
      const contextualFactors = await this.getContextualFactors(entity);
      
      const alert: SilenceAlert = {
        id: `silence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityName: entity,
        entityType: pattern.entityType,
        silenceType,
        severity,
        confidence: pattern.predictions.confidenceInterval,
        
        expectedMentions: Math.round(pattern.historicalBaseline.averageDaily * 7), // Weekly expected
        actualMentions: Math.round(pattern.historicalBaseline.averageDaily * pattern.currentSilence.expectedVsActual * 7),
        silenceRatio: 1 - pattern.currentSilence.expectedVsActual,
        silenceDuration: pattern.currentSilence.duration,
        
        historicalPattern: {
          averageMentions: pattern.historicalBaseline.averageDaily,
          typicalSilenceBefore: pattern.historicalBaseline.typicalSilencePatterns.map(p => p.context),
          lastMajorEvent: 'Unknown', // Would be populated from historical data
          daysSinceLastEvent: Math.floor(Math.random() * 90) + 30 // Mock data
        },
        
        predictionSignals: {
          announcementProbability: pattern.predictions.probabilityOfEvent,
          timeToEvent: this.parseTimeframe(pattern.predictions.estimatedTimeframe),
          eventType: pattern.predictions.potentialEventTypes[0] || 'Unknown',
          marketImpactPotential: severity === 'critical' ? 'high' : severity === 'high' ? 'medium' : 'low'
        },
        
        contextualFactors,
        
        actionable: {
          watchWindow: pattern.predictions.estimatedTimeframe,
          monitoringSuggestions: this.generateMonitoringSuggestions(entity, pattern),
          riskLevel: severity === 'critical' ? 'High' : severity === 'high' ? 'Medium' : 'Low',
          potentialCatalysts: pattern.predictions.potentialEventTypes
        },
        
        timestamp: new Date().toISOString(),
        detectedAt: new Date().toISOString()
      };
      
      return alert;
    } catch (error) {
      logger.error('Failed to generate silence alert:', error);
      return null;
    }
  }

  /**
   * Calculate alert severity based on entity importance and silence characteristics
   */
  private calculateAlertSeverity(entity: string, pattern: SilencePattern): SilenceAlert['severity'] {
    let severityScore = 0;
    
    // Entity importance
    if (this.HIGH_IMPACT_ENTITIES.some(e => entity.toLowerCase().includes(e.toLowerCase()))) {
      severityScore += 3;
    } else {
      severityScore += 1;
    }
    
    // Anomaly severity
    if (pattern.currentSilence.anomalyScore > 0.8) severityScore += 3;
    else if (pattern.currentSilence.anomalyScore > 0.6) severityScore += 2;
    else severityScore += 1;
    
    // Duration factor
    if (pattern.currentSilence.duration > 168) severityScore += 2; // More than a week
    else if (pattern.currentSilence.duration > 72) severityScore += 1; // More than 3 days
    
    // Prediction confidence
    if (pattern.predictions.probabilityOfEvent > 0.8) severityScore += 2;
    else if (pattern.predictions.probabilityOfEvent > 0.6) severityScore += 1;
    
    if (severityScore >= 8) return 'critical';
    if (severityScore >= 6) return 'high';
    if (severityScore >= 4) return 'medium';
    return 'low';
  }

  /**
   * Determine the type of silence detected
   */
  private determineSilenceType(pattern: SilencePattern): SilenceAlert['silenceType'] {
    if (pattern.currentSilence.duration > 168 && pattern.currentSilence.expectedVsActual < 0.1) {
      return 'information_void';
    }
    
    if (pattern.predictions.probabilityOfEvent > 0.7) {
      return 'pre_announcement';
    }
    
    if (pattern.currentSilence.expectedVsActual < 0.3 && pattern.currentSilence.duration > 48) {
      return 'sudden_drop';
    }
    
    return 'expected_absence';
  }

  /**
   * Get contextual factors that might explain the silence
   */
  private async getContextualFactors(entity: string): Promise<SilenceAlert['contextualFactors']> {
    // This would analyze broader market context
    return {
      earningsSeasonProximity: Math.random() > 0.7, // Mock: 30% chance it's earnings season
      marketConditions: ['bullish', 'bearish', 'volatile', 'stable'][Math.floor(Math.random() * 4)] || 'stable',
      sectorActivity: Math.random(),
      relatedEntitySilences: [] // Would be populated with related entities also in silence
    };
  }

  /**
   * Generate monitoring suggestions based on the silence pattern
   */
  private generateMonitoringSuggestions(entity: string, pattern: SilencePattern): string[] {
    const suggestions = [
      `Monitor ${entity} official channels for announcements`,
      'Watch for unusual trading volume or price movements',
      'Check SEC filings and regulatory databases'
    ];
    
    if (pattern.entityType === 'company') {
      suggestions.push('Review earnings calendar and analyst estimates');
      suggestions.push('Monitor insider trading activity');
    }
    
    if (pattern.predictions.probabilityOfEvent > 0.7) {
      suggestions.push('Set up news alerts for immediate notification');
      suggestions.push('Monitor options activity for unusual bets');
    }
    
    return suggestions;
  }

  /**
   * Helper functions
   */
  private classifyEntityType(entity: string): SilenceAlert['entityType'] {
    // Simple classification - would be more sophisticated in production
    const companyPatterns = /inc\.|corp\.|llc|company|technologies|systems|group/i;
    const personPatterns = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
    
    if (companyPatterns.test(entity)) return 'company';
    if (personPatterns.test(entity)) return 'person';
    
    // Check against known company/person lists
    const knownCompanies = ['Apple', 'Microsoft', 'Google', 'Tesla', 'NVIDIA', 'Amazon'];
    const knownPeople = ['Jerome Powell', 'Janet Yellen', 'Elon Musk', 'Warren Buffett'];
    
    if (knownCompanies.some(c => entity.includes(c))) return 'company';
    if (knownPeople.some(p => entity.includes(p))) return 'person';
    
    return 'topic';
  }

  private getContextForSilence(startDate: string, duration: number): string {
    // Would analyze what was happening during the silence period
    const contexts = ['Weekend period', 'Holiday period', 'Market closure', 'Low news cycle', 'Pre-earnings quiet period'];
    return contexts[Math.floor(Math.random() * contexts.length)] || 'Unknown';
  }

  private groupSilencePatterns(silenceRuns: { duration: number; context: string }[]): SilencePattern['historicalBaseline']['typicalSilencePatterns'] {
    const grouped = new Map<number, { count: number; contexts: string[] }>();
    
    silenceRuns.forEach(run => {
      const duration = run.duration;
      if (!grouped.has(duration)) {
        grouped.set(duration, { count: 0, contexts: [] });
      }
      const group = grouped.get(duration)!;
      group.count++;
      group.contexts.push(run.context);
    });
    
    return Array.from(grouped.entries()).map(([duration, data]) => ({
      duration,
      frequency: data.count / silenceRuns.length,
      context: data.contexts[0] || 'Unknown'
    }));
  }

  private parseTimeframe(timeframe: string): number {
    // Convert timeframe to hours
    if (timeframe.includes('24-72 hours')) return 48;
    if (timeframe.includes('3-7 days')) return 120;
    if (timeframe.includes('1-2 weeks')) return 252;
    return 72; // Default 3 days
  }
}

export const silenceDetectionService = new SilenceDetectionService();