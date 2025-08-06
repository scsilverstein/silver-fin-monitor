import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAnalysisJobs() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('📊 Checking recent analysis jobs...');
  
  const { data: recentJobs } = await supabase
    .from('job_queue')
    .select('id, job_type, status, priority, created_at')
    .in('job_type', ['daily_analysis', 'generate_predictions'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Found ${recentJobs?.length || 0} recent analysis jobs:`);
  recentJobs?.forEach(job => {
    const timeAgo = Math.round((Date.now() - new Date(job.created_at).getTime()) / 1000);
    console.log(`  - ${job.job_type} (priority: ${job.priority}, status: ${job.status}) - ${timeAgo}s ago`);
  });

  // Check pending jobs by type
  const { data: allJobs } = await supabase
    .from('job_queue')
    .select('job_type, status')
    .eq('status', 'pending');

  const counts: Record<string, number> = {};
  allJobs?.forEach(job => {
    counts[job.job_type] = (counts[job.job_type] || 0) + 1;
  });

  console.log('\n📈 Pending jobs by type:');
  Object.entries(counts).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  // Check if any jobs are in processing status for too long
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stuckJobs } = await supabase
    .from('job_queue')
    .select('id, job_type, status, started_at')
    .eq('status', 'processing')
    .lt('started_at', oneHourAgo);

  if (stuckJobs && stuckJobs.length > 0) {
    console.log('\n⚠️  Jobs stuck in processing (>1 hour):');
    stuckJobs.forEach(job => {
      console.log(`  - ${job.job_type} (${job.id.substring(0, 8)}...) started: ${job.started_at}`);
    });
  } else {
    console.log('\n✅ No jobs stuck in processing status');
  }
}

checkAnalysisJobs().catch(console.error);