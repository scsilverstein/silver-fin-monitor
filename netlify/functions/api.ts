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

// Set environment variable to indicate serverless environment
process.env.NETLIFY = 'true';

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

// Skip database initialization in serverless environment to prevent timeout
// Database connections will be handled on-demand by individual endpoints

// Test endpoint directly in main function
app.get('/api/v1/direct-test', (req, res) => {
  res.json({
    success: true,
    message: 'Direct endpoint working in Netlify function',
    timestamp: new Date()
  });
});

// Mock stock screener endpoint for testing
app.get('/api/v1/stocks/screener', (req, res) => {
  logger.info('Stock screener endpoint hit with query:', req.query);
  
  // Return mock data to test the frontend
  const mockStocks = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      marketCap: 3000000000000,
      price: 238.26,
      pe: 32.5,
      forwardPE: 29.25,
      currentRevenue: 394328000000,
      guidedRevenue: 410101120000,
      revenueGrowth: 0.04,
      eps: 6.01,
      forwardEps: 6.611,
      priceToBook: 47.2,
      debtToEquity: 1.95
    },
    {
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      sector: 'Technology',
      industry: 'Software',
      marketCap: 3100000000000,
      price: 411.22,
      pe: 35.8,
      forwardPE: 32.22,
      currentRevenue: 245122000000,
      guidedRevenue: 257128100000,
      revenueGrowth: 0.049,
      eps: 11.49,
      forwardEps: 12.639,
      priceToBook: 14.8,
      debtToEquity: 0.69
    },
    {
      symbol: 'INTC',
      name: 'Intel Corporation',
      sector: 'Technology',
      industry: 'Semiconductors',
      marketCap: 80000000000,
      price: 19.05,
      pe: 12.2,
      forwardPE: 10.98,
      currentRevenue: 79024000000,
      guidedRevenue: 85000000000,
      revenueGrowth: 0.076,
      eps: 1.56,
      forwardEps: 1.716,
      priceToBook: 1.1,
      debtToEquity: 0.82
    }
  ];
  
  res.json({
    success: true,
    data: mockStocks,
    meta: {
      total: mockStocks.length,
      timestamp: new Date()
    }
  });
});

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