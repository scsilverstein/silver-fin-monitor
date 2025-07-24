// YouTube feed processor following CLAUDE.md specification
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { FeedSource, RawFeed, ProcessedContent, Result, BaseFeedProcessorDeps } from '@/types';
import { BaseFeedProcessor } from './base.processor';
import { v4 as uuidv4 } from 'uuid';

interface YouTubeEntry {
  id?: string[];
  title?: string[];
  link?: Array<{ $: { href: string } }>;
  author?: Array<{ name: string[] }>;
  published?: string[];
  updated?: string[];
  'media:group'?: Array<{
    'media:description'?: string[];
    'media:thumbnail'?: Array<{ $: { url: string } }>;
  }>;
  'yt:videoId'?: string[];
  'yt:channelId'?: string[];
}

export class YouTubeProcessor extends BaseFeedProcessor {
  private youtubeApiKey: string;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    this.youtubeApiKey = process.env.YOUTUBE_API_KEY || '';
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      await this.checkRateLimit();
      
      this.contextLogger.info('Fetching YouTube feed', { 
        source: this.source.name,
        url: this.source.url 
      });

      // Extract channel ID from URL
      const channelId = this.extractChannelId(this.source.url);
      if (!channelId) {
        throw new Error('Invalid YouTube channel URL');
      }

      // Fetch YouTube RSS feed
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const response = await axios.get(feedUrl, {
        timeout: 30000,
        headers: this.source.config.customHeaders || {}
      });

      // Parse XML feed
      const feedData = await parseStringPromise(response.data);
      const entries = feedData.feed?.entry || [];

      this.contextLogger.debug('YouTube feed parsed', { 
        source: this.source.name,
        videoCount: entries.length 
      });

      // Process videos
      const rawFeeds: RawFeed[] = [];
      
      for (const entry of entries) {
        const videoId = entry['yt:videoId']?.[0];
        if (!videoId) continue;

        // Check if already processed
        if (await this.feedExists(videoId)) {
          continue;
        }

        // Extract video metadata
        const metadata = await this.extractVideoMetadata(entry, videoId);
        
        // Get transcript if configured
        let content = entry['media:group']?.[0]?.['media:description']?.[0] || '';
        
        if (this.source.config.extractVideoTranscript) {
          const transcript = await this.getVideoTranscript(videoId);
          if (transcript) {
            content = transcript;
            metadata.hasTranscript = true;
          } else {
            metadata.needsTranscription = true;
          }
        }

        // Create raw feed
        const rawFeed = await this.saveRawFeed({
          sourceId: this.source.id,
          title: entry.title?.[0] || 'Untitled Video',
          description: entry['media:group']?.[0]?.['media:description']?.[0] || '',
          content,
          publishedAt: this.parseDate(entry.published?.[0]),
          externalId: videoId,
          metadata,
          processingStatus: 'pending'
        });

        rawFeeds.push(rawFeed);
      }

      // Update last processed timestamp
      await this.updateLastProcessed();

