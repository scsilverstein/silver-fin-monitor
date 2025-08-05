// YouTube processor following CLAUDE.md specification
import { BaseFeedProcessor } from './base-processor';
import { ProcessedContent, RawFeed, Result, FeedSource, BaseFeedProcessorDeps } from '../../types';
import { CacheService } from '../cache/cache.service';
import { NLPService } from '../nlp/nlp.service';
import winston from 'winston';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: Date;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  transcript?: string;
}

export interface YouTubeConfig {
  apiKey?: string;
  extractTranscript: boolean;
  maxVideos?: number;
  minDuration?: number; // seconds
  maxDuration?: number; // seconds
  minViews?: number;
  sortBy?: 'date' | 'viewCount' | 'relevance';
}

export class YouTubeProcessor extends BaseFeedProcessor {
  private config: YouTubeConfig;
  private apiBaseUrl = 'https://www.googleapis.com/youtube/v3';
  private nlpService: NLPService;

  constructor(source: FeedSource, deps: BaseFeedProcessorDeps) {
    super(source, deps);
    this.nlpService = new NLPService();
    this.config = {
      apiKey: process.env.YOUTUBE_API_KEY,
      extractTranscript: true,
      maxVideos: 10,
      minDuration: 60, // 1 minute
      maxDuration: 3600, // 1 hour
      sortBy: 'date',
      ...(source.config as unknown as YouTubeConfig || {})
    };
  }

  async fetchLatest(): Promise<RawFeed[]> {
    try {
      this.logger.info('Fetching YouTube channel', { source: this.source.name, url: this.source.url });

      if (!this.config.apiKey) {
        throw new Error('YouTube API key not configured');
      }

      // Check cache first
      const cacheKey = `youtube:latest:${this.source.id}`;
      const cached = await this.cache.get<RawFeed[]>(cacheKey);
      if (cached) {
        this.logger.info('Using cached YouTube videos', { source: this.source.name });
        return cached;
      }

      // Extract channel ID from URL
      const channelId = this.extractChannelId(this.source.url);
      if (!channelId) {
        throw new Error('Invalid YouTube channel URL');
      }

      // Get channel uploads playlist
      const uploadsPlaylistId = await this.getUploadsPlaylistId(channelId);
      
      // Fetch recent videos
      const videos = await this.fetchChannelVideos(
        uploadsPlaylistId,
        this.source.lastProcessedAt
      );

      // Get video details including duration
      const videoIds = videos.map(v => v.videoId);
      const videoDetails = await this.fetchVideoDetails(videoIds);

      // Filter videos based on configuration
      const filteredVideos = this.filterVideos(videos, videoDetails);

      // Extract transcripts if configured
      if (this.config.extractTranscript) {
        await this.extractTranscripts(filteredVideos);
      }

      // Transform to RawFeed format
      const rawFeeds = filteredVideos.map(video => {
        let content = `${video.title}\n\n${video.description}`;
        
        if (video.transcript) {
          content = `${content}\n\nTranscript:\n${video.transcript}`;
        }

        if (video.tags && video.tags.length > 0) {
          content = `${content}\n\nTags: ${video.tags.join(', ')}`;
        }

        return {
          id: uuidv4(),
          sourceId: this.source.id,
          title: video.title,
          description: video.description,
          content,
          publishedAt: video.publishedAt,
          externalId: video.videoId,
          url: `https://www.youtube.com/watch?v=${video.videoId}`,
          metadata: {
            type: 'youtube',
            videoId: video.videoId,
            channelId: video.channelId,
            channelTitle: video.channelTitle,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            commentCount: video.commentCount,
            tags: video.tags,
            hasTranscript: !!video.transcript
          },
          processingStatus: 'pending' as const,
          createdAt: new Date()
        } as RawFeed;
      });

      // Cache for 1 hour
      await this.cache.set(cacheKey, rawFeeds, 3600);

      this.logger.info('Fetched YouTube videos', { 
        source: this.source.name, 
        count: rawFeeds.length 
      });

      return rawFeeds;
    } catch (error) {
      this.logger.error('Failed to fetch YouTube channel', { 
        source: this.source.name, 
        error 
      });
      throw error;
    }
  }

