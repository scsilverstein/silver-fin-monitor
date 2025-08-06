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

async function checkJobStatus() {
  try {
    console.log('Checking job status...\n');
    
    // Check if the specific job was processed
    const jobIds = [
      '0ce31a4a-8d01-4012-aac2-04955fc62010', // Invalid sourceId job
      'b2468d40-af95-4252-a2d7-5b8d5e3ffd99'  // Valid IMF feed job
    ];
    
    for (const jobId of jobIds) {
      console.log(`\nChecking job: ${jobId}`);
      
      const { data: job, error } = await supabase
        .from('job_queue')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        console.log('✓ Job not found (may have been deleted or completed)');
      } else if (error) {
        console.error('Error fetching job:', error);
      } else if (job) {
        console.log(`Status: ${job.status}`);
        console.log(`Type: ${job.job_type}`);
        console.log(`Payload: ${JSON.stringify(job.payload)}`);
        console.log(`Attempts: ${job.attempts}/${job.max_attempts}`);
        if (job.error_message) {
          console.log(`Last error: ${job.error_message}`);
        }
        if (job.completed_at) {
          console.log(`Completed at: ${job.completed_at}`);
        }
      }
    }
    
    // Check recent completed feed_fetch jobs
    console.log('\n\nRecent completed feed_fetch jobs:');
    const { data: completedJobs, error: completedError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'completed')
      .eq('job_type', 'feed_fetch')
      .order('completed_at', { ascending: false })
      .limit(5);
    
    if (completedError) {
      console.error('Error fetching completed jobs:', completedError);
    } else if (completedJobs && completedJobs.length > 0) {
      completedJobs.forEach((job: any) => {
        console.log(`\n- Job ${job.id}`);
        console.log(`  Payload: ${JSON.stringify(job.payload)}`);
        console.log(`  Completed at: ${job.completed_at}`);
      });
    } else {
      console.log('No recently completed feed_fetch jobs found');
    }
    
    // Check if feeds were updated
    console.log('\n\nRecently updated feeds:');
    const { data: recentFeeds, error: feedError } = await supabase
      .from('feed_sources')
      .select('id, name, last_processed_at')
      .not('last_processed_at', 'is', null)
      .order('last_processed_at', { ascending: false })
      .limit(5);
    
    if (feedError) {
      console.error('Error fetching feeds:', feedError);
    } else if (recentFeeds && recentFeeds.length > 0) {
      recentFeeds.forEach((feed: any) => {
        console.log(`- ${feed.name}: ${feed.last_processed_at}`);
      });
    } else {
      console.log('No recently processed feeds found');
    }
    
    // Final queue stats
    console.log('\n\nCurrent Queue Statistics:');
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
    console.error('Error checking job status:', error);
  }
}

// Run the check
checkJobStatus().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});