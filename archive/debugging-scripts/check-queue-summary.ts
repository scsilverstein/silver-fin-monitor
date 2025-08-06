#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkQueueSummary() {
  console.log('=== Queue Summary ===\n');

  try {
    // Get queue statistics grouped by job type, status, and priority
    const { data: queueStats, error } = await supabase
      .from('job_queue')
      .select('job_type, status, priority')
      .in('status', ['pending', 'processing', 'retry']);

    if (error) {
      console.error('Error fetching queue stats:', error);
      return;
    }

    // Organize stats
    const stats: Record<string, Record<string, Record<string, number>>> = {};
    
    queueStats?.forEach(job => {
      if (!stats[job.job_type]) stats[job.job_type] = {};
      if (!stats[job.job_type][`priority_${job.priority}`]) {
        stats[job.job_type][`priority_${job.priority}`] = {};
      }
      stats[job.job_type][`priority_${job.priority}`][job.status] = 
        (stats[job.job_type][`priority_${job.priority}`][job.status] || 0) + 1;
    });

    // Display organized stats
    Object.entries(stats).forEach(([jobType, priorities]) => {
      console.log(`${jobType}:`);
      
      // Sort by priority
      const sortedPriorities = Object.entries(priorities).sort((a, b) => {
        const aPriority = parseInt(a[0].replace('priority_', ''));
        const bPriority = parseInt(b[0].replace('priority_', ''));
        return aPriority - bPriority;
      });
      
      sortedPriorities.forEach(([priority, statuses]) => {
        const total = Object.values(statuses).reduce((sum, count) => sum + count, 0);
        console.log(`  ${priority} (total: ${total}):`);
        Object.entries(statuses).forEach(([status, count]) => {
          console.log(`    ${status}: ${count}`);
        });
      });
      console.log('');
    });

    // Get next 10 jobs that will be processed
    console.log('=== Next 10 Jobs in Queue ===\n');
    
    const { data: nextJobs } = await supabase
      .from('job_queue')
      .select('job_type, priority, status, scheduled_at')
      .in('status', ['pending', 'retry'])
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_at', { ascending: true })
      .limit(10);

    nextJobs?.forEach((job, index) => {
      console.log(`${index + 1}. ${job.job_type} (priority: ${job.priority}, status: ${job.status})`);
    });

    // Check processing status of feeds
    console.log('\n=== Feed Processing Status ===\n');
    
    const { data: feedStats } = await supabase
      .from('raw_feeds')
      .select('processing_status');

    const feedCounts: Record<string, number> = {};
    feedStats?.forEach(feed => {
      feedCounts[feed.processing_status] = (feedCounts[feed.processing_status] || 0) + 1;
    });

    Object.entries(feedCounts).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

  } catch (error) {
    console.error('Error in checkQueueSummary:', error);
  }
}

// Run the check
checkQueueSummary().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});