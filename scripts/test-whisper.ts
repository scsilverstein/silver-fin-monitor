#!/usr/bin/env npx tsx

import { whisperService } from '../src/services/transcription/whisper.service';
import { logger } from '../src/utils/logger';

async function testWhisper() {
  console.log('Testing Whisper service initialization...\n');
  
  try {
    // Test if Whisper is available
    console.log('1. Checking if Whisper service is available...');
    const isAvailable = await whisperService.isAvailable();
    console.log(`   ✅ Whisper service available: ${isAvailable}\n`);
    
    if (!isAvailable) {
      console.error('   ❌ Whisper service is not available. Please install dependencies.\n');
      return;
    }
    
    // Get supported formats
    console.log('2. Checking supported audio formats...');
    const formats = whisperService.getSupportedFormats();
    console.log(`   ✅ Supported formats: ${formats.join(', ')}\n`);
    
    // Test with a small sample (if provided)
    const testAudioUrl = process.argv[2];
    if (testAudioUrl) {
      console.log('3. Testing transcription with provided audio URL...');
      console.log(`   Audio URL: ${testAudioUrl}`);
      console.log('   This may take a few minutes...\n');
      
      const startTime = Date.now();
      const result = await whisperService.transcribeAudio(testAudioUrl);
      const duration = (Date.now() - startTime) / 1000;
      
      console.log('   ✅ Transcription completed!');
      console.log(`   - Processing time: ${duration.toFixed(2)} seconds`);
      console.log(`   - Text length: ${result.text.length} characters`);
      console.log(`   - Language: ${result.language || 'auto-detected'}`);
      console.log(`   - First 200 chars: ${result.text.substring(0, 200)}...`);
    } else {
      console.log('\n💡 Tip: You can test transcription by providing an audio URL:');
      console.log('   npm run test:whisper <audio-url>');
    }
    
    console.log('\n✅ All tests passed! Whisper is properly configured.');
    
  } catch (error) {
    console.error('\n❌ Whisper test failed:', error);
    console.error('\nTroubleshooting steps:');
    console.error('1. Ensure Python 3 is installed: python3 --version');
    console.error('2. Install Whisper: pip3 install openai-whisper');
    console.error('3. For M1 Macs, install MLX: pip3 install mlx-whisper');
    console.error('4. Check the WHISPER_* environment variables in .env');
  }
}

// Run the test
testWhisper().catch(console.error);