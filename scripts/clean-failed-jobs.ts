import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function cleanFailedJobs() {
  console.log('🧹 Removing all failed jobs...');
  
  // First, count failed jobs
  const { data: failedJobs, error: fetchError } = await supabase
    .from('job_queue')
    .select('id, job_type, attempts, error_message')
    .eq('status', 'failed');
    
  if (fetchError) {
    console.error('Error fetching failed jobs:', fetchError);
    return;
  }
  
  console.log(`Found ${failedJobs.length} failed jobs`);
  
  if (failedJobs.length === 0) {
    console.log('✅ No failed jobs to clean');
    return;
  }
  
  // Show breakdown by job type
  const breakdown = failedJobs.reduce((acc, job) => {
    acc[job.job_type] = (acc[job.job_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Failed jobs by type:', breakdown);
  
  // Delete all failed jobs
  const { error: deleteError } = await supabase
    .from('job_queue')
    .delete()
    .eq('status', 'failed');
    
  if (deleteError) {
    console.error('Error deleting failed jobs:', deleteError);
    return;
  }
  
  console.log(`✅ Removed ${failedJobs.length} failed jobs`);
  
  // Check final queue status
  const { data: allJobs } = await supabase
    .from('job_queue')
    .select('status');
    
  if (allJobs) {
    const stats = allJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('📊 Final queue status:', stats);
    console.log(`Total jobs remaining: ${allJobs.length}`);
  }
}

cleanFailedJobs().catch(console.error);