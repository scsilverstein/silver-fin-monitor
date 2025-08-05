import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConcurrency(workers: number) {
  console.log(`\n🧪 Testing with ${workers} workers...`);
  
  // Create test jobs
  const testJobs = [];
  const jobCount = workers * 5; // 5 jobs per worker
  
  console.log(`  Creating ${jobCount} test jobs...`);
  for (let i = 0; i < jobCount; i++) {
    const { data } = await supabase.rpc('enqueue_job', {
      job_type: 'queue_test',
      payload: { 
        test: true, 
        workerId: i,
        concurrencyTest: workers,
        timestamp: Date.now()
      },
      priority: 5,
      delay_seconds: 0
    });
    testJobs.push(data);
  }
  
  // Start timer
  const startTime = Date.now();
  
  // Simulate workers processing
  const workerPromises = [];
  for (let w = 0; w < workers; w++) {
    workerPromises.push(simulateWorker(w, workers));
  }
  
  // Wait for all workers to finish
  await Promise.all(workerPromises);
  
  const duration = Date.now() - startTime;
  
  // Get completion stats
  const { data: stats } = await supabase
    .from('job_queue')
    .select('status')
    .eq('job_type', 'queue_test')
    .gte('created_at', new Date(startTime).toISOString());
  
  const completed = stats?.filter(j => j.status === 'completed').length || 0;
  const failed = stats?.filter(j => j.status === 'failed').length || 0;
  
  console.log(`  ✓ Completed in ${(duration / 1000).toFixed(2)}s`);
  console.log(`  ✓ Jobs: ${completed} completed, ${failed} failed`);
  console.log(`  ✓ Throughput: ${(completed / (duration / 1000)).toFixed(2)} jobs/second`);
  
  // Cleanup
  await supabase
    .from('job_queue')
    .delete()
    .eq('job_type', 'queue_test');
  
  return {
    workers,
    duration,
    completed,
    failed,
    throughput: completed / (duration / 1000)
  };
}

async function simulateWorker(workerId: number, totalWorkers: number) {
  let jobsProcessed = 0;
  const maxJobs = Math.ceil(25 / totalWorkers); // Share the work
  
  while (jobsProcessed < maxJobs) {
    try {
      // Dequeue a job
      const { data: jobs } = await supabase.rpc('dequeue_job');
      
      if (!jobs || jobs.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      const job = jobs[0];
      if (job.job_type !== 'queue_test') {
        // Not our test job, skip
        continue;
      }
      
      // Simulate processing time (50-200ms)
      const processingTime = 50 + Math.random() * 150;
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Complete the job
      await supabase.rpc('complete_job', { job_id: job.job_id });
      jobsProcessed++;
      
    } catch (error) {
      console.error(`Worker ${workerId} error:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function runTests() {
  console.log('🚀 Queue Worker Concurrency Test\n');
  console.log('Testing different worker counts to find optimal performance...');
  
  const results = [];
  const workerCounts = [1, 2, 4, 6, 8, 10];
  
  for (const count of workerCounts) {
    const result = await testConcurrency(count);
    results.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Summary
  console.log('\n📊 Summary Results:');
  console.log('Workers | Duration | Throughput | Status');
  console.log('--------|----------|------------|-------');
  
  results.forEach(r => {
    const status = r.failed > 0 ? '⚠️ ' : '✅';
    console.log(
      `${r.workers.toString().padStart(7)} | ${r.duration.toString().padStart(8)}ms | ${r.throughput.toFixed(2).padStart(10)} j/s | ${status}`
    );
  });
  
  // Find optimal
  const optimal = results.reduce((best, current) => {
    if (current.failed === 0 && current.throughput > best.throughput) {
      return current;
    }
    return best;
  });
  
  console.log(`\n🏆 Optimal concurrency: ${optimal.workers} workers`);
  console.log(`   Best throughput: ${optimal.throughput.toFixed(2)} jobs/second`);
}

// Run tests
runTests().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});