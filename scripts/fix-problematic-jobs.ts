import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixProblematicJobs() {
  console.log('🔧 Fixing Problematic Job Types...\n');
  
  // 1. Handle stuck generate_predictions jobs
  console.log('1. Checking generate_predictions jobs...');
  const twoMinutesAgo = new Date();
  twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);
  
  const { data: stuckPredictions } = await supabase
    .from('job_queue')
    .select('*')
    .eq('job_type', 'generate_predictions')
    .eq('status', 'processing')
    .lt('started_at', twoMinutesAgo.toISOString());
  
  if (stuckPredictions && stuckPredictions.length > 0) {
    console.log(`  Found ${stuckPredictions.length} stuck prediction jobs`);
    
    for (const job of stuckPredictions) {
      // If it's been processing for > 2 minutes, it's likely stuck on OpenAI
      const processingTime = Date.now() - new Date(job.started_at).getTime();
      
      if (processingTime > 120000) { // 2 minutes
        console.log(`  Resetting job ${job.id.substring(0, 8)}... (processing for ${Math.floor(processingTime / 60000)} minutes)`);
        
        if (job.attempts >= 2) {
          // Max attempts reached, fail it
          await supabase
            .from('job_queue')
            .update({
              status: 'failed',
              error_message: 'OpenAI timeout - prediction generation took too long',
              completed_at: new Date().toISOString()
            })
            .eq('id', job.id);
        } else {
          // Retry with backoff
          await supabase.rpc('fail_job', {
            job_id: job.id,
            error_msg: 'OpenAI timeout - retrying'
          });
        }
      }
    }
  } else {
    console.log('  ✓ No stuck prediction jobs');
  }
  
  // 2. Handle failing earnings_refresh jobs
  console.log('\n2. Checking earnings_refresh jobs...');
  const { data: earningsJobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('job_type', 'earnings_refresh')
    .in('status', ['processing', 'retry']);
  
  if (earningsJobs && earningsJobs.length > 0) {
    console.log(`  Found ${earningsJobs.length} earnings_refresh jobs`);
    console.log('  ⚠️  Earnings refresh appears to have systematic issues');
    
    // Fail all earnings jobs as the service seems broken
    for (const job of earningsJobs) {
      await supabase
        .from('job_queue')
        .update({
          status: 'failed',
          error_message: 'Earnings service unavailable - needs investigation',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);
    }
    console.log('  ✓ Marked all earnings jobs as failed (service issue)');
  }
  
  // 3. Check job type distribution
  console.log('\n3. Job Type Analysis:');
  const { data: jobTypes } = await supabase
    .from('job_queue')
    .select('job_type, status')
    .in('status', ['pending', 'processing', 'retry']);
  
  if (jobTypes) {
    const typeCounts: Record<string, Record<string, number>> = {};
    
    jobTypes.forEach(job => {
      if (!typeCounts[job.job_type]) {
        typeCounts[job.job_type] = { pending: 0, processing: 0, retry: 0 };
      }
      typeCounts[job.job_type][job.status]++;
    });
    
    Object.entries(typeCounts).forEach(([type, counts]) => {
      const total = counts.pending + counts.processing + counts.retry;
      console.log(`  ${type}:`);
      console.log(`    - Pending: ${counts.pending}`);
      console.log(`    - Processing: ${counts.processing}`);
      console.log(`    - Retry: ${counts.retry}`);
      console.log(`    - Total: ${total}`);
    });
  }
  
  // 4. Recommendations
  console.log('\n💡 Recommendations:');
  console.log('  1. generate_predictions jobs need timeout handling for OpenAI calls');
  console.log('  2. earnings_refresh service appears to be down - needs investigation');
  console.log('  3. Consider implementing job-specific timeout settings');
  console.log('  4. Add circuit breaker for external API calls');
  
  // 5. Final stats
  console.log('\n📊 Final Queue State:');
  const { data: finalStats } = await supabase.rpc('get_queue_stats');
  if (finalStats) {
    finalStats.forEach((stat: any) => {
      console.log(`  ${stat.status}: ${stat.count}`);
    });
  }
}

// Run fixes
fixProblematicJobs().then(() => {
  console.log('\n✅ Fixes applied!');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});