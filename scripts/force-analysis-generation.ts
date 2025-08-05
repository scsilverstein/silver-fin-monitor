#!/usr/bin/env tsx

/**
 * Force Analysis Generation Script
 * 
 * This script manually triggers the analysis and prediction generation pipeline
 * to test the new dependency system and ensure everything works correctly.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function forceAnalysisGeneration() {
  try {
    console.log('🚀 Starting forced analysis generation...');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check current state
    console.log('\n📊 Checking current state...');
    
    // Check existing analysis
    const { data: existingAnalysis } = await supabase
      .from('daily_analysis')
      .select('id, created_at, market_sentiment, confidence_score')
      .eq('analysis_date', today)
      .single();
    
    console.log(`📈 Existing analysis for ${today}:`, existingAnalysis ? {
      id: existingAnalysis.id,
      created_at: existingAnalysis.created_at,
      market_sentiment: existingAnalysis.market_sentiment,
      confidence_score: existingAnalysis.confidence_score
    } : 'None');
    
    // Check processed content count
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: todayContent } = await supabase
      .from('processed_content')
      .select('id, created_at')
      .gte('created_at', startOfDay.toISOString());
    
    console.log(`📝 Processed content today: ${todayContent?.length || 0} items`);
    
    // Check existing predictions
    const { data: existingPredictions } = await supabase
      .from('predictions')
      .select('id, prediction_type, time_horizon, confidence_level')
      .gte('created_at', startOfDay.toISOString());
    
    console.log(`🔮 Existing predictions today: ${existingPredictions?.length || 0} items`);
    
    // Check current queue status
    const { data: queueJobs } = await supabase
      .from('job_queue')
      .select('id, job_type, status, priority, created_at')
      .in('job_type', ['daily_analysis', 'generate_predictions'])
      .in('status', ['pending', 'processing', 'retry'])
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log(`⏳ Current analysis/prediction jobs in queue: ${queueJobs?.length || 0}`);
    if (queueJobs && queueJobs.length > 0) {
      queueJobs.forEach(job => {
        console.log(`  - ${job.job_type} (${job.status}) - Priority ${job.priority}`);
      });
    }
    
    // Force queue analysis job
    console.log('\n🧠 Forcing daily analysis generation...');
    const { data: analysisJobId, error: analysisError } = await supabase
      .rpc('enqueue_job', {
        job_type: 'daily_analysis',
        payload: JSON.stringify({
          date: today,
          forceRegenerate: true,
          source: 'manual_force_script',
          contentCount: todayContent?.length || 0
        }),
        priority: 1,
        delay_seconds: 0
      });
    
    if (analysisError) {
      throw new Error(`Failed to queue analysis: ${analysisError.message}`);
    }
    
    console.log(`✅ Analysis job queued: ${analysisJobId}`);
    
    // Force queue prediction job with delay
    console.log('\n🔮 Forcing prediction generation...');
    const { data: predictionJobId, error: predictionError } = await supabase
      .rpc('enqueue_job', {
        job_type: 'generate_predictions',
        payload: JSON.stringify({
          analysisDate: today,
          source: 'manual_force_script'
        }),
        priority: 2,
        delay_seconds: 300 // 5 minute delay
      });
    
    if (predictionError) {
      throw new Error(`Failed to queue predictions: ${predictionError.message}`);
    }
    
    console.log(`✅ Prediction job queued: ${predictionJobId}`);
    
    // Final status
    console.log('\n🎉 Force generation completed!');
    console.log('\n📋 Summary:');
    console.log(`  - Date: ${today}`);
    console.log(`  - Content items available: ${todayContent?.length || 0}`);
    console.log(`  - Analysis job ID: ${analysisJobId}`);
    console.log(`  - Prediction job ID: ${predictionJobId}`);
    console.log(`  - Had existing analysis: ${!!existingAnalysis}`);
    
    console.log('\n⏱ Next steps:');
    console.log('  1. Wait for queue worker to process analysis job (~2-3 minutes)');
    console.log('  2. Wait for prediction generation job (~5-10 minutes after analysis)');
    console.log('  3. Check dashboard for new analysis and predictions');
    console.log('\n🔍 Monitor progress:');
    console.log('  - Check queue status: /api/queue/status');
    console.log('  - Check analysis: /api/analysis/daily/' + today);
    console.log('  - Check predictions: /api/predictions');
    
  } catch (error) {
    console.error('❌ Force analysis generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  forceAnalysisGeneration()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { forceAnalysisGeneration };