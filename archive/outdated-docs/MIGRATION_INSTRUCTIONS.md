# Database Migration Instructions

## Quick Steps:

1. **Open Supabase SQL Editor**: https://app.supabase.com/project/yozgscdmuqjmhebjxpce/sql/new

2. **Copy the migration SQL** from: `supabase/migrations/20250719020736_initial_schema.sql`

3. **Paste and Run** in the SQL Editor

## What This Creates:

### Tables (7)
- `feed_sources` - Configuration for RSS, podcast, YouTube feeds
- `raw_feeds` - Raw content from feeds
- `processed_content` - AI-processed content with sentiment
- `daily_analysis` - Daily market analysis summaries
- `predictions` - Market predictions with confidence scores
- `job_queue` - Background job processing queue
- `cache_store` - Application cache storage

### Functions (10)
- `enqueue_job()` - Add jobs to queue
- `dequeue_job()` - Get next job to process
- `complete_job()` - Mark job as completed
- `fail_job()` - Handle job failures with retry
- `cache_get()` - Retrieve cached values
- `cache_set()` - Store values in cache
- `cache_delete()` - Remove cached values
- `cleanup_expired_data()` - Clean old data
- `get_queue_stats()` - Queue statistics
- `get_processing_stats()` - Dashboard stats

### Indexes (15)
Performance indexes on all major query patterns

## After Migration:

1. The backend warnings about "Database functions not yet available" will stop
2. The queue system will start processing jobs
3. Feed processing will be fully functional
4. You can start adding and processing feeds

## Verification:

After running the migration, you can verify it worked by running this query:

```sql
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('feed_sources', 'raw_feeds', 'processed_content', 'daily_analysis', 'predictions', 'job_queue', 'cache_store');
```

Should return: `7`