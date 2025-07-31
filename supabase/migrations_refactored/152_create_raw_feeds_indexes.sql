-- Create indexes for raw_feeds table
-- Index on source_id and published_at for efficient feed retrieval
CREATE INDEX IF NOT EXISTS idx_raw_feeds_source_published 
ON raw_feeds(source_id, published_at DESC);

-- Add comment
COMMENT ON INDEX idx_raw_feeds_source_published IS 'Index for retrieving recent feeds by source';