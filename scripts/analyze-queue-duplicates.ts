import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyzeDuplicateJobs() {
  try {
    console.log('Analyzing duplicate jobs in queue...\n');

    // Get total pending/processing jobs
    const { count: totalJobs } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing', 'retry']);
    
    console.log(`Total pending/processing jobs: ${totalJobs || 0}`);

    // Get feed_fetch duplicates
    const { data: feedFetchJobs } = await supabase
      .from('job_queue')
      .select('id, payload, status, created_at')
      .eq('job_type', 'feed_fetch')
      .in('status', ['pending', 'processing', 'retry'])
      .order('created_at', { ascending: true });

    if (feedFetchJobs && feedFetchJobs.length > 0) {
      // Group by sourceId
      const sourceGroups = new Map<string, any[]>();
      
      feedFetchJobs.forEach(job => {
        const sourceId = job.payload?.sourceId;
        if (sourceId) {
          if (!sourceGroups.has(sourceId)) {
            sourceGroups.set(sourceId, []);
          }
          sourceGroups.get(sourceId)!.push(job);
        }
      });

      console.log(`\nFeed Fetch Analysis:`);
      console.log(`- Total feed_fetch jobs: ${feedFetchJobs.length}`);
      console.log(`- Unique sources: ${sourceGroups.size}`);
      console.log(`- Duplicate jobs: ${feedFetchJobs.length - sourceGroups.size}`);

      // Show top duplicates
      console.log('\nTop sources with duplicates:');
      const sortedSources = Array.from(sourceGroups.entries())
        .filter(([_, jobs]) => jobs.length > 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

      sortedSources.forEach(([sourceId, jobs]) => {
        console.log(`\nSource: ${sourceId}`);
        console.log(`  Count: ${jobs.length}`);
        console.log(`  Oldest: ${new Date(jobs[0].created_at).toLocaleString()}`);
        console.log(`  Newest: ${new Date(jobs[jobs.length - 1].created_at).toLocaleString()}`);
        console.log(`  Status distribution:`, jobs.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
      });
    }

    // Check other job types
    const jobTypes = ['content_process', 'daily_analysis', 'generate_predictions', 'prediction_compare'];
    
    for (const jobType of jobTypes) {
      const { count } = await supabase
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('job_type', jobType)
        .in('status', ['pending', 'processing', 'retry']);
      
      if (count && count > 0) {
        console.log(`\n${jobType}: ${count} jobs`);
      }
    }

    // Get stuck jobs
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stuckJobs } = await supabase
      .from('job_queue')
      .select('job_type, status, created_at')
      .in('status', ['processing', 'retry'])
      .lt('created_at', oneHourAgo)
      .order('created_at', { ascending: true })
      .limit(10);

    if (stuckJobs && stuckJobs.length > 0) {
      console.log('\n\nPotentially stuck jobs (older than 1 hour):');
      stuckJobs.forEach(job => {
        console.log(`- ${job.job_type} (${job.status}) - created ${new Date(job.created_at).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

// Run the analysis
analyzeDuplicateJobs()
  .then(() => {
    console.log('\nAnalysis completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });