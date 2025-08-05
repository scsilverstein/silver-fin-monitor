// Multi-source feed processor following CLAUDE.md specification
import { BaseFeedProcessor } from './base-processor';
import { ProcessedContent, RawFeed, Result, FeedSource, BaseFeedProcessorDeps } from '../../types';
import { RSSProcessor } from './rss-processor';
import { PodcastProcessor } from './podcast-processor';
import { YouTubeProcessor } from './youtube-processor';
import { APIProcessor } from './api-processor';
import { v4 as uuidv4 } from 'uuid';

export interface MultiSourceConfig {
  sources: Array<{
    type: 'rss' | 'podcast' | 'youtube' | 'api';
    url: string;
    config?: any;
    weight?: number; // Weight for combining analysis (0-1)
    enabled?: boolean;
  }>;
  aggregationStrategy?: 'merge' | 'weighted' | 'consensus';
  deduplication?: boolean;
  crossReference?: boolean;
}

export interface AggregatedContent {
  primaryTopic: string;
  sources: Array<{
    type: string;
    title: string;
    url: string;
    publishedAt: Date;
    sentiment: number;
  }>;
  overallSentiment: number;
  keyInsights: string[];
  entities: {
    companies: Array<{ name: string; mentions: number; sentiment: number }>;
    people: Array<{ name: string; mentions: number; context: string[] }>;
    topics: Array<{ topic: string; relevance: number }>;
  };
  consensus?: {
    agreement: number; // 0-1 score of how much sources agree
    divergentViews: string[];
    commonThemes: string[];
  };
}

export class MultiSourceProcessor extends BaseFeedProcessor {
  private processors: Map<string, BaseFeedProcessor>;
  private multiConfig: MultiSourceConfig;
  private nlpService: any;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    this.multiConfig = {
      aggregationStrategy: 'weighted',
      deduplication: true,
      crossReference: true,
      ...(source.config as MultiSourceConfig)
    };

    // Initialize processors
    this.processors = new Map();
    this.initializeProcessors();
    
