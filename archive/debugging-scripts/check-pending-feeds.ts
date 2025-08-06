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

async function checkPendingFeeds() {
  console.log('=== Checking Pending Raw Feeds ===\n');

  try {
    // 1. Count pending raw feeds
    const { count: pendingCount, error: countError } = await supabase
      .from('raw_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'pending');

    if (countError) {
      console.error('Error counting pending feeds:', countError);
      return;
    }

    console.log(`Total pending raw feeds: ${pendingCount}`);

    // 2. Show examples of pending raw feeds
    const { data: pendingFeeds, error: feedsError } = await supabase
      .from('raw_feeds')
      .select('id, source_id, title, created_at, published_at')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (feedsError) {
      console.error('Error fetching pending feeds:', feedsError);
      return;
    }

    console.log('\nFirst 5 pending raw feeds:');
    pendingFeeds?.forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.title || 'No title'}`);
      console.log(`   ID: ${feed.id}`);
      console.log(`   Source ID: ${feed.source_id}`);
      console.log(`   Created: ${new Date(feed.created_at).toLocaleString()}`);
      console.log(`   Published: ${feed.published_at ? new Date(feed.published_at).toLocaleString() : 'N/A'}`);
      console.log('');
    });

    // 3. Check for corresponding content_process jobs
    console.log('=== Checking Queue Jobs ===\n');

    const feedIds = pendingFeeds?.map(f => f.id) || [];
    
    if (feedIds.length > 0) {
      // Check for content_process jobs for these specific feeds
      const { data: contentJobs, error: jobsError } = await supabase
        .from('job_queue')
        .select('*')
        .eq('job_type', 'content_process')
        .in('status', ['pending', 'processing', 'retry'])
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('Error fetching content jobs:', jobsError);
      } else {
        console.log(`Active content_process jobs: ${contentJobs?.length || 0}`);
        
        // Check which pending feeds have jobs
        const jobsForPendingFeeds = contentJobs?.filter(job => {
          const payload = job.payload as any;
          return feedIds.includes(payload?.rawFeedId);
        });

        console.log(`Jobs for the shown pending feeds: ${jobsForPendingFeeds?.length || 0}`);
        
        if (jobsForPendingFeeds && jobsForPendingFeeds.length > 0) {
          console.log('\nJobs found for pending feeds:');
          jobsForPendingFeeds.forEach(job => {
            const payload = job.payload as any;
            console.log(`- Feed ID: ${payload.rawFeedId}, Job Status: ${job.status}, Created: ${new Date(job.created_at).toLocaleString()}`);
          });
        }
      }
    }

    // 4. Show overall queue statistics
    console.log('\n=== Queue Statistics ===\n');

    // Get counts by job type and status
    const { data: queueStats, error: statsError } = await supabase
      .from('job_queue')
      .select('job_type, status')
      .in('status', ['pending', 'processing', 'retry', 'failed']);

    if (statsError) {
      console.error('Error fetching queue stats:', statsError);
      return;
    }

    // Aggregate stats
    const stats: Record<string, Record<string, number>> = {};
    queueStats?.forEach(job => {
      if (!stats[job.job_type]) {
        stats[job.job_type] = {};
      }
      stats[job.job_type][job.status] = (stats[job.job_type][job.status] || 0) + 1;
    });

    // Display stats
    Object.entries(stats).forEach(([jobType, statusCounts]) => {
      console.log(`${jobType}:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      console.log('');
    });

    // Get recently failed jobs
    const { data: failedJobs, error: failedError } = await supabase
      .from('job_queue')
      .select('job_type, error_message, attempts, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!failedError && failedJobs && failedJobs.length > 0) {
      console.log('=== Recent Failed Jobs ===\n');
      failedJobs.forEach((job, index) => {
        console.log(`${index + 1}. ${job.job_type}`);
        console.log(`   Error: ${job.error_message || 'No error message'}`);
        console.log(`   Attempts: ${job.attempts}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Check for orphaned pending feeds (pending for too long)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: orphanedCount, error: orphanedError } = await supabase
      .from('raw_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'pending')
      .lt('created_at', oneHourAgo);

    if (!orphanedError) {
      console.log(`\n=== Orphaned Feeds ===`);
      console.log(`Feeds pending for more than 1 hour: ${orphanedCount}`);
    }

  } catch (error) {
    console.error('Error in checkPendingFeeds:', error);
  }
}

// Run the check
checkPendingFeeds().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});