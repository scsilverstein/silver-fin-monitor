-- Force fix Reddit constraint by recreating table structure
-- Migration 009: Force Reddit support

-- First, let's see what constraints exist and force drop them
DO $$ 
DECLARE
    constraint_name text;
BEGIN
    -- Get all check constraints on feed_sources
    FOR constraint_name IN 
        SELECT conname FROM pg_constraint 
        WHERE conrelid = 'feed_sources'::regclass 
        AND contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE feed_sources DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- Now add the correct constraint
ALTER TABLE feed_sources ADD CONSTRAINT feed_sources_type_check 
CHECK (type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source', 'reddit'));

-- Verify by inserting a test reddit entry (will be rolled back if it fails)
DO $$
BEGIN
    -- Test insert
    INSERT INTO feed_sources (name, type, url, config) 
    VALUES ('Test Reddit', 'reddit', 'https://reddit.com/test', '{}');
    
    -- If we get here, it worked, so delete the test record
    DELETE FROM feed_sources WHERE name = 'Test Reddit' AND type = 'reddit';
EXCEPTION
    WHEN check_violation THEN
        RAISE EXCEPTION 'Reddit type still not allowed after constraint update';
END $$;