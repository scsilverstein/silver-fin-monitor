#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixContentProcessing() {
  console.log('=== Fixing Content Processing ===\n');

  // Get all pending raw feeds
  const { data: pendingFeeds, error: feedsError } = await supabase
    .from('raw_feeds')
    .select('id, source_id, title, created_at')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false });

  if (feedsError) {
    console.error('Error fetching pending feeds:', feedsError);
    return;
  }

  console.log(`Found ${pendingFeeds?.length || 0} pending raw feeds\n`);

  if (!pendingFeeds || pendingFeeds.length === 0) {
    console.log('No pending feeds to process');
    return;
  }

  // Create content_process jobs for each pending feed
  let successCount = 0;
  let errorCount = 0;

  for (const feed of pendingFeeds) {
    try {
      // Use the enqueue_job function to create a content_process job
      const { data, error } = await supabase.rpc('enqueue_job', {
        job_type: 'content_process',
        payload: { rawFeedId: feed.id },
        priority: 5,
        delay_seconds: 0
      });

      if (error) {
        console.error(`Error enqueuing job for feed ${feed.id}:`, error);
        errorCount++;
      } else {
        console.log(`✅ Enqueued content_process job for: ${feed.title?.substring(0, 50)}...`);
        successCount++;
      }
    } catch (error) {
      console.error(`Failed to enqueue job for feed ${feed.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n\n✅ Summary:`);
  console.log(`  - Successfully enqueued: ${successCount} jobs`);
  console.log(`  - Failed to enqueue: ${errorCount} jobs`);
  console.log(`\nContent processing jobs have been created. The queue worker should pick them up shortly.`);

  // Check queue stats
  const { data: queueStats } = await supabase.rpc('get_queue_stats');
  if (queueStats) {
    console.log('\nCurrent Queue Stats:');
    queueStats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat.count}`);
    });
  }
}

fixContentProcessing().catch(console.error);