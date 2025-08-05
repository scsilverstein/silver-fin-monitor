import { Request, Response } from 'express';
import { supabase } from '../services/database/client';
import { createContextLogger } from '../utils/logger';
import { asyncHandler as withErrorHandling } from '../middleware/error';

const logger = createContextLogger('InsightsController');

interface TimeframeFilter {
  days: number;
  label: string;
}

const TIMEFRAMES: Record<string, TimeframeFilter> = {
  '7d': { days: 7, label: '7 Days' },
  '30d': { days: 30, label: '30 Days' },
  '90d': { days: 90, label: '90 Days' },
  '1y': { days: 365, label: '1 Year' }
};

export class InsightsController {
  /**
   * Get comprehensive insights dashboard data
   */
  static getInsightsDashboard = withErrorHandling(async (req: Request, res: Response) => {
    const { timeframe = '30d' } = req.query;
    const timeframeConfig = TIMEFRAMES[timeframe as string] || TIMEFRAMES['30d'];
    const { days } = timeframeConfig;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Parallel data fetching for performance
    const [
      predictions,
      accuracyData,
      sentimentTrends,
      topicTrends,
      entityAnalytics,
      feedSourceStats
    ] = await Promise.all([
      InsightsController.getPredictionsData(cutoffDate),
      InsightsController.getAccuracyData(cutoffDate),
      InsightsController.getSentimentTrends(cutoffDate),
      InsightsController.getTopicTrends(cutoffDate),
      InsightsController.getEntityAnalytics(cutoffDate),
      InsightsController.getFeedSourceStats(cutoffDate)
    ]);

    const insights = {
      predictions,
      accuracyByType: accuracyData.byType,
      accuracyByHorizon: accuracyData.byHorizon,
      sentimentTrends,
      topicTrends,
      entityData: entityAnalytics,
      feedSourceStats,
      summary: {
        totalPredictions: predictions.length,
        overallAccuracy: accuracyData.overall,
        topPerformer: accuracyData.topPerformer,
        totalEntities: entityAnalytics.length,
        contentVolume: sentimentTrends.reduce((sum, day) => sum + (day.volume || 0), 0),
        timeframe: timeframe as string
      }
    };

    res.json({ success: true, data: insights });
  });

  /**
   * Get predictions data with basic metrics
   */
  private static async getPredictionsData(cutoffDate: Date) {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select(`
        id,
        prediction_type,
        prediction_text,
        confidence_level,
        time_horizon,
        created_at,
        daily_analysis_id,
        prediction_data
      `)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching predictions:', error);
      return [];
    }

