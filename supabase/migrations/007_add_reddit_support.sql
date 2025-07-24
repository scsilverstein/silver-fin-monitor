-- Add Reddit support to feed_sources
-- Migration 005: Add Reddit Feed Type Support

-- Drop the existing check constraint
ALTER TABLE feed_sources DROP CONSTRAINT feed_sources_type_check;

-- Add the new check constraint that includes 'reddit'
ALTER TABLE feed_sources ADD CONSTRAINT feed_sources_type_check 
CHECK (type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source', 'reddit'));

-- Update any existing reddit entries (if any exist with invalid type)
-- This is safe as it will only update rows where type = 'reddit'
UPDATE feed_sources SET type = 'reddit' WHERE type = 'reddit';