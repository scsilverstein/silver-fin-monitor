import { supabase } from '../database/client';
import { logger } from '@/utils/logger';
import { OpenAI } from 'openai';
import config from '@/config';
import { cacheService } from '../database/cache';
import { TimeframeAnalysis, TimeframeQuery, AnalysisConstraints, ProcessedContent, Timeframe } from '@/types';

export class TimeframeAnalysisService {
  private openai: OpenAI | null = null;

  // Analysis constraints for different timeframes
  private readonly constraints: AnalysisConstraints = {
    minimumContent: {
      1: 5,    // 1 day needs at least 5 content items
      7: 20,   // 7 days needs at least 20 content items  
      30: 50,  // 30 days needs at least 50 content items
      90: 100  // 90 days needs at least 100 content items
    },
    analysisTypes: {
      sentiment: ['today', 'week', 'month', 'quarter'],
      trends: ['week', 'month', 'quarter'],
      patterns: ['month', 'quarter'],
      predictions: ['week', 'month', 'quarter']
    },
    maxDays: 365,
    defaultDays: 7
  };

  // Predefined timeframes
  private readonly predefinedTimeframes: Timeframe[] = [
    {
      id: 'today',
      label: 'Today',
      description: 'Current day analysis',
      value: 1,
      unit: 'day',
      type: 'preset',
      icon: '🌅',
      useCase: 'Real-time market pulse',
      isDefault: false
    },
    {
      id: 'week',
      label: '7 Days',
      description: 'Weekly trend analysis',
      value: 7,
      unit: 'days',
      type: 'preset',
      icon: '📅',
      useCase: 'Short-term trends',
      isDefault: true
    },
    {
      id: 'month',
      label: '30 Days',
      description: 'Monthly pattern analysis',
      value: 30,
      unit: 'days',
      type: 'preset',
      icon: '📊',
      useCase: 'Medium-term outlook',
      isDefault: false
    },
    {
      id: 'quarter',
      label: '90 Days',
      description: 'Quarterly trend analysis',
      value: 90,
      unit: 'days',
      type: 'preset',
      icon: '📈',
      useCase: 'Long-term patterns',
      isDefault: false
    },
    {
      id: 'custom',
      label: 'Custom Range',
      description: 'User-defined date range',
      type: 'date-range',
      icon: '🎯',
      useCase: 'Specific event analysis',
      isDefault: false
    }
  ];

  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  /**
   * Get available timeframes for selection
   */
  getAvailableTimeframes(): Timeframe[] {
    return this.predefinedTimeframes;
  }

  /**
   * Get recommended timeframe for a specific purpose
   */
  getRecommendedTimeframe(purpose: string): string {
    const recommendations: Record<string, string> = {
      'daily_trading': 'today',
      'weekly_review': 'week',
      'investment_research': 'month',
      'quarterly_report': 'quarter',
      'event_analysis': 'custom',
      'trend_analysis': 'week'
    };
    return recommendations[purpose] || 'week';
  }

  /**
   * Validate timeframe query parameters
   */
  validateTimeframe(timeframe: TimeframeQuery): { isValid: boolean; error?: string } {
    if (timeframe.period === 'custom') {
      if (!timeframe.startDate || !timeframe.endDate) {
        return { isValid: false, error: 'Custom timeframe requires startDate and endDate' };
      }
      
      const start = new Date(timeframe.startDate);
      const end = new Date(timeframe.endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > this.constraints.maxDays) {
        return { isValid: false, error: `Timeframe exceeds maximum of ${this.constraints.maxDays} days` };
      }
      
      if (daysDiff < 1) {
        return { isValid: false, error: 'End date must be after start date' };
      }
    }
    
    return { isValid: true };
  }

