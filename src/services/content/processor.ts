import { supabase } from '../database/client';
import { logger } from '@/utils/logger';
import { OpenAI } from 'openai';
import config from '@/config';
import { cacheService } from '../database/cache';

interface RawFeed {
  id: string;
  source_id: string;
  title: string;
  description: string;
  content: string;
  published_at: string;
  metadata: any;
}

interface ProcessedContent {
  raw_feed_id: string;
  processed_text: string;
  key_topics: string[];
  sentiment_score: number;
  entities: Array<{
    name: string;
    type: string;
    metadata?: Record<string, any>;
  }>;
  summary: string;
  processing_metadata: any;
}

export class ContentProcessor {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  async processContent(rawFeedId: string): Promise<void> {
    try {
      logger.info('Processing content', { rawFeedId });

      // Get raw feed
      const { data: rawFeed, error } = await supabase
        .from('raw_feeds')
        .select('*')
        .eq('id', rawFeedId)
        .single();

      if (error || !rawFeed) {
        throw new Error(`Raw feed not found: ${rawFeedId}`);
      }

      // Check if already processed
      const { data: existing } = await supabase
        .from('processed_content')
        .select('id')
        .eq('raw_feed_id', rawFeedId)
        .single();

      if (existing) {
        logger.info('Content already processed, updating...', { rawFeedId });
        // Delete existing processed content to allow reprocessing
        await supabase
          .from('processed_content')
          .delete()
          .eq('raw_feed_id', rawFeedId);
      }

      // Update status to processing
      await supabase
        .from('raw_feeds')
        .update({ processing_status: 'processing' })
        .eq('id', rawFeedId);

      // Process content
      const processed = await this.analyze(rawFeed);

      // Save processed content
      const { error: insertError } = await supabase
        .from('processed_content')
        .insert({
          raw_feed_id: rawFeedId,
          processed_text: processed.processed_text,
          key_topics: processed.key_topics,
          sentiment_score: processed.sentiment_score,
          entities: processed.entities,
          summary: processed.summary,
          processing_metadata: processed.processing_metadata
        });

      if (insertError) throw insertError;

      // Update status to completed
      await supabase
        .from('raw_feeds')
        .update({ processing_status: 'completed' })
        .eq('id', rawFeedId);

      logger.info('Content processing completed', { rawFeedId });

      // SMART DEPENDENCY TRIGGER: Check if we should queue analysis/predictions
      await this.checkAndTriggerDownstreamJobs();
    } catch (error) {
      logger.error('Content processing failed', { rawFeedId, error });
      
      // Update status to failed
      await supabase
        .from('raw_feeds')
        .update({ processing_status: 'failed' })
        .eq('id', rawFeedId);
      
      throw error;
    }
  }

  private async analyze(rawFeed: RawFeed): Promise<ProcessedContent> {
    const startTime = Date.now();
    
    // Combine title, description, and content for analysis
    const fullText = `${rawFeed.title}\n\n${rawFeed.description}\n\n${rawFeed.content}`;
    
    // Clean and prepare text
    const processedText = this.cleanText(fullText);
    
    // Get cached analysis if available
    const cacheKey = `content_analysis:${rawFeed.id}`;
    const cached = await cacheService.get<ProcessedContent>(cacheKey);
    if (cached) {
      logger.info('Using cached analysis', { feedId: rawFeed.id });
      return cached;
    }

    // Extract entities and topics using AI
    let entities: Array<{ name: string; type: string; metadata?: Record<string, any> }> = [];
    let keyTopics: string[] = [];
    let summary = '';
    let sentimentScore = 0;

    if (this.openai) {
      try {
        // Use GPT-4 for comprehensive analysis
        const completion = await this.openai.chat.completions.create({
          model: config.openai.model,
          messages: [
            {
              role: 'system',
              content: `You are a financial content analyst. Analyze the following content and extract entities with PRECISE categorization.

IMPORTANT: Create a flexible entity structure where each entity has:
- name: The entity name
- type: The category (company, person, exchange, index, etc.)
- metadata: Additional context (role, ticker, description, etc.)

Categories to identify:
- company: Actual businesses that produce goods/services (NOT exchanges or indexes)
- person: People mentioned with their roles if available
- location: Geographic locations (countries, cities, regions)
- exchange: Stock exchanges (NYSE, Nasdaq, etc.)
- index: Market indexes (S&P 500, Dow Jones, etc.)
- instrument: Financial instruments (bonds, commodities, currencies)
- media: Media outlets, shows, publications
- temporal: Time references (dates, quarters, days of week)
- event: Specific events mentioned (earnings calls, meetings, etc.)

Also extract:
1. Key financial topics and themes
2. Overall sentiment (-1 to 1)
3. A concise summary (max 3 sentences)

Format your response as JSON:
{
  "topics": ["earnings", "market volatility", ...],
  "entities": [
    {
      "name": "Apple Inc.",
      "type": "company",
      "metadata": {
        "ticker": "AAPL",
        "sector": "Technology"
      }
    },
    {
      "name": "Tim Cook",
      "type": "person",
      "metadata": {
        "role": "CEO of Apple",
        "company": "Apple Inc."
      }
    },
    {
      "name": "Nasdaq",
      "type": "exchange",
      "metadata": {
        "fullName": "Nasdaq Stock Market"
      }
    },
    {
      "name": "S&P 500",
      "type": "index",
      "metadata": {
        "description": "Standard & Poor's 500 Index"
      }
    },
    {
      "name": "Power Lunch",
      "type": "media",
      "metadata": {
        "outlet": "CNBC",
        "type": "TV Show"
      }
    }
  ],
  "sentiment": 0.5,
  "summary": "Brief summary..."
}`
            },
            {
              role: 'user',
              content: processedText.substring(0, 8000) // Limit to avoid token limits
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        });

        const messageContent = completion.choices[0]?.message.content;
        const analysis = messageContent ? JSON.parse(messageContent) : {};
        
        keyTopics = analysis.topics || [];
        sentimentScore = analysis.sentiment || 0;
        summary = analysis.summary || this.generateBasicSummary(processedText);
        entities = analysis.entities || [];
        
      } catch (error) {
        logger.error('AI analysis failed, using fallback', { error });
        // Fallback to basic analysis
        keyTopics = this.extractBasicTopics(processedText);
        entities = this.extractBasicEntities(processedText);
        sentimentScore = this.calculateBasicSentiment(processedText);
        summary = this.generateBasicSummary(processedText);
      }
    } else {
      // No AI available, use basic analysis
      keyTopics = this.extractBasicTopics(processedText);
      entities = this.extractBasicEntities(processedText);
      sentimentScore = this.calculateBasicSentiment(processedText);
      summary = this.generateBasicSummary(processedText);
    }

    const result: ProcessedContent = {
      raw_feed_id: rawFeed.id,
      processed_text: processedText,
      key_topics: keyTopics,
      sentiment_score: sentimentScore,
      entities,
      summary,
      processing_metadata: {
        processingTime: Date.now() - startTime,
        textLength: processedText.length,
        aiModel: this.openai ? config.openai.model : 'basic',
        version: '1.0.0'
      }
    };

    // Cache the result
    await cacheService.set(cacheKey, result, 24 * 60 * 60); // 24 hours

    return result;
  }

  private cleanText(text: string): string {
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Remove URLs (optional, depending on use case)
    // cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
    
    return cleaned;
  }

  private extractBasicTopics(text: string): string[] {
    const topics: string[] = [];
    const lowercased = text.toLowerCase();
    
    // Financial keywords
    const keywords = [
      'earnings', 'revenue', 'profit', 'loss', 'growth', 'decline',
      'market', 'stock', 'bond', 'commodity', 'crypto', 'bitcoin',
      'inflation', 'recession', 'economy', 'gdp', 'unemployment',
      'merger', 'acquisition', 'ipo', 'dividend', 'buyback',
      'federal reserve', 'interest rate', 'monetary policy'
    ];
    
    keywords.forEach(keyword => {
      if (lowercased.includes(keyword)) {
        topics.push(keyword);
      }
    });
    
    return [...new Set(topics)].slice(0, 10); // Return unique topics, max 10
  }

  private extractBasicEntities(text: string): Array<{ name: string; type: string; metadata?: Record<string, any> }> {
    const entities: Array<{ name: string; type: string; metadata?: Record<string, any> }> = [];
    const seen = new Set<string>();
    
    // Extract known exchanges
    const knownExchanges = ['NYSE', 'Nasdaq', 'NASDAQ'];
    knownExchanges.forEach(exchange => {
      if (text.includes(exchange) && !seen.has(exchange)) {
        entities.push({ name: exchange, type: 'exchange' });
        seen.add(exchange);
      }
    });
    
    // Extract known indexes
    const knownIndexes = ['S&P 500', 'Dow Jones', 'Russell 2000'];
    knownIndexes.forEach(index => {
      if (text.includes(index) && !seen.has(index)) {
        entities.push({ name: index, type: 'index' });
        seen.add(index);
      }
    });
    
    // Extract stock tickers (basic pattern)
    const tickerPattern = /\b[A-Z]{2,5}\b/g;
    const tickers = text.match(tickerPattern) || [];
    [...new Set(tickers)].slice(0, 10).forEach(ticker => {
      if (!seen.has(ticker) && !knownExchanges.includes(ticker)) {
        entities.push({ 
          name: ticker, 
          type: 'company',
          metadata: { ticker: ticker }
        });
        seen.add(ticker);
      }
    });
    
    return entities;
  }

  private calculateBasicSentiment(text: string): number {
    const positive = [
      'growth', 'profit', 'gain', 'surge', 'rally', 'boom', 'success',
      'positive', 'strong', 'improve', 'rise', 'up', 'high', 'beat'
    ];
    
    const negative = [
      'loss', 'decline', 'fall', 'crash', 'recession', 'weak', 'down',
      'negative', 'poor', 'miss', 'drop', 'low', 'concern', 'risk'
    ];
    
    const lowercased = text.toLowerCase();
    let score = 0;
    
    positive.forEach(word => {
      const count = (lowercased.match(new RegExp(word, 'g')) || []).length;
      score += count * 0.1;
    });
    
    negative.forEach(word => {
      const count = (lowercased.match(new RegExp(word, 'g')) || []).length;
      score -= count * 0.1;
    });
    
    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score));
  }

