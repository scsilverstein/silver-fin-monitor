// Audio Chunking Utilities for Netlify Functions
// Handles splitting large audio files for transcription

import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary for temporary file storage (optional)
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

interface AudioChunk {
  id: number;
  buffer: Buffer;
  duration: number;
  startTime: number;
  endTime: number;
}

interface ChunkingOptions {
  maxChunkSize: number;      // Maximum size in bytes (25MB for OpenAI)
  maxChunkDuration: number;  // Maximum duration in seconds
  overlap: number;           // Overlap between chunks in seconds
  format: string;            // Audio format
}

const DEFAULT_OPTIONS: ChunkingOptions = {
  maxChunkSize: 24 * 1024 * 1024,  // 24MB (leaving 1MB buffer)
  maxChunkDuration: 600,            // 10 minutes
  overlap: 5,                       // 5 seconds overlap
  format: 'mp3'
};

/**
 * Smart audio chunking based on size and duration
 * Uses cloud services for processing since Netlify has no ffmpeg
 */
export class AudioChunker {
  private options: ChunkingOptions;

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Split audio buffer into chunks
   * For Netlify, we'll use cloud services or smart heuristics
   */
  async chunkAudio(audioBuffer: Buffer, metadata?: any): Promise<AudioChunk[]> {
    const fileSize = audioBuffer.length;
    
    // If file is small enough, return as single chunk
    if (fileSize <= this.options.maxChunkSize) {
      return [{
        id: 0,
        buffer: audioBuffer,
        duration: metadata?.duration || 0,
        startTime: 0,
        endTime: metadata?.duration || 0
      }];
    }

    // For larger files, we need to use a cloud service
    // Option 1: Use Cloudinary's audio manipulation
    if (process.env.CLOUDINARY_URL) {
      return this.chunkWithCloudinary(audioBuffer, metadata);
    }

    // Option 2: Use Assembly AI's chunking service
    if (process.env.ASSEMBLYAI_API_KEY) {
      return this.chunkWithAssemblyAI(audioBuffer, metadata);
    }

    // Option 3: Simple size-based chunking (less accurate but works)
    return this.simpleChunking(audioBuffer);
  }

  /**
   * Chunk using Cloudinary's audio processing
   */
  private async chunkWithCloudinary(
    audioBuffer: Buffer, 
    metadata?: any
  ): Promise<AudioChunk[]> {
    try {
      // Upload to Cloudinary
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video', // Audio is handled as video
            folder: 'temp_audio_chunks',
            format: this.options.format
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(audioBuffer);
      });

      const publicId = uploadResult.public_id;
      const duration = uploadResult.duration || metadata?.duration || 0;
      
      // Calculate chunks
      const chunks: AudioChunk[] = [];
      const chunkDuration = this.options.maxChunkDuration;
      const numChunks = Math.ceil(duration / chunkDuration);

      // Download each chunk
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration - (i > 0 ? this.options.overlap : 0);
        const endTime = Math.min((i + 1) * chunkDuration, duration);
        
        // Generate URL with trimming transformation
        const chunkUrl = cloudinary.url(publicId, {
          resource_type: 'video',
          format: this.options.format,
          start_offset: startTime,
          end_offset: endTime,
          flags: 'attachment'
        });

        // Download chunk
        const response = await axios.get(chunkUrl, {
          responseType: 'arraybuffer'
        });

