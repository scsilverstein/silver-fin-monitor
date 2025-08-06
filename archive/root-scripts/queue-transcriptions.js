const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function queueTranscriptions() {
  console.log('🎙️ Queuing transcription jobs for recent episodes...');
  
  // Get episodes with audio that need transcription (content < 5000 chars = likely just description)
  const { data: episodes, error } = await supabase
    .from('raw_feeds')
    .select('id, title, content, metadata')
    .eq('processing_status', 'completed')
    .not('metadata->audioUrl', 'is', null) // Must have audio URL
    .order('created_at', { ascending: false })
    .limit(5); // Start with 5 episodes
    
  if (error) {
    console.error('Error fetching episodes:', error);
    return;
  }
  
  console.log(`Found ${episodes.length} episodes ready for transcription`);
  
  let queuedCount = 0;
  
  for (const episode of episodes) {
    const audioUrl = episode.metadata?.audioUrl || episode.metadata?.audio_url;
    const contentLength = episode.content ? episode.content.length : 0;
    const hasTranscription = episode.metadata?.transcription?.completed;
    
    // Only transcribe if content is short (likely just description) and no transcription yet
    if (audioUrl && contentLength < 5000 && !hasTranscription) {
      // Queue transcription job
      const { data, error } = await supabase.rpc('enqueue_job', {
        job_type: 'podcast_transcription',
        payload: {
          feedId: episode.id,
          audioUrl: audioUrl,
          title: episode.title
        },
        priority: 2 // Medium priority
      });
      
      if (error) {
        console.error(`❌ Error queuing ${episode.title}:`, error);
      } else {
        console.log(`✅ Queued: ${episode.title.substring(0, 60)}...`);
        queuedCount++;
      }
    }
  }
  
  console.log(`🎉 Queued ${queuedCount} transcription jobs!`);
  
  // Show queue status
  const { data: queueStats } = await supabase
    .from('job_queue')
    .select('status')
    .eq('job_type', 'podcast_transcription');
    
  if (queueStats) {
    const statusCounts = queueStats.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📊 Current transcription queue:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const emoji = status === 'pending' ? '⏳' : 
                   status === 'processing' ? '🔄' : 
                   status === 'completed' ? '✅' : 
                   status === 'failed' ? '❌' : '🔶';
      console.log(`  ${emoji} ${status}: ${count}`);
    });
  }
}

queueTranscriptions().catch(console.error);