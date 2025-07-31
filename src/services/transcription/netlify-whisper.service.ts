// Netlify Whisper Service - Triggers background transcription functions
import axios from 'axios';
import { Logger } from '../../utils/stock-logger';
import { db } from '../database';
import { cache } from '../cache';
import { Result } from '../../types';

const logger = new Logger('NetlifyWhisperService');

interface TranscriptionRequest {
  feedId: string;
  audioUrl: string;
  title?: string;
  metadata?: Record<string, any>;
}

interface TranscriptionStatus {
  feedId: string;
  status: 'queued' | 'downloading' | 'transcribing' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class NetlifyWhisperService {
  private readonly functionUrl: string;
  private readonly apiKey?: string;

  constructor() {
    // Use environment variable or construct from site URL
    const siteUrl = process.env.SITE_URL || process.env.URL || 'http://localhost:9999';
    this.functionUrl = `${siteUrl}/.netlify/functions/transcribe-audio-background`;
    this.apiKey = process.env.NETLIFY_FUNCTION_API_KEY; // Optional API key for security
  }

  /**
   * Queue audio transcription using Netlify background function
   */
  async transcribeAudio(
    audioUrl: string,
    feedId: string,
    metadata?: Record<string, any>
  ): Promise<Result<{ jobId: string }>> {
    try {
      logger.info('Queuing audio transcription', { feedId, audioUrl });

      // Check if already processing
      const lockKey = `transcription:${feedId}`;
      const existingLock = await cache.get(lockKey);
      if (existingLock) {
        return { 
          success: false, 
          error: new Error('Transcription already in progress for this feed') 
        };
      }

      // Set lock for 30 minutes
      await cache.set(lockKey, true, 1800);

      // Get feed details for title
      const { data: feed } = await db.getClient()
        .from('raw_feeds')
        .select('title, metadata')
        .eq('id', feedId)
        .single();

      const request: TranscriptionRequest = {
        feedId,
        audioUrl,
        title: feed?.title,
        metadata: {
          ...feed?.metadata,
          ...metadata
        }
      };

      // Trigger background function
      const response = await axios.post(
        this.functionUrl,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'X-API-Key': this.apiKey })
          },
          timeout: 10000 // 10 second timeout for triggering
        }
      );

      // Background functions return immediately with 202 Accepted
      if (response.status === 202) {
        logger.info('Transcription job queued successfully', { 
          feedId,
          jobId: response.headers['x-nf-background-id'] 
        });

        // Update feed status
        await db.getClient()
          .from('raw_feeds')
          .update({
            processing_status: 'processing',
            metadata: db.getClient().rpc('jsonb_merge', {
              target: 'metadata',
              source: JSON.stringify({
                transcription: {
                  status: 'queued',
                  queuedAt: new Date().toISOString(),
                  backgroundJobId: response.headers['x-nf-background-id']
                }
              })
            })
          })
          .eq('id', feedId);

        return {
          success: true,
          data: { jobId: response.headers['x-nf-background-id'] || feedId }
        };
      }

      return {
        success: false,
        error: new Error(`Unexpected response status: ${response.status}`)
      };

    } catch (error) {
      logger.error('Failed to queue transcription', error);
      
      // Release lock on error
      await cache.delete(`transcription:${feedId}`);
      
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Check transcription status
   */
  async getTranscriptionStatus(feedId: string): Promise<Result<TranscriptionStatus>> {
    try {
      const { data: feed, error } = await db.getClient()
        .from('raw_feeds')
        .select('processing_status, metadata, content')
        .eq('id', feedId)
        .single();

      if (error || !feed) {
        return {
          success: false,
          error: new Error('Feed not found')
        };
      }

      const transcriptionMeta = feed.metadata?.transcription || {};
      
      // Determine status
      let status: TranscriptionStatus['status'] = 'queued';
      if (feed.processing_status === 'completed' && feed.content) {
        status = 'completed';
      } else if (feed.processing_status === 'failed') {
        status = 'failed';
      } else if (transcriptionMeta.status) {
        status = transcriptionMeta.status;
      }

      const statusData: TranscriptionStatus = {
        feedId,
        status,
        progress: transcriptionMeta.progress,
        error: transcriptionMeta.error,
        startedAt: transcriptionMeta.startedAt ? new Date(transcriptionMeta.startedAt) : undefined,
        completedAt: transcriptionMeta.completedAt ? new Date(transcriptionMeta.completedAt) : undefined
      };

      return {
        success: true,
        data: statusData
      };

    } catch (error) {
      logger.error('Failed to get transcription status', error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Cancel transcription (if possible)
   */
  async cancelTranscription(feedId: string): Promise<Result<void>> {
    try {
      // Release lock
      await cache.delete(`transcription:${feedId}`);

      // Update status
      await db.getClient()
        .from('raw_feeds')
        .update({
          processing_status: 'failed',
          metadata: db.getClient().rpc('jsonb_merge', {
            target: 'metadata',
            source: JSON.stringify({
              transcription: {
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
              }
            })
          })
        })
        .eq('id', feedId);

      logger.info('Transcription cancelled', { feedId });
      return { success: true, data: undefined };

    } catch (error) {
      logger.error('Failed to cancel transcription', error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Retry failed transcription
   */
  async retryTranscription(feedId: string): Promise<Result<{ jobId: string }>> {
    try {
      // Get feed details
      const { data: feed, error } = await db.getClient()
        .from('raw_feeds')
        .select('metadata')
        .eq('id', feedId)
        .single();

      if (error || !feed) {
        return {
          success: false,
          error: new Error('Feed not found')
        };
      }

      const audioUrl = feed.metadata?.audioUrl || feed.metadata?.audio_url;
      if (!audioUrl) {
        return {
          success: false,
          error: new Error('No audio URL found for feed')
        };
      }

      // Clear previous error state
      await db.getClient()
        .from('raw_feeds')
        .update({
          processing_status: 'pending',
          metadata: db.getClient().rpc('jsonb_merge', {
            target: 'metadata',
            source: JSON.stringify({
              transcription: {
                retryCount: (feed.metadata?.transcription?.retryCount || 0) + 1,
                lastRetryAt: new Date().toISOString()
              }
            })
          })
        })
        .eq('id', feedId);

      // Queue new transcription
      return this.transcribeAudio(audioUrl, feedId, feed.metadata);

    } catch (error) {
      logger.error('Failed to retry transcription', error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Get all active transcriptions
   */
  async getActiveTranscriptions(): Promise<Result<TranscriptionStatus[]>> {
    try {
      const { data: feeds, error } = await db.getClient()
        .from('raw_feeds')
        .select('id, processing_status, metadata')
        .eq('processing_status', 'processing')
        .not('metadata->transcription', 'is', null);

      if (error) {
        throw error;
      }

      const statuses: TranscriptionStatus[] = [];
      
      for (const feed of feeds || []) {
        const statusResult = await this.getTranscriptionStatus(feed.id);
        if (statusResult.success && statusResult.data) {
          statuses.push(statusResult.data);
        }
      }

      return {
        success: true,
        data: statuses
      };

    } catch (error) {
      logger.error('Failed to get active transcriptions', error);
      return {
        success: false,
        error: error as Error
      };
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if function endpoint is reachable
      const response = await axios.get(
        this.functionUrl.replace('-background', ''), // Health check endpoint
        { timeout: 5000 }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const netlifyWhisperService = new NetlifyWhisperService();