-- Temporarily remove type constraint entirely to fix Reddit issue
-- Migration 010: Remove type constraint temporarily

-- Drop ALL constraints on the type column
ALTER TABLE feed_sources DROP CONSTRAINT IF EXISTS feed_sources_type_check;