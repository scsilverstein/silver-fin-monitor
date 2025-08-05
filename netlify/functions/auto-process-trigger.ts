import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface DataFreshnessConfig {
  feeds: number;        // 4 hours
  earnings: number;     // 24 hours  
  analysis: number;     // 12 hours
  predictions: number;  // 6 hours
}

const FRESHNESS_TTL: DataFreshnessConfig = {
  feeds: 4 * 60 * 60 * 1000,      // 4 hours in ms
  earnings: 24 * 60 * 60 * 1000,  // 24 hours in ms
  analysis: 12 * 60 * 60 * 1000,  // 12 hours in ms
  predictions: 6 * 60 * 60 * 1000  // 6 hours in ms
};

class AutoProcessTrigger {
  
  /**
   * Check if feeds need refreshing and trigger processing if stale
   */
  async checkAndTriggerFeeds(): Promise<{ needsProcessing: boolean; triggered: boolean; lastUpdate?: string }> {
    try {
      // Get most recent feed processing timestamp
      const { data: recentFeed } = await supabase
        .from('feed_sources')
        .select('last_processed_at')
        .eq('is_active', true)
        .order('last_processed_at', { ascending: false })
        .limit(1)
        .single();
      
      const lastUpdate = recentFeed?.last_processed_at;
      const needsProcessing = this.isStale(lastUpdate, FRESHNESS_TTL.feeds);
      
      if (needsProcessing) {
        console.log('📡 Feeds are stale, triggering background processing');
        
        // Get all active feed source IDs
        const { data: feedSources } = await supabase
          .from('feed_sources')
          .select('id')
          .eq('is_active', true);
          
        if (feedSources && feedSources.length > 0) {
          const feedIds = feedSources.map(f => f.id);
          
          // Trigger background processing
          await this.triggerBackgroundFunction('process-feeds-background', {
            feedSourceIds: feedIds
          });
          
          return { needsProcessing: true, triggered: true, lastUpdate };
        }
      }
      
      return { needsProcessing, triggered: false, lastUpdate };
      
    } catch (error) {
      console.error('Error checking feeds:', error);
      return { needsProcessing: false, triggered: false };
    }
  }
  
  /**
   * Check if earnings data needs refreshing
   */
  async checkAndTriggerEarnings(): Promise<{ needsProcessing: boolean; triggered: boolean; lastUpdate?: string }> {
    try {
      // Get most recent earnings data timestamp
      const { data: recentEarnings } = await supabase
        .from('earnings_calendar')
        .select('last_updated')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();
      
      const lastUpdate = recentEarnings?.last_updated;
      const needsProcessing = this.isStale(lastUpdate, FRESHNESS_TTL.earnings);
      
      if (needsProcessing) {
        console.log('💰 Earnings data is stale, triggering refresh');
        
        // Trigger earnings refresh background function
        await this.triggerBackgroundFunction('refresh-earnings-background', {
          source: 'auto-trigger',
          timestamp: new Date().toISOString()
        });
        
        return { needsProcessing: true, triggered: true, lastUpdate };
      }
      
      return { needsProcessing, triggered: false, lastUpdate };
      
    } catch (error) {
      console.error('Error checking earnings:', error);
      return { needsProcessing: false, triggered: false };
    }
  }
  
  /**
   * Check if daily analysis needs generation
   */
  async checkAndTriggerAnalysis(): Promise<{ needsProcessing: boolean; triggered: boolean; lastUpdate?: string }> {
    try {
      // Get most recent daily analysis
      const { data: recentAnalysis } = await supabase
        .from('daily_analysis')
        .select('created_at, analysis_date')
        .order('analysis_date', { ascending: false })
        .limit(1)
        .single();
      
      const lastUpdate = recentAnalysis?.created_at;
      const needsProcessing = this.isStale(lastUpdate, FRESHNESS_TTL.analysis);
      
      // Also check if we have analysis for today
      const today = new Date().toISOString().split('T')[0];
      const hasToday = recentAnalysis?.analysis_date === today;
      
      if (needsProcessing || !hasToday) {
        console.log('🧠 Daily analysis is stale or missing, triggering generation');
        
        // Trigger analysis generation
        await this.triggerBackgroundFunction('generate-analysis-background', {
          date: today,
          force: !hasToday,
          source: 'auto-trigger'
        });
        
        return { needsProcessing: true, triggered: true, lastUpdate };
      }
      
      return { needsProcessing, triggered: false, lastUpdate };
      
    } catch (error) {
      console.error('Error checking analysis:', error);
      return { needsProcessing: false, triggered: false };
    }
  }
  
  /**
   * Check if predictions need generation
   */
  async checkAndTriggerPredictions(): Promise<{ needsProcessing: boolean; triggered: boolean; lastUpdate?: string }> {
    try {
      // Get most recent predictions
      const { data: recentPrediction } = await supabase
        .from('predictions')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const lastUpdate = recentPrediction?.created_at;
      const needsProcessing = this.isStale(lastUpdate, FRESHNESS_TTL.predictions);
      
      if (needsProcessing) {
        console.log('🔮 Predictions are stale, triggering generation');
        
        // Get the most recent analysis to base predictions on
        const { data: latestAnalysis } = await supabase
          .from('daily_analysis')
          .select('id, analysis_date')
          .order('analysis_date', { ascending: false })
          .limit(1)
          .single();
        
        if (latestAnalysis) {
          await this.triggerBackgroundFunction('generate-predictions-background', {
            analysisId: latestAnalysis.id,
            analysisDate: latestAnalysis.analysis_date,
            source: 'auto-trigger'
          });
          
          return { needsProcessing: true, triggered: true, lastUpdate };
        }
      }
      
      return { needsProcessing, triggered: false, lastUpdate };
      
    } catch (error) {
      console.error('Error checking predictions:', error);
      return { needsProcessing: false, triggered: false };
    }
  }
  
