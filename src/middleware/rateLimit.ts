// Rate limiting middleware following CLAUDE.md specification
import { Request, Response, NextFunction } from 'express';
import { db } from '@/services/database';
import { createContextLogger } from '@/utils/logger';
import { RateLimitError } from './error';

const rateLimitLogger = createContextLogger('RateLimit');

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Default key generator (IP-based)
const defaultKeyGenerator = (req: Request): string => {
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// Database-backed rate limiter
export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = 'Too many requests',
    skipSuccessfulRequests = false,
    keyGenerator = defaultKeyGenerator
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyGenerator(req);
      const endpoint = req.path;
      const identifier = `${key}:${endpoint}`;
      
      // Check current request count
      const windowStart = new Date(Date.now() - windowMs);
      
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*) as count 
         FROM rate_limits 
         WHERE identifier = $1 
         AND endpoint = $2 
         AND window_start >= $3`,
        [key, endpoint, windowStart]
      );

      const currentCount = result[0]?.count || 0;

      if (currentCount >= max) {
        rateLimitLogger.warn('Rate limit exceeded', {
          identifier,
          endpoint,
          count: currentCount,
          max
        });

        throw new RateLimitError(message);
      }

      // Record this request (if not skipping successful requests)
      if (!skipSuccessfulRequests) {
        await db.query(
          `INSERT INTO rate_limits (identifier, endpoint, window_start, requests_count, max_requests, window_duration)
           VALUES ($1, $2, $3, 1, $4, $5)
           ON CONFLICT (identifier, endpoint, window_start)
           DO UPDATE SET requests_count = rate_limits.requests_count + 1`,
          [key, endpoint, new Date(), max, windowMs / 1000]
        );
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - currentCount - 1).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: error.message
          }
        });
        return;
      }

      rateLimitLogger.error('Rate limit check failed', error);
      // Don't block request on rate limit errors
      next();
    }
  };
};

// Predefined rate limiters
export const rateLimiters = {
  // General API rate limit
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  }),

  // Strict rate limit for auth endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts'
  }),

  // Relaxed rate limit for read operations
  read: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    skipSuccessfulRequests: true
  }),

  // Strict rate limit for write operations
  write: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50
  }),

  // Very strict rate limit for expensive operations
  expensive: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Too many requests for this resource'
  })
};

// IP-based rate limiter for DDoS protection
export const globalRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const cacheKey = `global_rate_limit:${ip}`;
    
    // Use cache for performance
    const { cache } = await import('@/services/cache');
    const current = await cache.get<number>(cacheKey) || 0;
    
    const limit = 1000; // 1000 requests per hour
    const window = 3600; // 1 hour in seconds
    
    if (current >= limit) {
      rateLimitLogger.warn('Global rate limit exceeded', { ip, count: current });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP'
        }
      });
      return;
    }
    
    // Increment counter
    await cache.set(cacheKey, current + 1, window);
    
    next();
  } catch (error) {
    rateLimitLogger.error('Global rate limit check failed', error);
    // Don't block on errors
    next();
  }
};

// Clean up old rate limit records
export const cleanupRateLimits = async (): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    await db.query(
      'DELETE FROM rate_limits WHERE window_start < $1',
      [cutoff]
    );
    
    rateLimitLogger.info('Rate limit cleanup completed');
  } catch (error) {
    rateLimitLogger.error('Rate limit cleanup failed', error);
  }
};