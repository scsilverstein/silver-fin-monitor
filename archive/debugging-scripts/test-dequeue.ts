#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDequeue() {
  console.log('=== Testing Dequeue Function ===\n');

  try {
    // First, let's see what jobs are eligible for dequeue
    const { data: eligibleJobs, error: queryError } = await supabase
      .from('job_queue')
      .select('*')
      .in('status', ['pending', 'retry'])
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (queryError) {
      console.error('Error querying eligible jobs:', queryError);
      return;
    }

    console.log(`Found ${eligibleJobs?.length || 0} eligible jobs:\n`);
    
    eligibleJobs?.forEach((job, index) => {
      console.log(`${index + 1}. ${job.job_type} (priority: ${job.priority})`);
      console.log(`   ID: ${job.id}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Attempts: ${job.attempts}/${job.max_attempts}`);
      console.log(`   Scheduled: ${new Date(job.scheduled_at).toLocaleString()}`);
      console.log(`   Payload: ${JSON.stringify(job.payload)}`);
      console.log('');
    });

    // Try to dequeue a job
    console.log('=== Attempting to Dequeue a Job ===\n');
    
    const { data: dequeuedJob, error: dequeueError } = await supabase
      .rpc('dequeue_job');

    if (dequeueError) {
      console.error('Error dequeuing job:', dequeueError);
      return;
    }

    if (dequeuedJob && dequeuedJob.length > 0) {
      const job = dequeuedJob[0];
      console.log('Successfully dequeued job:');
      console.log(`Type: ${job.job_type}`);
      console.log(`ID: ${job.job_id}`);
      console.log(`Priority: ${job.priority}`);
      console.log(`Attempts: ${job.attempts}`);
      console.log(`Payload: ${JSON.stringify(job.payload)}`);

      // Mark it as completed so we don't leave it hanging
      const { error: completeError } = await supabase
        .rpc('complete_job', { job_id: job.job_id });
      
      if (!completeError) {
        console.log('\nJob marked as completed for testing purposes');
      }
    } else {
      console.log('No job was dequeued (empty result)');
    }

    // Check if there are any jobs stuck in 'processing' state
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stuckJobs, count: stuckCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact' })
      .eq('status', 'processing')
      .lt('started_at', oneHourAgo);

    if (stuckCount && stuckCount > 0) {
      console.log(`\n⚠️  Warning: Found ${stuckCount} jobs stuck in processing state for over 1 hour`);
      stuckJobs?.slice(0, 3).forEach((job, index) => {
        console.log(`${index + 1}. ${job.job_type} - started at ${new Date(job.started_at).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('Error in testDequeue:', error);
  }
}

// Run the test
testDequeue().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});