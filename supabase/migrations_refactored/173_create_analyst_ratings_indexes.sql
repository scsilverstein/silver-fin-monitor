-- Create indexes for analyst_ratings table
-- Support analyst consensus queries

-- Primary index for symbol and date
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_symbol_date 
ON analyst_ratings(symbol, rating_date DESC);

-- Index for analyst firm lookups
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_analyst 
ON analyst_ratings(analyst_firm, rating_date DESC);

-- Index for rating changes
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_changes 
ON analyst_ratings(rating_date DESC, previous_rating, current_rating) 
WHERE previous_rating IS NOT NULL AND previous_rating != current_rating;

-- Index for rating distribution
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_current 
ON analyst_ratings(current_rating, rating_date DESC);

-- Index for price target analysis
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_target 
ON analyst_ratings(symbol, price_target DESC, rating_date DESC) 
WHERE price_target IS NOT NULL;

-- Index for upgrades
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_upgrades 
ON analyst_ratings(rating_date DESC, symbol) 
WHERE rating_change = 'upgrade';

-- Index for downgrades
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_downgrades 
ON analyst_ratings(rating_date DESC, symbol) 
WHERE rating_change = 'downgrade';

-- Index for consensus tracking
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_consensus 
ON analyst_ratings(symbol, rating_date DESC) 
WHERE is_consensus = true;

-- Full text search on analyst notes
CREATE INDEX IF NOT EXISTS idx_analyst_ratings_notes 
ON analyst_ratings USING GIN(to_tsvector('english', notes)) 
WHERE notes IS NOT NULL;

-- Add index comments
COMMENT ON INDEX idx_analyst_ratings_symbol_date IS 'Symbol rating history';
COMMENT ON INDEX idx_analyst_ratings_analyst IS 'Analyst firm activity';
COMMENT ON INDEX idx_analyst_ratings_changes IS 'Rating change detection';
COMMENT ON INDEX idx_analyst_ratings_current IS 'Current rating distribution';
COMMENT ON INDEX idx_analyst_ratings_target IS 'Price target analysis';
COMMENT ON INDEX idx_analyst_ratings_upgrades IS 'Recent upgrades';
COMMENT ON INDEX idx_analyst_ratings_downgrades IS 'Recent downgrades';
COMMENT ON INDEX idx_analyst_ratings_consensus IS 'Consensus ratings';
COMMENT ON INDEX idx_analyst_ratings_notes IS 'Search analyst notes';