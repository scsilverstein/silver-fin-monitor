-- Create indexes for entities table
-- Core table requiring comprehensive indexing

-- Index for type-based queries
CREATE INDEX IF NOT EXISTS idx_entities_type 
ON entities(entity_type, created_at DESC);

-- Unique symbol lookup (critical for stocks)
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_symbol 
ON entities(symbol) 
WHERE symbol IS NOT NULL AND entity_type = 'stock';

-- Index for name searches
CREATE INDEX IF NOT EXISTS idx_entities_name_search 
ON entities USING GIN(to_tsvector('english', name));

-- Index for active entities
CREATE INDEX IF NOT EXISTS idx_entities_active 
ON entities(is_active, entity_type, name) 
WHERE is_active = true;

-- JSONB index for metadata queries
CREATE INDEX IF NOT EXISTS idx_entities_metadata 
ON entities USING GIN(metadata);

-- Index for sector/industry filtering
CREATE INDEX IF NOT EXISTS idx_entities_sector_industry 
ON entities(sector, industry) 
WHERE entity_type IN ('stock', 'company');

-- Index for market cap ranges
CREATE INDEX IF NOT EXISTS idx_entities_market_cap 
ON entities((metadata->>'market_cap')::numeric DESC) 
WHERE entity_type = 'stock' AND metadata ? 'market_cap';

-- Index for last updated tracking
CREATE INDEX IF NOT EXISTS idx_entities_updated 
ON entities(updated_at DESC) 
WHERE is_active = true;

-- Trigram index for fuzzy name matching
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm 
ON entities USING GIN(name gin_trgm_ops);

-- Add index comments
COMMENT ON INDEX idx_entities_type IS 'Filter entities by type';
COMMENT ON INDEX idx_entities_symbol IS 'Unique symbol lookup for stocks';
COMMENT ON INDEX idx_entities_name_search IS 'Full text search on entity names';
COMMENT ON INDEX idx_entities_active IS 'Quick lookup of active entities';
COMMENT ON INDEX idx_entities_metadata IS 'Query entity metadata';
COMMENT ON INDEX idx_entities_sector_industry IS 'Filter by sector and industry';
COMMENT ON INDEX idx_entities_market_cap IS 'Sort by market capitalization';
COMMENT ON INDEX idx_entities_updated IS 'Track recently updated entities';
COMMENT ON INDEX idx_entities_name_trgm IS 'Fuzzy name matching with trigrams';