  private generateBasicSummary(text: string): string {
    // Take first 500 characters and clean up
    const sentences = text.split(/[.!?]+/);
    const summary = sentences
      .slice(0, 3)
      .join('. ')
      .trim();
    
    return summary.length > 300 
      ? summary.substring(0, 297) + '...'
      : summary;
  }

  /**
   * Smart dependency trigger - checks if we should queue analysis/predictions
   * after content processing completes
   */
  private async checkAndTriggerDownstreamJobs(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHour = now.getUTCHours();

      // Check if daily analysis exists for today
      const { data: existingAnalysis } = await supabase
        .from('daily_analysis')
        .select('id, created_at')
        .eq('analysis_date', today)
        .single();

      // Count processed content from last 6 hours (significant new content threshold)
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const { data: recentContent, error: countError } = await supabase
        .from('processed_content')
        .select('id')
        .gte('created_at', sixHoursAgo);

      if (countError) {
        logger.error('Failed to count recent content', { error: countError });
        return;
      }

      const recentContentCount = recentContent?.length || 0;
      logger.info('Dependency check', { 
        today, 
        currentHour, 
        recentContentCount, 
        hasExistingAnalysis: !!existingAnalysis 
      });

      // TRIGGER CONDITIONS for daily analysis:
      const shouldTriggerAnalysis = (
        // 1. No analysis exists for today AND we have enough content (5+ items)
        (!existingAnalysis && recentContentCount >= 5) ||
        
        // 2. Analysis exists but is old (6+ hours) AND we have new content (3+ items)
        (existingAnalysis && 
         new Date(existingAnalysis.created_at).getTime() < Date.now() - 6 * 60 * 60 * 1000 &&
         recentContentCount >= 3) ||
         
        // 3. It's past 6 AM UTC (scheduled time) and no analysis exists
        (currentHour >= 6 && !existingAnalysis) ||
        
        // 4. It's past 2 PM UTC (afternoon update) and analysis is old
        (currentHour >= 14 && existingAnalysis &&
         new Date(existingAnalysis.created_at).getTime() < Date.now() - 8 * 60 * 60 * 1000)
      );

      if (shouldTriggerAnalysis) {
        // Check if analysis job is already queued to avoid duplicates
        const { data: existingJobs } = await supabase
          .from('job_queue')
          .select('id')
          .eq('job_type', 'daily_analysis')
          .in('status', ['pending', 'processing', 'retry'])
          .contains('payload', { date: today });

        if (!existingJobs || existingJobs.length === 0) {
          // Queue daily analysis job
          const { queueService } = await import('../queue/queue.service');
          const analysisJobId = await queueService.enqueue('daily_analysis', {
            date: today,
            forceRegenerate: !!existingAnalysis,
            source: 'content_dependency_trigger',
            contentCount: recentContentCount
          }, 1); // High priority

          logger.info('🧠 Queued daily analysis job from content dependency trigger', {
            today,
            analysisJobId,
            recentContentCount,
            hasExistingAnalysis: !!existingAnalysis
          });

          // Also queue prediction generation with delay
          const predictionJobId = await queueService.enqueue('generate_predictions', {
            analysisDate: today,
            source: 'content_dependency_trigger'
          }, 2, 600); // Medium priority, 10 minute delay

          logger.info('🔮 Queued prediction generation job from content dependency trigger', {
            today,
            predictionJobId
          });
        } else {
          logger.info('Daily analysis job already queued, skipping', { today });
        }
      } else {
        logger.debug('Dependency trigger conditions not met', {
          recentContentCount,
          hasExistingAnalysis: !!existingAnalysis,
          currentHour
        });
      }

    } catch (error) {
      logger.error('Failed to check downstream job dependencies', { error });
      // Don't throw - this is a background operation that shouldn't fail content processing
    }
  }
}

export const contentProcessor = new ContentProcessor();