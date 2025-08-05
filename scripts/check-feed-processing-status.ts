import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFeedProcessingStatus() {
  console.log('=== Feed Processing Status Check ===\n');

  try {
    // 1. Total raw_feeds count
    const { count: totalCount, error: countError } = await supabase
      .from('raw_feeds')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting raw_feeds:', countError);
    } else {
      console.log(`📊 Total raw_feeds: ${totalCount || 0}`);
    }

    // 2. Count by processing status
    const statuses = ['pending', 'processing', 'completed', 'failed'];
    console.log('\n📈 Processing Status Breakdown:');
    
    for (const status of statuses) {
      const { count, error } = await supabase
        .from('raw_feeds')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', status);

      if (error) {
        console.error(`Error counting ${status}:`, error);
      } else {
        console.log(`   ${status}: ${count || 0}`);
      }
    }

    // 3. Most recent raw_feeds entries
    console.log('\n📰 Most Recent Raw Feeds (last 10):');
    const { data: recentFeeds, error: recentError } = await supabase
      .from('raw_feeds')
      .select('id, title, source_id, processing_status, created_at, published_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error fetching recent feeds:', recentError);
    } else if (recentFeeds && recentFeeds.length > 0) {
      recentFeeds.forEach((feed, index) => {
        console.log(`\n${index + 1}. ${feed.title || 'No title'}`);
        console.log(`   ID: ${feed.id}`);
        console.log(`   Source ID: ${feed.source_id}`);
        console.log(`   Status: ${feed.processing_status}`);
        console.log(`   Created: ${new Date(feed.created_at).toLocaleString()}`);
        console.log(`   Published: ${feed.published_at ? new Date(feed.published_at).toLocaleString() : 'N/A'}`);
      });
    } else {
      console.log('   No raw feeds found');
    }

    // 4. Check content_process jobs in queue
    console.log('\n\n⚙️  Content Process Jobs in Queue:');
    const { data: contentJobs, error: jobError } = await supabase
      .from('job_queue')
      .select('id, job_type, status, priority, created_at, scheduled_at, attempts, error_message')
      .eq('job_type', 'content_process')
      .in('status', ['pending', 'processing', 'retry'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (jobError) {
      console.error('Error fetching content_process jobs:', jobError);
    } else if (contentJobs && contentJobs.length > 0) {
      console.log(`Found ${contentJobs.length} content_process jobs:`);
      contentJobs.forEach((job, index) => {
        console.log(`\n${index + 1}. Job ID: ${job.id}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Priority: ${job.priority}`);
        console.log(`   Attempts: ${job.attempts}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        console.log(`   Scheduled: ${new Date(job.scheduled_at).toLocaleString()}`);
        if (job.error_message) {
          console.log(`   Error: ${job.error_message}`);
        }
      });
    } else {
      console.log('   No content_process jobs in queue');
    }

    // Additional check: All job types in queue
    console.log('\n\n📋 All Active Jobs by Type:');
    const { data: allJobs, error: allJobsError } = await supabase
      .from('job_queue')
      .select('job_type')
      .in('status', ['pending', 'processing', 'retry']);

    if (allJobsError) {
      console.error('Error fetching all jobs:', allJobsError);
    } else if (allJobs) {
      const jobCounts = allJobs.reduce((acc: Record<string, number>, job) => {
        acc[job.job_type] = (acc[job.job_type] || 0) + 1;
        return acc;
      }, {});

      Object.entries(jobCounts).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

      if (Object.keys(jobCounts).length === 0) {
        console.log('   No active jobs in queue');
      }
    }

    // Check for any failed jobs
    console.log('\n\n❌ Failed Jobs (last 10):');
    const { data: failedJobs, error: failedError } = await supabase
      .from('job_queue')
      .select('id, job_type, error_message, attempts, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (failedError) {
      console.error('Error fetching failed jobs:', failedError);
    } else if (failedJobs && failedJobs.length > 0) {
      failedJobs.forEach((job, index) => {
        console.log(`\n${index + 1}. ${job.job_type} - ${job.id}`);
        console.log(`   Attempts: ${job.attempts}`);
        console.log(`   Error: ${job.error_message || 'No error message'}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
      });
    } else {
      console.log('   No failed jobs found');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkFeedProcessingStatus()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to run check:', error);
    process.exit(1);
  });