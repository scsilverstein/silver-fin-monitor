#!/usr/bin/env npx tsx

// Basic server startup to test transcription
import express from 'express';
import cors from 'cors';
import { config } from '../src/config';
import { db } from '../src/services/database';
import { queueWorker } from '../src/services/workers/queue-worker';
import { logger } from '../src/utils/logger';

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

async function startServer() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await db.connect();
    logger.info('Database connected');

    // Start queue worker
    logger.info('Starting queue worker...');
    await queueWorker.start();
    logger.info('Queue worker started');

    // Start server
    const port = config.port || 3001;
    app.listen(port, () => {
      logger.info(`Basic server running on port ${port}`);
      logger.info('Transcription worker should now process queued jobs');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();