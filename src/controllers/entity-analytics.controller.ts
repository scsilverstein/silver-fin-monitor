// Entity Analytics Controller - provides entity tracking and trending analysis
import { Request, Response, NextFunction } from 'express';
import { db } from '@/services/database';

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

      // Transform data for response
      const dashboardData: EntityDashboardData = {
        topEntities: topEntities.map((row: any) => ({
          entityName: row.entity_name,
          entityType: row.entity_type,
          mentionCount: row.mention_count,
          sentiment: row.avg_sentiment,
          trendScore: Math.random() * 100 // Placeholder for now
        })),
        entityTypes: entityTypeCounts,
        sentimentDistribution: sentimentCounts,
        trendingEntities: topEntities.slice(0, 10).map((row: any) => ({
          entityName: row.entity_name,
          mentionCount: row.mention_count,
          trendDirection: 'stable' as const // Placeholder for now
        })),
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
      const analytics: EntityAnalytics = {
        entityName: entityData.entity_name,
        entityType: entityData.entity_type,
        totalMentions: parseInt(entityData.total_mentions),
        averageSentiment: parseFloat(entityData.average_sentiment) || 0,
        mentionTrend: 'stable', // Placeholder
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

  // Get entity insights (placeholder for now)
  getEntityInsights = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // const { entityName } = req.params; // Unused for now in placeholder implementation

      // This is a placeholder implementation
      // In a real implementation, this would use AI to generate insights
      const insights = [
        {
          type: 'trend',
          title: 'Trending Analysis',
          description: 'This entity has been mentioned more frequently in recent days',
          confidence: 0.7,
          timeframe: '7 days'
        },
        {
          type: 'sentiment',
          title: 'Sentiment Shift',
          description: 'Overall sentiment appears stable with slight positive bias',
          confidence: 0.6,
          timeframe: '30 days'
        }
      ];

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