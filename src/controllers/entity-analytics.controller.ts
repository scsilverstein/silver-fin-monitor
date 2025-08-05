// Entity Analytics Controller - provides entity tracking and trending analysis
import { Request, Response, NextFunction } from 'express';
import { db } from '@/services/database/index';

interface EntityAnalytics {
  entityName: string;
  entityType: string;
  totalMentions: number;
  averageSentiment: number;
  mentionTrend: string;
  lastMentionDate: string;
  sources: string[];
}

interface EntityDashboardData {
  topEntities: Array<{
    entityName: string;
    entityType: string;
    mentionCount: number;
    sentiment: number;
    trendScore: number;
  }>;
  entityTypes: Record<string, number>;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trendingEntities: Array<{
    entityName: string;
    mentionCount: number;
    trendDirection: 'up' | 'down' | 'stable';
  }>;
  timeRange: {
    start: string;
    end: string;
  };
}

class EntityAnalyticsController {
  private db = db;

  // Get entity analytics dashboard
  getDashboardData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { start, end } = req.query;
      
      // Default to last 7 days if no range provided
      const endDate = end ? new Date(end as string) : new Date();
      const startDate = start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get top entities using a simpler approach that works with our database client
      // First, get all content with entities in our date range
      const contentWithEntities = await this.db.query(`
        SELECT id, entities, sentiment_score, raw_feed_id, created_at
        FROM processed_content 
        WHERE created_at >= $1 AND created_at <= $2
          AND entities IS NOT NULL
        ORDER BY created_at DESC
      `, [startDate, endDate]);

      // Process entities in JavaScript since complex JSON queries aren't working reliably
      const entityCounts = new Map<string, {
        entity_name: string;
        entity_type: string;
        mention_count: number;
        avg_sentiment: number;
        source_count: number;
        source_ids: Set<string>;
        sentiments: number[];
      }>();

      contentWithEntities.forEach((row: any) => {
        const entities = row.entities;
        const sentiment = parseFloat(row.sentiment_score) || 0;
        const sourceId = row.raw_feed_id;

        // Handle both entity formats
        if (Array.isArray(entities)) {
          // Old format: [{"name":"X","type":"Y"}]
          entities.forEach((entity: any) => {
            if (entity?.name && entity?.type) {
              const key = `${entity.name}:${entity.type}`;
              if (!entityCounts.has(key)) {
                entityCounts.set(key, {
                  entity_name: entity.name,
                  entity_type: entity.type,
                  mention_count: 0,
                  avg_sentiment: 0,
                  source_count: 0,
                  source_ids: new Set(),
                  sentiments: []
                });
              }
              const entry = entityCounts.get(key)!;
              entry.mention_count++;
              entry.sentiments.push(sentiment);
              if (sourceId) entry.source_ids.add(sourceId);
            }
          });
        } else if (entities && typeof entities === 'object') {
          // New format: {companies: [], tickers: [], people: [], locations: []}
          Object.entries(entities).forEach(([type, entityList]: [string, any]) => {
            if (Array.isArray(entityList)) {
              const entityType = type === 'companies' ? 'company' : 
                              type === 'tickers' ? 'ticker' :
                              type === 'people' ? 'person' :
                              type === 'locations' ? 'location' : type;
              
              entityList.forEach((entityName: string) => {
                if (entityName && entityName.length > 1) {
                  const key = `${entityName}:${entityType}`;
                  if (!entityCounts.has(key)) {
                    entityCounts.set(key, {
                      entity_name: entityName,
                      entity_type: entityType,
                      mention_count: 0,
                      avg_sentiment: 0,
                      source_count: 0,
                      source_ids: new Set(),
                      sentiments: []
                    });
                  }
                  const entry = entityCounts.get(key)!;
                  entry.mention_count++;
                  entry.sentiments.push(sentiment);
                  if (sourceId) entry.source_ids.add(sourceId);
                }
              });
            }
          });
        }
      });

      // Calculate averages and convert to final format
      const topEntities = Array.from(entityCounts.values())
        .map(entry => ({
          entity_name: entry.entity_name,
          entity_type: entry.entity_type,
          mention_count: entry.mention_count,
          avg_sentiment: entry.sentiments.length > 0 
            ? entry.sentiments.reduce((a, b) => a + b, 0) / entry.sentiments.length 
            : 0,
          source_count: entry.source_ids.size
        }))
        .sort((a, b) => b.mention_count - a.mention_count)
        .slice(0, 1000);

