import { Request, Response } from 'express';
import { logger } from '@/utils/logger';

export class EntityAnalyticsMockController {
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          topEntities: [
            { entityName: 'NPR', entityType: 'ticker', mentionCount: 13, sentiment: 0.2, trendScore: 0.7 },
            { entityName: 'USA', entityType: 'ticker', mentionCount: 12, sentiment: 0.3, trendScore: 0.8 },
            { entityName: 'KSS', entityType: 'company', mentionCount: 8, sentiment: -0.1, trendScore: 0.6 },
            { entityName: 'OPEN', entityType: 'company', mentionCount: 7, sentiment: 0.4, trendScore: 0.9 },
            { entityName: 'YOLO', entityType: 'company', mentionCount: 4, sentiment: 0.8, trendScore: 0.85 },
            { entityName: 'NYSE', entityType: 'exchange', mentionCount: 1, sentiment: 0.0, trendScore: 0.5 },
            { entityName: 'GDP', entityType: 'indicator', mentionCount: 1, sentiment: -0.2, trendScore: 0.4 },
            { entityName: 'Inflation', entityType: 'indicator', mentionCount: 1, sentiment: -0.5, trendScore: 0.9 }
          ],
          entityTypes: { company: 224, ticker: 20, exchange: 1, indicator: 3, sectors: 2 },
          sentimentDistribution: { positive: 245, negative: 85, neutral: 325 },
          trendingEntities: [
            { entityName: 'OPEN', mentionCount: 7, trendDirection: 'up' },
            { entityName: 'YOLO', mentionCount: 4, trendDirection: 'up' },
            { entityName: 'KSS', mentionCount: 8, trendDirection: 'down' },
            { entityName: 'AI', mentionCount: 3, trendDirection: 'up' },
            { entityName: 'Inflation', mentionCount: 1, trendDirection: 'up' }
          ],
          timeRange: { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() }
        }
      });
    } catch (error) {
      logger.error('Entity analytics dashboard error', { error });
      res.status(500).json({ error: 'Failed to fetch entity analytics' });
    }
  }

  async getEntityAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { entityName } = req.params;
      
      // Mock data based on real entities in our database
      const mockData: Record<string, any> = {
        'NPR': {
          entityName: 'NPR',
          entityType: 'ticker',
          totalMentions: 13,
          overallSentiment: 0.2,
          sentimentTrend: 'stable',
          trendingScore: 75,
          weeklyChange: 0.1,
          monthlyChange: 0.05,
          firstMentioned: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          lastMentioned: new Date(),
          topSources: [
            { sourceName: 'NPR Planet Money', mentionCount: 8, averageSentiment: 0.25 },
            { sourceName: 'The Indicator from Planet Money', mentionCount: 5, averageSentiment: 0.15 }
          ],
          relatedEntities: [
            { entityName: 'NPR', entityType: 'company', correlationScore: 0.9 },
            { entityName: 'Podcast', entityType: 'topic', correlationScore: 0.7 }
          ],
          historicalMentions: [
            { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), mentionCount: 2, sentiment: 0.1 },
            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), mentionCount: 2, sentiment: 0.2 },
            { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), mentionCount: 3, sentiment: 0.3 },
            { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), mentionCount: 2, sentiment: 0.15 },
            { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), mentionCount: 2, sentiment: 0.2 },
            { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), mentionCount: 2, sentiment: 0.25 }
          ]
        },
        'KSS': {
          entityName: 'KSS',
          entityType: 'company',
          totalMentions: 8,
          averageSentiment: -0.1,
          mentionTrend: 'down',
          lastMentionDate: new Date().toISOString(),
          sources: ['r/wallstreetbets (Reddit)', 'CNBC Mad Money'],
          historicalMentions: [
            { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), count: 2, sentiment: 0.2 },
            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), count: 3, sentiment: 0.1 },
            { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: -0.3 },
            { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: -0.4 },
            { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: -0.5 },
            { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 }
          ]
        },
        'OPEN': {
          entityName: 'OPEN',
          entityType: 'company',
          totalMentions: 7,
          averageSentiment: 0.4,
          mentionTrend: 'up',
          lastMentionDate: new Date().toISOString(),
          sources: ['r/wallstreetbets (Reddit)', 'CNBC Squawk on the Street'],
          historicalMentions: [
            { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 },
            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.2 },
            { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.3 },
            { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), count: 2, sentiment: 0.4 },
            { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), count: 2, sentiment: 0.5 },
            { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.6 }
          ]
        },
        'YOLO': {
          entityName: 'YOLO',
          entityType: 'company',
          totalMentions: 4,
          averageSentiment: 0.8,
          mentionTrend: 'up',
          lastMentionDate: new Date().toISOString(),
          sources: ['r/wallstreetbets (Reddit)'],
          historicalMentions: [
            { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 },
            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 },
            { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.7 },
            { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.8 },
            { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.85 },
            { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.9 }
          ]
        },
        'AI': {
          entityName: 'AI',
          entityType: 'ticker',
          totalMentions: 3,
          averageSentiment: 0.6,
          mentionTrend: 'up',
          lastMentionDate: new Date().toISOString(),
          sources: ['CNBC', 'Forbes', 'WSJ'],
          historicalMentions: [
            { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 },
            { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 },
            { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.5 },
            { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), count: 0, sentiment: 0 },
            { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.6 },
            { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), count: 1, sentiment: 0.7 }
          ]
        }
      };

      const data = mockData[entityName as string] || {
        entityName,
        entityType: 'unknown',
        totalMentions: 0,
        overallSentiment: 0,
        sentimentTrend: 'stable',
        trendingScore: 0,
        weeklyChange: 0,
        monthlyChange: 0,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        topSources: [],
        relatedEntities: [],
        historicalMentions: []
      };

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Entity analytics error', { error });
      res.status(500).json({ error: 'Failed to fetch entity analytics' });
    }
  }

  async getTrendingEntities(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          trending: [
            { entityName: 'OPEN', mentionCount: 7, trendDirection: 'up', changePercent: 175 },
            { entityName: 'YOLO', mentionCount: 4, trendDirection: 'up', changePercent: 300 },
            { entityName: 'AI', mentionCount: 3, trendDirection: 'up', changePercent: 200 },
            { entityName: 'KSS', mentionCount: 8, trendDirection: 'down', changePercent: -38 },
            { entityName: 'Inflation', mentionCount: 1, trendDirection: 'up', changePercent: 100 },
            { entityName: 'MLB', mentionCount: 3, trendDirection: 'stable', changePercent: 0 },
            { entityName: 'NATO', mentionCount: 3, trendDirection: 'up', changePercent: 50 },
            { entityName: 'COVID', mentionCount: 3, trendDirection: 'down', changePercent: -25 }
          ]
        }
      });
    } catch (error) {
      logger.error('Trending entities error', { error });
      res.status(500).json({ error: 'Failed to fetch trending entities' });
    }
  }

  async compareEntities(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { comparison: [] } });
  }

  async getEntityMentions(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { mentions: [] } });
  }

  async getEntityInsights(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: { insights: [] } });
  }

  async searchEntities(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, limit = 10 } = req.query;

      if (!query) {
        res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
        return;
      }

      // Mock search results based on available entities
      const allEntities = [
        { entityName: 'NPR', entityType: 'ticker', mentionCount: 13, recentSentiment: 0.2 },
        { entityName: 'USA', entityType: 'ticker', mentionCount: 12, recentSentiment: 0.3 },
        { entityName: 'KSS', entityType: 'company', mentionCount: 8, recentSentiment: -0.1 },
        { entityName: 'OPEN', entityType: 'company', mentionCount: 7, recentSentiment: 0.4 },
        { entityName: 'YOLO', entityType: 'company', mentionCount: 4, recentSentiment: 0.8 },
        { entityName: 'NYSE', entityType: 'exchange', mentionCount: 1, recentSentiment: 0.0 },
        { entityName: 'GDP', entityType: 'indicator', mentionCount: 1, recentSentiment: -0.2 },
        { entityName: 'Inflation', entityType: 'indicator', mentionCount: 1, recentSentiment: -0.5 },
        { entityName: 'AI', entityType: 'ticker', mentionCount: 3, recentSentiment: 0.6 },
        { entityName: 'Tesla', entityType: 'company', mentionCount: 15, recentSentiment: 0.5 },
        { entityName: 'Apple', entityType: 'company', mentionCount: 22, recentSentiment: 0.3 },
        { entityName: 'Microsoft', entityType: 'company', mentionCount: 18, recentSentiment: 0.4 },
        { entityName: 'Amazon', entityType: 'company', mentionCount: 14, recentSentiment: 0.2 },
        { entityName: 'Google', entityType: 'company', mentionCount: 20, recentSentiment: 0.1 },
        { entityName: 'Meta', entityType: 'company', mentionCount: 11, recentSentiment: -0.1 },
        { entityName: 'Bitcoin', entityType: 'crypto', mentionCount: 25, recentSentiment: 0.6 },
        { entityName: 'Ethereum', entityType: 'crypto', mentionCount: 19, recentSentiment: 0.4 },
        { entityName: 'Federal Reserve', entityType: 'institution', mentionCount: 8, recentSentiment: -0.2 },
        { entityName: 'China', entityType: 'country', mentionCount: 12, recentSentiment: -0.3 },
        { entityName: 'Europe', entityType: 'region', mentionCount: 9, recentSentiment: 0.1 }
      ];

      // Filter entities that match the search query
      const searchResults = allEntities
        .filter(entity => 
          entity.entityName.toLowerCase().includes((query as string).toLowerCase())
        )
        .slice(0, parseInt(limit as string))
        .sort((a, b) => b.mentionCount - a.mentionCount); // Sort by mention count

      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      logger.error('Entity search error', { error });
      res.status(500).json({ error: 'Failed to search entities' });
    }
  }
}

export const entityAnalyticsController = new EntityAnalyticsMockController();