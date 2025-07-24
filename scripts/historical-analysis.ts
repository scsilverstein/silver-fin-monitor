#!/usr/bin/env tsx

/**
 * Historical Analysis & Predictions Script
 * 
 * This script:
 * 1. Fetches older feed items (going back X days)
 * 2. Processes them through the content pipeline
 * 3. Generates analysis for each day
 * 4. Creates predictions based on that historical data
 */

import { db } from '../src/services/database';
import { queueService } from '../src/services/database/queue';
import { aiAnalysisService } from '../src/services/ai/analysis';
import { logger } from '../src/utils/logger';
import { supabase } from '../src/services/database/client';

interface HistoricalAnalysisOptions {
  daysBack: number;
  forceRefetch: boolean;
  generatePredictions: boolean;
}

async function resetLastProcessedDates(daysBack: number) {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysBack);
  
  logger.info(`Resetting last_processed_at to ${targetDate.toISOString()} for all feeds`);
  
  const { error } = await supabase
    .from('feed_sources')
    .update({ last_processed_at: targetDate.toISOString() })
    .eq('is_active', true);
    
  if (error) {
    throw new Error(`Failed to reset feed dates: ${error.message}`);
  }
}

async function fetchHistoricalFeeds(daysBack: number) {
  // Get all active feed sources
  const { data: sources, error } = await supabase
    .from('feed_sources')
    .select('*')
    .eq('is_active', true);
    
  if (error || !sources) {
    throw new Error(`Failed to fetch feed sources: ${error?.message}`);
  }
  
  logger.info(`Found ${sources.length} active feed sources`);
  
  // Queue fetch jobs for each source with historical flag
  let jobsQueued = 0;
  for (const source of sources) {
    const jobId = await queueService.enqueue('feed_fetch', {
      sourceId: source.id,
      historical: true,
      daysBack: daysBack,
      forceRefetch: true
    }, 1); // High priority
    
    if (jobId) {
      jobsQueued++;
      logger.info(`Queued historical fetch for ${source.name}`);
    }
    
    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return jobsQueued;
}

async function waitForProcessing(expectedJobs: number, timeoutMinutes: number = 30) {
  const startTime = Date.now();
  const timeout = timeoutMinutes * 60 * 1000;
  
  logger.info(`Waiting for ${expectedJobs} jobs to complete (timeout: ${timeoutMinutes} minutes)`);
  
  while (Date.now() - startTime < timeout) {
    const { data: stats } = await supabase
      .from('job_queue')
      .select('status')
      .in('status', ['pending', 'processing', 'retry']);
      
    const activeJobs = stats?.length || 0;
    
    if (activeJobs === 0) {
      logger.info('All jobs completed');
      return true;
    }
    
    logger.info(`${activeJobs} jobs still processing...`);
    await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
  }
  
  logger.warn('Timeout reached, proceeding with available data');
  return false;
}

async function generateHistoricalAnalysis(daysBack: number) {
  const analysesGenerated = [];
  
  for (let i = daysBack; i >= 0; i--) {
    const analysisDate = new Date();
    analysisDate.setDate(analysisDate.getDate() - i);
    analysisDate.setHours(12, 0, 0, 0); // Set to noon for consistency
    
    logger.info(`Generating analysis for ${analysisDate.toISOString().split('T')[0]}`);
    
    try {
      // Force regenerate to ensure we have analysis for each day
      await aiAnalysisService.runDailyAnalysis(analysisDate, true);
      analysesGenerated.push(analysisDate);
      
      // Small delay between analyses
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error(`Failed to generate analysis for ${analysisDate.toISOString().split('T')[0]}:`, error);
    }
  }
  
  return analysesGenerated;
}

async function generateHistoricalPredictions(analysisDates: Date[]) {
  const predictionsGenerated = [];
  
  for (const date of analysisDates) {
    const dateStr = date.toISOString().split('T')[0];
    
    logger.info(`Generating predictions for ${dateStr}`);
    
    try {
      await aiAnalysisService.generatePredictions(dateStr);
      predictionsGenerated.push(dateStr);
      
      // Small delay between predictions
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      logger.error(`Failed to generate predictions for ${dateStr}:`, error);
    }
  }
  
  return predictionsGenerated;
}

async function getContentStats(daysBack: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  
  const { data: stats, error } = await supabase
    .from('processed_content')
    .select('id', { count: 'exact' })
    .gte('created_at', startDate.toISOString());
    
  return stats?.length || 0;
}

async function runHistoricalAnalysis(options: HistoricalAnalysisOptions) {
  try {
    logger.info('=== Starting Historical Analysis ===');
    logger.info(`Days back: ${options.daysBack}`);
    logger.info(`Force refetch: ${options.forceRefetch}`);
    logger.info(`Generate predictions: ${options.generatePredictions}`);
    
    // Get initial content count
    const initialContent = await getContentStats(options.daysBack);
    logger.info(`Initial content count (last ${options.daysBack} days): ${initialContent}`);
    
    // Step 1: Reset feed dates if forcing refetch
    if (options.forceRefetch) {
      await resetLastProcessedDates(options.daysBack);
    }
    
    // Step 2: Fetch historical feeds
    const jobsQueued = await fetchHistoricalFeeds(options.daysBack);
    logger.info(`Queued ${jobsQueued} feed fetch jobs`);
    
    // Step 3: Wait for processing to complete
    await waitForProcessing(jobsQueued);
    
    // Step 4: Check new content count
    const finalContent = await getContentStats(options.daysBack);
    logger.info(`Final content count (last ${options.daysBack} days): ${finalContent}`);
    logger.info(`New content items: ${finalContent - initialContent}`);
    
    // Step 5: Generate historical analyses
    const analysisDates = await generateHistoricalAnalysis(options.daysBack);
    logger.info(`Generated ${analysisDates.length} daily analyses`);
    
    // Step 6: Generate predictions if requested
    if (options.generatePredictions) {
      const predictions = await generateHistoricalPredictions(analysisDates);
      logger.info(`Generated predictions for ${predictions.length} days`);
    }
    
    // Final summary
    logger.info('\n=== Historical Analysis Complete ===');
    logger.info(`Content processed: ${finalContent}`);
    logger.info(`Analyses generated: ${analysisDates.length}`);
    logger.info(`Date range: ${analysisDates[0]?.toISOString().split('T')[0]} to ${analysisDates[analysisDates.length - 1]?.toISOString().split('T')[0]}`);
    
  } catch (error) {
    logger.error('Historical analysis failed:', error);
    throw error;
  }
}

// CLI interface
const main = async () => {
  const daysBack = parseInt(process.argv[2]) || 7;
  const forceRefetch = process.argv.includes('--force');
  const generatePredictions = !process.argv.includes('--no-predictions');
  
  const options: HistoricalAnalysisOptions = {
    daysBack,
    forceRefetch,
    generatePredictions
  };
  
  console.log('\n=== Historical Analysis Configuration ===');
  console.log(`Days to analyze: ${daysBack}`);
  console.log(`Force refetch feeds: ${forceRefetch}`);
  console.log(`Generate predictions: ${generatePredictions}`);
  console.log('\nThis will:');
  console.log('1. Fetch feed items from the past ' + daysBack + ' days');
  console.log('2. Process all content through AI pipeline');
  console.log('3. Generate daily analyses for each day');
  if (generatePredictions) {
    console.log('4. Generate predictions based on historical data');
  }
  console.log('\nPress Ctrl+C to cancel or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    await runHistoricalAnalysis(options);
    process.exit(0);
  } catch (error) {
    console.error('Historical analysis failed:', error);
    process.exit(1);
  }
};

// Export for use in other scripts
export { runHistoricalAnalysis, HistoricalAnalysisOptions };

// Run if called directly
if (require.main === module) {
  main();
}