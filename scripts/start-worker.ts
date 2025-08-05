#!/usr/bin/env node
import { config } from 'dotenv';
import { queueWorker } from '../src/services/workers/queue-worker';
import { logger } from '../src/utils/logger';

// Load environment variables
config();

async function startWorker() {
  console.log('🚀 Starting Queue Worker\n');
  
  try {
    await queueWorker.start();
    console.log('✅ Queue worker started successfully');
    console.log('Processing jobs... Press Ctrl+C to stop\n');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n⏹️  Stopping queue worker...');
      await queueWorker.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n⏹️  Stopping queue worker...');
      await queueWorker.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start queue worker:', error);
    process.exit(1);
  }
}

startWorker().catch(console.error);