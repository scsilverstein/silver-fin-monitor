-- Create indexes for watchlists table
-- Support user watchlist operations

-- Index for user's watchlists
CREATE INDEX IF NOT EXISTS idx_watchlists_user 
ON watchlists(user_id, is_active, created_at DESC) 
WHERE is_active = true;

-- Index for watchlist type queries
CREATE INDEX IF NOT EXISTS idx_watchlists_type 
ON watchlists(watchlist_type, is_active) 
WHERE is_active = true;

-- Index for public watchlists
CREATE INDEX IF NOT EXISTS idx_watchlists_public 
ON watchlists(is_public, watchlist_type, created_at DESC) 
WHERE is_public = true AND is_active = true;

-- Full text search on watchlist names and descriptions
CREATE INDEX IF NOT EXISTS idx_watchlists_search 
ON watchlists USING GIN(
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- JSONB index for settings
CREATE INDEX IF NOT EXISTS idx_watchlists_settings 
ON watchlists USING GIN(settings);

-- Index for finding popular watchlists (if tracking subscribers)
CREATE INDEX IF NOT EXISTS idx_watchlists_popular 
ON watchlists((settings->>'subscriber_count')::int DESC) 
WHERE is_public = true AND settings ? 'subscriber_count';

-- Add index comments
COMMENT ON INDEX idx_watchlists_user IS 'User watchlist lookups';
COMMENT ON INDEX idx_watchlists_type IS 'Filter by watchlist type';
COMMENT ON INDEX idx_watchlists_public IS 'Public watchlist discovery';
COMMENT ON INDEX idx_watchlists_search IS 'Full text search on watchlists';
COMMENT ON INDEX idx_watchlists_settings IS 'Query watchlist settings';
COMMENT ON INDEX idx_watchlists_popular IS 'Find popular public watchlists';