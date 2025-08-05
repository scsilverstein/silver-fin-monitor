-- Fix any existing null published_at values in raw_feeds
UPDATE raw_feeds 
SET published_at = created_at 
WHERE published_at IS NULL;

-- Add a comment explaining the fix
COMMENT ON COLUMN raw_feeds.published_at IS 'Publication date of the feed item. If not available from the source, defaults to creation date to prevent display issues.';