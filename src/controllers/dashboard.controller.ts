import { Request, Response } from 'express';
import { supabase } from '@/services/database/client';
import { cacheService } from '@/services/database/cache';
import { logger } from '@/utils/logger';

export class DashboardController {
  async getTimeframeThemes(req: Request, res: Response): Promise<void> {
    try {
      const { timeframe = 'week' } = req.query;
      const cacheKey = `dashboard:themes:${timeframe}`;
      const cached = await cacheService.get<any>(cacheKey);
      
      if (cached && typeof cached === 'object' && 'data' in cached) {
        res.json(cached);
        return;
      }

      // Calculate date range based on timeframe
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // Get all daily analyses for the timeframe
      const { data: analyses } = await supabase
        .from('daily_analysis')
        .select('key_themes, analysis_date, ai_analysis')
        .gte('analysis_date', startDate.toISOString().split('T')[0])
        .lte('analysis_date', endDate.toISOString().split('T')[0])
        .order('analysis_date', { ascending: false });

      // Aggregate themes across the timeframe
      const themeCount = new Map<string, number>();
      const marketDrivers = new Map<string, number>();
      const riskFactors = new Map<string, number>();
      
      analyses?.forEach(analysis => {
        // Count key themes
        analysis.key_themes?.forEach((theme: string) => {
          themeCount.set(theme, (themeCount.get(theme) || 0) + 1);
        });
        
        // Count market drivers
        analysis.ai_analysis?.market_drivers?.forEach((driver: string) => {
          marketDrivers.set(driver, (marketDrivers.get(driver) || 0) + 1);
        });
        
        // Count risk factors
        analysis.ai_analysis?.risk_factors?.forEach((risk: string) => {
          riskFactors.set(risk, (riskFactors.get(risk) || 0) + 1);
        });
      });

      // Sort and get top themes
      const topThemes = Array.from(themeCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([theme]) => theme);
        
      const topMarketDrivers = Array.from(marketDrivers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([driver]) => driver);
        
      const topRiskFactors = Array.from(riskFactors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([risk]) => risk);

      const result = {
        success: true,
        data: {
          timeframe,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          themes: topThemes,
          marketDrivers: topMarketDrivers,
          riskFactors: topRiskFactors,
          analysisCount: analyses?.length || 0
        }
      };

      await cacheService.set(cacheKey, result, 3600); // Cache for 1 hour
      res.json(result);
    } catch (error) {
      logger.error('Get timeframe themes error', { error });
      res.status(500).json({ error: 'Failed to fetch timeframe themes' });
    }
  }

  async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'dashboard:overview';
      const cached = await cacheService.get<any>(cacheKey);
      if (cached && typeof cached === 'object' && 'success' in cached && 'data' in cached) {
        res.json(cached);
        return;
      }

      // Get latest daily analysis
      const { data: latestAnalysis } = await supabase
        .from('daily_analysis')
        .select('*')
        .order('analysis_date', { ascending: false })
        .limit(1)
        .single();

      // Get feed statistics
      const { data: feedStats } = await supabase
        .from('feed_sources')
        .select('type, is_active')
        .eq('is_active', true);

