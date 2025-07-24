// Base feed processor following CLAUDE.md specification
import { FeedProcessor, FeedSource, RawFeed, ProcessedContent, Result, BaseFeedProcessorDeps } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { createContextLogger } from '@/utils/logger';

export abstract class BaseFeedProcessor implements FeedProcessor {
  protected source: FeedSource;
  protected db: BaseFeedProcessorDeps['db'];
  protected cache: BaseFeedProcessorDeps['cache'];
  protected logger: BaseFeedProcessorDeps['logger'];
  protected contextLogger: any;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    this.source = source;
    this.db = deps.db;
    this.cache = deps.cache;
    this.logger = deps.logger;
    this.contextLogger = createContextLogger(`FeedProcessor:${source.type}`);
  }

  // Abstract methods to be implemented by specific processors
  abstract fetchLatest(): Promise<RawFeed[]>;
  abstract processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>>;

  // Common validation method
  validate(feed: RawFeed): boolean {
    return !!(
      feed.id &&
      feed.sourceId &&
      feed.content &&
      feed.content.length > 10
    );
  }

  // Common method to check if feed item already exists
  protected async feedExists(externalId: string): Promise<boolean> {
    const existing = await this.db.query(
      'SELECT id FROM raw_feeds WHERE source_id = $1 AND external_id = $2',
      [this.source.id, externalId]
    );
    return existing.length > 0;
  }

  // Common method to save raw feed
  protected async saveRawFeed(feed: Omit<RawFeed, 'id' | 'createdAt'>): Promise<RawFeed> {
    const rawFeed = await this.db.create<RawFeed>('raw_feeds', {
      ...feed,
      sourceId: feed.sourceId,
      processingStatus: 'pending'
    });
    
    this.contextLogger.debug('Raw feed saved', { 
      feedId: rawFeed.id, 
      title: rawFeed.title 
    });
    
    return rawFeed;
  }

  // Common method to update feed processing status
  protected async updateProcessingStatus(
    feedId: string, 
    status: RawFeed['processingStatus'],
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { processingStatus: status };
    if (errorMessage) {
      updateData.metadata = { 
        ...((await this.db.findById<RawFeed>('raw_feeds', feedId))?.metadata || {}),
        error: errorMessage 
      };
    }

    await this.db.update('raw_feeds', feedId, updateData);
  }

  // Common method to update last processed timestamp
  protected async updateLastProcessed(): Promise<void> {
    await this.db.update('feed_sources', this.source.id, {
      lastProcessedAt: new Date()
    });
  }

  // Rate limiting helper
  protected async checkRateLimit(): Promise<void> {
    if (!this.source.config.rateLimit) return;

    const { requests, period } = this.source.config.rateLimit;
    const cacheKey = `rate_limit:${this.source.id}`;
    
    const current = await this.cache.get<number>(cacheKey) || 0;
    
    if (current >= requests) {
      throw new Error(`Rate limit exceeded for ${this.source.name}`);
    }

    await this.cache.set(cacheKey, current + 1, parseInt(period));
  }

  // Common error handling wrapper
  protected async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<Result<T>> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      this.contextLogger.error(`Error in ${context}`, { 
        source: this.source.name,
        error 
      });
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  // Clean and normalize text content
  protected normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit newlines
      .trim();
  }

  // Extract a clean summary from content
  protected extractSummary(content: string, maxLength: number = 500): string {
    const normalized = this.normalizeText(content);
    if (normalized.length <= maxLength) return normalized;
    
    // Try to cut at sentence boundary
    const truncated = normalized.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > maxLength * 0.8) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    return truncated + '...';
  }

  // Generate a unique ID for feed items
  protected generateFeedId(source: string, id: string): string {
    return `${source}:${id}`;
  }

  // Parse common date formats
  protected parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) return undefined;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }
}