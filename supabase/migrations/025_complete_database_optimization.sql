-- Complete Database Optimization and Integration
-- This migration improves the entire database schema for Silver Fin Monitor
-- Run AFTER completing the unified stock system migration (020-021)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- PART 1: COMPLETE MIGRATION CLEANUP
-- =====================================================

-- First, ensure all data has been migrated
DO $$
BEGIN
    -- Check if migration is complete
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'stock_symbols' 
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'Legacy tables still exist. Run migration 021 first!';
        -- Uncomment below after verifying migration
        -- DROP TABLE IF EXISTS stock_symbols CASCADE;
        -- DROP TABLE IF EXISTS stock_fundamentals CASCADE;
        -- DROP TABLE IF EXISTS stock_scanner_results CASCADE;
        -- DROP TABLE IF EXISTS stock_peer_groups CASCADE;
        -- DROP TABLE IF EXISTS stock_watchlist CASCADE;
        -- DROP TABLE IF EXISTS earnings_calendar CASCADE;
        -- DROP TABLE IF EXISTS earnings_performance CASCADE;
        -- DROP TABLE IF EXISTS earnings_estimates CASCADE;
        -- DROP TABLE IF EXISTS earnings_reports CASCADE;
        -- DROP TABLE IF EXISTS earnings_report_sections CASCADE;
        -- DROP TABLE IF EXISTS earnings_call_transcripts CASCADE;
        -- DROP TABLE IF EXISTS earnings_content_mapping CASCADE;
        -- DROP TABLE IF EXISTS options_contracts CASCADE;
        -- DROP TABLE IF EXISTS options_market_data CASCADE;
        -- DROP TABLE IF EXISTS options_value_analysis CASCADE;
        -- DROP TABLE IF EXISTS options_scanner_results CASCADE;
        -- DROP TABLE IF EXISTS options_strategies CASCADE;
        -- DROP TABLE IF EXISTS tech_stock_universe CASCADE;
    END IF;
END $$;

-- =====================================================
-- PART 2: INTEGRATE STOCK DATA WITH AI PROCESSING
-- =====================================================

-- Link entities to processed content
CREATE TABLE IF NOT EXISTS entity_content_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES processed_content(id) ON DELETE CASCADE,
    
    -- Relationship metadata
    relevance_score DECIMAL(5, 4), -- 0-1 score
    mention_type VARCHAR(50), -- 'primary', 'secondary', 'industry', 'competitor'
    mention_context TEXT, -- Extracted context around the mention
    sentiment_impact DECIMAL(5, 4), -- -1 to 1
    
    -- Extracted metrics
    extracted_data JSONB DEFAULT '{}', -- Any numbers, dates, or facts extracted
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, content_id)
);

-- Link entities to predictions
CREATE TABLE IF NOT EXISTS entity_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
    
    -- Prediction specifics for this entity
    prediction_impact VARCHAR(20), -- 'bullish', 'bearish', 'neutral'
    confidence_level DECIMAL(5, 4), -- 0-1
    price_target DECIMAL(12, 2),
    target_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, prediction_id)
);

-- =====================================================
-- PART 3: ENHANCED FEED SOURCE INTEGRATION
-- =====================================================

-- Add entity tracking to feed sources
ALTER TABLE feed_sources 
ADD COLUMN IF NOT EXISTS primary_entities UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS focus_sectors VARCHAR(50)[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reliability_score DECIMAL(5, 2) DEFAULT 50.0;

-- Feed source performance metrics
CREATE TABLE IF NOT EXISTS feed_source_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    
    -- Processing metrics
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    avg_processing_time_ms INTEGER,
    
    -- Content quality metrics
    avg_content_length INTEGER,
    unique_entities_mentioned INTEGER,
    prediction_accuracy_score DECIMAL(5, 2), -- Based on historical predictions
    
    -- Reliability metrics
    uptime_percent DECIMAL(5, 2),
    error_rate DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(source_id, metric_date)
);

-- =====================================================
-- PART 4: UNIFIED ANALYTICS LAYER
-- =====================================================

