import { QueueService } from '../src/services/queue/queue.service';
import { DatabaseService } from '../src/services/database/db.service';
import { logger } from '../src/utils/logger';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

async function testDequeue() {
  const dbService = new DatabaseService(
    { 
      url: process.env.SUPABASE_URL as string,
      anonKey: process.env.SUPABASE_ANON_KEY as string,
      serviceKey: process.env.SUPABASE_SERVICE_KEY as string
    },
    logger as winston.Logger
  );

  const queueService = new QueueService(dbService, logger as winston.Logger);

  console.log('Testing dequeue function...');
  
  // Test dequeue function
  const job = await queueService.dequeue();
  
  if (job) {
    console.log(`✅ Dequeued job: ${job.job_id} (type: ${job.job_type})`);
    console.log('Job payload:', job.payload);
    console.log('Job attempts:', job.attempts);
    console.log('Job priority:', job.priority);
    
    // Put it back by failing it so it doesn't get lost
    console.log('Putting job back by marking as retry...');
    await queueService.fail(job.job_id, 'Test - putting job back');
  } else {
    console.log('No jobs available in queue');
  }
}

testDequeue().catch(console.error);