      // Calculate entity type distribution from our processed data
      const entityTypeCounts: Record<string, number> = {};
      entityCounts.forEach((entry) => {
        entityTypeCounts[entry.entity_type] = (entityTypeCounts[entry.entity_type] || 0) + entry.mention_count;
      });

      // Calculate sentiment distribution from our processed data
      const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
      contentWithEntities.forEach((row: any) => {
        const sentiment = parseFloat(row.sentiment_score) || 0;
        if (sentiment > 0.1) {
          sentimentCounts.positive++;
        } else if (sentiment < -0.1) {
          sentimentCounts.negative++;
        } else {
          sentimentCounts.neutral++;
        }
      });

      // Calculate trend scores based on recent activity
      const recentCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const recentContent = contentWithEntities.filter((row: any) => 
        new Date(row.created_at) > recentCutoff
      );
      
      // Calculate recent mention counts for trend detection
      const recentEntityCounts = new Map<string, number>();
      recentContent.forEach((row: any) => {
        const entities = row.entities;
        if (Array.isArray(entities)) {
          entities.forEach((entity: any) => {
            if (entity?.name && entity?.type) {
              const key = `${entity.name}:${entity.type}`;
              recentEntityCounts.set(key, (recentEntityCounts.get(key) || 0) + 1);
            }
          });
        } else if (entities && typeof entities === 'object') {
          Object.entries(entities).forEach(([type, entityList]: [string, any]) => {
            if (Array.isArray(entityList)) {
              const entityType = type === 'companies' ? 'company' : 
                              type === 'tickers' ? 'ticker' :
                              type === 'people' ? 'person' :
                              type === 'locations' ? 'location' : type;
              
              entityList.forEach((entityName: string) => {
                if (entityName && entityName.length > 1) {
                  const key = `${entityName}:${entityType}`;
                  recentEntityCounts.set(key, (recentEntityCounts.get(key) || 0) + 1);
                }
              });
            }
          });
        }
      });