    return predictions || [];
  }

  /**
   * Get prediction accuracy data from prediction_comparisons table
   */
  private static async getAccuracyData(cutoffDate: Date) {
    try {
      // Use prediction_comparisons table which exists in the schema
      const { data: accuracyRecords, error } = await supabase
        .from('prediction_comparisons')
        .select(`
          accuracy_score,
          prediction_id,
          comparison_date,
          predictions!inner(
            prediction_type,
            time_horizon,
            confidence_level
          )
        `)
        .gte('comparison_date', cutoffDate.toISOString());

      if (error) {
        logger.warn('Error fetching prediction comparisons:', error.message);
        // Return empty data structure instead of mock data
        return {
          byType: [],
          byHorizon: [],
          overall: 0,
          topPerformer: null
        };
      }

      if (!accuracyRecords || accuracyRecords.length === 0) {
        // Return empty data structure instead of mock data
        return {
          byType: [],
          byHorizon: [],
          overall: 0,
          topPerformer: null
        };
      }

      // Group by prediction type
      const byType = accuracyRecords.reduce((acc: any[], comp: any) => {
        const type = comp.predictions.prediction_type;
        const existing = acc.find(item => item.category === type);
        
        if (existing) {
          existing.total++;
          existing.correct += comp.accuracy_score >= 0.5 ? 1 : 0;
          existing.accuracy = existing.correct / existing.total;
        } else {
          acc.push({
            category: type,
            accuracy: comp.accuracy_score >= 0.5 ? 1 : 0,
            total: 1,
            correct: comp.accuracy_score >= 0.5 ? 1 : 0
          });
        }
        
        return acc;
      }, []);

      // Group by time horizon
      const byHorizon = accuracyRecords.reduce((acc: any[], comp: any) => {
        const horizon = comp.predictions.time_horizon;
        const existing = acc.find(item => item.category === horizon);
        
        if (existing) {
          existing.total++;
          existing.correct += comp.accuracy_score >= 0.5 ? 1 : 0;
          existing.accuracy = existing.correct / existing.total;
        } else {
          acc.push({
            category: horizon,
            accuracy: comp.accuracy_score >= 0.5 ? 1 : 0,
            total: 1,
            correct: comp.accuracy_score >= 0.5 ? 1 : 0
          });
        }
        
        return acc;
      }, []);

      const overall = accuracyRecords.reduce((sum, comp) => sum + comp.accuracy_score, 0) / accuracyRecords.length;
      const topPerformer = byType.reduce((max, item) => 
        item.accuracy > (max?.accuracy || 0) ? item : max, null);

      return { byType, byHorizon, overall, topPerformer };
    } catch (error) {
      logger.error('Failed to fetch accuracy data:', error);
      // Return empty data structure instead of mock data
      return {
        byType: [],
        byHorizon: [],
        overall: 0,
        topPerformer: null
      };
    }
  }



  /**
   * Get daily sentiment trends from processed content
   */
  private static async getSentimentTrends(cutoffDate: Date) {
    const { data: sentimentData, error } = await supabase
      .from('processed_content')
      .select('sentiment_score, created_at')
      .gte('created_at', cutoffDate.toISOString())
      .not('sentiment_score', 'is', null);

    if (error) {
      logger.error('Error fetching sentiment trends:', error);
      return [];
    }

    if (!sentimentData || sentimentData.length === 0) {
      return [];
    }

    // Group by date and calculate daily averages
    const dailyData = sentimentData.reduce((acc: Record<string, { sentimentScores: number[]; count: number }>, item: any) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = { 
          sentimentScores: [], 
          count: 0 
        };
      }
      
      acc[date].sentimentScores.push(item.sentiment_score);
      acc[date].count++;
      
      return acc;
    }, {});

    // Convert to array format expected by frontend
    return Object.entries(dailyData).map(([date, data]: [string, any]) => {
      const avgSentiment = data.sentimentScores.reduce((sum: number, score: number) => sum + score, 0) / data.sentimentScores.length;
      
      return {
        date: `${date}T12:00:00.000Z`,
        sentiment: avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral',
        confidence: Math.abs(avgSentiment),
        volume: data.count,
        sentimentScore: avgSentiment
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Get topic trends from key_topics (or generate mock data)
   */
  private static async getTopicTrends(cutoffDate: Date) {
    try {
      const { data: contentData, error } = await supabase
        .from('processed_content')
        .select('key_topics, sentiment_score, created_at')
        .gte('created_at', cutoffDate.toISOString())
        .not('key_topics', 'is', null);

      if (error) {
        logger.error('Error fetching topic trends:', error);
        return [];
      }

      if (!contentData || contentData.length === 0) {
        logger.info('No processed content available yet');
        return [];
      }

      // Flatten and count topics
      const topicCounts: Record<string, { 
        count: number; 
        sentimentSum: number; 
        dates: string[] 
      }> = {};

      contentData.forEach((item: any) => {
        if (item.key_topics && Array.isArray(item.key_topics)) {
          item.key_topics.forEach((topic: string) => {
            if (!topicCounts[topic]) {
              topicCounts[topic] = { count: 0, sentimentSum: 0, dates: [] };
            }
            
            topicCounts[topic].count++;
            topicCounts[topic].sentimentSum += item.sentiment_score || 0;
            topicCounts[topic].dates.push(item.created_at);
          });
        }
      });

      // Convert to array and sort by count
      const topicTrends = Object.entries(topicCounts)
        .map(([topic, data]) => ({
          topic,
          totalMentions: data.count,
          averageSentiment: data.sentimentSum / data.count,
          data: data.dates.map((date, index) => ({
            date,
            count: 1, // Individual mention
            growth: index > 0 ? 0.1 : 0 // Simple growth calculation
          })),
          // Calculate average growth based on date distribution
          averageGrowth: data.count > 5 ? this.calculateGrowthRate(data.dates) : 0
        }))
        .sort((a, b) => b.totalMentions - a.totalMentions)
        .slice(0, 10); // Top 10 topics

      return topicTrends;
    } catch (error) {
      logger.error('Failed to fetch topic trends:', error);
      return [];
    }
  }

  /**
   * Calculate growth rate based on date distribution
   */
  private static calculateGrowthRate(dates: string[]): number {
    if (dates.length < 2) return 0;
    
    // Sort dates
    const sortedDates = dates.map(d => new Date(d).getTime()).sort((a, b) => a - b);
    
    // Calculate time span in days
    const timeSpan = (sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24);
    if (timeSpan === 0) return 0;
    
    // Count mentions in first half vs second half
    const midPoint = sortedDates[0] + (sortedDates[sortedDates.length - 1] - sortedDates[0]) / 2;
    const firstHalfCount = sortedDates.filter(d => d <= midPoint).length;
    const secondHalfCount = sortedDates.filter(d => d > midPoint).length;
    
    // Calculate growth rate
    if (firstHalfCount === 0) return 1; // All mentions in second half
    const growthRate = (secondHalfCount - firstHalfCount) / firstHalfCount;
    
    // Cap between -0.1 and 0.3 to match original range
    return Math.max(-0.1, Math.min(0.3, growthRate));
  }

  /**
   * Get entity analytics from processed content entities
   */
  private static async getEntityAnalytics(cutoffDate: Date) {
    const { data: contentData, error } = await supabase
      .from('processed_content')
      .select('entities, sentiment_score, created_at')
      .gte('created_at', cutoffDate.toISOString())
      .not('entities', 'is', null);

    if (error) {
      logger.error('Error fetching entity analytics:', error);
      return [];
    }

    if (!contentData || contentData.length === 0) {
      return [];
    }

    // Aggregate entity data
    const entityStats: Record<string, {
      count: number;
      sentimentSum: number;
      type: string;
      sources: string[];
      dates: string[];
    }> = {};

    contentData.forEach((item: any) => {
      if (item.entities && typeof item.entities === 'object') {
        // Process companies
        if (item.entities.companies && Array.isArray(item.entities.companies)) {
          item.entities.companies.forEach((company: string) => {
            if (!entityStats[company]) {
              entityStats[company] = { count: 0, sentimentSum: 0, type: 'company', sources: [], dates: [] };
            }
            entityStats[company].count++;
            entityStats[company].sentimentSum += item.sentiment_score || 0;
            entityStats[company].dates.push(item.created_at);
          });
        }

        // Process people
        if (item.entities.people && Array.isArray(item.entities.people)) {
          item.entities.people.forEach((person: string) => {
            if (!entityStats[person]) {
              entityStats[person] = { count: 0, sentimentSum: 0, type: 'person', sources: [], dates: [] };
            }
            entityStats[person].count++;
            entityStats[person].sentimentSum += item.sentiment_score || 0;
            entityStats[person].dates.push(item.created_at);
          });
        }

        // Process locations
        if (item.entities.locations && Array.isArray(item.entities.locations)) {
          item.entities.locations.forEach((location: string) => {
            if (!entityStats[location]) {
              entityStats[location] = { count: 0, sentimentSum: 0, type: 'location', sources: [], dates: [] };
            }
            entityStats[location].count++;
            entityStats[location].sentimentSum += item.sentiment_score || 0;
            entityStats[location].dates.push(item.created_at);
          });
        }
      }
    });

    // Convert to array format
    const entityAnalytics = Object.entries(entityStats)
      .map(([entityName, data]) => ({
        entityName,
        entityType: data.type,
        mentionCount: data.count,
        sentiment: data.sentimentSum / data.count,
        trendingScore: Math.min(data.count / 10, 1), // Simple trending score
        sources: data.sources,
        dates: data.dates
      }))
      .filter(entity => entity.mentionCount > 2) // Filter out low-mention entities
      .sort((a, b) => b.mentionCount - a.mentionCount)
      // .slice(0, 20); // Top 20 entities

    return entityAnalytics;
  }

  /**
   * Get feed source statistics
   */
  private static async getFeedSourceStats(cutoffDate: Date) {
    const { data: feedStats, error } = await supabase
      .from('raw_feeds')
      .select(`
        source_id,
        processing_status,
        created_at,
        feed_sources!inner(name, type)
      `)
      .gte('created_at', cutoffDate.toISOString());

    if (error) {
      logger.error('Error fetching feed source stats:', error);
      return [];
    }

    if (!feedStats || feedStats.length === 0) {
      return [];
    }

    // Aggregate by source
    const sourceStats = feedStats.reduce((acc: any, item: any) => {
      const sourceId = item.source_id;
      const sourceName = item.feed_sources.name;
      const sourceType = item.feed_sources.type;
      
      if (!acc[sourceId]) {
        acc[sourceId] = {
          id: sourceId,
          name: sourceName,
          type: sourceType,
          total: 0,
          completed: 0,
          failed: 0,
          pending: 0
        };
      }
      
      acc[sourceId].total++;
      acc[sourceId][item.processing_status]++;
      
      return acc;
    }, {});

    return Object.values(sourceStats);
  }

  /**
   * Get prediction accuracy summary
   */
  static getPredictionAccuracy = withErrorHandling(async (req: Request, res: Response) => {
    const { timeframe = '30d' } = req.query;
    const timeframeConfig = TIMEFRAMES[timeframe as string] || TIMEFRAMES['30d'];
    const { days } = timeframeConfig;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const accuracyData = await InsightsController.getAccuracyData(cutoffDate);
    
    res.json({ success: true, data: accuracyData });
  });

  /**
   * Get content analytics summary
   */
  static getContentAnalytics = withErrorHandling(async (req: Request, res: Response) => {
    const { timeframe = '30d' } = req.query;
    const timeframeConfig = TIMEFRAMES[timeframe as string] || TIMEFRAMES['30d'];
    const { days } = timeframeConfig;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const [sentimentTrends, topicTrends, entityAnalytics] = await Promise.all([
      InsightsController.getSentimentTrends(cutoffDate),
      InsightsController.getTopicTrends(cutoffDate),
      InsightsController.getEntityAnalytics(cutoffDate)
    ]);

    res.json({ 
      success: true, 
      data: {
        sentimentTrends,
        topicTrends,
        entityAnalytics,
        summary: {
          totalContent: sentimentTrends.reduce((sum, day) => sum + (day.volume || 0), 0),
          averageSentiment: sentimentTrends.reduce((sum, day) => sum + day.confidence, 0) / sentimentTrends.length,
          topTopics: topicTrends.slice(0, 5),
          topEntities: entityAnalytics.slice(0, 5),
          timeframe: timeframe as string
        }
      }
    });
  });
}