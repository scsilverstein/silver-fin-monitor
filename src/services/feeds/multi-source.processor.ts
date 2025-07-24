// Multi-source feed processor following CLAUDE.md specification
import { FeedSource, RawFeed, ProcessedContent, Result, BaseFeedProcessorDeps } from '@/types';
import { BaseFeedProcessor } from './base.processor';
import { RSSProcessor } from './rss.processor';
import { YouTubeProcessor } from './youtube.processor';
import { APIProcessor } from './api.processor';
import { PodcastProcessor } from './podcast.processor';

interface MultiSourceConfig {
  sources: Array<{
    url: string;
    type: string;
    config?: any;
  }>;
}

export class MultiSourceProcessor extends BaseFeedProcessor {
  private processors: Map<string, BaseFeedProcessor> = new Map();

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    
    // Initialize sub-processors for each source
    this.initializeProcessors(deps);
  }

  private initializeProcessors(deps: BaseFeedProcessorDeps): void {
    const multiConfig = this.source.config as any;
    const sources = multiConfig.sources || [];

    sources.forEach((subSource: any, index: number) => {
      // Create a virtual feed source for each sub-source
      const virtualSource: FeedSource = {
        id: `${this.source.id}_sub_${index}`,
        name: `${this.source.name} - ${subSource.type}`,
        type: subSource.type,
        url: subSource.url,
        isActive: true,
        config: {
          ...this.source.config,
          ...subSource.config
        },
        createdAt: new Date()
      };

      // Create appropriate processor
      let processor: BaseFeedProcessor;
      
      switch (subSource.type) {
        case 'rss':
          processor = new RSSProcessor(virtualSource, deps);
          break;
        case 'youtube':
          processor = new YouTubeProcessor(virtualSource, deps);
          break;
        case 'api':
          processor = new APIProcessor(virtualSource, deps);
          break;
        case 'podcast':
          processor = new PodcastProcessor(virtualSource, deps);
          break;
        default:
          this.contextLogger.warn('Unknown source type in multi-source', { 
            type: subSource.type 
          });
          return;
      }

      this.processors.set(`${subSource.type}_${index}`, processor);
    });

    this.contextLogger.info('Multi-source processor initialized', { 
      source: this.source.name,
      subProcessors: this.processors.size 
    });
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.contextLogger.info('Fetching multi-source feed', { 
        source: this.source.name,
        processors: this.processors.size 
      });

      // Fetch from all sources in parallel
      const fetchPromises = Array.from(this.processors.entries()).map(
        async ([key, processor]) => {
          try {
            const feeds = await processor.fetchLatest();
            
            // Override source ID to main source
            return feeds.map(feed => ({
              ...feed,
              sourceId: this.source.id,
              metadata: {
                ...feed.metadata,
                subSource: key
              }
            }));
          } catch (error) {
            this.contextLogger.error('Sub-source fetch error', { 
              source: this.source.name,
              subSource: key,
              error 
            });
            return [];
          }
        }
      );

      // Wait for all fetches
      const results = await Promise.all(fetchPromises);
      
      // Flatten results
      const allFeeds = results.flat();

      // Update last processed timestamp
      await this.updateLastProcessed();

      this.contextLogger.info('Multi-source feed processed', { 
        source: this.source.name,
        totalItems: allFeeds.length,
        bySource: results.map((r, i) => ({
          source: Array.from(this.processors.keys())[i],
          count: r.length
        }))
      });

      return allFeeds;
    } catch (error) {
      this.contextLogger.error('Multi-source fetch error', { 
        source: this.source.name,
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    return this.withErrorHandling(async () => {
      this.contextLogger.debug('Processing multi-source content', { 
        feedId: rawFeed.id,
        title: rawFeed.title,
        subSource: rawFeed.metadata?.subSource 
      });

      // Determine which processor to use based on metadata
      const subSource = rawFeed.metadata?.subSource;
      if (!subSource) {
        throw new Error('Missing subSource metadata');
      }

      const processor = this.processors.get(subSource);
      if (!processor) {
        throw new Error(`No processor found for subSource: ${subSource}`);
      }

      // Delegate to appropriate processor
      const result = await processor.processContent(rawFeed);
      
      if (!result.success) {
        throw result.error || new Error('Processing failed');
      }

      // Add multi-source metadata
      const processed = result.data!;
      processed.processingMetadata = {
        ...processed.processingMetadata,
        multiSource: true,
        subSource
      };

      return processed;
    }, 'processContent');
  }

  // Override to handle multiple source validation
  validate(feed: RawFeed): boolean {
    // First check base validation
    if (!super.validate(feed)) {
      return false;
    }

    // Check if sub-source metadata exists
    if (!feed.metadata?.subSource) {
      this.contextLogger.warn('Multi-source feed missing subSource metadata', { 
        feedId: feed.id 
      });
      return false;
    }

    return true;
  }

  // Get statistics for all sub-sources
  async getSubSourceStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [key, processor] of this.processors) {
      const parts = key.split('_');
      const sourceType = parts[0] || 'unknown';
      const index = parts[1] || '0';
      stats[key] = {
        type: sourceType,
        index: parseInt(index),
        // Additional stats can be added here
      };
    }

    return stats;
  }
}