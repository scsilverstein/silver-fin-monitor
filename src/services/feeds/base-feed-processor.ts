import { DatabaseService } from '../database/db.service';
import { CacheService } from '../cache/cache.service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'podcast' | 'youtube' | 'api' | 'multi_source';
  url: string;
  config: FeedConfig;
  last_processed_at?: Date;
  is_active: boolean;
}

export interface FeedConfig {
  categories: string[];
  priority: 'low' | 'medium' | 'high';
  update_frequency: string;
  process_transcript?: boolean;
  extract_entities?: boolean;
  extract_guests?: boolean;
  extract_video_transcript?: boolean;
  api_key_required?: boolean;
  rate_limit?: {
    requests: number;
    period: string;
  };
  custom_headers?: Record<string, string>;
  [key: string]: any;
}

export interface RawFeed {
  id: string;
  source_id: string;
  title: string;
  description: string;
  content: string;
  published_at: Date;
  external_id: string;
  metadata: Record<string, any>;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ProcessedContent {
  id: string;
  raw_feed_id: string;
  processed_text: string;
  key_topics: string[];
  sentiment_score: number;
  entities: {
    companies?: string[];
    people?: string[];
    locations?: string[];
    tickers?: string[];
    [key: string]: any;
  };
  summary: string;
  processing_metadata: {
    processor_version: string;
    processing_time: number;
    models?: Record<string, string>;
    [key: string]: any;
  };
}

export abstract class BaseFeedProcessor {
  protected logger: winston.Logger;
  protected rateLimiter: RateLimiter;

  constructor(
    protected source: FeedSource,
    protected db: DatabaseService,
    protected cache: CacheService,
    logger: winston.Logger
  ) {
    this.logger = logger.child({ processor: this.constructor.name, source: source.name });
    this.rateLimiter = new RateLimiter(source.config.rate_limit, logger);
  }

  // Abstract methods to be implemented by subclasses
  abstract fetchLatest(): Promise<RawFeed[]>;
  abstract extractContent(item: any): Promise<string>;
  abstract validateContent(content: any): boolean;

  // Main processing flow
  async process(): Promise<ProcessedContent[]> {
    try {
      this.logger.info('Starting feed processing');
      
      // Check rate limit
      await this.rateLimiter.checkLimit();
      
      // Fetch latest content
      const rawFeeds = await this.fetchLatest();
      this.logger.info(`Fetched ${rawFeeds.length} new items`);
      
      // Filter out already processed items
      const newFeeds = await this.filterNewFeeds(rawFeeds);
      this.logger.info(`${newFeeds.length} items to process`);
      
      if (newFeeds.length === 0) {
        return [];
      }
      
      // Save raw feeds
      await this.saveRawFeeds(newFeeds);
      
      // Process each feed
      const processedContent: ProcessedContent[] = [];
      for (const feed of newFeeds) {
        try {
          const processed = await this.processContent(feed);
          if (processed) {
            processedContent.push(processed);
          }
        } catch (error) {
          this.logger.error(`Failed to process feed ${feed.id}:`, error);
          await this.markFeedFailed(feed.id, error);
        }
      }
      
      // Update last processed timestamp
      await this.updateLastProcessed();
      
      this.logger.info(`Processing completed. Processed ${processedContent.length} items`);
      return processedContent;
    } catch (error) {
      this.logger.error('Feed processing error:', error);
      throw error;
    }
  }

  // Filter feeds that haven't been processed yet
  protected async filterNewFeeds(feeds: RawFeed[]): Promise<RawFeed[]> {
    const existingIds = await this.getExistingExternalIds();
    return feeds.filter(feed => !existingIds.has(feed.external_id));
  }

  // Get existing external IDs to avoid duplicates
  protected async getExistingExternalIds(): Promise<Set<string>> {
    const cacheKey = `feed_external_ids:${this.source.id}`;
    let ids = await this.cache.get<string[]>(cacheKey);
    
    if (!ids) {
      const results = await this.db.query<{ external_id: string }>(
        `SELECT external_id 
         FROM raw_feeds 
         WHERE source_id = $1 
         AND created_at > NOW() - INTERVAL '30 days'`,
        [this.source.id]
      );
      
      ids = results.map(r => r.external_id);
      await this.cache.set(cacheKey, ids, { ttl: 3600 }); // Cache for 1 hour
    }
    
    return new Set(ids);
  }

  // Save raw feeds to database
  protected async saveRawFeeds(feeds: RawFeed[]): Promise<void> {
    await this.db.tables.rawFeeds.createMany(feeds);
  }

