import { db } from '../database';
import { OpenAI } from 'openai';
import config from '../../config';
import { createContextLogger } from '../../utils/logger';
import { createTimeframeAnalysisPrompt } from './enhanced-prompts';

const logger = createContextLogger('SimpleTimeframeAnalysis');

export type TimeframeType = 'daily' | 'weekly' | 'monthly';

export interface TimeframeBounds {
  start: Date;
  end: Date;
  type: TimeframeType;
  period: string;
}

export interface TimeframeAnalysisData {
  id: string;
  timeframe_type: TimeframeType;
  timeframe_start: string;
  timeframe_end: string;
  analysis_date: string;
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  key_themes: string[];
  overall_summary: string;
  ai_analysis: any;
  confidence_score: number;
  sources_analyzed: number;
  content_distribution: any;
  trend_analysis: any;
  comparison_data: any;
  created_at: string;
  updated_at: string;
}

export class SimpleTimeframeAnalysisService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  /**
   * Calculate timeframe boundaries
   */
  public calculateTimeframeBounds(type: TimeframeType, referenceDate: Date = new Date()): TimeframeBounds {
    let start: Date;
    let end: Date;
    let period: string;

    switch (type) {
      case 'weekly':
        const dayOfWeek = referenceDate.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(referenceDate);
        start.setDate(referenceDate.getDate() - daysFromMonday);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        
        period = `Week of ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        break;

      case 'monthly':
        start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        
        period = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;

      case 'daily':
      default:
        start = new Date(referenceDate);
        start.setHours(0, 0, 0, 0);
        
        end = new Date(referenceDate);
        end.setHours(23, 59, 59, 999);
        
        period = start.toLocaleDateString();
        break;
    }

    return { start, end, type, period };
  }

  /**
   * Get processed content for timeframe
   */
  public async getContentForTimeframe(bounds: TimeframeBounds): Promise<any[]> {
    try {
      logger.info('Fetching content for timeframe', {
        type: bounds.type,
        start: bounds.start.toISOString(),
        end: bounds.end.toISOString()
      });

      const client = (db as any).getClient();
      const { data, error } = await client
        .from('processed_content')
        .select(`
          id,
          raw_feed_id,
          processed_text,
          key_topics,
          sentiment_score,
          entities,
          summary,
          created_at,
          raw_feeds!inner(
            source_id,
            feed_sources!inner(
              name,
              type
            )
          )
        `)
        .gte('created_at', bounds.start.toISOString())
        .lte('created_at', bounds.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      const content = (data || []).map((item: any) => ({
        id: item.id,
        raw_feed_id: item.raw_feed_id,
        processed_text: item.processed_text,
        key_topics: item.key_topics || [],
        sentiment_score: item.sentiment_score || 0,
        entities: item.entities || { people: [], tickers: [], companies: [], locations: [] },
        summary: item.summary,
        created_at: item.created_at,
        source_name: item.raw_feeds?.feed_sources?.name,
        source_type: item.raw_feeds?.feed_sources?.type
      }));

      logger.info('Content fetched successfully', {
        count: content.length,
        timeframe: bounds.type
      });

      return content;
    } catch (error) {
      logger.error('Failed to fetch timeframe content', error);
      throw error;
    }
  }

  /**
   * Generate AI analysis for timeframe
   */
  public async generateAIAnalysis(
    content: any[],
    bounds: TimeframeBounds
  ): Promise<any> {
    try {
      logger.info('Generating AI analysis for timeframe', {
        type: bounds.type,
        contentCount: content.length
      });

      if (content.length === 0) {
        return {
          marketDrivers: [],
          riskFactors: [],
          opportunities: [],
          geopoliticalContext: 'No content available for analysis',
          economicIndicators: [],
          trendAnalysis: {
            direction: 'sideways',
            strength: 0.5,
            volatility: 0.5
          },
          timeframeSpecificInsights: []
        };
      }

      // Prepare content summary
      const contentSummary = content.slice(0, 10).map(item => ({
        title: item.summary?.substring(0, 200) || 'No summary available',
        sentiment: item.sentiment_score,
        topics: (item.key_topics || []).slice(0, 5),
        source: item.source_name
      }));

      // Calculate stats
      const stats = {
        bySentiment: {
          positive: content.filter(c => c.sentiment_score > 0.1).length,
          neutral: content.filter(c => Math.abs(c.sentiment_score) <= 0.1).length,
          negative: content.filter(c => c.sentiment_score < -0.1).length
        },
        bySource: content.reduce((acc: any, item) => {
          const source = item.source_name || 'Unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {})
      };

      const prompt = createTimeframeAnalysisPrompt(
        bounds.type,
        bounds.period,
        contentSummary,
        stats,
        content.length
      );

      const response = await this.openai.chat.completions.create({
        model: 'o4-mini',
        messages: [{ role: 'user', content: prompt }],
      });

      const analysisText = response.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('No analysis generated from AI');
      }

      // Try to parse JSON, fallback to simple structure
      try {
        return JSON.parse(analysisText);
      } catch {
        return {
          marketDrivers: ['Market data analyzed'],
          riskFactors: ['Standard market risks'],
          opportunities: ['Market opportunities identified'],
          geopoliticalContext: analysisText.substring(0, 500),
          economicIndicators: ['Various economic factors'],
          trendAnalysis: {
            direction: 'sideways',
            strength: 0.5,
            volatility: 0.5
          },
          timeframeSpecificInsights: [analysisText.substring(0, 200)]
        };
      }
    } catch (error) {
      logger.error('Failed to generate AI analysis', error);
      throw error;
    }
  }

  /**
   * Generate complete timeframe analysis
   */
  public async generateCompleteTimeframeAnalysis(
    type: TimeframeType,
    referenceDate: Date = new Date()
  ): Promise<TimeframeAnalysisData> {
    try {
      logger.info('Starting complete timeframe analysis generation', {
        type,
        referenceDate: referenceDate.toISOString()
      });

      // Calculate boundaries
      const bounds = this.calculateTimeframeBounds(type, referenceDate);

      // Check if analysis already exists
      const client = (db as any).getClient();
      const { data: existingAnalysis } = await client
        .from('timeframe_analysis')
        .select('*')
        .eq('timeframe_type', type)
        .eq('timeframe_start', bounds.start.toISOString().split('T')[0])
        .eq('timeframe_end', bounds.end.toISOString().split('T')[0])
        .single();

      if (existingAnalysis) {
        logger.info('Analysis already exists for this timeframe', {
          id: existingAnalysis.id,
          type
        });
        return existingAnalysis;
      }

      // Get content
      const content = await this.getContentForTimeframe(bounds);

      if (content.length === 0) {
        throw new Error(`No content available for ${type} analysis from ${bounds.start.toDateString()} to ${bounds.end.toDateString()}`);
      }

      // Generate AI analysis
      const aiAnalysis = await this.generateAIAnalysis(content, bounds);

      // Calculate sentiment
      const avgSentiment = content.reduce((sum, item) => sum + item.sentiment_score, 0) / content.length;
      const marketSentiment: 'bullish' | 'bearish' | 'neutral' = 
        avgSentiment > 0.1 ? 'bullish' : 
        avgSentiment < -0.1 ? 'bearish' : 'neutral';

      // Extract key themes
      const allThemes = content.flatMap(item => item.key_topics || []);
      const themeFrequency = allThemes.reduce((freq: any, theme) => {
        freq[theme] = (freq[theme] || 0) + 1;
        return freq;
      }, {});
      
      const keyThemes = Object.entries(themeFrequency)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([theme]) => theme);

      // Generate summary
      const overallSummary = `${type.charAt(0).toUpperCase() + type.slice(1)} analysis for ${bounds.period}: ${marketSentiment} sentiment with ${content.length} sources analyzed. Key themes include ${keyThemes.slice(0, 3).join(', ')}.`;

      // Content distribution
      const contentDistribution = {
        totalContent: content.length,
        bySentiment: {
          positive: content.filter(c => c.sentiment_score > 0.1).length,
          neutral: content.filter(c => Math.abs(c.sentiment_score) <= 0.1).length,
          negative: content.filter(c => c.sentiment_score < -0.1).length
        },
        bySource: content.reduce((acc: any, item) => {
          const source = item.source_name || 'Unknown';
          acc[source] = (acc[source] || 0) + 1;
          return acc;
        }, {}),
        dateRange: {
          start: bounds.start.toISOString().split('T')[0],
          end: bounds.end.toISOString().split('T')[0]
        }
      };

      // Prepare analysis data
      const analysisData = {
        timeframe_type: type,
        timeframe_start: bounds.start.toISOString().split('T')[0],
        timeframe_end: bounds.end.toISOString().split('T')[0],
        analysis_date: new Date().toISOString().split('T')[0],
        market_sentiment: marketSentiment,
        key_themes: keyThemes,
        overall_summary: overallSummary,
        ai_analysis: aiAnalysis,
        confidence_score: Math.min(0.9, content.length / 20),
        sources_analyzed: content.length,
        content_distribution: contentDistribution,
        trend_analysis: {
          comparedToPrevious: {
            sentimentChange: 0,
            volumeChange: 0,
            themeChanges: keyThemes.slice(0, 3)
          }
        },
        comparison_data: {
          changes: {
            sentiment: 'stable' as const,
            volume: 'stable' as const,
            themes: keyThemes.slice(0, 5)
          }
        }
      };

      // Save to database
      const { data: savedAnalysis, error } = await client
        .from('timeframe_analysis')
        .insert(analysisData)
        .select()
        .single();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      logger.info('Complete timeframe analysis generated successfully', {
        id: savedAnalysis.id,
        type,
        sourcesAnalyzed: content.length,
        sentiment: marketSentiment
      });

      return savedAnalysis;
    } catch (error) {
      logger.error('Failed to generate complete timeframe analysis', error);
      throw error;
    }
  }

  /**
   * List timeframe analyses
   */
  public async listTimeframeAnalyses(options: {
    type?: TimeframeType;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<{ data: TimeframeAnalysisData[]; total: number }> {
    try {
      const client = (db as any).getClient();
      let query = client.from('timeframe_analysis').select('*', { count: 'exact' });

      if (options.type) {
        query = query.eq('timeframe_type', options.type);
      }

      if (options.startDate) {
        query = query.gte('timeframe_start', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('timeframe_end', options.endDate);
      }

      query = query.order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return {
        data: data || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('Failed to list timeframe analyses', error);
      throw error;
    }
  }

  /**
   * Get specific timeframe analysis by ID
   */
  public async getTimeframeAnalysis(id: string): Promise<TimeframeAnalysisData | null> {
    try {
      const client = (db as any).getClient();
      const { data, error } = await client
        .from('timeframe_analysis')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      logger.error('Failed to get timeframe analysis', error);
      throw error;
    }
  }
}

export const timeframeAnalysisService = new SimpleTimeframeAnalysisService();