import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface QueueJob {
  id: string;
  job_type: string;
  payload: any;
  priority: number;
  status: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
}

class ScheduledQueueWorker {
  
  /**
   * Process pending jobs from the queue
   */
  async processJobs(maxJobs: number = 5): Promise<{ processed: number; results: any[] }> {
    console.log(`🔄 Starting scheduled queue worker - processing up to ${maxJobs} jobs`);
    
    const results: any[] = [];
    let processed = 0;
    
    // Process jobs one by one to avoid overwhelming the system
    for (let i = 0; i < maxJobs; i++) {
      const job = await this.dequeueJob();
      if (!job) {
        console.log('📭 No more jobs in queue');
        break;
      }
      
      try {
        console.log(`⚡ Processing job ${job.id}: ${job.job_type}`);
        const result = await this.executeJob(job);
        await this.completeJob(job.id, result);
        
        results.push({
          jobId: job.id,
          jobType: job.job_type,
          status: 'completed',
          result
        });
        
        processed++;
        console.log(`✅ Completed job ${job.id}`);
        
      } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);
        await this.failJob(job.id, error instanceof Error ? error.message : String(error));
        
        results.push({
          jobId: job.id,
          jobType: job.job_type,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Small delay between jobs to prevent overwhelming external APIs
      await this.sleep(1000);
    }
    
    console.log(`🏁 Queue worker completed: ${processed} jobs processed`);
    return { processed, results };
  }
  
  /**
   * Get the next job from the queue using production database function (atomic operation)
   */
  private async dequeueJob(): Promise<QueueJob | null> {
    try {
      // Use the same atomic database function as the main application
      const { data, error } = await supabase.rpc('dequeue_job');
      
      if (error) {
        console.error('Error dequeuing job:', error);
        return null;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      const job = data[0];
      return {
        id: job.job_id,
        job_type: job.job_type,
        payload: job.payload,
        priority: job.priority,
        status: 'processing',
        attempts: job.attempts,
        max_attempts: 3,
        created_at: job.created_at || new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error dequeuing job:', error);
      return null;
    }
  }
  
  /**
   * Execute a specific job based on its type
   */
  private async executeJob(job: QueueJob): Promise<any> {
    switch (job.job_type) {
      case 'feed_fetch':
        return await this.processFeedFetch(job.payload);
      
      case 'content_process':
        return await this.processContent(job.payload);
      
      case 'daily_analysis':
        return await this.processDailyAnalysis(job.payload);
      
      case 'generate_predictions':
        return await this.generatePredictions(job.payload);
      
      case 'prediction_compare':
        return await this.comparePredictions(job.payload);
      
      case 'transcribe_audio':
        return await this.transcribeAudio(job.payload);
      
      case 'worker_heartbeat':
        return { message: 'Heartbeat acknowledged', timestamp: new Date().toISOString() };
      
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }

  /**
   * Process feed fetch job
   */
  private async processFeedFetch(payload: any): Promise<any> {
    const sourceId = payload.sourceId;
    if (!sourceId) {
      throw new Error('sourceId is required for feed_fetch job');
    }

    console.log(`📡 Processing feed fetch for source: ${sourceId}`);
    
    // Get feed source details
    const { data: feedSource, error } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    
    if (error || !feedSource) {
      throw new Error(`Feed source not found: ${sourceId}`);
    }
    
    if (!feedSource.is_active) {
      console.log(`⏸️ Skipping inactive feed: ${feedSource.name}`);
      return { message: 'Feed is inactive', feedId: sourceId };
    }

    // Process the feed based on its type
    let feedItems: any[] = [];
    
    try {
      switch (feedSource.type) {
        case 'rss':
          feedItems = await this.processRSSFeed(feedSource);
          break;
        case 'podcast':
          feedItems = await this.processPodcastFeed(feedSource);
          break;
        case 'youtube':
          feedItems = await this.processYouTubeFeed(feedSource);
          break;
        default:
          console.warn(`⚠️ Unsupported feed type: ${feedSource.type}`);
          return { message: `Unsupported feed type: ${feedSource.type}`, feedId: sourceId };
      }
    } catch (error) {
      throw new Error(`Feed processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Update last processed timestamp
    await supabase
      .from('feed_sources')
      .update({ last_processed_at: new Date().toISOString() })
      .eq('id', sourceId);
    
    console.log(`✅ Processed ${feedItems.length} items from feed: ${feedSource.name}`);
    
    return {
      feedId: sourceId,
      feedName: feedSource.name,
      itemsProcessed: feedItems.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Basic RSS feed processing
   */
  private async processRSSFeed(feedSource: any): Promise<any[]> {
    try {
      const response = await fetch(feedSource.url, {
        headers: {
          'User-Agent': 'Silver Fin Monitor/1.0 (https://silverfinmonitor.com)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      console.log(`📄 Fetched RSS content (${xmlText.length} chars) from ${feedSource.name}`);
      
      // Simple RSS parsing - just extract basic info
      const items: any[] = [];
      const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
      
      for (const itemXml of itemMatches.slice(0, 10)) { // Limit to 10 items
        const title = this.extractXmlValue(itemXml, 'title');
        const description = this.extractXmlValue(itemXml, 'description');
        const pubDate = this.extractXmlValue(itemXml, 'pubDate');
        const link = this.extractXmlValue(itemXml, 'link');
        
        if (title) {
          // Store the raw feed item
          const { data, error } = await supabase
            .from('raw_feeds')
            .upsert({
              source_id: feedSource.id,
              title: title.substring(0, 500),
              description: description?.substring(0, 2000),
              content: description || title,
              published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              external_id: link || `${feedSource.id}-${Date.now()}-${Math.random()}`,
              metadata: { link, originalXml: itemXml.substring(0, 1000) },
              processing_status: 'pending'
            }, { 
              onConflict: 'source_id,external_id',
              ignoreDuplicates: true 
            });
          
          if (!error && data) {
            items.push(data);
          }
        }
      }
      
      return items;
      
    } catch (error) {
      throw new Error(`RSS processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Basic podcast feed processing
   */
  private async processPodcastFeed(feedSource: any): Promise<any[]> {
    return await this.processRSSFeed(feedSource); // Podcasts are usually RSS-based
  }

  /**
   * Basic YouTube feed processing
   */
  private async processYouTubeFeed(feedSource: any): Promise<any[]> {
    console.log(`📺 YouTube processing not fully implemented for ${feedSource.name}`);
    return [];
  }

  /**
   * Extract value from XML tag
   */
  private extractXmlValue(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : null;
  }

  /**
   * Process content analysis job
   */
  private async processContent(payload: any): Promise<any> {
    const { sourceId, externalId } = payload;
    
    if (!sourceId || !externalId) {
      throw new Error('sourceId and externalId are required for content processing');
    }

    console.log(`📝 Processing content for source: ${sourceId}, item: ${externalId}`);

    // Get the raw feed item
    const { data: rawFeed, error } = await supabase
      .from('raw_feeds')
      .select('*')
      .eq('source_id', sourceId)
      .eq('external_id', externalId)
      .single();

    if (error || !rawFeed) {
      throw new Error(`Raw feed not found: ${sourceId}/${externalId}`);
    }

    // Process the content using OpenAI
    const fullText = `${rawFeed.title}\n\n${rawFeed.description}\n\n${rawFeed.content}`;
    const processedText = this.cleanText(fullText);
    
    let keyTopics: string[] = [];
    let sentimentScore = 0;
    let summary = '';
    let entities: any[] = [];

    // Try AI processing first
    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a financial content analyzer. Analyze the provided text and return a JSON object with topics, sentiment score (-1 to 1), entities, and a brief summary.'
              },
              {
                role: 'user',
                content: processedText.substring(0, 8000)
              }
            ],
            max_tokens: 1000,
            temperature: 0.3,
            response_format: { type: 'json_object' }
          })
        });

        if (completion.ok) {
          const result = await completion.json();
          const analysis = JSON.parse(result.choices[0]?.message.content || '{}');
          
          keyTopics = analysis.topics || [];
          sentimentScore = analysis.sentiment || 0;
          summary = analysis.summary || processedText.substring(0, 300);
          entities = analysis.entities || [];
        }
      } catch (error) {
        console.warn('AI analysis failed, using fallback:', error);
      }
    }

