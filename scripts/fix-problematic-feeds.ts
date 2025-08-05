#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function fixProblematicFeeds() {
  console.log('🔧 Fixing problematic feeds...');
  
  try {
    // 1. Clean up any remaining stuck jobs
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: selectError } = await supabase
      .from('job_queue')
      .select('id, job_type, started_at, attempts')
      .eq('status', 'processing')
      .lt('started_at', fiveMinutesAgo);
    
    if (selectError) throw selectError;
    
    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`🧹 Cleaning up ${stuckJobs.length} stuck jobs...`);
      
      const { error: updateError } = await supabase
        .from('job_queue')
        .update({
          status: 'failed',
          error_message: 'Job timed out - exceeded 5 minute threshold',
          completed_at: new Date().toISOString()
        })
        .eq('status', 'processing')
        .lt('started_at', fiveMinutesAgo);
      
      if (updateError) throw updateError;
      console.log(`✅ Cleaned up ${stuckJobs.length} stuck jobs`);
    }
    
    // 2. Temporarily disable the problematic IMF feed
    const imfSourceId = '22c8af93-581b-4f04-b7fe-90588156d955';
    
    const { error: disableError } = await supabase
      .from('feed_sources')
      .update({ 
        is_active: false,
        config: {
          disabled_reason: 'RSS feed timeouts causing stuck jobs',
          disabled_at: new Date().toISOString(),
          auto_disabled: true
        }
      })
      .eq('id', imfSourceId);
    
    if (disableError) throw disableError;
    console.log('🚫 Temporarily disabled IMF Economic Outlook feed (causing timeouts)');
    
    // 3. Check for other feeds that might be problematic
    const { data: recentFailures, error: failuresError } = await supabase
      .from('job_queue')
      .select('payload, error_message, created_at')
      .eq('status', 'failed')
      .eq('job_type', 'feed_fetch')
      .like('error_message', '%timeout%')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (failuresError) throw failuresError;
    
    if (recentFailures && recentFailures.length > 0) {
      console.log(`\n⚠️  Recent timeout failures (last 24 hours):`);
      const sourceIds = new Set();
      recentFailures.forEach(failure => {
        if (failure.payload && failure.payload.sourceId) {
          sourceIds.add(failure.payload.sourceId);
        }
      });
      
      if (sourceIds.size > 0) {
        const { data: problemFeeds, error: feedsError } = await supabase
          .from('feed_sources')
          .select('name, url, is_active')
          .in('id', Array.from(sourceIds));
        
        if (!feedsError && problemFeeds) {
          problemFeeds.forEach(feed => {
            console.log(`  - ${feed.name}: ${feed.url} (active: ${feed.is_active})`);
          });
        }
      }
    }
    
    // 4. Show current queue status
    const { data: queueStatus, error: statusError } = await supabase
      .from('job_queue')
      .select('status')
      .in('status', ['pending', 'processing', 'retry']);
    
    if (statusError) throw statusError;
    
    const statusCounts = queueStatus?.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log(`\n📊 Current queue status:`);
    console.log(`  - Pending: ${statusCounts.pending || 0}`);
    console.log(`  - Processing: ${statusCounts.processing || 0}`);
    console.log(`  - Retry: ${statusCounts.retry || 0}`);
    
    console.log(`\n✅ Feed cleanup completed successfully`);
    
  } catch (error) {
    console.error('❌ Error fixing problematic feeds:', error);
    process.exit(1);
  }
}

// Run the fix
fixProblematicFeeds().then(() => {
  console.log('🎉 All done!');
  process.exit(0);
});