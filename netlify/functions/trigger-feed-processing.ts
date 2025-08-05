import { Handler } from '@netlify/functions';
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

  // Get queue stats using the same functions as the main app
  async getStats(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase.rpc('get_queue_stats');
      
      if (error) {
        console.error('Error getting queue stats:', error);
        return {};
      }

      const stats: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((row: any) => {
          stats[row.status] = Number(row.count);
        });
      }

      return stats;
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return {};
    }
  }
}

class ManualFeedProcessor {
  private queueService: ProductionQueueService;

  constructor() {
    this.queueService = new ProductionQueueService();
  }
  
  async processAllFeeds(): Promise<{
    enqueued: number;
    skipped: number;
    failed: number;
    results: any[];
  }> {
    console.log('🚀 Starting manual feed processing (via queue)');
    
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
      return { enqueued: 0, skipped: 0, failed: 0, results: [] };
    }
    
    console.log(`📡 Enqueuing ${feedSources.length} feed processing jobs`);
    
    const results = [];
    
    // Enqueue jobs for each feed source
    for (const feedSource of feedSources) {
      try {
        const jobId = await this.queueService.enqueue('feed_fetch', {
          sourceId: feedSource.id
        }, 3); // Higher priority for manual requests
        
        results.push({
          feedId: feedSource.id,
          feedName: feedSource.name,
          feedType: feedSource.type,
          status: jobId ? 'enqueued' : 'skipped',
          jobId
        });
        
      } catch (error) {
        console.error(`Error enqueuing job for ${feedSource.name}:`, error);
        results.push({
          feedId: feedSource.id,
          feedName: feedSource.name,
          feedType: feedSource.type,
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
    
    return { enqueued, skipped, failed, results };
  }
}

// HTTP Handler for manual trigger
export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST to trigger feed processing.'
      }),
    };
  }

  try {
    console.log('🔄 Manual feed processing triggered via HTTP');
    
    const processor = new ManualFeedProcessor();
    const result = await processor.processAllFeeds();
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Manual feed processing triggered successfully',
        timestamp: new Date().toISOString(),
        stats: {
          totalFeeds: result.enqueued + result.skipped + result.failed,
          enqueued: result.enqueued,
          skipped: result.skipped,
          failed: result.failed
        },
        results: result.results.slice(0, 10) // Limit to first 10 for response size
      }),
    };
    
  } catch (error) {
    console.error('❌ Manual feed processing failed:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
    };
  }
};