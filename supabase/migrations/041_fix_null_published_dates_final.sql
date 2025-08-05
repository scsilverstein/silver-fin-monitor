-- Fix any existing null published_at values in raw_feeds
-- This sets published_at to created_at for any items where it's null
UPDATE raw_feeds 
SET published_at = created_at 
WHERE published_at IS NULL AND created_at IS NOT NULL;

-- For items where both are null (shouldn't happen), set to current timestamp
UPDATE raw_feeds 
SET published_at = NOW() 
WHERE published_at IS NULL AND created_at IS NULL;

-- Add a default value to prevent future nulls
ALTER TABLE raw_feeds 
ALTER COLUMN published_at SET DEFAULT NOW();

-- Add a NOT NULL constraint to ensure published_at is always set
-- Note: This will only work after fixing existing nulls above
ALTER TABLE raw_feeds 
ALTER COLUMN published_at SET NOT NULL;

-- Add a comment explaining the constraint
COMMENT ON COLUMN raw_feeds.published_at IS 'Publication date of the feed item. Required field that defaults to current timestamp if not provided by the source.';