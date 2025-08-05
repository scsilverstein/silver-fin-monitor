import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'podcast' | 'youtube' | 'api';
  url: string;
  config: any;
  last_processed_at?: string;
}

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

class FeedProcessor {
  private queueService: NetlifyQueueService;

  constructor() {
    this.queueService = new NetlifyQueueService(supabase);
  }

  async processFeed(feedSource: FeedSource): Promise<void> {
    console.log(`Enqueuing ${feedSource.type} feed: ${feedSource.name}`);
    
    try {
      // Instead of processing directly, enqueue a job
      const jobId = await this.queueService.enqueue('feed_fetch', {
        sourceId: feedSource.id
      }, { priority: 5 });
      
      if (jobId) {
        console.log(`✅ Enqueued feed processing job for ${feedSource.name}: ${jobId}`);
      } else {
        console.log(`⚠️ Skipped duplicate job for ${feedSource.name}`);
      }
      
    } catch (error) {
      console.error(`❌ Error enqueuing job for ${feedSource.name}:`, error);
      throw error;
    }
  }
}

// Netlify Background Function Handler
export const handler: Handler = async (event) => {
  try {
    const { feedSourceIds } = JSON.parse(event.body || '{}');
    
    if (!feedSourceIds || !Array.isArray(feedSourceIds)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'feedSourceIds array required' })
      };
    }
    
    console.log(`🚀 Starting background feed processing for ${feedSourceIds.length} sources`);
    
    const processor = new FeedProcessor();
    const results = [];
    
    for (const feedId of feedSourceIds) {
      try {
        // Get feed source details
        const { data: feedSource, error } = await supabase
          .from('feed_sources')
          .select('*')
          .eq('id', feedId)
          .eq('is_active', true)
          .single();
          
        if (error || !feedSource) {
          console.warn(`Feed source not found: ${feedId}`);
          continue;
        }
        
        await processor.processFeed(feedSource);
        results.push({ feedId, status: 'success' });
        
      } catch (error) {
        console.error(`Error processing feed ${feedId}:`, error);
        results.push({ 
          feedId, 
          status: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    
    console.log(`✅ Background feed processing completed: ${results.length} sources processed`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Processed ${results.length} feed sources`,
        results
      })
    };
    
  } catch (error) {
    console.error('Background feed processing error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};