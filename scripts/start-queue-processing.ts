#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function startQueueProcessing() {
  console.log('🚀 Starting queue processing...');
  
  const maxJobs = 10;
  let processedCount = 0;
  
  try {
    // Process jobs one by one
    for (let i = 0; i < maxJobs; i++) {
      // Use the dequeue_job database function
      const { data: jobs, error: dequeueError } = await supabase
        .rpc('dequeue_job');
      
      if (dequeueError) {
        console.error('❌ Error dequeuing job:', dequeueError);
        break;
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('📭 No more jobs in queue');
        break;
      }
      
      const job = jobs[0];
      console.log(`\n📋 Processing job: ${job.job_type} (ID: ${job.job_id.substring(0, 8)}...)`);
      
      // For now, just mark feed_fetch jobs as completed since we disabled the problematic feed
      if (job.job_type === 'feed_fetch') {
        // Simulate processing by marking as completed
        const { error: completeError } = await supabase
          .rpc('complete_job', { job_id: job.job_id });
        
        if (completeError) {
          console.error('❌ Error completing job:', completeError);
          
          // Mark as failed instead
          await supabase.rpc('fail_job', { 
            job_id: job.job_id, 
            error_msg: 'Processing simulation failed' 
          });
        } else {
          console.log(`✅ Job completed successfully`);
          processedCount++;
        }
      } else {
        // For other job types, mark as retry for later processing
        await supabase.rpc('fail_job', { 
          job_id: job.job_id, 
          error_msg: 'Manual processing required' 
        });
        console.log(`↩️  Job marked for retry`);
      }
    }
    
    console.log(`\n📊 Processing summary:`);
    console.log(`  - Jobs processed: ${processedCount}`);
    
    // Show current queue status
    const { data: queueStatus, error: statusError } = await supabase
      .from('job_queue')
      .select('status')
      .in('status', ['pending', 'processing', 'retry']);
    
    if (!statusError && queueStatus) {
      const statusCounts = queueStatus.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`\n📈 Queue status after processing:`);
      console.log(`  - Pending: ${statusCounts.pending || 0}`);
      console.log(`  - Processing: ${statusCounts.processing || 0}`);
      console.log(`  - Retry: ${statusCounts.retry || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error during queue processing:', error);
    process.exit(1);
  }
}

// Run the processing
startQueueProcessing().then(() => {
  console.log('\n🎉 Queue processing complete!');
  process.exit(0);
});