import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeJobDependencies() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🔍 Analyzing Job Dependencies...\n');

  // Expected dependency chain:
  // 1. feed_fetch → creates raw_feeds
  // 2. content_process → processes raw_feeds → creates processed_content
  // 3. daily_analysis → reads processed_content → creates daily_analysis
  // 4. generate_predictions → reads daily_analysis → creates predictions

  console.log('📊 Expected Job Flow:');
  console.log('  1. feed_fetch → creates raw_feeds');
  console.log('  2. content_process → processes raw_feeds → creates processed_content');
  console.log('  3. daily_analysis → reads processed_content → creates daily_analysis');
  console.log('  4. generate_predictions → reads daily_analysis → creates predictions\n');

  // Check current data state
  const { data: rawFeeds } = await supabase
    .from('raw_feeds')
    .select('id, processing_status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: processedContent } = await supabase
    .from('processed_content')
    .select('id, raw_feed_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: dailyAnalyses } = await supabase
    .from('daily_analysis')
    .select('id, analysis_date, sources_analyzed, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, daily_analysis_id, prediction_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📈 Current Data State:');
  console.log(`  - Raw Feeds: ${rawFeeds?.length || 0} recent records`);
  console.log(`  - Processed Content: ${processedContent?.length || 0} recent records`);
  console.log(`  - Daily Analyses: ${dailyAnalyses?.length || 0} records`);
  console.log(`  - Predictions: ${predictions?.length || 0} recent records\n`);

  // Check for data without dependencies
  console.log('🔗 Checking Data Dependencies:');

  // Check raw feeds without corresponding content_process jobs or processed content
  let orphanedRawFeeds = 0;
  if (rawFeeds) {
    for (const feed of rawFeeds) {
      if (feed.processing_status === 'pending') {
        // Check if there's a content_process job for this feed
        const { data: contentJob } = await supabase
          .from('job_queue')
          .select('id')
          .eq('job_type', 'content_process')
          .contains('payload', { rawFeedId: feed.id })
          .single();

        if (!contentJob) {
          orphanedRawFeeds++;
        }
      }
    }
  }

  // Check processed content age vs daily analysis age
  const latestProcessedContent = processedContent?.[0];
  const latestDailyAnalysis = dailyAnalyses?.[0];

  console.log(`  - Orphaned raw feeds (pending without content_process jobs): ${orphanedRawFeeds}`);
  if (latestProcessedContent && latestDailyAnalysis) {
    const contentTime = new Date(latestProcessedContent.created_at).getTime();
    const analysisTime = new Date(latestDailyAnalysis.created_at).getTime();
    const isAnalysisOlder = analysisTime < contentTime;
    console.log(`  - Latest processed content: ${new Date(latestProcessedContent.created_at).toLocaleString()}`);
    console.log(`  - Latest daily analysis: ${new Date(latestDailyAnalysis.created_at).toLocaleString()}`);
    console.log(`  - Analysis needs update: ${isAnalysisOlder ? 'YES (older than processed content)' : 'NO'}`);
  }

  // Check current job priorities and order
  console.log('\n⚡ Current Job Priorities:');
  const { data: pendingJobs } = await supabase
    .from('job_queue')
    .select('job_type, priority, count(*)')
    .eq('status', 'pending');

  // Group by job type and priority
  const jobGroups: Record<string, Record<number, number>> = {};
  pendingJobs?.forEach((job: any) => {
    if (!jobGroups[job.job_type]) jobGroups[job.job_type] = {};
    jobGroups[job.job_type][job.priority] = (jobGroups[job.job_type][job.priority] || 0) + 1;
  });

  Object.entries(jobGroups).forEach(([jobType, priorities]) => {
    Object.entries(priorities).forEach(([priority, count]) => {
      console.log(`  - ${jobType} (priority ${priority}): ${count} jobs`);
    });
  });

  // Analyze dependency correctness
  console.log('\n✅ Dependency Analysis:');
  
  // Check if priorities make sense for dependencies
  const hasFeedFetch = jobGroups['feed_fetch'] ? Object.keys(jobGroups['feed_fetch']).some(p => parseInt(p) <= 2) : false;
  const hasContentProcess = jobGroups['content_process'] ? Object.keys(jobGroups['content_process']).some(p => parseInt(p) <= 3) : false;
  const hasDailyAnalysis = jobGroups['daily_analysis'] ? Object.keys(jobGroups['daily_analysis']).some(p => parseInt(p) <= 2) : false;
  const hasPredictions = jobGroups['generate_predictions'] ? Object.keys(jobGroups['generate_predictions']).some(p => parseInt(p) <= 3) : false;

  console.log(`  - Feed fetching prioritized: ${hasFeedFetch ? '✅' : '❌'}`);
  console.log(`  - Content processing queued: ${hasContentProcess ? '✅' : '❌'}`);
  console.log(`  - Analysis generation ready: ${hasDailyAnalysis ? '✅' : '❌'}`);
  console.log(`  - Prediction generation ready: ${hasPredictions ? '✅' : '❌'}`);

  // Check for proper scheduling
  if (hasFeedFetch && !hasContentProcess && orphanedRawFeeds > 0) {
    console.log('\n⚠️  ISSUE: Raw feeds being created but no content_process jobs scheduled');
  }
  
  if (hasContentProcess && !hasDailyAnalysis && latestProcessedContent) {
    const hoursOld = (Date.now() - new Date(latestProcessedContent.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursOld > 4) {
      console.log(`\n⚠️  ISSUE: Processed content is ${hoursOld.toFixed(1)} hours old but no daily_analysis scheduled`);
    }
  }

  if (hasDailyAnalysis && !hasPredictions) {
    console.log('\n⚠️  ISSUE: Daily analysis scheduled but no prediction generation scheduled');
  }

  console.log('\n🎯 Recommendations:');
  if (orphanedRawFeeds > 0) {
    console.log(`  - Create ${orphanedRawFeeds} missing content_process jobs`);
  }
  if (latestProcessedContent && latestDailyAnalysis) {
    const contentTime = new Date(latestProcessedContent.created_at).getTime();
    const analysisTime = new Date(latestDailyAnalysis.created_at).getTime();
    if (analysisTime < contentTime) {
      console.log('  - Schedule new daily_analysis to include recent processed content');
    }
  }
  if (hasDailyAnalysis && !hasPredictions) {
    console.log('  - Schedule generate_predictions job after daily_analysis completes');
  }
}

analyzeJobDependencies().catch(console.error);