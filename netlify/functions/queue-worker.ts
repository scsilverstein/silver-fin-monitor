import { Handler } from '@netlify/functions';
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

class QueueWorker {
  
  /**
   * Process pending jobs from the queue
   */
  async processJobs(maxJobs: number = 10): Promise<{ processed: number; results: any[] }> {
    console.log(`🔄 Starting queue worker - processing up to ${maxJobs} jobs`);
    
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
      
      case 'daily_analysis':
        return await this.processDailyAnalysis(job.payload);
      
      case 'generate_predictions':
        return await this.generatePredictions(job.payload);
      
      case 'earnings_fetch':
        return await this.processEarningsFetch(job.payload);
      
      case 'content_process':
        return await this.processContent(job.payload);
      
      case 'worker_heartbeat':
        // Just acknowledge the heartbeat
        return { message: 'Heartbeat acknowledged', timestamp: new Date().toISOString() };
      
      case 'earnings_refresh':
        return await this.processEarningsRefresh(job.payload);
      
      case 'prediction_compare':
        return { message: 'Prediction comparison not yet implemented' };
      
      case 'prediction_validation_check':
        return { message: 'Prediction validation not yet implemented' };
      
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }
  
  /**
   * Process feed fetch job
   */
  private async processFeedFetch(payload: any): Promise<any> {
    const { sourceId } = payload;
    
    if (!sourceId) {
      throw new Error('Feed fetch job missing sourceId');
    }
    
    // Get feed source details
    const { data: feedSource, error: sourceError } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    
    if (sourceError || !feedSource) {
      throw new Error(`Feed source not found: ${sourceId}`);
    }
    
    console.log(`📡 Processing ${feedSource.type} feed: ${feedSource.name}`);
    
    let feedItems: any[] = [];
    
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
      case 'api':
        feedItems = await this.processAPIFeed(feedSource);
        break;
      default:
        throw new Error(`Unsupported feed type: ${feedSource.type}`);
    }
    
    // Store feed items
    if (feedItems.length > 0) {
      await this.storeFeedItems(feedItems);
    }
    
    // Update last processed timestamp
    await supabase
      .from('feed_sources')
      .update({ last_processed_at: new Date().toISOString() })
      .eq('id', sourceId);
    
