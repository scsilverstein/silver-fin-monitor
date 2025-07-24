#!/usr/bin/env tsx

/**
 * Content Backfill Script
 * 
 * This script backfills content from the past week by:
 * 1. Checking all active feed sources
 * 2. Fetching historical content for the past 7 days
 * 3. Processing any missing content
 */

import { db } from '../src/services/database';
import { logger } from '../src/utils/logger';

interface FeedSource {
  id: string;
  name: string;
  type: string;
  url: string;
  lastProcessedAt: string | null;
  config: any;
}

// Database instance is imported from services/database

const backfillContent = async (days: number = 7) => {
  try {
    logger.info(`Starting content backfill for past ${days} days`);
    
    // 1. Get all active feed sources
    const client = db.getClient();
    const { data: sources, error: sourcesError } = await client
      .from('feed_sources')
      .select('*')
      .eq('is_active', true);
    
    if (sourcesError) {
      throw new Error(`Failed to fetch feed sources: ${sourcesError.message}`);
    }
    
    logger.info(`Found ${sources.length} active feed sources`);
    
    // 2. Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    logger.info(`Backfill date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // 3. Check current content count in this range
    const { data: existingContent, error: contentError } = await client
      .from('processed_content')
      .select('id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (contentError) {
      throw new Error(`Failed to check existing content: ${contentError.message}`);
    }
    
    logger.info(`Found ${existingContent.length} existing content items in date range`);
    
    // 4. Enqueue backfill jobs for each source
    let enqueuedJobs = 0;
    
    for (const source of sources) {
      try {
        // Check if this source has been processed recently
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - 4); // Last 4 hours
        
        const shouldProcess = !source.lastProcessedAt || 
                            new Date(source.lastProcessedAt) < cutoffDate;
        
        if (shouldProcess) {
          // Enqueue immediate processing job
          const { data: jobData, error: jobError } = await client
            .rpc('enqueue_job', {
              job_type: 'feed_fetch',
              payload: { 
                sourceId: source.id,
                backfill: true,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
              },
              priority: 2 // High priority for backfill
            });
          
          if (jobError) {
            logger.error(`Failed to enqueue job for ${source.name}: ${jobError.message}`);
            continue;
          }
          
          enqueuedJobs++;
          logger.info(`Enqueued backfill job for ${source.name} (${source.type})`);
        } else {
          logger.info(`Skipping ${source.name} - recently processed`);
        }
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error processing source ${source.name}:`, error);
      }
    }
    
    logger.info(`Backfill complete: ${enqueuedJobs} jobs enqueued`);
    
    // 5. Also trigger daily analysis if we have enough content
    if (existingContent.length > 10) {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: analysisJob, error: analysisError } = await client
        .rpc('enqueue_job', {
          job_type: 'daily_analysis',
          payload: { date: today },
          priority: 3
        });
      
      if (analysisError) {
        logger.error(`Failed to enqueue daily analysis: ${analysisError.message}`);
      } else {
        logger.info('Enqueued daily analysis job');
      }
    }
    
    return {
      sourcesFound: sources.length,
      existingContent: existingContent.length,
      jobsEnqueued: enqueuedJobs,
      dateRange: { startDate, endDate }
    };
    
  } catch (error) {
    logger.error('Backfill failed:', error);
    throw error;
  }
};

// CLI interface
const main = async () => {
  const days = parseInt(process.argv[2]) || 7;
  
  try {
    const result = await backfillContent(days);
    
    console.log('\n=== Content Backfill Results ===');
    console.log(`Date range: ${result.dateRange.startDate.toISOString().split('T')[0]} to ${result.dateRange.endDate.toISOString().split('T')[0]}`);
    console.log(`Feed sources: ${result.sourcesFound}`);
    console.log(`Existing content: ${result.existingContent}`);
    console.log(`Jobs enqueued: ${result.jobsEnqueued}`);
    console.log('\nBackfill jobs have been enqueued. Check the queue processing logs for progress.');
    
    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
};

// Export for use in other scripts
export { backfillContent };

// Run if called directly
if (require.main === module) {
  main();
}