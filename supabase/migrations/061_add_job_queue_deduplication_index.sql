-- Add indexes for efficient duplicate job checking
-- These indexes support the deduplication queries in queue.service.ts

-- Index for feed_fetch job deduplication
CREATE INDEX IF NOT EXISTS idx_job_queue_feed_fetch_dedup 
ON job_queue(job_type, status, (payload->>'sourceId'))
WHERE job_type = 'feed_fetch' AND status IN ('pending', 'processing', 'retry');

-- Index for content_process job deduplication (multiple payload structures)
CREATE INDEX IF NOT EXISTS idx_job_queue_content_process_rawfeed_dedup 
ON job_queue(job_type, status, (payload->>'rawFeedId'))
WHERE job_type = 'content_process' AND status IN ('pending', 'processing', 'retry');

CREATE INDEX IF NOT EXISTS idx_job_queue_content_process_content_dedup 
ON job_queue(job_type, status, (payload->>'contentId'))
WHERE job_type = 'content_process' AND status IN ('pending', 'processing', 'retry');

CREATE INDEX IF NOT EXISTS idx_job_queue_content_process_external_dedup 
ON job_queue(job_type, status, (payload->>'sourceId'), (payload->>'externalId'))
WHERE job_type = 'content_process' AND status IN ('pending', 'processing', 'retry');

-- Index for daily_analysis job deduplication
CREATE INDEX IF NOT EXISTS idx_job_queue_daily_analysis_dedup 
ON job_queue(job_type, status, (payload->>'date'))
WHERE job_type = 'daily_analysis' AND status IN ('pending', 'processing', 'retry');

-- Index for generate_predictions job deduplication
CREATE INDEX IF NOT EXISTS idx_job_queue_generate_predictions_date_dedup 
ON job_queue(job_type, status, (payload->>'analysisDate'))
WHERE job_type = 'generate_predictions' AND status IN ('pending', 'processing', 'retry');

CREATE INDEX IF NOT EXISTS idx_job_queue_generate_predictions_analysis_dedup 
ON job_queue(job_type, status, (payload->>'analysisId'))
WHERE job_type = 'generate_predictions' AND status IN ('pending', 'processing', 'retry');

-- Index for prediction_compare job deduplication
CREATE INDEX IF NOT EXISTS idx_job_queue_prediction_compare_dedup 
ON job_queue(job_type, status, (payload->>'predictionId'))
WHERE job_type = 'prediction_compare' AND status IN ('pending', 'processing', 'retry');

-- Generic index for other job types
CREATE INDEX IF NOT EXISTS idx_job_queue_status_type 
ON job_queue(job_type, status)
WHERE status IN ('pending', 'processing', 'retry');