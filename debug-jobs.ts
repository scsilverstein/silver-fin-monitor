#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pnjtzwqieqcrchhjouaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI'
);

async function debugJobs() {
  console.log('=== JOB QUEUE DEBUGGING ===\n');
  
  // 1. Check total count
  const { count: totalCount } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total jobs in database: ${totalCount}\n`);
  
  // 2. Check status distribution
  const { data: statusCounts } = await supabase
    .rpc('get_job_status_counts');
  
  if (statusCounts) {
    console.log('Status distribution:');
    statusCounts.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });
    console.log();
  }
  
  // 3. Fallback raw query if RPC doesn't exist
  const { data: rawStatusData } = await supabase
    .from('job_queue')
    .select('status')
    .limit(1000);
  
  if (rawStatusData) {
    const statusMap = rawStatusData.reduce((acc: any, job: any) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Raw status distribution (first 1000 jobs):');
    Object.entries(statusMap).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log();
  }
  
  // 4. Check recent jobs
  const { data: recentJobs } = await supabase
    .from('job_queue')
    .select('job_type, status, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Recent 10 jobs:');
  recentJobs?.forEach((job, i) => {
    console.log(`  ${i + 1}. ${job.job_type} - ${job.status} - ${job.created_at}`);
  });
}

debugJobs().catch(console.error);