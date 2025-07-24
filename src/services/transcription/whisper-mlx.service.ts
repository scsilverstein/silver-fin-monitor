// MLX Whisper transcription service for Mac M1
// Uses MLX (Apple's ML framework) for optimal Apple Silicon performance
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabase } from '../database/client';
import { cache as cacheService } from '../cache';
import whisperConfig, { 
  WhisperConfiguration, 
  estimateProcessingTime,
  isSupportedAudioFormat 
} from '../../config/whisper.config';

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export class MLXWhisperTranscriptionService {
  private config: WhisperConfiguration;
  private isInitialized: boolean = false;
  private activeJobs: Map<string, boolean> = new Map();

  constructor(config?: Partial<WhisperConfiguration>) {
    this.config = { ...whisperConfig, ...config };
    // Force MLX to use Metal (no need for device config)
    this.config.device = 'mps'; // MLX automatically uses Metal
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create temp directory if it doesn't exist
      await fs.mkdir(this.config.tempDir, { recursive: true });

      // Check if Python and required packages are installed
      await this.checkDependencies();

      // Download model if not present
      await this.ensureModel();

      this.isInitialized = true;
      logger.info('MLX Whisper transcription service initialized', {
        modelSize: this.config.modelSize,
        framework: 'MLX (Apple Silicon optimized)'
      });
    } catch (error) {
      logger.error('Failed to initialize MLX Whisper service', { error });
      throw error;
    }
  }

  async transcribeAudio(audioUrl: string, feedId?: string): Promise<TranscriptionResult> {
    await this.initialize();

    const tempAudioPath = path.join(this.config.tempDir, `${uuidv4()}.mp3`);
    const tempOutputPath = path.join(this.config.tempDir, `${uuidv4()}.json`);

    try {
      // Check cache first
      if (feedId) {
        const cacheKey = `transcript:${feedId}`;
        const cached = await cacheService.get<TranscriptionResult>(cacheKey);
        if (cached) {
          logger.info('Using cached transcript', { feedId });
          return cached;
        }
      }

      // Download audio file
      logger.info('Downloading audio for transcription', { audioUrl });
      await this.downloadAudio(audioUrl, tempAudioPath);

      // Get audio duration
      const duration = await this.getAudioDuration(tempAudioPath);

      // Run MLX Whisper transcription
      logger.info('Starting MLX Whisper transcription', { 
        audioPath: tempAudioPath,
        duration,
        model: this.config.modelSize 
      });

      const startTime = Date.now();
      const result = await this.runMLXWhisperPython(tempAudioPath, tempOutputPath);
      const processingTime = Date.now() - startTime;

      logger.info('MLX transcription completed', {
        processingTime,
        textLength: result.text.length,
        duration,
        speedRatio: duration ? (duration * 1000) / processingTime : 0
      });

      // Add duration to result
      result.duration = duration;

      // Cache the result
      if (feedId) {
        const cacheKey = `transcript:${feedId}`;
        await cacheService.set(cacheKey, result, 7 * 24 * 60 * 60); // Cache for 7 days
      }

      // Save transcript to database
      if (feedId) {
        await this.saveTranscript(feedId, result);
      }

      return result;
    } finally {
      // Cleanup temp files
      await this.cleanup(tempAudioPath, tempOutputPath);
    }
  }

  private async checkDependencies(): Promise<void> {
    // Check Python
    try {
      await this.execCommand(this.config.pythonPath, ['--version']);
    } catch (error) {
      throw new Error('Python 3 is not installed or not in PATH');
    }

    // Check if MLX Whisper is installed
    try {
      await this.execCommand(this.config.pythonPath, ['-c', 'import mlx_whisper']);
    } catch (error) {
      logger.warn('MLX Whisper not installed. Installing...');
      await this.installMLXWhisper();
    }
  }

  private async installMLXWhisper(): Promise<void> {
    logger.info('Installing MLX Whisper...');
    
    // Install MLX and MLX Whisper
    await this.execCommand(this.config.pythonPath, [
      '-m', 'pip', 'install', '-U', 'mlx', 'mlx-whisper'
    ]);
  }

  private async ensureModel(): Promise<void> {
    // MLX Whisper downloads models automatically to ~/.cache/mlx_whisper
    // We'll just check if the model can be loaded
    const testScript = `
import mlx_whisper
print("MLX Whisper models will be downloaded on first use")
`;
    
    await this.execCommand(this.config.pythonPath, ['-c', testScript]);
  }

  private async downloadAudio(url: string, outputPath: string): Promise<void> {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout for large files
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const writer = (await import('fs')).createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const result = await this.execCommand('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audioPath
      ]);
      
      return parseFloat(result.trim());
    } catch (error) {
      logger.warn('Failed to get audio duration', { error });
      return 0;
    }
  }

  private async runMLXWhisperPython(audioPath: string, outputPath: string): Promise<TranscriptionResult> {
    // Python script to run MLX Whisper with optimal settings for M1
    const pythonScript = `
import mlx_whisper
import json
import sys
import warnings
warnings.filterwarnings("ignore")

audio_path = sys.argv[1]
output_path = sys.argv[2]
model_size = "${this.config.modelSize}"
language = ${this.config.language ? `"${this.config.language}"` : 'None'}

# Map model names to MLX format
model_map = {
    'tiny': 'openai/whisper-tiny',
    'base': 'openai/whisper-base',
    'small': 'openai/whisper-small',
    'medium': 'openai/whisper-medium',
    'large': 'openai/whisper-large'
}

model_name = model_map.get(model_size, 'openai/whisper-base')

# Transcribe using MLX Whisper - optimized for Apple Silicon
# Note: path_or_hf_repo accepts both local files and Hugging Face model names
result = mlx_whisper.transcribe(
    audio_path,
    path_or_hf_repo=model_name,
    language=language,
    task='${this.config.task}',
    temperature=${this.config.temperature},
    compression_ratio_threshold=${this.config.compressionRatioThreshold},
    logprob_threshold=${this.config.logprobThreshold},
    no_speech_threshold=${this.config.noSpeechThreshold},
    condition_on_previous_text=${this.config.conditionOnPreviousText ? 'True' : 'False'},
    initial_prompt="${this.config.initialPrompt}",
    beam_size=${this.config.beamSize},
    patience=${this.config.patience},
    length_penalty=${this.config.lengthPenalty},
    suppress_blank=${this.config.enablePunctuation ? 'True' : 'False'},
    verbose=False
)

# Save result
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump({
        'text': result['text'],
        'language': result.get('language'),
        'segments': [
            {
                'start': seg['start'],
                'end': seg['end'],
                'text': seg['text'].strip()
            }
            for seg in result.get('segments', [])
        ]
    }, f, ensure_ascii=False, indent=2)

print("MLX transcription complete")
`;

    // Write script to temp file
    const scriptPath = path.join(this.config.tempDir, `mlx_whisper_${uuidv4()}.py`);
    await fs.writeFile(scriptPath, pythonScript);

    try {
      // Run the script
      await this.execCommand(this.config.pythonPath, [scriptPath, audioPath, outputPath]);

      // Read the result
      const resultJson = await fs.readFile(outputPath, 'utf-8');
      return JSON.parse(resultJson);
    } finally {
      // Clean up script
      await fs.unlink(scriptPath).catch(() => {});
    }
  }

  private async saveTranscript(feedId: string, result: TranscriptionResult): Promise<void> {
    try {
      // Update the raw_feed with transcript
      const { error } = await supabase
        .from('raw_feeds')
        .update({
          content: result.text,
          metadata: supabase.rpc('jsonb_merge', {
            target: 'metadata',
            source: JSON.stringify({
              transcription: {
                completed: true,
                language: result.language,
                duration: result.duration,
                segmentCount: result.segments?.length || 0,
                processedAt: new Date().toISOString(),
                framework: 'MLX'
              }
            })
          })
        })
        .eq('id', feedId);

      if (error) {
        logger.error('Failed to save transcript to database', { error, feedId });
      } else {
        logger.info('Transcript saved to database', { feedId });
      }
    } catch (error) {
      logger.error('Error saving transcript', { error, feedId });
    }
  }

  private async cleanup(...paths: string[]): Promise<void> {
    for (const filepath of paths) {
      try {
        await fs.unlink(filepath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  private execCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Public method to check if service is available
  async isAvailable(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }

  // Get supported audio formats
  getSupportedFormats(): string[] {
    return ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'flac', 'ogg', 'opus'];
  }
}

// Export singleton instance
export const mlxWhisperService = new MLXWhisperTranscriptionService();