import { supabase } from '../database/client';
import { logger } from '../../utils/logger';

export interface NarrativeMomentum {
  narrative: string;
  timeframe: string;
  velocity: number; // Mentions per hour
  acceleration: number; // Change in velocity
  dominance: number; // % of total discussion
  crossoverScore: number; // 0-1, likelihood of mainstream crossover
  sentimentEvolution: {
    current: number;
    trend: 'strengthening' | 'weakening' | 'stable';
    volatility: number;
  };
  sourceBreakdown: {
    mainstream: number;
    specialized: number;
    social: number;
  };
  mutations: {
    originalForm: string;
    currentForm: string;
    similarityScore: number;
  }[];
  predictiveSignals: {
    momentum: number; // 0-1 score
    breakoutProbability: number;
    estimatedPeakTime: string;
    marketRelevance: number;
  };
  historicalComparisons: {
    similarNarratives: string[];
    averageLifespan: number;
    typicalOutcomes: string[];
  };
}

export interface NarrativeAlert {
  id: string;
  narrative: string;
  alertType: 'explosive_growth' | 'crossover_imminent' | 'narrative_mutation' | 'momentum_reversal';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  message: string;
  actionable: {
    timeWindow: string;
    suggestedActions: string[];
    riskLevel: string;
  };
  data: Partial<NarrativeMomentum>;
  timestamp: string;
}

class NarrativeMomentumService {
  private readonly VELOCITY_WINDOWS = [1, 4, 12, 24, 48]; // Hours
  private readonly CROSSOVER_THRESHOLD = 0.7;
  private readonly EXPLOSIVE_GROWTH_THRESHOLD = 3.0; // 3x normal velocity

