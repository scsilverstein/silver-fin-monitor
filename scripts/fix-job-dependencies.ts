import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function fixJobDependencies() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🔧 Fixing Job Dependencies...\n');

  // Step 1: Fix orphaned raw feeds (create missing content_process jobs)
  console.log('1️⃣ Finding orphaned raw feeds...');
  
  const { data: pendingRawFeeds } = await supabase
    .from('raw_feeds')
    .select('id, source_id, external_id, title, created_at')
    .eq('processing_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log(`Found ${pendingRawFeeds?.length || 0} pending raw feeds`);

  let jobsCreated = 0;
  for (const feed of pendingRawFeeds || []) {
    // Check if content_process job already exists
    const { data: existingJob } = await supabase
      .from('job_queue')
      .select('id')
      .eq('job_type', 'content_process')
      .contains('payload', { rawFeedId: feed.id })
      .single();

    if (!existingJob) {
      // Create content_process job
      const { data: newJob, error } = await supabase.rpc('enqueue_job', {
        job_type: 'content_process',
        payload: JSON.stringify({
          sourceId: feed.source_id,
          externalId: feed.external_id,
          rawFeedId: feed.id
        }),
        priority: 2, // Higher priority than analysis
        delay_seconds: 0
      });

      if (!error) {
        jobsCreated++;
        console.log(`  ✅ Created content_process job for feed ${feed.id.substring(0, 8)}...`);
      } else {
        console.log(`  ❌ Failed to create job for feed ${feed.id.substring(0, 8)}...:`, error);
      }
    }
  }

  console.log(`\n✅ Created ${jobsCreated} missing content_process jobs\n`);

  // Step 2: Ensure proper job priority structure
  console.log('2️⃣ Fixing job priorities for proper dependency order...');

  // Update job priorities to ensure correct execution order:
  // Priority 1: feed_fetch, daily_analysis  
  // Priority 2: content_process
  // Priority 3: generate_predictions

  // Update content_process jobs to priority 2 if they're higher
  const { data: updatedContentJobs, error: contentError } = await supabase
    .from('job_queue')
    .update({ priority: 2 })
    .eq('job_type', 'content_process')
    .eq('status', 'pending')
    .gt('priority', 2)
    .select('id');

  if (updatedContentJobs) {
    console.log(`  ✅ Updated ${updatedContentJobs.length} content_process jobs to priority 2`);
  }

  // Update generate_predictions jobs to priority 3
  const { data: updatedPredJobs, error: predError } = await supabase
    .from('job_queue')
    .update({ priority: 3 })
    .eq('job_type', 'generate_predictions')
    .eq('status', 'pending')
    .lt('priority', 3)
    .select('id');

  if (updatedPredJobs) {
    console.log(`  ✅ Updated ${updatedPredJobs.length} generate_predictions jobs to priority 3`);
  }

  // Step 3: Check if we need fresh daily analysis
  console.log('3️⃣ Checking if daily analysis needs refresh...');

  const { data: latestProcessedContent } = await supabase
    .from('processed_content')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const today = new Date().toISOString().split('T')[0];
  const { data: todayAnalysis } = await supabase
    .from('daily_analysis')
    .select('created_at')
    .eq('analysis_date', today)
    .single();

  const needsNewAnalysis = !todayAnalysis || 
    (latestProcessedContent && new Date(latestProcessedContent.created_at) > new Date(todayAnalysis.created_at));

  if (needsNewAnalysis) {
    console.log('  📈 Creating fresh daily_analysis job...');
    
    const { data: analysisJob, error: analysisError } = await supabase.rpc('enqueue_job', {
      job_type: 'daily_analysis',
      payload: JSON.stringify({ 
        date: today,
        forceRegenerate: true 
      }),
      priority: 1,
      delay_seconds: 60 // Wait 1 minute to let content processing finish
    });

    if (!analysisError) {
      console.log(`  ✅ Created daily_analysis job: ${analysisJob}`);

      // Schedule predictions job after analysis
      setTimeout(async () => {
        const { data: predJob } = await supabase.rpc('enqueue_job', {
          job_type: 'generate_predictions',
          payload: JSON.stringify({ 
            analysisDate: today,
            forceRegenerate: true 
          }),
          priority: 3,
          delay_seconds: 300 // Wait 5 minutes for analysis to complete
        });
        console.log(`  ✅ Scheduled generate_predictions job: ${predJob}`);
      }, 1000);
    }
  } else {
    console.log('  ✅ Daily analysis is up to date');
  }

  // Step 4: Summary of current job structure
  console.log('\n4️⃣ Current job priority structure:');
  
  const { data: jobCounts } = await supabase
    .from('job_queue')
    .select('job_type, priority, status')
    .eq('status', 'pending');

  const priorityMap: Record<number, Record<string, number>> = {};
  jobCounts?.forEach(job => {
    if (!priorityMap[job.priority]) priorityMap[job.priority] = {};
    priorityMap[job.priority][job.job_type] = (priorityMap[job.priority][job.job_type] || 0) + 1;
  });

  Object.entries(priorityMap).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([priority, types]) => {
    console.log(`  Priority ${priority}:`);
    Object.entries(types).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count} jobs`);
    });
  });

  console.log('\n✅ Job dependencies fixed!');
  console.log('\n📋 Execution order will be:');
  console.log('  1. feed_fetch & daily_analysis (priority 1)');
  console.log('  2. content_process (priority 2)');
  console.log('  3. generate_predictions (priority 3)');
}

fixJobDependencies().catch(console.error);