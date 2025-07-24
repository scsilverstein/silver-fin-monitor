#!/usr/bin/env node

// Test script to verify podcast processing with Whisper transcription
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testPodcastWithWhisper() {
  try {
    console.log('🎙️ Testing Podcast Processing with Whisper Transcription\n');

    // 1. Get a podcast feed source
    console.log('1. Finding podcast feed sources...');
    const { data: feedSources, error: feedError } = await supabase
      .from('feed_sources')
      .select('*')
      .eq('type', 'podcast')
      .eq('is_active', true)
      .limit(3);

    if (feedError || !feedSources || feedSources.length === 0) {
      console.error('❌ No active podcast feeds found');
      return;
    }

    console.log(`✓ Found ${feedSources.length} podcast feeds:`);
    feedSources.forEach(feed => {
      console.log(`  - ${feed.name} (${feed.id})`);
    });

    // 2. Get recent raw feeds from podcasts
    console.log('\n2. Checking for recent podcast episodes...');
    const { data: rawFeeds, error: rawError } = await supabase
      .from('raw_feeds')
      .select(`
        id,
        title,
        metadata,
        content,
        processing_status,
        created_at,
        feed_sources!inner(name, type)
      `)
      .eq('feed_sources.type', 'podcast')
      .order('created_at', { ascending: false })
      .limit(5);

    if (rawError) {
      console.error('❌ Error fetching raw feeds:', rawError);
      return;
    }

    if (!rawFeeds || rawFeeds.length === 0) {
      console.log('❌ No podcast episodes found. Let\'s fetch some...');
      
      // Queue a feed fetch job
      const feedId = feedSources[0].id;
      console.log(`\n3. Queueing feed fetch for: ${feedSources[0].name}`);
      
      const { error: queueError } = await supabase
        .rpc('enqueue_job', {
          job_type: 'feed_fetch',
          payload: { sourceId: feedId },
          priority: 1
        });

      if (queueError) {
        console.error('❌ Failed to queue feed fetch:', queueError);
        return;
      }

      console.log('✓ Feed fetch job queued. Wait a moment for processing...');
      console.log('  Run this script again in 30 seconds to check results.');
      return;
    }

    console.log(`✓ Found ${rawFeeds.length} podcast episodes`);
    
    // 3. Check transcription status
    console.log('\n3. Checking transcription status...');
    let needsTranscription = [];
    let hasTranscript = [];
    let inProgress = [];

    rawFeeds.forEach(feed => {
      const hasAudioUrl = feed.metadata?.audioUrl || feed.metadata?.audio_url;
      const hasTranscriptContent = feed.content && feed.content.length > 500;
      const transcriptionMetadata = feed.metadata?.transcription;
      
      console.log(`\n  📎 ${feed.title || 'Untitled'}`);
      console.log(`     Source: ${feed.feed_sources?.name}`);
      console.log(`     Status: ${feed.processing_status}`);
      console.log(`     Audio URL: ${hasAudioUrl ? '✓' : '✗'}`);
      console.log(`     Content length: ${feed.content?.length || 0} chars`);
      
      if (transcriptionMetadata) {
        console.log(`     Transcription: ✓ Completed`);
        console.log(`       - Language: ${transcriptionMetadata.language || 'unknown'}`);
        console.log(`       - Duration: ${transcriptionMetadata.duration || 0}s`);
        hasTranscript.push(feed);
      } else if (hasAudioUrl && !hasTranscriptContent) {
        console.log(`     Transcription: ✗ Needed`);
        needsTranscription.push(feed);
      } else if (feed.processing_status === 'processing') {
        console.log(`     Transcription: ⏳ In Progress`);
        inProgress.push(feed);
      }
    });

    // 4. Queue transcription for episodes that need it
    if (needsTranscription.length > 0) {
      console.log(`\n4. Queueing transcription for ${needsTranscription.length} episodes...`);
      
      // Take only the first one for testing
      const episode = needsTranscription[0];
      const audioUrl = episode.metadata?.audioUrl || episode.metadata?.audio_url;
      
      console.log(`\n  Queueing: ${episode.title}`);
      console.log(`  Audio URL: ${audioUrl}`);
      
      const { error: transcribeError } = await supabase
        .rpc('enqueue_job', {
          job_type: 'transcribe_audio',
          payload: {
            feedId: episode.id,
            audioUrl: audioUrl
          },
          priority: 2
        });

      if (transcribeError) {
        console.error('❌ Failed to queue transcription:', transcribeError);
      } else {
        console.log('✓ Transcription job queued successfully!');
        console.log('\n  The transcription will run in the background.');
        console.log('  Check the job queue and logs for progress.');
      }
    }

    // 5. Check job queue status
    console.log('\n5. Checking job queue status...');
    const { data: jobs, error: jobError } = await supabase
      .from('job_queue')
      .select('*')
      .in('job_type', ['transcribe_audio', 'feed_fetch', 'content_process'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (!jobError && jobs) {
      console.log(`\n  Recent jobs in queue:`);
      jobs.forEach(job => {
        const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
        console.log(`  - ${job.job_type} | ${job.status} | Priority: ${job.priority}`);
        if (job.job_type === 'transcribe_audio' && payload.feedId) {
          console.log(`    Feed ID: ${payload.feedId.substring(0, 8)}...`);
        }
        if (job.error_message) {
          console.log(`    Error: ${job.error_message}`);
        }
      });
    }

    // 6. Show a successfully transcribed example if available
    if (hasTranscript.length > 0) {
      console.log('\n6. Example of successfully transcribed episode:');
      const example = hasTranscript[0];
      console.log(`\n  Title: ${example.title}`);
      console.log(`  Transcript preview: ${example.content.substring(0, 200)}...`);
    }

    // 7. Instructions for monitoring
    console.log('\n📋 Next Steps:');
    console.log('1. Check if the Whisper service is running:');
    console.log('   - The queue worker should pick up transcription jobs');
    console.log('   - Watch the logs for transcription progress');
    console.log('\n2. Monitor transcription progress:');
    console.log('   - Transcription typically takes 2-5 minutes per episode');
    console.log('   - Check logs: tail -f logs/*.log');
    console.log('\n3. Verify results:');
    console.log('   - Run this script again to see completed transcriptions');
    console.log('   - Check the database for updated content');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPodcastWithWhisper();