// Podcast feed processor following CLAUDE.md specification
import Parser from 'rss-parser';
import axios from 'axios';
import { FeedSource, RawFeed, ProcessedContent, Result, BaseFeedProcessorDeps, ContentEntity } from '../../types';
import { BaseFeedProcessor } from './base.processor';
import { v4 as uuidv4 } from 'uuid';

interface PodcastItem {
  title?: string;
  link?: string;
  pubDate?: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  isoDate?: string;
  enclosure?: {
    url?: string;
    type?: string;
    length?: string;
  };
  itunes?: {
    duration?: string;
    explicit?: string;
    keywords?: string;
    author?: string;
    summary?: string;
    episode?: string;
    season?: string;
  };
}

export class PodcastProcessor extends BaseFeedProcessor {
  private parser: Parser;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    
    // Configure parser for podcast feeds
    this.parser = new Parser({
      headers: this.source.config.customHeaders || {},
      timeout: 30000,
      customFields: {
        feed: [
          ['itunes:author', 'itunesAuthor'],
          ['itunes:category', 'itunesCategory']
        ] as any,
        item: [
          ['itunes:duration', 'itunesDuration'],
          ['itunes:explicit', 'itunesExplicit'],
          ['itunes:keywords', 'itunesKeywords'],
          ['itunes:author', 'itunesAuthor'],
          ['itunes:summary', 'itunesSummary'],
          ['itunes:episode', 'itunesEpisode'],
          ['itunes:season', 'itunesSeason']
        ] as any
      }
    });
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      await this.checkRateLimit();
      
      this.contextLogger.info('Fetching podcast feed', { 
        source: this.source.name,
        url: this.source.url 
      });

      // Fetch and parse podcast RSS feed
      const feed = await this.parser.parseURL(this.source.url);
      
      this.contextLogger.debug('Podcast feed parsed', { 
        source: this.source.name,
        episodeCount: feed.items?.length || 0 
      });

      // Filter and process episodes
      const rawFeeds: RawFeed[] = [];
      
      for (const item of feed.items || []) {
        const podcastItem = item as any;
        
        // Generate external ID
        const externalId = podcastItem.guid || 
                          podcastItem.enclosure?.url || 
                          this.generateExternalId(podcastItem);
        
        // Check if already processed
        if (await this.feedExists(externalId)) {
          continue;
        }

        // Extract episode metadata
        const metadata = this.extractPodcastMetadata(podcastItem, feed);
        
        // Get transcript if available or queue for transcription
        const content = await this.getTranscriptContent(podcastItem, metadata);
        
        if (!content) {
          // If no transcript yet, still save for later processing
          metadata.needsTranscription = true;
        }

        // Create raw feed
        const rawFeed = await this.saveRawFeed({
          sourceId: this.source.id,
          title: podcastItem.title || 'Untitled Episode',
          description: (podcastItem as any).itunesSummary || 
                      podcastItem.content || 
                      podcastItem.contentSnippet || '',
          content: content || 'Transcript pending',
          publishedAt: this.parseDate(podcastItem.pubDate || podcastItem.isoDate),
          externalId,
          metadata,
          processingStatus: content ? 'pending' : 'pending' // Will need transcript processing
        });

        rawFeeds.push(rawFeed);
      }

      // Update last processed timestamp
      await this.updateLastProcessed();

