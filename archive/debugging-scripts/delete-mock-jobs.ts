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

async function deleteMockJobs() {
  console.log('=== Deleting Mock Jobs ===\n');

  try {
    // Get all content_process retry jobs
    const { data: retryJobs, error: fetchError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'content_process')
      .eq('status', 'retry');

    if (fetchError) {
      console.error('Error fetching retry jobs:', fetchError);
      return;
    }

    console.log(`Found ${retryJobs?.length || 0} content_process retry jobs\n`);

    // Filter and delete jobs with mock data
    let deletedCount = 0;
    for (const job of retryJobs || []) {
      const payload = job.payload as any;
      if (payload?.rawFeedId && payload.rawFeedId.includes('mock-')) {
        console.log(`Deleting mock job: ${job.id} (rawFeedId: ${payload.rawFeedId})`);
        
        const { error: deleteError } = await supabase
          .from('job_queue')
          .delete()
          .eq('id', job.id);

        if (!deleteError) {
          deletedCount++;
        } else {
          console.error(`Failed to delete job ${job.id}:`, deleteError);
        }
      }
    }

    console.log(`\nDeleted ${deletedCount} mock jobs`);

    // Show remaining retry jobs
    const { data: remainingJobs } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'content_process')
      .eq('status', 'retry');

    console.log(`\nRemaining content_process retry jobs: ${remainingJobs?.length || 0}`);
    
    if (remainingJobs && remainingJobs.length > 0) {
      console.log('\nRemaining jobs:');
      remainingJobs.forEach((job, index) => {
        console.log(`${index + 1}. ID: ${job.id}, Payload: ${JSON.stringify(job.payload)}`);
      });
    }

  } catch (error) {
    console.error('Error in deleteMockJobs:', error);
  }
}

// Run the cleanup
deleteMockJobs().then(() => {
  console.log('\n✅ Cleanup complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});