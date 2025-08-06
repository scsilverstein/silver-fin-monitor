#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function cleanupStuckJobs() {
  console.log('🧹 Cleaning up stuck jobs...');
  
  try {
    // Find jobs that have been processing for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: selectError } = await supabase
      .from('job_queue')
      .select('id, job_type, started_at, attempts')
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo);
    
    if (selectError) {
      throw selectError;
    }
    
    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found');
      return;
    }
    
    console.log(`🔍 Found ${stuckJobs.length} stuck jobs:`);
    stuckJobs.forEach(job => {
      const duration = Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000 / 60);
      console.log(`  - ${job.job_type} (${duration} minutes old, attempt ${job.attempts})`);
    });
    
    // Mark them as failed
    const { error: updateError } = await supabase
      .from('job_queue')
      .update({
        status: 'failed',
        error_message: 'Job timed out - was processing for more than 5 minutes',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo);
    
    if (updateError) {
      throw updateError;
    }
    
    console.log(`✅ Successfully marked ${stuckJobs.length} stuck jobs as failed`);
    
    // Show current queue status
    const { data: queueStatus, error: statusError } = await supabase
      .from('job_queue')
      .select('status')
      .eq('status', 'processing');
    
    if (statusError) {
      throw statusError;
    }
    
    console.log(`📊 Current queue status: ${queueStatus?.length || 0} jobs still processing`);
    
  } catch (error) {
    console.error('❌ Error cleaning up stuck jobs:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupStuckJobs().then(() => {
  console.log('🎉 Cleanup complete');
  process.exit(0);
});