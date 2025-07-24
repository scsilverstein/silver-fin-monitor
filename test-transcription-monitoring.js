const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTranscriptionMonitoring() {
  console.log('🔍 Testing transcription monitoring...');
  
  try {
    // 1. Check existing transcription jobs
    console.log('\n1. Checking existing transcription jobs...');
    const { data: existingJobs } = await supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'transcribe_audio')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log(`Found ${existingJobs?.length || 0} existing transcription jobs`);
    
    if (existingJobs && existingJobs.length > 0) {
      existingJobs.forEach((job, i) => {
        console.log(`  ${i+1}. Job ${job.id}: ${job.status} (attempts: ${job.attempts})`);
        if (job.payload) {
          console.log(`     Feed ID: ${job.payload.feedId}`);
          console.log(`     Audio URL: ${job.payload.audioUrl?.substring(0, 50)}...`);
        }
      });
    }
    
    // 2. Check feeds that might need transcription
    console.log('\n2. Checking feeds that need transcription...');
    const { data: feedsNeedingTranscription } = await supabase
      .from('raw_feeds')
      .select(`
        id, 
        title, 
        metadata, 
        processing_status,
        feed_sources!inner(name, type)
      `)
      .eq('processing_status', 'pending')
      .eq('feed_sources.type', 'podcast')
      .limit(5);
    
    console.log(`Found ${feedsNeedingTranscription?.length || 0} podcast feeds that might need transcription`);
    
    if (feedsNeedingTranscription && feedsNeedingTranscription.length > 0) {
      feedsNeedingTranscription.forEach((feed, i) => {
        const needsTranscription = feed.metadata?.needsTranscription;
        console.log(`  ${i+1}. ${feed.title} (${feed.feed_sources.name})`);
        console.log(`     Needs transcription: ${needsTranscription ? 'YES' : 'NO'}`);
        console.log(`     Has audio URL: ${feed.metadata?.audioUrl ? 'YES' : 'NO'}`);
      });
    }
    
    // 3. Test the API endpoints
    console.log('\n3. Testing API endpoints...');
    
    // Test dashboard stats
    const statsResponse = await fetch('http://localhost:3001/api/v1/dashboard/stats');
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Dashboard stats endpoint working');
      console.log(`   Queue: ${stats.queue.processing} processing, ${stats.queue.pending} pending`);
      console.log(`   Transcription: ${stats.transcription.processing} processing, ${stats.transcription.pending} pending`);
      console.log(`   Feeds awaiting transcription: ${stats.transcription.feedsAwaitingTranscription}`);
    } else {
      console.log('❌ Dashboard stats endpoint failed');
    }
    
    // Test transcription monitoring endpoint
    const transcriptionResponse = await fetch('http://localhost:3001/api/v1/dashboard/transcription');
    if (transcriptionResponse.ok) {
      const transcriptionData = await transcriptionResponse.json();
      console.log('✅ Transcription monitoring endpoint working');
      console.log(`   Total jobs: ${transcriptionData.summary.totalJobs}`);
      console.log(`   Recent jobs: ${transcriptionData.recentJobs.length}`);
      console.log(`   Feeds needing transcription: ${transcriptionData.feedsNeedingTranscription.length}`);
      console.log(`   Average processing time: ${transcriptionData.summary.averageProcessingTimeMs}ms`);
    } else {
      console.log('❌ Transcription monitoring endpoint failed');
    }
    
    // 4. Create a test transcription job if there are available feeds
    if (feedsNeedingTranscription && feedsNeedingTranscription.length > 0) {
      const testFeed = feedsNeedingTranscription[0];
      
      if (testFeed.metadata?.audioUrl) {
        console.log('\n4. Creating test transcription job...');
        
        const { data: jobId } = await supabase.rpc('enqueue_job', {
          job_type: 'transcribe_audio',
          payload: {
            feedId: testFeed.id,
            audioUrl: testFeed.metadata.audioUrl,
            title: testFeed.title,
            originalMetadata: testFeed.metadata
          },
          priority: 3
        });
        
        if (jobId) {
          console.log(`✅ Created test transcription job: ${jobId}`);
        } else {
          console.log('❌ Failed to create test transcription job');
        }
      } else {
        console.log('\n4. No feeds with audio URLs available for test job creation');
      }
    } else {
      console.log('\n4. No podcast feeds available for test job creation');
    }
    
    console.log('\n✅ Transcription monitoring test completed successfully!');
    console.log('\n📊 You can now view the transcription monitoring in:');
    console.log('   - Dashboard at http://localhost:5177 (System Status card)');
    console.log('   - API endpoint: http://localhost:3001/api/v1/dashboard/transcription');
    console.log('   - Real-time stats: http://localhost:3001/api/v1/dashboard/stats');
    
  } catch (error) {
    console.error('❌ Error testing transcription monitoring:', error);
    process.exit(1);
  }
}

// Run the test
testTranscriptionMonitoring();