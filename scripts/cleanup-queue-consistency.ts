#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function cleanupQueueConsistency() {
  console.log('🧹 Cleaning up queue for consistency and coherence...\n');

  try {
    // 1. Reset stuck processing jobs
    console.log('1. Resetting stuck processing jobs...');
    
    // Jobs stuck in processing for more than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: stuckJobs, error: stuckError } = await supabase
      .from('job_queue')
      .update({
        status: 'retry',
        scheduled_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('started_at', thirtyMinutesAgo)
      .select();
    
    if (stuckError) {
      console.error('Error resetting stuck jobs:', stuckError);
    } else {
      console.log(`✅ Reset ${stuckJobs?.length || 0} stuck processing jobs`);
    }

    // 2. Clean up old completed jobs
    console.log('\n2. Cleaning up old completed jobs...');
    
    // Delete completed jobs older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: deletedCompleted, error: deleteCompletedError } = await supabase
      .from('job_queue')
      .delete()
      .eq('status', 'completed')
      .lt('completed_at', sevenDaysAgo)
      .select();
    
    if (deleteCompletedError) {
      console.error('Error deleting old completed jobs:', deleteCompletedError);
    } else {
      console.log(`✅ Deleted ${deletedCompleted?.length || 0} old completed jobs`);
    }

    // 3. Clean up old failed jobs
    console.log('\n3. Cleaning up old failed jobs...');
    
    const { data: deletedFailed, error: deleteFailedError } = await supabase
      .from('job_queue')
      .delete()
      .eq('status', 'failed')
      .lt('completed_at', sevenDaysAgo)
      .select();
    
    if (deleteFailedError) {
      console.error('Error deleting old failed jobs:', deleteFailedError);
    } else {
      console.log(`✅ Deleted ${deletedFailed?.length || 0} old failed jobs`);
    }

    // 4. Remove duplicate pending jobs
    console.log('\n4. Removing duplicate pending jobs...');
    
    // Get all pending jobs
    const { data: pendingJobs } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (pendingJobs) {
      const seen = new Map<string, string>();
      const duplicateIds: string[] = [];
      
      for (const job of pendingJobs) {
        const key = `${job.job_type}_${JSON.stringify(job.payload)}`;
        if (seen.has(key)) {
          duplicateIds.push(job.id);
        } else {
          seen.set(key, job.id);
        }
      }
      
      if (duplicateIds.length > 0) {
        const { error: dupError } = await supabase
          .from('job_queue')
          .delete()
          .in('id', duplicateIds);
        
        if (!dupError) {
          console.log(`✅ Removed ${duplicateIds.length} duplicate pending jobs`);
        }
      } else {
        console.log('✅ No duplicate pending jobs found');
      }
    }

    // 5. Consolidate worker heartbeat jobs
    console.log('\n5. Consolidating worker heartbeat jobs...');
    
    // Keep only the most recent worker heartbeat
    const { data: heartbeats } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'worker_heartbeat')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (heartbeats && heartbeats.length > 1) {
      // Keep the first (most recent) and delete the rest
      const toDelete = heartbeats.slice(1).map(h => h.id);
      
      const { error: hbError } = await supabase
        .from('job_queue')
        .delete()
        .in('id', toDelete);
      
      if (!hbError) {
        console.log(`✅ Removed ${toDelete.length} redundant heartbeat jobs`);
      }
    } else {
      console.log('✅ Heartbeat jobs are already consolidated');
    }

    // 6. Fix invalid priorities
    console.log('\n6. Fixing invalid job priorities...');
    
    const { data: invalidPriority, error: priorityError } = await supabase
      .from('job_queue')
      .update({ priority: 5 })
      .or('priority.is.null,priority.lt.1,priority.gt.10')
      .select();
    
    if (!priorityError) {
      console.log(`✅ Fixed ${invalidPriority?.length || 0} jobs with invalid priorities`);
    }

    // 7. Generate queue statistics
    console.log('\n7. Generating queue statistics...');
    
    const { data: stats } = await supabase
      .from('job_queue')
      .select('status, job_type');
    
    if (stats) {
      const statusCounts = stats.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const typeCounts = stats.reduce((acc, job) => {
        acc[job.job_type] = (acc[job.job_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('\n📊 Queue Status Distribution:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
      
      console.log('\n📊 Job Type Distribution:');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });
    }

    // 8. Create fresh high-priority jobs for critical data
    console.log('\n8. Creating fresh critical jobs...');
    
    // Check if we need fresh feed processing
    const { data: recentFeedJob } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'feed_fetch')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!recentFeedJob) {
      // Get active feed sources
      const { data: feedSources } = await supabase
        .from('feed_sources')
        .select('id')
        .eq('is_active', true)
        .limit(5);
      
      if (feedSources) {
        for (const source of feedSources) {
          await supabase
            .from('job_queue')
            .insert({
              job_type: 'feed_fetch',
              payload: { sourceId: source.id },
              priority: 1,
              status: 'pending',
              created_at: new Date().toISOString()
            });
        }
        console.log(`✅ Created ${feedSources.length} critical feed fetch jobs`);
      }
    }

    console.log('\n✅ Queue cleanup completed successfully!');
    console.log('The queue is now consistent, coherent, and ready for processing.');
    
  } catch (error) {
    console.error('❌ Queue cleanup failed:', error);
  }
}

// Run the cleanup
cleanupQueueConsistency();