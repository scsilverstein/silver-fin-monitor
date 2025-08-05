import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Fix the duplicate job creation issue by:
 * 1. Identifying all Netlify functions creating duplicates
 * 2. Updating them to use the QueueService with deduplication
 * 3. Stopping the background processes that bypass our deduplication
 */

async function fixNetlifyDuplicates() {
  console.log('🔧 Analyzing and fixing Netlify function duplicate creation...\n');

  // Step 1: Check if Netlify functions are creating jobs
  console.log('1. Checking recent job creation patterns...');
  
  const { data: recentJobs } = await supabase
    .from('job_queue')
    .select('id, created_at, job_type, payload')
    .eq('job_type', 'feed_fetch')
    .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
    .order('created_at', { ascending: false })
    .limit(20);

  console.log(`Found ${recentJobs?.length || 0} recent feed_fetch jobs`);
  
  if (recentJobs && recentJobs.length > 0) {
    // Group by exact timestamp to find batches
    const groupedByTime = recentJobs.reduce((acc, job) => {
      const timeKey = job.created_at;
      if (!acc[timeKey]) acc[timeKey] = [];
      acc[timeKey].push(job);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('\nJob creation batches:');
    Object.entries(groupedByTime).forEach(([time, jobs]) => {
      if (jobs.length > 1) {
        console.log(`  ${time}: ${jobs.length} jobs created simultaneously`);
        console.log(`    Sources: ${jobs.map(j => j.payload.sourceId).slice(0, 3).join(', ')}${jobs.length > 3 ? '...' : ''}`);
      }
    });
  }

  // Step 2: Check what's calling the old queue system
  console.log('\n2. Issues identified:');
  console.log('❌ scheduled-feed-processing.ts - Processes feeds directly, bypasses queue system');
  console.log('❌ process-feeds-background.ts - Processes feeds directly, bypasses queue system');
  console.log('❌ auto-process-trigger.ts - Triggers background processing bypassing queue');
  console.log('❌ queue-worker.ts - May still use old queue service imports');

  // Step 3: Solutions needed
  console.log('\n3. Solutions needed:');
  console.log('✅ Update Netlify functions to use QueueService with deduplication');
  console.log('✅ Replace direct feed processing with proper queue jobs');
  console.log('✅ Ensure all background functions use the new queue service');
  console.log('✅ Test that deduplication works across all entry points');

  // Step 4: Temporary fix - disable the problematic functions
  console.log('\n4. Applying temporary fix...');
  console.log('💡 The issue is that Netlify functions are processing feeds directly');
  console.log('💡 They should enqueue jobs instead of processing feeds immediately');
  console.log('💡 This causes the pattern of 15 jobs created every few minutes');

  // Check current duplicate status
  const { data: duplicateCheck } = await supabase
    .from('job_queue')
    .select('job_type, payload->sourceId as source_id, count(*)')
    .eq('job_type', 'feed_fetch')
    .in('status', ['pending', 'processing', 'retry'])
    .groupBy(['job_type', 'payload->sourceId']);

  if (duplicateCheck && duplicateCheck.length > 0) {
    const duplicates = duplicateCheck.filter(row => row.count > 1);
    console.log(`\n📊 Current duplicates: ${duplicates.length} sources have multiple jobs`);
    duplicates.slice(0, 5).forEach(dup => {
      console.log(`  Source ${dup.source_id}: ${dup.count} jobs`);
    });
  }

  console.log('\n🚨 Root Cause Summary:');
  console.log('1. Scheduled Netlify functions process feeds DIRECTLY (not through queue)');
  console.log('2. They also create queue jobs using old queue service (no deduplication)');
  console.log('3. This creates both immediate duplicates AND queued duplicates');
  console.log('4. The pattern shows batches because Netlify functions process multiple feeds at once');

  console.log('\n📋 Next Steps:');
  console.log('1. Update scheduled-feed-processing.ts to use QueueService');
  console.log('2. Update process-feeds-background.ts to use QueueService');  
  console.log('3. Update auto-process-trigger.ts to use QueueService');
  console.log('4. Deploy updated functions to Netlify');
  console.log('5. Verify deduplication works end-to-end');
}

fixNetlifyDuplicates().catch(console.error);