      // Transform data for response with real trend calculations
      const dashboardData: EntityDashboardData = {
        topEntities: topEntities.map((row: any) => {
          const key = `${row.entity_name}:${row.entity_type}`;
          const recentCount = recentEntityCounts.get(key) || 0;
          const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
          const avgDailyMentions = row.mention_count / totalDays;
          const recentDailyMentions = recentCount / 2; // last 2 days
          
          // Calculate trend score: higher if recent activity exceeds average
          const trendScore = avgDailyMentions > 0 
            ? Math.min(100, (recentDailyMentions / avgDailyMentions) * 50)
            : 0;
          
          return {
            entityName: row.entity_name,
            entityType: row.entity_type,
            mentionCount: row.mention_count,
            sentiment: row.avg_sentiment,
            trendScore: trendScore
          };
        }),
        entityTypes: entityTypeCounts,
        sentimentDistribution: sentimentCounts,
        trendingEntities: topEntities.slice(0, 10).map((row: any) => {
          const key = `${row.entity_name}:${row.entity_type}`;
          const recentCount = recentEntityCounts.get(key) || 0;
          const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
          const avgDailyMentions = row.mention_count / totalDays;
          const recentDailyMentions = recentCount / 2;
          
          // Determine trend direction based on recent vs average activity
          let trendDirection: 'up' | 'down' | 'stable' = 'stable';
          if (avgDailyMentions > 0) {
            const ratio = recentDailyMentions / avgDailyMentions;
            if (ratio > 1.2) trendDirection = 'up';
            else if (ratio < 0.8) trendDirection = 'down';
          }
          
          return {
            entityName: row.entity_name,
            mentionCount: row.mention_count,
            trendDirection: trendDirection
          };
        }),
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      };

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      next(error);
    }
  };

  // Get analytics for a specific entity
  getEntityAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { entityName } = req.params;
      const { type } = req.query;

      const query = `
        WITH entity_mentions AS (
          SELECT 
            jsonb_array_elements_text(entities->'companies') as entity_name,
            'company' as entity_type,
            sentiment_score,
            pc.created_at,
            rf.source_id,
            fs.name as source_name
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'companies' IS NOT NULL
            AND jsonb_array_length(entities->'companies') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'tickers') as entity_name,
            'ticker' as entity_type,
            sentiment_score,
            pc.created_at,
            rf.source_id,
            fs.name as source_name
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'tickers' IS NOT NULL
            AND jsonb_array_length(entities->'tickers') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'people') as entity_name,
            'person' as entity_type,
            sentiment_score,
            pc.created_at,
            rf.source_id,
            fs.name as source_name
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'people' IS NOT NULL
            AND jsonb_array_length(entities->'people') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'locations') as entity_name,
            'location' as entity_type,
            sentiment_score,
            pc.created_at,
            rf.source_id,
            fs.name as source_name
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'locations' IS NOT NULL
            AND jsonb_array_length(entities->'locations') > 0
        )
        SELECT 
          entity_name,
          entity_type,
          COUNT(*) as total_mentions,
          AVG(sentiment_score) as average_sentiment,
          MIN(created_at) as first_mention,
          MAX(created_at) as last_mention,
          COUNT(DISTINCT source_id) as source_count,
          array_agg(DISTINCT source_name) as sources
        FROM entity_mentions
        WHERE entity_name = $1
        ${type ? 'AND entity_type = $2' : ''}
        GROUP BY entity_name, entity_type
      `;

      const params = type ? [entityName, type] : [entityName];
      const result = await this.db.query(query, params);

      if (result.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Entity not found'
        });
        return;
      }

      const entityData = result[0];
      
      // Calculate mention trend by comparing recent vs older mentions
      const trendQuery = `
        WITH entity_mentions AS (
          SELECT 
            DATE(created_at) as mention_date,
            COUNT(*) as daily_mentions
          FROM processed_content
          WHERE (entities->'companies' @> $1::jsonb
            OR entities->'tickers' @> $1::jsonb
            OR entities->'people' @> $1::jsonb
            OR entities->'locations' @> $1::jsonb)
          AND created_at >= NOW() - INTERVAL '14 days'
          GROUP BY DATE(created_at)
        ),
        trend_calc AS (
          SELECT 
            AVG(CASE WHEN mention_date >= CURRENT_DATE - INTERVAL '7 days' THEN daily_mentions ELSE NULL END) as recent_avg,
            AVG(CASE WHEN mention_date < CURRENT_DATE - INTERVAL '7 days' THEN daily_mentions ELSE NULL END) as older_avg
          FROM entity_mentions
        )
        SELECT 
          recent_avg,
          older_avg,
          CASE 
            WHEN recent_avg IS NULL OR older_avg IS NULL THEN 'stable'
            WHEN recent_avg > older_avg * 1.2 THEN 'increasing'
            WHEN recent_avg < older_avg * 0.8 THEN 'decreasing'
            ELSE 'stable'
          END as trend
        FROM trend_calc
      `;
      
      const entityNameJson = JSON.stringify([entityName]);
      const trendResult = await this.db.query(trendQuery, [entityNameJson]);
      const mentionTrend = trendResult[0]?.trend || 'stable';
      
      const analytics: EntityAnalytics = {
        entityName: entityData.entity_name,
        entityType: entityData.entity_type,
        totalMentions: parseInt(entityData.total_mentions),
        averageSentiment: parseFloat(entityData.average_sentiment) || 0,
        mentionTrend: mentionTrend,
        lastMentionDate: entityData.last_mention,
        sources: entityData.sources || []
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  };

  // Get trending entities
  getTrendingEntities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        types,
        sentimentMin,
        sentimentMax,
        start,
        end,
        sources,
        minMentions,
        trendingOnly,
        sortBy = 'mentions',
        sortOrder = 'desc'
      } = req.query;

      // Default to last 7 days if no range provided
      const endDate = end ? new Date(end as string) : new Date();
      const startDate = start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      let params: any[] = [startDate, endDate];
      let paramIndex = 2;

      if (types) {
        paramIndex++;
        params.push((types as string).split(','));
      }

      if (sentimentMin) {
        paramIndex++;
        params.push(parseFloat(sentimentMin as string));
      }

      if (sentimentMax) {
        paramIndex++;
        params.push(parseFloat(sentimentMax as string));
      }

      const orderByField = sortBy === 'sentiment' ? 'avg_sentiment' : 
                          sortBy === 'mentions' ? 'mention_count' : 'mention_count';
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      const query = `
        WITH entity_mentions AS (
          SELECT 
            jsonb_array_elements_text(entities->'companies') as entity_name,
            'company' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $1 AND pc.created_at <= $2
            AND entities->'companies' IS NOT NULL
            AND jsonb_array_length(entities->'companies') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'tickers') as entity_name,
            'ticker' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $1 AND pc.created_at <= $2
            AND entities->'tickers' IS NOT NULL
            AND jsonb_array_length(entities->'tickers') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'people') as entity_name,
            'person' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $1 AND pc.created_at <= $2
            AND entities->'people' IS NOT NULL
            AND jsonb_array_length(entities->'people') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'locations') as entity_name,
            'location' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $1 AND pc.created_at <= $2
            AND entities->'locations' IS NOT NULL
            AND jsonb_array_length(entities->'locations') > 0
        )
        SELECT 
          entity_name,
          entity_type,
          COUNT(*) as mention_count,
          AVG(sentiment_score) as avg_sentiment,
          MIN(created_at) as first_mention,
          MAX(created_at) as last_mention,
          DATE(created_at) as date,
          COUNT(*) * (1 + EXTRACT(EPOCH FROM (NOW() - AVG(created_at))) / 86400) as trend_score
        FROM entity_mentions
        WHERE entity_name IS NOT NULL
        ${types ? `AND entity_type = ANY($3)` : ''}
        ${sentimentMin ? `AND sentiment_score >= $${types ? '4' : '3'}` : ''}
        ${sentimentMax ? `AND sentiment_score <= $${types && sentimentMin ? '5' : types || sentimentMin ? '4' : '3'}` : ''}
        GROUP BY entity_name, entity_type, DATE(created_at)
        ${minMentions ? `HAVING COUNT(*) >= ${minMentions}` : ''}
        ORDER BY ${orderByField} ${orderDirection}
        LIMIT 1000
      `;

      const results = await this.db.query(query, params);

      const trends = results.map((row: any) => ({
        entityName: row.entity_name,
        entityType: row.entity_type,
        date: row.date,
        mentionCount: parseInt(row.mention_count),
        averageSentiment: parseFloat(row.avg_sentiment) || 0,
        trendScore: parseFloat(row.trend_score) || 0,
        firstMention: row.first_mention,
        lastMention: row.last_mention
      }));

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      next(error);
    }
  };

  // Compare multiple entities
  compareEntities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { entities, timeRange, metric = 'mentions' } = req.body;

      if (!entities || !Array.isArray(entities)) {
        res.status(400).json({
          success: false,
          error: 'Entities array is required'
        });
        return;
      }

      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);

      const query = `
        WITH entity_mentions AS (
          SELECT 
            jsonb_array_elements_text(entities->'companies') as entity_name,
            'company' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $2 AND pc.created_at <= $3
            AND entities->'companies' IS NOT NULL
            AND jsonb_array_length(entities->'companies') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'tickers') as entity_name,
            'ticker' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $2 AND pc.created_at <= $3
            AND entities->'tickers' IS NOT NULL
            AND jsonb_array_length(entities->'tickers') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'people') as entity_name,
            'person' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $2 AND pc.created_at <= $3
            AND entities->'people' IS NOT NULL
            AND jsonb_array_length(entities->'people') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'locations') as entity_name,
            'location' as entity_type,
            sentiment_score,
            pc.created_at
          FROM processed_content pc
          WHERE pc.created_at >= $2 AND pc.created_at <= $3
            AND entities->'locations' IS NOT NULL
            AND jsonb_array_length(entities->'locations') > 0
        )
        SELECT 
          entity_name,
          entity_type,
          COUNT(*) as mention_count,
          AVG(sentiment_score) as avg_sentiment,
          DATE(created_at) as date
        FROM entity_mentions
        WHERE entity_name = ANY($1)
        GROUP BY entity_name, entity_type, DATE(created_at)
        ORDER BY date DESC
      `;

      const results = await this.db.query(query, [entities, startDate, endDate]);

      const comparison = {
        entities: entities,
        timeRange,
        metric,
        data: results.map((row: any) => ({
          entityName: row.entity_name,
          entityType: row.entity_type,
          date: row.date,
          mentionCount: parseInt(row.mention_count),
          averageSentiment: parseFloat(row.avg_sentiment) || 0
        }))
      };

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      next(error);
    }
  };

  // Get entity mentions with context
  getEntityMentions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { entityName } = req.params;
      const { limit = 10000, offset = 0 } = req.query;

      const query = `
        WITH entity_mentions AS (
          SELECT pc.id, pc.processed_text, pc.summary, pc.sentiment_score, pc.created_at as mention_date,
                 rf.title, rf.published_at, fs.name as source_name, fs.type as source_type
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'companies' @> $1::jsonb
            AND entities->'companies' IS NOT NULL
            AND jsonb_array_length(entities->'companies') > 0
          
          UNION ALL
          
          SELECT pc.id, pc.processed_text, pc.summary, pc.sentiment_score, pc.created_at as mention_date,
                 rf.title, rf.published_at, fs.name as source_name, fs.type as source_type
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'tickers' @> $1::jsonb
            AND entities->'tickers' IS NOT NULL
            AND jsonb_array_length(entities->'tickers') > 0
          
          UNION ALL
          
          SELECT pc.id, pc.processed_text, pc.summary, pc.sentiment_score, pc.created_at as mention_date,
                 rf.title, rf.published_at, fs.name as source_name, fs.type as source_type
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'people' @> $1::jsonb
            AND entities->'people' IS NOT NULL
            AND jsonb_array_length(entities->'people') > 0
          
          UNION ALL
          
          SELECT pc.id, pc.processed_text, pc.summary, pc.sentiment_score, pc.created_at as mention_date,
                 rf.title, rf.published_at, fs.name as source_name, fs.type as source_type
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          LEFT JOIN feed_sources fs ON rf.source_id = fs.id
          WHERE entities->'locations' @> $1::jsonb
            AND entities->'locations' IS NOT NULL
            AND jsonb_array_length(entities->'locations') > 0
        )
        SELECT DISTINCT * FROM entity_mentions
        ORDER BY mention_date DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        WITH entity_mentions AS (
          SELECT pc.id
          FROM processed_content pc
          WHERE entities->'companies' @> $1::jsonb
            AND entities->'companies' IS NOT NULL
            AND jsonb_array_length(entities->'companies') > 0
          
          UNION ALL
          
          SELECT pc.id
          FROM processed_content pc
          WHERE entities->'tickers' @> $1::jsonb
            AND entities->'tickers' IS NOT NULL
            AND jsonb_array_length(entities->'tickers') > 0
          
          UNION ALL
          
          SELECT pc.id
          FROM processed_content pc
          WHERE entities->'people' @> $1::jsonb
            AND entities->'people' IS NOT NULL
            AND jsonb_array_length(entities->'people') > 0
          
          UNION ALL
          
          SELECT pc.id
          FROM processed_content pc
          WHERE entities->'locations' @> $1::jsonb
            AND entities->'locations' IS NOT NULL
            AND jsonb_array_length(entities->'locations') > 0
        )
        SELECT COUNT(DISTINCT id) as total FROM entity_mentions
      `;

      const entityNameJson = JSON.stringify([entityName]);
      const [mentions, countResult] = await Promise.all([
        this.db.query(query, [entityNameJson, limit, offset]),
        this.db.query(countQuery, [entityNameJson])
      ]);

      const total = countResult[0]?.total || 0;

      const mentionData = mentions.map((row: any) => ({
        id: row.id,
        mentionDate: row.mention_date,
        contentSummary: row.summary,
        sentiment: parseFloat(row.sentiment_score) || 0,
        source: {
          name: row.source_name,
          type: row.source_type
        },
        title: row.title,
        publishedAt: row.published_at
      }));

      res.json({
        success: true,
        data: {
          mentions: mentionData,
          total: parseInt(total)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Get entity insights based on real data analysis
  getEntityInsights = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { entityName } = req.params;

      // Get entity analytics data for insights generation
      const analyticsQuery = `
        WITH entity_data AS (
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as daily_mentions,
            AVG(sentiment_score) as daily_sentiment,
            COUNT(DISTINCT rf.source_id) as unique_sources
          FROM processed_content pc
          LEFT JOIN raw_feeds rf ON pc.raw_feed_id = rf.id
          WHERE (entities->'companies' @> $1::jsonb
            OR entities->'tickers' @> $1::jsonb
            OR entities->'people' @> $1::jsonb
            OR entities->'locations' @> $1::jsonb)
          AND pc.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        ),
        trend_analysis AS (
          SELECT 
            AVG(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN daily_mentions END) as recent_mentions,
            AVG(CASE WHEN date < CURRENT_DATE - INTERVAL '7 days' THEN daily_mentions END) as older_mentions,
            AVG(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN daily_sentiment END) as recent_sentiment,
            AVG(CASE WHEN date < CURRENT_DATE - INTERVAL '7 days' THEN daily_sentiment END) as older_sentiment,
            MAX(daily_mentions) as peak_mentions,
            MIN(daily_mentions) as min_mentions
          FROM entity_data
        )
        SELECT * FROM trend_analysis
      `;

      const entityNameJson = JSON.stringify([entityName]);
      const [trendData] = await this.db.query(analyticsQuery, [entityNameJson]);

      if (!trendData) {
        res.json({
          success: true,
          data: []
        });
        return;
      }

      const insights = [];

      // Generate trend insight
      if (trendData.recent_mentions && trendData.older_mentions) {
        const mentionChange = ((trendData.recent_mentions - trendData.older_mentions) / trendData.older_mentions) * 100;
        if (Math.abs(mentionChange) > 20) {
          insights.push({
            type: 'trend',
            title: mentionChange > 0 ? 'Increasing Attention' : 'Decreasing Attention',
            description: `${entityName} has ${mentionChange > 0 ? 'increased' : 'decreased'} in mentions by ${Math.abs(mentionChange).toFixed(1)}% over the past week`,
            confidence: Math.min(0.9, Math.abs(mentionChange) / 100),
            timeframe: '7 days'
          });
        }
      }

      // Generate sentiment insight
      if (trendData.recent_sentiment !== null && trendData.older_sentiment !== null) {
        const sentimentChange = trendData.recent_sentiment - trendData.older_sentiment;
        if (Math.abs(sentimentChange) > 0.1) {
          insights.push({
            type: 'sentiment',
            title: sentimentChange > 0 ? 'Improving Sentiment' : 'Declining Sentiment',
            description: `Market sentiment for ${entityName} has ${sentimentChange > 0 ? 'improved' : 'declined'} by ${Math.abs(sentimentChange * 100).toFixed(1)}% recently`,
            confidence: Math.min(0.8, Math.abs(sentimentChange) * 5),
            timeframe: '7 days'
          });
        }
      }

      // Generate volatility insight
      if (trendData.peak_mentions && trendData.min_mentions && trendData.peak_mentions > 0) {
        const volatility = (trendData.peak_mentions - trendData.min_mentions) / trendData.peak_mentions;
        if (volatility > 0.5) {
          insights.push({
            type: 'volatility',
            title: 'High Volatility Detected',
            description: `${entityName} shows significant variation in daily mentions, indicating volatile market interest`,
            confidence: Math.min(0.85, volatility),
            timeframe: '30 days'
          });
        }
      }

      // If no specific insights, provide general insight
      if (insights.length === 0) {
        insights.push({
          type: 'general',
          title: 'Stable Activity',
          description: `${entityName} shows consistent mention patterns with stable sentiment`,
          confidence: 0.7,
          timeframe: '30 days'
        });
      }

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      next(error);
    }
  };

  // Search entities
  searchEntities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
        return;
      }

      const searchQuery = `
        WITH entity_mentions AS (
          SELECT 
            jsonb_array_elements_text(entities->'companies') as entity_name,
            'company' as entity_type,
            sentiment_score
          FROM processed_content pc
          WHERE pc.created_at >= NOW() - INTERVAL '30 days'
            AND entities->'companies' IS NOT NULL
            AND jsonb_array_length(entities->'companies') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'tickers') as entity_name,
            'ticker' as entity_type,
            sentiment_score
          FROM processed_content pc
          WHERE pc.created_at >= NOW() - INTERVAL '30 days'
            AND entities->'tickers' IS NOT NULL
            AND jsonb_array_length(entities->'tickers') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'people') as entity_name,
            'person' as entity_type,
            sentiment_score
          FROM processed_content pc
          WHERE pc.created_at >= NOW() - INTERVAL '30 days'
            AND entities->'people' IS NOT NULL
            AND jsonb_array_length(entities->'people') > 0
          
          UNION ALL
          
          SELECT 
            jsonb_array_elements_text(entities->'locations') as entity_name,
            'location' as entity_type,
            sentiment_score
          FROM processed_content pc
          WHERE pc.created_at >= NOW() - INTERVAL '30 days'
            AND entities->'locations' IS NOT NULL
            AND jsonb_array_length(entities->'locations') > 0
        )
        SELECT 
          entity_name,
          entity_type,
          COUNT(*) as mention_count,
          AVG(sentiment_score) as recent_sentiment
        FROM entity_mentions
        WHERE entity_name ILIKE $1
        GROUP BY entity_name, entity_type
        ORDER BY mention_count DESC
        LIMIT $2
      `;

      const results = await this.db.query(searchQuery, [`%${query}%`, limit]);

      const searchResults = results.map((row: any) => ({
        entityName: row.entity_name,
        entityType: row.entity_type,
        mentionCount: parseInt(row.mention_count),
        recentSentiment: parseFloat(row.recent_sentiment) || 0
      }));

      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      next(error);
    }
  };
}

export const entityAnalyticsController = new EntityAnalyticsController();