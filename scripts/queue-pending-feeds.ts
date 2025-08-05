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

async function queuePendingFeeds() {
  console.log('=== Queuing Pending Feeds for Processing ===\n');

  try {
    // Get all pending feeds
    const { data: pendingFeeds, error: feedsError } = await supabase
      .from('raw_feeds')
      .select('id, source_id, title, created_at')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true });

    if (feedsError) {
      console.error('Error fetching pending feeds:', feedsError);
      return;
    }

    console.log(`Found ${pendingFeeds?.length || 0} pending feeds\n`);

    if (!pendingFeeds || pendingFeeds.length === 0) {
      console.log('No pending feeds to process');
      return;
    }

    // Check existing content_process jobs to avoid duplicates
    const { data: existingJobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('payload')
      .eq('job_type', 'content_process')
      .in('status', ['pending', 'processing', 'retry']);

    if (jobsError) {
      console.error('Error fetching existing jobs:', jobsError);
      return;
    }

    // Extract feed IDs from existing jobs
    const existingFeedIds = new Set(
      existingJobs?.map(job => (job.payload as any)?.rawFeedId).filter(Boolean) || []
    );

    console.log(`Found ${existingFeedIds.size} feeds already in queue\n`);

    // Filter out feeds that already have jobs
    const feedsToQueue = pendingFeeds.filter(feed => !existingFeedIds.has(feed.id));

    console.log(`${feedsToQueue.length} feeds need to be queued\n`);

    if (feedsToQueue.length === 0) {
      console.log('All pending feeds already have jobs in queue');
      return;
    }

    // Create jobs for pending feeds
    let successCount = 0;
    let errorCount = 0;

    for (const feed of feedsToQueue) {
      try {
        // Call the enqueue_job function to create a content_process job
        const { data, error } = await supabase
          .rpc('enqueue_job', {
            job_type: 'content_process',
            payload: JSON.stringify({ rawFeedId: feed.id }),
            priority: 5
          });

        if (error) {
          console.error(`Error queuing feed ${feed.id}:`, error);
          errorCount++;
        } else {
          successCount++;
          console.log(`✅ Queued: ${feed.title || feed.id}`);
        }
      } catch (error) {
        console.error(`Exception queuing feed ${feed.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Successfully queued: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    // Show updated queue statistics
    console.log('\n=== Updated Queue Statistics ===\n');

    const { data: queueStats, error: statsError } = await supabase
      .from('job_queue')
      .select('job_type, status')
      .eq('job_type', 'content_process')
      .in('status', ['pending', 'processing', 'retry']);

    if (!statsError && queueStats) {
      const statsByStatus: Record<string, number> = {};
      queueStats.forEach(job => {
        statsByStatus[job.status] = (statsByStatus[job.status] || 0) + 1;
      });

      console.log('content_process jobs:');
      Object.entries(statsByStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }

  } catch (error) {
    console.error('Error in queuePendingFeeds:', error);
  }
}

// Run the queue operation
queuePendingFeeds().then(() => {
  console.log('\n✅ Queue operation complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});