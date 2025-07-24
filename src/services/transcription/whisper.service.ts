// Whisper transcription service for Mac M1
// Uses OpenAI Whisper locally for podcast transcription
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

export class WhisperTranscriptionService {
  private config: WhisperConfiguration;
  private isInitialized: boolean = false;
  private activeJobs: Map<string, boolean> = new Map();

  constructor(config?: Partial<WhisperConfiguration>) {
    this.config = { ...whisperConfig, ...config };
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
      logger.info('Whisper transcription service initialized', {
        modelSize: this.config.modelSize,
        device: this.config.device
      });
    } catch (error) {
      logger.error('Failed to initialize Whisper service', { error });
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

      // Run Whisper transcription
      logger.info('Starting Whisper transcription', { 
        audioPath: tempAudioPath,
        duration,
        model: this.config.modelSize 
      });

      const startTime = Date.now();
      const result = await this.runWhisperPython(tempAudioPath, tempOutputPath);
      const processingTime = Date.now() - startTime;

      logger.info('Transcription completed', {
        processingTime,
        textLength: result.text.length,
        duration
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

    // Check if MLX Whisper is available (preferred for Apple Silicon)
    if (process.arch === 'arm64' && process.platform === 'darwin') {
      try {
        await this.execCommand(this.config.pythonPath, ['-c', 'import mlx_whisper']);
        logger.info('MLX Whisper detected - using Apple Silicon optimized version');
        return;
      } catch {
        logger.info('MLX Whisper not found, checking for regular Whisper...');
      }
    }

    // Check if regular whisper is installed
    try {
      await this.execCommand(this.config.pythonPath, ['-c', 'import whisper']);
    } catch (error) {
      logger.warn('OpenAI Whisper not installed. Installing...');
      await this.installWhisper();
    }
  }

  private async installWhisper(): Promise<void> {
    logger.info('Installing OpenAI Whisper...');
    
    // Install whisper with pip
    await this.execCommand(this.config.pythonPath, [
      '-m', 'pip', 'install', '-U', 'openai-whisper'
    ]);

    // For M1 Macs, we might need additional dependencies
    if (this.config.device === 'mps') {
      await this.execCommand(this.config.pythonPath, [
        '-m', 'pip', 'install', '-U', 'torch', 'torchvision', 'torchaudio'
      ]);
    }
  }

  private async ensureModel(): Promise<void> {
    const modelFile = path.join(this.config.modelPath, `${this.config.modelSize}.pt`);
    
    try {
      await fs.access(modelFile);
      logger.info('Whisper model found', { model: this.config.modelSize });
    } catch {
      logger.info('Downloading Whisper model...', { model: this.config.modelSize });
      
      // The model will be downloaded automatically on first use
      // We can trigger a download by running a simple test
      const testScript = `
import whisper
model = whisper.load_model("${this.config.modelSize}", device="${this.config.device}")
print("Model loaded successfully")
`;
      
      await this.execCommand(this.config.pythonPath, ['-c', testScript]);
    }
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

  private async runWhisperPython(audioPath: string, outputPath: string): Promise<TranscriptionResult> {
    // Check if MLX Whisper is available for Apple Silicon
    const useMLX = process.arch === 'arm64' && process.platform === 'darwin';
    let hasMLX = false;
    
    if (useMLX) {
      try {
        await this.execCommand(this.config.pythonPath, ['-c', 'import mlx_whisper']);
        hasMLX = true;
      } catch {
        hasMLX = false;
      }
    }

    // Python script to run Whisper with optimal settings
    const pythonScript = hasMLX ? `
import mlx_whisper
import json
import sys
import warnings
warnings.filterwarnings("ignore")

audio_path = sys.argv[1]
output_path = sys.argv[2]
model_size = "${this.config.modelSize}"
language = ${this.config.language ? `"${this.config.language}"` : 'None'}

# Map model names to MLX community format
model_map = {
    'tiny': 'mlx-community/whisper-tiny',
    'tiny.en': 'mlx-community/whisper-tiny.en-mlx', 
    'base': 'mlx-community/whisper-tiny',  # Use tiny for faster processing
    'base.en': 'mlx-community/whisper-small.en-mlx',
    'small': 'mlx-community/whisper-small.en-mlx',
    'small.en': 'mlx-community/whisper-small.en-mlx',
    'medium': 'mlx-community/whisper-medium-mlx',
    'large': 'mlx-community/whisper-large-v3-mlx'
}

model_name = model_map.get(model_size, 'mlx-community/whisper-tiny')

print(f"Using MLX Whisper (Apple Silicon optimized) with model: {model_name}")

# Transcribe using MLX Whisper (no beam search support yet)
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
    # Note: MLX Whisper doesn't support beam search, patience, or length_penalty yet
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
` : `
import whisper
import json
import sys
import warnings
import os
warnings.filterwarnings("ignore")

audio_path = sys.argv[1]
output_path = sys.argv[2]
model_size = "${this.config.modelSize}"
device = "${this.config.device}"
language = ${this.config.language ? `"${this.config.language}"` : 'None'}

# Enable MPS fallback for unsupported operations
if device == "mps":
    os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
    print("Using MPS with CPU fallback for unsupported operations")

# Load model with M1 optimizations
model = whisper.load_model(model_size, device=device)

# Force fp32 for MPS (fp16 has compatibility issues)
use_fp16 = ${this.config.computeType === 'float16' ? 'True' : 'False'} and device != "mps"

# Transcribe with optimal settings
result = model.transcribe(
    audio_path,
    fp16=use_fp16,
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

print("Transcription complete")
`;

    // Write script to temp file
    const scriptPath = path.join(this.config.tempDir, `whisper_${uuidv4()}.py`);
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
                processedAt: new Date().toISOString()
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
export const whisperService = new WhisperTranscriptionService();