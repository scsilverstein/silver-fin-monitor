# Netlify Whisper Integration

## Overview

The Whisper transcription service has been migrated from local Python/Whisper to Netlify Background Functions using OpenAI's Whisper API. This provides better scalability, reliability, and eliminates the need for local Whisper installation.

## Architecture

### Components

1. **Netlify Background Function** (`netlify/functions/transcribe-audio-background.ts`)
   - Runs with 15-minute timeout (vs 10 seconds for regular functions)
   - Downloads audio files
   - Handles chunking for files > 25MB
   - Uses OpenAI Whisper API for transcription
   - Updates database with progress and results

2. **Audio Chunker** (`netlify/functions/utils/audio-chunker.ts`)
   - Smart chunking for large audio files
   - Supports multiple cloud services (Cloudinary, AssemblyAI)
   - Intelligent transcription merging with overlap detection
   - Fallback strategies for different scenarios

3. **Netlify Whisper Service** (`src/services/transcription/netlify-whisper.service.ts`)
   - Triggers background functions
   - Monitors transcription progress
   - Provides status checking and retry capabilities
   - Handles concurrency with cache-based locking

4. **Queue Worker Integration** (`src/services/workers/queue-worker.ts`)
   - Updated to use Netlify service as primary
   - Falls back to local Whisper if available
   - Progress monitoring in background

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Netlify Function URL (auto-detected in production)
SITE_URL=https://your-site.netlify.app

# Optional: Function API Key for additional security
NETLIFY_FUNCTION_API_KEY=your-secret-key

# Cloud services for audio chunking (optional)
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Alternative transcription service (optional)
ASSEMBLYAI_API_KEY=your-assemblyai-key
```

### 2. Deploy to Netlify

1. **Build Command**: `npm run build`
2. **Publish Directory**: `dist`
3. **Functions Directory**: `netlify/functions`

### 3. Test the Integration

```bash
# Test locally with Netlify CLI
netlify dev

# Test background function
curl -X POST http://localhost:9999/.netlify/functions/transcribe-audio-background \
  -H "Content-Type: application/json" \
  -d '{
    "feedId": "test-feed-id",
    "audioUrl": "https://example.com/podcast.mp3"
  }'
```

## API Endpoints

### Transcription Management

```bash
# Get transcription status
GET /api/v1/transcription/status/:feedId

# Get all active transcriptions
GET /api/v1/transcription/active

# Cancel transcription
POST /api/v1/transcription/cancel/:feedId

# Retry failed transcription
POST /api/v1/transcription/retry/:feedId

# Get transcription statistics
GET /api/v1/transcription/stats?days=7

# Check service health
GET /api/v1/transcription/health
```

## How It Works

### 1. Job Queue Triggers Transcription

When a podcast feed is processed:

```javascript
// In queue-worker.ts
await queueService.enqueue('transcribe_audio', {
  feedId: 'feed-uuid',
  audioUrl: 'https://example.com/episode.mp3',
  title: 'Episode Title'
});
```

### 2. Queue Worker Delegates to Netlify

The queue worker:
1. Checks if Netlify service is available
2. Calls `netlifyWhisperService.transcribeAudio()`
3. Monitors progress in background
4. Falls back to local Whisper if needed

### 3. Background Function Processing

The Netlify function:
1. Downloads the audio file with progress tracking
2. Checks file size and format
3. Chunks large files if needed
4. Sends to OpenAI Whisper API
5. Merges transcription results
6. Updates database with transcript
7. Queues content processing job

### 4. Progress Tracking

Progress is tracked in the database:

```javascript
{
  transcription: {
    status: 'downloading' | 'transcribing' | 'processing' | 'completed' | 'failed',
    progress: 75, // percentage
    chunksProcessed: 3,
    totalChunks: 4,
    startedAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:05:00Z',
    processingTimeMs: 300000,
    language: 'en',
    method: 'openai_whisper_api'
  }
}
```

## Monitoring & Debugging

### Check Logs

```bash
# Netlify function logs
netlify functions:logs transcribe-audio-background

# Application logs
tail -f logs/app.log | grep transcription
```

### Common Issues

1. **Function Timeout**
   - Background functions have 15-minute limit
   - Very long audio files may still timeout
   - Solution: Use chunking or external service

2. **File Size Limits**
   - OpenAI API: 25MB per file
   - Solution: Automatic chunking handles this

3. **Rate Limits**
   - OpenAI has rate limits
   - Solution: Queue manages concurrency

4. **Network Errors**
   - Downloads may fail
   - Solution: Automatic retries with exponential backoff

## Performance

### Benchmarks

- **Small files (<10MB)**: ~30 seconds
- **Medium files (10-50MB)**: 1-3 minutes
- **Large files (50-200MB)**: 3-10 minutes

### Optimization Tips

1. **Enable Cloudinary** for better chunking performance
2. **Use caching** to avoid re-transcribing
3. **Monitor queue depth** to prevent backlogs
4. **Set appropriate priorities** for jobs

## Migration from Local Whisper

### Benefits

1. **No local dependencies** - No Python, ffmpeg, or Whisper model needed
2. **Better scalability** - Handles multiple concurrent transcriptions
3. **Lower resource usage** - No GPU/CPU intensive processing
4. **Automatic updates** - Always uses latest Whisper model
5. **Better reliability** - Cloud-based with automatic retries

### Fallback Support

The system still supports local Whisper as a fallback:

```javascript
if (!netlifyServiceAvailable) {
  // Falls back to local Whisper if available
  const localResult = await whisperService.transcribeAudio(audioUrl, feedId);
}
```

## Security Considerations

1. **API Key Protection**
   - OpenAI API key stored as environment variable
   - Optional Netlify function API key for access control

2. **Audio File Access**
   - Temporary downloads only
   - No persistent storage of audio files
   - Progress tracked in database only

3. **Rate Limiting**
   - Built-in concurrency control
   - Cache-based locking prevents duplicates

## Future Enhancements

1. **Multi-language Support**
   - Detect and specify language for better accuracy
   - Support for translation

2. **Speaker Diarization**
   - Identify different speakers
   - Useful for interviews and panels

3. **Real-time Transcription**
   - Stream transcription for live events
   - WebSocket-based updates

4. **Custom Vocabulary**
   - Industry-specific terms
   - Better accuracy for technical content