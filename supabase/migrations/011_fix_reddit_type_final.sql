-- Final fix for Reddit feed type support
-- Migration 011: Ensure Reddit type is allowed

-- First, drop any existing type constraint
ALTER TABLE feed_sources DROP CONSTRAINT IF EXISTS feed_sources_type_check;

-- Add the constraint back with all supported types including reddit
ALTER TABLE feed_sources ADD CONSTRAINT feed_sources_type_check 
CHECK (type IN ('rss', 'podcast', 'youtube', 'api', 'multi_source', 'reddit'));

-- Verify the constraint is correctly applied
DO $$
BEGIN
    -- This will succeed if reddit is now a valid type
    INSERT INTO feed_sources (name, type, url, config) 
    VALUES ('Reddit Test', 'reddit', 'https://reddit.com/test', '{"categories": ["test"]}');
    
    -- Clean up the test record
    DELETE FROM feed_sources WHERE name = 'Reddit Test';
    
    RAISE NOTICE 'Reddit type constraint successfully updated';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update reddit type constraint: %', SQLERRM;
END $$;