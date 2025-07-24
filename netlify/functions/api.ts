import { Handler } from '@netlify/functions';
import express, { Application } from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, validateConfig } from '../../src/config';
import { db } from '../../src/services/database';
import { cache } from '../../src/services/cache';
import { logger } from '../../src/utils/logger';
import { errorHandler, notFoundHandler, requestTimeout, validateContentType, requestLogger } from '../../src/middleware/error';
import { globalRateLimiter } from '../../src/middleware/rateLimit';
import { apiV1 } from '../../src/routes';

// Create Express app
const app: Application = express();

// Middleware setup
app.use(helmet()); // Security headers

// CORS configuration for Netlify
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow all origins in production (Netlify handles CORS via headers in netlify.toml)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(compression()); // Gzip compression
app.use(express.json({ limit: '10mb' })); // JSON body parser with size limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL-encoded body parser

// Request logging (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use(requestLogger);
}

// Content type validation (only for POST/PUT requests)
app.use(validateContentType);

// Request timeout middleware
app.use(requestTimeout);

// Global rate limiting
app.use(globalRateLimiter);

// API routes - Note: Netlify will handle the /api prefix via redirects
app.use('/api/v1', apiV1);

// Health check endpoint (direct access without /api prefix)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: process.env.PACKAGE_VERSION || '1.0.0'
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Export handler for Netlify Functions
export const handler: Handler = serverless(app);