-- Fix the daily_analysis table to work with the trigger from migration 010
-- The trigger expects a processing_metadata field that doesn't exist

-- Add the missing column to daily_analysis
ALTER TABLE daily_analysis 
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}';

-- Now we can insert data without errors