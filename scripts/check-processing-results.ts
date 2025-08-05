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

async function checkProcessingResults() {
  console.log('=== Processing Results Summary ===\n');

  try {
    // Get counts by processing status
    const { data: statusCounts, error: statusError } = await supabase
      .from('raw_feeds')
      .select('processing_status');

    if (statusError) {
      console.error('Error fetching status counts:', statusError);
      return;
    }

    const counts: Record<string, number> = {};
    statusCounts?.forEach(row => {
      counts[row.processing_status] = (counts[row.processing_status] || 0) + 1;
    });

    console.log('Raw Feeds by Status:');
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    // Get recently completed feeds
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentlyCompleted, count: completedCount } = await supabase
      .from('raw_feeds')
      .select('id, title, source_id, processing_status, updated_at', { count: 'exact' })
      .eq('processing_status', 'completed')
      .gt('updated_at', tenMinutesAgo)
      .order('updated_at', { ascending: false })
      .limit(10);

    console.log(`\n=== Recently Completed (last 10 minutes) ===`);
    console.log(`Total: ${completedCount || 0}\n`);

    if (recentlyCompleted && recentlyCompleted.length > 0) {
      recentlyCompleted.forEach((feed, index) => {
        console.log(`${index + 1}. ${feed.title || feed.id}`);
        console.log(`   Completed: ${new Date(feed.updated_at).toLocaleString()}`);
      });
    }

    // Check processed_content table
    const { count: processedContentCount } = await supabase
      .from('processed_content')
      .select('*', { count: 'exact', head: true });

    console.log(`\n=== Processed Content ===`);
    console.log(`Total processed content records: ${processedContentCount || 0}`);

    // Get sample of processed content
    const { data: sampleProcessed } = await supabase
      .from('processed_content')
      .select('raw_feed_id, summary, sentiment_score, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (sampleProcessed && sampleProcessed.length > 0) {
      console.log('\nSample of recent processed content:');
      sampleProcessed.forEach((content, index) => {
        console.log(`\n${index + 1}. Summary: ${content.summary?.substring(0, 100)}...`);
        console.log(`   Sentiment: ${content.sentiment_score}`);
        console.log(`   Created: ${new Date(content.created_at).toLocaleString()}`);
      });
    }

    // Check which feeds are still pending and why
    const { data: pendingFeeds } = await supabase
      .from('raw_feeds')
      .select('id, source_id, title, created_at')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    console.log('\n=== Sample of Pending Feeds ===');
    if (pendingFeeds && pendingFeeds.length > 0) {
      for (const feed of pendingFeeds) {
        // Check if it has a job
        const { data: jobs } = await supabase
          .from('job_queue')
          .select('status, created_at')
          .eq('job_type', 'content_process')
          .contains('payload', { rawFeedId: feed.id });

        console.log(`\n- ${feed.title || feed.id}`);
        console.log(`  Created: ${new Date(feed.created_at).toLocaleString()}`);
        console.log(`  Has job: ${jobs && jobs.length > 0 ? `Yes (${jobs[0].status})` : 'No'}`);
      }
    }

  } catch (error) {
    console.error('Error in checkProcessingResults:', error);
  }
}

// Run the check
checkProcessingResults().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});