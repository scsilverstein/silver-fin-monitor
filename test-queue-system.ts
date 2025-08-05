#!/usr/bin/env tsx

import { queueController } from './src/controllers/queue.controller';
import { queueService } from './src/services/database/queue';
import { queueWorker } from './src/services/workers/queue-worker';
import { db } from './src/services/database/index';

async function testQueueSystem() {
  console.log('🧪 Testing Queue System Components...\n');

  try {
    // Test 1: Database Connection
    console.log('1️⃣ Connecting to database...');
    await db.connect();
    console.log('✅ Database connected successfully');
    
    // Test basic query
    console.log('2️⃣ Testing basic query...');
    const testQuery = await db.query('SELECT 1 as test');
    console.log('✅ Basic query working:', testQuery);

    // Test 3: Check job_queue table exists
    console.log('\n3️⃣ Checking job_queue table...');
    const tableCheck = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'job_queue'
      ORDER BY ordinal_position
    `);
    console.log('✅ job_queue table schema:', tableCheck);

    // Test 4: Queue Service - Enqueue a test job
    console.log('\n4️⃣ Testing queue service - enqueue...');
    const jobId = await queueService.enqueue('test_job', { test: 'data' }, 5, 0);
    console.log('✅ Job enqueued successfully:', jobId);

    // Test 5: Check if job was created
    console.log('\n5️⃣ Verifying job in database...');
    const job = await db.findById('job_queue', jobId);
    console.log('✅ Job found in database:', job);

    // Test 6: Queue Worker Status
    console.log('\n6️⃣ Testing queue worker status...');
    const workerStatus = queueWorker.getStatus();
    console.log('✅ Worker status:', workerStatus);

    // Test 7: Queue Stats
    console.log('\n7️⃣ Testing queue stats...');
    const stats = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM job_queue 
      GROUP BY status
    `);
    console.log('✅ Queue stats:', stats);

    // Test 8: Clean up test job
    console.log('\n8️⃣ Cleaning up test job...');
    await db.delete('job_queue', jobId);
    console.log('✅ Test job cleaned up');

    console.log('\n🎉 All queue system tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testQueueSystem();