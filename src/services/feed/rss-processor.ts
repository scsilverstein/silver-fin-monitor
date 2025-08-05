// RSS feed processor following CLAUDE.md specification
import { BaseFeedProcessor } from './base-processor';
import { ProcessedContent, RawFeed, Result, FeedSource, BaseFeedProcessorDeps } from '../../types';
import { CacheService } from '../cache/cache.service';
import winston from 'winston';
import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import cheerio from 'cheerio';

export interface RSSConfig {
  extractFullContent?: boolean;
  contentSelectors?: string[]; // CSS selectors for content extraction
  removeSelectors?: string[]; // CSS selectors for elements to remove
  maxItems?: number;
  filterKeywords?: string[];
  excludeKeywords?: string[];
}

export class RSSProcessor extends BaseFeedProcessor {
  private parser: Parser;
  private nlpService: any; // Will be set dynamically
  private config: RSSConfig;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    this.parser = new Parser({
      customFields: {
        feed: ['language', 'copyright', 'lastBuildDate'],
        item: ['author', 'category', 'comments', 'source', 'enclosure']
      }
    });
    this.config = (source.config as RSSConfig) || {};
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.logger.info('Fetching RSS feed', { source: this.source.name, url: this.source.url });

      // Check cache first
      const cacheKey = `rss:latest:${this.source.id}`;
      const cached = await this.cache.get<RawFeed[]>(cacheKey);
      if (cached) {
        this.logger.info('Using cached RSS items', { source: this.source.name });
        return cached;
      }

      // Fetch and parse RSS feed
      const feed = await this.parser.parseURL(this.source.url);
      
      // Get last processed date
      const lastProcessed = this.source.lastProcessedAt || new Date(0);
      
      // Filter and transform items
      const rawFeeds: RawFeed[] = [];
      let processedCount = 0;

      for (const item of feed.items) {
        // Skip if already processed
        if (new Date(item.pubDate || item.isoDate || '') <= lastProcessed) {
          continue;
        }

        // Apply keyword filters
        if (this.config.filterKeywords && this.config.filterKeywords.length > 0) {
          const text = `${item.title} ${item.contentSnippet}`.toLowerCase();
          const hasKeyword = this.config.filterKeywords.some(keyword => 
            text.includes(keyword.toLowerCase())
          );
          if (!hasKeyword) continue;
        }

        // Apply exclusion filters
        if (this.config.excludeKeywords && this.config.excludeKeywords.length > 0) {
          const text = `${item.title} ${item.contentSnippet}`.toLowerCase();
          const hasExcluded = this.config.excludeKeywords.some(keyword => 
            text.includes(keyword.toLowerCase())
          );
          if (hasExcluded) continue;
        }

        // Extract content
        let content = item.contentSnippet || item.content || '';
        
        // Optionally extract full content from the article page
        if (this.config.extractFullContent && item.link) {
          try {
            content = await this.extractFullContent(item.link) || content;
          } catch (error) {
            this.logger.warn('Failed to extract full content', { 
              url: item.link, 
              error 
            });
          }
        }

        rawFeeds.push({
          id: uuidv4(),
          sourceId: this.source.id,
          title: item.title || 'Untitled',
          description: item.contentSnippet || '',
          content,
          publishedAt: new Date(item.pubDate || item.isoDate || new Date()),
          externalId: item.guid || item.link || uuidv4(),
          metadata: {
            type: 'rss',
            author: item.creator || item.author,
            categories: item.categories || [],
            link: item.link,
            commentsUrl: item.comments,
            enclosure: item.enclosure,
            language: feed.language,
            originalContent: item.content
          },
          processingStatus: 'pending' as const,
          createdAt: new Date()
        });

        processedCount++;
        if (this.config.maxItems && processedCount >= this.config.maxItems) {
          break;
        }
      }

      // Cache for 30 minutes
      await this.cache.set(cacheKey, rawFeeds, 1800);

      this.logger.info('Fetched RSS items', { 
        source: this.source.name, 
        count: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.logger.error('Failed to fetch RSS feed', { 
        source: this.source.name, 
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    try {
      this.logger.info('Processing RSS content', { id: rawFeed.id });

      // Initialize NLP service if needed
      if (!this.nlpService) {
        const { NLPService } = await import('../nlp/nlp.service');
        this.nlpService = new NLPService();
      }

      // Extract entities
      const entities = await this.nlpService.extractEntities(rawFeed.content);
      
      // Extract key topics
      const topics = await this.nlpService.extractTopics(rawFeed.content, {
        maxTopics: 8,
        minScore: 0.6
      });
      
      // Analyze sentiment
      const sentiment = await this.nlpService.analyzeSentiment(rawFeed.content);
      
      // Generate summary
      const summary = await this.nlpService.generateSummary(rawFeed.content, {
        maxLength: 300,
        style: 'paragraph'
      });

      const processedContent: ProcessedContent = {
        id: uuidv4(),
        rawFeedId: rawFeed.id,
        processedText: rawFeed.content,
        keyTopics: topics,
        sentimentScore: sentiment,
        entities: [
          ...entities.companies.map((name: string) => ({ name, type: 'company' })),
          ...entities.people.map((name: string) => ({ name, type: 'person' })),
          ...entities.locations.map((name: string) => ({ name, type: 'location' })),
          ...entities.tickers.map((name: string) => ({ name, type: 'ticker' }))
        ],
        summary,
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          models: {
            sentiment: 'TextBlob',
            entities: 'spaCy',
            summary: 'GPT-4'
          },
          rssMetadata: {
            author: rawFeed.metadata?.author,
            categories: rawFeed.metadata?.categories || [],
            hasFullContent: rawFeed.content !== rawFeed.description
          }
        },
        createdAt: new Date()
      };

      return { success: true, data: processedContent };
    } catch (error) {
      this.logger.error('Failed to process RSS content', { id: rawFeed.id, error });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  validate(feed: RawFeed): boolean {
    try {
      // Check required fields
      if (!feed.title || !feed.content) {
        return false;
      }

      // Check if it's an RSS feed
      if (feed.metadata?.type !== 'rss') {
        return false;
      }

      // Validate content length
      if (feed.content.length < 10) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to validate RSS feed', { feed: feed.id, error });
      return false;
    }
  }

  private async extractFullContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SilverFinMonitor/1.0)'
        }
      });

      const $ = cheerio.load(response.data);

      // Remove unwanted elements
      const removeSelectors = this.config.removeSelectors || [
        'script', 'style', 'nav', 'header', 'footer', 
        '.advertisement', '.ads', '.social-share', '.comments'
      ];
      removeSelectors.forEach(selector => $(selector).remove());

      // Try to find content using configured selectors
      let content = '';
      if (this.config.contentSelectors && this.config.contentSelectors.length > 0) {
        for (const selector of this.config.contentSelectors) {
          const extracted = $(selector).text().trim();
          if (extracted && extracted.length > content.length) {
            content = extracted;
          }
        }
      }

      // Fallback to common content selectors
      if (!content) {
        const commonSelectors = [
          'article', 
          '[role="main"]', 
          '.content', 
          '.article-content',
          '.entry-content',
          '.post-content',
          'main'
        ];
        
        for (const selector of commonSelectors) {
          const extracted = $(selector).text().trim();
          if (extracted && extracted.length > content.length) {
            content = extracted;
          }
        }
      }

      // Clean up whitespace
      content = content.replace(/\s+/g, ' ').trim();

      return content.length > 100 ? content : null;
    } catch (error) {
      this.logger.error('Failed to extract full content', { url, error });
      return null;
    }
  }
}

export default RSSProcessor;