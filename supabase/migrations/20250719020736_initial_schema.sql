-- Silver Fin Monitor - Core Database Schema
-- Migration 001: Core Tables (5 business + 2 infrastructure)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Feed Sources Configuration
CREATE TABLE feed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source')),
    url TEXT NOT NULL,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw Feed Data
CREATE TABLE raw_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    title VARCHAR(500),
    description TEXT,
    content TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_id, external_id)
);

-- Processed Content
CREATE TABLE processed_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_feed_id UUID NOT NULL REFERENCES raw_feeds(id) ON DELETE CASCADE,
    processed_text TEXT,
    key_topics TEXT[] DEFAULT '{}',
    sentiment_score FLOAT CHECK (sentiment_score BETWEEN -1 AND 1),
    entities JSONB DEFAULT '{}',
    summary TEXT,
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Market Analysis
CREATE TABLE daily_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    market_sentiment VARCHAR(50),
    key_themes TEXT[] DEFAULT '{}',
    overall_summary TEXT,
    ai_analysis JSONB DEFAULT '{}',
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    sources_analyzed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(analysis_date)
);

-- Predictions
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_analysis_id UUID REFERENCES daily_analysis(id),
    prediction_type VARCHAR(100),
    prediction_text TEXT,
    confidence_level FLOAT CHECK (confidence_level BETWEEN 0 AND 1),
    time_horizon VARCHAR(50) CHECK (time_horizon IN ('1_week', '1_month', '3_months', '6_months', '1_year')),
    prediction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database-Based Job Queue (replaces Bull/Redis)
CREATE TABLE job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    payload JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Database-Based Simple Cache (replaces Redis)
CREATE TABLE cache_store (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feed_sources_updated_at BEFORE UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();-- Silver Fin Monitor - Essential Indexes
-- Migration 002: Performance Indexes

-- Core performance indexes for raw_feeds
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_feeds_source_published 
ON raw_feeds(source_id, published_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_feeds_status 
ON raw_feeds(processing_status) WHERE processing_status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_feeds_created 
ON raw_feeds(created_at DESC);

-- Daily analysis indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_analysis_date 
ON daily_analysis(analysis_date DESC);

-- Predictions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_analysis 
ON predictions(daily_analysis_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_horizon 
ON predictions(time_horizon, created_at DESC);

-- Job queue indexes for efficient processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_queue_processing 
ON job_queue(status, priority, scheduled_at) 
WHERE status IN ('pending', 'retry');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_queue_cleanup 
ON job_queue(expires_at) 
WHERE status IN ('completed', 'failed');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_queue_type_status 
ON job_queue(job_type, status, created_at DESC);

-- Cache indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_expires 
ON cache_store(expires_at);

-- Processed content indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_content_feed 
ON processed_content(raw_feed_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_content_created 
ON processed_content(created_at DESC);

-- Full-text search index for content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processed_content_search 
ON processed_content USING GIN(to_tsvector('english', processed_text));

-- Feed sources indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feed_sources_active 
ON feed_sources(is_active, last_processed_at DESC) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feed_sources_type 
ON feed_sources(type, is_active);-- Silver Fin Monitor - Database Functions
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