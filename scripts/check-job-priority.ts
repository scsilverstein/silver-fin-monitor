import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function checkJobPriority() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🔍 Checking job priority order...');
  
  const { data: jobs } = await supabase
    .from('job_queue')
    .select('id, job_type, priority, status, created_at, scheduled_at')
    .in('status', ['pending', 'retry'])
    .order('priority', { ascending: true })
    .order('scheduled_at', { ascending: true })
    .limit(15);

  console.log('Next 15 jobs in priority order (lower number = higher priority):');
  jobs?.forEach((job, index) => {
    const num = (index + 1).toString().padStart(2);
    console.log(`${num}. ${job.job_type.padEnd(18)} (priority: ${job.priority}, status: ${job.status})`);
  });

  // Check specifically for content_process jobs
  const { data: contentJobs } = await supabase
    .from('job_queue')
    .select('id, priority, status, created_at')
    .eq('job_type', 'content_process');

  console.log(`\n📊 Content process jobs: ${contentJobs?.length || 0}`);
  contentJobs?.forEach(job => {
    console.log(`  - ${job.id.substring(0, 8)}...: priority ${job.priority}, status ${job.status}`);
  });
}

checkJobPriority().catch(console.error);