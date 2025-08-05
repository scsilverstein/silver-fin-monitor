import 'dotenv/config';
import { QueueWorker } from '../src/services/workers/queue-worker';
import { logger } from '../src/utils/logger';

async function runWorker() {
  logger.info('Starting queue worker...');
  
  const worker = new QueueWorker();
  
  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down queue worker...');
    await worker.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  try {
    await worker.start();
    logger.info('Queue worker is running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Failed to start queue worker:', error);
    process.exit(1);
  }
}

runWorker();