    // Initialize NLP service - imported dynamically to avoid circular deps
    import('../nlp/nlp.service').then(module => {
      this.nlpService = new module.NLPService();
    });
  }

  private initializeProcessors(): void {
    // Create sub-processors for each source type
    // Processors are created on-demand in fetchLatest method
    // This avoids initialization order issues
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.logger.info('Fetching multi-source feed', { source: this.source.name });

      // Check cache first
      const cacheKey = `multi:latest:${this.source.id}`;
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.info('Using cached multi-source feeds', { source: this.source.name });
        return cached as RawFeed[];
      }

      const allFeeds: RawFeed[] = [];
      const fetchPromises: Promise<void>[] = [];

      // Fetch from each configured source in parallel
      for (const subSource of this.multiConfig.sources) {
        if (subSource.enabled === false) continue;

        let processor = this.processors.get(subSource.type);
        if (!processor) {
          // Create processor on demand
          const sourceForProcessor: FeedSource = {
            ...this.source,
            url: subSource.url,
            config: { ...this.source.config, ...subSource.config }
          };
          
          try {
            switch (subSource.type) {
              case 'rss':
                const { RSSProcessor } = await import('./rss-processor');
                // RSSProcessor uses old constructor signature
                processor = new (RSSProcessor as any)(this.db, this.cache, this.nlpService || {}, this.logger);
                (processor as any).source = sourceForProcessor;
                break;
              case 'podcast':
                const { PodcastProcessor } = await import('./podcast-processor');
                // PodcastProcessor uses old constructor signature
                processor = new (PodcastProcessor as any)(this.db, this.cache, this.nlpService || {}, this.logger, null);
                (processor as any).source = sourceForProcessor;
                break;
              case 'youtube':
                const { YouTubeProcessor } = await import('./youtube-processor');
                // YouTubeProcessor uses old constructor signature
                processor = new (YouTubeProcessor as any)(this.db, this.cache, this.nlpService || {}, this.logger);
                (processor as any).source = sourceForProcessor;
                break;
              case 'api':
                const { APIProcessor } = await import('./api-processor');
                // APIProcessor uses new constructor signature
                processor = new APIProcessor(sourceForProcessor, { db: this.db, cache: this.cache, logger: this.logger });
                break;
              default:
                this.logger.warn('Unknown source type', { type: subSource.type });
                continue;
            }
            
            this.processors.set(subSource.type, processor);
          } catch (error) {
            this.logger.error('Failed to create processor', { type: subSource.type, error });
            continue;
          }
        }

        fetchPromises.push(
          processor.fetchLatest().then(feeds => {
            // Tag feeds with source type and weight
            feeds.forEach(feed => {
              feed.metadata = {
                ...feed.metadata,
                sourceType: subSource.type,
                sourceWeight: subSource.weight || 1.0,
                multiSourceId: this.source.id
              };
            });
            allFeeds.push(...feeds);
          }).catch(error => {
            this.logger.error('Failed to fetch from sub-source', { 
              type: subSource.type, 
              url: subSource.url, 
              error 
            });
          })
        );
      }

      // Wait for all fetches to complete
      await Promise.allSettled(fetchPromises);

      // Sort by published date
      allFeeds.sort((a, b) => {
        const dateA = a.publishedAt || (a as any).published_at || new Date();
        const dateB = b.publishedAt || (b as any).published_at || new Date();
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      // Apply deduplication if enabled
      let processedFeeds = allFeeds;
      if (this.multiConfig.deduplication) {
        processedFeeds = this.deduplicateFeeds(allFeeds);
      }

      // Create aggregated feed entries if cross-referencing is enabled
      if (this.multiConfig.crossReference) {
        const aggregatedFeeds = await this.createAggregatedFeeds(processedFeeds);
        processedFeeds.push(...aggregatedFeeds);
      }

      // Cache for 30 minutes
      await this.cache.set(cacheKey, processedFeeds, 1800);

      this.logger.info('Fetched multi-source feeds', { 
        source: this.source.name, 
        totalCount: allFeeds.length,
        processedCount: processedFeeds.length 
      });

      return processedFeeds;
    } catch (error) {
      this.logger.error('Failed to fetch multi-source feed', { 
        source: this.source.name, 
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    try {
      this.logger.info('Processing multi-source content', { id: rawFeed.id });

      // Check if this is an aggregated feed
      if (rawFeed.metadata?.isAggregated) {
        return this.processAggregatedContent(rawFeed);
      }

      // Get the appropriate processor for the source type
      const sourceType = rawFeed.metadata?.sourceType || 'rss';
      const processor = this.processors.get(sourceType);
      
      if (!processor) {
        throw new Error(`No processor found for source type: ${sourceType}`);
      }

      // Process with the specific processor
      const result = await processor.processContent(rawFeed);
      
      if (!result.success) {
        return result;
      }
      
      const processed = result.data;

      // Enhance with multi-source metadata
      processed.processingMetadata = {
        ...processed.processingMetadata,
        multiSource: true,
        sourceType,
        sourceWeight: rawFeed.metadata?.sourceWeight || 1.0
      };

      return { success: true, data: processed };
    } catch (error) {
      this.logger.error('Failed to process multi-source content', { 
        id: rawFeed.id, 
        error 
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  validate(feed: RawFeed): boolean {
    try {
      // Validate that we have at least one valid source
      let hasValidSource = false;

      for (const subSource of this.multiConfig.sources) {
        if (subSource.enabled === false) continue;

        const processor = this.processors.get(subSource.type);
        if (!processor) continue;

        const isValid = processor.validate(feed);

        if (isValid) {
          hasValidSource = true;
          break;
        }
      }

      return hasValidSource;
    } catch (error) {
      this.logger.error('Failed to validate multi-source', { 
        source: this.source.name, 
        error 
      });
      return false;
    }
  }

  private deduplicateFeeds(feeds: RawFeed[]): RawFeed[] {
    const seen = new Map<string, RawFeed>();
    const threshold = 0.85; // Similarity threshold

    for (const feed of feeds) {
      let isDuplicate = false;

      for (const [key, existingFeed] of seen) {
        const similarity = this.calculateSimilarity(feed, existingFeed);
        
        if (similarity > threshold) {
          isDuplicate = true;
          
          // Keep the one with more content or from higher weighted source
          const existingWeight = existingFeed.metadata?.sourceWeight || 1;
          const currentWeight = feed.metadata?.sourceWeight || 1;
          
          if (currentWeight > existingWeight || 
              (currentWeight === existingWeight && feed.content.length > existingFeed.content.length)) {
            seen.set(key, feed);
          }
          break;
        }
      }

      if (!isDuplicate) {
        seen.set(feed.externalId || (feed as any).external_id || feed.id, feed);
      }
    }

    return Array.from(seen.values());
  }

  private calculateSimilarity(feed1: RawFeed, feed2: RawFeed): number {
    // Simple similarity based on title and time proximity
    const titleSimilarity = this.stringSimilarity(feed1.title, feed2.title);
    
    // Check if published within 1 hour of each other
    const date1 = new Date(feed1.publishedAt || (feed1 as any).published_at || new Date());
    const date2 = new Date(feed2.publishedAt || (feed2 as any).published_at || new Date());
    const timeDiff = Math.abs(date1.getTime() - date2.getTime());
    const timeProximity = timeDiff < 3600000 ? 1 : 0; // 1 hour in milliseconds

    return titleSimilarity * 0.8 + timeProximity * 0.2;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async createAggregatedFeeds(feeds: RawFeed[]): Promise<RawFeed[]> {
    // Group feeds by topic/entity similarity
    const clusters = await this.clusterFeeds(feeds);
    const aggregatedFeeds: RawFeed[] = [];

    for (const cluster of clusters) {
      if (cluster.length < 2) continue; // Skip single-item clusters

      const aggregated = await this.aggregateCluster(cluster);
      if (aggregated) {
        aggregatedFeeds.push(aggregated);
      }
    }

    return aggregatedFeeds;
  }

  private async clusterFeeds(feeds: RawFeed[]): Promise<RawFeed[][]> {
    // Simple clustering based on shared entities and topics
    const clusters: RawFeed[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < feeds.length; i++) {
      if (processed.has(feeds[i].id)) continue;

      const cluster = [feeds[i]];
      processed.add(feeds[i].id);

      // Extract key terms from the first feed
      const terms1 = await this.extractKeyTerms(feeds[i]);

      for (let j = i + 1; j < feeds.length; j++) {
        if (processed.has(feeds[j].id)) continue;

        const terms2 = await this.extractKeyTerms(feeds[j]);
        const overlap = this.calculateTermOverlap(terms1, terms2);

        if (overlap > 0.3) { // 30% overlap threshold
          cluster.push(feeds[j]);
          processed.add(feeds[j].id);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private async extractKeyTerms(feed: RawFeed): Promise<Set<string>> {
    const terms = new Set<string>();
    
    // Extract from title
    const titleWords = feed.title.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3);
    titleWords.forEach(w => terms.add(w));

    // Extract entities if available
    if (feed.metadata?.entities) {
      Object.values(feed.metadata.entities).flat().forEach((entity: any) => {
        terms.add(entity.toLowerCase());
      });
    }

    return terms;
  }

  private calculateTermOverlap(terms1: Set<string>, terms2: Set<string>): number {
    const intersection = new Set([...terms1].filter(x => terms2.has(x)));
    const union = new Set([...terms1, ...terms2]);
    
    return intersection.size / union.size;
  }

  private async aggregateCluster(cluster: RawFeed[]): Promise<RawFeed | null> {
    if (cluster.length === 0) return null;

    try {
      // Sort by weight and date
      cluster.sort((a, b) => {
        const weightDiff = (b.metadata?.sourceWeight || 1) - (a.metadata?.sourceWeight || 1);
        if (weightDiff !== 0) return weightDiff;
        const dateA = a.publishedAt || new Date();
        const dateB = b.publishedAt || new Date();
        return dateB.getTime() - dateA.getTime();
      });

      const primary = cluster[0];
      const sources = cluster.map(f => ({
        type: f.metadata?.sourceType || 'unknown',
        title: f.title,
        url: (f as any).url || '',
        publishedAt: f.publishedAt || new Date(),
        sentiment: 0 // Will be calculated later
      }));

      // Combine content
      const combinedContent = cluster.map(f => 
        `[${f.metadata?.sourceType || 'Source'}] ${f.title}\n${f.content}`
      ).join('\n\n---\n\n');

      // Create aggregated feed
      return {
        id: uuidv4(),
        sourceId: primary.sourceId || (primary as any).source_id,
        title: `Multi-Source: ${primary.title}`,
        description: `Aggregated content from ${cluster.length} sources`,
        content: combinedContent,
        publishedAt: primary.publishedAt || (primary as any).published_at || new Date(),
        externalId: `aggregate_${primary.externalId || (primary as any).external_id || primary.id}`,
        metadata: {
          isAggregated: true,
          sourceCount: cluster.length,
          sources,
          primarySource: primary.metadata?.sourceType,
          aggregatedAt: new Date()
        },
        processingStatus: 'pending' as const,
        createdAt: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to aggregate cluster', { error });
      return null;
    }
  }

  private async processAggregatedContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    // Process aggregated content with special handling
    if (!this.nlpService) {
      const { NLPService } = await import('../nlp/nlp.service');
      this.nlpService = new NLPService();
    }
    
    const entities = await this.nlpService.extractEntities(rawFeed.content);
    const topics = await this.nlpService.extractTopics(rawFeed.content);
    
    // Calculate weighted sentiment
    const sentiments = await this.calculateWeightedSentiment(rawFeed);
    
    // Generate comprehensive summary
    const summary = await this.nlpService.generateSummary(rawFeed.content, 750);

    // Calculate consensus metrics
    const consensus = await this.calculateConsensus(rawFeed);

    const processedContent: ProcessedContent = {
      id: uuidv4(),
      rawFeedId: rawFeed.id,
      processedText: rawFeed.content,
      keyTopics: topics,
      sentimentScore: sentiments.overall,
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
          sentiment: 'multi-source',
          entities: 'multi-source',
          summary: 'multi-source'
        },
        isAggregated: true,
        sourceCount: rawFeed.metadata?.sourceCount || 0,
        consensus,
        sentimentBreakdown: sentiments.breakdown
      },
      createdAt: new Date()
    };
    
    return { success: true, data: processedContent };
  }

  private async calculateWeightedSentiment(feed: RawFeed): Promise<any> {
    const sources = feed.metadata?.sources || [];
    const sentiments: number[] = [];
    const weights: number[] = [];

    // Initialize NLP service if needed
    if (!this.nlpService) {
      const { NLPService } = await import('../nlp/nlp.service');
      this.nlpService = new NLPService();
    }

    // Extract sentiment for each source section
    const sections = feed.content.split('---');
    
    for (let i = 0; i < sections.length && i < sources.length; i++) {
      const sentiment = await this.nlpService.analyzeSentiment(sections[i]);
      sentiments.push(sentiment);
      weights.push(sources[i].weight || 1);
    }

    // Calculate weighted average
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < sentiments.length; i++) {
      weightedSum += sentiments[i] * weights[i];
      totalWeight += weights[i];
    }

    const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      overall,
      label: overall > 0.1 ? 'positive' : overall < -0.1 ? 'negative' : 'neutral',
      breakdown: sources.map((s, i) => ({
        source: s.type,
        sentiment: sentiments[i] || 0
      }))
    };
  }

  private async calculateConsensus(feed: RawFeed): Promise<any> {
    const sources = feed.metadata?.sources || [];
    
    if (sources.length < 2) {
      return {
        agreement: 1,
        divergentViews: [],
        commonThemes: []
      };
    }

    // This would require more sophisticated analysis
    // For now, return a placeholder
    return {
      agreement: 0.75,
      divergentViews: [],
      commonThemes: ['market volatility', 'economic uncertainty']
    };
  }
}

export default MultiSourceProcessor;