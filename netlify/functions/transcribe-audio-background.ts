// Netlify Background Function for Audio Transcription
// Uses OpenAI's Whisper API with intelligent chunking for long audio files

import type { BackgroundHandler, Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import axios from 'axios';
import FormData from 'form-data';
import AudioChunker, { getAudioMetadata, isValidAudioUrl } from './utils/audio-chunker';

// Function configuration
export const config: Config = {
  type: 'background' // This makes it a background function with 15-minute timeout
};

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// Constants
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB - OpenAI's limit
const CHUNK_DURATION = 600; // 10 minutes per chunk for safety
const SUPPORTED_FORMATS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];

interface TranscriptionRequest {
  feedId: string;
  audioUrl: string;
  title?: string;
  metadata?: Record<string, any>;
}

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  chunks?: number;
  processingTime?: number;
}

// Helper function to download audio with progress tracking
async function downloadAudio(url: string, onProgress?: (progress: number) => void): Promise<Buffer> {
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'arraybuffer',
    timeout: 300000, // 5 minutes
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SilverFinMonitor/1.0)'
    },
    onDownloadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        onProgress(progress);
      }
    }
  });

  return Buffer.from(response.data);
}

// Initialize audio chunker
const audioChunker = new AudioChunker({
  maxChunkSize: MAX_FILE_SIZE,
  maxChunkDuration: CHUNK_DURATION,
  overlap: 5, // 5 seconds overlap for continuity
  format: 'mp3'
});

// Main transcription function
async function transcribeAudio(
  audioBuffer: Buffer, 
  format: string, 
  feedId: string,
  metadata?: any
): Promise<TranscriptionResult> {
  console.log(`Starting transcription for feed ${feedId}, size: ${Math.round(audioBuffer.length / 1024)}KB`);
  
  // Get audio chunks using the smart chunker
  const chunks = await audioChunker.chunkAudio(audioBuffer, metadata);
  console.log(`Audio split into ${chunks.length} chunks`);
  
  const transcriptions: Array<{ text: string; startTime?: number; endTime?: number }> = [];
  let detectedLanguage: string | undefined;
  
  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}`);
    
    try {
      // Create form data for OpenAI API
      const formData = new FormData();
      formData.append('file', chunks[i].buffer, {
        filename: `audio_chunk_${i}.${format}`,
        contentType: `audio/${format}`
      });
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      
      // Use axios for more control over the request
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );
      
      const result = response.data;
      transcriptions.push({
        text: result.text,
        startTime: chunks[i].startTime,
        endTime: chunks[i].endTime
      });
      
      if (!detectedLanguage && result.language) {
        detectedLanguage = result.language;
      }
      
      // Update progress in database
      await updateTranscriptionProgress(feedId, {
        status: 'processing',
        progress: Math.round(((i + 1) / chunks.length) * 100),
        chunksProcessed: i + 1,
        totalChunks: chunks.length
      });
      
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      throw new Error(`Transcription failed at chunk ${i + 1}: ${error.message}`);
    }
  }
  
  // Merge transcriptions intelligently
  const fullText = audioChunker.mergeTranscriptions(transcriptions);
  
  return {
    text: fullText,
    language: detectedLanguage,
    chunks: chunks.length,
    duration: chunks.reduce((sum, chunk) => sum + chunk.duration, 0)
  };
}

// Update transcription progress in database
async function updateTranscriptionProgress(feedId: string, progress: Record<string, any>) {
  try {
    // First get current metadata
    const { data: currentFeed, error: fetchError } = await supabase
      .from('raw_feeds')
      .select('metadata')
      .eq('id', feedId)
      .single();
    
    if (fetchError) {
      console.error('Failed to fetch current metadata:', fetchError);
      return;
    }
    
    // Merge metadata
    const updatedMetadata = {
      ...(currentFeed?.metadata || {}),
      transcription: {
        ...(currentFeed?.metadata?.transcription || {}),
        ...progress,
        lastUpdated: new Date().toISOString()
      }
    };
    
    // Update with merged metadata
    const { error } = await supabase
      .from('raw_feeds')
      .update({
        metadata: updatedMetadata
      })
      .eq('id', feedId);
    
    if (error) {
      console.error('Failed to update progress:', error);
    }
  } catch (error) {
    console.error('Progress update error:', error);
  }
}

// Main handler
export const handler: BackgroundHandler = async (event) => {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const request: TranscriptionRequest = JSON.parse(event.body || '{}');
    const { feedId, audioUrl, title, metadata } = request;
    
    if (!feedId || !audioUrl) {
      throw new Error('Missing required parameters: feedId and audioUrl');
    }
    
    console.log(`Background transcription started for feed ${feedId}: ${title || 'Unknown'}`);
    
    // Update status to processing
    await updateTranscriptionProgress(feedId, {
      status: 'downloading',
      startedAt: new Date().toISOString()
    });
    
    // Download audio file
    console.log(`Downloading audio from: ${audioUrl}`);
    const audioBuffer = await downloadAudio(audioUrl, (progress) => {
      // Update download progress periodically
      if (progress % 10 === 0) {
        updateTranscriptionProgress(feedId, {
          status: 'downloading',
          downloadProgress: progress
        });
      }
    });
    
    // Get audio metadata
    const audioMetadata = await getAudioMetadata(audioUrl);
    const format = audioMetadata.format || audioUrl.split('.').pop()?.toLowerCase() || 'mp3';
    
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Unsupported audio format: ${format}`);
    }
    
    // Validate audio URL
    if (!isValidAudioUrl(audioUrl)) {
      throw new Error('Invalid audio URL format');
    }
    
    // Transcribe audio
    await updateTranscriptionProgress(feedId, {
      status: 'transcribing',
      downloadProgress: 100,
      audioSize: audioBuffer.length,
      estimatedTime: audioChunker.estimateProcessingTime(audioBuffer.length, audioMetadata.duration)
    });
    
    const result = await transcribeAudio(audioBuffer, format, feedId, audioMetadata);
    result.processingTime = Date.now() - startTime;
    
    console.log(`Transcription completed: ${result.text.length} characters, ${result.chunks} chunks`);
    
    // Save transcript to database
    const { error: updateError } = await supabase
      .from('raw_feeds')
      .update({
        content: result.text,
        processing_status: 'completed',
        metadata: {
          ...metadata,
          transcription: {
            completed: true,
            language: result.language,
            chunks: result.chunks,
            processingTimeMs: result.processingTime,
            processedAt: new Date().toISOString(),
            method: 'openai_whisper_api'
          },
          audioUrl,
          needsTranscription: false
        }
      })
      .eq('id', feedId);
    
    if (updateError) {
      throw new Error(`Failed to save transcript: ${updateError.message}`);
    }
    
    // Queue content processing job
    await supabase
      .from('job_queue')
      .insert({
        job_type: 'content_process',
        payload: { feedId, source: 'transcription' },
        priority: 5
      });
    
    console.log(`Background transcription completed successfully in ${result.processingTime}ms`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Transcription failed:', errorMessage);
    
    // Update feed status to failed
    if (event.body) {
      const { feedId } = JSON.parse(event.body);
      if (feedId) {
        await supabase
          .from('raw_feeds')
          .update({
            processing_status: 'failed',
            metadata: supabase.rpc('jsonb_merge', {
              target: 'metadata',
              source: JSON.stringify({
                transcription: {
                  error: errorMessage,
                  failedAt: new Date().toISOString(),
                  processingTimeMs: Date.now() - startTime
                }
              })
            })
          })
          .eq('id', feedId);
      }
    }
    
    // Re-throw to mark function as failed
    throw error;
  }
};