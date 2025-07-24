import { FeedSource } from '../processor';
import { logger } from '@/utils/logger';
import { supabase } from '../../database/client';
import axios from 'axios';
import config from '@/config';

interface YouTubeItem {
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  externalId: string;
  metadata: any;
}

interface YouTubeVideoSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    default: { url: string };
    medium: { url: string };
    high: { url: string };
  };
  channelTitle: string;
}

interface YouTubeVideo {
  id: string;
  snippet: YouTubeVideoSnippet;
  contentDetails?: {
    duration: string;
  };
}

export class YouTubeProcessor {
  private source: FeedSource;
  private apiKey: string | null;

  constructor(source: FeedSource) {
    this.source = source;
    this.apiKey = config.youtube?.apiKey || null;
  }

  async fetchLatest(): Promise<YouTubeItem[]> {
    try {
      logger.info('Fetching YouTube feed', { source: this.source.name, url: this.source.url });

      // Extract channel ID from URL
      const channelId = this.extractChannelId(this.source.url);
      if (!channelId) {
        throw new Error('Invalid YouTube channel URL');
      }

      // If no API key, try RSS feed fallback
      if (!this.apiKey) {
        return this.fetchViaRSS(channelId);
      }

      // Fetch via YouTube API
      const items: YouTubeItem[] = [];
      
      // Get last processed date
      const lastProcessed = this.source.last_processed_at ? 
        new Date(this.source.last_processed_at) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Search for videos from channel
      const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
      const searchParams = {
        part: 'snippet',
        channelId: channelId,
        order: 'date',
        type: 'video',
        maxResults: 50,
        publishedAfter: lastProcessed.toISOString(),
        key: this.apiKey
      };

      const searchResponse = await axios.get(searchUrl, { params: searchParams });
      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);

      if (videoIds.length === 0) {
        logger.info('No new YouTube videos found', { source: this.source.name });
        return [];
      }

      // Get video details
      const videosUrl = 'https://www.googleapis.com/youtube/v3/videos';
      const videosParams = {
        part: 'snippet,contentDetails',
        id: videoIds.join(','),
        key: this.apiKey
      };

      const videosResponse = await axios.get(videosUrl, { params: videosParams });
      const videos: YouTubeVideo[] = videosResponse.data.items;

      for (const video of videos) {
        const publishedDate = new Date(video.snippet.publishedAt);
        
        // Check if already exists
        const { data: existing } = await supabase
          .from('raw_feeds')
          .select('id')
          .eq('source_id', this.source.id)
          .eq('external_id', video.id)
          .single();

        if (existing) continue;

        // Get transcript if configured
        let transcript = '';
        if (this.source.config?.extract_video_transcript) {
          try {
            transcript = await this.getTranscript(video.id);
          } catch (error) {
            logger.error('Failed to get YouTube transcript', { error, videoId: video.id });
          }
        }

        items.push({
          title: video.snippet.title,
          description: video.snippet.description,
          content: transcript || video.snippet.description,
          publishedAt: publishedDate.toISOString(),
          externalId: video.id,
          metadata: {
            videoId: video.id,
            channelId: video.snippet.channelId,
            channelTitle: video.snippet.channelTitle,
            thumbnails: video.snippet.thumbnails,
            duration: video.contentDetails?.duration,
            videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
            hasTranscript: !!transcript
          }
        });
      }

      logger.info('Fetched YouTube items', { 
        source: this.source.name, 
        totalItems: videos.length,
        newItems: items.length 
      });

      return items;
    } catch (error) {
      logger.error('YouTube fetch error', { source: this.source.name, error });
      throw error;
    }
  }

  private extractChannelId(url: string): string | null {
    // Handle different YouTube URL formats
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        // For @handle URLs, we need to resolve to channel ID
        if (url.includes('/@')) {
          // This would require an API call to resolve
          logger.warn('Handle-based URLs require API to resolve', { url });
        }
        return match[1] || null;
      }
    }

    // Check if it's already a channel ID
    if (url.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
      return url;
    }

    return null;
  }

  private async fetchViaRSS(channelId: string): Promise<YouTubeItem[]> {
    try {
      logger.info('Falling back to YouTube RSS feed', { channelId });
      
      // YouTube provides RSS feeds for channels
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      
      // Use RSS parser (we'd import and use the RSS processor logic here)
      // For now, returning empty array as fallback
      logger.warn('RSS fallback not fully implemented', { channelId });
      return [];
    } catch (error) {
      logger.error('YouTube RSS fallback failed', { error });
      return [];
    }
  }

  private async getTranscript(videoId: string): Promise<string> {
    // YouTube doesn't provide transcripts via API
    // Would need to use a third-party service or YouTube-DL
    logger.info('Transcript extraction requested', { videoId });
    
    // Placeholder - in production, this would:
    // 1. Try YouTube's auto-generated captions
    // 2. Use a service like youtube-transcript-api
    // 3. Fall back to audio transcription with Whisper
    
    return '';
  }
}