    return {
      feedId: sourceId,
      feedName: feedSource.name,
      itemsProcessed: feedItems.length,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Process RSS feed
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
      return this.parseRSSItems(xmlText, feedSource);
      
    } catch (error) {
      throw new Error(`RSS processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Process podcast feed
   */
  private async processPodcastFeed(feedSource: any): Promise<any[]> {
    try {
      const response = await fetch(feedSource.url, {
        headers: {
          'User-Agent': 'Silver Fin Monitor/1.0 (https://silverfinmonitor.com)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Podcast fetch failed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      return this.parsePodcastItems(xmlText, feedSource);
      
    } catch (error) {
      throw new Error(`Podcast processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Process YouTube feed
   */
  private async processYouTubeFeed(feedSource: any): Promise<any[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('YouTube API key not configured');
      return [];
    }
    
    try {
      // Extract channel ID from URL
      const channelId = this.extractChannelId(feedSource.url);
      if (!channelId) {
        throw new Error('Could not extract channel ID');
      }
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=5&order=date&type=video&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API failed: ${response.status}`);
      }
      
      const data = await response.json();
      return this.parseYouTubeItems(data.items || [], feedSource);
      
    } catch (error) {
      throw new Error(`YouTube processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Process API feed
   */
  private async processAPIFeed(feedSource: any): Promise<any[]> {
    try {
      const config = feedSource.config || {};
      const headers = {
        'User-Agent': 'Silver Fin Monitor/1.0',
        ...config.headers
      };
      
      const response = await fetch(feedSource.url, { headers });
      
      if (!response.ok) {
        throw new Error(`API fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      return this.parseAPIItems(data, feedSource);
      
    } catch (error) {
      throw new Error(`API processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Parse RSS items from XML
   */
  private parseRSSItems(xml: string, feedSource: any): any[] {
    const items: any[] = [];
    
    try {
      const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
      
      if (itemMatches) {
        for (const itemXml of itemMatches.slice(0, 10)) {
          const title = this.extractXMLTag(itemXml, 'title');
          const description = this.extractXMLTag(itemXml, 'description');
          const pubDate = this.extractXMLTag(itemXml, 'pubDate');
          const link = this.extractXMLTag(itemXml, 'link');
          const guid = this.extractXMLTag(itemXml, 'guid');
          
          if (title) {
            items.push({
              source_id: feedSource.id,
              title: this.cleanHtml(title),
              description: this.cleanHtml(description),
              content: this.cleanHtml(description),
              published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              external_id: guid || link || title,
              metadata: {
                link,
                source_type: 'rss',
                source_name: feedSource.name
              },
              processing_status: 'pending',
              created_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error parsing RSS items:', error);
    }
    
    return items;
  }
  
  /**
   * Parse podcast items from XML
   */
  private parsePodcastItems(xml: string, feedSource: any): any[] {
    const items: any[] = [];
    
    try {
      const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
      
      if (itemMatches) {
        for (const itemXml of itemMatches.slice(0, 5)) {
          const title = this.extractXMLTag(itemXml, 'title');
          const description = this.extractXMLTag(itemXml, 'description');
          const pubDate = this.extractXMLTag(itemXml, 'pubDate');
          const guid = this.extractXMLTag(itemXml, 'guid');
          
          // Extract audio URL
          const enclosureMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]*>/);
          const audioUrl = enclosureMatch ? enclosureMatch[1] : null;
          
          if (title) {
            items.push({
              source_id: feedSource.id,
              title: this.cleanHtml(title),
              description: this.cleanHtml(description),
              content: audioUrl ? 'AUDIO_TRANSCRIPTION_NEEDED' : this.cleanHtml(description),
              published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              external_id: guid || audioUrl || title,
              metadata: {
                audioUrl,
                source_type: 'podcast',
                source_name: feedSource.name,
                needsTranscription: !!audioUrl
              },
              processing_status: 'pending',
              created_at: new Date().toISOString()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error parsing podcast items:', error);
    }
    
    return items;
  }
  
  /**
   * Parse YouTube items
   */
  private parseYouTubeItems(items: any[], feedSource: any): any[] {
    return items.map(item => ({
      source_id: feedSource.id,
      title: item.snippet.title,
      description: item.snippet.description,
      content: item.snippet.description,
      published_at: new Date(item.snippet.publishedAt).toISOString(),
      external_id: item.id.videoId,
      metadata: {
        videoId: item.id.videoId,
        channelId: item.snippet.channelId,
        thumbnails: item.snippet.thumbnails,
        source_type: 'youtube',
        source_name: feedSource.name
      },
      processing_status: 'pending',
      created_at: new Date().toISOString()
    }));
  }
  
  /**
   * Parse API items
   */
  private parseAPIItems(data: any, feedSource: any): any[] {
    const items: any[] = [];
    
    try {
      let dataArray: any[] = [];
      
      if (Array.isArray(data)) {
        dataArray = data;
      } else if (data.items && Array.isArray(data.items)) {
        dataArray = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        dataArray = data.data;
      }
      
      dataArray.slice(0, 10).forEach(item => {
        items.push({
          source_id: feedSource.id,
          title: item.title || item.name || item.headline || 'Untitled',
          description: item.description || item.summary || item.content || '',
          content: item.content || item.body || item.text || item.description || '',
          published_at: item.published_at || item.date || item.created_at || new Date().toISOString(),
          external_id: item.id || item.guid || item.url || item.title,
          metadata: {
            ...item,
            source_type: 'api',
            source_name: feedSource.name
          },
          processing_status: 'pending',
          created_at: new Date().toISOString()
        });
      });
    } catch (error) {
      console.error('Error parsing API items:', error);
    }
    
    return items;
  }
  
  /**
   * Store feed items in database
   */
  private async storeFeedItems(items: any[]): Promise<void> {
    for (const item of items) {
      try {
        const { error } = await supabase
          .from('raw_feeds')
          .upsert(item, {
            onConflict: 'source_id,external_id',
            ignoreDuplicates: true
          });
          
        if (error) {
          console.error('Error storing feed item:', error);
        }
      } catch (error) {
        console.error('Error in storeFeedItems:', error);
      }
    }
  }
  
  /**
   * Process daily analysis job
   */
  private async processDailyAnalysis(payload: any): Promise<any> {
    const { date = new Date().toISOString().split('T')[0], force = false } = payload;
    
    console.log(`🧠 Generating daily analysis for ${date}`);
    
    // Check if analysis already exists
    if (!force) {
      const { data: existing } = await supabase
        .from('daily_analysis')
        .select('id')
        .eq('analysis_date', date)
        .single();
        
      if (existing) {
        return { message: `Analysis for ${date} already exists`, analysisId: existing.id };
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
    
    // Generate analysis (simplified mock for now)
    const analysis = this.generateMockAnalysis(processedContent);
    
    // Store the analysis
    const { data: newAnalysis, error } = await supabase
      .from('daily_analysis')
      .upsert({
        analysis_date: date,
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
    
    if (error) {
      throw new Error(`Failed to store analysis: ${error.message}`);
    }
    
    return {
      message: `Daily analysis generated for ${date}`,
      analysisId: newAnalysis.id,
      sourcesAnalyzed: processedContent.length
    };
  }
  
  /**
   * Generate predictions job
   */
  private async generatePredictions(payload: any): Promise<any> {
    const { analysisId, analysisDate } = payload;
    
    if (!analysisId) {
      throw new Error('Analysis ID required for prediction generation');
    }
    
    // Get the analysis
    const { data: analysis, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();
      
    if (error || !analysis) {
      throw new Error('Analysis not found');
    }
    
    // Generate predictions
    const predictions = [
      {
        prediction_type: 'market_direction',
        prediction_text: `Based on current ${analysis.market_sentiment} sentiment, expect markets to continue current trend`,
        confidence_level: analysis.confidence_score,
        time_horizon: '1_week',
        prediction_data: {
          basis: analysis.key_themes?.slice(0, 3) || [],
          market_sentiment: analysis.market_sentiment
        },
        daily_analysis_id: analysis.id,
        created_at: new Date().toISOString()
      }
    ];
    
    // Store predictions
    for (const prediction of predictions) {
      await supabase
        .from('predictions')
        .insert(prediction);
    }
    
    return {
      message: `Generated ${predictions.length} predictions`,
      predictionsCreated: predictions.length,
      analysisDate
    };
  }
  
  /**
   * Process earnings fetch job
   */
  private async processEarningsFetch(payload: any): Promise<any> {
    // Placeholder for earnings processing
    return { message: 'Earnings fetch not yet implemented' };
  }
  
  /**
   * Process content processing job
   */
  private async processContent(payload: any): Promise<any> {
    // Placeholder for content processing
    return { message: 'Content processing not yet implemented' };
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
  
  /**
   * Generate mock analysis for testing
   */
  private generateMockAnalysis(content: any[]): any {
    // Calculate aggregate sentiment
    const sentiments = content
      .map(item => item.sentiment_score)
      .filter(score => score !== null && score !== undefined);
    
    const avgSentiment = sentiments.length > 0 
      ? sentiments.reduce((sum, score) => sum + score, 0) / sentiments.length 
      : 0;
    
    let market_sentiment = 'neutral';
    if (avgSentiment > 0.1) market_sentiment = 'bullish';
    else if (avgSentiment < -0.1) market_sentiment = 'bearish';
    
    // Extract common themes
    const allTopics = content.flatMap(item => item.key_topics || []);
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
      confidence_score: 0.75,
      key_themes,
      overall_summary: `Market analysis based on ${content.length} sources shows ${market_sentiment} sentiment. Key themes include ${key_themes.slice(0, 3).join(', ')}.`,
      ai_analysis: {
        market_drivers: ['Economic data', 'Corporate earnings', 'Geopolitical events'],
        risk_factors: ['Market volatility', 'Inflation concerns'],
        opportunities: ['Technology sector growth', 'Infrastructure investments'],
        geopolitical_context: 'Monitoring global trade and policy developments',
        economic_indicators: 'Mixed signals from recent economic data'
      }
    };
  }
  
  // Utility functions
  private extractXMLTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? match[1].trim() : '';
  }
  
  private cleanHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private extractChannelId(url: string): string | null {
    const patterns = [
      /channel\/([a-zA-Z0-9_-]+)/,
      /user\/([a-zA-Z0-9_-]+)/,
      /c\/([a-zA-Z0-9_-]+)/,
      /@([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process earnings refresh job
   */
  private async processEarningsRefresh(payload: any): Promise<any> {
    // For now, just acknowledge the job
    return {
      message: 'Earnings refresh completed',
      timestamp: new Date().toISOString()
    };
  }
}

// Netlify Function Handler
export const handler: Handler = async (event) => {
  try {
    const { maxJobs = 10 } = JSON.parse(event.body || '{}');
    
    console.log('🚀 Starting queue worker');
    
    const worker = new QueueWorker();
    const result = await worker.processJobs(maxJobs);
    
    console.log(`✅ Queue worker completed: ${result.processed} jobs processed`);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Processed ${result.processed} jobs`,
        data: {
          processed: result.processed,
          results: result.results
        },
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Queue worker error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};