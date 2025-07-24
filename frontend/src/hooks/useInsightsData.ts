import { useState, useEffect, useCallback } from 'react';
import { contentApi, ProcessedContent } from '@/lib/api';
import { subDays, format } from 'date-fns';

export interface EntityInsight {
  name: string;
  type: string;
  mentions: number;
  sentiment: number;
  trend: 'up' | 'down' | 'neutral';
  confidence: number;
  contexts: string[];
  lastMentioned: Date;
}

export interface TopicInsight {
  topic: string;
  frequency: number;
  sentiment: number;
  growth: number;
  sources: string[];
  relatedEntities: string[];
  trending: boolean;
}

export interface MarketInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  timeframe: string;
  supportingData: string[];
  sources: string[];
  createdAt: Date;
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface VolumeAnalysis {
  date: string;
  volume: number;
  sentiment: number;
  entities: number;
  topics: number;
}

export interface InsightsData {
  entities: EntityInsight[];
  topics: TopicInsight[];
  marketInsights: MarketInsight[];
  sentimentDistribution: SentimentDistribution;
  volumeAnalysis: VolumeAnalysis[];
  totalContent: number;
  activeSources: number;
  lastUpdated: Date;
}

export interface UseInsightsDataReturn {
  data: InsightsData | null;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  generateInsights: (timeframe: string) => Promise<void>;
}

const entityTypeWeights = {
  company: 1.2,
  person: 1.0,
  ticker: 1.5,
  currency: 1.3,
  location: 0.8,
  exchange: 1.1,
  crypto: 1.4,
  commodity: 1.0
};

