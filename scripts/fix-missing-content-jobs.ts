import { createClient } from '@supabase/supabase-js';
import { QueueService, JobType } from '../src/services/queue/queue.service';
import { DatabaseService } from '../src/services/database/db.service';
import { logger } from '../src/utils/logger';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

async function fixMissingContentJobs() {
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

  const queueService = new QueueService(dbService, logger as winston.Logger);

  console.log('🔍 Checking for pending raw feeds without content_process jobs...');

  // Get pending raw feeds
  const { data: pendingFeeds, error } = await supabase
    .from('raw_feeds')
    .select('id, source_id, external_id, title, processing_status, created_at')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching pending feeds:', error);
    return;
  }

  console.log(`📄 Found ${pendingFeeds.length} pending raw feeds`);

  let jobsCreated = 0;
  let jobsSkipped = 0;

  for (const feed of pendingFeeds) {
    // Check if content_process job already exists for this feed
    const { data: existingJobs } = await supabase
      .from('job_queue')
      .select('id, status')
      .eq('job_type', 'content_process')
      .contains('payload', { 
        sourceId: feed.source_id, 
        externalId: feed.external_id 
      });

    if (existingJobs && existingJobs.length > 0) {
      console.log(`  ✅ Job already exists for feed ${feed.id.substring(0, 8)}... (${feed.title?.substring(0, 50)}...)`);
      jobsSkipped++;
      continue;
    }

    // Create content_process job
    console.log(`  🔧 Creating content_process job for feed ${feed.id.substring(0, 8)}... (${feed.title?.substring(0, 50)}...)`);
    
    try {
      await queueService.enqueue(JobType.CONTENT_PROCESS, {
        sourceId: feed.source_id,
        externalId: feed.external_id,
        rawFeedId: feed.id  // Include raw feed ID for direct processing
      }, { priority: 3 });
      
      jobsCreated++;
    } catch (error) {
      console.error(`  ❌ Failed to create job for feed ${feed.id}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  - Jobs created: ${jobsCreated}`);
  console.log(`  - Jobs skipped (already exist): ${jobsSkipped}`);
  console.log(`  - Total pending feeds processed: ${pendingFeeds.length}`);

  // Also check for any raw feeds that need daily analysis
  console.log('\n🔍 Checking for today\'s daily analysis...');
  
  const today = new Date().toISOString().split('T')[0];
  const { data: todayAnalysis } = await supabase
    .from('daily_analysis')
    .select('id')
    .eq('analysis_date', today);

  if (!todayAnalysis || todayAnalysis.length === 0) {
    console.log('  📈 Creating daily analysis job for today...');
    await queueService.enqueue(JobType.DAILY_ANALYSIS, {
      date: today
    }, { priority: 1 });
    
    // Also create prediction generation job
    setTimeout(async () => {
      await queueService.enqueue(JobType.GENERATE_PREDICTIONS, {
        analysisDate: today
      }, { priority: 1 });
    }, 5000); // Wait 5 seconds
    
    console.log('  ✅ Created daily analysis and prediction jobs');
  } else {
    console.log('  ✅ Daily analysis already exists for today');
  }
}

fixMissingContentJobs().catch(console.error);