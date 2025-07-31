-- Create queue management functions
-- Core functions for database-based job queue system

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

-- Function to dequeue next job (atomic operation)
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
            scheduled_at = NOW() + (POWER(2, attempts) * INTERVAL '1 minute')
        WHERE id = job_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats() RETURNS TABLE (
    status VARCHAR(50),
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.status,
        COUNT(*) as count
    FROM job_queue j
    GROUP BY j.status
    ORDER BY j.status;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION enqueue_job IS 'Add a new job to the queue with optional delay';
COMMENT ON FUNCTION dequeue_job IS 'Atomically get the next job for processing';
COMMENT ON FUNCTION complete_job IS 'Mark a job as successfully completed';
COMMENT ON FUNCTION fail_job IS 'Mark a job as failed with retry logic';
COMMENT ON FUNCTION get_queue_stats IS 'Get current queue statistics by status';