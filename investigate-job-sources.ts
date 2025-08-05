import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function investigateJobCreation() {
  console.log('🕵️ Deep investigation of job creation patterns...\n');
  
  // Get the most recent 100 jobs with detailed info
  const { data: recentJobs } = await supabase
    .from('job_queue')
    .select('id, job_type, payload, status, created_at, scheduled_at')
    .eq('job_type', 'feed_fetch')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (!recentJobs || recentJobs.length === 0) {
    console.log('No recent jobs found');
    return;
  }
  
  console.log(`📊 Analyzing ${recentJobs.length} most recent jobs...\n`);
  
  // Analyze creation timestamps to find patterns
  const now = Date.now();
  const timeGroups: Record<string, any[]> = {};
  const sourceIdCounts: Record<string, number> = {};
  
  recentJobs.forEach(job => {
    const createdTime = new Date(job.created_at).getTime();
    const secondsAgo = Math.floor((now - createdTime) / 1000);
    let timeKey: string;
    
    if (secondsAgo < 60) {
      timeKey = `${secondsAgo}s ago`;
    } else {
      const minutesAgo = Math.floor(secondsAgo / 60);
      timeKey = `${minutesAgo}min ago`;
    }
    
    if (!timeGroups[timeKey]) timeGroups[timeKey] = [];
    timeGroups[timeKey].push(job);
    
    const sourceId = job.payload?.sourceId;
    if (sourceId) {
      if (!sourceIdCounts[sourceId]) sourceIdCounts[sourceId] = 0;
      sourceIdCounts[sourceId]++;
    }
  });
  
  console.log('⏰ Job creation timeline (most recent first):');
  Object.entries(timeGroups)
    .sort(([a], [b]) => {
      const aVal = parseInt(a);
      const bVal = parseInt(b);
      return aVal - bVal; // Most recent first (smaller numbers)
    })
    .slice(0, 15)
    .forEach(([time, jobs]) => {
      console.log(`  ${time}: ${jobs.length} jobs`);
      if (jobs.length > 3) {
        const sources = [...new Set(jobs.map(j => j.payload?.sourceId?.slice(-8)))];
        console.log(`    Unique sources: ${sources.join(', ')}`);
      }
    });
  
  console.log('\n📊 Source ID frequency:');
  Object.entries(sourceIdCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([sourceId, count]) => {
      console.log(`  ${sourceId.slice(-8)}: ${count} jobs`);
    });
  
  // Check for exact timestamp clusters (indicating batch creation)
  const exactTimeGroups: Record<string, any[]> = {};
  recentJobs.forEach(job => {
    const exactTime = job.created_at;
    if (!exactTimeGroups[exactTime]) exactTimeGroups[exactTime] = [];
    exactTimeGroups[exactTime].push(job);
  });
  
  const batches = Object.entries(exactTimeGroups).filter(([, jobs]) => jobs.length > 1);
  if (batches.length > 0) {
    console.log('\n🔍 Batch creation detected (same exact timestamp):');
    batches.slice(0, 8).forEach(([timestamp, jobs]) => {
      console.log(`  ${timestamp}: ${jobs.length} jobs created simultaneously`);
      const sources = jobs.map(j => j.payload?.sourceId?.slice(-8));
      console.log(`    Sources: ${sources.join(', ')}`);
    });
  }
  
  // Check for very recent jobs (last 2 minutes)
  const twoMinutesAgo = new Date(now - 2 * 60 * 1000).toISOString();
  const veryRecentJobs = recentJobs.filter(job => job.created_at > twoMinutesAgo);
  
  if (veryRecentJobs.length > 0) {
    console.log(`\n🚨 ${veryRecentJobs.length} jobs created in last 2 minutes!`);
    console.log('Most recent job details:');
    veryRecentJobs.slice(0, 10).forEach(job => {
      const timestamp = new Date(job.created_at);
      const secondsAgo = Math.floor((now - timestamp.getTime()) / 1000);
      console.log(`  ${job.id}: ${job.payload?.sourceId?.slice(-8)} (${secondsAgo}s ago)`);
    });
  }
  
  // Check for patterns in creation intervals
  console.log('\n⚡ Analyzing creation intervals...');
  const intervals: number[] = [];
  for (let i = 0; i < recentJobs.length - 1; i++) {
    const current = new Date(recentJobs[i].created_at).getTime();
    const next = new Date(recentJobs[i + 1].created_at).getTime();
    const interval = (current - next) / 1000; // seconds
    if (interval < 300) { // Only look at intervals less than 5 minutes
      intervals.push(interval);
    }
  }
  
  if (intervals.length > 0) {
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const commonIntervals = intervals.filter(i => i < 10); // Very frequent creation
    console.log(`  Average interval: ${avgInterval.toFixed(1)}s`);
    console.log(`  Intervals < 10s: ${commonIntervals.length}/${intervals.length}`);
    
    if (commonIntervals.length > intervals.length * 0.5) {
      console.log('  🚨 HIGH FREQUENCY CREATION DETECTED - jobs being created every few seconds!');
    }
  }
}

investigateJobCreation().catch(console.error);