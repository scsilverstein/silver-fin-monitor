import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function stopFeedCreation() {
  console.log('Monitoring feed job creation...');
  
  // Get initial count
  const { count: initialCount } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('job_type', 'feed_fetch')
    .in('status', ['pending', 'processing', 'retry']);
  
  console.log(`Initial feed_fetch jobs: ${initialCount}`);
  
  // Monitor for new jobs every 5 seconds
  let lastCount = initialCount || 0;
  
  setInterval(async () => {
    const { count: currentCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('job_type', 'feed_fetch')
      .in('status', ['pending', 'processing', 'retry']);
    
    if (currentCount !== lastCount) {
      const diff = (currentCount || 0) - lastCount;
      console.log(`[${new Date().toISOString()}] Feed job count changed: ${lastCount} -> ${currentCount} (${diff > 0 ? '+' : ''}${diff})`);
      
      // If new jobs were added, check what created them
      if (diff > 0) {
        const { data: newJobs } = await supabase
          .from('job_queue')
          .select('id, created_at, payload')
          .eq('job_type', 'feed_fetch')
          .in('status', ['pending', 'processing', 'retry'])
          .order('created_at', { ascending: false })
          .limit(diff);
        
        console.log('New jobs created:');
        newJobs?.forEach(job => {
          console.log(`  - ${job.id} at ${job.created_at} for source ${job.payload.sourceId}`);
        });
      }
      
      lastCount = currentCount || 0;
    }
  }, 5000);
  
  console.log('Monitoring started. Press Ctrl+C to stop.');
}

stopFeedCreation().catch(console.error);