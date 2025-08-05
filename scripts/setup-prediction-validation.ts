import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function setupPredictionValidation() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🔧 Setting up Automated Prediction Validation System...\n');

  // Step 1: Find predictions that need evaluation
  console.log('1️⃣ Finding predictions ready for evaluation...');

  // Get predictions that are:
  // - At least 1 day old (for short-term predictions)
  // - At least 7 days old (for 1-week predictions) 
  // - At least 30 days old (for 1-month predictions)
  // - Haven't been compared yet

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get predictions that haven't been compared yet
  const { data: allPredictions } = await supabase
    .from('predictions')
    .select('id, prediction_type, time_horizon, created_at, daily_analysis_id')
    .order('created_at', { ascending: false })
    .limit(100);

  // Filter out already compared predictions
  const { data: existingComparisons } = await supabase
    .from('prediction_comparisons')
    .select('previous_prediction_id');

  const comparedPredictionIds = new Set(existingComparisons?.map(c => c.previous_prediction_id) || []);

  const uncomparedPredictions = allPredictions?.filter(p => !comparedPredictionIds.has(p.id)) || [];

  console.log(`Found ${uncomparedPredictions.length} predictions that haven't been compared yet`);

  // Step 2: Create comparison jobs for eligible predictions
  let jobsCreated = 0;
  const eligiblePredictions = [];

  for (const prediction of uncomparedPredictions) {
    const predictionDate = new Date(prediction.created_at);
    let isEligible = false;
    let reason = '';

    // Determine if prediction is old enough to evaluate
    switch (prediction.time_horizon) {
      case '1_day':
      case 'daily':
        if (predictionDate < oneDayAgo) {
          isEligible = true;
          reason = '1+ day old';
        }
        break;
      case '1_week':
      case 'weekly':
        if (predictionDate < oneWeekAgo) {
          isEligible = true;
          reason = '1+ week old';
        }
        break;
      case '1_month':
      case 'monthly':
        if (predictionDate < oneMonthAgo) {
          isEligible = true;
          reason = '1+ month old';
        }
        break;
      case '3_months':
      case '6_months':
      case '1_year':
        // For long-term predictions, check them periodically (every 30 days)
        if (predictionDate < oneMonthAgo) {
          isEligible = true;
          reason = 'Long-term periodic check';
        }
        break;
      default:
        // Default to 1 day for unknown horizons
        if (predictionDate < oneDayAgo) {
          isEligible = true;
          reason = 'Default 1+ day old';
        }
    }

    if (isEligible) {
      eligiblePredictions.push({ ...prediction, reason });
    }
  }

  console.log(`\n2️⃣ Creating comparison jobs for ${eligiblePredictions.length} eligible predictions...`);

  for (const prediction of eligiblePredictions) {
    try {
      // Find the most recent daily analysis to compare against
      const { data: recentAnalysis } = await supabase
        .from('daily_analysis')
        .select('id, analysis_date')
        .order('analysis_date', { ascending: false })
        .limit(1)
        .single();

      if (recentAnalysis) {
        // Create prediction comparison job
        const { data: jobId, error } = await supabase.rpc('enqueue_job', {
          job_type: 'prediction_compare',
          payload: JSON.stringify({
            predictionId: prediction.id,
            analysisDate: recentAnalysis.analysis_date,
            currentAnalysisId: recentAnalysis.id
          }),
          priority: 4, // Lower priority than other jobs
          delay_seconds: 0
        });

        if (!error) {
          jobsCreated++;
          console.log(`  ✅ Created comparison job for ${prediction.prediction_type} (${prediction.time_horizon}) - ${prediction.reason}`);
        } else {
          console.log(`  ❌ Failed to create job for prediction ${prediction.id}:`, error);
        }
      }
    } catch (error) {
      console.log(`  ❌ Error processing prediction ${prediction.id}:`, error);
    }
  }

  console.log(`\n✅ Created ${jobsCreated} prediction comparison jobs`);

  // Step 3: Set up recurring validation
  console.log('\n3️⃣ Setting up recurring prediction validation...');

  // Create a daily job to check for predictions that need validation
  const { data: recurringJobId, error: recurringError } = await supabase.rpc('enqueue_job', {
    job_type: 'prediction_validation_check',
    payload: JSON.stringify({
      type: 'daily_validation_check',
      description: 'Check for predictions that need validation'
    }),
    priority: 5,
    delay_seconds: 24 * 60 * 60 // Run daily
  });

  if (!recurringError) {
    console.log(`✅ Created recurring validation check job: ${recurringJobId}`);
  } else {
    console.log('❌ Failed to create recurring job:', recurringError);
  }

  // Step 4: Summary
  console.log('\n📊 Prediction Validation Setup Complete:');
  console.log(`  - Total predictions: ${allPredictions?.length || 0}`);
  console.log(`  - Already compared: ${comparedPredictionIds.size}`);
  console.log(`  - Eligible for comparison: ${eligiblePredictions.length}`);
  console.log(`  - Comparison jobs created: ${jobsCreated}`);
  
  // Show current queue status
  const { data: queueStatus } = await supabase
    .from('job_queue')
    .select('job_type, status')
    .eq('job_type', 'prediction_compare')
    .eq('status', 'pending');

  console.log(`  - Pending comparison jobs: ${queueStatus?.length || 0}`);

  if (jobsCreated > 0) {
    console.log('\n🎯 Next Steps:');
    console.log('  1. The queue worker will process these prediction_compare jobs');
    console.log('  2. Results will be stored in the prediction_comparisons table');
    console.log('  3. Accuracy scores will be calculated for each prediction');
    console.log('  4. This system should be run daily to maintain accuracy tracking');
  }
}

setupPredictionValidation().catch(console.error);