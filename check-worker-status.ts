import { queueWorker } from './src/services/workers/queue-worker';
import dotenv from 'dotenv';

dotenv.config();

async function checkWorkerStatus() {
  try {
    console.log('🔍 Queue Worker Status Check\n');
    
    const status = queueWorker.getStatus();
    
    console.log('📊 Worker Information:');
    console.log(`  Running: ${status.isRunning ? '✅ Yes' : '❌ No'}`);
    console.log(`  Concurrency Level: ${status.concurrency}`);
    console.log(`  Worker Threads: ${status.workerCount}`);
    console.log(`  Active Jobs: ${status.activeJobs}`);
    
    if (status.activeJobIds.length > 0) {
      console.log('\n🔄 Active Job IDs:');
      status.activeJobIds.forEach((jobId, index) => {
        console.log(`  ${index + 1}. ${jobId}`);
      });
    }
    
    console.log('\n💡 Configuration:');
    console.log(`  JOB_CONCURRENCY: ${process.env.JOB_CONCURRENCY || 'default (3)'}`);
    
    if (status.concurrency > 1) {
      console.log('\n🎉 Concurrent processing is ENABLED');
      console.log(`   Up to ${status.concurrency} jobs can run simultaneously`);
    } else {
      console.log('\n⚠️  Sequential processing (concurrency = 1)');
    }
    
  } catch (error) {
    console.error('Error checking worker status:', error);
  }
}

checkWorkerStatus();