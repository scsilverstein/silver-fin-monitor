import { config } from 'dotenv';
import { logger } from './src/utils/logger';
import QueueService, { JobType } from './src/services/queue/queue.service';
import { DatabaseService } from './src/services/database/db.service';
import { createClient } from '@supabase/supabase-js';

config();

async function testDeduplication() {
  const db = new DatabaseService();
  const queueService = new QueueService(db, logger);
  
  // Also create direct supabase client for verification
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    logger.info('Testing queue deduplication...');

    // Test 1: Create a test feed source ID
    const testSourceId = 'test-dedup-' + Date.now();
    
    logger.info(`\nTest 1: Testing feed_fetch deduplication with sourceId: ${testSourceId}`);
    
    // First enqueue
    const job1 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: testSourceId
    }, { priority: 1 });
    logger.info(`First job ID: ${job1}`);
    
    // Second enqueue (should return same ID)
    const job2 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: testSourceId
    }, { priority: 1 });
    logger.info(`Second job ID: ${job2}`);
    
    if (job1 === job2) {
      logger.info('✅ Deduplication working! Same job ID returned');
    } else {
      logger.error('❌ Deduplication FAILED! Different job IDs returned');
    }
    
    // Verify in database
    const { data: dbJobs } = await supabase
      .from('job_queue')
      .select('id, payload, status')
      .eq('job_type', 'feed_fetch')
      .eq('payload->sourceId', testSourceId);
    
    logger.info(`\nDatabase verification: Found ${dbJobs?.length || 0} jobs with sourceId ${testSourceId}`);
    if (dbJobs && dbJobs.length > 0) {
      dbJobs.forEach(job => {
        logger.info(`  Job ${job.id}: status=${job.status}`);
      });
    }
    
    // Test 2: Test with real source IDs that are getting duplicated
    logger.info('\n\nTest 2: Testing with a real source ID that has duplicates');
    const realSourceId = '22c8af93-581b-4f04-b7fe-90588156d955';
    
    // Count existing jobs
    const { count: beforeCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('job_type', 'feed_fetch')
      .eq('payload->sourceId', realSourceId)
      .in('status', ['pending', 'processing', 'retry']);
    
    logger.info(`Before: ${beforeCount} jobs for source ${realSourceId}`);
    
    // Try to enqueue
    const realJob = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: realSourceId
    }, { priority: 1 });
    logger.info(`Enqueued job: ${realJob}`);
    
    // Count after
    const { count: afterCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('job_type', 'feed_fetch')
      .eq('payload->sourceId', realSourceId)
      .in('status', ['pending', 'processing', 'retry']);
    
    logger.info(`After: ${afterCount} jobs for source ${realSourceId}`);
    
    if (afterCount === beforeCount) {
      logger.info('✅ No new job created - deduplication working!');
    } else {
      logger.error('❌ New job created - deduplication NOT working!');
    }
    
    // Clean up test job
    await supabase
      .from('job_queue')
      .delete()
      .eq('payload->sourceId', testSourceId);
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await db.close();
  }
}

// Run the test
testDeduplication()
  .then(() => {
    logger.info('\nDeduplication test completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });