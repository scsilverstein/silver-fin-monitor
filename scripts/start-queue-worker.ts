#!/usr/bin/env tsx
import { QueueWorker } from '../src/services/workers/queue-worker';
import { db } from '../src/services/database/index';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

async function startWorker() {
  console.log('Starting queue worker...');
  
  try {
    // Connect to database
    await db.connect();
    console.log('Database connected');
    
    // Create and start worker
    const worker = new QueueWorker();
    
    // Handle shutdown signals
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await worker.stop();
      await db.disconnect();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await worker.stop();
      await db.disconnect();
      process.exit(0);
    });
    
    // Start processing
    await worker.start();
    console.log('Queue worker started successfully');
    console.log('Press Ctrl+C to stop');
    
  } catch (error) {
    console.error('Failed to start queue worker:', error);
    process.exit(1);
  }
}

// Start the worker
startWorker();