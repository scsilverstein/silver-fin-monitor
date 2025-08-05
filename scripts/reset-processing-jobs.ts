#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetStuckJobs() {
  console.log('=== Resetting Stuck Processing Jobs ===\n');

  // Reset jobs that have been "processing" for more than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: stuckJobs, error: selectError } = await supabase
    .from('job_queue')
    .select('id, job_type, status, started_at')
    .eq('status', 'processing')
    .lt('started_at', tenMinutesAgo);

  if (selectError) {
    console.error('Error finding stuck jobs:', selectError);
    return;
  }

  console.log(`Found ${stuckJobs?.length || 0} stuck jobs to reset`);

  if (stuckJobs && stuckJobs.length > 0) {
    for (const job of stuckJobs) {
      console.log(`- ${job.job_type} (${job.id}) - started at ${job.started_at}`);
    }

    // Reset them to pending status
    const { error: updateError } = await supabase
      .from('job_queue')
      .update({
        status: 'pending',
        started_at: null,
        attempts: 0
      })
      .eq('status', 'processing')
      .lt('started_at', tenMinutesAgo);

    if (updateError) {
      console.error('Error resetting jobs:', updateError);
      return;
    }

    console.log(`\n✅ Successfully reset ${stuckJobs.length} stuck jobs to pending status`);
  } else {
    console.log('No stuck jobs found');
  }

  // Show updated queue status
  console.log('\n=== Updated Queue Status ===');
  const { data: queueStatus } = await supabase
    .from('job_queue')
    .select('status, job_type')
    .order('priority', { ascending: true });

  if (queueStatus) {
    const statusCounts: Record<string, Record<string, number>> = {};
    
    for (const job of queueStatus) {
      if (!statusCounts[job.job_type]) {
        statusCounts[job.job_type] = {};
      }
      statusCounts[job.job_type][job.status] = (statusCounts[job.job_type][job.status] || 0) + 1;
    }

    for (const [jobType, statuses] of Object.entries(statusCounts)) {
      console.log(`\n${jobType}:`);
      for (const [status, count] of Object.entries(statuses)) {
        console.log(`  ${status}: ${count}`);
      }
    }
  }

  console.log('\n✅ Job reset complete');
}

resetStuckJobs().catch(console.error);