-- Master analytics table combining all insights
CREATE TABLE IF NOT EXISTS unified_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    analytics_date DATE NOT NULL,
    analytics_type VARCHAR(50) NOT NULL, -- 'market', 'fundamental', 'sentiment', 'technical', 'options'
    
    -- Composite scores
    overall_score DECIMAL(5, 2), -- 0-100
    momentum_score DECIMAL(5, 2),
    value_score DECIMAL(5, 2),
    sentiment_score DECIMAL(5, 2),
    risk_score DECIMAL(5, 2),
    
    -- Key metrics (type-specific)
    metrics JSONB NOT NULL,
    
    -- Signals and alerts
    signals JSONB DEFAULT '[]', -- Array of {type, strength, message}
    
    -- Data sources used
    source_count INTEGER,
    confidence_level DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, analytics_date, analytics_type)
);

-- =====================================================
-- PART 5: PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_entities_name_trgm ON entities USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_entities_active_liquid ON entities(symbol) 
    WHERE is_active = true AND (is_sp500 = true OR is_nasdaq100 = true);

-- Composite indexes for common join patterns
CREATE INDEX IF NOT EXISTS idx_market_data_daily_entity_date_close 
    ON market_data_daily(entity_id, market_date DESC, close_price);
CREATE INDEX IF NOT EXISTS idx_fundamental_metrics_entity_date_pe 
    ON fundamental_metrics(entity_id, metric_date DESC, pe_ratio);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_earnings_events_upcoming_confirmed 
    ON earnings_events(earnings_date, entity_id) 
    WHERE has_reported = false AND is_confirmed = true;
CREATE INDEX IF NOT EXISTS idx_options_chains_active_liquid 
    ON options_chains(entity_id, expiration) 
    WHERE is_active = true;

-- Text search indexes
CREATE INDEX IF NOT EXISTS idx_processed_content_search 
    ON processed_content USING GIN(to_tsvector('english', processed_text));
CREATE INDEX IF NOT EXISTS idx_daily_analysis_search 
    ON daily_analysis USING GIN(to_tsvector('english', overall_summary));

-- =====================================================
-- PART 6: MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Market overview dashboard view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_overview AS
WITH latest_data AS (
    SELECT DISTINCT ON (e.id) 
        e.id,
        e.symbol,
        e.name,
        s.sector_name,
        i.industry_name,
        md.close_price,
        md.volume,
        da.return_1d,
        da.return_5d,
        da.return_1m,
        da.volatility_30d,
        fm.pe_ratio,
        fm.market_cap,
        fm.beta
    FROM entities e
    JOIN entity_classifications ec ON e.id = ec.entity_id
    JOIN industries i ON ec.industry_id = i.id
    JOIN sectors s ON i.sector_id = s.id
    JOIN market_data_daily md ON e.id = md.entity_id
    JOIN daily_analytics da ON e.id = da.entity_id
    JOIN fundamental_metrics fm ON e.id = fm.entity_id
    WHERE e.is_active = true
    ORDER BY e.id, md.market_date DESC, da.analytics_date DESC, fm.metric_date DESC
)
SELECT * FROM latest_data;

CREATE UNIQUE INDEX idx_mv_market_overview_id ON mv_market_overview(id);
CREATE INDEX idx_mv_market_overview_symbol ON mv_market_overview(symbol);
CREATE INDEX idx_mv_market_overview_sector ON mv_market_overview(sector_name);
CREATE INDEX idx_mv_market_overview_return ON mv_market_overview(return_1d DESC);

-- Entity insights view combining all data sources
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_entity_insights AS
SELECT 
    e.id,
    e.symbol,
    e.name,
    -- Market data
    jsonb_build_object(
        'price', md.close_price,
        'volume', md.volume,
        'return_1d', da.return_1d,
        'return_1m', da.return_1m,
        'volatility', da.volatility_30d
    ) as market_metrics,
    -- Fundamentals
    jsonb_build_object(
        'pe_ratio', fm.pe_ratio,
        'market_cap', fm.market_cap,
        'beta', fm.beta,
        'analyst_rating', fm.analyst_rating
    ) as fundamental_metrics,
    -- Upcoming events
    jsonb_build_object(
        'next_earnings', ee.earnings_date,
        'eps_estimate', ee.eps_estimate
    ) as upcoming_events,
    -- Recent mentions
    (
        SELECT jsonb_agg(jsonb_build_object(
            'date', pc.created_at::date,
            'summary', pc.summary,
            'sentiment', pc.sentiment_score
        ) ORDER BY pc.created_at DESC)
        FROM entity_content_mapping ecm
        JOIN processed_content pc ON ecm.content_id = pc.id
        WHERE ecm.entity_id = e.id
        AND pc.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        LIMIT 5
    ) as recent_mentions,
    -- Active predictions
    (
        SELECT jsonb_agg(jsonb_build_object(
            'prediction', p.prediction_text,
            'confidence', ep.confidence_level,
            'target', ep.price_target
        ) ORDER BY p.created_at DESC)
        FROM entity_predictions ep
        JOIN predictions p ON ep.prediction_id = p.id
        WHERE ep.entity_id = e.id
        AND p.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        LIMIT 3
    ) as active_predictions