      const feedCounts = feedStats?.reduce((acc, feed) => {
        acc[feed.type] = (acc[feed.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get processing statistics for content published in last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Get content that was processed in the last 24 hours
      // Since we can't filter by published_at from raw_feeds, we'll use created_at
      const { data: recentContent } = await supabase
        .from('processed_content')
        .select('sentiment_score, created_at')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false });

      // Calculate average sentiment
      const avgSentiment = recentContent?.length 
        ? recentContent.reduce((sum, item) => sum + item.sentiment_score, 0) / recentContent.length
        : 0;

      // Get active predictions
      const { data: activePredictions } = await supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      const overview = {
        marketSentiment: latestAnalysis?.market_sentiment || 'neutral',
        sentimentScore: avgSentiment,
        lastAnalysisDate: latestAnalysis?.analysis_date || null,
        confidenceScore: latestAnalysis?.confidence_score || 0,
        activeFeedSources: feedStats?.length || 0,
        feedTypes: feedCounts,
        recentContentCount: recentContent?.length || 0,
        keyThemes: latestAnalysis?.key_themes || [],
        marketDrivers: latestAnalysis?.ai_analysis?.market_drivers || [],
        riskFactors: latestAnalysis?.ai_analysis?.risk_factors || [],
        activePredictions: activePredictions || [],
        // Add source tracking information
        contributingSources: {
          sourceIds: latestAnalysis?.ai_analysis?.source_ids || [],
          sources: latestAnalysis?.ai_analysis?.sources || [],
          sourceBreakdown: latestAnalysis?.ai_analysis?.source_breakdown || []
        }
      };

      const response = {
        success: true,
        data: overview
      };
      
      await cacheService.set(cacheKey, response, 300); // 5 minutes
      res.json(response);
    } catch (error) {
      logger.error('Dashboard overview error', { error });
      res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
  }

  async getTrends(req: Request, res: Response): Promise<void> {
    try {
      const { days = 7 } = req.query;
      const cacheKey = `dashboard:trends:${days}`;
      const cached = await cacheService.get<any>(cacheKey);
      if (cached && typeof cached === 'object' && 'success' in cached && 'data' in cached) {
        res.json(cached);
        return;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));

      // Get daily sentiment trends
      const { data: dailyAnalyses } = await supabase
        .from('daily_analysis')
        .select('analysis_date, market_sentiment, confidence_score')
        .gte('analysis_date', startDate.toISOString().split('T')[0])
        .order('analysis_date', { ascending: true });

      // Get sentiment scores by day
      const { data: contentByDay } = await supabase
        .from('processed_content')
        .select('sentiment_score, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Group by day
      const sentimentByDay = new Map<string, { total: number; count: number }>();
      contentByDay?.forEach(item => {
        const day = item.created_at.split('T')[0];
        if (!sentimentByDay.has(day)) {
          sentimentByDay.set(day, { total: 0, count: 0 });
        }
        const dayData = sentimentByDay.get(day)!;
        dayData.total += item.sentiment_score;
        dayData.count += 1;
      });

      const sentimentTrend = Array.from(sentimentByDay.entries()).map(([date, data]) => {
        const avgSentiment = data.total / data.count;
        return {
          date,
          sentiment: avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral', // Keep for backward compatibility
          sentimentScore: avgSentiment, // Actual continuous value
          confidence: Math.abs(avgSentiment), // Use absolute value as proxy for confidence
          volume: data.count
        };
      });

      // Get topic trends with normalization
      const { data: topicData } = await supabase
        .from('processed_content')
        .select('key_topics, created_at')
        .gte('created_at', startDate.toISOString());

      const topicCounts = new Map<string, Map<string, number>>();
      const dailyContentCounts = new Map<string, number>();
      
      topicData?.forEach(item => {
        const day = item.created_at.split('T')[0];
        
        // Track total content items per day
        dailyContentCounts.set(day, (dailyContentCounts.get(day) || 0) + 1);
        
        if (!topicCounts.has(day)) {
          topicCounts.set(day, new Map());
        }
        const dayTopics = topicCounts.get(day)!;
        item.key_topics.forEach((topic: string) => {
          dayTopics.set(topic, (dayTopics.get(topic) || 0) + 1);
        });
      });

      const trends = {
        sentimentTrend,
        dailyAnalyses: dailyAnalyses || [],
        topicTrends: Array.from(topicCounts.entries()).map(([date, topics]) => {
          const totalContentItems = dailyContentCounts.get(date) || 1;
          return {
            date,
            totalContentItems, // Include for reference
            topics: Array.from(topics.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([topic, rawCount]) => ({ 
                topic, 
                count: parseFloat((rawCount / totalContentItems * 100).toFixed(1)), // Normalized to percentage
                rawCount,
                normalizedMentions: parseFloat((rawCount / totalContentItems).toFixed(3))
              }))
          };
        })
      };

      const response = {
        success: true,
        data: trends
      };
      
      await cacheService.set(cacheKey, response, 600); // 10 minutes
      res.json(response);
    } catch (error) {
      logger.error('Dashboard trends error', { error });
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
  }

  async getPredictions(req: Request, res: Response): Promise<void> {
    try {
      const { timeHorizon, type } = req.query;
      
      let query = supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (timeHorizon) {
        query = query.eq('time_horizon', timeHorizon);
      }
      if (type) {
        query = query.eq('prediction_type', type);
      }

      const { data: predictions, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: {
          predictions: predictions || [],
          filters: {
            timeHorizons: ['1_week', '1_month', '3_months', '6_months', '1_year'],
            types: ['market_direction', 'economic_indicator', 'geopolitical_event']
          }
        }
      });
    } catch (error) {
      logger.error('Dashboard predictions error', { error });
      res.status(500).json({ error: 'Failed to fetch predictions' });
    }
  }

  async getAccuracy(req: Request, res: Response): Promise<void> {
    try {
      const cacheKey = 'dashboard:accuracy';
      const cached = await cacheService.get<any>(cacheKey);
      if (cached && typeof cached === 'object' && 'success' in cached && 'data' in cached) {
        res.json(cached);
        return;
      }

      // Get prediction comparisons
      // For now, we'll get comparisons without the join
      const { data: comparisons } = await supabase
        .from('prediction_comparisons')
        .select('*')
        .order('comparison_date', { ascending: false })
        .limit(10000);

      // Calculate accuracy metrics
      const accuracyByType = new Map<string, { correct: number; total: number }>();
      const accuracyByHorizon = new Map<string, { correct: number; total: number }>();
      
      // Since we don't have prediction data, we'll return empty metrics for now
      // This would need a separate query to get prediction details

      const accuracy = {
        overall: comparisons?.length 
          ? comparisons.reduce((sum, comp) => sum + comp.accuracy_score, 0) / comparisons.length
          : 0,
        byType: Array.from(accuracyByType.entries()).map(([type, stats]) => ({
          type,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
          total: stats.total
        })),
        byHorizon: Array.from(accuracyByHorizon.entries()).map(([horizon, stats]) => ({
          horizon,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
          total: stats.total
        })),
        recentComparisons: comparisons?.slice(0, 10) || []
      };

      const response = {
        success: true,
        data: accuracy
      };
      
      await cacheService.set(cacheKey, response, 3600); // 1 hour
      res.json(response);
    } catch (error) {
      logger.error('Dashboard accuracy error', { error });
      res.status(500).json({ error: 'Failed to fetch accuracy data' });
    }
  }

  async getRealtimeStats(req: Request, res: Response): Promise<void> {
    try {
      const lastHour = new Date();
      lastHour.setHours(lastHour.getHours() - 1);

      // Get queue statistics with job types
      const { data: queueStats } = await supabase
        .from('job_queue')
        .select('status, job_type')
        .gte('created_at', lastHour.toISOString());

      const queueCounts = queueStats?.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get transcription job statistics specifically
      const transcriptionJobs = queueStats?.filter(job => job.job_type === 'transcribe_audio') || [];
      const transcriptionCounts = transcriptionJobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get recent processing
      const { data: recentProcessing } = await supabase
        .from('raw_feeds')
        .select('processing_status, metadata')
        .gte('created_at', lastHour.toISOString());

      const processingCounts = recentProcessing?.reduce((acc, feed) => {
        acc[feed.processing_status] = (acc[feed.processing_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Count feeds needing transcription
      const feedsNeedingTranscription = recentProcessing?.filter(feed => 
        feed.metadata?.needsTranscription === true
      ).length || 0;

      const stats = {
        queue: {
          pending: queueCounts.pending || 0,
          processing: queueCounts.processing || 0,
          completed: queueCounts.completed || 0,
          failed: queueCounts.failed || 0
        },
        transcription: {
          pending: transcriptionCounts.pending || 0,
          processing: transcriptionCounts.processing || 0,
          completed: transcriptionCounts.completed || 0,
          failed: transcriptionCounts.failed || 0,
          feedsAwaitingTranscription: feedsNeedingTranscription
        },
        // Total processing across all categories (for feeds page display)
        processing: (queueCounts.processing || 0) + (transcriptionCounts.processing || 0) + (processingCounts.processing || 0),
        totalItems: (processingCounts.pending || 0) + (processingCounts.processing || 0) + (processingCounts.completed || 0) + (processingCounts.failed || 0),
        // Keep detailed processing stats for other uses
        processingDetails: {
          pending: processingCounts.pending || 0,
          processing: processingCounts.processing || 0,
          completed: processingCounts.completed || 0,
          failed: processingCounts.failed || 0
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Realtime stats error', { error });
      res.status(500).json({ error: 'Failed to fetch realtime stats' });
    }
  }

  async getTranscriptionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10000 } = req.query;
      
      // Get recent transcription jobs with details
      const { data: transcriptionJobs } = await supabase
        .from('job_queue')
        .select('id, status, payload, attempts, error_message, created_at, started_at, completed_at')
        .eq('job_type', 'transcribe_audio')
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      // Get feeds that need transcription
      const { data: feedsNeedingTranscription } = await supabase
        .from('raw_feeds')
        .select(`
          id, 
          title, 
          metadata, 
          processing_status,
          created_at,
          feed_sources!inner(name, type)
        `)
        .eq('metadata->>needsTranscription', 'true')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recently completed transcriptions
      const { data: recentTranscriptions } = await supabase
        .from('raw_feeds')
        .select(`
          id,
          title,
          content,
          metadata,
          processing_status,
          created_at,
          updated_at,
          feed_sources!inner(name, type)
        `)
        .not('content', 'eq', 'Transcript pending')
        .not('content', 'eq', 'Awaiting transcription')
        .eq('metadata->>needsTranscription', 'true')
        .order('updated_at', { ascending: false })
        .limit(10);

      // Calculate summary statistics
      const totalJobs = transcriptionJobs?.length || 0;
      const jobsByStatus = transcriptionJobs?.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const avgProcessingTime = transcriptionJobs && transcriptionJobs.length > 0
        ? transcriptionJobs
            .filter(job => job.started_at && job.completed_at)
            .map(job => new Date(job.completed_at!).getTime() - new Date(job.started_at!).getTime())
            .reduce((sum, time, _, arr) => sum + time / arr.length, 0)
        : 0;

      const data = {
        summary: {
          totalJobs,
          pending: jobsByStatus.pending || 0,
          processing: jobsByStatus.processing || 0,
          completed: jobsByStatus.completed || 0,
          failed: jobsByStatus.failed || 0,
          averageProcessingTimeMs: avgProcessingTime,
          feedsAwaitingTranscription: feedsNeedingTranscription?.length || 0
        },
        recentJobs: transcriptionJobs || [],
        feedsNeedingTranscription: feedsNeedingTranscription || [],
        recentlyTranscribed: recentTranscriptions || [],
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Transcription status error', { error });
      res.status(500).json({ error: 'Failed to fetch transcription status' });
    }
  }

  async getAnalysisWithSources(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.query;
      
      // Get the analysis for the specified date or latest
      let query = supabase
        .from('daily_analysis')
        .select('*')
        .order('analysis_date', { ascending: false });
      
      if (date) {
        query = query.eq('analysis_date', date);
      } else {
        query = query.limit(1);
      }

      const { data: analysis, error } = await query.single();
      
      if (error || !analysis) {
        res.status(404).json({ error: 'Analysis not found' });
        return;
      }

      // Get source details if we have source IDs
      const sourceIds = analysis.ai_analysis?.source_ids || [];
      let sourceDetails: any[] = [];
      
      if (sourceIds.length > 0) {
        const { data: sources } = await supabase
          .from('feed_sources')
          .select('id, name, type, url')
          .in('id', sourceIds);
        
        sourceDetails = sources || [];
      }

      // Return enhanced analysis with full source details
      const result = {
        ...analysis,
        sources: {
          ids: sourceIds,
          details: sourceDetails,
          breakdown: analysis.ai_analysis?.source_breakdown || [],
          count: sourceIds.length
        }
      };

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get analysis with sources error', { error });
      res.status(500).json({ error: 'Failed to fetch analysis with sources' });
    }
  }
}

export const dashboardController = new DashboardController();