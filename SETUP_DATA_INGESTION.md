# Silver Fin Monitor - Data Ingestion Setup Guide

## Overview
This guide will help you set up and verify that all data ingestion is working perfectly in your Silver Fin Monitor system.

## Prerequisites
- Backend server running (`npm run dev`)
- Supabase project configured
- Environment variables set in `.env`

## Step 1: Initial Setup

First, run the data ingestion setup script to initialize feed sources and create initial jobs:

```bash
npm run ingest:setup
```

This will:
- ✅ Verify database connection
- ✅ Add 10+ feed sources (podcasts, RSS feeds)
- ✅ Create initial processing jobs
- ✅ Queue a daily analysis job

## Step 2: Start the Backend Server

Make sure the backend server is running with the queue worker enabled:

```bash
npm run dev
```

You should see in the logs:
```
✅ Queue worker started
```

## Step 3: Monitor Data Ingestion

In a new terminal, monitor the ingestion progress:

```bash
npm run ingest:monitor
```

This shows real-time status of:
- Feed sources (total, active, by type)
- Job queue (pending, processing, completed, failed)
- Content (raw feeds, processed content, today's count)
- Analysis (daily analyses, predictions)

## Step 4: Trigger Manual Processing (Optional)

If jobs aren't processing automatically, you can trigger them manually:

```bash
# Process next job in queue
npm run ingest:trigger next

# Create a test feed entry
npm run ingest:trigger test

# Trigger daily analysis
npm run ingest:trigger analysis

# Process all pending jobs
npm run ingest:trigger all
```

## Step 5: Verify Data Flow

### Check Backend API
```bash
# Check feed sources
curl http://localhost:3001/api/v1/feeds

# Check processed content
curl http://localhost:3001/api/v1/content

# Check latest analysis
curl http://localhost:3001/api/v1/analysis/latest
```

### Check Frontend
Visit http://localhost:9999 and verify:
- Dashboard shows real data (not mock data)
- Market sentiment is displayed
- Predictions are shown
- Feed sources are listed

## Expected Timeline

1. **Immediate (0-5 minutes)**
   - Feed sources created in database
   - Jobs queued for processing

2. **Short term (5-15 minutes)**
   - RSS feeds fetched and processed
   - Initial content processed
   - Sentiment analysis completed

3. **Medium term (15-30 minutes)**
   - Podcast metadata fetched
   - Audio transcription queued (if Whisper is set up)
   - More content processed

4. **Longer term (30+ minutes)**
   - Daily analysis generated
   - Predictions created
   - Full data available in dashboard

## Troubleshooting

### No Jobs Processing
1. Check backend server is running: `npm run dev`
2. Check queue worker started in logs
3. Manually trigger: `npm run ingest:trigger next`

### Database Connection Issues
1. Verify `.env` has correct Supabase credentials
2. Check Supabase project is active
3. Test connection: `npm run ingest:status`

### Feed Processing Errors
1. Check logs: `tail -f logs/*.log`
2. Look for rate limiting or API errors
3. Some feeds may be temporarily unavailable

### No Data in Frontend
1. Ensure backend is running on port 3001
2. Check Netlify dev is proxying correctly
3. Verify API endpoints return data (not mock)

## Automated Processing

Once set up, the system will automatically:
- Process feeds every 4 hours
- Generate analysis every 4 hours
- Clean up old data daily at 2 AM UTC

## Next Steps

After data is flowing:
1. Configure additional feed sources via API
2. Set up OpenAI API key for AI analysis
3. Configure Whisper for podcast transcription
4. Monitor prediction accuracy over time

## Quick Status Check

Run this anytime to see current status:
```bash
npm run ingest:status
```

This shows a snapshot of:
- Total feed sources
- Job queue status
- Content counts
- Latest analysis date