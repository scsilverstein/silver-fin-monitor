// Whisper configuration for transcription service
import path from 'path';

export interface WhisperConfiguration {
  // Model settings
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  modelPath: string;
  
  // Processing settings
  device: 'cpu' | 'mps'; // MPS for Apple Silicon GPU
  computeType: 'int8' | 'float16' | 'float32';
  
  // Paths
  tempDir: string;
  pythonPath: string;
  
  // Transcription settings
  language: string | null; // null for auto-detect
  task: 'transcribe' | 'translate';
  temperature: number;
  compressionRatioThreshold: number;
  logprobThreshold: number;
  noSpeechThreshold: number;
  conditionOnPreviousText: boolean;
  initialPrompt: string;
  
  // Performance settings
  maxConcurrentJobs: number;
  chunkDuration: number; // seconds, for long audio files
  
  // Quality settings
  beamSize: number; // Higher = better quality but slower
  patience: number;
  lengthPenalty: number;
  
  // Post-processing
  enablePunctuation: boolean;
  enableDiarization: boolean; // Speaker identification
}

const defaultConfig: WhisperConfiguration = {
  // Model settings - optimized for M1
  modelSize: process.env.WHISPER_MODEL_SIZE as any || 'base',
  modelPath: path.join(process.env.HOME || '~', '.cache', 'whisper'),
  
  // M1 optimized settings - MPS with fallback support
  device: (process.env.WHISPER_DEVICE as any) || 'mps',
  computeType: (process.env.WHISPER_COMPUTE_TYPE as any) || 'float32',
  
  // Paths
  tempDir: path.join(process.cwd(), 'temp', 'whisper'),
  pythonPath: process.env.PYTHON_PATH || 'python3',
  
  // Transcription settings
  language: null, // Auto-detect
  task: 'transcribe',
  temperature: 0.0, // Deterministic output
  compressionRatioThreshold: 2.4,
  logprobThreshold: -1.0,
  noSpeechThreshold: 0.6,
  conditionOnPreviousText: true,
  initialPrompt: 'This is a financial podcast discussing markets, economics, investment strategies, and business news.',
  
  // Performance settings
  maxConcurrentJobs: 2, // Limit concurrent transcriptions
  chunkDuration: 1800, // 30 minutes chunks for long podcasts
  
  // Quality settings
  beamSize: 5,
  patience: 1.0,
  lengthPenalty: 1.0,
  
  // Post-processing
  enablePunctuation: true,
  enableDiarization: false // Can be enabled for multi-speaker podcasts
};

// Model specifications for reference
export const modelSpecs = {
  tiny: {
    parameters: '39M',
    relativeSpeed: 32,
    englishOnly: true,
    vramRequired: 1, // GB
    quality: 'basic'
  },
  'tiny.en': {
    parameters: '39M',
    relativeSpeed: 32,
    englishOnly: true,
    vramRequired: 1,
    quality: 'basic'
  },
  base: {
    parameters: '74M',
    relativeSpeed: 16,
    englishOnly: false,
    vramRequired: 1,
    quality: 'good'
  },
  'base.en': {
    parameters: '74M',
    relativeSpeed: 16,
    englishOnly: true,
    vramRequired: 1,
    quality: 'good'
  },
  small: {
    parameters: '244M',
    relativeSpeed: 6,
    englishOnly: false,
    vramRequired: 2,
    quality: 'better'
  },
  'small.en': {
    parameters: '244M',
    relativeSpeed: 6,
    englishOnly: true,
    vramRequired: 2,
    quality: 'better'
  },
  medium: {
    parameters: '769M',
    relativeSpeed: 2,
    englishOnly: false,
    vramRequired: 5,
    quality: 'high'
  },
  'medium.en': {
    parameters: '769M',
    relativeSpeed: 2,
    englishOnly: true,
    vramRequired: 5,
    quality: 'high'
  },
  large: {
    parameters: '1550M',
    relativeSpeed: 1,
    englishOnly: false,
    vramRequired: 10,
    quality: 'best'
  }
};

// Get configuration based on environment
export function getWhisperConfig(): WhisperConfiguration {
  const config = { ...defaultConfig };
  
  // Override with environment variables if set
  if (process.env.WHISPER_MODEL_SIZE) {
    config.modelSize = process.env.WHISPER_MODEL_SIZE as any;
  }
  
  if (process.env.WHISPER_DEVICE) {
    config.device = process.env.WHISPER_DEVICE as any;
  }
  
  if (process.env.WHISPER_LANGUAGE) {
    config.language = process.env.WHISPER_LANGUAGE;
  }
  
  if (process.env.WHISPER_MAX_CONCURRENT_JOBS) {
    config.maxConcurrentJobs = parseInt(process.env.WHISPER_MAX_CONCURRENT_JOBS);
  }
  
  return config;
}

// Estimate processing time for audio duration
export function estimateProcessingTime(
  audioDurationSeconds: number,
  modelSize: string = 'base'
): number {
  const spec = modelSpecs[modelSize as keyof typeof modelSpecs];
  if (!spec) return audioDurationSeconds * 0.5; // Default: 2x real-time
  
  // Estimate based on relative speed (approximate)
  // Base model processes ~16x real-time on M1
  return audioDurationSeconds / spec.relativeSpeed;
}

// Check if audio format is supported
export function isSupportedAudioFormat(filename: string): boolean {
  const supportedFormats = [
    '.mp3', '.mp4', '.m4a', '.wav', '.webm', 
    '.flac', '.ogg', '.opus', '.aac'
  ];
  
  const ext = path.extname(filename).toLowerCase();
  return supportedFormats.includes(ext);
}

export default getWhisperConfig();