const generateMarketInsights = (
  entities: EntityInsight[],
  topics: TopicInsight[],
  content: ProcessedContent[]
): MarketInsight[] => {
  const insights: MarketInsight[] = [];
  
  // Analyze entity sentiment patterns
  const highImpactEntities = entities
    .filter(e => e.mentions >= 3 && Math.abs(e.sentiment) > 0.3)
    .sort((a, b) => b.mentions * Math.abs(b.sentiment) - a.mentions * Math.abs(a.sentiment));
  
  if (highImpactEntities.length > 0) {
    const entity = highImpactEntities[0];
    insights.push({
      id: `entity-${entity.name.toLowerCase().replace(/\s+/g, '-')}`,
      type: entity.sentiment > 0 ? 'opportunity' : 'risk',
      title: `${entity.name} Sentiment ${entity.sentiment > 0 ? 'Surge' : 'Decline'}`,
      description: `${entity.name} showing ${entity.sentiment > 0 ? 'strong positive' : 'concerning negative'} sentiment across ${entity.mentions} mentions with ${(entity.confidence * 100).toFixed(0)}% confidence.`,
      confidence: entity.confidence,
      impact: entity.mentions > 10 ? 'high' : entity.mentions > 5 ? 'medium' : 'low',
      timeframe: 'Current period',
      supportingData: [
        `${entity.mentions} total mentions`,
        `${(entity.sentiment * 100).toFixed(1)}% sentiment score`,
        `${entity.trend === 'up' ? 'Increasing' : entity.trend === 'down' ? 'Decreasing' : 'Stable'} mention trend`
      ],
      sources: entity.contexts.slice(0, 3),
      createdAt: new Date()
    });
  }
  
  // Analyze topic trends
  const trendingTopics = topics
    .filter(t => Math.abs(t.growth) > 20 && t.frequency >= 2)
    .sort((a, b) => Math.abs(b.growth) - Math.abs(a.growth));
  
  if (trendingTopics.length > 0) {
    const topic = trendingTopics[0];
    insights.push({
      id: `topic-${topic.topic.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'trend',
      title: `${topic.topic} Discussion Surge`,
      description: `"${topic.topic}" mentions increased by ${topic.growth.toFixed(1)}% with ${topic.sentiment > 0 ? 'positive' : topic.sentiment < 0 ? 'negative' : 'neutral'} sentiment.`,
      confidence: Math.min(0.9, 0.5 + Math.abs(topic.growth) / 100),
      impact: Math.abs(topic.growth) > 50 ? 'high' : Math.abs(topic.growth) > 25 ? 'medium' : 'low',
      timeframe: 'Current period',
      supportingData: [
        `${topic.frequency} mentions`,
        `${topic.growth.toFixed(1)}% growth`,
        `${topic.sources.length} different sources`
      ],
      sources: topic.sources.slice(0, 3),
      createdAt: new Date()
    });
  }
  
  // Analyze sentiment anomalies
  const sentimentDistribution = content.reduce((acc, item) => {
    const score = item.sentiment_score || 0;
    if (score > 0.1) acc.positive++;
    else if (score < -0.1) acc.negative++;
    else acc.neutral++;
    return acc;
  }, { positive: 0, negative: 0, neutral: 0 });
  
  const total = sentimentDistribution.positive + sentimentDistribution.negative + sentimentDistribution.neutral;
  if (total > 0) {
    const positiveRatio = sentimentDistribution.positive / total;
    const negativeRatio = sentimentDistribution.negative / total;
    
    if (positiveRatio > 0.7 || negativeRatio > 0.7) {
      insights.push({
        id: 'sentiment-anomaly',
        type: 'anomaly',
        title: `Unusual Sentiment ${positiveRatio > 0.7 ? 'Optimism' : 'Pessimism'}`,
        description: `Market sentiment showing ${positiveRatio > 0.7 ? 'overwhelming optimism' : 'widespread pessimism'} at ${((positiveRatio > 0.7 ? positiveRatio : negativeRatio) * 100).toFixed(1)}% of content.`,
        confidence: 0.75,
        impact: 'medium',
        timeframe: 'Current period',
        supportingData: [
          `${(positiveRatio * 100).toFixed(1)}% positive sentiment`,
          `${(negativeRatio * 100).toFixed(1)}% negative sentiment`,
          `${total} total content items analyzed`
        ],
        sources: ['Sentiment Analysis Engine'],
        createdAt: new Date()
      });
    }
  }
  
  return insights.slice(0, 5); // Limit to top 5 insights
};

export const useInsightsData = (): UseInsightsDataReturn => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = useCallback(async (timeframe: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range
      const days = timeframe === '1d' ? 1 : 
                   timeframe === '3d' ? 3 : 
                   timeframe === '7d' ? 7 : 
                   timeframe === '30d' ? 30 : 7;
      
      const startDate = subDays(new Date(), days);
      
      // Fetch content data
      const content = await contentApi.list({ limit: 10000 });
      
      // Filter content by timeframe
      const filteredContent = content.filter(item => 
        new Date(item.created_at) >= startDate
      );
      
      if (filteredContent.length === 0) {
        setData({
          entities: [],
          topics: [],
          marketInsights: [],
          sentimentDistribution: { positive: 0, neutral: 0, negative: 0, total: 0 },
          volumeAnalysis: [],
          totalContent: 0,
          activeSources: 0,
          lastUpdated: new Date()
        });
        return;
      }
      
      // Process entities
      const entityMap = new Map<string, EntityInsight>();
      const topicMap = new Map<string, TopicInsight>();
      const sourceSet = new Set<string>();
      
      filteredContent.forEach(item => {
        if (item.source_name) sourceSet.add(item.source_name);
        
        // Process entities
        if (item.entities && Array.isArray(item.entities)) {
          item.entities.forEach(entity => {
            const key = `${entity.type}:${entity.name}`;
            const weight = entityTypeWeights[entity.type as keyof typeof entityTypeWeights] || 1;
            
            if (entityMap.has(key)) {
              const existing = entityMap.get(key)!;
              existing.mentions++;
              existing.sentiment = (existing.sentiment * (existing.mentions - 1) + (item.sentiment_score || 0)) / existing.mentions;
              existing.contexts.push(item.summary || item.title || '');
              existing.lastMentioned = new Date(item.created_at);
            } else {
              entityMap.set(key, {
                name: entity.name,
                type: entity.type,
                mentions: 1,
                sentiment: (item.sentiment_score || 0) * weight,
                trend: 'neutral', // Will calculate real trend after collecting all data
                confidence: 0.75, // Base confidence, will adjust based on mentions
                contexts: [item.summary || item.title || ''].filter(Boolean),
                lastMentioned: new Date(item.created_at)
              });
            }
          });
        }
        
        // Process topics
        if (item.key_topics && Array.isArray(item.key_topics)) {
          item.key_topics.forEach(topic => {
            if (topicMap.has(topic)) {
              const existing = topicMap.get(topic)!;
              existing.frequency++;
              existing.sentiment = (existing.sentiment * (existing.frequency - 1) + (item.sentiment_score || 0)) / existing.frequency;
              if (item.source_name) existing.sources.push(item.source_name);
              if (item.entities && Array.isArray(item.entities)) {
                existing.relatedEntities.push(...item.entities.map(e => e.name));
              }
            } else {
              topicMap.set(topic, {
                topic,
                frequency: 1,
                sentiment: item.sentiment_score || 0,
                growth: 0, // Will calculate real growth after collecting all data
                sources: item.source_name ? [item.source_name] : [],
                relatedEntities: item.entities && Array.isArray(item.entities) ? item.entities.map(e => e.name) : [],
                trending: false // Will determine based on actual growth
              });
            }
          });
        }
      });
      
      // Calculate historical data for trend analysis
      const midPoint = Math.floor(days / 2);
      const midDate = subDays(new Date(), midPoint);
      
      // Sort and limit entities with real trend calculation
      const sortedEntities = Array.from(entityMap.values())
        .map(entity => {
          // Calculate trend based on mentions in first vs second half of period
          const recentMentions = filteredContent.filter(item => 
            new Date(item.created_at) >= midDate &&
            item.entities?.some(e => e.name === entity.name)
          ).length;
          
          const olderMentions = filteredContent.filter(item => 
            new Date(item.created_at) < midDate &&
            item.entities?.some(e => e.name === entity.name)
          ).length;
          
          let trend: 'up' | 'down' | 'neutral' = 'neutral';
          if (olderMentions > 0) {
            const growthRate = (recentMentions - olderMentions) / olderMentions;
            if (growthRate > 0.2) trend = 'up';
            else if (growthRate < -0.2) trend = 'down';
          } else if (recentMentions > 0) {
            trend = 'up'; // New entity appearing
          }
          
          // Adjust confidence based on mentions
          const confidence = Math.min(0.95, 0.5 + (entity.mentions * 0.05));
          
          return { ...entity, trend, confidence };
        })
        .sort((a, b) => (b.mentions * Math.abs(b.sentiment) * b.confidence) - (a.mentions * Math.abs(a.sentiment) * a.confidence));
      
      // Sort and limit topics with real growth calculation
      const sortedTopics = Array.from(topicMap.values())
        .map(topic => {
          // Calculate growth based on frequency changes
          const recentFreq = filteredContent.filter(item => 
            new Date(item.created_at) >= midDate &&
            item.key_topics?.includes(topic.topic)
          ).length;
          
          const olderFreq = filteredContent.filter(item => 
            new Date(item.created_at) < midDate &&
            item.key_topics?.includes(topic.topic)
          ).length;
          
          let growth = 0;
          if (olderFreq > 0) {
            growth = ((recentFreq - olderFreq) / olderFreq) * 100;
          } else if (recentFreq > 0) {
            growth = 100; // New topic
          }
          
          const trending = Math.abs(growth) > 30 && topic.frequency >= 3;
          
          return {
            ...topic,
            growth,
            trending,
            sources: [...new Set(topic.sources)],
            relatedEntities: [...new Set(topic.relatedEntities)]
          };
        })
        .sort((a, b) => b.frequency - a.frequency);      
      // Generate market insights
      const marketInsights = generateMarketInsights(sortedEntities, sortedTopics, filteredContent);
      
      // Calculate sentiment distribution
      const sentimentDistribution = filteredContent.reduce((acc, item) => {
        const score = item.sentiment_score || 0;
        acc.total++;
        if (score > 0.1) acc.positive++;
        else if (score < -0.1) acc.negative++;
        else acc.neutral++;
        return acc;
      }, { positive: 0, neutral: 0, negative: 0, total: 0 });
      
      // Generate volume analysis
      const volumeAnalysis: VolumeAnalysis[] = Array.from({ length: days }, (_, i) => {
        const date = subDays(new Date(), days - i - 1);
        const dayContent = filteredContent.filter(item => 
          format(new Date(item.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );
        
        const dayEntities = new Set<string>();
        const dayTopics = new Set<string>();
        
        dayContent.forEach(item => {
          // Handle entities - could be array or object
          if (item.entities) {
            if (Array.isArray(item.entities)) {
              // If entities is an array
              item.entities.forEach(e => dayEntities.add(e.name || e));
            } else if (typeof item.entities === 'object') {
              // If entities is an object, extract values
              Object.values(item.entities).forEach(entityArray => {
                if (Array.isArray(entityArray)) {
                  entityArray.forEach(entity => {
                    dayEntities.add(typeof entity === 'string' ? entity : entity.name || entity);
                  });
                }
              });
            }
          }
          
          // Handle topics
          item.key_topics?.forEach(t => dayTopics.add(t));
        });
        
        return {
          date: format(date, 'MMM dd'),
          volume: dayContent.length,
          sentiment: dayContent.length > 0 
            ? dayContent.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / dayContent.length
            : 0,
          entities: dayEntities.size,
          topics: dayTopics.size
        };
      });
      
      setData({
        entities: sortedEntities,
        topics: sortedTopics,
        marketInsights,
        sentimentDistribution,
        volumeAnalysis,
        totalContent: filteredContent.length,
        activeSources: sourceSet.size,
        lastUpdated: new Date()
      });
      
    } catch (err) {
      console.error('Failed to generate insights:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await generateInsights('7d'); // Default to 7 days
  }, [generateInsights]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    data,
    loading,
    error,
    refreshData,
    generateInsights
  };
};