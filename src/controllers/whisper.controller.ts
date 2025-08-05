// Whisper service controller for monitoring and controlling transcription service
import { Request, Response, NextFunction } from 'express';
import { db } from '@/services/database/index';
import { asyncHandler, AsyncHandler } from '@/middleware/error';
import { ApiResponse } from '@/types';
import { createContextLogger } from '@/utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const whisperLogger = createContextLogger('WhisperController');

interface WhisperStatus {
  isRunning: boolean;
  version?: string | undefined;
  modelLoaded?: string | undefined;
  lastUsed?: string | undefined;
  totalTranscriptions?: number | undefined;
  averageProcessingTime?: number | undefined;
}

interface TranscriptionQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessingTime?: number;
}

export class WhisperController {
  // Get Whisper service status
  getStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    whisperLogger.debug('Getting Whisper service status');

    try {
      // Check if Whisper is available by trying to run whisper --help
      let isRunning = false;
      let version: string | undefined = undefined;
      
      try {
        const pythonPath = process.env.PYTHON_PATH || './venv/bin/python3';
        const { stdout } = await execAsync(`${pythonPath} -c "import whisper; print(whisper.__version__)"`, { timeout: 5000 });
        if (stdout.trim()) {
          isRunning = true;
          version = stdout.trim();
        }
      } catch (error: any) {
        whisperLogger.debug('Whisper not available or not responding', { error: error.message });
      }

      // Get transcription statistics from database
      const stats = await this.getTranscriptionStats();

      const status: WhisperStatus = {
        isRunning,
        version,
        modelLoaded: isRunning ? 'base' : undefined, // Default to base model
        lastUsed: stats.lastUsed || undefined,
        totalTranscriptions: stats.totalTranscriptions,
        averageProcessingTime: stats.averageProcessingTime
      };

      whisperLogger.info('Whisper status retrieved', { isRunning, totalTranscriptions: stats.totalTranscriptions });

      res.json({
        success: true,
        data: status
      } as ApiResponse<WhisperStatus>);
    } catch (error) {
      whisperLogger.error('Failed to get Whisper status', { error });
      // Return default status if we can't determine the actual status
      res.json({
        success: true,
        data: {
          isRunning: false,
          totalTranscriptions: 0
        }
      } as ApiResponse<WhisperStatus>);
    }
  });

  // Start Whisper service (placeholder - Whisper runs on-demand)
  startService = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    whisperLogger.info('Whisper service start requested');

    try {
      // Test if Whisper is available - use the virtual environment Python
      const pythonPath = process.env.PYTHON_PATH || './venv/bin/python3';
      const command = `${pythonPath} -c "import whisper; print('Whisper available')"`;
      
      whisperLogger.debug('Testing Whisper availability', { command });
      await execAsync(command, { timeout: 10000 });
      
      whisperLogger.info('Whisper service is available');
      
      res.json({
        success: true,
        data: {
          message: 'Whisper service is available and ready for transcription',
          status: 'running'
        }
      });
    } catch (error: any) {
      whisperLogger.error('Failed to start Whisper service', { error: error.message });
      res.status(400).json({
        success: false,
        error: {
          message: 'Whisper service is not available. Please ensure Python and Whisper are installed.',
          details: error.message
        }
      });
    }
  });

  // Stop Whisper service (placeholder - Whisper runs on-demand)
  stopService = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    whisperLogger.info('Whisper service stop requested');

    // Since Whisper runs on-demand, we can't really "stop" it
    // But we can acknowledge the request
    res.json({
      success: true,
      data: {
        message: 'Whisper runs on-demand, no persistent service to stop',
        status: 'stopped'
      }
    });
  });

  // Restart Whisper service
  restartService = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    whisperLogger.info('Whisper service restart requested');

    try {
      // Test Whisper availability as a "restart"
      const pythonPath = process.env.PYTHON_PATH || './venv/bin/python3';
      await execAsync(`${pythonPath} -c "import whisper; print('Whisper restarted')"`, { timeout: 10000 });
      
      whisperLogger.info('Whisper service restarted successfully');
      
      res.json({
        success: true,
        data: {
          message: 'Whisper service availability confirmed',
          status: 'running'
        }
      });
    } catch (error: any) {
      whisperLogger.error('Failed to restart Whisper service', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to restart Whisper service'
      });
    }
  });

  // Get transcription queue status
  getTranscriptionQueue = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    whisperLogger.debug('Getting transcription queue status');

    try {
      // Get transcription job statistics from job_queue
      const queueStats = await db.query<{
        status: string;
        count: number;
      }>(`
        SELECT 
          status,
          COUNT(*) as count
        FROM job_queue 
        WHERE job_type IN ('transcribe_audio', 'podcast_transcription')
        GROUP BY status
      `);

      // Get processing time statistics
      const processingTimeStats = await db.query<{
        avg_duration: number;
        total_duration: number;
      }>(`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration,
          SUM(EXTRACT(EPOCH FROM (completed_at - started_at))) as total_duration
        FROM job_queue 
        WHERE job_type IN ('transcribe_audio', 'podcast_transcription')
        AND status = 'completed'
        AND started_at IS NOT NULL 
        AND completed_at IS NOT NULL
      `);

      // Transform results
      const stats: TranscriptionQueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalProcessingTime: processingTimeStats[0]?.total_duration || 0
      };

      queueStats.forEach(stat => {
        switch (stat.status) {
          case 'pending':
          case 'retry':
            stats.pending += Number(stat.count);
            break;
          case 'processing':
            stats.processing = Number(stat.count);
            break;
          case 'completed':
            stats.completed = Number(stat.count);
            break;
          case 'failed':
            stats.failed += Number(stat.count);
            break;
        }
      });

      whisperLogger.info('Transcription queue status retrieved', stats);

      res.json({
        success: true,
        data: stats
      } as ApiResponse<TranscriptionQueueStats>);
    } catch (error) {
      whisperLogger.error('Failed to get transcription queue status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transcription queue status'
      });
    }
  });

  // Helper method to get transcription statistics
  private async getTranscriptionStats() {
    try {
      const stats = await db.query<{
        total_transcriptions: number;
        avg_processing_time: number;
        last_used: string;
      }>(`
        SELECT 
          COUNT(*) as total_transcriptions,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_processing_time,
          MAX(completed_at) as last_used
        FROM job_queue 
        WHERE job_type IN ('transcribe_audio', 'podcast_transcription')
        AND status = 'completed'
      `);

      return {
        totalTranscriptions: Number(stats[0]?.total_transcriptions || 0),
        averageProcessingTime: Number(stats[0]?.avg_processing_time || 0),
        lastUsed: stats[0]?.last_used || null
      };
    } catch (error) {
      whisperLogger.error('Failed to get transcription stats', { error });
      return {
        totalTranscriptions: 0,
        averageProcessingTime: 0,
        lastUsed: null
      };
    }
  }
}

export const whisperController = new WhisperController();