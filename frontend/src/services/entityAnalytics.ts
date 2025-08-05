// Entity Analytics Service - handles trending calculations and sentiment analysis
import { entityAnalyticsApi } from '../lib/api';
import {
  EntityAnalytics,
  EntityTrend,
  EntityComparison,
  EntityDashboardData,
  EntityFilter,
  EntityMention,
  EntityInsight,
  EntityAnalyticsResponse,
  EntityTrendsResponse,
  EntityComparisonResponse,
  EntityDashboardResponse,
  TrendChartData,
  SentimentChartData
} from '../types/entityAnalytics';

class EntityAnalyticsService {
  // Get entity analytics dashboard
  async getDashboardData(timeRange?: { start: Date; end: Date }): Promise<EntityDashboardData> {
    const backendData = await entityAnalyticsApi.getDashboardData();
    
    // Transform backend data to match frontend interface
    
    return {
      topTrending: backendData.topTrending?.map((entity: any) => ({
        entityName: entity.entityName,
        entityType: entity.entityType,
        totalMentions: entity.totalMentions,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        overallSentiment: entity.overallSentiment,
        sentimentTrend: 'stable' as const,
        trendingScore: entity.trendingScore || 0,
        weeklyChange: 0,
        monthlyChange: 0,
        topSources: [],
        historicalMentions: [],
        relatedEntities: []
      })) || [],
      sentimentLeaders: backendData.sentimentLeaders?.map((entity: any) => ({
        entityName: entity.entityName,
        entityType: entity.entityType,
        totalMentions: entity.totalMentions,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        overallSentiment: entity.overallSentiment,
        sentimentTrend: 'stable' as const,
        trendingScore: 0,
        weeklyChange: 0,
        monthlyChange: 0,
        topSources: [],
        historicalMentions: [],
        relatedEntities: []
      })) || [],
      sentimentLaggers: backendData.topTrending?.filter((e: any) => e.overallSentiment < -0.2) || [],
      newEntities: [],
      insights: [],
      totalEntitiesTracked: backendData.totalEntitiesTracked || 0,
      totalMentionsToday: backendData.totalMentionsToday || 0,
      averageSentimentToday: backendData.averageSentimentToday || 0
    };
  }

  // Get detailed analytics for a specific entity
  async getEntityAnalytics(entityName: string, entityType?: string): Promise<EntityAnalytics> {
    const backendData = await entityAnalyticsApi.getEntityAnalytics(entityName);
    
    // Transform to match frontend interface
    return {
      entityName: backendData.entityName,
      entityType: backendData.entityType,
      totalMentions: backendData.totalMentions,
      firstMentioned: new Date(),
      lastMentioned: new Date(),
      overallSentiment: backendData.overallSentiment,
      sentimentTrend: 'stable' as const,
      trendingScore: backendData.trendingScore,
      weeklyChange: 0,
      monthlyChange: 0,
      topSources: [],
      historicalMentions: backendData.historicalMentions || [],
      relatedEntities: []
    };
  }

  // Get trending entities with filters
  async getTrendingEntities(filter?: EntityFilter): Promise<EntityTrend[]> {
    const params = new URLSearchParams();
    
    if (filter) {
      if (filter.entityTypes?.length) {
        params.append('types', filter.entityTypes.join(','));
      }
      if (filter.sentimentRange) {
        params.append('sentimentMin', filter.sentimentRange.min.toString());
        params.append('sentimentMax', filter.sentimentRange.max.toString());
      }
      if (filter.dateRange) {
        params.append('start', filter.dateRange.start.toISOString());
        params.append('end', filter.dateRange.end.toISOString());
      }
      if (filter.sources?.length) {
        params.append('sources', filter.sources.join(','));
      }
      if (filter.minMentions) {
        params.append('minMentions', filter.minMentions.toString());
      }
      if (filter.trendingOnly) {
        params.append('trendingOnly', 'true');
      }
      if (filter.sortBy) {
        params.append('sortBy', filter.sortBy);
      }
      if (filter.sortOrder) {
        params.append('sortOrder', filter.sortOrder);
      }
    }
    
    // For now, return empty array since trending is not implemented in mock
    // const response = await api.get<EntityTrendsResponse>(`${this.baseUrl}/trending?${params}`);
    return [];
  }

  // Compare multiple entities
  async compareEntities(
    entities: string[],
    timeRange: { start: Date; end: Date },
    metric: 'mentions' | 'sentiment' | 'trending' = 'mentions'
  ): Promise<EntityComparison> {
    const payload = {
      entities,
      timeRange: {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString()
      },
      metric
    };
    
    // For now, return empty comparison since not implemented in mock
    return {
      entities,
      timeRange,
      metric,
      data: []
    };
  }

  // Get entity mentions with context
  async getEntityMentions(
    entityName: string,
    limit: number = 10000,
    offset: number = 0
  ): Promise<{ mentions: EntityMention[]; total: number }> {
    const response = await entityAnalyticsApi.getEntityMentions(entityName, limit, offset);
    
    // Map backend response to match EntityMention interface
    const mappedMentions = (response.mentions || []).map((mention: any) => ({
      id: mention.id,
      entityName: entityName,
      entityType: 'topic', // This would need to be passed or fetched separately
      mentionDate: new Date(mention.mentionDate),
      sourceId: mention.source?.id || '',
      sourceName: mention.source?.name || mention.sourceName || 'Unknown Source', 
      sourceType: mention.source?.type || mention.sourceType || 'unknown',
      sentimentScore: mention.sentiment || mention.sentimentScore || 0,
      confidence: mention.confidence || 0.5,
      contextSnippet: mention.contentSummary || mention.contextSnippet || '',
      contentId: mention.contentId || mention.id,
      contentTitle: mention.title || mention.contentTitle || 'Untitled'
    }));
    
    return {
      mentions: mappedMentions,
      total: response.total || 0
    };
  }