  /**
   * Calculate date range for timeframe
   */
  private calculateDateRange(timeframe: TimeframeQuery): { startDate: Date; endDate: Date; days: number } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);
    
    if (timeframe.period === 'custom' && timeframe.startDate && timeframe.endDate) {
      startDate = new Date(timeframe.startDate);
      endDate = new Date(timeframe.endDate);
    } else {
      const timeframeConfig = this.predefinedTimeframes.find(t => t.id === timeframe.period);
      const days = timeframeConfig?.value || this.constraints.defaultDays;
      
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days + 1);
    }
    
    // Set time to start/end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return { startDate, endDate, days };
  }

  /**
   * Generate timeframe-based analysis
   */
  async generateTimeframeAnalysis(timeframe: TimeframeQuery): Promise<TimeframeAnalysis> {
    logger.info('Generating timeframe analysis', { timeframe });

    // Validate timeframe
    const validation = this.validateTimeframe(timeframe);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Calculate date range
    const { startDate, endDate, days } = this.calculateDateRange(timeframe);

    // Create cache key
    const cacheKey = `timeframe_analysis:${timeframe.period}:${startDate.toISOString().split('T')[0]}:${endDate.toISOString().split('T')[0]}`;
    
    // Check cache first
    const cached = await cacheService.get<TimeframeAnalysis>(cacheKey);
    if (cached) {
      logger.info('Using cached timeframe analysis', { timeframe, cacheKey });
      return cached;
    }

    // Get processed content for the timeframe
    const { data: processedContent, error } = await supabase
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
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!processedContent || processedContent.length === 0) {
      throw new Error(`No content available for timeframe: ${timeframe.period}`);
    }

    // Check minimum content requirements
    const minRequired = this.constraints.minimumContent[days] || 10;
    if (processedContent.length < minRequired) {
      logger.warn(`Insufficient content for reliable analysis`, { 
        required: minRequired, 
        available: processedContent.length,
        timeframe 
      });
    }

    logger.info('Found content for timeframe analysis', { 
      timeframe,
      contentCount: processedContent.length,
      days,
      dateRange: { startDate, endDate }
    });

    // Generate analysis
    const analysis = await this.generateAnalysis(processedContent, timeframe, { startDate, endDate, days });

    // Cache the result (shorter TTL for recent data)
    const ttl = days === 1 ? 60 * 60 : 24 * 60 * 60; // 1 hour for today, 24 hours for others
    await cacheService.set(cacheKey, analysis, ttl);

    return analysis;
  }

  /**
   * Generate analysis from processed content
   */
  private async generateAnalysis(
    content: any[], 
    timeframe: TimeframeQuery,
    dateInfo: { startDate: Date; endDate: Date; days: number }
  ): Promise<TimeframeAnalysis> {
    // Calculate content distribution
    const contentDistribution = this.calculateContentDistribution(content);

    // Aggregate sentiment
    const avgSentiment = content.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / content.length;
    const marketSentiment = avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral';

    // Aggregate topics
    const topicCounts = new Map<string, number>();
    content.forEach(item => {
      (item.key_topics || []).forEach((topic: string) => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    const keyThemes = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8) // More themes for longer timeframes
      .map(([topic]) => topic);

    // Basic analysis data
    let aiAnalysis = {
      marketDrivers: [],
      riskFactors: [],
      opportunities: [],
      geopoliticalContext: '',
      economicIndicators: [],
      trendAnalysis: {
        direction: 'sideways' as const,
        strength: 0.5,
        volatility: 0.5
      },
      timeframeSpecificInsights: []
    };
    let overallSummary = '';
    let confidenceScore = 0.7;

    // Use AI for comprehensive timeframe analysis
    if (this.openai) {
      try {
        const analysisResult = await this.callOpenAIForTimeframeAnalysis(
          content, 
          timeframe, 
          dateInfo,
          { avgSentiment, keyThemes, contentDistribution }
        );
        
        aiAnalysis = analysisResult.aiAnalysis;
        overallSummary = analysisResult.overallSummary;
        confidenceScore = analysisResult.confidenceScore;

      } catch (error) {
        logger.error('AI timeframe analysis failed', { error, timeframe });
        overallSummary = this.generateBasicSummary(content, timeframe);
      }
    } else {
      overallSummary = this.generateBasicSummary(content, timeframe);
    }

    const analysis: TimeframeAnalysis = {
      id: `${timeframe.period}_${Date.now()}`,
      timeframe,
      analysisDate: new Date(),
      marketSentiment,
      keyThemes,
      overallSummary,
      aiAnalysis,
      confidenceScore,
      sourcesAnalyzed: content.length,
      contentDistribution,
      createdAt: new Date()
    };

    return analysis;
  }

  /**
   * Call OpenAI for timeframe-specific analysis
   */
  private async callOpenAIForTimeframeAnalysis(
    content: any[],
    timeframe: TimeframeQuery,
    dateInfo: { startDate: Date; endDate: Date; days: number },
    aggregates: { avgSentiment: number; keyThemes: string[]; contentDistribution: any }
  ) {
    const timeframeName = timeframe.period === 'custom' 
      ? `${dateInfo.days} days` 
      : this.predefinedTimeframes.find(t => t.id === timeframe.period)?.label || timeframe.period;

    // Prepare content summaries (limit to avoid token limits)
    const contentSummaries = content
      .slice(0, Math.min(1000, content.length))
      .map(item => ({
        date: item.created_at,
        source: item.raw_feeds?.feed_sources?.name || 'Unknown',
        summary: item.summary,
        sentiment: item.sentiment_score,
        topics: item.key_topics || []
      }));

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `You are a world-class market analyst conducting a ${timeframeName} timeframe analysis.

Analysis Period: ${dateInfo.startDate.toISOString().split('T')[0]} to ${dateInfo.endDate.toISOString().split('T')[0]}
Timeframe Context: ${timeframe.period}
Content Volume: ${content.length} sources analyzed

Conduct a comprehensive timeframe-specific analysis including:
1. Market sentiment evolution over this period
2. Key themes and their prominence
3. Market drivers specific to this timeframe
4. Risk factors emerging or persisting
5. Investment opportunities identified
6. Geopolitical developments affecting markets
7. Economic indicators and their trends
8. Trend analysis (direction, strength, volatility)
9. Timeframe-specific insights and patterns
10. Overall summary tailored to this time horizon

Format your response as JSON:
{
  "confidence": 0.85,
  "market_drivers": ["driver1", "driver2", ...],
  "risk_factors": ["risk1", "risk2", ...],
  "opportunities": ["opportunity1", "opportunity2", ...],
  "geopolitical_context": "Timeframe-specific geopolitical summary",
  "economic_indicators": ["indicator1", "indicator2", ...],
  "trend_analysis": {
    "direction": "upward|downward|sideways",
    "strength": 0.75,
    "volatility": 0.6
  },
  "timeframe_specific_insights": ["insight1", "insight2", ...],
  "summary": "Comprehensive ${timeframeName} market analysis summary..."
}`
        },
        {
          role: 'user',
          content: JSON.stringify({
            timeframe: timeframe.period,
            period_days: dateInfo.days,
            date_range: {
              start: dateInfo.startDate.toISOString().split('T')[0],
              end: dateInfo.endDate.toISOString().split('T')[0]
            },
            content_stats: {
              total_sources: content.length,
              avg_sentiment: aggregates.avgSentiment,
              distribution: aggregates.contentDistribution
            },
            top_themes: aggregates.keyThemes,
            content_summaries: contentSummaries
          })
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const messageContent = completion.choices[0]?.message.content;
    const response = messageContent ? JSON.parse(messageContent) : {};
    
    return {
      aiAnalysis: {
        marketDrivers: response.market_drivers || [],
        riskFactors: response.risk_factors || [],
        opportunities: response.opportunities || [],
        geopoliticalContext: response.geopolitical_context || '',
        economicIndicators: response.economic_indicators || [],
        trendAnalysis: {
          direction: response.trend_analysis?.direction || 'sideways',
          strength: response.trend_analysis?.strength || 0.5,
          volatility: response.trend_analysis?.volatility || 0.5
        },
        timeframeSpecificInsights: response.timeframe_specific_insights || []
      },
      overallSummary: response.summary || this.generateBasicSummary(content, timeframe),
      confidenceScore: response.confidence || 0.7
    };
  }

  /**
   * Calculate content distribution metrics
   */
  private calculateContentDistribution(content: any[]) {
    const byDate: Record<string, number> = {};
    const bySentiment: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    const bySource: Record<string, number> = {};

         content.forEach(item => {
       if (!item) return;
       
       // By date
       const date = item.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];
       byDate[date] = (byDate[date] || 0) + 1;

       // By sentiment
       const sentimentScore = item.sentiment_score || 0;
       const sentiment = sentimentScore > 0.1 ? 'positive' : 
                        sentimentScore < -0.1 ? 'negative' : 'neutral';
       bySentiment[sentiment] = (bySentiment[sentiment] || 0) + 1;

       // By source
       const source = item.raw_feeds?.feed_sources?.name || 'Unknown';
       bySource[source] = (bySource[source] || 0) + 1;
     });

    return {
      totalItems: content.length,
      byDate,
      bySentiment,
      bySource
    };
  }

  /**
   * Generate basic summary when AI is not available
   */
  private generateBasicSummary(content: any[], timeframe: TimeframeQuery): string {
    const timeframeName = timeframe.period === 'custom' ? 'custom period' : timeframe.period;
    const topSources = content.slice(0, 5);
    const summaries = topSources.map(item => item.summary).filter(Boolean).join(' ');
    
    if (!summaries) {
      return `Analysis for ${timeframeName} based on ${content.length} sources. No detailed summaries available.`;
    }
    
    const sentences = summaries.split(/[.!?]+/).slice(0, 3);
    return `${timeframeName.charAt(0).toUpperCase()}${timeframeName.slice(1)} analysis: ${sentences.join('. ').trim()}.`;
  }
}

export const timeframeAnalysisService = new TimeframeAnalysisService(); 