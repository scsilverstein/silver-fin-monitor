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

async function monitorQueue() {
  console.clear();
  console.log('📊 Silver Fin Monitor - Queue System Monitor');
  console.log('=' .repeat(60));
  console.log(new Date().toLocaleString());
  console.log('=' .repeat(60));
  
  // 1. Queue Statistics
  const { data: stats } = await supabase.rpc('get_queue_stats');
  console.log('\n📈 Queue Statistics:');
  if (stats) {
    const total = stats.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
    console.log(`Total Jobs: ${total}`);
    stats.forEach((stat: any) => {
      const percentage = total > 0 ? ((stat.count / total) * 100).toFixed(1) : '0';
      console.log(`  ${stat.status}: ${stat.count} (${percentage}%)`);
    });
  }
  
  // 2. Jobs in Processing
  console.log('\n⚙️  Jobs Currently Processing:');
  const { data: processingJobs } = await supabase
    .from('job_queue')
    .select('id, job_type, started_at, attempts')
    .eq('status', 'processing')
    .order('started_at', { ascending: true })
    .limit(10);
  
  if (processingJobs && processingJobs.length > 0) {
    processingJobs.forEach((job: any) => {
      const duration = Date.now() - new Date(job.started_at).getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      console.log(`  - ${job.job_type} (${job.id.substring(0, 8)}...)`);
      console.log(`    Running for: ${minutes}m ${seconds}s | Attempts: ${job.attempts}`);
    });
    
    if (processingJobs.length > 10) {
      console.log(`  ... and ${processingJobs.length - 10} more`);
    }
  } else {
    console.log('  No jobs currently processing');
  }
  
  // 3. Stuck Jobs Alert
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
  
  const { data: stuckJobs } = await supabase
    .from('job_queue')
    .select('count')
    .eq('status', 'processing')
    .lt('started_at', fiveMinutesAgo.toISOString());
  
  if (stuckJobs && stuckJobs[0]?.count > 0) {
    console.log(`\n⚠️  ALERT: ${stuckJobs[0].count} jobs stuck for > 5 minutes!`);
  }
  
  // 4. Recent Activity
  console.log('\n📝 Recent Activity (last 5 minutes):');
  const fiveMinAgo = new Date();
  fiveMinAgo.setMinutes(fiveMinAgo.getMinutes() - 5);
  
  const { data: recentCompleted } = await supabase
    .from('job_queue')
    .select('job_type')
    .eq('status', 'completed')
    .gt('completed_at', fiveMinAgo.toISOString());
  
  const { data: recentFailed } = await supabase
    .from('job_queue')
    .select('job_type, error_message')
    .eq('status', 'failed')
    .gt('completed_at', fiveMinAgo.toISOString())
    .limit(5);
  
  console.log(`  Completed: ${recentCompleted?.length || 0} jobs`);
  if (recentCompleted && recentCompleted.length > 0) {
    const typeCounts = recentCompleted.reduce((acc: any, job) => {
      acc[job.job_type] = (acc[job.job_type] || 0) + 1;
      return acc;
    }, {});
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count}`);
    });
  }
  
  console.log(`  Failed: ${recentFailed?.length || 0} jobs`);
  if (recentFailed && recentFailed.length > 0) {
    recentFailed.forEach((job: any) => {
      console.log(`    - ${job.job_type}: ${job.error_message?.substring(0, 50)}...`);
    });
  }
  
  // 5. Performance Metrics
  console.log('\n⚡ Performance:');
  const start = Date.now();
  await supabase.rpc('get_queue_stats');
  const queryTime = Date.now() - start;
  console.log(`  Database response time: ${queryTime}ms`);
  
  // 6. Recommendations
  const processing = stats?.find((s: any) => s.status === 'processing')?.count || 0;
  const retry = stats?.find((s: any) => s.status === 'retry')?.count || 0;
  
  if (processing > 20 || retry > 20) {
    console.log('\n💡 Recommendations:');
    if (processing > 20) {
      console.log('  - High number of processing jobs. Consider checking worker health.');
    }
    if (retry > 20) {
      console.log('  - High number of retry jobs. Check for systematic failures.');
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('Press Ctrl+C to exit. Refreshing in 10 seconds...');
}

// Run monitor
async function startMonitor() {
  await monitorQueue();
  
  // Refresh every 10 seconds
  setInterval(monitorQueue, 10000);
  
  // Handle exit
  process.on('SIGINT', () => {
    console.log('\n\nMonitor stopped.');
    process.exit(0);
  });
}

startMonitor().catch(error => {
  console.error('Monitor error:', error);
  process.exit(1);
});