      this.contextLogger.info('Podcast feed processed', { 
        source: this.source.name,
        newEpisodes: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.contextLogger.error('Podcast feed fetch error', { 
        source: this.source.name,
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    return this.withErrorHandling(async () => {
      this.contextLogger.debug('Processing podcast content', { 
        feedId: rawFeed.id,
        title: rawFeed.title 
      });

      // Update status to processing
      await this.updateProcessingStatus(rawFeed.id, 'processing');

      // Check if needs transcription
      if (rawFeed.metadata?.needsTranscription && rawFeed.metadata?.audioUrl) {
        // Check if Whisper service is available
        const { whisperService } = await import('../transcription/whisper.service');
        const whisperAvailable = await whisperService.isAvailable();
        
        if (whisperAvailable) {
          // Queue transcription job with Whisper
          const { supabase } = await import('../database/client');
          await supabase.rpc('enqueue_job', {
            job_type: 'transcribe_audio',
            payload: {
              feedId: rawFeed.id,
              audioUrl: rawFeed.metadata.audioUrl,
              title: rawFeed.title,
              originalMetadata: rawFeed.metadata
            },
            priority: 2 // High priority
          });
          
          this.contextLogger.info('Queued podcast for Whisper transcription', { 
            feedId: rawFeed.id,
            audioUrl: rawFeed.metadata.audioUrl
          });
        } else {
          this.contextLogger.warn('Whisper service not available, using description only', {
            feedId: rawFeed.id
          });
        }
        
        // Return early - will be processed after transcription
        return {
          id: uuidv4(),
          rawFeedId: rawFeed.id,
          processedText: 'Awaiting transcription',
          keyTopics: [],
          entities: [],
          summary: 'Transcript pending',
          processingMetadata: {
            processorVersion: '1.0.0',
            processingTime: Date.now(),
            sourceType: 'podcast',
            status: 'pending_transcription',
            whisperAvailable,
            models: {}
          },
          createdAt: new Date()
        };
      }

      // Process existing transcript
      const processedText = this.normalizeText(rawFeed.content || '');
      
      // Extract key topics
      const keyTopics = this.extractKeyTopics(
        processedText,
        rawFeed.metadata?.keywords || []
      );

      // Extract guests if configured
      const entities: ContentEntity[] = [];
      if (this.source.config.extractGuests && rawFeed.metadata?.guests) {
        rawFeed.metadata.guests.forEach((guest: string) => {
          entities.push({ name: guest, type: 'person' });
        });
      }

      // Generate summary
      const summary = this.extractSummary(processedText, 800); // Longer summary for podcasts

      // Create processed content
      const processed = await this.db.create<ProcessedContent>('processed_content', {
        rawFeedId: rawFeed.id,
        processedText: processedText,
        keyTopics: keyTopics,
        summary,
        entities,
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          sourceType: 'podcast',
          duration: rawFeed.metadata?.duration,
          hasTranscript: true,
          models: {}
        }
      });

      // Update status to completed
      await this.updateProcessingStatus(rawFeed.id, 'completed');

      this.contextLogger.debug('Podcast content processed', { 
        feedId: rawFeed.id,
        processedId: processed.id 
      });

      return processed;
    }, 'processContent');
  }

  private extractPodcastMetadata(item: PodcastItem, feed: any): Record<string, any> {
    const metadata: Record<string, any> = {
      podcastTitle: feed.title,
      podcastAuthor: feed.itunesAuthor || feed.creator,
      episodeNumber: (item as any).itunesEpisode,
      seasonNumber: (item as any).itunesSeason,
      duration: this.parseDuration((item as any).itunesDuration),
      explicit: (item as any).itunesExplicit === 'yes',
      keywords: (item as any).itunesKeywords?.split(',').map((k: string) => k.trim()) || [],
      link: item.link,
      audioUrl: item.enclosure?.url,
      audioType: item.enclosure?.type,
      audioSize: item.enclosure?.length ? parseInt(item.enclosure.length) : undefined
    };

    // Extract potential guest names from title/description
    if (this.source.config.extractGuests) {
      metadata.guests = this.extractGuestNames(
        item.title || '',
        (item as any).itunesSummary || item.content || ''
      );
    }

    return metadata;
  }

  private async getTranscriptContent(
    item: PodcastItem, 
    metadata: Record<string, any>
  ): Promise<string | null> {
    // Check if transcript source is configured
    if (this.source.config.transcriptSource) {
      try {
        // Try to fetch transcript from external source
        const transcript = await this.fetchExternalTranscript(
          item,
          this.source.config.transcriptSource
        );
        if (transcript) return transcript;
      } catch (error) {
        this.contextLogger.warn('Failed to fetch external transcript', { 
          error,
          episode: item.title 
        });
      }
    }

    // Check if we should process transcript
    if (this.source.config.processTranscript && metadata.audioUrl) {
      // Return null to queue for transcription
      return null;
    }

    // Use description as fallback
    return (item as any).itunesSummary || item.content || item.contentSnippet || null;
  }

  private async fetchExternalTranscript(
    item: PodcastItem,
    transcriptSource: string
  ): Promise<string | null> {
    // Implementation would depend on transcript source
    // This is a placeholder for different transcript APIs
    try {
      // Example: fetch from podcast website
      if (transcriptSource.includes('{episodeId}') && item.guid) {
        const url = transcriptSource.replace('{episodeId}', item.guid);
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
      }
    } catch (error) {
      return null;
    }
    
    return null;
  }

  private parseDuration(duration?: string): number | undefined {
    if (!duration) return undefined;
    
    // Parse different duration formats (HH:MM:SS, MM:SS, seconds)
    const parts = duration.split(':').map(p => parseInt(p));
    
    if (parts.length === 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!)) {
      return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    } else if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
      return parts[0]! * 60 + parts[1]!;
    } else if (parts.length === 1 && !isNaN(parts[0]!)) {
      return parts[0]!;
    }
    
    return undefined;
  }

  private generateExternalId(item: PodcastItem): string {
    const components = [
      this.source.id,
      item.title || '',
      item.pubDate || '',
      item.enclosure?.url || ''
    ];
    
    return Buffer.from(components.join('|')).toString('base64');
  }

  private extractKeyTopics(content: string, keywords: string[]): string[] {
    const topics = new Set<string>();

    // Add keywords as topics
    keywords.forEach(kw => topics.add(kw.toLowerCase()));

    // Add source categories
    this.source.config.categories.forEach(cat => topics.add(cat.toLowerCase()));

    // Extract podcast-specific topics
    const podcastTopics = [
      'interview', 'discussion', 'analysis', 'market', 'economy',
      'investment', 'trading', 'finance', 'technology', 'startup'
    ];

    const words = content.toLowerCase().split(/\s+/);
    podcastTopics.forEach(topic => {
      if (words.filter(w => w.includes(topic)).length > 2) {
        topics.add(topic);
      }
    });

    return Array.from(topics).slice(0, 15);
  }

  protected parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  protected extractSummary(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) return content;
    
    // Find the last complete sentence within maxLength
    const truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > maxLength * 0.8) {
      return content.substring(0, lastSentenceEnd + 1).trim();
    }
    
    return truncated.trim() + '...';
  }

  private extractGuestNames(title: string, description: string): string[] {
    const guests: string[] = [];
    
    // Common patterns for guest mentions
    const patterns = [
      /with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
      /featuring\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
      /guest[s]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
      /joined by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g
    ];

    const text = `${title} ${description}`;
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !guests.includes(match[1])) {
          guests.push(match[1]);
        }
      }
    });

    return guests;
  }
}