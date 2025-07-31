-- Create indexes for job_queue table
-- Critical for queue performance

-- Primary processing index - most important for dequeue operations
CREATE INDEX IF NOT EXISTS idx_job_queue_processing 
ON job_queue(status, priority ASC, scheduled_at ASC) 
WHERE status IN ('pending', 'retry');

-- Index for job type filtering
CREATE INDEX IF NOT EXISTS idx_job_queue_type_status 
ON job_queue(job_type, status, created_at DESC);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_job_queue_cleanup 
ON job_queue(expires_at, status) 
WHERE status IN ('completed', 'failed');

-- Index for monitoring stuck jobs
CREATE INDEX IF NOT EXISTS idx_job_queue_stuck 
ON job_queue(status, started_at) 
WHERE status = 'processing';

-- Index for error analysis
CREATE INDEX IF NOT EXISTS idx_job_queue_errors 
ON job_queue(status, job_type, completed_at DESC) 
WHERE status = 'failed';

-- Index for job history queries
CREATE INDEX IF NOT EXISTS idx_job_queue_history 
ON job_queue(completed_at DESC) 
WHERE status IN ('completed', 'failed');

-- Index for retry scheduling
CREATE INDEX IF NOT EXISTS idx_job_queue_retry 
ON job_queue(status, attempts, scheduled_at) 
WHERE status = 'retry' AND attempts < max_attempts;

-- JSONB index for payload queries
CREATE INDEX IF NOT EXISTS idx_job_queue_payload 
ON job_queue USING GIN(payload) 
WHERE status IN ('pending', 'processing');

-- Add index comments
COMMENT ON INDEX idx_job_queue_processing IS 'Critical: Primary index for dequeue operations';
COMMENT ON INDEX idx_job_queue_type_status IS 'Filter jobs by type and status';
COMMENT ON INDEX idx_job_queue_cleanup IS 'Efficient cleanup of old jobs';
COMMENT ON INDEX idx_job_queue_stuck IS 'Monitor stuck processing jobs';
COMMENT ON INDEX idx_job_queue_errors IS 'Analyze failed jobs';
COMMENT ON INDEX idx_job_queue_history IS 'Query job history';
COMMENT ON INDEX idx_job_queue_retry IS 'Schedule retry operations';
COMMENT ON INDEX idx_job_queue_payload IS 'Query job payloads';