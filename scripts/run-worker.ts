import { queueWorker } from '../src/services/workers/queue-worker';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function runWorker() {
  try {
    console.log('Starting queue worker...');
    
    // Start the worker
    await queueWorker.start();
    
    console.log('Queue worker started. Press Ctrl+C to stop.');
    console.log('Worker status:', queueWorker.getStatus());
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\nStopping queue worker...');
      await queueWorker.stop();
      console.log('Queue worker stopped.');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\nStopping queue worker...');
      await queueWorker.stop();
      console.log('Queue worker stopped.');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start queue worker:', error);
    process.exit(1);
  }
}

// Run the worker
runWorker().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});