// Configuration management following CLAUDE.md specification
import dotenv from 'dotenv';
import { Config } from '@/types';

// Load environment variables
dotenv.config();

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue!;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable ${key}: ${value}`);
  }
  return parsed;
};

export const config: Config = {
  port: getEnvNumber('PORT', 3001),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  
  database: {
    url: getEnvVar('SUPABASE_URL'),
    anonKey: getEnvVar('SUPABASE_ANON_KEY'),
    serviceKey: getEnvVar('SUPABASE_SERVICE_KEY'),
  },
  
  openai: {
    apiKey: getEnvVar('OPENAI_API_KEY'),
    model: getEnvVar('OPENAI_MODEL', 'o4-mini'),
    fallbackModel: getEnvVar('OPENAI_FALLBACK_MODEL', 'gpt-3.5-turbo'),
  },
  
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },
  
  jwt: {
    secret: getEnvVar('JWT_SECRET'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '7d'),
  },
  
  cache: {
    defaultTtl: getEnvNumber('CACHE_TTL', 3600),
  },
  
  queue: {
    maxRetries: getEnvNumber('MAX_RETRY_ATTEMPTS', 3),
    defaultPriority: 5,
    cleanupInterval: getEnvNumber('QUEUE_CLEANUP_INTERVAL', 900000), // 15 minutes
  },
  
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },
};

// Validation
export const validateConfig = (): void => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_KEY',
    'OPENAI_API_KEY',
    'JWT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate JWT secret length
  if (config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
};

export default config;