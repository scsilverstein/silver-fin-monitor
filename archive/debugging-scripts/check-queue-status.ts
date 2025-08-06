#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkQueueStatus() {
  try {
    console.log('📋 Checking Queue Status...');
    
    // Get active jobs
    const { data: activeJobs, error } = await supabase
      .from('job_queue')
      .select('id, job_type, status, priority, created_at, attempts, scheduled_at')
      .in('status', ['pending', 'processing', 'retry'])
      .order('priority', { ascending: true })
      .limit(20);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(`\n🔄 Active Jobs: ${activeJobs?.length || 0}`);
    
    if (activeJobs && activeJobs.length > 0) {
      activeJobs.forEach(job => {
        const scheduledAt = new Date(job.scheduled_at);
        const isReady = scheduledAt <= new Date();
        const delay = isReady ? 'Ready' : `Delayed ${Math.round((scheduledAt.getTime() - Date.now()) / 1000)}s`;
        
        console.log(`  📝 ${job.job_type}`);
        console.log(`     Status: ${job.status} | Priority: ${job.priority} | Attempts: ${job.attempts}`);
        console.log(`     Scheduled: ${delay}`);
        console.log('');
      });
    } else {
      console.log('  ✅ No active jobs in queue');
    }
    
    // Get recent completed jobs
    const { data: recentJobs } = await supabase
      .from('job_queue')
      .select('id, job_type, status, completed_at')
      .in('status', ['completed', 'failed'])
      .order('completed_at', { ascending: false })
      .limit(10);
    
    console.log(`\n📊 Recent Jobs (last 10): ${recentJobs?.length || 0}`);
    
    if (recentJobs && recentJobs.length > 0) {
      recentJobs.forEach(job => {
        const completedAt = job.completed_at ? new Date(job.completed_at).toLocaleTimeString() : 'Unknown';
        const statusIcon = job.status === 'completed' ? '✅' : '❌';
        console.log(`  ${statusIcon} ${job.job_type} (${job.status}) at ${completedAt}`);
      });
    }
    
    // Check analysis and predictions today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayAnalysis } = await supabase
      .from('daily_analysis')
      .select('id, created_at, market_sentiment, confidence_score')
      .eq('analysis_date', today)
      .single();
    
    const { data: todayPredictions } = await supabase
      .from('predictions')
      .select('id, prediction_type, confidence_level')
      .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
    
    console.log(`\n📈 Today's Analysis (${today}):`);
    if (todayAnalysis) {
      console.log(`  ✅ Analysis exists: ${todayAnalysis.market_sentiment} (confidence: ${todayAnalysis.confidence_score})`);
      console.log(`  📅 Created at: ${new Date(todayAnalysis.created_at).toLocaleString()}`);
    } else {
      console.log(`  ❌ No analysis for today`);
    }
    
    console.log(`\n🔮 Today's Predictions: ${todayPredictions?.length || 0}`);
    if (todayPredictions && todayPredictions.length > 0) {
      const predictionTypes = todayPredictions.reduce((acc, p) => {
        acc[p.prediction_type] = (acc[p.prediction_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(predictionTypes).forEach(([type, count]) => {
        console.log(`  📊 ${type}: ${count}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to check queue status:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkQueueStatus()
    .then(() => {
      console.log('\n✨ Queue status check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Queue status check failed:', error);
      process.exit(1);
    });
}

export { checkQueueStatus };