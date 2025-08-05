// Podcast processor following CLAUDE.md specification
import { BaseFeedProcessor } from './base-processor';
import { ProcessedContent, RawFeed, Result, FeedSource, BaseFeedProcessorDeps } from '../../types';
import { CacheService } from '../cache/cache.service';
import Parser from 'rss-parser';
import axios from 'axios';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface PodcastEpisode {
  guid: string;
  title: string;
  description: string;
  audioUrl: string;
  publishedAt: Date;
  duration?: number;
  author?: string;
  keywords?: string[];
  imageUrl?: string;
}

export interface PodcastConfig {
  extractTranscript: boolean;
  transcriptSource?: 'whisper' | 'api';
  transcriptApiUrl?: string;
  maxEpisodes?: number;
  minDuration?: number; // Skip episodes shorter than this (seconds)
  maxDuration?: number; // Skip episodes longer than this (seconds)
}

export class PodcastProcessor extends BaseFeedProcessor {
  private parser: Parser;
  private transcriptionService: any; // Will be set dynamically
  private nlpService: any; // Will be set dynamically
  private config: PodcastConfig;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    this.parser = new Parser({
      customFields: {
        item: ['enclosure', 'itunes:duration', 'itunes:author', 'itunes:keywords', 'itunes:image']
      }
    });
    this.config = {
      extractTranscript: true,
      transcriptSource: 'whisper',
      maxEpisodes: 10,
      minDuration: 60, // 1 minute
      maxDuration: 7200, // 2 hours
      ...(source.config as unknown as PodcastConfig || {})
    };
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.logger.info('Fetching podcast feed', { source: this.source.name, url: this.source.url });

      // Check cache first
      const cacheKey = `podcast:latest:${this.source.id}`;
      const cached = await this.cache.get<RawFeed[]>(cacheKey);
      if (cached) {
        this.logger.info('Using cached podcast episodes', { source: this.source.name });
        return cached;
      }

      // Fetch and parse RSS feed
      const feed = await this.parser.parseURL(this.source.url);
      
      // Get last processed date
      const lastProcessed = this.source.lastProcessedAt || new Date(0);
      
      // Filter and transform episodes
      const episodes: PodcastEpisode[] = [];
      let processedCount = 0;

      for (const item of feed.items) {
        // Skip if already processed
        if (new Date(item.pubDate || item.isoDate || '') <= lastProcessed) {
          continue;
        }

        // Extract audio URL
        const audioUrl = this.extractAudioUrl(item);
        if (!audioUrl) {
          this.logger.warn('No audio URL found for episode', { title: item.title });
          continue;
        }

        // Parse duration
        const duration = this.parseDuration(item['itunes:duration']);
        
        // Apply duration filters
        if (this.config.minDuration && duration && duration < this.config.minDuration) {
          this.logger.info('Skipping short episode', { title: item.title, duration });
          continue;
        }
        if (this.config.maxDuration && duration && duration > this.config.maxDuration) {
          this.logger.info('Skipping long episode', { title: item.title, duration });
          continue;
        }

        episodes.push({
          guid: item.guid || item.link || uuidv4(),
          title: item.title || 'Untitled Episode',
          description: item.contentSnippet || item.content || '',
          audioUrl,
          publishedAt: new Date(item.pubDate || item.isoDate || new Date()),
          duration,
          author: item['itunes:author'] || item.creator,
          keywords: this.parseKeywords(item['itunes:keywords']),
          imageUrl: item['itunes:image']?.href || feed.image?.url
        });

        processedCount++;
        if (this.config.maxEpisodes && processedCount >= this.config.maxEpisodes) {
          break;
        }
      }

      // Transform to RawFeed format
      const rawFeeds = await Promise.all(
        episodes.map(async (episode) => {
          let content = `${episode.title}\n\n${episode.description}`;
          
          // Extract transcript if configured
          if (this.config.extractTranscript) {
            try {
              const transcript = await this.extractTranscript(episode.audioUrl);
              if (transcript) {
                content = `${content}\n\nTranscript:\n${transcript}`;
              }
            } catch (error) {
              this.logger.error('Failed to extract transcript', { 
                episode: episode.title, 
                error 
              });
            }
          }

          return {
            id: uuidv4(),
            sourceId: this.source.id,
            title: episode.title,
            description: episode.description,
            content,
            publishedAt: episode.publishedAt,
            externalId: episode.guid,
            metadata: {
              type: 'podcast',
              duration: episode.duration,
              author: episode.author,
              keywords: episode.keywords,
              imageUrl: episode.imageUrl,
              audioUrl: episode.audioUrl,
              hasTranscript: content.includes('Transcript:'),
              url: episode.audioUrl
            },
            processingStatus: 'pending' as const,
            createdAt: new Date()
          } as RawFeed;
        })
      );

