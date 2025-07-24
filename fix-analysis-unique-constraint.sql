-- Fix the UNIQUE constraint issue that prevents multiple analyses per day

-- Remove the unique constraint on analysis_date
ALTER TABLE daily_analysis DROP CONSTRAINT IF EXISTS daily_analysis_analysis_date_key;

-- Now multiple analyses can be created per date
-- The system will store all analyses with their timestamps

-- Optional: Add an index for performance on analysis_date queries
CREATE INDEX IF NOT EXISTS idx_daily_analysis_date_created 
ON daily_analysis(analysis_date, created_at DESC);

-- Verify the constraint is removed
-- You can check with: \d+ daily_analysis