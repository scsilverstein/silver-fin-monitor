-- Create indexes for feed_sources table
-- Performance and query optimization

-- Index for active sources lookup
CREATE INDEX IF NOT EXISTS idx_feed_sources_active 
ON feed_sources(is_active, created_at DESC) 
WHERE is_active = true;

-- Index for type-based queries
CREATE INDEX IF NOT EXISTS idx_feed_sources_type 
ON feed_sources(type) 
WHERE is_active = true;

-- Index for last processed tracking
CREATE INDEX IF NOT EXISTS idx_feed_sources_last_processed 
ON feed_sources(last_processed_at) 
WHERE is_active = true;

-- Index for priority-based processing
CREATE INDEX IF NOT EXISTS idx_feed_sources_priority 
ON feed_sources(priority DESC, last_processed_at ASC NULLS FIRST) 
WHERE is_active = true;

-- Full text search on source names
CREATE INDEX IF NOT EXISTS idx_feed_sources_name_search 
ON feed_sources USING GIN(to_tsvector('english', name));

-- Add index comments
COMMENT ON INDEX idx_feed_sources_active IS 'Quick lookup of active sources';
COMMENT ON INDEX idx_feed_sources_type IS 'Filter sources by type';
COMMENT ON INDEX idx_feed_sources_last_processed IS 'Find sources needing processing';
COMMENT ON INDEX idx_feed_sources_priority IS 'Process high priority sources first';
COMMENT ON INDEX idx_feed_sources_name_search IS 'Full text search on source names';