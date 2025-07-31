-- Create indexes for sentiment_analysis table
-- Optimize sentiment queries and aggregations

-- Composite index for entity and date queries
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_entity_date 
ON sentiment_analysis(entity_id, analysis_date DESC);

-- Index for source-based queries
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_source 
ON sentiment_analysis(source_type, analysis_date DESC);

-- Index for sentiment score ranges
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_score 
ON sentiment_analysis(overall_sentiment DESC, analysis_date DESC);

-- Index for high confidence sentiment
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_confidence 
ON sentiment_analysis(confidence_score DESC, analysis_date DESC) 
WHERE confidence_score > 0.8;

-- Index for mention volume analysis
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_mentions 
ON sentiment_analysis(analysis_date DESC, mention_count DESC) 
WHERE mention_count > 10;

-- JSONB index for breakdown data
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_breakdown 
ON sentiment_analysis USING GIN(sentiment_breakdown);

-- Index for trending sentiment changes
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_trending 
ON sentiment_analysis(analysis_date DESC, abs(sentiment_change) DESC) 
WHERE sentiment_change IS NOT NULL;

-- Index for multi-source sentiment
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_sources 
ON sentiment_analysis(entity_id, source_count DESC) 
WHERE source_count > 3;

-- Add index comments
COMMENT ON INDEX idx_sentiment_analysis_entity_date IS 'Entity sentiment history';
COMMENT ON INDEX idx_sentiment_analysis_source IS 'Source-specific sentiment';
COMMENT ON INDEX idx_sentiment_analysis_score IS 'Sentiment score ranking';
COMMENT ON INDEX idx_sentiment_analysis_confidence IS 'High confidence sentiment';
COMMENT ON INDEX idx_sentiment_analysis_mentions IS 'High mention volume';
COMMENT ON INDEX idx_sentiment_analysis_breakdown IS 'Detailed sentiment data';
COMMENT ON INDEX idx_sentiment_analysis_trending IS 'Trending sentiment changes';
COMMENT ON INDEX idx_sentiment_analysis_sources IS 'Well-sourced sentiment';