import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPendingFeeds() {
  console.log('=== Fixing Pending Feeds by Creating Content Processing Jobs ===');

  // 1. Get all pending feeds
  const { data: pendingFeeds, error: feedError } = await supabase
    .from('raw_feeds')
    .select('id, source_id, title, external_id, created_at')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false });

  if (feedError) {
    console.error('Error fetching pending feeds:', feedError);
    return;
  }

  console.log(`Found ${pendingFeeds?.length || 0} pending feeds`);

  if (!pendingFeeds || pendingFeeds.length === 0) {
    console.log('No pending feeds to process');
    return;
  }

  // 2. For each pending feed, create a content processing job
  let jobsCreated = 0;
  let jobsSkipped = 0;

  for (const feed of pendingFeeds) {
    try {
      // Check if a content processing job already exists for this feed
      const { data: existingJobs, error: jobCheckError } = await supabase
        .from('job_queue')
        .select('id, status')
        .eq('job_type', 'content_process')
        .or(`payload->>rawFeedId.eq.${feed.id},payload->>externalId.eq.${feed.external_id}`)
        .limit(1);

      if (jobCheckError) {
        console.error(`Error checking existing jobs for feed ${feed.id}:`, jobCheckError);
        continue;
      }

      if (existingJobs && existingJobs.length > 0) {
        console.log(`- Skipping feed ${feed.id.substring(0, 8)}... (job already exists: ${existingJobs[0].status})`);
        jobsSkipped++;
        continue;
      }

      // Create content processing job with rawFeedId (preferred method)
      const { error: insertError } = await supabase
        .from('job_queue')
        .insert({
          job_type: 'content_process',
          priority: 3,
          payload: {
            rawFeedId: feed.id,
            sourceId: feed.source_id,
            externalId: feed.external_id
          },
          status: 'pending',
          attempts: 0,
          max_attempts: 3,
          scheduled_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`Error creating job for feed ${feed.id}:`, insertError);
      } else {
        console.log(`- Created content processing job for feed ${feed.id.substring(0, 8)}... (${feed.title?.substring(0, 50)}...)`);
        jobsCreated++;
      }

    } catch (error) {
      console.error(`Error processing feed ${feed.id}:`, error);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Jobs created: ${jobsCreated}`);
  console.log(`Jobs skipped (already exist): ${jobsSkipped}`);
  console.log(`Total pending feeds: ${pendingFeeds.length}`);

  // 3. Show next steps
  console.log(`\n=== Next Steps ===`);
  console.log('1. Make sure the queue worker is running to process these jobs');
  console.log('2. Monitor the job_queue table to see processing progress');
  console.log('3. Check that raw_feeds processing_status changes from "pending" to "completed"');
  console.log('4. Verify that processed_content entries are created');
}

fixPendingFeeds().catch(console.error);