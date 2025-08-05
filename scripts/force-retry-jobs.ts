#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function forceRetryJobs() {
  console.log('🔄 Forcing retry jobs to be ready now...');
  
  try {
    // Update all retry jobs to be scheduled now
    const { data, error } = await supabase
      .from('job_queue')
      .update({
        scheduled_at: new Date().toISOString()
      })
      .eq('status', 'retry')
      .select();
    
    if (error) throw error;
    
    console.log(`✅ Updated ${data?.length || 0} retry jobs to be ready now`);
    
    // Show the jobs
    if (data && data.length > 0) {
      console.log('\n📋 Jobs ready for processing:');
      data.forEach(job => {
        console.log(`  - ${job.job_type} (attempt ${job.attempts}/${job.max_attempts})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating retry jobs:', error);
    process.exit(1);
  }
}

// Run it
forceRetryJobs().then(() => {
  console.log('\n🎉 Done! Retry jobs are now ready to process.');
  process.exit(0);
});