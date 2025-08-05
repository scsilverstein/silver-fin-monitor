import { config } from 'dotenv';
import QueueService, { JobType } from './src/services/queue/queue.service';
import { DatabaseService } from './src/services/database/db.service';
import { logger } from './src/utils/logger';

config();

async function testDeduplication() {
  const db = new DatabaseService(
    { 
      url: process.env.SUPABASE_URL || '', 
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
    },
    logger
  );
  const queueService = new QueueService(db, logger);

  try {
    console.log('Testing queue deduplication with new QueueService...\n');

    // Test with a real source ID that exists
    const testSourceId = '22c8af93-581b-4f04-b7fe-90588156d955';
    
    console.log(`Test 1: Creating first job for source ${testSourceId}`);
    const job1 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: testSourceId
    }, { priority: 1 });
    console.log(`First job created: ${job1}`);
    
    console.log(`\nTest 2: Attempting to create duplicate job for same source`);
    const job2 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: testSourceId
    }, { priority: 1 });
    console.log(`Second attempt returned: ${job2}`);
    
    if (job1 === job2) {
      console.log('\n✅ SUCCESS: Deduplication is working! Same job ID returned.');
    } else {
      console.log('\n❌ FAILURE: Different job IDs returned. Deduplication not working.');
    }
    
    // Test 3: Test with different job type (should create new job)
    console.log(`\nTest 3: Creating job with different type`);
    const job3 = await queueService.enqueue(JobType.CONTENT_PROCESS, {
      sourceId: testSourceId,
      externalId: 'test-123'
    }, { priority: 1 });
    console.log(`Different job type created: ${job3}`);
    
    if (job3 !== job1) {
      console.log('✅ Different job type created successfully');
    }
    
    // Clean up test jobs
    console.log('\nCleaning up test jobs...');
    // Skip cleanup since job3 might be the same as job1
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDeduplication()
  .then(() => {
    console.log('\nDeduplication test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });