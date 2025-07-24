-- Fix Reddit support constraint
-- Migration 008: Force fix Reddit support

-- Drop the existing check constraint explicitly
ALTER TABLE feed_sources DROP CONSTRAINT IF EXISTS feed_sources_type_check;

-- Add the new check constraint that includes 'reddit'
ALTER TABLE feed_sources ADD CONSTRAINT feed_sources_type_check 
CHECK (type IN ('podcast', 'rss', 'youtube', 'api', 'multi_source', 'reddit'));