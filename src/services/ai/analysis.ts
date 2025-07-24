import { supabase } from '../database/client';
import { logger } from '@/utils/logger';
import { OpenAI } from 'openai';
import config from '@/config';
import { cacheService } from '../database/cache';
import { queueService } from '../database/queue';

interface ProcessedContent {
  id: string;
  raw_feed_id: string;
  summary: string;
  sentiment_score: number;
  key_topics: string[];
  entities: any;
  created_at: string;
}

interface DailyAnalysis {
  analysis_date: string;
  market_sentiment: 'bullish' | 'bearish' | 'neutral';
  key_themes: string[];
  overall_summary: string;
  ai_analysis: {
    market_drivers: string[];
    risk_factors: string[];
    opportunities: string[];
    geopolitical_context: string;
    economic_indicators: string[];
  };
  confidence_score: number;
  sources_analyzed: number;
}

export class AIAnalysisService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  async runDailyAnalysis(date: Date = new Date(), forceRegenerate: boolean = false): Promise<void> {
    try {
      const analysisDate: string = date.toISOString().split('T')[0]!;
      const analysisHour = date.getHours();
      logger.info('Running analysis', { date: analysisDate, hour: analysisHour, forceRegenerate });

      // For 4-hourly analysis, check if we already have analysis in the last 3 hours
      const threeHoursAgo = new Date(date.getTime() - 3 * 60 * 60 * 1000);
      
      if (!forceRegenerate) {
        const { data: recentAnalysis } = await supabase
          .from('daily_analysis')
          .select('id, created_at')
          .eq('analysis_date', analysisDate)
          .gte('created_at', threeHoursAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (recentAnalysis) {
          logger.info('Recent analysis exists, skipping', { 
            date: analysisDate, 
            lastAnalysis: recentAnalysis.created_at 
          });
          return;
        }
      }

      // Get recent processed content (last 6 hours for 4-hourly analysis)
      const sixHoursAgo = new Date(date.getTime() - 6 * 60 * 60 * 1000);
      
      const { data: processedContent, error } = await supabase
        .from('processed_content')
        .select('*')
        .gte('created_at', sixHoursAgo.toISOString())
        .lte('created_at', date.toISOString())
        .order('created_at', { ascending: false })
        .limit(50); // Limit to most recent 50 items for performance

      if (error) throw error;

      if (!processedContent || processedContent.length === 0) {
        logger.warn('No processed content found for daily analysis', { date: analysisDate });
        return;
      }

      logger.info('Found processed content for analysis', { 
        date: analysisDate, 
        count: processedContent.length 
      });

      // Generate analysis
      const analysis = await this.generateAnalysis(processedContent, analysisDate);

      // Save analysis (upsert to handle both insert and update)
      const analysisData = {
        analysis_date: analysisDate,
        market_sentiment: analysis.market_sentiment,
        key_themes: analysis.key_themes,
        overall_summary: analysis.overall_summary,
        ai_analysis: analysis.ai_analysis,
        confidence_score: analysis.confidence_score,
        sources_analyzed: analysis.sources_analyzed
      };

      const { data: savedAnalysis, error: upsertError } = await supabase
        .from('daily_analysis')
        .upsert(analysisData, { 
          onConflict: 'analysis_date',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (upsertError) throw upsertError;

      logger.info('Daily analysis saved', { 
        date: analysisDate, 
        isUpdate: !!existing,
        sourcesAnalyzed: analysis.sources_analyzed,
        analysisId: savedAnalysis.id
      });

      // Clear related caches
      await cacheService.delete(`daily_analysis:${analysisDate}`);
      await cacheService.delete('dashboard:overview');
      await cacheService.delete('dashboard:trends:7');

      logger.info('Daily analysis completed', { date: analysisDate });

      // Queue prediction generation with correct analysis ID
      const predictionJobId = await queueService.enqueue('generate_predictions', {
        analysisDate,
        analysisId: savedAnalysis.id
      }, 2);
      
      logger.info('Prediction generation queued after analysis completion', { 
        analysisDate, 
        analysisId: savedAnalysis.id,
        predictionJobId 
      });

    } catch (error) {
      logger.error('Daily analysis failed', { error });
      throw error;
    }
  }

  private async generateAnalysis(
    content: ProcessedContent[], 
    analysisDate: string
  ): Promise<DailyAnalysis> {
    // Cache key for analysis
    const cacheKey = `daily_analysis:${analysisDate}`;
    const cached = await cacheService.get<DailyAnalysis>(cacheKey);
    if (cached) {
      logger.info('Using cached daily analysis', { date: analysisDate });
      return cached;
    }

    // Get source information for each content item
    const sourceIds = new Set<string>();
    const sourceBreakdown: Record<string, number> = {};
    
    // We need to get the source information from raw_feeds
    for (const item of content) {
      try {
        const { data: rawFeed } = await supabase
          .from('raw_feeds')
          .select('source_id, feed_sources!inner(id, name, type)')
          .eq('id', item.raw_feed_id)
          .single();
        
        if (rawFeed && rawFeed.source_id) {
          sourceIds.add(rawFeed.source_id);
          const sourceName = rawFeed.feed_sources?.name || 'Unknown';
          sourceBreakdown[sourceName] = (sourceBreakdown[sourceName] || 0) + 1;
        }
      } catch (error) {
        logger.warn('Failed to get source info for content', { contentId: item.id, error });
      }
    }

    // Aggregate sentiment
    const avgSentiment = content.reduce((sum, item) => sum + item.sentiment_score, 0) / content.length;
    const marketSentiment = avgSentiment > 0.2 ? 'bullish' : avgSentiment < -0.2 ? 'bearish' : 'neutral';

    // Aggregate topics
    const topicCounts = new Map<string, number>();
    content.forEach(item => {
      item.key_topics.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    // Get top themes
    const keyThemes = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    // Use AI for comprehensive analysis
    let aiAnalysis = {
      market_drivers: [],
      risk_factors: [],
      opportunities: [],
      geopolitical_context: '',
      economic_indicators: [],
      source_ids: Array.from(sourceIds),
      sources: Object.entries(sourceBreakdown).map(([name, count]) => ({ name, count })),
      source_breakdown: sourceBreakdown
    };
    let overallSummary = '';
    let confidenceScore = 0.7;

    if (this.openai) {
      try {
        // Prepare content summaries for AI
        const contentSummaries = content
          .slice(0, 10000) // Limit to avoid token limits
          .map(item => ({
            source: 'Unknown', // Source would need to be joined from raw_feeds table
            summary: item.summary,
            sentiment: item.sentiment_score,
            topics: item.key_topics
          }));

        const completion = await this.openai.chat.completions.create({
          model: config.openai.model,
          messages: [
            {
              role: 'system',
              content: `You are a world-class market analyst synthesizing information from multiple sources.
Today's date: ${analysisDate}

Analyze the provided content and generate:
1. Overall market sentiment with confidence level
2. Key market drivers (factors pushing markets)
3. Risk factors to monitor
4. Investment opportunities identified
5. Geopolitical context affecting markets
6. Relevant economic indicators mentioned
7. Comprehensive summary (3-5 sentences)

Format your response as JSON with this structure:
{
  "confidence": 0.85,
  "market_drivers": ["driver1", "driver2", ...],
  "risk_factors": ["risk1", "risk2", ...],
  "opportunities": ["opportunity1", "opportunity2", ...],
  "geopolitical_context": "Brief geopolitical summary",
  "economic_indicators": ["indicator1", "indicator2", ...],
  "summary": "Comprehensive market summary..."
}`
            },
            {
              role: 'user',
              content: JSON.stringify({
                date: analysisDate,
                sources_count: content.length,
                avg_sentiment: avgSentiment,
                top_themes: keyThemes,
                content_summaries: contentSummaries
              })
            }
          ],
          response_format: { type: 'json_object' }
        });

        const messageContent = completion.choices[0]?.message.content;
        const response = messageContent ? JSON.parse(messageContent) : {};
        
        aiAnalysis = {
          market_drivers: response.market_drivers || [],
          risk_factors: response.risk_factors || [],
          opportunities: response.opportunities || [],
          geopolitical_context: response.geopolitical_context || '',
          economic_indicators: response.economic_indicators || [],
          source_ids: Array.from(sourceIds),
          sources: Object.entries(sourceBreakdown).map(([name, count]) => ({ name, count })),
          source_breakdown: sourceBreakdown
        };
        overallSummary = response.summary || this.generateBasicSummary(content);
        confidenceScore = response.confidence || 0.7;

      } catch (error) {
        logger.error('AI analysis generation failed', { error });
        overallSummary = this.generateBasicSummary(content);
      }
    } else {
      overallSummary = this.generateBasicSummary(content);
    }

    const analysis: DailyAnalysis = {
      analysis_date: analysisDate,
      market_sentiment: marketSentiment,
      key_themes: keyThemes,
      overall_summary: overallSummary,
      ai_analysis: aiAnalysis,
      confidence_score: confidenceScore,
      sources_analyzed: content.length
    };

    // Cache the result
    await cacheService.set(cacheKey, analysis, 24 * 60 * 60); // 24 hours

    return analysis;
  }

  private generateBasicSummary(content: ProcessedContent[]): string {
    const topSources = content.slice(0, 5);
    const summaries = topSources.map(item => item.summary).join(' ');
    
    const sentences = summaries.split(/[.!?]+/).slice(0, 5);
    return sentences.join('. ').trim() + '.';
  }

  async generatePredictions(analysisDate: string): Promise<void> {
    try {
      logger.info('Generating predictions', { analysisDate });

      // Get the daily analysis
      const { data: analysis, error } = await supabase
        .from('daily_analysis')
        .select('*')
        .eq('analysis_date', analysisDate)
        .single();

      if (error || !analysis) {
        throw new Error(`Daily analysis not found for ${analysisDate}`);
      }

      // Clear existing predictions for this analysis to avoid duplicates
      const { error: deleteError } = await supabase
        .from('predictions')
        .delete()
        .eq('daily_analysis_id', analysis.id);

      if (deleteError) {
        logger.warn('Failed to clear existing predictions', { deleteError, analysisId: analysis.id });
      } else {
        logger.info('Cleared existing predictions for analysis', { analysisId: analysis.id });
      }

      if (!this.openai) {
        logger.warn('OpenAI not configured, skipping prediction generation');
        return;
      }

      // Generate predictions for different time horizons
      const timeHorizons = ['1_week', '1_month', '3_months', '6_months', '1_year'];
      const predictionTypes = ['market_direction', 'economic_indicator', 'geopolitical_event'];

      for (const horizon of timeHorizons) {
        for (const type of predictionTypes) {
          try {
            const prediction = await this.generatePrediction(analysis, horizon, type);
            
            // Save prediction
            await supabase
              .from('predictions')
              .insert({
                daily_analysis_id: analysis.id,
                prediction_type: type,
                prediction_text: prediction.text,
                confidence_level: prediction.confidence,
                time_horizon: horizon,
                prediction_data: prediction.data
              });

          } catch (error) {
            logger.error('Failed to generate prediction', { 
              analysisDate, 
              horizon, 
              type, 
              error 
            });
          }
        }
      }

      logger.info('Predictions generated successfully', { analysisDate });

    } catch (error) {
      logger.error('Prediction generation failed', { error });
      throw error;
    }
  }

  private async generatePrediction(
    analysis: DailyAnalysis,
    horizon: string,
    type: string
  ): Promise<{ text: string; confidence: number; data: any }> {
    const horizonText = horizon.replace('_', ' ');

    const completion = await this.openai!.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: `You are a market prediction expert. Based on the daily analysis provided, generate a specific prediction for the ${horizonText} time horizon.

Prediction type: ${type}

Format your response as JSON:
{
  "prediction": "Specific prediction statement",
  "confidence": 0.75,
  "reasoning": "Brief explanation",
  "key_factors": ["factor1", "factor2"],
  "measurable_outcome": "What specific outcome to measure"
}`
        },
        {
          role: 'user',
          content: JSON.stringify({
            analysis_date: analysis.analysis_date,
            market_sentiment: analysis.market_sentiment,
            key_themes: analysis.key_themes,
            summary: analysis.overall_summary,
            ai_analysis: analysis.ai_analysis
          })
        }
      ],
      response_format: { type: 'json_object' }
    });

    const messageContent = completion.choices[0]?.message.content;
    const response = messageContent ? JSON.parse(messageContent) : {};

    return {
      text: response.prediction || 'Unable to generate prediction',
      confidence: response.confidence || 0.5,
      data: {
        reasoning: response.reasoning,
        key_factors: response.key_factors,
        measurable_outcome: response.measurable_outcome
      }
    };
  }
}

export const aiAnalysisService = new AIAnalysisService();