  /**
   * Check if data is stale based on TTL
   */
  private isStale(lastUpdate: string | null | undefined, ttlMs: number): boolean {
    if (!lastUpdate) return true; // No data = stale
    
    const lastUpdateTime = new Date(lastUpdate).getTime();
    const now = Date.now();
    const age = now - lastUpdateTime;
    
    return age > ttlMs;
  }
  
  /**
   * Trigger a Netlify background function
   */
  private async triggerBackgroundFunction(functionName: string, payload: any): Promise<void> {
    try {
      const netlifyUrl = process.env.NETLIFY_URL || process.env.URL;
      if (!netlifyUrl) {
        console.warn('NETLIFY_URL not set, cannot trigger background function');
        return;
      }
      
      const response = await fetch(`${netlifyUrl}/.netlify/functions/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Netlify-Event': 'background'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Failed to trigger ${functionName}: ${response.status}`);
      } else {
        console.log(`✅ Successfully triggered ${functionName}`);
      }
      
    } catch (error) {
      console.error(`Error triggering ${functionName}:`, error);
    }
  }
  
  /**
   * Get processing status for all data types
   */
  async getProcessingStatus(): Promise<{
    feeds: { needsProcessing: boolean; lastUpdate?: string };
    earnings: { needsProcessing: boolean; lastUpdate?: string };
    analysis: { needsProcessing: boolean; lastUpdate?: string };
    predictions: { needsProcessing: boolean; lastUpdate?: string };
  }> {
    const [feeds, earnings, analysis, predictions] = await Promise.all([
      this.checkDataFreshness('feeds'),
      this.checkDataFreshness('earnings'),
      this.checkDataFreshness('analysis'),
      this.checkDataFreshness('predictions')
    ]);
    
    return { feeds, earnings, analysis, predictions };
  }
  
  private async checkDataFreshness(dataType: keyof DataFreshnessConfig): Promise<{ needsProcessing: boolean; lastUpdate?: string }> {
    try {
      let lastUpdate: string | null = null;
      
      switch (dataType) {
        case 'feeds':
          const { data: feedData } = await supabase
            .from('feed_sources')
            .select('last_processed_at')
            .eq('is_active', true)
            .order('last_processed_at', { ascending: false })
            .limit(1)
            .single();
          lastUpdate = feedData?.last_processed_at;
          break;
          
        case 'earnings':
          const { data: earningsData } = await supabase
            .from('earnings_calendar')
            .select('last_updated')
            .order('last_updated', { ascending: false })
            .limit(1)
            .single();
          lastUpdate = earningsData?.last_updated;
          break;
          
        case 'analysis':
          const { data: analysisData } = await supabase
            .from('daily_analysis')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          lastUpdate = analysisData?.created_at;
          break;
          
        case 'predictions':
          const { data: predictionData } = await supabase
            .from('predictions')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          lastUpdate = predictionData?.created_at;
          break;
      }
      
      const needsProcessing = this.isStale(lastUpdate, FRESHNESS_TTL[dataType]);
      return { needsProcessing, lastUpdate: lastUpdate || undefined };
      
    } catch (error) {
      console.error(`Error checking ${dataType} freshness:`, error);
      return { needsProcessing: false };
    }
  }
}

// Netlify Function Handler
export const handler: Handler = async (event) => {
  const trigger = new AutoProcessTrigger();
  
  try {
    const { action, dataTypes } = JSON.parse(event.body || '{}');
    
    if (action === 'status') {
      // Return processing status for all data types
      const status = await trigger.getProcessingStatus();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: status,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    if (action === 'trigger') {
      // Trigger processing for specified data types
      const results: any = {};
      const typesToProcess = dataTypes || ['feeds', 'earnings', 'analysis', 'predictions'];
      
      for (const dataType of typesToProcess) {
        switch (dataType) {
          case 'feeds':
            results.feeds = await trigger.checkAndTriggerFeeds();
            break;
          case 'earnings':
            results.earnings = await trigger.checkAndTriggerEarnings();
            break;
          case 'analysis':
            results.analysis = await trigger.checkAndTriggerAnalysis();
            break;
          case 'predictions':
            results.predictions = await trigger.checkAndTriggerPredictions();
            break;
        }
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Auto-processing check completed',
          data: results,
          timestamp: new Date().toISOString()
        })
      };
    }
    
    // Default: check all data types and trigger if needed
    const results = {
      feeds: await trigger.checkAndTriggerFeeds(),
      earnings: await trigger.checkAndTriggerEarnings(),
      analysis: await trigger.checkAndTriggerAnalysis(),
      predictions: await trigger.checkAndTriggerPredictions()
    };
    
    const totalTriggered = Object.values(results).filter(r => r.triggered).length;
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Auto-processing completed: ${totalTriggered} data types triggered`,
        data: results,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Auto-process trigger error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};