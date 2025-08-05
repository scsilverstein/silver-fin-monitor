import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_ANON_KEY as string
);

async function testConcurrentProcessing() {
  try {
    console.log('🧪 Testing concurrent queue processing...\n');
    
    // Check current queue status
    const { data: queueStatus, error } = await supabase
      .from('job_queue')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error fetching queue status:', error);
      return;
    }
    
    const statusCounts = queueStatus?.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log('📊 Current Queue Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Add some test jobs to demonstrate concurrency
    console.log('\n➕ Adding test jobs to queue...');
    
    const testJobs = [
      { type: 'feed_fetch', payload: { sourceId: 'test-1', test: true } },
      { type: 'feed_fetch', payload: { sourceId: 'test-2', test: true } },
      { type: 'feed_fetch', payload: { sourceId: 'test-3', test: true } },
      { type: 'content_process', payload: { rawFeedId: 'test-content-1', test: true } },
      { type: 'content_process', payload: { rawFeedId: 'test-content-2', test: true } }
    ];
    
    for (const job of testJobs) {
      const result = await supabase.rpc('enqueue_job', {
        job_type: job.type,
        payload: JSON.stringify(job.payload),
        priority: 5
      });
      
      if (result.error) {
        console.error('Error enqueueing job:', result.error);
      } else {
        console.log(`✅ Enqueued ${job.type} job`);
      }
    }
    
    console.log('\n⏱️  Wait 10 seconds to see concurrent processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check processing jobs to see concurrency in action
    const { data: processingJobs, error: procError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'processing')
      .order('started_at', { ascending: false });
    
    if (procError) {
      console.error('Error fetching processing jobs:', procError);
      return;
    }
    
    console.log('\n🔄 Currently Processing Jobs:');
    if (processingJobs && processingJobs.length > 0) {
      processingJobs.forEach(job => {
        const startTime = new Date(job.started_at);
        const now = new Date();
        const duration = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        console.log(`  - ${job.job_type} (${job.id.substring(0, 8)}...) - Running for ${duration}s`);
      });
      
      if (processingJobs.length > 1) {
        console.log(`\n🎉 SUCCESS: ${processingJobs.length} jobs processing concurrently!`);
      } else {
        console.log('\n⚠️  Only 1 job processing - may not be concurrent yet');
      }
    } else {
      console.log('  No jobs currently processing');
    }
    
    // Check recent completions
    const { data: recentJobs, error: recentError } = await supabase
      .from('job_queue')  
      .select('*')
      .in('status', ['completed', 'failed'])
      .order('completed_at', { ascending: false })
      .limit(10);
    
    if (!recentError && recentJobs) {
      console.log('\n📋 Recent Job Completions:');
      recentJobs.forEach(job => {
        const status = job.status === 'completed' ? '✅' : '❌';
        const completedAt = new Date(job.completed_at).toLocaleTimeString();
        console.log(`  ${status} ${job.job_type} completed at ${completedAt}`);
      });
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testConcurrentProcessing();