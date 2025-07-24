// Transcription worker for processing audio transcription jobs
import { logger } from '@/utils/logger';
import { whisperService } from '@/services/transcription/whisper.service';
import { supabase } from '@/services/database/client';
import { aiAnalysisService } from '@/services/ai/analysis';
import { contentProcessor } from '@/services/content/processor';

interface TranscriptionJob {
  feedId: string;
  audioUrl: string;
  priority?: number;
  retryCount?: number;
}

export class TranscriptionWorker {
  private isProcessing = false;
  private shouldStop = false;

  async start(): Promise<void> {
    logger.info('Starting transcription worker...');
    
    // Check if Whisper is available
    const isAvailable = await whisperService.isAvailable();
    if (!isAvailable) {
      logger.error('Whisper service not available. Worker cannot start.');
      return;
    }

    this.shouldStop = false;
    this.processJobs();
  }

  async stop(): Promise<void> {
    logger.info('Stopping transcription worker...');
    this.shouldStop = true;
    
    // Wait for current job to finish
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async processJobs(): Promise<void> {
    while (!this.shouldStop) {
      try {
        // Get next transcription job
        const job = await this.getNextJob();
        
        if (!job) {
          // No jobs available, wait before checking again
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        this.isProcessing = true;
        await this.processJob(job);
        this.isProcessing = false;

      } catch (error) {
        logger.error('Error in transcription worker', { error });
        this.isProcessing = false;
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s on error
      }
    }
  }

  private async getNextJob(): Promise<TranscriptionJob | null> {
    try {
      // Get next transcription job from queue
      const { data: jobs } = await supabase
        .rpc('dequeue_job')
        .eq('job_type', 'transcribe_audio');

      if (!jobs || jobs.length === 0) {
        return null;
      }

      const job = jobs[0];
      return {
        feedId: job.payload.feedId,
        audioUrl: job.payload.audioUrl,
        priority: job.priority,
        retryCount: job.attempts
      };
    } catch (error) {
      logger.error('Failed to get transcription job', { error });
      return null;
    }
  }

  private async processJob(job: TranscriptionJob): Promise<void> {
    const { feedId, audioUrl } = job;
    logger.info('Processing transcription job', { feedId, audioUrl });

    try {
      // Get the raw feed
      const { data: rawFeed, error: feedError } = await supabase
        .from('raw_feeds')
        .select('*')
        .eq('id', feedId)
        .single();

      if (feedError || !rawFeed) {
        throw new Error(`Feed not found: ${feedId}`);
      }

      // Transcribe audio
      const startTime = Date.now();
      const transcription = await whisperService.transcribeAudio(audioUrl, feedId);
      const processingTime = Date.now() - startTime;

      logger.info('Transcription completed', {
        feedId,
        duration: transcription.duration,
        textLength: transcription.text.length,
        processingTime
      });

      // Update raw feed with transcript
      const { error: updateError } = await supabase
        .from('raw_feeds')
        .update({
          content: transcription.text,
          metadata: {
            ...rawFeed.metadata,
            transcription: {
              completed: true,
              language: transcription.language,
              duration: transcription.duration,
              processingTime,
              processedAt: new Date().toISOString()
            }
          }
        })
        .eq('id', feedId);

      if (updateError) {
        throw updateError;
      }

      // Now process the content with NLP
      await this.processTranscribedContent(feedId, rawFeed);

      // Mark job as completed
      await this.completeJob(job);

    } catch (error) {
      logger.error('Transcription job failed', { error, feedId });
      await this.failJob(job, error);
    }
  }

  private async processTranscribedContent(feedId: string, rawFeed: any): Promise<void> {
    try {
      // Check if already processed
      const { data: existing } = await supabase
        .from('processed_content')
        .select('id')
        .eq('raw_feed_id', feedId)
        .single();

      if (existing) {
        logger.info('Content already processed, skipping', { feedId });
        return;
      }

      // Process with content processor
      await contentProcessor.processContent(feedId);

      logger.info('Transcribed content processed', { 
        feedId
      });

      // Update processing status
      await supabase
        .from('raw_feeds')
        .update({ processing_status: 'completed' })
        .eq('id', feedId);

    } catch (error) {
      logger.error('Failed to process transcribed content', { error, feedId });
      
      // Update status to failed
      await supabase
        .from('raw_feeds')
        .update({ processing_status: 'failed' })
        .eq('id', feedId);
    }
  }

  private async completeJob(job: TranscriptionJob): Promise<void> {
    // Implementation would mark job as completed in job_queue
    logger.info('Transcription job completed', { feedId: job.feedId });
  }

  private async failJob(job: TranscriptionJob, error: any): Promise<void> {
    // Implementation would mark job as failed in job_queue
    logger.error('Transcription job failed', { 
      feedId: job.feedId,
      error: error.message,
      retryCount: job.retryCount 
    });
  }
}

// Export singleton instance
export const transcriptionWorker = new TranscriptionWorker();