        chunks.push({
          id: i,
          buffer: Buffer.from(response.data),
          duration: endTime - startTime,
          startTime,
          endTime
        });
      }

      // Cleanup
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });

      return chunks;

    } catch (error) {
      console.error('Cloudinary chunking failed:', error);
      // Fallback to simple chunking
      return this.simpleChunking(audioBuffer);
    }
  }

  /**
   * Chunk using AssemblyAI's service
   */
  private async chunkWithAssemblyAI(
    audioBuffer: Buffer,
    metadata?: any
  ): Promise<AudioChunk[]> {
    // AssemblyAI can handle large files directly
    // But we can still chunk for parallel processing
    return this.simpleChunking(audioBuffer);
  }

  /**
   * Simple size-based chunking (fallback)
   * This is less accurate but works without external services
   */
  private simpleChunking(audioBuffer: Buffer): AudioChunk[] {
    const chunks: AudioChunk[] = [];
    const chunkSize = this.options.maxChunkSize;
    const totalSize = audioBuffer.length;
    const numChunks = Math.ceil(totalSize / chunkSize);

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, totalSize);
      
      chunks.push({
        id: i,
        buffer: audioBuffer.slice(start, end),
        duration: 0, // Unknown without processing
        startTime: 0,
        endTime: 0
      });
    }

    return chunks;
  }

  /**
   * Estimate processing time based on file size and duration
   */
  estimateProcessingTime(fileSize: number, duration?: number): number {
    // OpenAI typically processes at ~10x real-time
    const estimatedDuration = duration || (fileSize / (128 * 1024)) * 60; // Estimate based on 128kbps
    return Math.ceil(estimatedDuration / 10) + 30; // Add 30s buffer
  }

  /**
   * Merge transcribed chunks back together
   */
  mergeTranscriptions(
    transcriptions: Array<{ text: string; startTime?: number; endTime?: number }>
  ): string {
    if (transcriptions.length === 0) return '';
    if (transcriptions.length === 1) return transcriptions[0].text;

    // Smart merging with overlap handling
    let merged = transcriptions[0].text;
    
    for (let i = 1; i < transcriptions.length; i++) {
      const currentText = transcriptions[i].text;
      
      // If we have overlap time, try to find common ending/beginning
      if (this.options.overlap > 0 && i > 0) {
        const overlap = this.findOverlap(
          transcriptions[i - 1].text,
          currentText
        );
        
        if (overlap > 0) {
          // Remove overlapping part from current chunk
          merged += ' ' + currentText.substring(overlap);
        } else {
          // No overlap found, just append
          merged += ' ' + currentText;
        }
      } else {
        // No overlap configured, simple concatenation
        merged += ' ' + currentText;
      }
    }

    return merged.trim();
  }

  /**
   * Find overlapping text between two strings
   */
  private findOverlap(text1: string, text2: string): number {
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    // Look for matching sequences at end of text1 and beginning of text2
    const maxOverlap = Math.min(20, words1.length, words2.length); // Check up to 20 words
    
    for (let overlap = maxOverlap; overlap > 3; overlap--) {
      const end1 = words1.slice(-overlap).join(' ');
      const start2 = words2.slice(0, overlap).join(' ');
      
      if (this.fuzzyMatch(end1, start2)) {
        // Return character position of overlap in text2
        return start2.length;
      }
    }
    
    return 0;
  }

  /**
   * Fuzzy string matching for overlap detection
   */
  private fuzzyMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
    // Simple character-based similarity
    const len = Math.max(str1.length, str2.length);
    let matches = 0;
    
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return (matches / len) >= threshold;
  }
}

// Utility functions for audio metadata extraction
export async function getAudioMetadata(url: string): Promise<{
  duration?: number;
  size?: number;
  format?: string;
}> {
  try {
    // Try to get metadata from headers
    const response = await axios.head(url);
    const size = parseInt(response.headers['content-length'] || '0');
    const contentType = response.headers['content-type'] || '';
    
    let format = 'mp3'; // default
    if (contentType.includes('audio/')) {
      format = contentType.split('/')[1].split(';')[0];
    }
    
    return { size, format };
  } catch (error) {
    console.error('Failed to get audio metadata:', error);
    return {};
  }
}

// Helper to validate audio URL
export function isValidAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const extension = parsed.pathname.split('.').pop()?.toLowerCase();
    const validExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg', 'flac'];
    
    return validExtensions.includes(extension || '');
  } catch {
    return false;
  }
}

// Export for use in background functions
export default AudioChunker;