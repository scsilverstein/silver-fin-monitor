-- Create indexes for processed_content table
-- Performance and query optimization

-- Index for feed-based lookups
CREATE INDEX IF NOT EXISTS idx_processed_content_feed 
ON processed_content(raw_feed_id, created_at DESC);

-- Composite index for sentiment analysis queries
CREATE INDEX IF NOT EXISTS idx_processed_content_sentiment 
ON processed_content(sentiment_score, created_at DESC) 
WHERE sentiment_score IS NOT NULL;

-- Index for entity-based queries (JSONB)
CREATE INDEX IF NOT EXISTS idx_processed_content_entities 
ON processed_content USING GIN(entities);

-- Index for topic-based queries (array)
CREATE INDEX IF NOT EXISTS idx_processed_content_topics 
ON processed_content USING GIN(key_topics);

-- Full text search on processed text and summary
CREATE INDEX IF NOT EXISTS idx_processed_content_text_search 
ON processed_content USING GIN(
    to_tsvector('english', COALESCE(processed_text, '') || ' ' || COALESCE(summary, ''))
);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_processed_content_created 
ON processed_content(created_at DESC);

-- Index for high confidence content
CREATE INDEX IF NOT EXISTS idx_processed_content_confidence 
ON processed_content(confidence_score DESC, created_at DESC) 
WHERE confidence_score > 0.8;

-- Add index comments
COMMENT ON INDEX idx_processed_content_feed IS 'Lookup processed content by feed';
COMMENT ON INDEX idx_processed_content_sentiment IS 'Filter by sentiment score';
COMMENT ON INDEX idx_processed_content_entities IS 'Search by extracted entities';
COMMENT ON INDEX idx_processed_content_topics IS 'Filter by topics';
COMMENT ON INDEX idx_processed_content_text_search IS 'Full text search on content';
COMMENT ON INDEX idx_processed_content_created IS 'Date-based filtering';
COMMENT ON INDEX idx_processed_content_confidence IS 'Find high confidence content';