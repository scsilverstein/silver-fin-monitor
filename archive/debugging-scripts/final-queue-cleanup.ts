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

async function finalCleanup() {
  console.log('🧹 Final Queue Cleanup...\n');
  
  try {
    // 1. Delete all test jobs
    console.log('1. Removing test jobs...');
    const testJobTypes = [
      'test_job', 
      'test_fail_job', 
      'test_atomic', 
      'test_retry',
      'queue_test',
      'verification_test',
      'worker_heartbeat'
    ];
    
    for (const jobType of testJobTypes) {
      const { error } = await supabase
        .from('job_queue')
        .delete()
        .eq('job_type', jobType);
      
      if (!error) {
        console.log(`  ✓ Removed ${jobType} jobs`);
      }
    }
    
    // 2. Reset stuck earnings_refresh jobs
    console.log('\n2. Resetting stuck earnings_refresh jobs...');
    const { data: earningsJobs } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'earnings_refresh')
      .eq('status', 'processing');
    
    if (earningsJobs && earningsJobs.length > 0) {
      console.log(`  Found ${earningsJobs.length} stuck earnings_refresh jobs`);
      for (const job of earningsJobs) {
        await supabase
          .from('job_queue')
          .update({
            status: 'failed',
            error_message: 'Earnings refresh timeout',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
      console.log('  ✓ Marked as failed');
    }
    
    // 3. Reset stuck generate_predictions jobs
    console.log('\n3. Checking generate_predictions jobs...');
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const { data: oldPredictionJobs } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'generate_predictions')
      .eq('status', 'processing')
      .lt('started_at', oneHourAgo.toISOString());
    
    if (oldPredictionJobs && oldPredictionJobs.length > 0) {
      console.log(`  Found ${oldPredictionJobs.length} old prediction jobs`);
      for (const job of oldPredictionJobs) {
        await supabase.rpc('fail_job', {
          job_id: job.id,
          error_msg: 'Prediction generation timeout'
        });
      }
      console.log('  ✓ Reset to retry');
    }
    
    // 4. Clean up old completed jobs
    console.log('\n4. Cleaning up old completed jobs...');
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { error: cleanupError } = await supabase
      .from('job_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', oneDayAgo.toISOString());
    
    if (!cleanupError) {
      console.log('  ✓ Removed old completed jobs');
    }
    
    // 5. Final statistics
    console.log('\n5. Final Queue State:');
    const { data: stats } = await supabase.rpc('get_queue_stats');
    
    if (stats) {
      const total = stats.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
      console.log(`  Total Jobs: ${total}`);
      stats.forEach((stat: any) => {
        console.log(`  - ${stat.status}: ${stat.count}`);
      });
    }
    
    // 6. Active job types
    console.log('\n6. Active Job Types:');
    const { data: activeJobs } = await supabase
      .from('job_queue')
      .select('job_type')
      .in('status', ['pending', 'processing', 'retry']);
    
    if (activeJobs) {
      const jobTypes = activeJobs.reduce((acc: any, job) => {
        acc[job.job_type] = (acc[job.job_type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(jobTypes).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
    }
    
    console.log('\n✅ Queue cleanup complete!');
    console.log('\n📋 Next Steps:');
    console.log('  1. The queue worker is already running with 2 workers');
    console.log('  2. Monitor at: http://localhost:8888/queue');
    console.log('  3. Only real jobs (feed_fetch, daily_analysis, etc.) remain');
    
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Run cleanup
finalCleanup().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});