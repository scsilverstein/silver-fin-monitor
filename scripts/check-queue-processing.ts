#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkQueueProcessing() {
  console.log('=== Checking Queue Processing ===\n');

  // Check recent jobs
  const { data: recentJobs, error: jobsError } = await supabase
    .from('job_queue')
    .select('job_type, status, payload, created_at, started_at, completed_at')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    .order('created_at', { ascending: false })
    .limit(20);

  if (jobsError) {
    console.error('Error fetching jobs:', jobsError);
    return;
  }

  console.log(`Found ${recentJobs?.length || 0} jobs in the last hour\n`);

  // Group by type and status
  const jobStats: Record<string, Record<string, number>> = {};
  recentJobs?.forEach(job => {
    if (!jobStats[job.job_type]) jobStats[job.job_type] = {};
    if (!jobStats[job.job_type][job.status]) jobStats[job.job_type][job.status] = 0;
    jobStats[job.job_type][job.status]++;
  });

  console.log('Job Statistics:');
  Object.entries(jobStats).forEach(([type, statuses]) => {
    console.log(`\n${type}:`);
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  });

  // Show recent job details
  console.log('\n\nRecent Jobs:');
  recentJobs?.slice(0, 10).forEach(job => {
    console.log(`\n${job.job_type} - ${job.status}`);
    console.log(`  Created: ${new Date(job.created_at).toLocaleString()}`);
    if (job.started_at) console.log(`  Started: ${new Date(job.started_at).toLocaleString()}`);
    if (job.completed_at) console.log(`  Completed: ${new Date(job.completed_at).toLocaleString()}`);
    if (job.payload) console.log(`  Payload: ${JSON.stringify(job.payload).substring(0, 100)}...`);
  });

  // Check if there are pending content_process jobs
  const { data: pendingContent, error: pendingError } = await supabase
    .from('job_queue')
    .select('id, payload')
    .eq('job_type', 'content_process')
    .eq('status', 'pending')
    .limit(5);

  if (!pendingError && pendingContent?.length) {
    console.log(`\n\n⚠️  Found ${pendingContent.length} pending content_process jobs!`);
    console.log('This means feed fetching created the jobs but they are not being processed.');
  }

  // Check raw feeds that need processing
  const { data: unprocessedFeeds, error: feedsError } = await supabase
    .from('raw_feeds')
    .select('id, title, created_at')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!feedsError && unprocessedFeeds?.length) {
    console.log(`\n\n📋 Found ${unprocessedFeeds.length} unprocessed raw feeds:`);
    unprocessedFeeds.forEach(feed => {
      console.log(`  - ${feed.title?.substring(0, 50)}... (${new Date(feed.created_at).toLocaleString()})`);
    });
  }
}

checkQueueProcessing().catch(console.error);