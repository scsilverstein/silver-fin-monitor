-- Silver Fin Monitor - Essential Indexes
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
ON feed_sources(type, is_active);