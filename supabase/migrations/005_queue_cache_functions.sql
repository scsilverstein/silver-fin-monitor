-- Queue Management Functions

-- Function to enqueue a job
CREATE OR REPLACE FUNCTION enqueue_job(
    job_type VARCHAR(100),
    payload JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5,
    delay_seconds INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    job_id UUID;
BEGIN
    INSERT INTO job_queue (job_type, payload, priority, scheduled_at)
    VALUES (job_type, payload, priority, NOW() + (delay_seconds * INTERVAL '1 second'))
    RETURNING id INTO job_id;
    
    RETURN job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to dequeue a job (atomic operation)
CREATE OR REPLACE FUNCTION dequeue_job() RETURNS TABLE (
    job_id UUID,
    job_type VARCHAR(100),
    payload JSONB,
    priority INTEGER,
    attempts INTEGER
) AS $$
DECLARE
    job_record RECORD;
BEGIN
    -- Get the next job atomically
    UPDATE job_queue 
    SET 
        status = 'processing',
        started_at = NOW(),
        attempts = job_queue.attempts + 1
    WHERE id = (
        SELECT jq.id FROM job_queue jq
        WHERE jq.status IN ('pending', 'retry') 
        AND jq.scheduled_at <= NOW()
        AND jq.attempts < jq.max_attempts
        ORDER BY jq.priority ASC, jq.scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO job_record;
    
    IF job_record.id IS NOT NULL THEN
        RETURN QUERY SELECT 
            job_record.id,
            job_record.job_type,
            job_record.payload,
            job_record.priority,
            job_record.attempts;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_job(job_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE job_queue 
    SET 
        status = 'completed',
        completed_at = NOW()
    WHERE id = job_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark job as failed (with retry logic)
CREATE OR REPLACE FUNCTION fail_job(job_id UUID, error_msg TEXT) RETURNS BOOLEAN AS $$
DECLARE
    job_record RECORD;
BEGIN
    SELECT * INTO job_record FROM job_queue WHERE id = job_id;
    
    IF job_record.attempts >= job_record.max_attempts THEN
        -- Max attempts reached, mark as failed
        UPDATE job_queue 
        SET 
            status = 'failed',
            error_message = error_msg,
            completed_at = NOW()
        WHERE id = job_id;
    ELSE
        -- Retry with exponential backoff
        UPDATE job_queue 
        SET 
            status = 'retry',
            error_message = error_msg,
            scheduled_at = NOW() + (POWER(2, job_queue.attempts) * INTERVAL '1 minute')
        WHERE id = job_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats() RETURNS TABLE(
    status VARCHAR(50),
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        job_queue.status,
        COUNT(*)::BIGINT
    FROM job_queue
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY job_queue.status;
END;
$$ LANGUAGE plpgsql;

-- Cache Management Functions

-- Function to get cached value
CREATE OR REPLACE FUNCTION cache_get(cache_key VARCHAR(255)) RETURNS JSONB AS $$
DECLARE
    cached_value JSONB;
BEGIN
    SELECT value INTO cached_value 
    FROM cache_store 
    WHERE key = cache_key 
    AND expires_at > NOW();
    
    RETURN cached_value;
END;
$$ LANGUAGE plpgsql;

-- Function to set cache value
CREATE OR REPLACE FUNCTION cache_set(
    cache_key VARCHAR(255),
    cache_value JSONB,
    ttl_seconds INTEGER DEFAULT 3600
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO cache_store (key, value, expires_at)
    VALUES (cache_key, cache_value, NOW() + (ttl_seconds * INTERVAL '1 second'))
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to delete cache entry
CREATE OR REPLACE FUNCTION cache_delete(cache_key VARCHAR(255)) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM cache_store WHERE key = cache_key;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data() RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Clean up expired cache entries
    DELETE FROM cache_store WHERE expires_at < NOW();
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Clean up old completed/failed jobs (older than 7 days)
    DELETE FROM job_queue 
    WHERE status IN ('completed', 'failed') 
    AND completed_at < NOW() - INTERVAL '7 days';
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_queue_dequeue 
ON job_queue(status, priority, scheduled_at) 
WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_cache_store_key_expires 
ON cache_store(key, expires_at);

-- Grant permissions (adjust based on your roles)
GRANT EXECUTE ON FUNCTION enqueue_job TO authenticated;
GRANT EXECUTE ON FUNCTION dequeue_job TO service_role;
GRANT EXECUTE ON FUNCTION complete_job TO service_role;
GRANT EXECUTE ON FUNCTION fail_job TO service_role;
GRANT EXECUTE ON FUNCTION get_queue_stats TO authenticated;
GRANT EXECUTE ON FUNCTION cache_get TO authenticated;
GRANT EXECUTE ON FUNCTION cache_set TO authenticated;
GRANT EXECUTE ON FUNCTION cache_delete TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_data TO service_role;