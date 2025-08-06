#!/usr/bin/env node

// Monitor transcription progress in real-time
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function monitorTranscription() {
  console.log('🎙️ Monitoring Transcription Progress...\n');
  
  const checkInterval = setInterval(async () => {
    try {
      // 1. Check transcription jobs
      const { data: jobs, error: jobError } = await supabase
        .from('job_queue')
        .select('*')
        .eq('job_type', 'transcribe_audio')
        .order('created_at', { ascending: false })
        .limit(5);

      if (jobError) {
        console.error('Error checking jobs:', jobError);
        return;
      }

      console.clear();
      console.log('🎙️ Transcription Job Status\n');
      console.log(`Time: ${new Date().toLocaleTimeString()}\n`);

      if (!jobs || jobs.length === 0) {
        console.log('No transcription jobs in queue.');
      } else {
        jobs.forEach(job => {
          const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
          const feedId = payload.feedId;
          
          console.log(`Job ID: ${job.id.substring(0, 8)}...`);
          console.log(`Status: ${getStatusEmoji(job.status)} ${job.status.toUpperCase()}`);
          console.log(`Priority: ${job.priority}`);
          console.log(`Attempts: ${job.attempts}/${job.max_attempts}`);
          
          if (job.started_at) {
            const duration = Date.now() - new Date(job.started_at).getTime();
            console.log(`Processing time: ${Math.round(duration / 1000)}s`);
          }
          
          if (job.error_message) {
            console.log(`Error: ${job.error_message}`);
          }
          
          console.log('---');
        });
      }

      // 2. Check recent transcription completions
      const { data: recentFeeds, error: feedError } = await supabase
        .from('raw_feeds')
        .select('id, title, metadata, content, updated_at')
        .not('metadata->transcription', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(3);

      if (!feedError && recentFeeds && recentFeeds.length > 0) {
        console.log('\n📝 Recently Transcribed Episodes:\n');
        
        recentFeeds.forEach(feed => {
          const trans = feed.metadata?.transcription;
          console.log(`✓ ${feed.title?.substring(0, 60)}...`);
          if (trans) {
            console.log(`  Language: ${trans.language || 'unknown'}`);
            console.log(`  Duration: ${trans.duration ? Math.round(trans.duration / 60) + ' min' : 'unknown'}`);
            console.log(`  Processed: ${new Date(trans.processedAt).toLocaleTimeString()}`);
            console.log(`  Content: ${feed.content?.substring(0, 100)}...`);
          }
          console.log('');
        });
      }

      // 3. Show statistics
      const { data: stats, error: statsError } = await supabase
        .from('job_queue')
        .select('status')
        .eq('job_type', 'transcribe_audio')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!statsError && stats) {
        const counts = stats.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {});

        console.log('\n📊 Last 24 Hours Statistics:\n');
        Object.entries(counts).forEach(([status, count]) => {
          console.log(`${getStatusEmoji(status)} ${status}: ${count}`);
        });
      }

      console.log('\n\nPress Ctrl+C to stop monitoring...');

    } catch (error) {
      console.error('Monitor error:', error);
    }
  }, 3000); // Check every 3 seconds

  // Handle exit
  process.on('SIGINT', () => {
    console.log('\n\nStopping monitor...');
    clearInterval(checkInterval);
    process.exit(0);
  });
}

function getStatusEmoji(status) {
  const emojis = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌',
    retry: '🔁'
  };
  return emojis[status] || '❓';
}

// Start monitoring
monitorTranscription();