  async processContent(rawFeed: RawFeed): Promise<Result<ProcessedContent>> {
    try {
      this.logger.info('Processing YouTube content', { id: rawFeed.id });

      // Extract entities
      const entities = await this.nlpService.extractEntities(rawFeed.content);
      
      // Extract key topics with video-specific focus
      const topics = await this.nlpService.extractTopics(rawFeed.content);
      
      // Analyze sentiment
      const sentiment = await this.nlpService.analyzeSentiment(rawFeed.content);
      
      // Generate summary
      const summary = await this.nlpService.generateSummary(rawFeed.content);

      // Extract timestamps from transcript
      const timestamps = this.extractTimestamps(rawFeed.content);

      const processedContent: ProcessedContent = {
        id: uuidv4(),
        rawFeedId: rawFeed.id,
        processedText: rawFeed.content,
        keyTopics: topics,
        sentimentScore: sentiment,
        entities: [
          ...entities.companies.map((name: string) => ({ name, type: 'company' as const })),
          ...entities.people.map((name: string) => ({ name, type: 'person' as const })),
          ...entities.locations.map((name: string) => ({ name, type: 'location' as const })),
          ...entities.tickers.map((name: string) => ({ name, type: 'ticker' as const }))
        ],
        summary,
        processingMetadata: {
          processorVersion: '1.0.0',
          processingTime: Date.now(),
          models: {
            sentiment: 'basic',
            entities: 'basic',
            summary: 'basic'
          },
          hasTranscript: rawFeed.metadata?.hasTranscript || false,
          videoMetrics: {
            views: rawFeed.metadata?.viewCount,
            likes: rawFeed.metadata?.likeCount,
            comments: rawFeed.metadata?.commentCount
          },
          timestamps: timestamps.length > 0 ? timestamps : undefined
        },
        createdAt: new Date()
      };

      return { success: true, data: processedContent };
    } catch (error) {
      this.logger.error('Failed to process YouTube content', { 
        id: rawFeed.id, 
        error 
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async validateSource(source: any): Promise<boolean> {
    try {
      const channelId = this.extractChannelId(source.url);
      if (!channelId) {
        return false;
      }

      if (!this.config.apiKey) {
        this.logger.warn('YouTube API key not configured');
        return false;
      }

      // Try to fetch channel info
      const response = await axios.get(`${this.apiBaseUrl}/channels`, {
        params: {
          part: 'snippet',
          id: channelId,
          key: this.config.apiKey
        }
      });

      return response.data.items && response.data.items.length > 0;
    } catch (error) {
      this.logger.error('Failed to validate YouTube source', { 
        source: source.name, 
        error 
      });
      return false;
    }
  }

  private extractChannelId(url: string): string | null {
    // Handle various YouTube URL formats
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If it's already a channel ID
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(url)) {
      return url;
    }

    return null;
  }

  private async getUploadsPlaylistId(channelId: string): Promise<string> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/channels`, {
        params: {
          part: 'contentDetails',
          id: channelId,
          key: this.config.apiKey
        }
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Channel not found');
      }

      return response.data.items[0].contentDetails.relatedPlaylists.uploads;
    } catch (error) {
      this.logger.error('Failed to get uploads playlist', { channelId, error });
      throw error;
    }
  }

  private async fetchChannelVideos(
    playlistId: string,
    lastProcessedAt?: Date
  ): Promise<YouTubeVideo[]> {
    try {
      const videos: YouTubeVideo[] = [];
      let nextPageToken: string | undefined;
      let fetchedCount = 0;

      do {
        const response = await axios.get(`${this.apiBaseUrl}/playlistItems`, {
          params: {
            part: 'snippet',
            playlistId,
            maxResults: Math.min(50, this.config.maxVideos || 50),
            pageToken: nextPageToken,
            key: this.config.apiKey
          }
        });

        for (const item of response.data.items) {
          const publishedAt = new Date(item.snippet.publishedAt);
          
          // Skip if already processed
          if (lastProcessedAt && publishedAt <= lastProcessedAt) {
            continue;
          }

          videos.push({
            videoId: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            publishedAt,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl: item.snippet.thumbnails.high?.url || 
                         item.snippet.thumbnails.default?.url || ''
          });

          fetchedCount++;
          if (this.config.maxVideos && fetchedCount >= this.config.maxVideos) {
            break;
          }
        }

        nextPageToken = response.data.nextPageToken;
      } while (
        nextPageToken && 
        (!this.config.maxVideos || fetchedCount < this.config.maxVideos)
      );

      return videos;
    } catch (error) {
      this.logger.error('Failed to fetch channel videos', { playlistId, error });
      throw error;
    }
  }

  private async fetchVideoDetails(videoIds: string[]): Promise<Map<string, any>> {
    if (videoIds.length === 0) {
      return new Map();
    }

    try {
      const details = new Map<string, any>();
      
      // YouTube API allows up to 50 IDs per request
      const chunks = this.chunkArray(videoIds, 50);

      for (const chunk of chunks) {
        const response = await axios.get(`${this.apiBaseUrl}/videos`, {
          params: {
            part: 'contentDetails,statistics',
            id: chunk.join(','),
            key: this.config.apiKey
          }
        });

        for (const item of response.data.items) {
          details.set(item.id, {
            duration: this.parseDuration(item.contentDetails.duration),
            viewCount: parseInt(item.statistics.viewCount) || 0,
            likeCount: parseInt(item.statistics.likeCount) || 0,
            commentCount: parseInt(item.statistics.commentCount) || 0,
            tags: item.snippet?.tags || []
          });
        }
      }

      return details;
    } catch (error) {
      this.logger.error('Failed to fetch video details', { error });
      return new Map();
    }
  }

  private filterVideos(
    videos: YouTubeVideo[],
    details: Map<string, any>
  ): YouTubeVideo[] {
    return videos.filter(video => {
      const detail = details.get(video.videoId);
      if (!detail) return true; // Include if we couldn't get details

      // Apply duration filters
      if (this.config.minDuration && detail.duration < this.config.minDuration) {
        return false;
      }
      if (this.config.maxDuration && detail.duration > this.config.maxDuration) {
        return false;
      }

      // Apply view count filter
      if (this.config.minViews && detail.viewCount < this.config.minViews) {
        return false;
      }

      // Merge details into video object
      Object.assign(video, detail);

      return true;
    });
  }

  private async extractTranscripts(videos: YouTubeVideo[]): Promise<void> {
    for (const video of videos) {
      try {
        const transcript = await this.fetchTranscript(video.videoId);
        if (transcript) {
          video.transcript = transcript;
        }
      } catch (error) {
        this.logger.warn('Failed to extract transcript', { 
          videoId: video.videoId, 
          error 
        });
      }
    }
  }

  private async fetchTranscript(videoId: string): Promise<string | null> {
    try {
      // Check cache first
      const cacheKey = `youtube:transcript:${videoId}`;
      const cached = await this.cache.get<string>(cacheKey);
      if (cached) {
        return cached;
      }

      // YouTube doesn't provide official transcript API
      // You would need to use youtube-transcript or similar library
      // For now, returning null - implement with actual transcript service
      
      // Example implementation with youtube-transcript library:
      // const transcript = await YouTubeTranscript.fetchTranscript(videoId);
      // const text = transcript.map(t => t.text).join(' ');
      // await this.cache.set(cacheKey, text, 7 * 24 * 3600);
      // return text;

      return null;
    } catch (error) {
      this.logger.warn('Failed to fetch transcript', { videoId, error });
      return null;
    }
  }

  private parseDuration(isoDuration: string): number {
    // Parse ISO 8601 duration (e.g., PT4M13S)
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  private extractTimestamps(content: string): Array<{ time: string; text: string }> {
    const timestamps: Array<{ time: string; text: string }> = [];
    
    // Look for timestamp patterns in transcript
    const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*([^\n]+)/g;
    
    let match;
    while ((match = timestampRegex.exec(content)) !== null) {
      timestamps.push({
        time: match[1],
        text: match[2].trim()
      });
    }

    return timestamps;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Helper method to get channel info
  async getChannelInfo(channelId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/channels`, {
        params: {
          part: 'snippet,statistics',
          id: channelId,
          key: this.config.apiKey
        }
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const channel = response.data.items[0];
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        publishedAt: channel.snippet.publishedAt,
        thumbnailUrl: channel.snippet.thumbnails.high?.url,
        viewCount: parseInt(channel.statistics.viewCount) || 0,
        subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
        videoCount: parseInt(channel.statistics.videoCount) || 0
      };
    } catch (error) {
      this.logger.error('Failed to get channel info', { channelId, error });
      throw error;
    }
  }

  validate(feed: RawFeed): boolean {
    try {
      // Check required fields
      if (!feed.title || !feed.content) {
        return false;
      }

      // Check if it's a YouTube feed
      if (feed.metadata?.type !== 'youtube') {
        return false;
      }

      // Validate content length
      if (feed.content.length < 10) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to validate YouTube feed', { feed: feed.id, error });
      return false;
    }
  }
}

export default YouTubeProcessor;