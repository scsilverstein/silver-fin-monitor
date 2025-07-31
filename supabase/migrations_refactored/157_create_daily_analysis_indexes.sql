-- Create indexes for daily_analysis table
-- Performance and query optimization

-- Index for date-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_daily_analysis_date 
ON daily_analysis(analysis_date DESC);

-- Index for sentiment filtering
CREATE INDEX IF NOT EXISTS idx_daily_analysis_sentiment 
ON daily_analysis(market_sentiment, analysis_date DESC) 
WHERE market_sentiment IS NOT NULL;

-- Index for high confidence analyses
CREATE INDEX IF NOT EXISTS idx_daily_analysis_confidence 
ON daily_analysis(confidence_score DESC, analysis_date DESC) 
WHERE confidence_score > 0.7;

-- Index for theme-based queries (array)
CREATE INDEX IF NOT EXISTS idx_daily_analysis_themes 
ON daily_analysis USING GIN(key_themes);

-- Index for AI analysis data (JSONB)
CREATE INDEX IF NOT EXISTS idx_daily_analysis_ai_data 
ON daily_analysis USING GIN(ai_analysis);

-- Full text search on summary
CREATE INDEX IF NOT EXISTS idx_daily_analysis_summary_search 
ON daily_analysis USING GIN(to_tsvector('english', overall_summary)) 
WHERE overall_summary IS NOT NULL;

-- Index for finding analyses with many sources
CREATE INDEX IF NOT EXISTS idx_daily_analysis_sources 
ON daily_analysis(sources_analyzed DESC, analysis_date DESC) 
WHERE sources_analyzed > 5;

-- Add index comments
COMMENT ON INDEX idx_daily_analysis_date IS 'Primary index for date-based queries';
COMMENT ON INDEX idx_daily_analysis_sentiment IS 'Filter by market sentiment';
COMMENT ON INDEX idx_daily_analysis_confidence IS 'Find high confidence analyses';
COMMENT ON INDEX idx_daily_analysis_themes IS 'Search by key themes';
COMMENT ON INDEX idx_daily_analysis_ai_data IS 'Query AI analysis JSON data';
COMMENT ON INDEX idx_daily_analysis_summary_search IS 'Full text search on summaries';
COMMENT ON INDEX idx_daily_analysis_sources IS 'Find well-sourced analyses';