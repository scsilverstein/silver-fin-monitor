import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function cleanupDuplicateJobs() {
  try {
    console.log('Starting duplicate job cleanup...\n');

    // First, let's handle stuck jobs (older than 1 hour in processing/retry status)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    console.log('Step 1: Resetting stuck jobs...');
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('job_queue')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .in('status', ['processing', 'retry'])
      .lt('created_at', oneHourAgo)
      .select();

    if (stuckError) {
      console.error('Error resetting stuck jobs:', stuckError);
    } else {
      console.log(`Reset ${stuckJobs?.length || 0} stuck jobs to failed status`);
    }

    // Step 2: Clean up duplicate feed_fetch jobs
    console.log('\nStep 2: Cleaning up duplicate feed_fetch jobs...');
    
    // Get all pending feed_fetch jobs grouped by sourceId
    const { data: feedFetchJobs } = await supabase
      .from('job_queue')
      .select('id, payload, created_at')
      .eq('job_type', 'feed_fetch')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (feedFetchJobs && feedFetchJobs.length > 0) {
      // Group by sourceId and keep only the oldest job
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

      // Collect IDs of duplicate jobs to delete
      const jobsToDelete: string[] = [];
      
      sourceGroups.forEach((jobs, sourceId) => {
        if (jobs.length > 1) {
          // Keep the first (oldest) job, delete the rest
          const duplicates = jobs.slice(1);
          jobsToDelete.push(...duplicates.map(job => job.id));
        }
      });

      console.log(`Found ${jobsToDelete.length} duplicate feed_fetch jobs to delete`);

      if (jobsToDelete.length > 0) {
        // Delete in batches of 100
        const batchSize = 100;
        let deleted = 0;
        
        for (let i = 0; i < jobsToDelete.length; i += batchSize) {
          const batch = jobsToDelete.slice(i, i + batchSize);
          const { error } = await supabase
            .from('job_queue')
            .delete()
            .in('id', batch);
          
          if (error) {
            console.error(`Error deleting batch ${i / batchSize + 1}:`, error);
          } else {
            deleted += batch.length;
            console.log(`Deleted batch ${i / batchSize + 1} (${batch.length} jobs)`);
          }
        }
        
        console.log(`Total deleted: ${deleted} duplicate feed_fetch jobs`);
      }
    }

    // Step 3: Clean up other duplicate job types
    const jobTypes = ['content_process', 'daily_analysis', 'generate_predictions', 'prediction_compare'];
    
    for (const jobType of jobTypes) {
      console.log(`\nChecking ${jobType} for duplicates...`);
      
      const { data: jobs } = await supabase
        .from('job_queue')
        .select('id, payload, created_at')
        .eq('job_type', jobType)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (jobs && jobs.length > 0) {
        const uniqueKeys = new Map<string, any[]>();
        
        // Group by unique key based on job type
        jobs.forEach(job => {
          let key = '';
          
          switch (jobType) {
            case 'content_process':
              key = job.payload?.contentId || job.payload?.rawFeedId || 
                    `${job.payload?.sourceId}-${job.payload?.externalId}`;
              break;
            case 'daily_analysis':
              key = job.payload?.date || '';
              break;
            case 'generate_predictions':
              key = job.payload?.analysisDate || job.payload?.date || job.payload?.analysisId || '';
              break;
            case 'prediction_compare':
              key = job.payload?.predictionId || '';
              break;
          }
          
          if (key) {
            if (!uniqueKeys.has(key)) {
              uniqueKeys.set(key, []);
            }
            uniqueKeys.get(key)!.push(job);
          }
        });

        // Delete duplicates
        const toDelete: string[] = [];
        uniqueKeys.forEach((jobGroup) => {
          if (jobGroup.length > 1) {
            toDelete.push(...jobGroup.slice(1).map(j => j.id));
          }
        });

        if (toDelete.length > 0) {
          const { error } = await supabase
            .from('job_queue')
            .delete()
            .in('id', toDelete);
          
          if (error) {
            console.error(`Error deleting ${jobType} duplicates:`, error);
          } else {
            console.log(`Deleted ${toDelete.length} duplicate ${jobType} jobs`);
          }
        } else {
          console.log(`No duplicates found for ${jobType}`);
        }
      }
    }

    // Step 4: Clean up old completed/failed jobs (older than 7 days)
    console.log('\nStep 4: Cleaning up old completed/failed jobs...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: cleanupError } = await supabase
      .from('job_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', sevenDaysAgo);

    if (cleanupError) {
      console.error('Error cleaning up old jobs:', cleanupError);
    } else {
      console.log('Cleaned up old completed/failed jobs');
    }

    // Final count
    console.log('\nFinal job count:');
    const { count: finalCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing', 'retry']);
    
    console.log(`Remaining pending/processing jobs: ${finalCount || 0}`);

  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupDuplicateJobs()
  .then(() => {
    console.log('\nCleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });