-- Create cache management functions
-- Database-based caching system functions

-- Function to get cached value
CREATE OR REPLACE FUNCTION cache_get(cache_key VARCHAR(255)) RETURNS JSONB AS $$
DECLARE
    cached_value JSONB;
BEGIN
    SELECT value INTO cached_value 
    FROM cache_store 
    WHERE key = cache_key 
    AND expires_at > NOW();
    
    RETURN cached_value;
END;
$$ LANGUAGE plpgsql;

-- Function to set cached value
CREATE OR REPLACE FUNCTION cache_set(
    cache_key VARCHAR(255),
    cache_value JSONB,
    ttl_seconds INTEGER DEFAULT 3600
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO cache_store (key, value, expires_at)
    VALUES (cache_key, cache_value, NOW() + (ttl_seconds * INTERVAL '1 second'))
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to delete cached value
CREATE OR REPLACE FUNCTION cache_delete(cache_key VARCHAR(255)) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM cache_store WHERE key = cache_key;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to delete cached values by pattern
CREATE OR REPLACE FUNCTION cache_delete_pattern(pattern VARCHAR(255)) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_store WHERE key LIKE pattern;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats() RETURNS TABLE (
    total_entries BIGINT,
    expired_entries BIGINT,
    total_size_mb NUMERIC,
    hit_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_entries,
        ROUND(SUM(pg_column_size(value))::NUMERIC / 1024 / 1024, 2) as total_size_mb,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE expires_at > NOW()))::NUMERIC / COUNT(*) * 100, 2)
            ELSE 0
        END as hit_ratio
    FROM cache_store;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Clean up expired cache entries
    DELETE FROM cache_store WHERE expires_at < NOW();
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate cache by tags
CREATE OR REPLACE FUNCTION cache_invalidate_tags(tags TEXT[]) RETURNS INTEGER AS $$
DECLARE
    tag TEXT;
    deleted_count INTEGER := 0;
    total_deleted INTEGER := 0;
BEGIN
    FOREACH tag IN ARRAY tags LOOP
        DELETE FROM cache_store 
        WHERE value->'tags' ? tag;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
    END LOOP;
    
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION cache_get IS 'Retrieve value from cache if not expired';
COMMENT ON FUNCTION cache_set IS 'Store value in cache with TTL';
COMMENT ON FUNCTION cache_delete IS 'Delete specific cache entry';
COMMENT ON FUNCTION cache_delete_pattern IS 'Delete cache entries matching pattern';
COMMENT ON FUNCTION get_cache_stats IS 'Get cache usage statistics';
COMMENT ON FUNCTION cleanup_expired_cache IS 'Remove all expired cache entries';
COMMENT ON FUNCTION cache_invalidate_tags IS 'Invalidate cache entries by tags';