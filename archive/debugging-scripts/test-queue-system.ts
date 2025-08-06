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

async function testQueueSystem() {
  console.log('Testing Queue System...\n');
  
  try {
    // 1. Test enqueue_job function
    console.log('1. Testing enqueue_job:');
    const { data: jobId, error: enqueueError } = await supabase
      .rpc('enqueue_job', {
        job_type: 'test_job',
        payload: { message: 'Hello Queue!' },
        priority: 1,
        delay_seconds: 0
      });
    
    if (enqueueError) {
      console.error('Error enqueuing job:', enqueueError);
      return;
    }
    
    console.log('✓ Job enqueued successfully:', jobId);
    
    // 2. Test dequeue_job function
    console.log('\n2. Testing dequeue_job:');
    const { data: dequeuedJobs, error: dequeueError } = await supabase
      .rpc('dequeue_job');
    
    if (dequeueError) {
      console.error('Error dequeuing job:', dequeueError);
      return;
    }
    
    if (!dequeuedJobs || dequeuedJobs.length === 0) {
      console.log('No jobs available to dequeue');
      return;
    }
    
    const job = dequeuedJobs[0];
    console.log('✓ Job dequeued successfully:', {
      job_id: job.job_id,
      job_type: job.job_type,
      payload: job.payload,
      attempts: job.attempts
    });
    
    // 3. Test complete_job function
    console.log('\n3. Testing complete_job:');
    const { data: completed, error: completeError } = await supabase
      .rpc('complete_job', { job_id: job.job_id });
    
    if (completeError) {
      console.error('Error completing job:', completeError);
      return;
    }
    
    console.log('✓ Job completed successfully:', completed);
    
    // 4. Test fail_job function
    console.log('\n4. Testing fail_job:');
    // Create another job to test failure
    const { data: failJobId, error: failEnqueueError } = await supabase
      .rpc('enqueue_job', {
        job_type: 'test_fail_job',
        payload: { message: 'This will fail' },
        priority: 2,
        delay_seconds: 0
      });
    
    if (failEnqueueError) {
      console.error('Error enqueuing fail test job:', failEnqueueError);
      return;
    }
    
    // Dequeue the fail test job
    const { data: failJobs, error: failDequeueError } = await supabase
      .rpc('dequeue_job');
    
    if (failDequeueError || !failJobs || failJobs.length === 0) {
      console.error('Error dequeuing fail test job');
      return;
    }
    
    const failJob = failJobs[0];
    
    // Fail the job
    const { data: failed, error: failError } = await supabase
      .rpc('fail_job', { 
        job_id: failJob.job_id, 
        error_msg: 'Test failure message' 
      });
    
    if (failError) {
      console.error('Error failing job:', failError);
      return;
    }
    
    console.log('✓ Job failed successfully:', failed);
    
    // 5. Check queue stats
    console.log('\n5. Queue Statistics:');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_queue_stats');
    
    if (statsError) {
      console.error('Error getting queue stats:', statsError);
      return;
    }
    
    if (stats) {
      stats.forEach((stat: any) => {
        console.log(`- ${stat.status}: ${stat.count} jobs`);
      });
    }
    
    console.log('\n✅ All queue tests passed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testQueueSystem().then(() => {
  console.log('\nTest completed.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});