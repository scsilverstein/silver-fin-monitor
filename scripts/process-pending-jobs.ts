#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function processPendingJobs() {
  console.log('🚀 Processing pending jobs...\n');

  try {
    // Get the pending job count
    const { count: pendingCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    console.log(`📊 Found ${pendingCount} pending jobs\n`);

    if (!pendingCount || pendingCount === 0) {
      console.log('✅ No pending jobs to process');
      return;
    }

    // Process jobs in batches
    const batchSize = 5;
    let processed = 0;

    while (processed < pendingCount) {
      console.log(`\n🔄 Processing batch ${Math.floor(processed / batchSize) + 1}...`);

      // Call the queue worker function
      const netlifyUrl = process.env.NETLIFY_URL || process.env.URL || 'http://localhost:8888';
      
      try {
        const response = await fetch(`${netlifyUrl}/.netlify/functions/queue-worker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxJobs: batchSize })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Processed ${result.data?.processed || 0} jobs`);
          
          if (result.data?.results) {
            result.data.results.forEach((job: any) => {
              console.log(`   - ${job.jobType}: ${job.status}`);
            });
          }
          
          processed += result.data?.processed || 0;
        } else {
          console.error(`❌ Queue worker returned ${response.status}`);
          break;
        }
      } catch (error) {
        console.error('❌ Failed to call queue worker:', error);
        break;
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Final statistics
    console.log('\n📊 Final Queue Statistics:');
    
    const { data: finalStats } = await supabase
      .from('job_queue')
      .select('status, job_type');
    
    if (finalStats) {
      const statusCounts = finalStats.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('\nStatus Distribution:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    }

    console.log('\n✅ Job processing completed!');
    
  } catch (error) {
    console.error('❌ Job processing failed:', error);
  }
}

// Run the processor
processPendingJobs();