  // Process individual content item
  protected async processContent(feed: RawFeed): Promise<ProcessedContent | null> {
    try {
      // Mark as processing
      await this.db.tables.rawFeeds.update(feed.id, {
        processing_status: 'processing'
      });
      
      // Validate content
      if (!this.validateContent(feed)) {
        this.logger.warn(`Invalid content for feed ${feed.id}`);
        return null;
      }
      
      const startTime = Date.now();
      
      // Extract entities if configured
      const entities = this.source.config.extract_entities
        ? await this.extractEntities(feed.content)
        : {};
      
      // Extract topics
      const topics = await this.extractTopics(feed.content);
      
      // Analyze sentiment
      const sentiment = await this.analyzeSentiment(feed.content);
      
      // Generate summary
      const summary = await this.generateSummary(feed.content);
      
      const processingTime = Date.now() - startTime;
      
      const processedContent: ProcessedContent = {
        id: uuidv4(),
        raw_feed_id: feed.id,
        processed_text: feed.content,
        key_topics: topics,
        sentiment_score: sentiment,
        entities,
        summary,
        processing_metadata: {
          processor_version: '1.0.0',
          processing_time: processingTime,
          models: {
            sentiment: 'builtin',
            entities: 'builtin',
            summary: 'builtin'
          }
        }
      };
      
      // Save processed content
      await this.db.tables.processedContent.create(processedContent);
      
      // Mark as completed
      await this.db.tables.rawFeeds.update(feed.id, {
        processing_status: 'completed'
      });
      
      return processedContent;
    } catch (error) {
      this.logger.error(`Error processing content for feed ${feed.id}:`, error);
      throw error;
    }
  }

  // Entity extraction (basic implementation - can be overridden)
  protected async extractEntities(content: string): Promise<any> {
    const entities: any = {
      companies: [],
      people: [],
      locations: [],
      tickers: []
    };
    
    // Extract stock tickers (basic regex)
    const tickerRegex = /\b[A-Z]{1,5}\b(?=\s|$|,|\.)/g;
    const tickers = content.match(tickerRegex) || [];
    entities.tickers = [...new Set(tickers)].filter(t => t.length >= 2);
    
    // More sophisticated entity extraction would use NLP libraries
    
    return entities;
  }

  // Topic extraction (basic implementation)
  protected async extractTopics(content: string): Promise<string[]> {
    // Basic keyword extraction
    const commonWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'in', 'of', 'to', 'for']);
    
    const words = content.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
    
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Get top 10 topics
    const topics = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return topics;
  }

  // Sentiment analysis (basic implementation)
  protected async analyzeSentiment(content: string): Promise<number> {
    // Basic sentiment keywords
    const positiveWords = ['good', 'great', 'excellent', 'positive', 'growth', 'increase', 'profit', 'success', 'up', 'gain'];
    const negativeWords = ['bad', 'poor', 'negative', 'loss', 'decrease', 'decline', 'fall', 'down', 'risk', 'concern'];
    
    const words = content.toLowerCase().split(/\W+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 1;
      if (negativeWords.includes(word)) score -= 1;
    });
    
    // Normalize to -1 to 1
    return Math.max(-1, Math.min(1, score / Math.max(words.length * 0.1, 1)));
  }

  // Generate summary (basic implementation)
  protected async generateSummary(content: string): Promise<string> {
    // Simple summary: first 200 characters
    return content.substring(0, 200).trim() + '...';
  }

  // Mark feed as failed
  protected async markFeedFailed(feedId: string, error: any): Promise<void> {
    await this.db.tables.rawFeeds.update(feedId, {
      processing_status: 'failed',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        failed_at: new Date()
      }
    });
  }

  // Update last processed timestamp
  protected async updateLastProcessed(): Promise<void> {
    await this.db.tables.feedSources.update(this.source.id, {
      last_processed_at: new Date()
    });
  }

  // Utility method for making HTTP requests with retry
  protected async fetchWithRetry(
    url: string,
    options: any = {},
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...this.source.config.custom_headers
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Fetch attempt ${i + 1} failed:`, error);
        
        if (i < maxRetries - 1) {
          // Exponential backoff
          await this.sleep(Math.pow(2, i) * 1000);
        }
      }
    }
    
    throw lastError;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Rate limiter helper
class RateLimiter {
  private requests: Date[] = [];

  constructor(
    private config?: { requests: number; period: string },
    private logger?: winston.Logger
  ) {}

  async checkLimit(): Promise<void> {
    if (!this.config) return;
    
    const now = new Date();
    const periodMs = this.parsePeriod(this.config.period);
    const cutoff = new Date(now.getTime() - periodMs);
    
    // Remove old requests
    this.requests = this.requests.filter(date => date > cutoff);
    
    if (this.requests.length >= this.config.requests) {
      const waitTime = this.requests[0].getTime() + periodMs - now.getTime();
      this.logger?.warn(`Rate limit reached. Waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
    
    this.requests.push(now);
  }

  private parsePeriod(period: string): number {
    const units: Record<string, number> = {
      second: 1000,
      minute: 60000,
      hour: 3600000,
      day: 86400000
    };
    
    const match = period.match(/(\d+)\s*(\w+)/);
    if (!match) return 60000; // Default 1 minute
    
    const [, num, unit] = match;
    return parseInt(num) * (units[unit.toLowerCase()] || 60000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BaseFeedProcessor;