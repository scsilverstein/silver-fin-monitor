#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pnjtzwqieqcrchhjouaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI'
);

async function fixStuckJobs() {
  console.log('=== FIXING STUCK JOBS ===\n');
  
  // 1. Find jobs stuck in processing for more than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: stuckJobs, error: fetchError } = await supabase
    .from('job_queue')
    .select('id, job_type, started_at, attempts, max_attempts')
    .eq('status', 'processing')
    .lt('started_at', oneHourAgo);
  
  if (fetchError) {
    console.error('Error fetching stuck jobs:', fetchError);
    return;
  }
  
  console.log(`Found ${stuckJobs?.length || 0} stuck jobs\n`);
  
  if (stuckJobs && stuckJobs.length > 0) {
    // Reset stuck jobs based on attempts
    for (const job of stuckJobs) {
      const shouldRetry = job.attempts < job.max_attempts;
      const newStatus = shouldRetry ? 'pending' : 'failed';
      
      const { error: updateError } = await supabase
        .from('job_queue')
        .update({
          status: newStatus,
          started_at: null,
          error_message: shouldRetry 
            ? 'Reset from stuck processing state' 
            : 'Failed: Max attempts exceeded (was stuck in processing)',
          completed_at: shouldRetry ? null : new Date().toISOString()
        })
        .eq('id', job.id);
      
      if (updateError) {
        console.error(`Error updating job ${job.id}:`, updateError);
      } else {
        console.log(`✓ Job ${job.id} (${job.job_type}) reset to: ${newStatus}`);
      }
    }
    
    console.log('\n✅ Stuck jobs have been fixed!');
  }
  
  // 2. Get updated status counts
  console.log('\n=== UPDATED STATUS COUNTS ===');
  const { data: statusData } = await supabase
    .from('job_queue')
    .select('status')
    .limit(10000);
  
  if (statusData) {
    const statusMap = statusData.reduce((acc: any, job: any) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(statusMap)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
  }
}

fixStuckJobs().catch(console.error);