-- Silver Fin Monitor - Database Functions
-- Migration 003: Queue and Cache Management Functions

-- Job Queue Management Functions
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

-- Get next job for processing (atomic operation)
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
    -- Get the next job atomically with FOR UPDATE SKIP LOCKED
    UPDATE job_queue 
    SET 
        status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1
    WHERE id = (
        SELECT id FROM job_queue 
        WHERE status IN ('pending', 'retry') 
        AND scheduled_at <= NOW()
        AND attempts < max_attempts
        ORDER BY priority ASC, scheduled_at ASC
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

-- Mark job as completed
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

-- Mark job as failed (with retry logic)
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
            scheduled_at = NOW() + (POWER(2, attempts) * INTERVAL '1 minute')
        WHERE id = job_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Cache Management Functions
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

CREATE OR REPLACE FUNCTION cache_delete(cache_key VARCHAR(255)) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM cache_store WHERE key = cache_key;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired jobs and cache entries
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

-- Get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats() RETURNS TABLE (
    status VARCHAR(50),
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        q.status,
        COUNT(*) as count
    FROM job_queue q
    GROUP BY q.status
    ORDER BY q.status;
END;
$$ LANGUAGE plpgsql;

-- Get processing stats for dashboard
CREATE OR REPLACE FUNCTION get_processing_stats() RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_feeds', (SELECT COUNT(*) FROM feed_sources WHERE is_active = true),
        'processed_today', (SELECT COUNT(*) FROM raw_feeds WHERE DATE(created_at) = CURRENT_DATE),
        'pending_jobs', (SELECT COUNT(*) FROM job_queue WHERE status = 'pending'),
        'processing_jobs', (SELECT COUNT(*) FROM job_queue WHERE status = 'processing'),
        'failed_jobs', (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'),
        'latest_analysis', (SELECT analysis_date FROM daily_analysis ORDER BY analysis_date DESC LIMIT 1)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;