-- Create indexes for feed_sources table
-- Index on type and active status for filtering active feeds by type
CREATE INDEX IF NOT EXISTS idx_feed_sources_type_active 
ON feed_sources(type, is_active) 
WHERE is_active = true;

-- Add comment
COMMENT ON INDEX idx_feed_sources_type_active IS 'Index for quickly finding active feeds by type';