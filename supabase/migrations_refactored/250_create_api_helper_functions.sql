-- Create API helper functions
-- Functions to support API operations and data formatting

-- Function to format API response
CREATE OR REPLACE FUNCTION format_api_response(
    success BOOLEAN,
    data JSONB DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    meta JSONB DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'success', success,
        'timestamp', NOW(),
        'data', CASE WHEN success THEN data ELSE NULL END,
        'error', CASE WHEN NOT success THEN error_message ELSE NULL END,
        'meta', meta
    );
END;
$$ LANGUAGE plpgsql;

-- Function to paginate results
CREATE OR REPLACE FUNCTION paginate_results(
    total_count INTEGER,
    page_size INTEGER DEFAULT 20,
    current_page INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    total_pages INTEGER;
    has_next BOOLEAN;
    has_prev BOOLEAN;
BEGIN
    total_pages := CEIL(total_count::DECIMAL / page_size);
    has_next := current_page < total_pages;
    has_prev := current_page > 1;
    
    RETURN jsonb_build_object(
        'total_count', total_count,
        'page_size', page_size,
        'current_page', current_page,
        'total_pages', total_pages,
        'has_next', has_next,
        'has_previous', has_prev,
        'next_page', CASE WHEN has_next THEN current_page + 1 ELSE NULL END,
        'previous_page', CASE WHEN has_prev THEN current_page - 1 ELSE NULL END
    );
END;
$$ LANGUAGE plpgsql;

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(api_key TEXT) RETURNS TABLE (
    is_valid BOOLEAN,
    user_id UUID,
    rate_limit INTEGER,
    usage_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE as is_valid,
        ak.user_id,
        ak.rate_limit,
        ak.usage_count
    FROM api_keys ak
    WHERE ak.key_hash = DIGEST(api_key, 'sha256')
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW());
    
    -- If no valid key found, return invalid
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
    api_key_hash BYTEA,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    response_time_ms INTEGER DEFAULT NULL,
    status_code INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update usage count
    UPDATE api_keys 
    SET 
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE key_hash = api_key_hash;
    
    -- Log the request
    INSERT INTO api_usage_logs (
        api_key_hash,
        endpoint,
        method,
        response_time_ms,
        status_code,
        created_at
    ) VALUES (
        api_key_hash,
        endpoint,
        method,
        response_time_ms,
        status_code,
        NOW()
    );
    
    RETURN TRUE;
EXCEPTION 
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    api_key_hash BYTEA,
    window_minutes INTEGER DEFAULT 60
) RETURNS TABLE (
    is_allowed BOOLEAN,
    requests_made INTEGER,
    requests_remaining INTEGER,
    reset_time TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    key_info RECORD;
    current_usage INTEGER;
    reset_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get API key info
    SELECT rate_limit INTO key_info
    FROM api_keys 
    WHERE key_hash = api_key_hash
    AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, NOW();
        RETURN;
    END IF;
    
    -- Calculate window start time
    reset_timestamp := DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour';
    
    -- Count requests in current window
    SELECT COUNT(*) INTO current_usage
    FROM api_usage_logs
    WHERE api_key_hash = check_rate_limit.api_key_hash
    AND created_at >= NOW() - (window_minutes || ' minutes')::INTERVAL;
    
    RETURN QUERY SELECT 
        (current_usage < key_info.rate_limit),
        current_usage,
        GREATEST(0, key_info.rate_limit - current_usage),
        reset_timestamp;
END;
$$ LANGUAGE plpgsql;

-- Function to format stock data for API
CREATE OR REPLACE FUNCTION format_stock_data_api(
    stock_symbol VARCHAR(20),
    include_technicals BOOLEAN DEFAULT TRUE,
    include_fundamentals BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    stock_info JSONB;
    price_data JSONB;
    technical_data JSONB;
    fundamental_data JSONB;
BEGIN
    -- Get basic stock info
    SELECT jsonb_build_object(
        'symbol', e.symbol,
        'name', e.name,
        'sector', e.sector,
        'industry', e.industry,
        'market_cap', e.metadata->>'market_cap'
    ) INTO stock_info
    FROM entities e
    WHERE e.symbol = stock_symbol AND e.entity_type = 'stock';
    
    -- Get latest price data
    SELECT jsonb_build_object(
        'price', sd.close,
        'change', sd.change_percent,
        'volume', sd.volume,
        'high', sd.high,
        'low', sd.low,
        'open', sd.open,
        'date', sd.date
    ) INTO price_data
    FROM stock_data sd
    WHERE sd.symbol = stock_symbol
    ORDER BY sd.date DESC
    LIMIT 1;
    
    -- Get technical indicators if requested
    IF include_technicals THEN
        SELECT jsonb_object_agg(
            ti.indicator_type,
            ti.values
        ) INTO technical_data
        FROM technical_indicators ti
        WHERE ti.symbol = stock_symbol
        AND ti.date = CURRENT_DATE;
    END IF;
    
    -- Get fundamental data if requested
    IF include_fundamentals THEN
        SELECT jsonb_build_object(
            'pe_ratio', e.metadata->>'pe_ratio',
            'forward_pe', e.metadata->>'forward_pe',
            'peg_ratio', e.metadata->>'peg_ratio',
            'dividend_yield', e.metadata->>'dividend_yield'
        ) INTO fundamental_data
        FROM entities e
        WHERE e.symbol = stock_symbol AND e.entity_type = 'stock';
    END IF;
    
    -- Combine all data
    result := COALESCE(stock_info, '{}') || 
              jsonb_build_object('price_data', COALESCE(price_data, '{}'));
    
    IF include_technicals THEN
        result := result || jsonb_build_object('technicals', COALESCE(technical_data, '{}'));
    END IF;
    
    IF include_fundamentals THEN
        result := result || jsonb_build_object('fundamentals', COALESCE(fundamental_data, '{}'));
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to search entities for API
CREATE OR REPLACE FUNCTION search_entities_api(
    search_term TEXT,
    entity_types VARCHAR[] DEFAULT NULL,
    limit_results INTEGER DEFAULT 20
) RETURNS JSONB AS $$
DECLARE
    results JSONB;
BEGIN
    WITH search_results AS (
        SELECT 
            e.id,
            e.name,
            e.entity_type,
            e.symbol,
            e.sector,
            e.industry,
            -- Calculate relevance score
            CASE 
                WHEN LOWER(e.name) = LOWER(search_term) THEN 100
                WHEN LOWER(e.symbol) = LOWER(search_term) THEN 95
                WHEN LOWER(e.name) ILIKE LOWER(search_term) || '%' THEN 90
                WHEN LOWER(e.symbol) ILIKE LOWER(search_term) || '%' THEN 85
                ELSE ts_rank(to_tsvector('english', e.name), plainto_tsquery('english', search_term)) * 50
            END as relevance_score
        FROM entities e
        WHERE e.is_active = true
        AND (entity_types IS NULL OR e.entity_type = ANY(entity_types))
        AND (
            LOWER(e.name) ILIKE '%' || LOWER(search_term) || '%' OR
            LOWER(e.symbol) ILIKE '%' || LOWER(search_term) || '%' OR
            to_tsvector('english', e.name) @@ plainto_tsquery('english', search_term)
        )
        ORDER BY relevance_score DESC
        LIMIT limit_results
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', sr.id,
            'name', sr.name,
            'type', sr.entity_type,
            'symbol', sr.symbol,
            'sector', sr.sector,
            'industry', sr.industry,
            'relevance', ROUND(sr.relevance_score, 2)
        )
    ) INTO results
    FROM search_results sr;
    
    RETURN COALESCE(results, '[]');
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard data for API
CREATE OR REPLACE FUNCTION get_dashboard_data_api() RETURNS JSONB AS $$
DECLARE
    dashboard_data JSONB := '{}';
    market_summary JSONB;
    latest_analysis JSONB;
    top_predictions JSONB;
    active_alerts INTEGER;
BEGIN
    -- Get market summary
    SELECT jsonb_build_object(
        'total_stocks', COUNT(*),
        'sectors', COUNT(DISTINCT sector),
        'last_updated', MAX(updated_at)
    ) INTO market_summary
    FROM entities
    WHERE entity_type = 'stock' AND is_active = true;
    
    -- Get latest analysis
    SELECT jsonb_build_object(
        'date', da.analysis_date,
        'sentiment', da.market_sentiment,
        'confidence', da.confidence_score,
        'summary', LEFT(da.overall_summary, 200) || '...',
        'themes', da.key_themes
    ) INTO latest_analysis
    FROM daily_analysis da
    ORDER BY da.analysis_date DESC
    LIMIT 1;
    
    -- Get top predictions
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'type', p.prediction_type,
            'text', LEFT(p.prediction_text, 150) || '...',
            'confidence', p.confidence_level,
            'horizon', p.time_horizon
        )
    ) INTO top_predictions
    FROM predictions p
    WHERE p.confidence_level > 0.7
    AND p.is_evaluated = false
    ORDER BY p.confidence_level DESC, p.created_at DESC
    LIMIT 5;
    
    -- Get active alerts count
    SELECT COUNT(*) INTO active_alerts
    FROM alerts
    WHERE is_active = true AND status = 'pending';
    
    -- Combine dashboard data
    dashboard_data := jsonb_build_object(
        'market_summary', COALESCE(market_summary, '{}'),
        'latest_analysis', COALESCE(latest_analysis, '{}'),
        'top_predictions', COALESCE(top_predictions, '[]'),
        'active_alerts', active_alerts,
        'timestamp', NOW()
    );
    
    RETURN dashboard_data;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION format_api_response IS 'Format standardized API response structure';
COMMENT ON FUNCTION paginate_results IS 'Generate pagination metadata for API responses';
COMMENT ON FUNCTION validate_api_key IS 'Validate API key and return user info';
COMMENT ON FUNCTION log_api_usage IS 'Log API usage for rate limiting and analytics';
COMMENT ON FUNCTION check_rate_limit IS 'Check if API key has exceeded rate limits';
COMMENT ON FUNCTION format_stock_data_api IS 'Format comprehensive stock data for API response';
COMMENT ON FUNCTION search_entities_api IS 'Search entities with relevance scoring for API';
COMMENT ON FUNCTION get_dashboard_data_api IS 'Get dashboard data formatted for API response';