      this.contextLogger.info('YouTube feed processed', { 
        source: this.source.name,
        newVideos: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.contextLogger.error('YouTube feed fetch error', { 
        source: this.source.name,
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    return this.withErrorHandling(async () => {
      this.contextLogger.debug('Processing YouTube content', { 
        feedId: rawFeed.id,
        title: rawFeed.title 
      });

      // Update status to processing
      await this.updateProcessingStatus(rawFeed.id, 'processing');

      // Check if needs transcription
      if (rawFeed.metadata?.needsTranscription && !rawFeed.metadata?.hasTranscript) {
        // Queue transcription job
        const { queue } = await import('@/services/queue');
        await queue.enqueue('transcribe_video', {
          feedId: rawFeed.id,
          videoId: rawFeed.externalId
        }, 2);
        
        this.contextLogger.info('Queued video for transcription', { 
          feedId: rawFeed.id 
        });
        
        // Return early - will be processed after transcription
        return {
          id: uuidv4(),
          rawFeedId: rawFeed.id,
          processedText: 'Awaiting transcription',
          keyTopics: [],
          entities: {},
          summary: 'Transcript pending',
          processingMetadata: {
            processorVersion: '1.0.0',
            processingTime: Date.now(),
            sourceType: 'youtube',
            status: 'pending_transcription',
            models: {}
          },
          createdAt: new Date()
        };
      }

      // Process content
      const processedText = this.normalizeText(rawFeed.content || '');
      
      // Extract key topics from video metadata and content
      const keyTopics = this.extractKeyTopics(
        processedText,
        rawFeed.metadata?.tags || []
      );

      // Generate summary
      const summary = this.extractSummary(processedText, 600);

      // Create processed content
      const processed = await this.db.create<ProcessedContent>('processed_content', {
        rawFeedId: rawFeed.id,
        processedText: processedText,
        keyTopics: keyTopics,
        summary,
        entities: {},
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          sourceType: 'youtube',
          videoId: rawFeed.externalId,
          duration: rawFeed.metadata?.duration,
          viewCount: rawFeed.metadata?.viewCount,
          hasTranscript: rawFeed.metadata?.hasTranscript || false,
          models: {}
        }
      });

      // Update status to completed
      await this.updateProcessingStatus(rawFeed.id, 'completed');

      this.contextLogger.debug('YouTube content processed', { 
        feedId: rawFeed.id,
        processedId: processed.id 
      });

      return processed;
    }, 'processContent');
  }

  private extractChannelId(url: string): string | null {
    // Handle different YouTube URL formats
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/feeds\/videos\.xml\?channel_id=([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // If direct channel ID is provided
    if (url.match(/^[a-zA-Z0-9_-]+$/)) {
      return url;
    }

    return null;
  }

  private async extractVideoMetadata(
    entry: YouTubeEntry, 
    videoId: string
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      videoId,
      channelId: entry['yt:channelId']?.[0],
      channelName: entry.author?.[0]?.name?.[0],
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: entry['media:group']?.[0]?.['media:thumbnail']?.[0]?.$?.url,
      publishedAt: entry.published?.[0],
      updatedAt: entry.updated?.[0]
    };

    // If YouTube API key is available, fetch additional metadata
    if (this.youtubeApiKey && this.source.config.extractVideoTranscript) {
      try {
        const apiData = await this.fetchVideoDetails(videoId);
        if (apiData) {
          metadata.duration = this.parseDuration(apiData.duration);
          metadata.viewCount = parseInt(apiData.viewCount) || 0;
          metadata.likeCount = parseInt(apiData.likeCount) || 0;
          metadata.commentCount = parseInt(apiData.commentCount) || 0;
          metadata.tags = apiData.tags || [];
          metadata.categoryId = apiData.categoryId;
        }
      } catch (error) {
        this.contextLogger.warn('Failed to fetch YouTube API data', { 
          videoId, 
          error 
        });
      }
    }

    return metadata;
  }

  private async fetchVideoDetails(videoId: string): Promise<any> {
    if (!this.youtubeApiKey) return null;

    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            part: 'contentDetails,statistics,snippet',
            id: videoId,
            key: this.youtubeApiKey
          },
          timeout: 10000
        }
      );

      if (response.data.items && response.data.items.length > 0) {
        const item = response.data.items[0];
        return {
          duration: item.contentDetails?.duration,
          viewCount: item.statistics?.viewCount,
          likeCount: item.statistics?.likeCount,
          commentCount: item.statistics?.commentCount,
          tags: item.snippet?.tags,
          categoryId: item.snippet?.categoryId
        };
      }
    } catch (error) {
      this.contextLogger.error('YouTube API error', { error });
    }

    return null;
  }

  private async getVideoTranscript(videoId: string): Promise<string | null> {
    // YouTube doesn't provide transcripts via API
    // This would need to use a third-party service or YouTube-DL
    // For now, return null to queue for later processing
    return null;
  }

  private parseDuration(duration?: string): number | undefined {
    if (!duration) return undefined;

    // Parse ISO 8601 duration (PT#H#M#S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  private extractKeyTopics(content: string, tags: string[]): string[] {
    const topics = new Set<string>();

    // Add video tags
    tags.forEach(tag => topics.add(tag.toLowerCase()));

    // Add source categories
    this.source.config.categories.forEach(cat => topics.add(cat.toLowerCase()));

    // Extract video-specific topics
    const videoTopics = [
      'tutorial', 'review', 'analysis', 'news', 'update',
      'prediction', 'forecast', 'market', 'trading', 'investing'
    ];

    const words = content.toLowerCase().split(/\s+/);
    videoTopics.forEach(topic => {
      if (words.filter(w => w.includes(topic)).length > 1) {
        topics.add(topic);
      }
    });

    return Array.from(topics).slice(0, 20);
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
}