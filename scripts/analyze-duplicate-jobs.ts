import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import winston from 'winston';

config();

// Create a simple logger for this script
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyzeDuplicateJobs() {
  try {
    // Helper function to execute queries
    const query = async (sql: string) => {
      const { data, error } = await supabase.rpc('execute_sql', { query: sql });
      if (error) throw error;
      return data;
    };
    logger.info('Analyzing duplicate jobs in queue...');

    // Get total job count
    const { data: jobQueueCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing', 'retry']);
    
    logger.info(`Total pending/processing jobs: ${jobQueueCount || 0}`);

    // Analyze duplicates by job type - use direct query since we need complex SQL
    const { data: duplicateAnalysis, error: dupError } = await supabase
      .rpc('execute_sql', { 
        query: `
      WITH job_analysis AS (
        SELECT 
          job_type,
          CASE 
            WHEN job_type = 'feed_fetch' THEN payload->>'sourceId'
            WHEN job_type = 'content_process' THEN 
              COALESCE(
                payload->>'contentId',
                payload->>'rawFeedId',
                payload->>'sourceId' || '-' || payload->>'externalId'
              )
            WHEN job_type = 'daily_analysis' THEN payload->>'date'
            WHEN job_type = 'generate_predictions' THEN 
              COALESCE(payload->>'analysisDate', payload->>'date', payload->>'analysisId')
            WHEN job_type = 'prediction_compare' THEN payload->>'predictionId'
            ELSE payload::text
          END as unique_key,
          COUNT(*) as count
        FROM job_queue
        WHERE status IN ('pending', 'processing', 'retry')
        GROUP BY job_type, unique_key
      )
      SELECT 
        job_type,
        COUNT(DISTINCT unique_key) as unique_count,
        SUM(count) as total_count,
        SUM(count) - COUNT(DISTINCT unique_key) as duplicate_count
      FROM job_analysis
      GROUP BY job_type
      ORDER BY duplicate_count DESC
    `);

    logger.info('\nDuplicate Analysis by Job Type:');
    logger.info('================================');
    duplicateAnalysis.forEach(row => {
      logger.info(`${row.job_type}:`);
      logger.info(`  - Unique jobs: ${row.unique_count}`);
      logger.info(`  - Total jobs: ${row.total_count}`);
      logger.info(`  - Duplicates: ${row.duplicate_count}`);
    });

    // Get specific duplicate examples for feed_fetch
    const feedFetchDuplicates = await db.query<{
      source_id: string;
      count: string;
      oldest: string;
      newest: string;
    }>(`
      SELECT 
        payload->>'sourceId' as source_id,
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM job_queue
      WHERE job_type = 'feed_fetch'
      AND status IN ('pending', 'processing', 'retry')
      GROUP BY payload->>'sourceId'
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);

    logger.info('\nTop 10 Feed Sources with Most Duplicates:');
    logger.info('==========================================');
    feedFetchDuplicates.forEach(row => {
      logger.info(`Source: ${row.source_id}`);
      logger.info(`  - Count: ${row.count}`);
      logger.info(`  - Oldest: ${new Date(row.oldest).toLocaleString()}`);
      logger.info(`  - Newest: ${new Date(row.newest).toLocaleString()}`);
    });

    // Check job status distribution
    const statusDistribution = await db.query<{
      status: string;
      count: string;
    }>(`
      SELECT status, COUNT(*) as count
      FROM job_queue
      GROUP BY status
      ORDER BY count DESC
    `);

    logger.info('\nJob Status Distribution:');
    logger.info('========================');
    statusDistribution.forEach(row => {
      logger.info(`${row.status}: ${row.count}`);
    });

    // Check if we have old stuck jobs
    const stuckJobs = await db.query<{
      job_type: string;
      status: string;
      count: string;
      oldest: string;
    }>(`
      SELECT 
        job_type,
        status,
        COUNT(*) as count,
        MIN(created_at) as oldest
      FROM job_queue
      WHERE status IN ('processing', 'retry')
      AND created_at < NOW() - INTERVAL '1 hour'
      GROUP BY job_type, status
      ORDER BY MIN(created_at)
    `);

    if (stuckJobs.length > 0) {
      logger.info('\nPotentially Stuck Jobs (older than 1 hour):');
      logger.info('===========================================');
      stuckJobs.forEach(row => {
        logger.info(`${row.job_type} (${row.status}): ${row.count} jobs, oldest from ${new Date(row.oldest).toLocaleString()}`);
      });
    }

  } catch (error) {
    logger.error('Analysis failed:', error);
  } finally {
    await db.close();
  }
}

// Run the analysis
analyzeDuplicateJobs()
  .then(() => {
    logger.info('\nAnalysis completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });