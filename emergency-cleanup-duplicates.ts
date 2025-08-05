import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function emergencyCleanup() {
  console.log('🚨 Emergency cleanup - removing ALL duplicate jobs...\n');
  
  // Get all pending feed_fetch jobs
  const { data: allJobs } = await supabase
    .from('job_queue')
    .select('id, payload, created_at')
    .eq('job_type', 'feed_fetch')
    .in('status', ['pending', 'processing', 'retry'])
    .order('created_at', { ascending: true });
  
  if (!allJobs || allJobs.length === 0) {
    console.log('✅ No jobs to clean up');
    return;
  }
  
  console.log(`📊 Found ${allJobs.length} total feed_fetch jobs`);
  
  // Group by sourceId
  const sourceGroups: Record<string, any[]> = {};
  
  allJobs.forEach(job => {
    const sourceId = job.payload?.sourceId;
    if (sourceId) {
      if (!sourceGroups[sourceId]) sourceGroups[sourceId] = [];
      sourceGroups[sourceId].push(job);
    }
  });
  
  const totalSources = Object.keys(sourceGroups).length;
  console.log(`📊 Jobs across ${totalSources} sources`);
  
  // Find duplicates and clean them up
  let totalCleaned = 0;
  
  for (const [sourceId, jobs] of Object.entries(sourceGroups)) {
    if (jobs.length > 1) {
      // Keep only the oldest job, delete all others
      const toKeep = jobs[0]; // Already sorted by created_at ascending
      const toDelete = jobs.slice(1);
      
      console.log(`🧹 Source ${sourceId.slice(-8)}: keeping 1, deleting ${toDelete.length}`);
      
      // Delete in batches to avoid timeouts
      const batchSize = 50;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const { error } = await supabase
          .from('job_queue')
          .delete()
          .in('id', batch.map(j => j.id));
        
        if (error) {
          console.error(`❌ Error deleting batch:`, error);
        } else {
          totalCleaned += batch.length;
          console.log(`  ✅ Deleted batch of ${batch.length} jobs`);
        }
      }
    }
  }
  
  console.log(`\n✅ Emergency cleanup complete: deleted ${totalCleaned} duplicate jobs`);
  
  // Final count
  const { data: finalCount } = await supabase
    .from('job_queue')
    .select('count', { count: 'exact' })
    .eq('job_type', 'feed_fetch')
    .in('status', ['pending', 'processing', 'retry']);
  
  console.log(`📊 Remaining feed_fetch jobs: ${finalCount?.[0]?.count || 0}`);
}

emergencyCleanup().catch(console.error);