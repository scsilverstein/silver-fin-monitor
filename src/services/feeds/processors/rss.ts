import Parser from 'rss-parser';
import { FeedSource } from '../processor';
import { logger } from '@/utils/logger';
import { supabase } from '../../database/client';

interface RSSItem {
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  externalId: string;
  metadata: any;
}

export class RSSProcessor {
  private parser: Parser;
  private source: FeedSource;

  constructor(source: FeedSource) {
    this.source = source;
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Silver Fin Monitor/1.0'
      }
    });
  }

  async fetchLatest(): Promise<RSSItem[]> {
    try {
      logger.info('Fetching RSS feed', { source: this.source.name, url: this.source.url });

      const feed = await this.parser.parseURL(this.source.url);
      const items: RSSItem[] = [];

      // Get last processed date
      const lastProcessed = this.source.last_processed_at ? 
        new Date(this.source.last_processed_at) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago

      for (const item of feed.items || []) {
        const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();
        
        // Skip if already processed
        if (publishedDate <= lastProcessed) continue;

        // Check if already exists
        const { data: existing } = await supabase
          .from('raw_feeds')
          .select('id')
          .eq('source_id', this.source.id)
          .eq('external_id', item.guid || item.link || '')
          .single();

        if (existing) continue;

        items.push({
          title: item.title || 'Untitled',
          description: item.contentSnippet || item.summary || '',
          content: item.content || item['content:encoded'] || item.contentSnippet || '',
          publishedAt: publishedDate.toISOString(),
          externalId: item.guid || item.link || `${this.source.id}-${publishedDate.getTime()}`,
          metadata: {
            link: item.link,
            categories: item.categories,
            author: item.creator || item.author,
            enclosure: item.enclosure
          }
        });
      }

      logger.info('Fetched RSS items', { 
        source: this.source.name, 
        totalItems: feed.items?.length || 0,
        newItems: items.length 
      });

      return items;
    } catch (error) {
      logger.error('RSS fetch error', { source: this.source.name, error });
      throw error;
    }
  }
}