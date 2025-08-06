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

async function fixStuckJobs() {
  try {
    console.log('Checking for stuck jobs...');
    
    // Find jobs that have been in 'processing' status for more than 10 minutes
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
    
    const { data: stuckJobs, error: fetchError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'processing')
      .lt('started_at', tenMinutesAgo.toISOString());
    
    if (fetchError) {
      console.error('Error fetching stuck jobs:', fetchError);
      return;
    }
    
    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('No stuck jobs found.');
      return;
    }
    
    console.log(`Found ${stuckJobs.length} stuck jobs:`);
    stuckJobs.forEach(job => {
      console.log(`- Job ${job.id}: ${job.job_type} (started at ${job.started_at})`);
    });
    
    // Reset stuck jobs back to 'pending' or 'retry' based on attempts
    for (const job of stuckJobs) {
      const newStatus = job.attempts >= job.max_attempts ? 'failed' : 'retry';
      const scheduledAt = new Date();
      scheduledAt.setMinutes(scheduledAt.getMinutes() + 1); // Retry in 1 minute
      
      const updateData: any = {
        status: newStatus,
        error_message: 'Job was stuck in processing state'
      };
      
      if (newStatus === 'retry') {
        updateData.scheduled_at = scheduledAt.toISOString();
      } else {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error: updateError } = await supabase
        .from('job_queue')
        .update(updateData)
        .eq('id', job.id);
      
      if (updateError) {
        console.error(`Failed to update job ${job.id}:`, updateError);
      } else {
        console.log(`Reset job ${job.id} to ${newStatus}`);
      }
    }
    
    // Also check queue statistics
    console.log('\nQueue Statistics:');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_queue_stats');
    
    if (statsError) {
      console.error('Error fetching queue stats:', statsError);
    } else if (stats) {
      stats.forEach((stat: any) => {
        console.log(`- ${stat.status}: ${stat.count} jobs`);
      });
    }
    
  } catch (error) {
    console.error('Error in fixStuckJobs:', error);
  }
}

// Run the fix
fixStuckJobs().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});