  /**
   * Analyze narrative momentum across all active topics
   */
  async analyzeNarrativeMomentum(timeframe: '24h' | '7d' | '30d' = '24h'): Promise<NarrativeMomentum[]> {
    try {
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

      // Get all content with topics in timeframe
      const { data: contentData, error } = await supabase
        .from('processed_content')
        .select(`
          id,
          key_topics,
          sentiment_score,
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
        .not('key_topics', 'is', null);

      if (error) throw error;

      // Extract and analyze narratives
      const narratives = await this.extractNarratives(contentData || []);
      const momentumAnalysis = await Promise.all(
        narratives.map(narrative => this.analyzeNarrative(narrative, contentData || [], timeframe))
      );

      return momentumAnalysis
        .filter(analysis => analysis.velocity > 0.1) // Filter out low-activity narratives
        .sort((a, b) => b.predictiveSignals.momentum - a.predictiveSignals.momentum);

    } catch (error) {
      logger.error('Narrative momentum analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract unique narratives from content data
   */
  private async extractNarratives(contentData: any[]): Promise<string[]> {
    const topicCounts = new Map<string, number>();
    
    contentData.forEach(content => {
      if (content.key_topics) {
        content.key_topics.forEach((topic: string) => {
          const normalizedTopic = this.normalizeNarrative(topic);
          topicCounts.set(normalizedTopic, (topicCounts.get(normalizedTopic) || 0) + 1);
        });
      }
    });

    // Return topics with significant mention counts
    return Array.from(topicCounts.entries())
      .filter(([_, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20) // Top 20 narratives
      .map(([topic]) => topic);
  }

  /**
   * Analyze a specific narrative for momentum indicators
   */
  private async analyzeNarrative(
    narrative: string, 
    contentData: any[], 
    timeframe: string
  ): Promise<NarrativeMomentum> {
    // Filter content related to this narrative
    const relevantContent = contentData.filter(content => 
      content.key_topics?.some((topic: string) => 
        this.narrativeSimilarity(this.normalizeNarrative(topic), narrative) > 0.7
      )
    );

    // Calculate velocity and acceleration
    const velocity = await this.calculateVelocity(relevantContent);
    const acceleration = await this.calculateAcceleration(relevantContent);
    
    // Calculate dominance (% of total discussion)
    const dominance = relevantContent.length / contentData.length * 100;

    // Analyze source breakdown
    const sourceBreakdown = this.analyzeSourceBreakdown(relevantContent);
    
    // Calculate crossover score
    const crossoverScore = this.calculateCrossoverScore(sourceBreakdown, velocity, acceleration);

    // Analyze sentiment evolution
    const sentimentEvolution = this.analyzeSentimentEvolution(relevantContent);

    // Detect narrative mutations
    const mutations = this.detectNarrativeMutations(narrative, relevantContent);

    // Calculate predictive signals
    const predictiveSignals = this.calculatePredictiveSignals(
      velocity, acceleration, crossoverScore, sentimentEvolution
    );

    // Get historical comparisons
    const historicalComparisons = await this.getHistoricalComparisons(narrative);

    return {
      narrative,
      timeframe,
      velocity,
      acceleration,
      dominance,
      crossoverScore,
      sentimentEvolution,
      sourceBreakdown,
      mutations,
      predictiveSignals,
      historicalComparisons
    };
  }

  /**
   * Calculate narrative velocity (mentions per hour)
   */
  private async calculateVelocity(relevantContent: any[]): Promise<number> {
    if (relevantContent.length === 0) return 0;

    // Group by hour and calculate average
    const hourlyMentions = new Map<string, number>();
    
    relevantContent.forEach(content => {
      const hour = new Date(content.created_at).toISOString().slice(0, 13);
      hourlyMentions.set(hour, (hourlyMentions.get(hour) || 0) + 1);
    });

    const velocities = Array.from(hourlyMentions.values());
    return velocities.reduce((sum, v) => sum + v, 0) / Math.max(velocities.length, 1);
  }

  /**
   * Calculate narrative acceleration (change in velocity)
   */
  private async calculateAcceleration(relevantContent: any[]): Promise<number> {
    if (relevantContent.length < 2) return 0;

    // Split into two halves and compare velocities
    const midpoint = Math.floor(relevantContent.length / 2);
    const firstHalf = relevantContent.slice(0, midpoint);
    const secondHalf = relevantContent.slice(midpoint);

    const firstVelocity = await this.calculateVelocity(firstHalf);
    const secondVelocity = await this.calculateVelocity(secondHalf);

    return secondVelocity - firstVelocity;
  }

  /**
   * Analyze source breakdown (mainstream vs specialized vs social)
   */
  private analyzeSourceBreakdown(relevantContent: any[]): {
    mainstream: number;
    specialized: number;
    social: number;
  } {
    const breakdown = { mainstream: 0, specialized: 0, social: 0 };
    
    relevantContent.forEach(content => {
      const sourceType = content.raw_feeds?.feed_sources?.type;
      const sourceName = content.raw_feeds?.feed_sources?.name?.toLowerCase() || '';
      
      if (sourceName.includes('bloomberg') || sourceName.includes('reuters') || 
          sourceName.includes('wsj') || sourceName.includes('cnbc')) {
        breakdown.mainstream++;
      } else if (sourceType === 'podcast' || sourceName.includes('newsletter')) {
        breakdown.specialized++;
      } else {
        breakdown.social++;
      }
    });

    const total = breakdown.mainstream + breakdown.specialized + breakdown.social;
    if (total === 0) return breakdown;

    return {
      mainstream: breakdown.mainstream / total,
      specialized: breakdown.specialized / total,
      social: breakdown.social / total
    };
  }

  /**
   * Calculate crossover score (likelihood of mainstream adoption)
   */
  private calculateCrossoverScore(
    sourceBreakdown: any, 
    velocity: number, 
    acceleration: number
  ): number {
    // Higher score if:
    // 1. Started in specialized sources
    // 2. High velocity and acceleration
    // 3. Beginning to appear in mainstream

    const specializedDominance = sourceBreakdown.specialized;
    const mainstreamPresence = sourceBreakdown.mainstream;
    const velocityScore = Math.min(velocity / 10, 1); // Normalize to 0-1
    const accelerationScore = Math.max(0, Math.min(acceleration / 5, 1));

    return (specializedDominance * 0.4 + 
            mainstreamPresence * 0.3 + 
            velocityScore * 0.2 + 
            accelerationScore * 0.1);
  }

  /**
   * Analyze sentiment evolution within the narrative
   */
  private analyzeSentimentEvolution(relevantContent: any[]): {
    current: number;
    trend: 'strengthening' | 'weakening' | 'stable';
    volatility: number;
  } {
    if (relevantContent.length === 0) {
      return { current: 0, trend: 'stable', volatility: 0 };
    }

    const sentiments = relevantContent.map(c => c.sentiment_score).filter(s => s !== null);
    const current = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;

    // Calculate trend by comparing first and second half
    const midpoint = Math.floor(sentiments.length / 2);
    const firstHalf = sentiments.slice(0, midpoint);
    const secondHalf = sentiments.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length;
    
    const change = secondAvg - firstAvg;
    const trend = Math.abs(change) < 0.1 ? 'stable' : 
                  change > 0 ? 'strengthening' : 'weakening';

    // Calculate volatility (standard deviation)
    const mean = current;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    const volatility = Math.sqrt(variance);

    return { current, trend, volatility };
  }

  /**
   * Detect narrative mutations (how the story is evolving)
   */
  private detectNarrativeMutations(narrative: string, relevantContent: any[]): any[] {
    // This is a simplified version - in production, would use NLP for semantic analysis
    const topicVariations = new Set<string>();
    
    relevantContent.forEach(content => {
      content.key_topics?.forEach((topic: string) => {
        if (this.narrativeSimilarity(this.normalizeNarrative(topic), narrative) > 0.5) {
          topicVariations.add(topic);
        }
      });
    });

    return Array.from(topicVariations).map(variation => ({
      originalForm: narrative,
      currentForm: variation,
      similarityScore: this.narrativeSimilarity(narrative, variation)
    }));
  }

  /**
   * Calculate predictive signals for market impact
   */
  private calculatePredictiveSignals(
    velocity: number,
    acceleration: number,
    crossoverScore: number,
    sentimentEvolution: any
  ): {
    momentum: number;
    breakoutProbability: number;
    estimatedPeakTime: string;
    marketRelevance: number;
  } {
    // Composite momentum score
    const momentum = Math.min(
      (velocity * 0.4 + 
       Math.max(0, acceleration) * 0.3 + 
       crossoverScore * 0.2 + 
       Math.abs(sentimentEvolution.current) * 0.1), 
      1
    );

    // Breakout probability based on multiple factors
    const breakoutProbability = Math.min(
      momentum * crossoverScore * (acceleration > 0 ? 1.5 : 0.8),
      1
    );

    // Estimate peak time based on velocity and acceleration
    const estimatedHoursToPeak = acceleration > 0 ? 
      Math.max(4, 24 - (velocity * 2)) : 48;
    const estimatedPeakTime = new Date(Date.now() + estimatedHoursToPeak * 3600000).toISOString();

    // Market relevance based on topic content
    const marketRelevance = this.assessMarketRelevance(sentimentEvolution.current);

    return {
      momentum,
      breakoutProbability,
      estimatedPeakTime,
      marketRelevance
    };
  }

  /**
   * Get historical comparisons for similar narratives
   */
  private async getHistoricalComparisons(narrative: string): Promise<{
    similarNarratives: string[];
    averageLifespan: number;
    typicalOutcomes: string[];
  }> {
    // This would query historical data in production
    // For now, return mock structure with realistic data
    return {
      similarNarratives: ['AI revolution 2023', 'Inflation concerns 2022', 'Fed pivot speculation'],
      averageLifespan: 168, // 7 days in hours
      typicalOutcomes: ['Market volatility spike', 'Sector rotation', 'Policy response']
    };
  }

  /**
   * Normalize narrative text for comparison
   */
  private normalizeNarrative(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two narratives
   */
  private narrativeSimilarity(a: string, b: string): number {
    // Simple word overlap similarity - in production would use semantic similarity
    const wordsA = new Set(a.split(' '));
    const wordsB = new Set(b.split(' '));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  /**
   * Assess market relevance of a narrative
   */
  private assessMarketRelevance(sentiment: number): number {
    // Higher relevance for stronger sentiment (positive or negative)
    // Market-moving news tends to have extreme sentiment
    return Math.abs(sentiment);
  }

  /**
   * Generate alerts based on narrative momentum
   */
  async generateNarrativeAlerts(narratives: NarrativeMomentum[]): Promise<NarrativeAlert[]> {
    const alerts: NarrativeAlert[] = [];

    for (const narrative of narratives) {
      // Explosive growth alert
      if (narrative.velocity > this.EXPLOSIVE_GROWTH_THRESHOLD && 
          narrative.acceleration > 0) {
        alerts.push({
          id: `explosive-${Date.now()}-${Math.random()}`,
          narrative: narrative.narrative,
          alertType: 'explosive_growth',
          severity: narrative.predictiveSignals.momentum > 0.8 ? 'critical' : 'high',
          confidence: narrative.predictiveSignals.momentum,
          message: `"${narrative.narrative}" showing explosive growth: ${narrative.velocity.toFixed(1)} mentions/hour (${(narrative.acceleration * 100).toFixed(0)}% acceleration)`,
          actionable: {
            timeWindow: '4-8 hours',
            suggestedActions: ['Monitor for market impact', 'Check related assets', 'Prepare for volatility'],
            riskLevel: narrative.predictiveSignals.marketRelevance > 0.7 ? 'High' : 'Medium'
          },
          data: narrative,
          timestamp: new Date().toISOString()
        });
      }

      // Crossover imminent alert
      if (narrative.crossoverScore > this.CROSSOVER_THRESHOLD && 
          narrative.sourceBreakdown.mainstream < 0.5) {
        alerts.push({
          id: `crossover-${Date.now()}-${Math.random()}`,
          narrative: narrative.narrative,
          alertType: 'crossover_imminent',
          severity: 'high',
          confidence: narrative.crossoverScore,
          message: `"${narrative.narrative}" approaching mainstream crossover (${(narrative.crossoverScore * 100).toFixed(0)}% probability)`,
          actionable: {
            timeWindow: '2-6 hours',
            suggestedActions: ['Position before mainstream adoption', 'Monitor news wires', 'Set volatility alerts'],
            riskLevel: 'Medium'
          },
          data: narrative,
          timestamp: new Date().toISOString()
        });
      }

      // Narrative mutation alert
      if (narrative.mutations.length > 0 && 
          narrative.mutations.some(m => m.similarityScore < 0.6)) {
        alerts.push({
          id: `mutation-${Date.now()}-${Math.random()}`,
          narrative: narrative.narrative,
          alertType: 'narrative_mutation',
          severity: 'medium',
          confidence: 0.7,
          message: `"${narrative.narrative}" narrative is mutating - story changing form`,
          actionable: {
            timeWindow: '6-12 hours',
            suggestedActions: ['Track narrative evolution', 'Assess new implications', 'Adjust positions if needed'],
            riskLevel: 'Low'
          },
          data: narrative,
          timestamp: new Date().toISOString()
        });
      }
    }

    return alerts;
  }
}

export const narrativeMomentumService = new NarrativeMomentumService();