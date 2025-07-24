// Entity Analytics Types for sentiment and trending analysis
export interface EntityMention {
  id: string;
  entityName: string;
  entityType: 'company' | 'person' | 'location' | 'ticker' | 'topic' | 'organization';
  mentionDate: Date;
  sourceId: string;
  sourceName: string;
  sourceType: 'rss' | 'podcast' | 'youtube' | 'api';
  sentimentScore: number; // -1 to 1
  confidence: number; // 0 to 1
  contextSnippet: string;
  contentId: string;
  contentTitle: string;
}

export interface EntityTrend {
  entityName: string;
  entityType: string;
  date: string;
  mentionCount: number;
  averageSentiment: number;
  sentimentStdDev: number;
  trendScore: number; // Calculated trending metric
  sources: string[];
  topContexts: string[];
}

export interface EntityAnalytics {
  entityName: string;
  entityType: string;
  totalMentions: number;
  firstMentioned: Date;
  lastMentioned: Date;
  overallSentiment: number;
  sentimentTrend: 'improving' | 'declining' | 'stable' | 'volatile';
  trendingScore: number; // 0-100, how "hot" this entity is
  weeklyChange: number;
  monthlyChange: number;
  topSources: Array<{
    sourceName: string;
    mentionCount: number;
    averageSentiment: number;
  }>;
  historicalMentions: Array<{
    date: string;
    sentiment: number;
    mentionCount: number;
  }>;
  relatedEntities: Array<{
    entityName: string;
    entityType: string;
    correlationScore: number;
  }>;
}

export interface EntityComparison {
  entities: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: Array<{
    date: string;
    entityData: Record<string, {
      mentions: number;
      sentiment: number;
      trendScore: number;
    }>;
  }>;
}

export interface EntityFilter {
  entityTypes?: string[];
  sentimentRange?: {
    min: number;
    max: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  sources?: string[];
  minMentions?: number;
  trendingOnly?: boolean;
  sortBy?: 'mentions' | 'sentiment' | 'trending' | 'recent';
  sortOrder?: 'asc' | 'desc';
}

export interface EntityInsight {
  entityName: string;
  insight: string;
  type: 'sentiment_shift' | 'trending_up' | 'trending_down' | 'correlation' | 'anomaly';
  confidence: number;
  timeframe: string;
  supportingData: any;
}

export interface EntityDashboardData {
  topTrending: EntityAnalytics[];
  sentimentLeaders: EntityAnalytics[];
  sentimentLaggers: EntityAnalytics[];
  newEntities: EntityAnalytics[];
  insights: EntityInsight[];
  totalEntitiesTracked: number;
  totalMentionsToday: number;
  averageSentimentToday: number;
}

// Chart data types
export interface TrendChartData {
  date: string;
  mentions: number;
  sentiment: number;
  trendScore: number;
}

export interface SentimentChartData {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export interface EntityComparisonChartData {
  date: string;
  [entityName: string]: number | string;
}

// API Response types
export interface EntityAnalyticsResponse {
  success: boolean;
  data: EntityAnalytics;
}

export interface EntityTrendsResponse {
  success: boolean;
  data: EntityTrend[];
  meta: {
    total: number;
    timeRange: {
      start: string;
      end: string;
    };
  };
}

export interface EntityComparisonResponse {
  success: boolean;
  data: EntityComparison;
}

export interface EntityDashboardResponse {
  success: boolean;
  data: EntityDashboardData;
}