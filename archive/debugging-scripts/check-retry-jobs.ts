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

async function checkRetryJobs() {
  console.log('=== Checking Retry Jobs ===\n');

  try {
    // Get content_process jobs in retry status
    const { data: retryJobs, error } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'content_process')
      .eq('status', 'retry')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching retry jobs:', error);
      return;
    }

    console.log(`Found ${retryJobs?.length || 0} content_process jobs in retry status (showing first 10)\n`);

    if (retryJobs && retryJobs.length > 0) {
      // Analyze error patterns
      const errorPatterns: Record<string, number> = {};
      
      retryJobs.forEach((job, index) => {
        console.log(`${index + 1}. Job ID: ${job.id}`);
        console.log(`   Payload: ${JSON.stringify(job.payload)}`);
        console.log(`   Error: ${job.error_message || 'No error message'}`);
        console.log(`   Attempts: ${job.attempts}/${job.max_attempts}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        console.log(`   Scheduled retry: ${job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'N/A'}`);
        console.log('');

        // Track error patterns
        const errorMsg = job.error_message || 'Unknown error';
        errorPatterns[errorMsg] = (errorPatterns[errorMsg] || 0) + 1;
      });

      // Show error pattern summary
      console.log('=== Error Patterns ===\n');
      Object.entries(errorPatterns)
        .sort(([, a], [, b]) => b - a)
        .forEach(([error, count]) => {
          console.log(`${count}x: ${error}`);
        });
    }

    // Check if these retry jobs have valid raw_feeds
    console.log('\n=== Checking Raw Feed Status ===\n');
    
    if (retryJobs && retryJobs.length > 0) {
      const feedIds = retryJobs
        .map(job => (job.payload as any)?.rawFeedId)
        .filter(Boolean)
        .slice(0, 5); // Check first 5

      for (const feedId of feedIds) {
        const { data: feed, error: feedError } = await supabase
          .from('raw_feeds')
          .select('id, title, processing_status, created_at')
          .eq('id', feedId)
          .single();

        if (feedError) {
          console.log(`Feed ${feedId}: NOT FOUND - ${feedError.message}`);
        } else if (feed) {
          console.log(`Feed ${feedId}:`);
          console.log(`  Title: ${feed.title || 'No title'}`);
          console.log(`  Status: ${feed.processing_status}`);
          console.log(`  Created: ${new Date(feed.created_at).toLocaleString()}`);
        }
        console.log('');
      }
    }

    // Check for jobs that have exceeded max attempts
    const { data: failedJobs, count: failedCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact' })
      .eq('job_type', 'content_process')
      .eq('status', 'failed');

    console.log(`\n=== Failed Jobs ===`);
    console.log(`Total failed content_process jobs: ${failedCount || 0}`);

  } catch (error) {
    console.error('Error in checkRetryJobs:', error);
  }
}

// Run the check
checkRetryJobs().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});