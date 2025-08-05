import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanInvalidJobs() {
  try {
    console.log('Cleaning invalid jobs...\n');
    
    // Delete the job with invalid sourceId
    const invalidJobId = '0ce31a4a-8d01-4012-aac2-04955fc62010';
    
    console.log(`Deleting job with invalid sourceId: ${invalidJobId}`);
    
    const { error: deleteError } = await supabase
      .from('job_queue')
      .delete()
      .eq('id', invalidJobId);
    
    if (deleteError) {
      console.error('Error deleting invalid job:', deleteError);
    } else {
      console.log('✓ Invalid job deleted successfully');
    }
    
    // Now process the valid retry job
    console.log('\nProcessing valid retry job...');
    
    // Start queue worker temporarily
    const { queueWorker } = await import('../src/services/workers/queue-worker.js');
    
    console.log('Starting queue worker...');
    await queueWorker.start();
    
    // Give it some time to process
    console.log('Waiting for job processing...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    
    // Check status
    const workerStatus = queueWorker.getStatus();
    console.log('\nWorker status:', workerStatus);
    
    // Stop the worker
    console.log('\nStopping queue worker...');
    await queueWorker.stop();
    
    // Check final queue stats
    console.log('\nFinal Queue Statistics:');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_queue_stats');
    
    if (statsError) {
      console.error('Error fetching queue stats:', statsError);
    } else if (stats) {
      stats.forEach((stat: any) => {
        console.log(`- ${stat.status}: ${stat.count} jobs`);
      });
    }
    
  } catch (error) {
    console.error('Error cleaning invalid jobs:', error);
  }
}

// Run the cleanup
cleanInvalidJobs().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});