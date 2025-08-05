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

async function cleanupQueue() {
  console.log('=== Cleaning Up Queue ===\n');

  try {
    // 1. Reset stuck processing jobs
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('job_queue')
      .update({ 
        status: 'retry',
        scheduled_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('started_at', oneHourAgo)
      .select();

    if (stuckError) {
      console.error('Error resetting stuck jobs:', stuckError);
    } else {
      console.log(`Reset ${stuckJobs?.length || 0} stuck processing jobs\n`);
    }

    // 2. Delete old content_process retry jobs with mock data
    const { data: mockJobs, error: mockError } = await supabase
      .from('job_queue')
      .delete()
      .eq('job_type', 'content_process')
      .eq('status', 'retry')
      .like('payload', '%mock-%')
      .select();

    if (mockError) {
      console.error('Error deleting mock jobs:', mockError);
    } else {
      console.log(`Deleted ${mockJobs?.length || 0} mock content_process jobs\n`);
    }

    // 3. Update priority for content_process jobs to be higher
    const { data: updatedJobs, error: updateError } = await supabase
      .from('job_queue')
      .update({ priority: 3 }) // Higher priority than 5
      .eq('job_type', 'content_process')
      .eq('status', 'pending')
      .select();

    if (updateError) {
      console.error('Error updating priorities:', updateError);
    } else {
      console.log(`Updated priority for ${updatedJobs?.length || 0} content_process jobs\n`);
    }

    // 4. Show updated queue status
    const { data: queueStats } = await supabase
      .from('job_queue')
      .select('job_type, status, priority')
      .in('status', ['pending', 'processing', 'retry']);

    if (queueStats) {
      const stats: Record<string, Record<string, number>> = {};
      queueStats.forEach(job => {
        const key = `${job.job_type} (priority ${job.priority})`;
        if (!stats[key]) stats[key] = {};
        stats[key][job.status] = (stats[key][job.status] || 0) + 1;
      });

      console.log('=== Updated Queue Status ===');
      Object.entries(stats).forEach(([jobType, statusCounts]) => {
        console.log(`\n${jobType}:`);
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`  ${status}: ${count}`);
        });
      });
    }

    // 5. Test dequeue to see what would be picked next
    console.log('\n=== Next Job to be Processed ===\n');
    
    const { data: nextJob } = await supabase
      .from('job_queue')
      .select('*')
      .in('status', ['pending', 'retry'])
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single();

    if (nextJob) {
      console.log(`Type: ${nextJob.job_type}`);
      console.log(`Priority: ${nextJob.priority}`);
      console.log(`Status: ${nextJob.status}`);
      console.log(`Payload: ${JSON.stringify(nextJob.payload)}`);
    }

  } catch (error) {
    console.error('Error in cleanupQueue:', error);
  }
}

// Run the cleanup
cleanupQueue().then(() => {
  console.log('\n✅ Cleanup complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});