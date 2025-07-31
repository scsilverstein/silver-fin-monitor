-- Create indexes for watchlist_items table
-- Optimize watchlist item operations

-- Primary index for watchlist queries
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist 
ON watchlist_items(watchlist_id, position);

-- Index for symbol lookups across watchlists
CREATE INDEX IF NOT EXISTS idx_watchlist_items_symbol 
ON watchlist_items(symbol, watchlist_id);

-- Index for user's symbols across all watchlists
CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_symbols 
ON watchlist_items(watchlist_id, symbol) 
WHERE watchlist_id IN (
    SELECT id FROM watchlists WHERE user_id IS NOT NULL
);

-- JSONB index for metadata queries
CREATE INDEX IF NOT EXISTS idx_watchlist_items_metadata 
ON watchlist_items USING GIN(metadata);

-- Index for alert-enabled items
CREATE INDEX IF NOT EXISTS idx_watchlist_items_alerts 
ON watchlist_items(watchlist_id, symbol) 
WHERE (metadata->>'alerts_enabled')::boolean = true;

-- Index for items with notes
CREATE INDEX IF NOT EXISTS idx_watchlist_items_notes 
ON watchlist_items(watchlist_id, added_at DESC) 
WHERE notes IS NOT NULL;

-- Index for position-based sorting
CREATE INDEX IF NOT EXISTS idx_watchlist_items_position 
ON watchlist_items(watchlist_id, position ASC NULLS LAST);

-- Add index comments
COMMENT ON INDEX idx_watchlist_items_watchlist IS 'Items by watchlist with position';
COMMENT ON INDEX idx_watchlist_items_symbol IS 'Symbol lookup across watchlists';
COMMENT ON INDEX idx_watchlist_items_user_symbols IS 'User symbol tracking';
COMMENT ON INDEX idx_watchlist_items_metadata IS 'Query item metadata';
COMMENT ON INDEX idx_watchlist_items_alerts IS 'Items with alerts enabled';
COMMENT ON INDEX idx_watchlist_items_notes IS 'Items with user notes';
COMMENT ON INDEX idx_watchlist_items_position IS 'Ordered display of items';