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

async function processFeedJob() {
  try {
    console.log('Processing feed job...\n');
    
    // Get a feed source or use the one from the job
    const testSourceId = '0ce31a4a-8d01-4012-aac2-04955fc62010'; // The job's sourceId
    
    const { data: feedSource, error: sourceError } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('id', testSourceId)
      .single();
    
    if (sourceError || !feedSource) {
      console.error('Feed source not found:', sourceError);
      
      // Create a test feed source with a proper UUID
      console.log('Creating test feed source...');
      const { data: newSource, error: createError } = await supabase
        .from('feed_sources')
        .insert({
          name: 'TechCrunch RSS Feed',
          type: 'rss',
          url: 'https://feeds.feedburner.com/TechCrunch/',
          is_active: true,
          config: {
            categories: ['technology', 'news'],
            priority: 'medium',
            update_frequency: 'hourly'
          }
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create test feed source:', createError);
        return;
      }
      
      console.log('Created test feed source:', newSource.name);
    }
    
    // Process the retry job
    console.log('\nChecking for pending/retry jobs...');
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('*')
      .in('status', ['pending', 'retry'])
      .eq('job_type', 'feed_fetch')
      .order('priority', { ascending: true })
      .limit(5);
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return;
    }
    
    console.log(`Found ${jobs?.length || 0} feed_fetch jobs to process`);
    
    if (jobs && jobs.length > 0) {
      for (const job of jobs) {
        console.log(`\nProcessing job ${job.id}:`);
        console.log(`- Type: ${job.job_type}`);
        console.log(`- Payload: ${JSON.stringify(job.payload)}`);
        console.log(`- Attempts: ${job.attempts}/${job.max_attempts}`);
        
        // Dequeue and process the job
        const { data: dequeuedJob, error: dequeueError } = await supabase
          .rpc('dequeue_job');
        
        if (dequeueError) {
          console.error('Failed to dequeue job:', dequeueError);
          continue;
        }
        
        if (!dequeuedJob || dequeuedJob.length === 0) {
          console.log('No job dequeued (may have been picked up by another worker)');
          continue;
        }
        
        const activeJob = dequeuedJob[0];
        console.log(`\nDequeued job ${activeJob.job_id}`);
        
        try {
          // Simulate feed processing
          console.log('Simulating feed fetch...');
          
          // In a real scenario, we would:
          // 1. Fetch the RSS feed
          // 2. Parse items
          // 3. Save to raw_feeds table
          // 4. Queue content processing jobs
          
          // For now, just mark it as completed
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Complete the job
          const { data: completed, error: completeError } = await supabase
            .rpc('complete_job', { job_id: activeJob.job_id });
          
          if (completeError) {
            console.error('Failed to complete job:', completeError);
          } else {
            console.log('✓ Job completed successfully');
          }
          
        } catch (error) {
          console.error('Job processing failed:', error);
          
          // Fail the job
          const { error: failError } = await supabase
            .rpc('fail_job', { 
              job_id: activeJob.job_id, 
              error_msg: error instanceof Error ? error.message : 'Unknown error' 
            });
          
          if (failError) {
            console.error('Failed to mark job as failed:', failError);
          }
        }
      }
    }
    
    // Check final queue stats
    console.log('\n\nFinal Queue Statistics:');
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
    console.error('Error processing feed job:', error);
  }
}

// Run the processor
processFeedJob().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});