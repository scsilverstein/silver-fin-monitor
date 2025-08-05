# Queue Deduplication System

## Overview

The Silver Fin Monitor queue system implements automatic deduplication to prevent duplicate jobs from being processed. This ensures efficient resource usage and prevents redundant operations.

## How It Works

When a job is enqueued, the system checks if an identical job is already pending, processing, or scheduled for retry. If a duplicate is found, the existing job ID is returned instead of creating a new job.

## Deduplicated Job Types

### 1. Feed Fetch (`feed_fetch`)
- **Unique Key**: `sourceId`
- **Purpose**: Prevents multiple fetch operations for the same feed source
- **Example**: If a feed fetch for source "abc123" is already queued, subsequent attempts to queue the same source will return the existing job ID

### 2. Content Process (`content_process`)
- **Unique Keys**: 
  - `contentId` (primary)
  - `rawFeedId` (alternative)
  - `sourceId` + `externalId` (composite)
- **Purpose**: Prevents duplicate content processing for the same feed item
- **Example**: Processing the same podcast episode or article multiple times is prevented

### 3. Daily Analysis (`daily_analysis`)
- **Unique Key**: `date`
- **Purpose**: Ensures only one analysis is generated per day
- **Example**: Multiple requests to analyze "2024-01-15" will result in a single analysis job

### 4. Generate Predictions (`generate_predictions`)
- **Unique Keys**:
  - `analysisDate` or `date`
  - `analysisId` (alternative)
- **Purpose**: Prevents duplicate prediction generation for the same analysis
- **Example**: Predictions for a specific date or analysis are generated only once

### 5. Prediction Compare (`prediction_compare`)
- **Unique Key**: `predictionId`
- **Purpose**: Prevents duplicate comparison operations for the same prediction
- **Example**: Each prediction is compared with actual outcomes only once

## Job Types Without Deduplication

The following job types allow duplicates as they may need to be executed multiple times:
- `stock_fetch`
- `technical_analysis`
- `alert_check`
- `email_send`

## Implementation Details

### Database Indexes

The system uses PostgreSQL partial indexes for efficient duplicate checking:

```sql
-- Example: Feed fetch deduplication index
CREATE INDEX idx_job_queue_feed_fetch_dedup 
ON job_queue(job_type, status, (payload->>'sourceId'))
WHERE job_type = 'feed_fetch' AND status IN ('pending', 'processing', 'retry');
```

### Status Considerations

Jobs are considered duplicates only if they are in one of these states:
- `pending`: Waiting to be processed
- `processing`: Currently being processed
- `retry`: Scheduled for retry after a failure

Completed or failed jobs (beyond retry attempts) are not considered when checking for duplicates.

## Usage Examples

### JavaScript/TypeScript

```typescript
import { queueService, JobType } from './services/queue';

// First call creates a new job
const jobId1 = await queueService.enqueue(JobType.FEED_FETCH, {
  sourceId: 'feed-123'
});
console.log(jobId1); // "job-abc-def-ghi"

// Second call returns the same job ID (deduplication)
const jobId2 = await queueService.enqueue(JobType.FEED_FETCH, {
  sourceId: 'feed-123'
});
console.log(jobId2); // "job-abc-def-ghi" (same as jobId1)

// Different source creates a new job
const jobId3 = await queueService.enqueue(JobType.FEED_FETCH, {
  sourceId: 'feed-456'
});
console.log(jobId3); // "job-xyz-uvw-rst" (different job)
```

### Batch Operations

```typescript
// Batch enqueue with automatic deduplication
const jobs = [
  { type: JobType.FEED_FETCH, payload: { sourceId: 'feed-1' } },
  { type: JobType.FEED_FETCH, payload: { sourceId: 'feed-1' } }, // Duplicate
  { type: JobType.FEED_FETCH, payload: { sourceId: 'feed-2' } }
];

const jobIds = await queueService.enqueueBatch(jobs);
// Returns: ['job-1', 'job-1', 'job-2'] (second item is deduplicated)
```

## Benefits

1. **Resource Efficiency**: Prevents wasted processing on duplicate tasks
2. **Cost Savings**: Reduces API calls and computational resources
3. **Data Consistency**: Ensures operations are performed exactly once
4. **System Stability**: Prevents queue overflow from repeated job submissions

## Monitoring

To check for duplicate prevention in action:

```sql
-- Count prevented duplicates by checking logs
SELECT COUNT(*) 
FROM system_logs 
WHERE message LIKE '%Skipping duplicate job%'
AND created_at > NOW() - INTERVAL '24 hours';

-- View current queue status with potential duplicates
SELECT job_type, payload->>'sourceId' as source, COUNT(*) as count
FROM job_queue
WHERE status IN ('pending', 'processing', 'retry')
GROUP BY job_type, payload->>'sourceId'
HAVING COUNT(*) > 1;
```

## Configuration

Deduplication is enabled by default and cannot be disabled for the listed job types. This is by design to ensure system integrity and efficiency.

## Troubleshooting

### Job Not Being Created

If a job is not being created when expected:
1. Check if a similar job is already in the queue
2. Verify the job payload matches the expected format
3. Check the job status - completed/failed jobs don't prevent new ones

### False Duplicates

If jobs are incorrectly identified as duplicates:
1. Ensure unique identifiers are properly set in the payload
2. Check that the job type is correct
3. Verify that completed jobs are being properly marked

### Performance Issues

If duplicate checking is slow:
1. Ensure database indexes are created (run migration 061)
2. Monitor index usage with `EXPLAIN ANALYZE`
3. Consider archiving old completed jobs