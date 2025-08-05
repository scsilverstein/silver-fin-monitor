import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: any;
}

async function runDiagnostics() {
  console.log('🔍 Running Queue System Diagnostics...\n');
  console.log('='.repeat(50));
  
  const results: DiagnosticResult[] = [];
  
  // 1. Check for stuck jobs
  console.log('\n1. Checking for stuck jobs...');
  const stuckJobsResult = await checkStuckJobs();
  results.push(stuckJobsResult);
  
  // 2. Test atomic dequeue function
  console.log('\n2. Testing atomic dequeue function...');
  const atomicTestResult = await testAtomicDequeue();
  results.push(atomicTestResult);
  
  // 3. Check job distribution
  console.log('\n3. Checking job distribution...');
  const distributionResult = await checkJobDistribution();
  results.push(distributionResult);
  
  // 4. Test retry mechanism
  console.log('\n4. Testing retry mechanism...');
  const retryResult = await testRetryMechanism();
  results.push(retryResult);
  
  // 5. Check feed processing pipeline
  console.log('\n5. Checking feed processing pipeline...');
  const pipelineResult = await checkFeedPipeline();
  results.push(pipelineResult);
  
  // 6. Performance check
  console.log('\n6. Running performance check...');
  const performanceResult = await checkPerformance();
  results.push(performanceResult);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 DIAGNOSTIC SUMMARY:');
  console.log('='.repeat(50));
  
  let allPassed = true;
  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} Test ${index + 1}: ${result.message}`);
    if (!result.passed) {
      allPassed = false;
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
  });
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 All diagnostics passed! Queue system is healthy.');
  } else {
    console.log('⚠️  Some diagnostics failed. Please review the details above.');
  }
  
  return allPassed;
}

async function checkStuckJobs(): Promise<DiagnosticResult> {
  try {
    // Jobs stuck in processing for more than 5 minutes
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const { data: stuckJobs, error } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo.toISOString());
    
    if (error) throw error;
    
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`Found ${stuckJobs.length} stuck jobs:`);
      stuckJobs.forEach(job => {
        const duration = Date.now() - new Date(job.started_at).getTime();
        console.log(`  - Job ${job.id}: ${job.job_type} (stuck for ${Math.round(duration / 1000 / 60)} minutes)`);
      });
      
      // Reset stuck jobs
      console.log('  Resetting stuck jobs...');
      for (const job of stuckJobs) {
        await supabase.rpc('fail_job', { 
          job_id: job.id, 
          error_msg: 'Job was stuck in processing for too long' 
        });
      }
      
      return {
        passed: false,
        message: `Found and reset ${stuckJobs.length} stuck jobs`,
        details: { count: stuckJobs.length }
      };
    }
    
    return { passed: true, message: 'No stuck jobs found' };
  } catch (error) {
    return { 
      passed: false, 
      message: 'Failed to check stuck jobs',
      details: error
    };
  }
}

async function testAtomicDequeue(): Promise<DiagnosticResult> {
  try {
    // Create test jobs
    const testJobs = [];
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase.rpc('enqueue_job', {
        job_type: 'test_atomic',
        payload: { test: true, index: i },
        priority: 1,
        delay_seconds: 0
      });
      if (error) throw error;
      testJobs.push(data);
    }
    
    console.log(`  Created ${testJobs.length} test jobs`);
    
    // Simulate concurrent dequeue
    const dequeuePromises = [];
    for (let i = 0; i < 10; i++) {
      dequeuePromises.push(supabase.rpc('dequeue_job'));
    }
    
    const results = await Promise.all(dequeuePromises);
    const successfulDequeues = results.filter(r => r.data && r.data.length > 0);
    
    console.log(`  ${successfulDequeues.length} successful dequeues out of 10 attempts`);
    
    // Clean up test jobs
    for (const result of successfulDequeues) {
      if (result.data && result.data[0]) {
        await supabase.rpc('complete_job', { job_id: result.data[0].job_id });
      }
    }
    
    // Delete any remaining test jobs
    await supabase
      .from('job_queue')
      .delete()
      .eq('job_type', 'test_atomic');
    
    const passed = successfulDequeues.length === 5;
    return {
      passed,
      message: passed ? 'Atomic dequeue working correctly' : 'Atomic dequeue issue detected',
      details: { expected: 5, actual: successfulDequeues.length }
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Failed to test atomic dequeue',
      details: error
    };
  }
}

async function checkJobDistribution(): Promise<DiagnosticResult> {
  try {
    const { data: stats, error } = await supabase
      .from('job_queue')
      .select('status, job_type')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    const distribution = stats?.reduce((acc: any, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('  Job status distribution:', distribution);
    
    const processingRatio = (distribution?.processing || 0) / (stats?.length || 1);
    
    if (processingRatio > 0.5) {
      return {
        passed: false,
        message: 'Too many jobs in processing state',
        details: { processingRatio, distribution }
      };
    }
    
    return {
      passed: true,
      message: 'Job distribution looks healthy',
      details: distribution
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Failed to check job distribution',
      details: error
    };
  }
}

async function testRetryMechanism(): Promise<DiagnosticResult> {
  try {
    // Create a job that will fail
    const { data: jobId, error: enqueueError } = await supabase.rpc('enqueue_job', {
      job_type: 'test_retry',
      payload: { shouldFail: true },
      priority: 1,
      delay_seconds: 0
    });
    
    if (enqueueError) throw enqueueError;
    
    console.log('  Created test job for retry:', jobId);
    
    // Dequeue and fail it
    const { data: job, error: dequeueError } = await supabase.rpc('dequeue_job');
    if (dequeueError || !job || job.length === 0) {
      throw new Error('Failed to dequeue test job');
    }
    
    // Fail the job
    await supabase.rpc('fail_job', { 
      job_id: job[0].job_id, 
      error_msg: 'Test failure' 
    });
    
    // Check if it's in retry status
    const { data: retryJob, error: checkError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('id', job[0].job_id)
      .single();
    
    if (checkError) throw checkError;
    
    const isRetrying = retryJob.status === 'retry' && retryJob.attempts < retryJob.max_attempts;
    
    // Clean up
    await supabase
      .from('job_queue')
      .delete()
      .eq('id', job[0].job_id);
    
    return {
      passed: isRetrying,
      message: isRetrying ? 'Retry mechanism working correctly' : 'Retry mechanism not working',
      details: { status: retryJob.status, attempts: retryJob.attempts }
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Failed to test retry mechanism',
      details: error
    };
  }
}

async function checkFeedPipeline(): Promise<DiagnosticResult> {
  try {
    // Check if raw feeds are being created
    const { data: recentFeeds, error: feedError } = await supabase
      .from('raw_feeds')
      .select('id, source_id, processing_status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (feedError) throw feedError;
    
    // Check if content is being processed
    const { data: recentContent, error: contentError } = await supabase
      .from('processed_content')
      .select('id, raw_feed_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (contentError) throw contentError;
    
    const feedsCreatedToday = recentFeeds?.filter(f => {
      const created = new Date(f.created_at);
      const today = new Date();
      return created.toDateString() === today.toDateString();
    }).length || 0;
    
    const contentProcessedToday = recentContent?.filter(c => {
      const created = new Date(c.created_at);
      const today = new Date();
      return created.toDateString() === today.toDateString();
    }).length || 0;
    
    console.log(`  Feeds created today: ${feedsCreatedToday}`);
    console.log(`  Content processed today: ${contentProcessedToday}`);
    
    const pipelineWorking = feedsCreatedToday > 0 || contentProcessedToday > 0;
    
    return {
      passed: pipelineWorking,
      message: pipelineWorking ? 'Feed pipeline is active' : 'Feed pipeline appears inactive',
      details: { feedsCreatedToday, contentProcessedToday }
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Failed to check feed pipeline',
      details: error
    };
  }
}

async function checkPerformance(): Promise<DiagnosticResult> {
  try {
    const startTime = Date.now();
    
    // Test dequeue performance
    const dequeuePromises = [];
    for (let i = 0; i < 10; i++) {
      dequeuePromises.push(supabase.rpc('dequeue_job'));
    }
    
    await Promise.all(dequeuePromises);
    const dequeueTime = Date.now() - startTime;
    
    console.log(`  Dequeue performance: ${dequeueTime}ms for 10 operations`);
    console.log(`  Average: ${Math.round(dequeueTime / 10)}ms per dequeue`);
    
    const avgTime = dequeueTime / 10;
    const performanceGood = avgTime < 100; // Should be under 100ms per dequeue
    
    return {
      passed: performanceGood,
      message: performanceGood ? 'Performance is good' : 'Performance needs optimization',
      details: { totalTime: dequeueTime, avgTime }
    };
  } catch (error) {
    return {
      passed: false,
      message: 'Failed to check performance',
      details: error
    };
  }
}

// Run diagnostics
runDiagnostics().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});