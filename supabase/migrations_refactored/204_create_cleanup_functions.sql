-- Create data cleanup and maintenance functions
-- Automated cleanup for system maintenance

-- Main cleanup function for expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data() RETURNS TABLE (
    table_name TEXT,
    records_cleaned INTEGER
) AS $$
DECLARE
    cache_cleaned INTEGER := 0;
    jobs_cleaned INTEGER := 0;
    alerts_cleaned INTEGER := 0;
    news_cleaned INTEGER := 0;
BEGIN
    -- Clean up expired cache entries
    SELECT cleanup_expired_cache() INTO cache_cleaned;
    
    -- Clean up old completed/failed jobs (older than 7 days)
    DELETE FROM job_queue 
    WHERE status IN ('completed', 'failed') 
    AND completed_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS jobs_cleaned = ROW_COUNT;
    
    -- Clean up resolved alerts older than 30 days
    DELETE FROM alerts 
    WHERE status = 'resolved' 
    AND resolved_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS alerts_cleaned = ROW_COUNT;
    
    -- Clean up old news items (older than 1 year)
    DELETE FROM news_items 
    WHERE published_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS news_cleaned = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('cache_store', cache_cleaned),
        ('job_queue', jobs_cleaned),
        ('alerts', alerts_cleaned),
        ('news_items', news_cleaned);
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old stock data (keep only recent)
CREATE OR REPLACE FUNCTION cleanup_old_stock_data(days_to_keep INTEGER DEFAULT 365) RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    DELETE FROM stock_data 
    WHERE date < CURRENT_DATE - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup processed content (keep summaries, remove full text)
CREATE OR REPLACE FUNCTION cleanup_old_processed_content(days_to_keep INTEGER DEFAULT 90) RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Clear full processed text for old content, keep summaries
    UPDATE processed_content 
    SET processed_text = NULL
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND processed_text IS NOT NULL;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old raw feeds
CREATE OR REPLACE FUNCTION archive_old_raw_feeds(days_to_keep INTEGER DEFAULT 180) RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER := 0;
BEGIN
    -- Move old raw feeds to an archive table (if it exists) or delete
    DELETE FROM raw_feeds 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND processing_status = 'completed';
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup orphaned data
CREATE OR REPLACE FUNCTION cleanup_orphaned_data() RETURNS TABLE (
    cleanup_type TEXT,
    records_cleaned INTEGER
) AS $$
DECLARE
    processed_content_cleaned INTEGER := 0;
    watchlist_items_cleaned INTEGER := 0;
    alerts_cleaned INTEGER := 0;
BEGIN
    -- Clean up processed content without raw feeds
    DELETE FROM processed_content 
    WHERE raw_feed_id NOT IN (SELECT id FROM raw_feeds);
    GET DIAGNOSTICS processed_content_cleaned = ROW_COUNT;
    
    -- Clean up watchlist items for deleted watchlists
    DELETE FROM watchlist_items 
    WHERE watchlist_id NOT IN (SELECT id FROM watchlists);
    GET DIAGNOSTICS watchlist_items_cleaned = ROW_COUNT;
    
    -- Clean up alerts for non-existent entities
    DELETE FROM alerts 
    WHERE entity_id IS NOT NULL 
    AND entity_id NOT IN (SELECT id FROM entities);
    GET DIAGNOSTICS alerts_cleaned = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('processed_content', processed_content_cleaned),
        ('watchlist_items', watchlist_items_cleaned),
        ('alerts', alerts_cleaned);
END;
$$ LANGUAGE plpgsql;

-- Function to optimize database tables
CREATE OR REPLACE FUNCTION optimize_database_tables() RETURNS TEXT AS $$
DECLARE
    table_record RECORD;
    result_text TEXT := 'Database optimization completed. Tables processed: ';
BEGIN
    -- Vacuum and analyze high-traffic tables
    FOR table_record IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'stock_data', 'raw_feeds', 'processed_content', 
            'job_queue', 'cache_store', 'daily_analysis'
        )
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || table_record.tablename;
        result_text := result_text || table_record.tablename || ', ';
    END LOOP;
    
    RETURN rtrim(result_text, ', ');
END;
$$ LANGUAGE plpgsql;

-- Function to get database size statistics
CREATE OR REPLACE FUNCTION get_database_size_stats() RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    size_mb NUMERIC,
    index_size_mb NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT as table_name,
        t.n_tup_ins - t.n_tup_del as row_count,
        ROUND((pg_total_relation_size(c.oid) - pg_indexes_size(c.oid))::NUMERIC / 1024 / 1024, 2) as size_mb,
        ROUND(pg_indexes_size(c.oid)::NUMERIC / 1024 / 1024, 2) as index_size_mb
    FROM pg_stat_user_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION cleanup_expired_data IS 'Clean up expired data across multiple tables';
COMMENT ON FUNCTION cleanup_old_stock_data IS 'Remove old stock data beyond retention period';
COMMENT ON FUNCTION cleanup_old_processed_content IS 'Remove full text from old processed content';
COMMENT ON FUNCTION archive_old_raw_feeds IS 'Archive or delete old raw feed data';
COMMENT ON FUNCTION cleanup_orphaned_data IS 'Remove orphaned records with missing foreign keys';
COMMENT ON FUNCTION optimize_database_tables IS 'Vacuum and analyze high-traffic tables';
COMMENT ON FUNCTION get_database_size_stats IS 'Get table size and row count statistics';