import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Simple queue service for Netlify functions
class NetlifyQueueService {
  constructor(private supabase: any) {}

  async enqueue(jobType: string, payload: any, options: { priority?: number } = {}): Promise<string | null> {
    // Check for duplicate jobs before enqueuing
    const isDuplicate = await this.checkDuplicateJob(jobType, payload);
    if (isDuplicate) {
      console.log(`⚠️ Skipping duplicate job (type: ${jobType})`);
      return isDuplicate;
    }

    // Create new job
    const { data, error } = await this.supabase
      .from('job_queue')
      .insert({
        job_type: jobType,
        payload,
        priority: options.priority || 5,
        status: 'pending',
        scheduled_at: new Date().toISOString(),
        max_attempts: 3,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error enqueuing job:', error);
      return null;
    }

    console.log(`✅ Enqueued ${jobType} job: ${data.id}`);
    return data.id;
  }

  private async checkDuplicateJob(jobType: string, payload: any): Promise<string | null> {
    let query = this.supabase
      .from('job_queue')
      .select('id')
      .eq('job_type', jobType)
      .in('status', ['pending', 'processing', 'retry']);

    // Add specific deduplication logic based on job type
    switch (jobType) {
      case 'feed_fetch':
        query = query.eq('payload->sourceId', payload.sourceId);
        break;
      case 'content_process':
        query = query.eq('payload->rawFeedId', payload.rawFeedId);
        break;
      case 'daily_analysis':
        query = query.eq('payload->date', payload.date);
        break;
      case 'generate_predictions':
        query = query.eq('payload->analysisId', payload.analysisId);
        break;
    }

    const { data } = await query.limit(1).single();
    return data?.id || null;
  }
}

class ScheduledFeedProcessor {
  private queueService: NetlifyQueueService;

  constructor() {
    this.queueService = new NetlifyQueueService(supabase);
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
          }, { priority: 5 });
          
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

// Netlify Scheduled Function Handler
// TEMPORARILY DISABLED - Deploy is in progress
// This runs every 4 hours: at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
export const handler: Handler = schedule('0 0 31 2 *', async (event) => { // Never runs (Feb 31st)
  try {
    console.log('🕐 Running scheduled feed processing');
    
    const processor = new ScheduledFeedProcessor();
    await processor.processAllFeeds();
    
    console.log('✅ Scheduled feed processing completed');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Scheduled feed processing completed',
        timestamp: new Date().toISOString()
      })
    };
    
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