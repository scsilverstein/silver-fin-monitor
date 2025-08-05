import BaseFeedProcessor, { RawFeed } from './base-feed-processor';
import Parser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';

export class RSSFeedProcessor extends BaseFeedProcessor {
  private parser: Parser;

  constructor(...args: ConstructorParameters<typeof BaseFeedProcessor>) {
    super(...args);
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Silver Fin Monitor/1.0',
        ...this.source.config.custom_headers
      }
    });
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.logger.info(`Fetching RSS feed from ${this.source.url}`);
      
      const feed = await this.parser.parseURL(this.source.url);
      
      this.logger.info(`Parsed ${feed.items?.length || 0} items from ${feed.title || 'Unknown Feed'}`);
      
      const rawFeeds: RawFeed[] = [];
      
      for (const item of feed.items || []) {
        try {
          const rawFeed: RawFeed = {
            id: uuidv4(),
            source_id: this.source.id,
            title: item.title || 'Untitled',
            description: item.contentSnippet || item.content || '',
            content: await this.extractContent(item),
            published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
            external_id: item.guid || item.link || this.generateExternalId(item),
            metadata: {
              link: item.link,
              author: item.creator || item.author,
              categories: item.categories,
              enclosure: item.enclosure,
              feed_title: feed.title,
              feed_description: feed.description
            },
            processing_status: 'pending'
          };
          
          rawFeeds.push(rawFeed);
        } catch (error) {
          this.logger.error(`Error processing RSS item:`, error);
        }
      }
      
      // Filter by date if last_processed_at is set
      if (this.source.last_processed_at) {
        return rawFeeds.filter(feed => 
          feed.published_at > this.source.last_processed_at!
        );
      }
      
      return rawFeeds;
    } catch (error) {
      this.logger.error('RSS feed fetch error:', error);
      throw error;
    }
  }

  async extractContent(item: any): Promise<string> {
    // Prefer full content over snippet
    let content = item.content || item.contentSnippet || item.description || '';
    
    // Clean HTML if present
    content = this.stripHtml(content);
    
    // Add title to content for better context
    if (item.title && !content.includes(item.title)) {
      content = `${item.title}\n\n${content}`;
    }
    
    return content.trim();
  }

  validateContent(feed: RawFeed): boolean {
    // Basic validation
    if (!feed.content || feed.content.length < 10) {
      return false;
    }
    
    // Check for required fields
    if (!feed.title || !feed.external_id) {
      return false;
    }
    
    // Additional RSS-specific validation
    if (feed.content.includes('<script') || feed.content.includes('</script>')) {
      this.logger.warn('Suspicious content detected, skipping');
      return false;
    }
    
    return true;
  }

  // RSS-specific methods
  private stripHtml(html: string): string {
    // Basic HTML stripping
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private generateExternalId(item: any): string {
    // Generate unique ID from item properties
    const parts = [
      this.source.id,
      item.title || '',
      item.pubDate || new Date().toISOString()
    ];
    
    return Buffer.from(parts.join('|')).toString('base64');
  }

  // Override entity extraction with RSS-specific logic
  protected async extractEntities(content: string): Promise<any> {
    const entities = await super.extractEntities(content);
    
    // Extract companies from common RSS patterns
    const companyPatterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc\.|Corp\.|LLC|Ltd\.|Company|Co\.)/g,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+\([A-Z]{2,5}:[A-Z]{1,5}\)/g // Company (EXCHANGE:TICKER)
    ];
    
    for (const pattern of companyPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !entities.companies.includes(match[1])) {
          entities.companies.push(match[1]);
        }
      }
    }
    
    // Extract people names (basic pattern)
    const personPattern = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+said|\s+says|\s+stated|,\s+CEO|,\s+President|,\s+analyst)/g;
    const peopleMatches = content.matchAll(personPattern);
    for (const match of peopleMatches) {
      if (match[1] && !entities.people.includes(match[1])) {
        entities.people.push(match[1]);
      }
    }
    
    return entities;
  }

  // Override summary generation for RSS content
  protected async generateSummary(content: string): Promise<string> {
    // For RSS, try to extract first paragraph after title
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return content.substring(0, 200).trim() + '...';
    }
    
    // Skip title (usually first line)
    const bodyStart = lines.length > 1 ? 1 : 0;
    const firstParagraph = lines.slice(bodyStart).find(line => line.length > 50);
    
    if (firstParagraph) {
      return firstParagraph.substring(0, 250).trim() + '...';
    }
    
    return lines.slice(bodyStart, bodyStart + 2).join(' ').substring(0, 250).trim() + '...';
  }
}

export default RSSFeedProcessor;