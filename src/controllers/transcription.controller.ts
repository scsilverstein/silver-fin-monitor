import { Request, Response } from 'express';
import { netlifyWhisperService } from '../services/transcription/netlify-whisper.service';
import { db } from '../services/database';
import { Logger } from '../utils/stock-logger';

const logger = new Logger('TranscriptionController');

export class TranscriptionController {
  /**
   * Get transcription status for a feed
   */
  async getTranscriptionStatus(req: Request, res: Response) {
    try {
      const { feedId } = req.params;

      const result = await netlifyWhisperService.getTranscriptionStatus(feedId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error?.message || 'Feed not found'
        });
      }

      res.json({
        success: true,
        data: result.data
      });

    } catch (error) {
      logger.error('Failed to get transcription status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transcription status'
      });
    }
  }

  /**
   * Get all active transcriptions
   */
  async getActiveTranscriptions(req: Request, res: Response) {
    try {
      const result = await netlifyWhisperService.getActiveTranscriptions();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error?.message || 'Failed to get active transcriptions'
        });
      }

      res.json({
        success: true,
        data: result.data,
        count: result.data?.length || 0
      });

    } catch (error) {
      logger.error('Failed to get active transcriptions', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve active transcriptions'
      });
    }
  }

  /**
   * Cancel a transcription
   */
  async cancelTranscription(req: Request, res: Response) {
    try {
      const { feedId } = req.params;

      const result = await netlifyWhisperService.cancelTranscription(feedId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error?.message || 'Failed to cancel transcription'
        });
      }

      res.json({
        success: true,
        message: 'Transcription cancelled successfully'
      });

    } catch (error) {
      logger.error('Failed to cancel transcription', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel transcription'
      });
    }
  }

  /**
   * Retry a failed transcription
   */
  async retryTranscription(req: Request, res: Response) {
    try {
      const { feedId } = req.params;

      const result = await netlifyWhisperService.retryTranscription(feedId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error?.message || 'Failed to retry transcription'
        });
      }

      res.json({
        success: true,
        data: {
          jobId: result.data.jobId,
          message: 'Transcription retry queued successfully'
        }
      });

    } catch (error) {
      logger.error('Failed to retry transcription', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry transcription'
      });
    }
  }

  /**
   * Get transcription statistics
   */
  async getTranscriptionStats(req: Request, res: Response) {
    try {
      const { days = 7 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));

      const { data: stats, error } = await db.getClient()
        .from('raw_feeds')
        .select('processing_status, metadata')
        .gte('created_at', startDate.toISOString())
        .not('metadata->audioUrl', 'is', null);

      if (error) {
        throw error;
      }

      // Calculate statistics
      const summary = {
        total: stats?.length || 0,
        completed: 0,
        failed: 0,
        processing: 0,
        pending: 0,
        averageProcessingTime: 0,
        totalCharacters: 0,
        languages: {} as Record<string, number>
      };

      let totalProcessingTime = 0;
      let processedCount = 0;

      stats?.forEach(feed => {
        switch (feed.processing_status) {
          case 'completed':
            summary.completed++;
            break;
          case 'failed':
            summary.failed++;
            break;
          case 'processing':
            summary.processing++;
            break;
          case 'pending':
            summary.pending++;
            break;
        }

        if (feed.metadata?.transcription?.completed) {
          if (feed.metadata.transcription.processingTimeMs) {
            totalProcessingTime += feed.metadata.transcription.processingTimeMs;
            processedCount++;
          }

          if (feed.metadata.transcription.language) {
            const lang = feed.metadata.transcription.language;
            summary.languages[lang] = (summary.languages[lang] || 0) + 1;
          }
        }

        if (feed.metadata?.content?.length) {
          summary.totalCharacters += feed.metadata.content.length;
        }
      });

      if (processedCount > 0) {
        summary.averageProcessingTime = Math.round(totalProcessingTime / processedCount);
      }

      res.json({
        success: true,
        data: {
          period: `${days} days`,
          summary,
          successRate: summary.total > 0 
            ? Math.round((summary.completed / summary.total) * 100) 
            : 0
        }
      });

    } catch (error) {
      logger.error('Failed to get transcription stats', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transcription statistics'
      });
    }
  }

  /**
   * Check service health
   */
  async checkServiceHealth(req: Request, res: Response) {
    try {
      const isAvailable = await netlifyWhisperService.isAvailable();

      res.json({
        success: true,
        data: {
          service: 'netlify-whisper',
          status: isAvailable ? 'healthy' : 'unavailable',
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to check service health', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check service health'
      });
    }
  }
}

export const transcriptionController = new TranscriptionController();