FROM entities e
LEFT JOIN LATERAL (
    SELECT * FROM market_data_daily 
    WHERE entity_id = e.id 
    ORDER BY market_date DESC 
    LIMIT 1
) md ON true
LEFT JOIN LATERAL (
    SELECT * FROM daily_analytics 
    WHERE entity_id = e.id 
    ORDER BY analytics_date DESC 
    LIMIT 1
) da ON true
LEFT JOIN LATERAL (
    SELECT * FROM fundamental_metrics 
    WHERE entity_id = e.id 
    ORDER BY metric_date DESC 
    LIMIT 1
) fm ON true
LEFT JOIN LATERAL (
    SELECT * FROM earnings_events 
    WHERE entity_id = e.id 
    AND has_reported = false 
    ORDER BY earnings_date 
    LIMIT 1
) ee ON true
WHERE e.is_active = true;

CREATE UNIQUE INDEX idx_mv_entity_insights_id ON mv_entity_insights(id);
CREATE INDEX idx_mv_entity_insights_symbol ON mv_entity_insights(symbol);

-- =====================================================
-- PART 7: DATA QUALITY CONSTRAINTS
-- =====================================================

-- Add check constraints for data quality
ALTER TABLE market_data_daily 
ADD CONSTRAINT check_price_relationships 
CHECK (high_price >= low_price AND high_price >= open_price AND high_price >= close_price);

ALTER TABLE fundamental_metrics
ADD CONSTRAINT check_positive_metrics
CHECK (market_cap >= 0 AND avg_volume_30d >= 0);

ALTER TABLE options_quotes
ADD CONSTRAINT check_spread_validity
CHECK (ask >= bid OR (ask IS NULL AND bid IS NULL));

-- =====================================================
-- PART 8: ENHANCED FUNCTIONS
-- =====================================================

