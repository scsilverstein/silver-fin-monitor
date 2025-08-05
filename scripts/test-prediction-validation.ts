import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function testPredictionValidation() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🧪 Testing Prediction Validation System...\n');

  // Get some predictions for testing
  const { data: testPredictions } = await supabase
    .from('predictions')
    .select('id, prediction_type, time_horizon, created_at')
    .order('created_at', { ascending: true })
    .limit(3);

  console.log('📅 Selected predictions for testing:');
  testPredictions?.forEach((pred, index) => {
    const ageInHours = (Date.now() - new Date(pred.created_at).getTime()) / (1000 * 60 * 60);
    console.log(`  ${index + 1}. ${pred.prediction_type} (${pred.time_horizon}) - ${ageInHours.toFixed(1)} hours old`);
  });

  // Get the most recent daily analysis
  const { data: recentAnalysis } = await supabase
    .from('daily_analysis')
    .select('id, analysis_date')
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single();

  if (!recentAnalysis) {
    console.log('❌ No daily analysis found to compare against');
    return;
  }

  console.log(`\n🎯 Using daily analysis: ${recentAnalysis.analysis_date} (ID: ${recentAnalysis.id.substring(0, 8)}...)`);

  // Create test validation jobs
  console.log('\n🔧 Creating test prediction validation jobs...');
  
  let jobsCreated = 0;
  for (const prediction of testPredictions || []) {
    try {
      const { data: jobId, error } = await supabase.rpc('enqueue_job', {
        job_type: 'prediction_compare',
        payload: JSON.stringify({
          predictionId: prediction.id,
          analysisDate: recentAnalysis.analysis_date,
          currentAnalysisId: recentAnalysis.id
        }),
        priority: 4,
        delay_seconds: 0
      });

      if (!error) {
        jobsCreated++;
        console.log(`  ✅ Created validation job for ${prediction.prediction_type} (${prediction.time_horizon})`);
        console.log(`     Job ID: ${jobId}`);
      } else {
        console.log(`  ❌ Failed to create job for ${prediction.id}:`, error);
      }
    } catch (error) {
      console.log(`  ❌ Error creating job for ${prediction.id}:`, error);
    }
  }

  console.log(`\n✅ Created ${jobsCreated} test prediction validation jobs`);

  // Check the queue
  const { data: queuedJobs } = await supabase
    .from('job_queue')
    .select('id, status, priority, created_at, payload')
    .eq('job_type', 'prediction_compare')
    .order('created_at', { ascending: false });

  console.log(`\n📊 Current prediction_compare jobs in queue: ${queuedJobs?.length || 0}`);
  queuedJobs?.forEach((job, index) => {
    const payload = JSON.parse(job.payload);
    console.log(`  ${index + 1}. ${job.id.substring(0, 8)}... (status: ${job.status}, priority: ${job.priority})`);
    console.log(`     Prediction ID: ${payload.predictionId?.substring(0, 8)}...`);
    console.log(`     Created: ${new Date(job.created_at).toLocaleString()}`);
    console.log('');
  });

  if (jobsCreated > 0) {
    console.log('🎯 Next Steps:');
    console.log('  1. Start the queue worker to process these prediction_compare jobs');
    console.log('  2. Check the prediction_comparisons table for results');
    console.log('  3. Verify accuracy scores are calculated correctly');
    console.log('\nRun this to start processing:');
    console.log('  npx tsx scripts/start-queue-worker-safe.ts');
  }

  // Show current job priorities for context
  console.log('\n📋 Current queue priorities:');
  const { data: allPendingJobs } = await supabase
    .from('job_queue')
    .select('job_type, priority, status')
    .eq('status', 'pending');

  const priorityCounts: Record<number, Record<string, number>> = {};
  allPendingJobs?.forEach(job => {
    if (!priorityCounts[job.priority]) priorityCounts[job.priority] = {};
    priorityCounts[job.priority][job.job_type] = (priorityCounts[job.priority][job.job_type] || 0) + 1;
  });

  Object.entries(priorityCounts).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([priority, types]) => {
    console.log(`  Priority ${priority}:`);
    Object.entries(types).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count} jobs`);
    });
  });
}

testPredictionValidation().catch(console.error);