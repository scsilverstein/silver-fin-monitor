import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate jobs after Netlify deployment fix...\n');
  
  // Check for duplicates by job type and payload
  const { data: allJobs } = await supabase
    .from('job_queue')
    .select('id, job_type, payload, status, created_at')
    .eq('job_type', 'feed_fetch')
    .in('status', ['pending', 'processing', 'retry'])
    .order('created_at', { ascending: true });
  
  if (!allJobs || allJobs.length === 0) {
    console.log('✅ No feed_fetch jobs found in queue');
    return;
  }
  
  console.log(`📊 Total feed_fetch jobs: ${allJobs.length}`);
  
  // Group by sourceId to see duplicates
  const sourceGroups: Record<string, any[]> = {};
  
  allJobs.forEach(job => {
    const sourceId = job.payload?.sourceId;
    if (sourceId) {
      if (!sourceGroups[sourceId]) sourceGroups[sourceId] = [];
      sourceGroups[sourceId].push(job);
    }
  });
  
  const duplicateSources = Object.entries(sourceGroups).filter(([, jobs]) => jobs.length > 1);
  
  if (duplicateSources.length > 0) {
    console.log(`\n❌ Found duplicates for ${duplicateSources.length} sources:`);
    duplicateSources.slice(0, 10).forEach(([sourceId, jobs]) => {
      console.log(`  Source ${sourceId.slice(-8)}: ${jobs.length} jobs`);
      jobs.forEach(job => {
        console.log(`    - ${job.id} (${job.status}) - ${job.created_at}`);
      });
    });
    
    // Clean up duplicates - keep only the oldest job for each source
    console.log('\n🧹 Cleaning up duplicates...');
    let cleanedCount = 0;
    
    for (const [sourceId, jobs] of duplicateSources) {
      if (jobs.length > 1) {
        // Keep the oldest job, delete the rest
        const toKeep = jobs[0]; // Already sorted by created_at ascending
        const toDelete = jobs.slice(1);
        
        console.log(`  Keeping job ${toKeep.id} for source ${sourceId.slice(-8)}`);
        console.log(`  Deleting ${toDelete.length} duplicates`);
        
        const { error } = await supabase
          .from('job_queue')
          .delete()
          .in('id', toDelete.map(j => j.id));
        
        if (!error) {
          cleanedCount += toDelete.length;
          console.log(`  ✅ Cleaned ${toDelete.length} duplicates for source ${sourceId.slice(-8)}`);
        } else {
          console.error(`  ❌ Error cleaning duplicates:`, error);
        }
      }
    }
    
    console.log(`\n✅ Cleaned up ${cleanedCount} duplicate jobs`);
  } else {
    console.log('✅ No duplicates found!');
  }
  
  // Final status check
  const { data: finalStatus } = await supabase
    .from('job_queue')
    .select('job_type, status, count(*)')
    .in('status', ['pending', 'processing', 'retry'])
    .order('job_type', { ascending: true })
    .order('status', { ascending: true });
  
  console.log('\n📊 Final queue status:');
  if (finalStatus) {
    finalStatus.forEach(row => {
      console.log(`  ${row.job_type} (${row.status}): ${row.count}`);
    });
  }
  
  // Check if new jobs are still being created
  console.log('\n⏱️ Checking if new jobs are still being created...');
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: recentJobs } = await supabase
    .from('job_queue')
    .select('id, job_type, created_at')
    .eq('job_type', 'feed_fetch')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });
  
  if (recentJobs && recentJobs.length > 0) {
    console.log(`⚠️ ${recentJobs.length} new jobs created in last 5 minutes:`);
    recentJobs.slice(0, 5).forEach(job => {
      console.log(`  - ${job.id} created at ${job.created_at}`);
    });
  } else {
    console.log('✅ No new jobs created in last 5 minutes - fix appears to be working!');
  }
}

checkDuplicates().catch(console.error);