-- Function to get complete market context for an entity
CREATE OR REPLACE FUNCTION get_entity_market_context(p_symbol VARCHAR)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH entity_data AS (
        SELECT e.* FROM entities e WHERE e.symbol = p_symbol
    ),
    peer_performance AS (
        SELECT 
            AVG(da.return_1d) as sector_avg_return_1d,
            AVG(da.return_1m) as sector_avg_return_1m,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fm.pe_ratio) as sector_median_pe
        FROM entity_data ed
        JOIN entity_classifications ec1 ON ec1.entity_id = ed.id
        JOIN entity_classifications ec2 ON ec2.industry_id = ec1.industry_id
        JOIN entities e ON e.id = ec2.entity_id
        JOIN daily_analytics da ON da.entity_id = e.id
        JOIN fundamental_metrics fm ON fm.entity_id = e.id
        WHERE da.analytics_date = CURRENT_DATE
        AND fm.metric_date = CURRENT_DATE
    ),
    recent_news AS (
        SELECT json_agg(json_build_object(
            'date', pc.created_at,
            'title', rf.title,
            'summary', pc.summary,
            'sentiment', pc.sentiment_score,
            'source', fs.name
        ) ORDER BY pc.created_at DESC) as news_items
        FROM entity_content_mapping ecm
        JOIN processed_content pc ON ecm.content_id = pc.id
        JOIN raw_feeds rf ON rf.id = pc.raw_feed_id
        JOIN feed_sources fs ON fs.id = rf.source_id
        JOIN entity_data ed ON ed.id = ecm.entity_id
        WHERE pc.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        LIMIT 10
    ),
    options_activity AS (
        SELECT 
            SUM(oq.volume) FILTER (WHERE oc.contract_type = 'call') as call_volume,
            SUM(oq.volume) FILTER (WHERE oc.contract_type = 'put') as put_volume,
            AVG(oq.implied_volatility) as avg_iv
        FROM entity_data ed
        JOIN options_chains oc ON oc.entity_id = ed.id
        JOIN options_quotes oq ON oq.option_id = oc.id
        WHERE oq.quote_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 day'
    )
    SELECT json_build_object(
        'entity', row_to_json(ed.*),
        'market_performance', json_build_object(
            'current', (SELECT row_to_json(x.*) FROM (
                SELECT md.close_price, md.volume, da.return_1d, da.return_5d, da.return_1m
                FROM market_data_daily md
                JOIN daily_analytics da ON da.entity_id = md.entity_id AND da.analytics_date = md.market_date
                WHERE md.entity_id = ed.id
                ORDER BY md.market_date DESC LIMIT 1
            ) x),
            'vs_sector', row_to_json(pp.*)
        ),
        'recent_news', rn.news_items,
        'options_flow', row_to_json(oa.*),
        'technical_signals', (
            SELECT json_agg(json_build_object(
                'indicator', 
                CASE 
                    WHEN ta.rsi_14 > 70 THEN 'RSI Overbought'
                    WHEN ta.rsi_14 < 30 THEN 'RSI Oversold'
                    WHEN ta.macd_histogram > 0 AND LAG(ta.macd_histogram) OVER (ORDER BY ta.analysis_date) < 0 THEN 'MACD Bullish Cross'
                    WHEN ta.macd_histogram < 0 AND LAG(ta.macd_histogram) OVER (ORDER BY ta.analysis_date) > 0 THEN 'MACD Bearish Cross'
                END,
                'value', 
                CASE 
                    WHEN ta.rsi_14 > 70 OR ta.rsi_14 < 30 THEN ta.rsi_14
                    ELSE ta.macd_histogram
                END
            ))
            FROM technical_analysis ta
            WHERE ta.entity_id = ed.id
            AND ta.analysis_date >= CURRENT_DATE - 5
        )
    ) INTO result
    FROM entity_data ed
    CROSS JOIN peer_performance pp
    CROSS JOIN recent_news rn
    CROSS JOIN options_activity oa;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze cross-asset correlations
