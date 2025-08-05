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

async function resetQueueSystem() {
  console.log('🔧 Resetting Queue System...\n');
  
  try {
    // 1. Get all stuck jobs
    console.log('1. Finding all stuck jobs...');
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'processing');
    
    if (stuckError) throw stuckError;
    
    console.log(`Found ${stuckJobs?.length || 0} jobs in processing state`);
    
    // 2. Reset jobs based on type and attempts
    if (stuckJobs && stuckJobs.length > 0) {
      console.log('\n2. Resetting jobs based on type...');
      
      for (const job of stuckJobs) {
        // Delete test jobs
        if (job.job_type.startsWith('test_') || job.job_type === 'worker_heartbeat') {
          console.log(`  Deleting test job: ${job.id} (${job.job_type})`);
          await supabase
            .from('job_queue')
            .delete()
            .eq('id', job.id);
        }
        // Reset important jobs to retry
        else if (job.attempts < job.max_attempts) {
          console.log(`  Resetting to retry: ${job.id} (${job.job_type})`);
          await supabase.rpc('fail_job', {
            job_id: job.id,
            error_msg: 'Reset by queue system diagnostic'
          });
        }
        // Mark max-attempted jobs as failed
        else {
          console.log(`  Marking as failed: ${job.id} (${job.job_type})`);
          await supabase
            .from('job_queue')
            .update({
              status: 'failed',
              error_message: 'Max attempts exceeded during reset',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
      }
    }
    
    // 3. Clean up old completed jobs
    console.log('\n3. Cleaning up old completed jobs...');
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const { error: cleanupError } = await supabase
      .from('job_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', oneHourAgo.toISOString());
    
    if (cleanupError) {
      console.warn('Failed to cleanup old jobs:', cleanupError);
    } else {
      console.log('✓ Old completed jobs cleaned up');
    }
    
    // 4. Check the dequeue function
    console.log('\n4. Testing dequeue function...');
    
    // Create a test job
    const { data: testJobId } = await supabase.rpc('enqueue_job', {
      job_type: 'queue_test',
      payload: { test: true, timestamp: Date.now() },
      priority: 1,
      delay_seconds: 0
    });
    
    console.log(`  Created test job: ${testJobId}`);
    
    // Try to dequeue it
    const { data: dequeuedJob, error: dequeueError } = await supabase.rpc('dequeue_job');
    
    if (dequeueError) {
      console.error('  ❌ Dequeue function error:', dequeueError);
    } else if (dequeuedJob && dequeuedJob.length > 0) {
      console.log('  ✓ Successfully dequeued job:', dequeuedJob[0].job_id);
      
      // Complete the test job
      await supabase.rpc('complete_job', { job_id: dequeuedJob[0].job_id });
    } else {
      console.log('  ⚠️  No job was dequeued');
    }
    
    // 5. Final queue statistics
    console.log('\n5. Final Queue Statistics:');
    const { data: stats } = await supabase.rpc('get_queue_stats');
    
    if (stats) {
      const totalJobs = stats.reduce((sum: number, stat: any) => sum + (stat.count || 0), 0);
      console.log(`  Total jobs: ${totalJobs}`);
      stats.forEach((stat: any) => {
        console.log(`  - ${stat.status}: ${stat.count} jobs`);
      });
    }
    
    // 6. Recommendations
    console.log('\n📋 Recommendations:');
    console.log('  1. Start the queue worker with: npm run queue:worker');
    console.log('  2. Monitor the queue at: http://localhost:8888/queue');
    console.log('  3. Check logs for any processing errors');
    console.log('  4. Consider reducing worker concurrency if jobs keep getting stuck');
    
  } catch (error) {
    console.error('Error resetting queue system:', error);
  }
}

// Run the reset
resetQueueSystem().then(() => {
  console.log('\n✅ Queue system reset complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});