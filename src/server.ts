// Express server implementation following CLAUDE.md specification
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config, validateConfig } from '@/config';
import { db } from '@/services/database';
import { cache } from '@/services/cache';
import { queueService } from '@/services/database/queue';
import { logger } from '@/utils/logger';
import { errorHandler, notFoundHandler, requestTimeout, validateContentType, requestLogger } from '@/middleware/error';
import { globalRateLimiter } from '@/middleware/rateLimit';
import { apiV1 } from '@/routes';
import { queueWorker } from '@/services/workers/queue-worker';

// Create Express app
const app: Application = express();

// Middleware setup
app.use(helmet()); // Security headers

// CORS configuration for Tailscale
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Log CORS requests for debugging
    console.log('CORS origin check:', origin);
    
    // Allow same-origin requests
    if (!origin) return callback(null, true);
    
    // Allow localhost and Tailscale networks
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('0.0.0.0') ||
        origin.match(/^https?:\/\/100\.\d+\.\d+\.\d+/) ||
        origin.includes('file://')) {  // Allow file:// for testing
      return callback(null, true);
    }
    
    // Allow configured origins
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // During development, log but allow the request
    if (config.nodeEnv === 'development') {
      console.log('CORS: Allowing origin in development:', origin);
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(compression()); // Gzip compression
app.use(express.json({ limit: '10mb' })); // JSON body parser
app.use(express.urlencoded({ extended: true })); // URL-encoded body parser
app.use(morgan('combined')); // HTTP request logger
app.use(requestLogger); // Detailed request/response logging for debugging
app.use(requestTimeout(30000)); // 30 second timeout
app.use(validateContentType()); // Content-Type validation
app.use(globalRateLimiter); // Global rate limiting

// API routes
app.use('/api/v1', apiV1);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, starting graceful shutdown`);
  
  try {
    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop queue worker
    await queueWorker.stop();
    logger.info('Queue worker stopped');

    // Cleanup expired cache/jobs
    await cache.cleanup();
    logger.info('Cache cleanup completed');

    // Disconnect database
    await db.disconnect();
    logger.info('Database disconnected');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

// Server startup
let server: any;

const startServer = async (): Promise<void> => {
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Connect to database
    await db.connect();
    logger.info('Database connected');

    // Start queue worker (this handles all queue processing)
    await queueWorker.start();
    logger.info('Queue worker started');

    // Schedule cleanup jobs
    setInterval(async () => {
      try {
        await cache.cleanup();
        await queueService.enqueue('cleanup', {}, 10);
      } catch (error) {
        logger.error('Cleanup job error', error);
      }
    }, config.queue.cleanupInterval);

    // Start server
    const host = '0.0.0.0'; // Bind to all interfaces for testing
    server = app.listen(config.port, host, () => {
      logger.info(`Server started on ${host}:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API available at: http://${host}:${config.port}/api/v1`);
      
      // Log Tailscale IP if available
      if (process.env.TAILSCALE_IP) {
        logger.info(`Tailscale access: http://${process.env.TAILSCALE_IP}:${config.port}/api/v1`);
      }
    });

    // Health check for monitoring
    const healthCheck = async (): Promise<void> => {
      const [dbHealth, cacheHealth] = await Promise.all([
        db.healthCheck(),
        cache.healthCheck()
      ]);

      const isHealthy = dbHealth.success && cacheHealth.success;
      
      if (!isHealthy) {
        logger.error('Health check failed', {
          database: dbHealth.success,
          cache: cacheHealth.success
        });
      } else {
        logger.debug('Health check passed');
      }
    };

    // Run health checks periodically
    setInterval(healthCheck, 60000); // Every minute

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app };