CREATE OR REPLACE FUNCTION calculate_correlation_matrix(
    p_entity_ids UUID[],
    p_lookback_days INTEGER DEFAULT 30
) RETURNS TABLE (
    entity1_id UUID,
    entity2_id UUID,
    correlation DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH returns_data AS (
        SELECT 
            entity_id,
            analytics_date,
            return_1d
        FROM daily_analytics
        WHERE entity_id = ANY(p_entity_ids)
        AND analytics_date >= CURRENT_DATE - p_lookback_days
    ),
    correlations AS (
        SELECT 
            r1.entity_id as entity1_id,
            r2.entity_id as entity2_id,
            CORR(r1.return_1d, r2.return_1d) as correlation
        FROM returns_data r1
        JOIN returns_data r2 ON r1.analytics_date = r2.analytics_date
        WHERE r1.entity_id < r2.entity_id
        GROUP BY r1.entity_id, r2.entity_id
    )
    SELECT * FROM correlations
    WHERE correlation IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 9: AUTOMATED MAINTENANCE
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_overview;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_insights;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_movers;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data(p_retention_days INTEGER DEFAULT 365)
RETURNS TABLE (
    table_name TEXT,
    rows_deleted BIGINT
) AS $$
DECLARE
    v_cutoff_date DATE := CURRENT_DATE - p_retention_days;
BEGIN
    -- Clean market_data_intraday (keep 30 days)
    DELETE FROM market_data_intraday 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN QUERY SELECT 'market_data_intraday'::TEXT, rows_deleted;
    
    -- Clean old scanner results (keep 90 days)
    DELETE FROM scanner_results 
    WHERE scan_date < CURRENT_DATE - 90;
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN QUERY SELECT 'scanner_results'::TEXT, rows_deleted;
    
    -- Clean old job queue entries
    DELETE FROM job_queue 
    WHERE status IN ('completed', 'failed') 
    AND completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN QUERY SELECT 'job_queue'::TEXT, rows_deleted;
    
    -- Archive old options quotes (keep 180 days of detailed data)
    DELETE FROM options_quotes 
    WHERE quote_timestamp < CURRENT_TIMESTAMP - INTERVAL '180 days';
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN QUERY SELECT 'options_quotes'::TEXT, rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 10: MONITORING AND ANALYTICS
-- =====================================================

-- System health monitoring table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metric_type VARCHAR(50) NOT NULL,
    
    -- Database metrics
    total_entities INTEGER,
    active_entities INTEGER,
    data_freshness_hours INTEGER, -- Hours since last update
    
    -- Processing metrics
    queue_depth INTEGER,
    failed_jobs_24h INTEGER,
    avg_processing_time_ms INTEGER,
    
    -- Storage metrics
    database_size_mb BIGINT,
    largest_table VARCHAR(100),
    largest_table_size_mb BIGINT,
    
    -- Performance metrics
    slow_queries_count INTEGER,
    avg_query_time_ms INTEGER,
    cache_hit_ratio DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create monitoring function
CREATE OR REPLACE FUNCTION capture_system_health_metrics()
RETURNS void AS $$
INSERT INTO system_health_metrics (
    metric_type,
    total_entities,
    active_entities,
    data_freshness_hours,
    queue_depth,
    failed_jobs_24h,
    database_size_mb,
    largest_table,
    largest_table_size_mb
)
SELECT 
    'daily_snapshot' as metric_type,
    (SELECT COUNT(*) FROM entities) as total_entities,
    (SELECT COUNT(*) FROM entities WHERE is_active = true) as active_entities,
    (SELECT EXTRACT(HOUR FROM NOW() - MAX(market_date)) FROM market_data_daily) as data_freshness_hours,
    (SELECT COUNT(*) FROM job_queue WHERE status = 'pending') as queue_depth,
    (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_jobs_24h,
    (SELECT pg_database_size(current_database()) / 1024 / 1024) as database_size_mb,
    (SELECT relname FROM pg_class WHERE relkind = 'r' ORDER BY relpages DESC LIMIT 1) as largest_table,
    (SELECT relpages * 8 / 1024 FROM pg_class WHERE relkind = 'r' ORDER BY relpages DESC LIMIT 1) as largest_table_size_mb;
$$ LANGUAGE sql;

-- =====================================================
-- PART 11: FINAL OPTIMIZATION SETTINGS
-- =====================================================

-- Update table statistics for query planner
ANALYZE entities;
ANALYZE market_data_daily;
ANALYZE fundamental_metrics;
ANALYZE options_chains;
ANALYZE options_quotes;
ANALYZE daily_analytics;
ANALYZE scanner_results;

-- Automated maintenance (requires pg_cron extension)
-- Uncomment when pg_cron is available:

-- SELECT cron.schedule(
--     'refresh-materialized-views',
--     '0 */4 * * *', -- Every 4 hours
--     $$SELECT refresh_all_materialized_views()$$
-- );

-- SELECT cron.schedule(
--     'cleanup-old-data',
--     '0 2 * * *', -- Daily at 2 AM
--     $$SELECT cleanup_old_data()$$
-- );

-- SELECT cron.schedule(
--     'capture-health-metrics',
--     '0 0 * * *', -- Daily at midnight
--     $$SELECT capture_system_health_metrics()$$
-- );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE entity_content_mapping IS 'Links entities to processed content with relevance scoring';
COMMENT ON TABLE entity_predictions IS 'Maps AI predictions to specific entities';
COMMENT ON TABLE unified_analytics IS 'Consolidated analytics across all data sources';
COMMENT ON TABLE system_health_metrics IS 'Database and system performance monitoring';
COMMENT ON MATERIALIZED VIEW mv_market_overview IS 'Pre-computed market dashboard data';
COMMENT ON MATERIALIZED VIEW mv_entity_insights IS 'Complete entity information with all related data';
COMMENT ON FUNCTION get_entity_market_context IS 'Returns comprehensive market context for a given symbol';
COMMENT ON FUNCTION calculate_correlation_matrix IS 'Calculates correlation between multiple entities';