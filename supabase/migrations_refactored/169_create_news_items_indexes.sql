-- Create indexes for news_items table
-- Optimize news retrieval and search

-- Primary index for date-based queries
CREATE INDEX IF NOT EXISTS idx_news_items_published 
ON news_items(published_at DESC);

-- Index for source-based queries
CREATE INDEX IF NOT EXISTS idx_news_items_source 
ON news_items(source, published_at DESC);

-- Index for symbol-specific news
CREATE INDEX IF NOT EXISTS idx_news_items_symbols 
ON news_items USING GIN(symbols) 
WHERE array_length(symbols, 1) > 0;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_news_items_category 
ON news_items(category, published_at DESC) 
WHERE category IS NOT NULL;

-- Full text search on title and content
CREATE INDEX IF NOT EXISTS idx_news_items_search 
ON news_items USING GIN(
    to_tsvector('english', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(content, ''))
);

-- Index for sentiment filtering
CREATE INDEX IF NOT EXISTS idx_news_items_sentiment 
ON news_items(sentiment_score, published_at DESC) 
WHERE sentiment_score IS NOT NULL;

-- Index for high importance news
CREATE INDEX IF NOT EXISTS idx_news_items_importance 
ON news_items(importance DESC, published_at DESC) 
WHERE importance > 7;

-- JSONB index for tags
CREATE INDEX IF NOT EXISTS idx_news_items_tags 
ON news_items USING GIN(tags);

-- Index for unprocessed news
CREATE INDEX IF NOT EXISTS idx_news_items_unprocessed 
ON news_items(created_at, is_processed) 
WHERE is_processed = false;

-- Add index comments
COMMENT ON INDEX idx_news_items_published IS 'Date-ordered news retrieval';
COMMENT ON INDEX idx_news_items_source IS 'Filter by news source';
COMMENT ON INDEX idx_news_items_symbols IS 'Symbol-specific news lookup';
COMMENT ON INDEX idx_news_items_category IS 'Category-based filtering';
COMMENT ON INDEX idx_news_items_search IS 'Full text news search';
COMMENT ON INDEX idx_news_items_sentiment IS 'Sentiment-based filtering';
COMMENT ON INDEX idx_news_items_importance IS 'High importance news';
COMMENT ON INDEX idx_news_items_tags IS 'Tag-based filtering';
COMMENT ON INDEX idx_news_items_unprocessed IS 'Queue for processing';