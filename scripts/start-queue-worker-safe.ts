import { queueWorker } from '../src/services/workers/queue-worker';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set conservative concurrency to avoid race conditions
process.env.JOB_CONCURRENCY = '2';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorQueue() {
  try {
    const { data: stats } = await supabase.rpc('get_queue_stats');
    if (stats) {
      console.log('\n📊 Queue Status:');
      stats.forEach((stat: any) => {
        console.log(`  ${stat.status}: ${stat.count} jobs`);
      });
    }
    
    // Check for stuck jobs
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const { data: stuckJobs } = await supabase
      .from('job_queue')
      .select('id, job_type, started_at')
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo.toISOString());
    
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`\n⚠️  WARNING: ${stuckJobs.length} jobs stuck in processing!`);
      stuckJobs.forEach(job => {
        console.log(`  - ${job.job_type} (${job.id})`);
      });
    }
  } catch (error) {
    console.error('Monitor error:', error);
  }
}

async function startSafeWorker() {
  try {
    console.log('🚀 Starting Queue Worker (Safe Mode)');
    console.log('  Concurrency: 2 workers');
    console.log('  Monitor interval: 30 seconds');
    console.log('  Press Ctrl+C to stop\n');
    
    // Start the worker
    await queueWorker.start();
    
    // Initial status
    console.log('Worker started:', queueWorker.getStatus());
    
    // Monitor queue every 30 seconds
    const monitorInterval = setInterval(monitorQueue, 30000);
    monitorQueue(); // Run immediately
    
    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Stopping queue worker...');
      clearInterval(monitorInterval);
      
      try {
        await queueWorker.stop();
        console.log('✅ Queue worker stopped successfully');
        
        // Final queue check
        await monitorQueue();
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
      
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      shutdown();
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });
    
  } catch (error) {
    console.error('Failed to start queue worker:', error);
    process.exit(1);
  }
}

// Start the worker
startSafeWorker().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});