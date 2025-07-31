-- Create index for raw_feeds processing status
-- Index on processing_status for queue processing
CREATE INDEX IF NOT EXISTS idx_raw_feeds_status 
ON raw_feeds(processing_status) 
WHERE processing_status IN ('pending', 'processing');

-- Add comment
COMMENT ON INDEX idx_raw_feeds_status IS 'Index for finding feeds that need processing';