import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Production Queue Service for Netlify Functions
 * Uses database functions directly for reliable queue operations
 */
class ProductionQueueService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  async enqueue(
    jobType: string,
    payload: any,
    priority: number = 5,
    delaySeconds: number = 0
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('enqueue_job', {
        job_type: jobType,
        payload: JSON.stringify(payload),
        priority: priority,
        delay_seconds: delaySeconds
      });

      if (error) {
        throw new Error(`Failed to enqueue job: ${error.message}`);
      }

      const jobId = data || 'unknown';
      console.log(`📋 Enqueued ${jobType} job: ${jobId}`);
      return jobId;
    } catch (error) {
      console.error(`❌ Queue error for ${jobType}:`, error);
      throw error;
    }
  }
}

class DailyAnalysisScheduler {
  private queueService: ProductionQueueService;

  constructor() {
    this.queueService = new ProductionQueueService();
  }
  
  async scheduleDailyAnalysis(date: string, force: boolean = false): Promise<void> {
    try {
      console.log(`📅 Scheduling daily analysis for ${date}`);
      
      // Check if analysis already exists (unless forced)
      if (!force) {
        const { data: existing } = await supabase
          .from('daily_analysis')
          .select('id')
          .eq('analysis_date', date)
          .single();
          
        if (existing) {
          console.log(`✅ Daily analysis for ${date} already exists, skipping`);
          return;
        }
      }
      
      // Enqueue daily analysis job through queue system
      const analysisJobId = await this.queueService.enqueue('daily_analysis', {
        date: date,
        forceRegenerate: force,
        source: 'scheduled_netlify'
      }, 1); // High priority
      
      console.log(`✅ Daily analysis job enqueued: ${analysisJobId}`);
      
      // Enqueue prediction generation job with delay (runs after analysis)
      const predictionJobId = await this.queueService.enqueue('generate_predictions', {
        analysisDate: date,
        source: 'scheduled_netlify'
      }, 2, 300); // Medium priority, 5 minute delay
      
      console.log(`✅ Prediction generation job enqueued: ${predictionJobId}`);
      
    } catch (error) {
      console.error(`❌ Error scheduling daily analysis:`, error);
      throw error;
    }
  }
}

// Netlify Scheduled Function Handler
// This runs daily at 6 AM UTC - NOW USES QUEUE SYSTEM ONLY
export const handler: Handler = schedule('0 6 * * *', async (event) => {
  try {
    console.log('🕕 Running scheduled daily analysis - QUEUE-BASED PROCESSING');
    
    const scheduler = new DailyAnalysisScheduler();
    const today = new Date().toISOString().split('T')[0];
    
    // This now properly enqueues jobs instead of processing directly
    await scheduler.scheduleDailyAnalysis(today, false);
    
    console.log('✅ Scheduled daily analysis jobs enqueued successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Daily analysis jobs enqueued successfully - processing through queue system',
        date: today,
        timestamp: new Date().toISOString(),
        processing_method: 'queue_based'
      })
    };
    
  } catch (error) {
    console.error('❌ Failed to schedule daily analysis jobs:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processing_method: 'queue_based'
      })
    };
  }
});