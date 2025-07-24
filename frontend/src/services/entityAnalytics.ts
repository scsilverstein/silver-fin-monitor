// Entity Analytics Service - handles trending calculations and sentiment analysis
import { api } from '../lib/api';
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
  private baseUrl = '/entity-analytics'; // Note: This gets prefixed with /api/v1 by axios instance

  // Get entity analytics dashboard
  async getDashboardData(timeRange?: { start: Date; end: Date }): Promise<EntityDashboardData> {
    const params = new URLSearchParams();
    if (timeRange) {
      params.append('start', timeRange.start.toISOString());
      params.append('end', timeRange.end.toISOString());
    }
    
    const response = await api.get(`${this.baseUrl}/dashboard?${params}`);
    
    // Transform backend data to match frontend interface
    const backendData = response.data.data;
    
    return {
      topTrending: backendData.topEntities?.map((entity: any) => ({
        entityName: entity.entityName,
        entityType: entity.entityType,
        totalMentions: entity.mentionCount,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        overallSentiment: entity.sentiment,
        sentimentTrend: 'stable' as const,
        trendingScore: entity.trendScore || 0,
        weeklyChange: 0,
        monthlyChange: 0,
        topSources: [],
        historicalMentions: [],
        relatedEntities: []
      })) || [],
      sentimentLeaders: backendData.topEntities?.filter((e: any) => e.sentiment > 0.2) || [],
      sentimentLaggers: backendData.topEntities?.filter((e: any) => e.sentiment < -0.2) || [],
      newEntities: [],
      insights: [],
      totalEntitiesTracked: backendData.topEntities?.length || 0,
      totalMentionsToday: backendData.topEntities?.reduce((sum: number, e: any) => sum + e.mentionCount, 0) || 0,
      averageSentimentToday: backendData.topEntities?.length > 0 
        ? backendData.topEntities.reduce((sum: number, e: any) => sum + e.sentiment, 0) / backendData.topEntities.length
        : 0
    };
  }

  // Get detailed analytics for a specific entity
  async getEntityAnalytics(entityName: string, entityType?: string): Promise<EntityAnalytics> {
    try {
      const params = new URLSearchParams();
      if (entityType) {
        params.append('type', entityType);
      }
      
      const response = await api.get(`${this.baseUrl}/entity/${encodeURIComponent(entityName)}?${params}`);
      return response.data.data;
    } catch (error) {
      // Fallback: create basic entity analytics from dashboard data
      const dashboardData = await this.getDashboardData();
      const entityFromDashboard = dashboardData.topTrending.find(e => e.entityName === entityName);
      
      if (entityFromDashboard) {
        return {
          ...entityFromDashboard,
          historicalMentions: [
            { date: new Date().toISOString(), sentiment: entityFromDashboard.overallSentiment, mentionCount: entityFromDashboard.totalMentions }
          ]
        };
      }
      
      // If entity not found, return default structure
      return {
        entityName,
        entityType: entityType || 'unknown',
        totalMentions: 0,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        overallSentiment: 0,
        sentimentTrend: 'stable' as const,
        trendingScore: 0,
        weeklyChange: 0,
        monthlyChange: 0,
        topSources: [],
        historicalMentions: [],
        relatedEntities: []
      };
    }
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
    
    const response = await api.get<EntityTrendsResponse>(`${this.baseUrl}/trending?${params}`);
    return response.data.data;
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
    
    const response = await api.post<EntityComparisonResponse>(`${this.baseUrl}/compare`, payload);
    return response.data.data;
  }

  // Get entity mentions with context
  async getEntityMentions(
    entityName: string,
    limit: number = 10000,
    offset: number = 0
  ): Promise<{ mentions: EntityMention[]; total: number }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    const response = await api.get(`${this.baseUrl}/entity/${encodeURIComponent(entityName)}/mentions?${params}`);
    
    // The backend returns { success: true, data: { mentions: [...], total: N } }
    if (response.data?.data) {
      // Map backend response to match EntityMention interface
      const mappedMentions = (response.data.data.mentions || []).map((mention: any) => ({
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
        total: response.data.data.total || 0
      };
    }
    
    return response.data || { mentions: [], total: 0 };
  }

  // Get entity insights (AI-generated observations)
  async getEntityInsights(entityName?: string): Promise<EntityInsight[]> {
    const url = entityName 
      ? `${this.baseUrl}/insights/${encodeURIComponent(entityName)}`
      : `${this.baseUrl}/insights`;
    
    const response = await api.get(url);
    return response.data || [];
  }

  // Search entities
  async searchEntities(query: string, limit: number = 10): Promise<Array<{
    entityName: string;
    entityType: string;
    mentionCount: number;
    recentSentiment: number;
  }>> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString()
      });
      
      const response = await api.get(`${this.baseUrl}/search?${params}`);
      return response.data || [];
    } catch (error) {
      // Fallback: search through dashboard data
      const dashboardData = await this.getDashboardData();
      return dashboardData.topTrending
        .filter(entity => entity.entityName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(entity => ({
          entityName: entity.entityName,
          entityType: entity.entityType,
          mentionCount: entity.totalMentions,
          recentSentiment: entity.overallSentiment
        }));
    }
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