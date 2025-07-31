-- Create indexes for research_reports table
-- Support research document management

-- Index for symbol-specific research
CREATE INDEX IF NOT EXISTS idx_research_reports_symbol 
ON research_reports(symbol, published_date DESC);

-- Index for author research
CREATE INDEX IF NOT EXISTS idx_research_reports_author 
ON research_reports(author, published_date DESC);

-- Index for report type filtering
CREATE INDEX IF NOT EXISTS idx_research_reports_type 
ON research_reports(report_type, published_date DESC);

-- Index for rating-based queries
CREATE INDEX IF NOT EXISTS idx_research_reports_rating 
ON research_reports(rating, published_date DESC) 
WHERE rating IS NOT NULL;

-- Full text search on title and summary
CREATE INDEX IF NOT EXISTS idx_research_reports_search 
ON research_reports USING GIN(
    to_tsvector('english', title || ' ' || COALESCE(summary, ''))
);

-- Index for price targets
CREATE INDEX IF NOT EXISTS idx_research_reports_target 
ON research_reports(symbol, price_target DESC, published_date DESC) 
WHERE price_target IS NOT NULL;

-- Index for recent research
CREATE INDEX IF NOT EXISTS idx_research_reports_recent 
ON research_reports(published_date DESC) 
WHERE published_date >= CURRENT_DATE - INTERVAL '30 days';

-- JSONB index for tags
CREATE INDEX IF NOT EXISTS idx_research_reports_tags 
ON research_reports USING GIN(tags);

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_research_reports_source 
ON research_reports(source, published_date DESC);

-- Index for confidence level
CREATE INDEX IF NOT EXISTS idx_research_reports_confidence 
ON research_reports(confidence_level DESC, published_date DESC) 
WHERE confidence_level > 0.8;

-- Add index comments
COMMENT ON INDEX idx_research_reports_symbol IS 'Symbol-specific research';
COMMENT ON INDEX idx_research_reports_author IS 'Author research tracking';
COMMENT ON INDEX idx_research_reports_type IS 'Report type filtering';
COMMENT ON INDEX idx_research_reports_rating IS 'Rating-based analysis';
COMMENT ON INDEX idx_research_reports_search IS 'Full text research search';
COMMENT ON INDEX idx_research_reports_target IS 'Price target analysis';
COMMENT ON INDEX idx_research_reports_recent IS 'Recent research reports';
COMMENT ON INDEX idx_research_reports_tags IS 'Tag-based filtering';
COMMENT ON INDEX idx_research_reports_source IS 'Source-based queries';
COMMENT ON INDEX idx_research_reports_confidence IS 'High confidence research';