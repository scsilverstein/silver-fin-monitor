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

async function fixQueueJobs() {
  console.log('=== Fixing Queue Jobs ===\n');

  try {
    // 1. Get all content_process jobs with old payload format
    const { data: oldJobs, error: oldJobsError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'content_process')
      .in('status', ['retry', 'pending']);

    if (oldJobsError) {
      console.error('Error fetching old jobs:', oldJobsError);
      return;
    }

    console.log(`Found ${oldJobs?.length || 0} content_process jobs to check\n`);

    // Separate jobs by payload format
    const jobsWithOldFormat: any[] = [];
    const jobsWithNewFormat: any[] = [];

    oldJobs?.forEach(job => {
      const payload = job.payload as any;
      if (payload?.sourceId && payload?.externalId && !payload?.rawFeedId) {
        jobsWithOldFormat.push(job);
      } else if (payload?.rawFeedId) {
        jobsWithNewFormat.push(job);
      }
    });

    console.log(`Jobs with old format (sourceId/externalId): ${jobsWithOldFormat.length}`);
    console.log(`Jobs with new format (rawFeedId): ${jobsWithNewFormat.length}\n`);

    // 2. For old format jobs, try to find corresponding raw_feeds
    if (jobsWithOldFormat.length > 0) {
      console.log('=== Converting Old Format Jobs ===\n');
      
      let converted = 0;
      let notFound = 0;
      let deleted = 0;

      for (const job of jobsWithOldFormat) {
        const payload = job.payload as any;
        
        // Try to find the raw feed
        const { data: rawFeed, error: feedError } = await supabase
          .from('raw_feeds')
          .select('id, title, processing_status')
          .eq('source_id', payload.sourceId)
          .eq('external_id', payload.externalId)
          .single();

        if (feedError || !rawFeed) {
          console.log(`❌ Raw feed not found for job ${job.id} (source: ${payload.sourceId}, external: ${payload.externalId})`);
          
          // Delete this job as it has no corresponding feed
          await supabase
            .from('job_queue')
            .delete()
            .eq('id', job.id);
          
          deleted++;
          notFound++;
        } else {
          console.log(`✅ Found raw feed: ${rawFeed.title || rawFeed.id} (status: ${rawFeed.processing_status})`);
          
          // Delete old job
          await supabase
            .from('job_queue')
            .delete()
            .eq('id', job.id);
          
          // Create new job with correct format if feed is still pending
          if (rawFeed.processing_status === 'pending') {
            const { data: newJob, error: enqueueError } = await supabase
              .rpc('enqueue_job', {
                job_type: 'content_process',
                payload: JSON.stringify({ rawFeedId: rawFeed.id }),
                priority: 5
              });

            if (!enqueueError) {
              console.log(`   → Created new job with rawFeedId: ${rawFeed.id}`);
              converted++;
            } else {
              console.error(`   → Failed to create new job:`, enqueueError);
            }
          } else {
            console.log(`   → Feed already ${rawFeed.processing_status}, skipping`);
            deleted++;
          }
        }
      }

      console.log(`\nConversion Summary:`);
      console.log(`- Converted to new format: ${converted}`);
      console.log(`- Deleted (no feed or already processed): ${deleted}`);
      console.log(`- Not found: ${notFound}\n`);
    }

    // 3. Now queue all pending feeds that don't have jobs
    console.log('=== Queuing Remaining Pending Feeds ===\n');
    
    // Get all pending feeds
    const { data: pendingFeeds, error: pendingError } = await supabase
      .from('raw_feeds')
      .select('id, title, created_at')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true });

    if (pendingError) {
      console.error('Error fetching pending feeds:', pendingError);
      return;
    }

    console.log(`Found ${pendingFeeds?.length || 0} pending feeds\n`);

    // Get existing jobs with new format
    const { data: existingJobs, error: existingError } = await supabase
      .from('job_queue')
      .select('payload')
      .eq('job_type', 'content_process')
      .in('status', ['pending', 'processing', 'retry']);

    const existingFeedIds = new Set(
      existingJobs?.map(job => (job.payload as any)?.rawFeedId).filter(Boolean) || []
    );

    console.log(`${existingFeedIds.size} feeds already have jobs\n`);

    // Queue feeds without jobs
    let queued = 0;
    const feedsToQueue = pendingFeeds?.filter(feed => !existingFeedIds.has(feed.id)) || [];

    for (const feed of feedsToQueue) {
      const { error: enqueueError } = await supabase
        .rpc('enqueue_job', {
          job_type: 'content_process',
          payload: JSON.stringify({ rawFeedId: feed.id }),
          priority: 5
        });

      if (!enqueueError) {
        queued++;
        console.log(`✅ Queued: ${feed.title || feed.id}`);
      } else {
        console.error(`❌ Failed to queue ${feed.id}:`, enqueueError);
      }
    }

    console.log(`\n=== Final Summary ===`);
    console.log(`Successfully queued: ${queued} feeds`);

    // 4. Show updated queue statistics
    console.log('\n=== Updated Queue Statistics ===\n');

    const { data: queueStats, error: statsError } = await supabase
      .from('job_queue')
      .select('job_type, status')
      .in('status', ['pending', 'processing', 'retry', 'failed']);

    if (!statsError && queueStats) {
      const statsByTypeAndStatus: Record<string, Record<string, number>> = {};
      
      queueStats.forEach(job => {
        if (!statsByTypeAndStatus[job.job_type]) {
          statsByTypeAndStatus[job.job_type] = {};
        }
        statsByTypeAndStatus[job.job_type][job.status] = 
          (statsByTypeAndStatus[job.job_type][job.status] || 0) + 1;
      });

      Object.entries(statsByTypeAndStatus).forEach(([jobType, statusCounts]) => {
        console.log(`${jobType}:`);
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`  ${status}: ${count}`);
        });
        console.log('');
      });
    }

  } catch (error) {
    console.error('Error in fixQueueJobs:', error);
  }
}

// Run the fix
fixQueueJobs().then(() => {
  console.log('\n✅ Fix complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});