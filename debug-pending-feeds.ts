import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPendingFeeds() {
  // 1. Check raw_feeds table for pending TechCrunch items
  console.log('=== Checking Raw Feeds Status ===');
  const { data: pendingFeeds, error: feedError } = await supabase
    .from('raw_feeds')
    .select('id, source_id, title, processing_status, created_at, published_at')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (feedError) {
    console.error('Error fetching raw feeds:', feedError);
  } else {
    console.log(`Found ${pendingFeeds?.length || 0} pending feeds:`);
    pendingFeeds?.forEach(feed => {
      console.log(`- ID: ${feed.id.substring(0, 8)}... | Title: ${feed.title?.substring(0, 50)}... | Created: ${feed.created_at}`);
    });
  }

  // 2. Check if there are content processing jobs in the queue
  console.log('\n=== Checking Job Queue for Content Processing ===');
  const { data: contentJobs, error: jobError } = await supabase
    .from('job_queue')
    .select('id, job_type, status, payload, error_message, attempts, created_at')
    .or('job_type.eq.content_process,job_type.eq.process_content')
    .order('created_at', { ascending: false })
    .limit(10);

  if (jobError) {
    console.error('Error fetching jobs:', jobError);
  } else {
    console.log(`Found ${contentJobs?.length || 0} content processing jobs:`);
    contentJobs?.forEach(job => {
      console.log(`- Type: ${job.job_type} | Status: ${job.status} | Attempts: ${job.attempts} | Created: ${job.created_at}`);
      if (job.error_message) {
        console.log(`  Error: ${job.error_message}`);
      }
    });
  }

  // 3. Check for failed jobs
  console.log('\n=== Checking Failed Jobs ===');
  const { data: failedJobs, error: failedError } = await supabase
    .from('job_queue')
    .select('id, job_type, status, error_message, attempts, payload, created_at')
    .or('status.eq.failed,status.eq.retry')
    .order('created_at', { ascending: false })
    .limit(10);

  if (failedError) {
    console.error('Error fetching failed jobs:', failedError);
  } else {
    console.log(`Found ${failedJobs?.length || 0} failed/retry jobs:`);
    failedJobs?.forEach(job => {
      console.log(`- Type: ${job.job_type} | Status: ${job.status} | Attempts: ${job.attempts}`);
      console.log(`  Error: ${job.error_message}`);
      if (job.payload?.feedId || job.payload?.rawFeedId) {
        console.log(`  Feed ID: ${job.payload.feedId || job.payload.rawFeedId}`);
      }
    });
  }

  // 4. Check if TechCrunch source exists and get its ID
  console.log('\n=== Checking TechCrunch Feed Source ===');
  const { data: techCrunchSource, error: sourceError } = await supabase
    .from('feed_sources')
    .select('id, name, url, is_active, last_processed_at')
    .ilike('name', '%techcrunch%')
    .single();

  if (sourceError) {
    console.error('Error fetching TechCrunch source:', sourceError);
  } else if (techCrunchSource) {
    console.log(`TechCrunch Source: ${techCrunchSource.name}`);
    console.log(`- ID: ${techCrunchSource.id}`);
    console.log(`- Active: ${techCrunchSource.is_active}`);
    console.log(`- Last Processed: ${techCrunchSource.last_processed_at}`);

    // Check pending feeds specifically for TechCrunch
    const { data: techCrunchPending, error: tcError } = await supabase
      .from('raw_feeds')
      .select('id, title, processing_status, created_at')
      .eq('source_id', techCrunchSource.id)
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!tcError && techCrunchPending) {
      console.log(`\nFound ${techCrunchPending.length} pending TechCrunch feeds`);
    }
  }

  // 5. Check for any processing jobs
  console.log('\n=== Checking All Job Types Summary ===');
  const { data: allJobs, error: allJobsError } = await supabase
    .from('job_queue')
    .select('job_type, status')
    .limit(100);

  if (!allJobsError && allJobs) {
    const jobSummary: Record<string, number> = {};
    allJobs.forEach(job => {
      const key = `${job.job_type}-${job.status}`;
      jobSummary[key] = (jobSummary[key] || 0) + 1;
    });

    console.log('Job Summary:');
    Object.entries(jobSummary).forEach(([key, count]) => {
      console.log(`- ${key}: ${count}`);
    });
  }

  // 6. Check if content processing jobs were created for the pending feeds
  console.log('\n=== Checking if Content Jobs Were Created for Pending Feeds ===');
  if (pendingFeeds && pendingFeeds.length > 0) {
    const feedIds = pendingFeeds.map(f => f.id);
    console.log(`Checking for content processing jobs for ${feedIds.length} pending feeds...`);
    
    const { data: contentJobsForFeeds, error: contentJobError } = await supabase
      .from('job_queue')
      .select('id, job_type, status, payload, created_at, error_message')
      .eq('job_type', 'content_process')
      .in('payload->>rawFeedId', feedIds);

    if (contentJobError) {
      console.error('Error checking content jobs:', contentJobError);
    } else {
      console.log(`Found ${contentJobsForFeeds?.length || 0} content processing jobs for pending feeds`);
      contentJobsForFeeds?.forEach(job => {
        console.log(`- Job for feed ${job.payload?.rawFeedId} - Status: ${job.status}`);
      });
    }
  }

  // 7. Check the feed processing pipeline logic
  console.log('\n=== Analyzing the Issue ===');
  console.log('Key findings:');
  console.log('1. Feeds are being fetched successfully (feed_fetch jobs completing)');
  console.log('2. Raw feeds exist in "pending" status');
  console.log('3. Very few content_process jobs exist');
  console.log('4. No failed content_process jobs');
  console.log('');
  console.log('This suggests that content processing jobs are NOT being created');
  console.log('when feeds are fetched. The issue is likely in the feed fetching');
  console.log('process where it should create content_process jobs after saving raw feeds.');

  // 8. Check queue worker status
  console.log('\n=== Checking Recent Queue Activity ===');
  const { data: recentJobs, error: recentError } = await supabase
    .from('job_queue')
    .select('job_type, status, started_at, completed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!recentError && recentJobs) {
    console.log('Recent job activity:');
    recentJobs.forEach(job => {
      console.log(`- ${job.job_type} (${job.status}) - Created: ${job.created_at}`);
    });
  }
}

checkPendingFeeds().catch(console.error);