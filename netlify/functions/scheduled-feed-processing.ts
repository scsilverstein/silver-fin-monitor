import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Production queue service that uses the same database functions as the main app
class ProductionQueueService {
  async enqueue(jobType: string, payload: any, priority: number = 5, delaySeconds: number = 0): Promise<string | null> {
    try {
      // Use the same database function as the main application
      const { data, error } = await supabase
        .rpc('enqueue_job', {
          job_type: jobType,
          payload: payload,
          priority: priority,
          delay_seconds: delaySeconds
        });

      if (error) {
        console.error('Error enqueuing job:', error);
        return null;
      }

      console.log(`✅ Enqueued ${jobType} job: ${data}`);
      return data;
    } catch (error) {
      console.error('Failed to enqueue job:', error);
      return null;
    }
  }
}

class ScheduledFeedProcessor {
  private queueService: ProductionQueueService;

  constructor() {
    this.queueService = new ProductionQueueService();
  }
  
  async processAllFeeds(): Promise<void> {
    try {
      console.log('🚀 Starting scheduled feed processing (via queue)');
      
      // Get all active feed sources
      const { data: feedSources, error: feedsError } = await supabase
        .from('feed_sources')
        .select('id, name, type')
        .eq('is_active', true)
        .order('last_processed_at', { ascending: true, nullsFirst: true });
      
      if (feedsError) {
        throw new Error(`Failed to fetch feed sources: ${feedsError.message}`);
      }
      
      if (!feedSources || feedSources.length === 0) {
        console.log('ℹ️ No active feed sources found');
        return;
      }
      
      console.log(`📡 Enqueuing ${feedSources.length} feed processing jobs`);
      
      const results = [];
      
      // Enqueue jobs for each feed source instead of processing directly
      for (const feedSource of feedSources) {
        try {
          const jobId = await this.queueService.enqueue('feed_fetch', {
            sourceId: feedSource.id
          }, 5); // Standard priority for scheduled jobs
          
          results.push({
            feedId: feedSource.id,
            feedName: feedSource.name,
            status: jobId ? 'enqueued' : 'skipped',
            jobId
          });
          
        } catch (error) {
          console.error(`Error enqueuing job for ${feedSource.name}:`, error);
          results.push({
            feedId: feedSource.id,
            feedName: feedSource.name,
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      const enqueued = results.filter(r => r.status === 'enqueued').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const failed = results.filter(r => r.status === 'error').length;
      
      console.log(`✅ Feed processing completed: ${enqueued} enqueued, ${skipped} skipped (duplicates), ${failed} failed`);
      
      if (failed > 0) {
        console.log('❌ Failed to enqueue:', results.filter(r => r.status === 'error'));
      }
      
    } catch (error) {
      console.error('❌ Scheduled feed processing failed:', error);
      throw error;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Common processing function
const runFeedProcessing = async (trigger = 'scheduled') => {
  console.log(`🕐 Running ${trigger} feed processing`);
  
  const processor = new ScheduledFeedProcessor();
  await processor.processAllFeeds();
  
  console.log(`✅ ${trigger} feed processing completed`);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: `${trigger} feed processing completed`,
      timestamp: new Date().toISOString()
    })
  };
};

// Netlify Scheduled Function Handler
// This runs every 4 hours: at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
export const handler: Handler = schedule('0 */4 * * *', async (event) => {
  try {
    return await runFeedProcessing('scheduled');
  } catch (error) {
    console.error('❌ Scheduled feed processing failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
});