  // Get entity insights (AI-generated observations)
  async getEntityInsights(entityName?: string): Promise<EntityInsight[]> {
    // For now, return empty insights since not implemented in mock
    return [];
  }

  // Search entities
  async searchEntities(query: string, limit: number = 10): Promise<Array<{
    entityName: string;
    entityType: string;
    mentionCount: number;
    recentSentiment: number;
  }>> {
    return await entityAnalyticsApi.searchEntities(query, limit);
  }

  // Client-side utility functions

  // Calculate sentiment trend from historical data
  calculateSentimentTrend(history: Array<{ date: string; sentiment: number }>): 'improving' | 'declining' | 'stable' | 'volatile' {
    if (history.length < 3) return 'stable';
    
    // Get recent vs older averages
    const recentData = history.slice(-7); // Last 7 days
    const olderData = history.slice(-14, -7); // Previous 7 days
    
    if (olderData.length === 0) return 'stable';
    
    const recentAvg = recentData.reduce((sum, d) => sum + d.sentiment, 0) / recentData.length;
    const olderAvg = olderData.reduce((sum, d) => sum + d.sentiment, 0) / olderData.length;
    
    const change = recentAvg - olderAvg;
    const volatility = this.calculateVolatility(recentData.map(d => d.sentiment));
    
    if (volatility > 0.3) return 'volatile';
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  // Calculate volatility (standard deviation)
  private calculateVolatility(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Transform data for chart consumption
  transformToTrendChartData(trends: EntityTrend[]): TrendChartData[] {
    return trends.map(trend => ({
      date: trend.date,
      mentions: trend.mentionCount,
      sentiment: Math.round(trend.averageSentiment * 100) / 100,
      trendScore: Math.round(trend.trendScore * 100) / 100
    }));
  }

  // Transform sentiment data for pie/bar charts
  transformToSentimentChartData(trends: EntityTrend[]): SentimentChartData[] {
    return trends.map(trend => {
      const positive = trend.averageSentiment > 0.1 ? trend.mentionCount : 0;
      const negative = trend.averageSentiment < -0.1 ? trend.mentionCount : 0;
      const neutral = Math.abs(trend.averageSentiment) <= 0.1 ? trend.mentionCount : 0;
      
      return {
        date: trend.date,
        positive,
        negative,
        neutral,
        total: trend.mentionCount
      };
    });
  }

  // Generate color for entity based on sentiment
  getEntityColor(sentiment: number): string {
    if (sentiment > 0.3) return '#10b981'; // Green for positive
    if (sentiment < -0.3) return '#ef4444'; // Red for negative
    if (sentiment > 0.1) return '#84cc16'; // Light green for slightly positive
    if (sentiment < -0.1) return '#f97316'; // Orange for slightly negative
    return '#6b7280'; // Gray for neutral
  }

  // Format sentiment for display
  formatSentiment(sentiment: number): { text: string; color: string; icon: string } {
    const color = this.getEntityColor(sentiment);
    
    if (sentiment > 0.5) return { text: 'Very Positive', color, icon: '📈' };
    if (sentiment > 0.2) return { text: 'Positive', color, icon: '👍' };
    if (sentiment > 0.05) return { text: 'Slightly Positive', color, icon: '↗️' };
    if (sentiment < -0.5) return { text: 'Very Negative', color, icon: '📉' };
    if (sentiment < -0.2) return { text: 'Negative', color, icon: '👎' };
    if (sentiment < -0.05) return { text: 'Slightly Negative', color, icon: '↘️' };
    return { text: 'Neutral', color, icon: '➖' };
  }

  // Calculate trending score based on mention frequency and recency
  calculateTrendingScore(mentions: EntityMention[]): number {
    if (mentions.length === 0) return 0;
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Weight recent mentions more heavily
    let score = 0;
    mentions.forEach(mention => {
      const mentionDate = new Date(mention.mentionDate);
      if (mentionDate > oneDayAgo) {
        score += 10; // Last 24 hours
      } else if (mentionDate > oneWeekAgo) {
        score += 3; // Last week
      } else {
        score += 1; // Older
      }
    });
    
    // Normalize to 0-100 scale (roughly)
    return Math.min(100, Math.round(score));
  }

  // Get time range options for filtering
  getTimeRangeOptions(): Array<{ label: string; value: { start: Date; end: Date } }> {
    const now = new Date();
    return [
      {
        label: 'Last 24 Hours',
        value: {
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          end: now
        }
      },
      {
        label: 'Last 3 Days',
        value: {
          start: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          end: now
        }
      },
      {
        label: 'Last Week',
        value: {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        }
      },
      {
        label: 'Last Month',
        value: {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        }
      },
      {
        label: 'Last 3 Months',
        value: {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          end: now
        }
      }
    ];
  }
}

export const entityAnalyticsService = new EntityAnalyticsService();