      // Cache for 1 hour
      await this.cache.set(cacheKey, rawFeeds, 3600);

      this.logger.info('Fetched podcast episodes', { 
        source: this.source.name, 
        count: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.logger.error('Failed to fetch podcast feed', { 
        source: this.source.name, 
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    try {
      this.logger.info('Processing podcast content', { id: rawFeed.id });

      // Initialize NLP service if needed
      if (!this.nlpService) {
        const { NLPService } = await import('../nlp/nlp.service');
        this.nlpService = new NLPService();
      }

      // Extract entities from transcript
      const entities = await this.nlpService.extractEntities(rawFeed.content);
      
      // Extract key topics - more weight on transcript content
      const topics = await this.nlpService.extractTopics(rawFeed.content, {
        maxTopics: 10,
        minScore: 0.5,
        focusOn: ['companies', 'markets', 'economics', 'technology']
      });
      
      // Analyze sentiment
      const sentiment = await this.nlpService.analyzeSentiment(rawFeed.content);
      
      // Generate summary with focus on key insights
      const summary = await this.nlpService.generateSummary(rawFeed.content, {
        maxLength: 500,
        style: 'bullet_points',
        focus: 'market_insights'
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
          podcastMetadata: {
            hasTranscript: rawFeed.content.includes('Transcript:'),
            duration: rawFeed.metadata?.duration,
            author: rawFeed.metadata?.author
          }
        },
        createdAt: new Date()
      };

      return { success: true, data: processedContent };
    } catch (error) {
      this.logger.error('Failed to process podcast content', { id: rawFeed.id, error });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  validate(feed: RawFeed): boolean {
    try {
      // Check required fields
      if (!feed.title || !feed.content) {
        return false;
      }

      // Check if it's a podcast feed
      if (feed.metadata?.type !== 'podcast') {
        return false;
      }

      // Check if we have audio URL
      if (!feed.metadata?.audioUrl) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to validate podcast feed', { feed: feed.id, error });
      return false;
    }
  }

  private extractAudioUrl(item: any): string | null {
    // Check enclosure first (standard podcast format)
    if (item.enclosure?.url && item.enclosure?.type?.includes('audio')) {
      return item.enclosure.url;
    }

    // Check for direct audio links in content
    const content = item.content || item.contentSnippet || '';
    const audioUrlMatch = content.match(/https?:\/\/[^\s]+\.(mp3|m4a|wav|ogg)/i);
    if (audioUrlMatch) {
      return audioUrlMatch[0];
    }

    return null;
  }

  private parseDuration(duration: string | number | undefined): number | undefined {
    if (!duration) return undefined;
    
    if (typeof duration === 'number') return duration;
    
    // Parse HH:MM:SS or MM:SS format
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    
    return undefined;
  }

  private parseKeywords(keywords: string | undefined): string[] {
    if (!keywords) return [];
    return keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }

  private async extractTranscript(audioUrl: string): Promise<string | null> {
    try {
      // Initialize transcription service if needed
      if (!this.transcriptionService) {
        try {
          const { TranscriptionService } = await import('../transcription/transcription.service');
          this.transcriptionService = new TranscriptionService();
        } catch {
          this.logger.warn('Transcription service not available');
          return null;
        }
      }

      // Check if transcript is available from API
      if (this.config.transcriptSource === 'api' && this.config.transcriptApiUrl) {
        try {
          const response = await axios.get(this.config.transcriptApiUrl, {
            params: { audioUrl },
            timeout: 30000
          });
          return response.data.transcript;
        } catch (error) {
          this.logger.warn('Failed to fetch transcript from API', { error });
        }
      }

      // Use local Whisper transcription
      if (this.transcriptionService) {
        return await this.transcriptionService.transcribeAudio(audioUrl);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to extract transcript', { audioUrl, error });
      return null;
    }
  }
}

export default PodcastProcessor;