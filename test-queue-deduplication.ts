import { config } from 'dotenv';
import { logger } from './src/utils/logger';
import QueueService, { JobType } from './src/services/queue/queue.service';
import { DatabaseService } from './src/services/database/db.service';

config();

async function testQueueDeduplication() {
  const db = new DatabaseService();
  const queueService = new QueueService(db, logger);

  try {
    logger.info('Starting queue deduplication tests...');

    // Test 1: Feed fetch deduplication
    logger.info('\n=== Test 1: Feed fetch deduplication ===');
    const feedSourceId = 'test-feed-123';
    
    const job1 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: feedSourceId
    }, { priority: 1 });
    logger.info(`First feed fetch job: ${job1}`);
    
    const job2 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: feedSourceId
    }, { priority: 1 });
    logger.info(`Second feed fetch job: ${job2} (should be same as first)`);
    
    if (job1 === job2) {
      logger.info('✅ Feed fetch deduplication working correctly');
    } else {
      logger.error('❌ Feed fetch deduplication failed');
    }

    // Test 2: Content process deduplication with different payload formats
    logger.info('\n=== Test 2: Content process deduplication ===');
    
    // Test with contentId
    const contentId = 'test-content-456';
    const content1 = await queueService.enqueue(JobType.CONTENT_PROCESS, {
      contentId: contentId
    });
    const content2 = await queueService.enqueue(JobType.CONTENT_PROCESS, {
      contentId: contentId
    });
    
    if (content1 === content2) {
      logger.info('✅ Content process (contentId) deduplication working');
    } else {
      logger.error('❌ Content process (contentId) deduplication failed');
    }
    
    // Test with rawFeedId
    const rawFeedId = 'test-raw-789';
    const raw1 = await queueService.enqueue(JobType.CONTENT_PROCESS, {
      rawFeedId: rawFeedId
    });
    const raw2 = await queueService.enqueue(JobType.CONTENT_PROCESS, {
      rawFeedId: rawFeedId
    });
    
    if (raw1 === raw2) {
      logger.info('✅ Content process (rawFeedId) deduplication working');
    } else {
      logger.error('❌ Content process (rawFeedId) deduplication failed');
    }

    // Test 3: Daily analysis deduplication
    logger.info('\n=== Test 3: Daily analysis deduplication ===');
    const analysisDate = new Date().toISOString().split('T')[0];
    
    const analysis1 = await queueService.enqueue(JobType.DAILY_ANALYSIS, {
      date: analysisDate
    });
    const analysis2 = await queueService.enqueue(JobType.DAILY_ANALYSIS, {
      date: analysisDate
    });
    
    if (analysis1 === analysis2) {
      logger.info('✅ Daily analysis deduplication working');
    } else {
      logger.error('❌ Daily analysis deduplication failed');
    }

    // Test 4: Generate predictions deduplication
    logger.info('\n=== Test 4: Generate predictions deduplication ===');
    
    const pred1 = await queueService.enqueue(JobType.GENERATE_PREDICTIONS, {
      analysisDate: analysisDate
    });
    const pred2 = await queueService.enqueue(JobType.GENERATE_PREDICTIONS, {
      analysisDate: analysisDate
    });
    
    if (pred1 === pred2) {
      logger.info('✅ Generate predictions deduplication working');
    } else {
      logger.error('❌ Generate predictions deduplication failed');
    }

    // Test 5: Prediction compare deduplication
    logger.info('\n=== Test 5: Prediction compare deduplication ===');
    const predictionId = 'test-prediction-999';
    
    const compare1 = await queueService.enqueue(JobType.PREDICTION_COMPARE, {
      predictionId: predictionId
    });
    const compare2 = await queueService.enqueue(JobType.PREDICTION_COMPARE, {
      predictionId: predictionId
    });
    
    if (compare1 === compare2) {
      logger.info('✅ Prediction compare deduplication working');
    } else {
      logger.error('❌ Prediction compare deduplication failed');
    }

    // Test 6: Different payloads should create different jobs
    logger.info('\n=== Test 6: Different payloads should create different jobs ===');
    const diff1 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: 'feed-001'
    });
    const diff2 = await queueService.enqueue(JobType.FEED_FETCH, {
      sourceId: 'feed-002'
    });
    
    if (diff1 !== diff2) {
      logger.info('✅ Different payloads create different jobs');
    } else {
      logger.error('❌ Different payloads incorrectly deduplicated');
    }

    // Clean up test jobs
    logger.info('\n=== Cleaning up test jobs ===');
    await db.query(`
      DELETE FROM job_queue 
      WHERE payload::text LIKE '%test-%' 
      AND created_at > NOW() - INTERVAL '5 minutes'
    `);
    
    logger.info('✅ Test cleanup completed');
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await db.close();
  }
}

// Run the tests
testQueueDeduplication()
  .then(() => {
    logger.info('\nAll queue deduplication tests completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });