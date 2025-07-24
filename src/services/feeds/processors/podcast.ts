import Parser from 'rss-parser';
import { FeedSource } from '../processor';
import { logger } from '@/utils/logger';
import { supabase } from '../../database/client';
import { OpenAI } from 'openai';
import config from '@/config';

interface PodcastItem {
  title: string;
  description: string;
  content: string;
  publishedAt: string;
  externalId: string;
  metadata: any;
}

export class PodcastProcessor {
  private parser: Parser;
  private source: FeedSource;
  private openai: OpenAI | null = null;

  constructor(source: FeedSource) {
    this.source = source;
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Silver Fin Monitor/1.0'
      },
      customFields: {
        item: [
          ['itunes:duration', 'duration'],
          ['itunes:summary', 'summary'],
          ['itunes:episode', 'episode'],
          ['itunes:season', 'season']
        ]
      }
    });

    // Initialize OpenAI if we need to transcribe
    if (source.config?.process_transcript && config.openai.apiKey) {
      this.openai = new OpenAI({ apiKey: config.openai.apiKey });
    }
  }

  async fetchLatest(): Promise<PodcastItem[]> {
    try {
      logger.info('Fetching podcast feed', { source: this.source.name, url: this.source.url });

      const feed = await this.parser.parseURL(this.source.url);
      const items: PodcastItem[] = [];

      // Get last processed date
      const lastProcessed = this.source.last_processed_at ? 
        new Date(this.source.last_processed_at) : 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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

        // Extract audio URL
        const audioUrl = item.enclosure?.url || item.link;
        
        // Get transcript if needed
        let transcript = '';
        if (this.source.config?.process_transcript && audioUrl) {
          try {
            transcript = await this.getTranscript(audioUrl, item);
          } catch (error) {
            logger.error('Failed to get transcript', { error, item: item.title });
          }
        }

        items.push({
          title: item.title || 'Untitled Episode',
          description: item.contentSnippet || item.summary || item['itunes:summary'] || '',
          content: transcript || item.content || item.description || '',
          publishedAt: publishedDate.toISOString(),
          externalId: item.guid || item.link || `${this.source.id}-${publishedDate.getTime()}`,
          metadata: {
            link: item.link,
            audioUrl,
            duration: item['duration'],
            episode: item['episode'],
            season: item['season'],
            hasTranscript: !!transcript,
            guests: this.extractGuests(item)
          }
        });
      }

      logger.info('Fetched podcast items', { 
        source: this.source.name, 
        totalItems: feed.items?.length || 0,
        newItems: items.length 
      });

      return items;
    } catch (error) {
      logger.error('Podcast fetch error', { source: this.source.name, error });
      throw error;
    }
  }

  private async getTranscript(audioUrl: string, item: any): Promise<string> {
    // First check if transcript is available via API
    if (this.source.config?.transcript_source) {
      try {
        // This would call a transcript API service
        logger.info('Checking for existing transcript', { source: this.source.name });
        // For now, return empty - would implement actual API call
        return '';
      } catch (error) {
        logger.warn('Transcript API failed', { error });
      }
    }

    // For now, we'll just return a placeholder
    // In production, this would use Whisper API or another transcription service
    logger.info('Would transcribe audio', { audioUrl, duration: item['duration'] });
    return '';
  }

  private extractGuests(item: any): string[] {
    const guests: string[] = [];
    
    // Look for guest information in description
    const description = item.description || item.contentSnippet || '';
    const guestMatch = description.match(/(?:guest|with|featuring|joined by)[\s:]+([^,.]+)/gi);
    
    if (guestMatch) {
      guestMatch.forEach((match: string) => {
        const guest = match.replace(/(?:guest|with|featuring|joined by)[\s:]+/i, '').trim();
        if (guest.length > 2 && guest.length < 50) {
          guests.push(guest);
        }
      });
    }

    return guests;
  }
}