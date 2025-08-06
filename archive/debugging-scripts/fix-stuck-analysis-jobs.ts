import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function fixStuckAnalysisJobs() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🔧 Fixing stuck generate_predictions jobs...');
  
  // Reset stuck processing jobs to failed (they've been processing for hours)
  const { data: updatedJobs, error } = await supabase
    .from('job_queue')
    .update({ 
      status: 'failed',
      error_message: 'Job stuck in processing status - reset by admin',
      completed_at: new Date().toISOString()
    })
    .eq('job_type', 'generate_predictions')
    .eq('status', 'processing')
    .select('id');

  if (error) {
    console.error('Error updating jobs:', error);
    return;
  }

  console.log(`✅ Reset ${updatedJobs?.length || 0} stuck generate_predictions jobs to failed`);

  // Check for today's daily analysis
  const today = new Date().toISOString().split('T')[0];
  const { data: todayAnalysis } = await supabase
    .from('daily_analysis')
    .select('id')
    .eq('analysis_date', today);

  console.log(`📅 Today (${today}) daily analysis exists: ${todayAnalysis && todayAnalysis.length > 0 ? 'YES' : 'NO'}`);

  // Create daily analysis job for today if it doesn't exist
  if (!todayAnalysis || todayAnalysis.length === 0) {
    console.log('📈 Creating daily_analysis job for today...');
    
    const { data: newJob, error: jobError } = await supabase.rpc('enqueue_job', {
      job_type: 'daily_analysis',
      payload: JSON.stringify({ date: today }),
      priority: 1,
      delay_seconds: 0
    });

    if (jobError) {
      console.error('Error creating daily_analysis job:', jobError);
    } else {
      console.log(`✅ Created daily_analysis job: ${newJob}`);
    }
  }

  // Check if there are any pending daily_analysis jobs
  const { data: pendingAnalysisJobs } = await supabase
    .from('job_queue')
    .select('id, status, created_at')
    .eq('job_type', 'daily_analysis')
    .in('status', ['pending', 'retry']);

  console.log(`📊 Pending daily_analysis jobs: ${pendingAnalysisJobs?.length || 0}`);
  
  if (pendingAnalysisJobs && pendingAnalysisJobs.length > 0) {
    pendingAnalysisJobs.forEach(job => {
      console.log(`  - Job ${job.id.substring(0, 8)}... (status: ${job.status}, created: ${new Date(job.created_at).toLocaleString()})`);
    });
  }
}

fixStuckAnalysisJobs().catch(console.error);