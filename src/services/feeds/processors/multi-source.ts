import { FeedSource } from '../processor';
import { logger } from '@/utils/logger';
import { RSSProcessor } from './rss';
import { YouTubeProcessor } from './youtube';
import { APIProcessor } from './api';

interface MultiSourceItem {
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  externalId: string;
  metadata: any;
}

interface SubSource {
  url: string;
  type: 'rss' | 'youtube' | 'api';
  config?: any;
}

export class MultiSourceProcessor {
  private source: FeedSource;
  private subSources: SubSource[];

  constructor(source: FeedSource) {
    this.source = source;
    this.subSources = source.config?.sources || [];
  }

  async fetchLatest(): Promise<MultiSourceItem[]> {
    try {
      logger.info('Fetching multi-source feed', { 
        source: this.source.name, 
        subSources: this.subSources.length 
      });

      const allItems: MultiSourceItem[] = [];
      const errors: any[] = [];

      // Process each sub-source in parallel
      const promises = this.subSources.map(async (subSource, index) => {
        try {
          const items = await this.processSubSource(subSource, index);
          return items;
        } catch (error) {
          logger.error('Sub-source processing failed', { 
            source: this.source.name,
            subSource: subSource.url,
            error 
          });
          errors.push({ subSource, error });
          return [];
        }
      });

      const results = await Promise.all(promises);
      
      // Flatten and merge results
      for (const items of results) {
        allItems.push(...items);
      }

      // Sort by published date (newest first)
      allItems.sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      // Log any errors
      if (errors.length > 0) {
        logger.warn('Some sub-sources failed', { 
          source: this.source.name,
          failedCount: errors.length,
          totalSources: this.subSources.length
        });
      }

      logger.info('Fetched multi-source items', { 
        source: this.source.name,
        totalItems: allItems.length,
        successfulSources: this.subSources.length - errors.length
      });

      return allItems;
    } catch (error) {
      logger.error('Multi-source fetch error', { source: this.source.name, error });
      throw error;
    }
  }

  private async processSubSource(subSource: SubSource, index: number): Promise<MultiSourceItem[]> {
    // Create a temporary source object for the processor
    const tempSource: FeedSource = {
      id: `${this.source.id}-sub-${index}`,
      name: `${this.source.name} - ${subSource.type}`,
      type: subSource.type as any,
      url: subSource.url,
      config: { ...this.source.config, ...subSource.config },
      is_active: true,
      last_processed_at: this.source.last_processed_at
    };

    let processor;
    switch (subSource.type) {
      case 'rss':
        processor = new RSSProcessor(tempSource);
        break;
      case 'youtube':
        processor = new YouTubeProcessor(tempSource);
        break;
      case 'api':
        processor = new APIProcessor(tempSource);
        break;
      default:
        throw new Error(`Unsupported sub-source type: ${subSource.type}`);
    }

    const items = await processor.fetchLatest();

    // Add source information to metadata
    return items.map(item => ({
      ...item,
      metadata: {
        ...item.metadata,
        multiSource: {
          parentSource: this.source.name,
          subSourceType: subSource.type,
          subSourceUrl: subSource.url
        }
      }
    }));
  }
}