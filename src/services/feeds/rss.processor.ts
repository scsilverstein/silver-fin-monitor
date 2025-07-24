// RSS feed processor following CLAUDE.md specification
import Parser from 'rss-parser';
import axios from 'axios';
import { FeedSource, RawFeed, ProcessedContent, Result, BaseFeedProcessorDeps } from '@/types';
import { BaseFeedProcessor } from './base.processor';
import { v4 as uuidv4 } from 'uuid';

interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  isoDate?: string;
  categories?: string[];
}

export class RSSProcessor extends BaseFeedProcessor {
  private parser: Parser;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    
    // Configure RSS parser with custom headers if needed
    this.parser = new Parser({
      headers: this.source.config.customHeaders || {},
      timeout: 30000,
      customFields: {
        item: [
          ['media:content', 'media'],
          ['content:encoded', 'contentEncoded']
        ]
      }
    });
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      await this.checkRateLimit();
      
      this.contextLogger.info('Fetching RSS feed', { 
        source: this.source.name,
        url: this.source.url 
      });

      // Fetch and parse RSS feed
      const feed = await this.parser.parseURL(this.source.url);
      
      this.contextLogger.debug('RSS feed parsed', { 
        source: this.source.name,
        itemCount: feed.items?.length || 0 
      });

      // Filter and process items
      const rawFeeds: RawFeed[] = [];
      
      for (const item of feed.items || []) {
        // Generate external ID
        const externalId = item.guid || item.link || this.generateExternalId(item);
        
        // Check if already processed
        if (await this.feedExists(externalId)) {
          continue;
        }

        // Extract content
        const content = this.extractContent(item);
        if (!content) continue;

        // Create raw feed
        const rawFeed = await this.saveRawFeed({
          sourceId: this.source.id,
          title: item.title || 'Untitled',
          description: item.contentSnippet || item.content || '',
          content,
          publishedAt: this.parseDate(item.pubDate || item.isoDate),
          externalId,
          metadata: {
            link: item.link,
            author: item.creator,
            categories: item.categories || [],
            feedTitle: feed.title,
            feedDescription: feed.description
          },
          processingStatus: 'pending'
        });

        rawFeeds.push(rawFeed);
      }

      // Update last processed timestamp
      await this.updateLastProcessed();

      this.contextLogger.info('RSS feed processed', { 
        source: this.source.name,
        newItems: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.contextLogger.error('RSS feed fetch error', { 
        source: this.source.name,
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    return this.withErrorHandling(async () => {
      this.contextLogger.debug('Processing RSS content', { 
        feedId: rawFeed.id,
        title: rawFeed.title 
      });

      // Update status to processing
      await this.updateProcessingStatus(rawFeed.id, 'processing');

      // Clean and normalize content
      const processedText = this.normalizeText(rawFeed.content || '');
      
      // Extract key topics from content and metadata
      const keyTopics = this.extractKeyTopics(
        processedText,
        rawFeed.metadata?.categories || []
      );

      // Generate summary
      const summary = this.extractSummary(processedText);

      // Create processed content
      const processed = await this.db.create<ProcessedContent>('processed_content', {
        rawFeedId: rawFeed.id,
        processedText: processedText,
        keyTopics: keyTopics,
        summary,
        entities: {}, // Will be populated by NLP service
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          sourceType: 'rss',
          models: {}
        }
      });

      // Update status to completed
      await this.updateProcessingStatus(rawFeed.id, 'completed');

      this.contextLogger.debug('RSS content processed', { 
        feedId: rawFeed.id,
        processedId: processed.id 
      });

      return processed;
    }, 'processContent');
  }

  private extractContent(item: RSSItem): string | null {
    // Try different content fields in order of preference
    const content = 
      (item as any).contentEncoded ||
      item.content ||
      item.contentSnippet ||
      item.title ||
      '';

    // Strip HTML tags if present
    const stripped = this.stripHtml(content);
    
    // Validate minimum content length
    return stripped.length > 50 ? stripped : null;
  }

  private stripHtml(html: string): string {
    // Basic HTML stripping (more sophisticated parsing can be added)
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private generateExternalId(item: RSSItem): string {
    // Generate a consistent ID from available fields
    const components = [
      this.source.id,
      item.title || '',
      item.pubDate || '',
      item.link || ''
    ];
    
    return Buffer.from(components.join('|')).toString('base64');
  }

  protected parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private extractKeyTopics(content: string, categories: string[]): string[] {
    const topics = new Set<string>();

    // Add categories as topics
    categories.forEach(cat => topics.add(cat.toLowerCase()));

    // Add source-specific categories
    this.source.config.categories.forEach(cat => topics.add(cat.toLowerCase()));

    // Extract potential topics from content (basic implementation)
    // In production, this would use NLP
    const words = content.toLowerCase().split(/\s+/);
    const commonTopics = [
      'market', 'economy', 'finance', 'stock', 'crypto', 'bitcoin',
      'inflation', 'recession', 'growth', 'earnings', 'trading',
      'investment', 'analysis', 'forecast', 'trend'
    ];

    commonTopics.forEach(topic => {
      if (words.includes(topic)) {
        topics.add(topic);
      }
    });

    return Array.from(topics).slice(0, 10); // Limit to 10 topics
  }
}