#!/usr/bin/env ts-node

// Direct test of Whisper service
import { whisperService } from './src/services/transcription/whisper.service';
import { supabase } from './src/services/database/client';

async function testWhisperDirect() {
  console.log('🎙️ Direct Whisper Service Test\n');

  try {
    // 1. Check if Whisper is available
    console.log('1. Checking Whisper availability...');
    const isAvailable = await whisperService.isAvailable();
    
    if (!isAvailable) {
      console.error('❌ Whisper service is not available!');
      console.log('\nPlease run: npm run whisper:setup');
      return;
    }
    
    console.log('✓ Whisper service is available\n');

    // 2. Get a podcast episode with audio URL
    console.log('2. Finding a podcast episode to test...');
    const { data: episode, error } = await supabase
      .from('raw_feeds')
      .select('*')
      .not('metadata->audioUrl', 'is', null)
      .eq('processing_status', 'completed')
      .limit(1)
      .single();

    if (error || !episode) {
      console.error('❌ No podcast episode with audio URL found');
      return;
    }

    const audioUrl = episode.metadata?.audioUrl || episode.metadata?.audio_url;
    console.log(`✓ Found episode: ${episode.title}`);
    console.log(`  Audio URL: ${audioUrl}\n`);

    // 3. Test transcription
    console.log('3. Starting transcription (this may take 2-5 minutes)...');
    console.log('   Note: First run will download the model if needed.\n');
    
    const startTime = Date.now();
    
    try {
      const result = await whisperService.transcribeAudio(audioUrl, episode.id);
      
      const duration = (Date.now() - startTime) / 1000;
      
      console.log('\n✅ Transcription completed successfully!');
      console.log(`   Processing time: ${duration.toFixed(1)} seconds`);
      console.log(`   Language detected: ${result.language || 'unknown'}`);
      console.log(`   Audio duration: ${result.duration ? Math.round(result.duration) + ' seconds' : 'unknown'}`);
      console.log(`   Transcript length: ${result.text.length} characters`);
      console.log(`   Segments: ${result.segments?.length || 0}`);
      
      console.log('\n📝 Transcript preview:');
      console.log('---');
      console.log(result.text.substring(0, 500) + '...');
      console.log('---');

      // 4. Check if it was saved to database
      const { data: updatedEpisode } = await supabase
        .from('raw_feeds')
        .select('content, metadata')
        .eq('id', episode.id)
        .single();

      if (updatedEpisode?.metadata?.transcription) {
        console.log('\n✓ Transcript saved to database');
      }

    } catch (error) {
      console.error('\n❌ Transcription failed:', error);
      console.log('\nTroubleshooting:');
      console.log('1. Check Python is installed: python3 --version');
      console.log('2. Check Whisper is installed: python3 -c "import whisper"');
      console.log('3. Check ffmpeg is installed: ffmpeg -version');
      console.log('4. Run setup if needed: npm run whisper:setup');
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testWhisperDirect().then(() => process.exit(0));