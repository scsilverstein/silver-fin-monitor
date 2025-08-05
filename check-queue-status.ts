import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkQueue() {
  // Get job type distribution
  const { data: jobs } = await supabase
    .from('job_queue')
    .select('job_type, status')
    .in('status', ['pending', 'processing', 'retry']);
  
  const stats: Record<string, any> = {};
  jobs?.forEach(job => {
    const key = job.job_type;
    if (!stats[key]) stats[key] = { pending: 0, processing: 0, retry: 0, total: 0 };
    stats[key][job.status]++;
    stats[key].total++;
  });
  
  console.log('Current queue distribution:');
  Object.entries(stats).forEach(([type, counts]) => {
    console.log(`  ${type}: ${counts.total} total (${JSON.stringify(counts)})`);
  });
  
  // Check for recent feed_fetch jobs
  const { count: feedFetchCount } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('job_type', 'feed_fetch')
    .in('status', ['pending', 'processing', 'retry']);
    
  console.log(`\nFeed fetch jobs: ${feedFetchCount}`);
  
  // Check if new jobs are still being created
  const { data: recentJobs } = await supabase
    .from('job_queue')
    .select('id, created_at, job_type, payload')
    .eq('job_type', 'feed_fetch')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (recentJobs && recentJobs.length > 0) {
    console.log(`\nRecent feed_fetch jobs (last 5 minutes): ${recentJobs.length}`);
    recentJobs.forEach(job => {
      console.log(`  - ${job.id} at ${job.created_at} for source ${job.payload.sourceId}`);
    });
  } else {
    console.log('\nNo recent feed_fetch jobs in last 5 minutes - good!');
  }
}

checkQueue().catch(console.error);