-- Create indexes for raw_feeds table
-- Performance and query optimization

-- Composite index for source-based queries with date ordering
CREATE INDEX IF NOT EXISTS idx_raw_feeds_source_published 
ON raw_feeds(source_id, published_at DESC);

-- Index for status-based processing queries
CREATE INDEX IF NOT EXISTS idx_raw_feeds_status 
ON raw_feeds(processing_status, created_at) 
WHERE processing_status IN ('pending', 'processing');

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_raw_feeds_published_date 
ON raw_feeds(published_at DESC);

-- Index for external ID lookups (for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_raw_feeds_external_id 
ON raw_feeds(source_id, external_id);

-- Index for failed items requiring retry
CREATE INDEX IF NOT EXISTS idx_raw_feeds_failed 
ON raw_feeds(processing_status, error_count, created_at) 
WHERE processing_status = 'failed' AND error_count < 3;

-- Full text search on title and description
CREATE INDEX IF NOT EXISTS idx_raw_feeds_content_search 
ON raw_feeds USING GIN(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''))
);

-- Add index comments
COMMENT ON INDEX idx_raw_feeds_source_published IS 'Efficient source-based queries with date ordering';
COMMENT ON INDEX idx_raw_feeds_status IS 'Quick lookup of items to process';
COMMENT ON INDEX idx_raw_feeds_published_date IS 'Date range filtering';
COMMENT ON INDEX idx_raw_feeds_external_id IS 'Duplicate detection by external ID';
COMMENT ON INDEX idx_raw_feeds_failed IS 'Find failed items for retry';
COMMENT ON INDEX idx_raw_feeds_content_search IS 'Full text search on feed content';