# Whisper Transcription for Silver Fin Monitor

This document describes the local Whisper transcription implementation for podcast processing on Mac M1.

## Overview

Silver Fin Monitor now includes local audio transcription using OpenAI's Whisper model, optimized for Apple Silicon (M1/M2) Macs. This enables automatic transcription of podcast episodes to extract valuable market insights from audio content.

## Features

- **Local Processing**: All transcription happens on your Mac, no external API calls
- **M1 Optimized**: Uses Metal Performance Shaders (MPS) for GPU acceleration
- **Automatic Queue Integration**: Seamlessly integrates with the existing job queue
- **Smart Caching**: Transcripts are cached to avoid re-processing
- **Multiple Model Sizes**: Choose from tiny to large models based on accuracy needs
- **Language Detection**: Automatically detects the spoken language
- **Progress Tracking**: Real-time updates on transcription progress

## Installation

### Prerequisites

- Mac with Apple Silicon (M1/M2)
- Python 3.8 or later
- Homebrew package manager
- At least 8GB RAM (16GB recommended)
- 5-10GB free disk space for models

### Setup

1. **Run the setup script**:
   ```bash
   ./scripts/setup-whisper-m1.sh
   ```

   This script will:
   - Install Python dependencies
   - Install ffmpeg for audio processing
   - Download the Whisper base model
   - Create necessary directories
   - Test the installation

2. **Configure environment variables** in `.env`:
   ```env
   # Whisper Configuration
   WHISPER_MODEL_SIZE=base
   WHISPER_DEVICE=mps
   WHISPER_COMPUTE_TYPE=float16
   ```

3. **Test the installation**:
   ```bash
   ./test-whisper.py sample-audio.mp3
   ```

## Configuration

### Model Selection

| Model | Size | Speed | Accuracy | RAM Usage | Recommended For |
|-------|------|-------|----------|-----------|-----------------|
| tiny | 39M | ~32x | Basic | ~1GB | Quick tests |
| base | 74M | ~16x | Good | ~1GB | **Most podcasts** |
| small | 244M | ~6x | Better | ~2GB | Higher accuracy |
| medium | 769M | ~2x | High | ~5GB | Professional use |
| large | 1550M | ~1x | Best | ~10GB | Maximum accuracy |

### Configuration Options

Edit `src/config/whisper.config.ts` or set environment variables:

```typescript
{
  // Model settings
  modelSize: 'base',              // Model to use
  device: 'mps',                  // Use GPU acceleration
  computeType: 'float16',         // Optimal for M1
  
  // Transcription settings
  language: null,                 // Auto-detect
  temperature: 0.0,               // Deterministic output
  initialPrompt: 'Financial podcast...', // Context hint
  
  // Performance
  maxConcurrentJobs: 2,           // Parallel transcriptions
  chunkDuration: 1800,            // 30-minute chunks
}
```

## Usage

### Automatic Processing

When podcast feeds are processed, audio files are automatically queued for transcription:

1. Podcast processor detects audio URL
2. Creates transcription job in queue
3. Worker picks up job and transcribes
4. Transcript is saved to database
5. Content is processed for insights

### Manual Transcription

You can manually transcribe audio files:

```typescript
import { whisperService } from '@/services/transcription/whisper.service';

// Transcribe a podcast episode
const result = await whisperService.transcribeAudio(
  'https://example.com/podcast.mp3',
  'feed-id-123'
);

console.log('Transcript:', result.text);
console.log('Language:', result.language);
console.log('Duration:', result.duration);
```

### Queue Status

Monitor transcription jobs:

```bash
# Check queue status
curl http://localhost:3001/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# View transcription jobs
SELECT * FROM job_queue 
WHERE job_type = 'transcribe_audio' 
ORDER BY created_at DESC;
```

## Performance

### Processing Times (M1 Base Model)

- 30-minute podcast: ~2 minutes
- 60-minute podcast: ~4 minutes
- With MPS acceleration: ~16x real-time

### Optimization Tips

1. **Use MPS acceleration**: Ensure `WHISPER_DEVICE=mps`
2. **Choose appropriate model**: Base model is usually sufficient
3. **Process during off-hours**: Schedule heavy transcription
4. **Monitor memory**: Large models need significant RAM
5. **Chunk long audio**: Process in 30-minute segments

## Troubleshooting

### Common Issues

1. **"Python not found"**
   ```bash
   brew install python@3.11
   ```

2. **"Whisper not installed"**
   ```bash
   pip3 install --upgrade openai-whisper
   ```

3. **"MPS not available"**
   - Update macOS to latest version
   - Install latest PyTorch: `pip3 install --upgrade torch`

4. **"Out of memory"**
   - Use smaller model: `WHISPER_MODEL_SIZE=tiny`
   - Reduce concurrent jobs: `WHISPER_MAX_CONCURRENT_JOBS=1`

5. **"Audio download failed"**
   - Check URL accessibility
   - Verify ffmpeg installed: `brew install ffmpeg`

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
WHISPER_VERBOSE=true
```

Check logs:
```bash
tail -f logs/transcription.log
```

## Database Schema

Transcription data is stored in existing tables:

```sql
-- Transcription metadata in raw_feeds
UPDATE raw_feeds SET
  content = 'Full transcript text...',
  metadata = jsonb_set(
    metadata,
    '{transcription}',
    '{
      "completed": true,
      "language": "en",
      "duration": 1800,
      "processedAt": "2024-01-20T..."
    }'::jsonb
  );

-- Cached transcripts
INSERT INTO cache_store (key, value, expires_at)
VALUES (
  'transcript:feed-id',
  '{"text": "...", "language": "en"}',
  NOW() + INTERVAL '7 days'
);
```

## API Endpoints

### Check Transcription Status

```bash
GET /api/feeds/:feedId
```

Response includes transcription status:
```json
{
  "id": "feed-123",
  "metadata": {
    "transcription": {
      "completed": true,
      "language": "en",
      "duration": 1800
    }
  }
}
```

### Retry Failed Transcription

```bash
POST /api/feeds/:feedId/transcribe
Authorization: Bearer YOUR_TOKEN
```

## Best Practices

1. **Model Selection**
   - Start with 'base' model
   - Upgrade to 'small' or 'medium' only if needed
   - Use 'tiny' for testing only

2. **Resource Management**
   - Process during low-usage hours
   - Limit concurrent transcriptions
   - Monitor disk space for temp files

3. **Quality Assurance**
   - Review sample transcripts
   - Adjust initial prompt for context
   - Consider language-specific models

4. **Error Handling**
   - Implement retry logic
   - Set reasonable timeouts
   - Clean up temp files

## Security Considerations

- Audio files are downloaded to local temp directory
- Transcripts may contain sensitive information
- Temp files are automatically cleaned up
- No data sent to external services

## Future Enhancements

- [ ] Speaker diarization (identify different speakers)
- [ ] Real-time transcription for live podcasts
- [ ] Custom vocabulary for financial terms
- [ ] Subtitle generation (SRT/VTT)
- [ ] Multi-language translation
- [ ] Sentiment analysis on segments

## Support

For issues or questions:

1. Check the troubleshooting guide above
2. Review logs in `logs/transcription.log`
3. Ensure all dependencies are installed
4. Verify audio format is supported

## License

The Whisper model is released under MIT license by OpenAI.
Silver Fin Monitor implementation follows the project's license.