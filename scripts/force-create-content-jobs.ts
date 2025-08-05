import { createClient } from '@supabase/supabase-js';
import { DatabaseService } from '../src/services/database/db.service';
import { logger } from '../src/utils/logger';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

async function forceCreateContentJobs() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  const dbService = new DatabaseService(
    { 
      url: process.env.SUPABASE_URL as string,
      anonKey: process.env.SUPABASE_ANON_KEY as string,
      serviceKey: process.env.SUPABASE_SERVICE_KEY as string
    },
    logger as winston.Logger
  );

  console.log('🔧 Force creating content_process jobs for pending feeds...');

  // Get pending raw feeds
  const { data: pendingFeeds } = await supabase
    .from('raw_feeds')
    .select('id, source_id, external_id, title')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5); // Just first 5 for testing

  if (!pendingFeeds || pendingFeeds.length === 0) {
    console.log('No pending feeds found');
    return;
  }

  console.log(`Found ${pendingFeeds.length} pending feeds`);

  for (const feed of pendingFeeds) {
    console.log(`Creating job for: ${feed.title?.substring(0, 50)}...`);
    
    // Use enqueue_job function directly without deduplication
    const result = await dbService.query(
      'SELECT enqueue_job($1, $2, $3, $4) as job_id',
      [
        'content_process',
        JSON.stringify({
          sourceId: feed.source_id,
          externalId: feed.external_id,
          rawFeedId: feed.id
        }),
        3, // priority
        0  // delay
      ]
    );

    if (result && result.length > 0) {
      console.log(`  ✅ Created job: ${result[0].job_id}`);
    } else {
      console.log(`  ❌ Failed to create job`);
    }
  }

  // Check queue status
  const { data: contentJobs } = await supabase
    .from('job_queue')
    .select('id, status')
    .eq('job_type', 'content_process');

  console.log(`\n📊 Total content_process jobs in queue: ${contentJobs?.length || 0}`);
}

forceCreateContentJobs().catch(console.error);