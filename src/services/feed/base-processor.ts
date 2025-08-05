import { FeedSource, RawFeed, Result, ProcessedContent, BaseFeedProcessorDeps } from '../../types';

export abstract class BaseFeedProcessor {
  protected source: FeedSource;
  protected db: BaseFeedProcessorDeps['db'];
  protected cache: BaseFeedProcessorDeps['cache'];
  protected logger: BaseFeedProcessorDeps['logger'];

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    this.source = source;
    this.db = deps.db;
    this.cache = deps.cache;
    this.logger = deps.logger;
  }

  abstract fetchLatest(): Promise<RawFeed[]>;
  abstract processContent(feed: RawFeed): Promise<Result<ProcessedContent>>;
  abstract validate(feed: RawFeed): boolean;

  protected async markProcessed(): Promise<void> {
    try {
      await this.db.update('feed_sources', this.source.id, {
        lastProcessedAt: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to update last processed time', error);
    }
  }

  protected handleError(error: any, context: string): Error {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${context}: ${message}`, error);
    return new Error(`${context}: ${message}`);
  }

  protected async fetchWithRetry(
    url: string,
    options?: RequestInit,
    retries: number = 3
  ): Promise<Response> {
    let lastError: Error;

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000)
        });

        if (response.ok) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Retry ${i + 1}/${retries} failed:`, lastError.message);
        
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }

    throw lastError!;
  }
}