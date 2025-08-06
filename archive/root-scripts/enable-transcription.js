const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function enableTranscription() {
  console.log('🎙️ Enabling automatic transcription for all podcast feeds...');
  
  // Get all active podcast feeds
  const { data: feeds, error } = await supabase
    .from('feed_sources')
    .select('id, name, config, type')
    .eq('type', 'podcast')
    .eq('is_active', true);
  
  if (error) {
    console.error('Error fetching feeds:', error);
    return;
  }
  
  console.log(`Found ${feeds.length} active podcast feeds`);
  
  // Enable transcription for all podcast feeds
  for (const feed of feeds) {
    const updatedConfig = {
      ...feed.config,
      processTranscript: true,
      process_transcript: true,  // Alternative key format
      extractGuests: true,
      transcriptSource: 'whisper_local',
      priority: 'medium',
      update_frequency: 'hourly',
      categories: feed.config?.categories || ['finance', 'business', 'economics']
    };
    
    const { error: updateError } = await supabase
      .from('feed_sources')
      .update({ config: updatedConfig })
      .eq('id', feed.id);
    
    if (updateError) {
      console.error(`❌ Error updating ${feed.name}:`, updateError);
    } else {
      console.log(`✅ Enabled transcription for: ${feed.name}`);
    }
  }
  
  console.log('🎉 Transcription enabled for all podcast feeds!');
  
  // Show the updated configuration
  const { data: updatedFeeds } = await supabase
    .from('feed_sources')
    .select('name, config')
    .eq('type', 'podcast')
    .eq('is_active', true);
    
  console.log('\n📻 Podcast feeds with transcription enabled:');
  updatedFeeds.forEach(feed => {
    const hasTranscript = feed.config?.processTranscript || feed.config?.process_transcript;
    console.log(`  ${hasTranscript ? '🎤' : '📻'} ${feed.name}`);
  });
}

enableTranscription().catch(console.error);