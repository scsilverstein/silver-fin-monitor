import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.queue') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyQueueSystem() {
  console.log('🔍 Verifying Queue System Configuration...\n');
  
  const issues: string[] = [];
  
  // 1. Check database functions
  console.log('1. Testing database queue functions...');
  try {
    // Test enqueue
    const { data: jobId, error: enqueueError } = await supabase.rpc('enqueue_job', {
      job_type: 'verification_test',
      payload: { test: true },
      priority: 1,
      delay_seconds: 0
    });
    
    if (enqueueError) {
      issues.push('❌ enqueue_job function not working: ' + enqueueError.message);
    } else {
      console.log('  ✓ enqueue_job working');
      
      // Test dequeue
      const { data: job, error: dequeueError } = await supabase.rpc('dequeue_job');
      if (dequeueError) {
        issues.push('❌ dequeue_job function not working: ' + dequeueError.message);
      } else if (job && job.length > 0) {
        console.log('  ✓ dequeue_job working');
        
        // Test complete
        const { error: completeError } = await supabase.rpc('complete_job', {
          job_id: job[0].job_id
        });
        if (completeError) {
          issues.push('❌ complete_job function not working: ' + completeError.message);
        } else {
          console.log('  ✓ complete_job working');
        }
      }
    }
  } catch (error) {
    issues.push('❌ Database function test failed: ' + error);
  }
  
  // 2. Check for stuck jobs
  console.log('\n2. Checking for stuck jobs...');
  const threeMinutesAgo = new Date();
  threeMinutesAgo.setMinutes(threeMinutesAgo.getMinutes() - 3);
  
  const { data: stuckJobs, error: stuckError } = await supabase
    .from('job_queue')
    .select('id, job_type, started_at, attempts')
    .eq('status', 'processing')
    .lt('started_at', threeMinutesAgo.toISOString());
  
  if (stuckError) {
    issues.push('❌ Cannot check stuck jobs: ' + stuckError.message);
  } else if (stuckJobs && stuckJobs.length > 0) {
    console.log(`  ⚠️  Found ${stuckJobs.length} stuck jobs - will reset them`);
    
    // Reset stuck jobs
    for (const job of stuckJobs) {
      if (job.attempts >= 3) {
        await supabase
          .from('job_queue')
          .update({ 
            status: 'failed', 
            error_message: 'Max attempts exceeded',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      } else {
        await supabase.rpc('fail_job', {
          job_id: job.id,
          error_msg: 'Job was stuck - resetting'
        });
      }
    }
    console.log('  ✓ Stuck jobs reset');
  } else {
    console.log('  ✓ No stuck jobs found');
  }
  
  // 3. Check queue configuration
  console.log('\n3. Checking queue configuration...');
  const concurrency = process.env.JOB_CONCURRENCY || '3';
  console.log(`  Concurrency: ${concurrency} workers`);
  
  if (parseInt(concurrency) > 3) {
    issues.push('⚠️  High concurrency may cause race conditions');
  }
  
  // 4. Database performance check
  console.log('\n4. Testing database performance...');
  const perfStart = Date.now();
  const perfPromises = [];
  for (let i = 0; i < 5; i++) {
    perfPromises.push(supabase.rpc('get_queue_stats'));
  }
  await Promise.all(perfPromises);
  const perfTime = Date.now() - perfStart;
  console.log(`  Query performance: ${perfTime}ms for 5 operations (${Math.round(perfTime/5)}ms avg)`);
  
  if (perfTime > 500) {
    issues.push('⚠️  Database performance may be slow');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (issues.length === 0) {
    console.log('✅ All checks passed! Queue system is ready.');
    return true;
  } else {
    console.log('❌ Issues found:');
    issues.forEach(issue => console.log('  ' + issue));
    return false;
  }
}

async function startQueueWorker() {
  console.log('\n🚀 Starting Queue Worker...\n');
  
  // Start the worker with proper environment
  const worker = spawn('npx', ['tsx', 'scripts/run-queue-worker.ts'], {
    env: {
      ...process.env,
      JOB_CONCURRENCY: '2',
      NODE_ENV: 'production'
    },
    stdio: 'inherit'
  });
  
  worker.on('error', (error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });
  
  worker.on('exit', (code) => {
    console.log(`Worker exited with code ${code}`);
    process.exit(code || 0);
  });
  
  // Monitor queue health
  setInterval(async () => {
    try {
      const { data: stats } = await supabase.rpc('get_queue_stats');
      if (stats) {
        const processing = stats.find((s: any) => s.status === 'processing');
        if (processing && processing.count > 10) {
          console.warn('\n⚠️  High number of processing jobs:', processing.count);
        }
      }
    } catch (error) {
      console.error('Monitor error:', error);
    }
  }, 60000); // Every minute
  
  process.on('SIGINT', () => {
    console.log('\nStopping worker...');
    worker.kill('SIGTERM');
  });
}

// Main execution
async function main() {
  console.log('Silver Fin Monitor - Queue System Verification\n');
  console.log('='.repeat(50));
  
  const verified = await verifyQueueSystem();
  
  if (verified) {
    console.log('\nQueue system verified. Starting worker...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
    await startQueueWorker();
  } else {
    console.log('\n❌ Please fix the issues above before starting the worker.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});