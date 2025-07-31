-- Create indexes for cache_store table
-- Critical for cache performance

-- Primary index for cache lookups (already covered by primary key)
-- But we need an index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_cache_store_expires 
ON cache_store(expires_at) 
WHERE expires_at IS NOT NULL;

-- Index for cache key pattern matching
CREATE INDEX IF NOT EXISTS idx_cache_store_key_pattern 
ON cache_store(key varchar_pattern_ops);

-- Index for tag-based cache invalidation
CREATE INDEX IF NOT EXISTS idx_cache_store_tags 
ON cache_store USING GIN((value->'tags')) 
WHERE value ? 'tags';

-- Index for cache statistics (if tracking hit counts)
CREATE INDEX IF NOT EXISTS idx_cache_store_hits 
ON cache_store((value->>'hit_count')::int DESC) 
WHERE value ? 'hit_count';

-- Index for finding large cache entries
CREATE INDEX IF NOT EXISTS idx_cache_store_size 
ON cache_store(pg_column_size(value) DESC);

-- Index for cache namespace queries
CREATE INDEX IF NOT EXISTS idx_cache_store_namespace 
ON cache_store(split_part(key, ':', 1));

-- Add index comments
COMMENT ON INDEX idx_cache_store_expires IS 'Critical: Efficient cleanup of expired entries';
COMMENT ON INDEX idx_cache_store_key_pattern IS 'Pattern matching on cache keys';
COMMENT ON INDEX idx_cache_store_tags IS 'Tag-based cache invalidation';
COMMENT ON INDEX idx_cache_store_hits IS 'Track most frequently accessed items';
COMMENT ON INDEX idx_cache_store_size IS 'Find large cache entries';
COMMENT ON INDEX idx_cache_store_namespace IS 'Query by cache namespace';