    // Fallback to basic analysis if AI failed
    if (keyTopics.length === 0) {
      keyTopics = this.extractBasicTopics(processedText);
      sentimentScore = this.calculateBasicSentiment(processedText);
      summary = processedText.substring(0, 300) + '...';
      entities = this.extractBasicEntities(processedText);
    }

    // Store processed content
    const { error: insertError } = await supabase
      .from('processed_content')
      .insert({
        raw_feed_id: rawFeed.id,
        processed_text: processedText,
        key_topics: keyTopics,
        sentiment_score: sentimentScore,
        entities: entities,
        summary: summary,
        processing_metadata: {
          processor: 'netlify_function',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }
      });

    if (insertError) throw insertError;

    // Update raw feed status
    await supabase
      .from('raw_feeds')
      .update({ processing_status: 'completed' })
      .eq('id', rawFeed.id);

    console.log(`✅ Content processed: ${keyTopics.length} topics, sentiment: ${sentimentScore}`);

    return {
      rawFeedId: rawFeed.id,
      topicsCount: keyTopics.length,
      sentimentScore,
      summaryLength: summary.length,
      processingMethod: process.env.OPENAI_API_KEY ? 'ai' : 'fallback'
    };
  }

  /**
   * Process daily analysis job
   */
  private async processDailyAnalysis(payload: any): Promise<any> {
    const { date, forceRegenerate = false } = payload;
    const analysisDate = date || new Date().toISOString().split('T')[0];

    console.log(`🧠 Processing daily analysis for ${analysisDate}`);

    // Check if analysis already exists
    if (!forceRegenerate) {
      const { data: existing } = await supabase
        .from('daily_analysis')
        .select('id')
        .eq('analysis_date', analysisDate)
        .single();

      if (existing) {
        console.log(`✅ Analysis already exists for ${analysisDate}`);
        return { message: 'Analysis already exists', analysisId: existing.id };
      }
    }

    // Get processed content from the last 24 hours
    const { data: processedContent } = await supabase
      .from('processed_content')
      .select(`
        *,
        raw_feeds!inner(
          title,
          published_at,
          feed_sources!inner(name, type)
        )
      `)
      .gte('raw_feeds.published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (!processedContent || processedContent.length === 0) {
      throw new Error('No processed content found for analysis');
    }

    console.log(`📊 Analyzing ${processedContent.length} content items`);

    // Generate analysis using OpenAI
    let analysis = await this.generateAnalysisWithAI(processedContent);

    // Store the analysis
    const { data: savedAnalysis, error } = await supabase
      .from('daily_analysis')
      .upsert({
        analysis_date: analysisDate,
        market_sentiment: analysis.market_sentiment,
        key_themes: analysis.key_themes,
        overall_summary: analysis.overall_summary,
        ai_analysis: analysis.ai_analysis,
        confidence_score: analysis.confidence_score,
        sources_analyzed: processedContent.length,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'analysis_date',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Daily analysis completed for ${analysisDate}`);

    // Auto-queue prediction generation
    const { data: predictionJobId } = await supabase.rpc('enqueue_job', {
      job_type: 'generate_predictions',
      payload: JSON.stringify({
        analysisDate: analysisDate,
        analysisId: savedAnalysis.id,
        source: 'auto_after_analysis'
      }),
      priority: 2,
      delay_seconds: 60 // 1 minute delay
    });

    console.log(`🔮 Queued prediction generation: ${predictionJobId}`);

    return {
      analysisId: savedAnalysis.id,
      analysisDate,
      sourcesAnalyzed: processedContent.length,
      marketSentiment: analysis.market_sentiment,
      confidenceScore: analysis.confidence_score,
      predictionJobId
    };
  }

  /**
   * Generate predictions based on analysis
   */
  private async generatePredictions(payload: any): Promise<any> {
    const { analysisDate, analysisId } = payload;

    console.log(`🔮 Generating predictions for analysis: ${analysisId || analysisDate}`);

    // Get the analysis
    let analysis;
    if (analysisId) {
      const { data } = await supabase
        .from('daily_analysis')
        .select('*')
        .eq('id', analysisId)
        .single();
      analysis = data;
    } else {
      const { data } = await supabase
        .from('daily_analysis')
        .select('*')
        .eq('analysis_date', analysisDate)
        .single();
      analysis = data;
    }

    if (!analysis) {
      throw new Error('Analysis not found for prediction generation');
    }

    // Generate predictions using AI or fallback
    const predictions = await this.generatePredictionsWithAI(analysis);

    // Store predictions
    const insertedPredictions = [];
    for (const prediction of predictions) {
      const { data, error } = await supabase
        .from('predictions')
        .insert({
          daily_analysis_id: analysis.id,
          prediction_type: prediction.prediction_type,
          prediction_text: prediction.prediction_text,
          confidence_level: prediction.confidence_level,
          time_horizon: prediction.time_horizon,
          prediction_data: prediction.prediction_data || {}
        })
        .select()
        .single();

      if (!error && data) {
        insertedPredictions.push(data);
      }
    }

    console.log(`✅ Generated ${insertedPredictions.length} predictions`);

    return {
      analysisId: analysis.id,
      predictionsGenerated: insertedPredictions.length,
      predictions: insertedPredictions.map(p => ({
        id: p.id,
        type: p.prediction_type,
        timeHorizon: p.time_horizon,
        confidence: p.confidence_level
      }))
    };
  }

  /**
   * Compare predictions (placeholder)
   */
  private async comparePredictions(payload: any): Promise<any> {
    console.log('🔍 Prediction comparison not yet implemented');
    return { message: 'Prediction comparison placeholder' };
  }

  /**
   * Transcribe audio (placeholder)
   */
  private async transcribeAudio(payload: any): Promise<any> {
    console.log('🎵 Audio transcription not yet implemented');
    return { message: 'Audio transcription placeholder' };
  }

  /**
   * Complete a job successfully using production database function
   */
  private async completeJob(jobId: string, result: any): Promise<void> {
    try {
      const { error } = await supabase.rpc('complete_job', { job_id: jobId });
      if (error) {
        console.error('Error completing job:', error);
      }
    } catch (error) {
      console.error('Failed to complete job:', error);
    }
  }

  /**
   * Mark a job as failed using production database function
   */
  private async failJob(jobId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('fail_job', { 
        job_id: jobId, 
        error_msg: errorMessage 
      });
      if (error) {
        console.error('Error failing job:', error);
      }
    } catch (error) {
      console.error('Failed to fail job:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper methods for content processing and analysis
  private cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '')   // Remove special characters except basic punctuation
      .trim()
      .substring(0, 8000);            // Limit text length for AI processing
  }

  private extractBasicTopics(text: string): string[] {
    const topicKeywords = [
      // Financial markets
      'market', 'stock', 'trading', 'investment', 'portfolio', 'earnings', 'revenue',
      'profit', 'loss', 'bull', 'bear', 'volatility', 'risk', 'return',
      
      // Economic indicators  
      'inflation', 'gdp', 'unemployment', 'interest', 'rate', 'federal', 'reserve',
      'economy', 'recession', 'growth', 'recovery', 'expansion',
      
      // Technology
      'technology', 'tech', 'ai', 'artificial', 'intelligence', 'software', 'hardware',
      'startup', 'innovation', 'digital', 'cloud', 'data',
      
      // Geopolitics
      'china', 'usa', 'europe', 'trade', 'war', 'sanctions', 'policy', 'government',
      'election', 'politics', 'regulation', 'tariff',
      
      // Energy & Commodities
      'oil', 'gas', 'energy', 'commodity', 'gold', 'silver', 'copper', 'wheat',
      'agriculture', 'mining', 'renewable'
    ];

    const lowerText = text.toLowerCase();
    const foundTopics: string[] = [];
    
    for (const keyword of topicKeywords) {
      if (lowerText.includes(keyword) && !foundTopics.includes(keyword)) {
        foundTopics.push(keyword);
      }
    }
    
    return foundTopics.slice(0, 8); // Limit to 8 topics
  }

  private calculateBasicSentiment(text: string): number {
    const positiveWords = [
      'good', 'great', 'excellent', 'positive', 'growth', 'gain', 'profit', 'success',
      'strong', 'bullish', 'optimistic', 'recovery', 'improvement', 'up', 'rise',
      'increase', 'boom', 'rally', 'surge'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'negative', 'decline', 'loss', 'fail', 'failure',
      'weak', 'bearish', 'pessimistic', 'recession', 'crash', 'down', 'fall',
      'decrease', 'drop', 'plunge', 'collapse', 'crisis'
    ];

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.some(pos => word.includes(pos))) {
        positiveCount++;
      }
      if (negativeWords.some(neg => word.includes(neg))) {
        negativeCount++;
      }
    }
    
    const totalSentimentWords = positiveCount + negativeCount;
    if (totalSentimentWords === 0) return 0;
    
    // Return score between -1 and 1
    return (positiveCount - negativeCount) / Math.max(totalSentimentWords, words.length / 20);
  }

  private extractBasicEntities(text: string): any[] {
    // Basic entity extraction - look for patterns
    const entities: any[] = [];
    
    // Stock tickers (uppercase letters, 1-5 chars)
    const tickerMatches = text.match(/\b[A-Z]{1,5}\b/g);
    if (tickerMatches) {
      const tickers = [...new Set(tickerMatches)];
      entities.push(...tickers.map(ticker => ({ type: 'ticker', value: ticker })));
    }
    
    // Dollar amounts
    const dollarMatches = text.match(/\$[\d,]+\.?\d*/g);
    if (dollarMatches) {
      entities.push(...dollarMatches.map(amount => ({ type: 'currency', value: amount })));
    }
    
    // Percentages
    const percentMatches = text.match(/\d+\.?\d*%/g);
    if (percentMatches) {
      entities.push(...percentMatches.map(percent => ({ type: 'percentage', value: percent })));
    }
    
    return entities.slice(0, 20); // Limit entities
  }

  private async generateAnalysisWithAI(processedContent: any[]): Promise<any> {
    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const contentSummary = processedContent.map(item => ({
          title: item.raw_feeds?.title || 'Unknown',
          summary: item.summary || item.processed_text?.substring(0, 200),
          sentiment: item.sentiment_score,
          topics: item.key_topics?.slice(0, 3),
          source: item.raw_feeds?.feed_sources?.name || 'Unknown'
        }));

        const completion = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a professional market analyst. Analyze the provided content and generate a comprehensive daily market analysis in JSON format.'
              },
              {
                role: 'user',
                content: `Analyze today's market content (${processedContent.length} sources) and provide analysis in this JSON format:
{
  "market_sentiment": "bullish|bearish|neutral",
  "confidence_score": 0.85,
  "key_themes": ["theme1", "theme2", "theme3"],
  "overall_summary": "Brief summary",
  "ai_analysis": {
    "market_drivers": ["driver1", "driver2"],
    "risk_factors": ["risk1", "risk2"],
    "opportunities": ["opp1", "opp2"],
    "geopolitical_context": "summary",
    "economic_indicators": "summary"
  }
}

Content: ${JSON.stringify(contentSummary, null, 2)}`
              }
            ],
            max_tokens: 2000,
            temperature: 0.3,
            response_format: { type: 'json_object' }
          })
        });

        if (completion.ok) {
          const result = await completion.json();
          const analysis = JSON.parse(result.choices[0]?.message.content || '{}');
          
          // Validate required fields
          return {
            market_sentiment: analysis.market_sentiment || 'neutral',
            confidence_score: analysis.confidence_score || 0.75,
            key_themes: analysis.key_themes || [],
            overall_summary: analysis.overall_summary || 'Market analysis generated',
            ai_analysis: analysis.ai_analysis || {}
          };
        }
      } catch (error) {
        console.warn('OpenAI analysis failed, using fallback:', error);
      }
    }

    // Fallback analysis
    return this.generateFallbackAnalysis(processedContent);
  }

  private generateFallbackAnalysis(processedContent: any[]): any {
    // Calculate aggregate sentiment
    const sentiments = processedContent
      .map(item => item.sentiment_score)
      .filter(score => score !== null && score !== undefined);
    
    const avgSentiment = sentiments.length > 0 
      ? sentiments.reduce((sum, score) => sum + score, 0) / sentiments.length 
      : 0;
    
    let market_sentiment = 'neutral';
    if (avgSentiment > 0.15) market_sentiment = 'bullish';
    else if (avgSentiment < -0.15) market_sentiment = 'bearish';
    
    // Extract common themes
    const allTopics = processedContent.flatMap(item => item.key_topics || []);
    const topicCounts = allTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const key_themes = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);
    
    return {
      market_sentiment,
      confidence_score: 0.70,
      key_themes,
      overall_summary: `Market analysis based on ${processedContent.length} sources shows ${market_sentiment} sentiment. Key themes include ${key_themes.slice(0, 3).join(', ')}.`,
      ai_analysis: {
        market_drivers: ['Economic data', 'Corporate earnings', 'Market sentiment'],
        risk_factors: ['Market volatility', 'Economic uncertainty'],
        opportunities: ['Sector rotation', 'Value opportunities'],
        geopolitical_context: 'Monitoring global developments',
        economic_indicators: 'Mixed signals from recent data'
      }
    };
  }

  private async generatePredictionsWithAI(analysis: any): Promise<any[]> {
    // Try OpenAI first
    if (process.env.OPENAI_API_KEY) {
      try {
        const completion = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'Generate market predictions based on the analysis provided. Return predictions as a JSON array.'
              },
              {
                role: 'user',
                content: `Based on this market analysis, generate 3-5 predictions for different time horizons:

Analysis: ${JSON.stringify(analysis, null, 2)}

Return format:
[
  {
    "prediction_type": "market_direction|economic_indicator|sector_performance",
    "prediction_text": "specific prediction",
    "confidence_level": 0.75,
    "time_horizon": "1_week|1_month|3_months|6_months|1_year",
    "prediction_data": {
      "basis": ["reason1", "reason2"],
      "key_factors": ["factor1", "factor2"]
    }
  }
]`
              }
            ],
            max_tokens: 1500,
            temperature: 0.4,
            response_format: { type: 'json_object' }
          })
        });

        if (completion.ok) {
          const result = await completion.json();
          const response = JSON.parse(result.choices[0]?.message.content || '{}');
          
          // Extract predictions array
          const predictions = response.predictions || response || [];
          return Array.isArray(predictions) ? predictions : [predictions];
        }
      } catch (error) {
        console.warn('OpenAI prediction generation failed, using fallback:', error);
      }
    }

    // Fallback predictions
    return this.generateFallbackPredictions(analysis);
  }

  private generateFallbackPredictions(analysis: any): any[] {
    const timeHorizons = ['1_week', '1_month', '3_months'];
    const predictions = [];

    for (const horizon of timeHorizons) {
      predictions.push({
        prediction_type: 'market_direction',
        prediction_text: `Based on current ${analysis.market_sentiment} sentiment and key themes (${analysis.key_themes?.slice(0, 2).join(', ')}), expect markets to ${analysis.market_sentiment === 'bullish' ? 'continue upward trend' : analysis.market_sentiment === 'bearish' ? 'face continued pressure' : 'remain mixed'} over ${horizon.replace('_', ' ')}.`,
        confidence_level: Math.max(0.6, analysis.confidence_score - 0.1),
        time_horizon: horizon,
        prediction_data: {
          basis: analysis.key_themes?.slice(0, 3) || [],
          market_sentiment: analysis.market_sentiment,
          confidence_basis: 'fallback_analysis'
        }
      });
    }

    return predictions;
  }
}

// Scheduled function to run queue worker every 5 minutes
export const handler: Handler = schedule('*/5 * * * *', async (event) => {
  try {
    console.log('🕐 Running scheduled queue worker');
    
    const worker = new ScheduledQueueWorker();
    const result = await worker.processJobs(10); // Process up to 10 jobs
    
    console.log('✅ Scheduled queue worker completed');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Scheduled queue worker completed',
        timestamp: new Date().toISOString(),
        processed: result.processed,
        summary: result.results.slice(0, 5) // Show first 5 results
      })
    };
    
  } catch (error) {
    console.error('❌ Scheduled queue worker failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
});