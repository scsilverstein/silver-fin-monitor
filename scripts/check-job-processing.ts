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

async function checkJobProcessing() {
  console.log('=== Checking Job Processing Status ===\n');

  try {
    // Check a sample of content_process jobs
    const { data: sampleJobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'content_process')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return;
    }

    console.log('Sample of recent content_process jobs:\n');
    sampleJobs?.forEach((job, index) => {
      console.log(`${index + 1}. Job ID: ${job.id}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Payload: ${JSON.stringify(job.payload)}`);
      console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
      console.log(`   Started: ${job.started_at ? new Date(job.started_at).toLocaleString() : 'Not started'}`);
      console.log('');
    });

    // Check if any feeds have been processed recently
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentlyProcessed, count: processedCount } = await supabase
      .from('raw_feeds')
      .select('id, title, processing_status, updated_at', { count: 'exact' })
      .eq('processing_status', 'completed')
      .gt('updated_at', tenMinutesAgo)
      .order('updated_at', { ascending: false })
      .limit(5);

    console.log(`\n=== Recently Processed Feeds (last 10 minutes) ===`);
    console.log(`Total: ${processedCount || 0}\n`);

    if (recentlyProcessed && recentlyProcessed.length > 0) {
      recentlyProcessed.forEach((feed, index) => {
        console.log(`${index + 1}. ${feed.title || feed.id}`);
        console.log(`   Status: ${feed.processing_status}`);
        console.log(`   Updated: ${new Date(feed.updated_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Check currently processing feeds
    const { data: processingFeeds, count: processingCount } = await supabase
      .from('raw_feeds')
      .select('id, title, processing_status, updated_at', { count: 'exact' })
      .eq('processing_status', 'processing');

    console.log(`\n=== Currently Processing Feeds ===`);
    console.log(`Total: ${processingCount || 0}`);

    if (processingFeeds && processingFeeds.length > 0) {
      processingFeeds.slice(0, 5).forEach((feed, index) => {
        console.log(`${index + 1}. ${feed.title || feed.id}`);
        console.log(`   Started: ${new Date(feed.updated_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Check for failed feeds
    const { data: failedFeeds, count: failedCount } = await supabase
      .from('raw_feeds')
      .select('id, title, processing_status, updated_at', { count: 'exact' })
      .eq('processing_status', 'failed')
      .gt('updated_at', tenMinutesAgo);

    console.log(`\n=== Failed Feeds (last 10 minutes) ===`);
    console.log(`Total: ${failedCount || 0}`);

    if (failedFeeds && failedFeeds.length > 0) {
      failedFeeds.slice(0, 5).forEach((feed, index) => {
        console.log(`${index + 1}. ${feed.title || feed.id}`);
        console.log(`   Failed at: ${new Date(feed.updated_at).toLocaleString()}`);
        console.log('');
      });
    }

    // Check queue health
    const { data: queueStats } = await supabase
      .from('job_queue')
      .select('status')
      .eq('job_type', 'content_process');

    if (queueStats) {
      const statusCounts: Record<string, number> = {};
      queueStats.forEach(job => {
        statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
      });

      console.log('\n=== Content Process Queue Health ===');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`${status}: ${count}`);
      });
    }

  } catch (error) {
    console.error('Error checking job processing:', error);
  }
}

// Run the check
checkJobProcessing().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});