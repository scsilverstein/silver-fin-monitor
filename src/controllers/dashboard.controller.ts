// Dashboard controller following CLAUDE.md specification
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../services/database/db.service';
import { CacheService } from '../services/cache/cache.service';
import { QueueService } from '../services/queue/queue.service';
import { OpenAIService } from '../services/ai/openai.service';
import winston from 'winston';

export class DashboardController {
  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private queue: QueueService,
    private aiService: OpenAIService,
    private logger: winston.Logger
  ) {}

  // Get dashboard overview
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const cacheKey = 'dashboard:overview';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get latest daily analysis using table operations
      const latestAnalyses = await this.db.tables.dailyAnalysis.findMany(
        {},
        { 
          orderBy: { field: 'analysis_date', ascending: false },
          limit: 1
        }
      );
      const latestAnalysis = latestAnalyses[0];

      // Get feed statistics using table operations
      const allFeeds = await this.db.tables.feedSources.findMany();
      const activeFeeds = allFeeds.filter((f: any) => f.is_active);
      const feedTypes = [...new Set(allFeeds.map((f: any) => f.type))];
      
      const feedStats = [{
        total_feeds: allFeeds.length,
        active_feeds: activeFeeds.length,
        feed_types: feedTypes.length
      }];

      // Get feed type breakdown
      const feedTypeMap = new Map<string, number>();
      activeFeeds.forEach((feed: any) => {
        feedTypeMap.set(feed.type, (feedTypeMap.get(feed.type) || 0) + 1);
      });
      const feedTypeBreakdown = Array.from(feedTypeMap.entries()).map(([type, count]) => ({
        type,
        count
      }));

      // Get recent content statistics - use Supabase client directly
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const supabaseClient = this.db.getClient();
      
      // Get recent content with proper Supabase query
      const { data: recentContent, error: contentError } = await supabaseClient
        .from('processed_content')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString());
      
      if (contentError) {
        this.logger.error('Error fetching recent content:', contentError);
        throw contentError;
      }
      
      const sentimentScores = (recentContent || [])
        .map(c => c.sentiment_score)
        .filter(s => s !== null && s !== undefined);
      
      const avgSentiment = sentimentScores.length > 0
        ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
        : 0;
      
      const uniqueDays = new Set(
        (recentContent || []).map(c => new Date(c.created_at).toDateString())
      );
      
      const contentStats = [{
        total_content: (recentContent || []).length,
        avg_sentiment: avgSentiment,
        days_with_content: uniqueDays.size
      }];

      // Get active predictions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get predictions with joined analysis data
      const { data: activePredictions, error: predError } = await supabaseClient
        .from('predictions')
        .select(`
          *,
          daily_analysis!inner(analysis_date)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (predError) {
        this.logger.error('Error fetching predictions:', predError);
        throw predError;
      }

      // Get key themes from latest analysis  
      const analysisData = latestAnalysis as any;
      const keyThemes = analysisData?.key_themes || [];
      const marketDrivers = analysisData?.ai_analysis?.key_drivers || [];
      const riskFactors = analysisData?.ai_analysis?.risk_factors || [];

      const overview = {
        // Stats expected by frontend
        totalSources: feedStats[0]?.total_feeds || 0,
        activeSources: feedStats[0]?.active_feeds || 0,
        todayFeeds: contentStats[0]?.total_content || 0,
        processedToday: contentStats[0]?.total_content || 0,
        
        // Market sentiment
        marketSentiment: {
          label: analysisData?.market_sentiment || 'neutral',
          score: contentStats[0]?.avg_sentiment || 0,
          confidence: analysisData?.confidence_score || 0
        },
        
        // System health
        systemHealth: {
          feedProcessing: 'healthy',
          aiAnalysis: latestAnalysis ? 'healthy' : 'degraded',
          queueStatus: 'healthy',
          lastUpdate: new Date()
        },
        
        // Latest analysis (with camelCase fields)
        latestAnalysis: latestAnalysis ? {
          analysisDate: analysisData.analysis_date,
          keyThemes: keyThemes,
          overallSummary: analysisData.overall_summary || 'No summary available',
          marketSentiment: analysisData.market_sentiment,
          confidenceScore: analysisData.confidence_score,
          sourcesAnalyzed: analysisData.sources_analyzed,
          aiAnalysis: analysisData.ai_analysis || {}
        } : null,
        
        // Recent predictions
        recentPredictions: (activePredictions || []).map(pred => ({
          ...pred,
          analysis_date: pred.daily_analysis?.analysis_date || null
        })),
        
        // Additional data for other components
        sentimentScore: contentStats[0]?.avg_sentiment || 0,
        lastAnalysisDate: analysisData?.analysis_date || null,
        confidenceScore: analysisData?.confidence_score || 0,
        activeFeedSources: feedStats[0]?.active_feeds || 0,
        feedTypes: feedTypeBreakdown.reduce((acc: any, item: any) => {
          acc[item.type] = item.count;
          return acc;
        }, {}),
        recentContentCount: contentStats[0]?.total_content || 0,
        keyThemes,
        marketDrivers,
        riskFactors,
        activePredictions: (activePredictions || []).map(pred => ({
          ...pred,
          analysis_date: pred.daily_analysis?.analysis_date || null
        }))
      };

      await this.cache.set(cacheKey, overview, { ttl: 300 }); // 5 minutes

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      next(error);
    }
  }

  // Get market trends
  async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const { days = 7 } = req.query;
      const cacheKey = `dashboard:trends:${days}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Get sentiment trend
      const sentimentTrend = await this.db.query(
        `SELECT 
          DATE(created_at) as date,
          AVG(sentiment_score) as sentiment,
          COUNT(*) as volume
         FROM processed_content
         WHERE created_at >= NOW() - INTERVAL '${Number(days)} days'
         GROUP BY DATE(created_at)
         ORDER BY date DESC`
      );

      // Get daily analyses
      const dailyAnalyses = await this.db.query(
        `SELECT 
          analysis_date,
          market_sentiment,
          confidence_score,
          sources_analyzed
         FROM daily_analysis
         WHERE analysis_date >= CURRENT_DATE - INTERVAL '${Number(days)} days'
         ORDER BY analysis_date DESC`
      );

      // Get topic trends
      const topicTrends = await this.db.query(
        `SELECT 
          DATE(created_at) as date,
          unnest(key_topics) as topic,
          COUNT(*) as count
         FROM processed_content
         WHERE created_at >= NOW() - INTERVAL '${Number(days)} days'
         GROUP BY date, topic
         ORDER BY date DESC, count DESC`
      );

      // Transform dailyAnalyses to camelCase
      const transformedDailyAnalyses = dailyAnalyses.map((row: any) => ({
        analysisDate: row.analysis_date,
        marketSentiment: row.market_sentiment,
        confidenceScore: row.confidence_score,
        sourcesAnalyzed: row.sources_analyzed
      }));

      const trends = {
        sentimentTrend,
        dailyAnalyses: transformedDailyAnalyses,
        topicTrends: this.groupTopicsByDate(topicTrends)
      };

      await this.cache.set(cacheKey, trends, { ttl: 900 }); // 15 minutes

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      next(error);
    }
  }

  // Get key themes for a timeframe
  async getThemes(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeframe = 'week' } = req.query;
      const cacheKey = `dashboard:themes:${timeframe}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;

      // Get aggregated themes
      const themes = await this.db.query(
        `SELECT 
          unnest(key_themes) as theme,
          COUNT(*) as occurrence_count,
          COUNT(DISTINCT analysis_date) as days_mentioned
         FROM daily_analysis
         WHERE analysis_date >= CURRENT_DATE - INTERVAL '${days} days'
         GROUP BY theme
         ORDER BY occurrence_count DESC
         LIMIT 20`
      );

      // Get market drivers and risk factors
      const marketInsights = await this.db.query(
        `SELECT 
          unnest(ai_analysis->'key_drivers') as market_driver,
          COUNT(*) as count
         FROM daily_analysis
         WHERE analysis_date >= CURRENT_DATE - INTERVAL '${days} days'
         AND ai_analysis->'key_drivers' IS NOT NULL
         GROUP BY market_driver
         ORDER BY count DESC
         LIMIT 10`
      );

      const riskFactors = await this.db.query(
        `SELECT 
          unnest(ai_analysis->'risk_factors') as risk_factor,
          COUNT(*) as count
         FROM daily_analysis
         WHERE analysis_date >= CURRENT_DATE - INTERVAL '${days} days'
         AND ai_analysis->'risk_factors' IS NOT NULL
         GROUP BY risk_factor
         ORDER BY count DESC
         LIMIT 10`
      );

      const result = {
        timeframe,
        themes: themes.map((t: any) => t.theme),
        marketDrivers: marketInsights.map((m: any) => m.market_driver),
        riskFactors: riskFactors.map((r: any) => r.risk_factor),
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      };

      await this.cache.set(cacheKey, result, { ttl: 3600 }); // 1 hour

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get predictions overview
  async getPredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const { timeHorizon, type } = req.query;
      const cacheKey = `dashboard:predictions:${timeHorizon || 'all'}:${type || 'all'}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      let query = `
        SELECT 
          p.*,
          da.analysis_date,
          da.market_sentiment,
          pc.accuracy_score
        FROM predictions p
        JOIN daily_analysis da ON p.daily_analysis_id = da.id
        LEFT JOIN prediction_comparisons pc ON p.id = pc.prediction_id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;

      if (timeHorizon) {
        query += ` AND p.time_horizon = $${paramIndex}`;
        params.push(timeHorizon);
        paramIndex++;
      }

      if (type) {
        query += ` AND p.prediction_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      query += ' ORDER BY p.created_at DESC LIMIT 50';

      const predictions = await this.db.query(query, params);

      // Get prediction statistics
      const stats = await this.db.query(
        `SELECT 
          time_horizon,
          prediction_type,
          COUNT(*) as total,
          COUNT(pc.id) as evaluated,
          AVG(pc.accuracy_score) as avg_accuracy
         FROM predictions p
         LEFT JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         GROUP BY time_horizon, prediction_type`
      );

      const result = {
        predictions,
        stats
      };

      await this.cache.set(cacheKey, result, { ttl: 600 }); // 10 minutes

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get accuracy metrics
  async getAccuracy(req: Request, res: Response, next: NextFunction) {
    try {
      const cacheKey = 'dashboard:accuracy';
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Overall accuracy
      const [overall] = await this.db.query(
        `SELECT 
          AVG(accuracy_score) as overall_accuracy,
          COUNT(*) as total_evaluated
         FROM prediction_comparisons`
      );

      // Accuracy by type
      const byType = await this.db.query(
        `SELECT 
          p.prediction_type as type,
          AVG(pc.accuracy_score) as accuracy,
          COUNT(pc.id) as total
         FROM predictions p
         JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         GROUP BY p.prediction_type
         ORDER BY accuracy DESC`
      );

      // Accuracy by time horizon
      const byHorizon = await this.db.query(
        `SELECT 
          p.time_horizon as horizon,
          AVG(pc.accuracy_score) as accuracy,
          COUNT(pc.id) as total
         FROM predictions p
         JOIN prediction_comparisons pc ON p.id = pc.prediction_id
         GROUP BY p.time_horizon
         ORDER BY 
          CASE p.time_horizon
            WHEN '1_week' THEN 1
            WHEN '2_weeks' THEN 2
            WHEN '1_month' THEN 3
            WHEN '3_months' THEN 4
            WHEN '6_months' THEN 5
            WHEN '1_year' THEN 6
          END`
      );

      // Recent comparisons
      const recentComparisons = await this.db.query(
        `SELECT 
          pc.*,
          p.prediction_text,
          p.time_horizon,
          p.prediction_type
         FROM prediction_comparisons pc
         JOIN predictions p ON pc.prediction_id = p.id
         ORDER BY pc.comparison_date DESC
         LIMIT 10`
      );

      const accuracy = {
        overall: overall?.overall_accuracy || 0,
        byType,
        byHorizon,
        recentComparisons
      };

      await this.cache.set(cacheKey, accuracy, { ttl: 1800 }); // 30 minutes

      res.json({
        success: true,
        data: accuracy
      });
    } catch (error) {
      next(error);
    }
  }

  // Get real-time statistics
  async getRealtimeStats(req: Request, res: Response, next: NextFunction) {
    try {
      // Don't cache real-time stats
      const queueStats = await this.queue.getStats();
      
      // Get processing statistics
      const processingStats = await this.db.query(
        `SELECT 
          COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing,
          COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed
         FROM raw_feeds
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      );

      const stats = {
        queue: queueStats,
        processing: processingStats[0] || {},
        timestamp: new Date()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to group topics by date
  private groupTopicsByDate(topicData: any[]): any[] {
    const grouped = topicData.reduce((acc: any, item: any) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = { date, topics: [] };
      }
      acc[date].topics.push({ topic: item.topic, count: item.count });
      return acc;
    }, {});

    return Object.values(grouped).map((item: any) => ({
      date: item.date,
      topics: item.topics.slice(0, 5) // Top 5 topics per day
    }));
  }
}

// Create and export singleton instance
import { getDatabase } from '../services/database/db.service';
import { winstonLogger } from '../utils/logger';

const db = getDatabase(winstonLogger);
const cacheService = new CacheService(db, winstonLogger);
const queueService = new QueueService(db, winstonLogger);
const aiService = new OpenAIService(db, cacheService, winstonLogger);

export const dashboardController = new DashboardController(db, cacheService, queueService, aiService, winstonLogger);

export default DashboardController;