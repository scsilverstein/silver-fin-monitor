-- Create utility and helper functions
-- General purpose functions for data processing and utilities

-- Function to validate JSON schema
CREATE OR REPLACE FUNCTION validate_json_schema(
    json_data JSONB,
    required_fields TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    field TEXT;
BEGIN
    -- Check if all required fields are present
    FOREACH field IN ARRAY required_fields LOOP
        IF NOT (json_data ? field) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to safely convert text to numeric
CREATE OR REPLACE FUNCTION safe_numeric(input_text TEXT) RETURNS NUMERIC AS $$
BEGIN
    RETURN input_text::NUMERIC;
EXCEPTION 
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate percentage change
CREATE OR REPLACE FUNCTION calculate_percentage_change(
    old_value NUMERIC,
    new_value NUMERIC
) RETURNS DECIMAL(10, 4) AS $$
BEGIN
    IF old_value IS NULL OR old_value = 0 THEN
        RETURN NULL;
    END IF;
    
    RETURN ((new_value - old_value) / old_value * 100)::DECIMAL(10, 4);
END;
$$ LANGUAGE plpgsql;

-- Function to normalize text for search
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT) RETURNS TEXT AS $$
BEGIN
    IF input_text IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Convert to lowercase, remove extra spaces, and trim
    RETURN REGEXP_REPLACE(
        TRIM(LOWER(input_text)), 
        '\s+', 
        ' ', 
        'g'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to extract stock symbol from text
CREATE OR REPLACE FUNCTION extract_stock_symbols(input_text TEXT) RETURNS TEXT[] AS $$
DECLARE
    symbols TEXT[] := '{}';
    symbol_pattern TEXT := '\$?([A-Z]{1,5})\b';
    matches TEXT[];
    match TEXT;
BEGIN
    IF input_text IS NULL THEN
        RETURN symbols;
    END IF;
    
    -- Find all potential stock symbols
    SELECT ARRAY_AGG(DISTINCT m[1]) INTO matches
    FROM REGEXP_MATCHES(UPPER(input_text), symbol_pattern, 'g') AS m;
    
    -- Validate against entities table
    IF matches IS NOT NULL THEN
        SELECT ARRAY_AGG(DISTINCT e.symbol) INTO symbols
        FROM entities e
        WHERE e.symbol = ANY(matches)
        AND e.entity_type = 'stock';
    END IF;
    
    RETURN COALESCE(symbols, '{}');
END;
$$ LANGUAGE plpgsql;

-- Function to generate UUID from text
CREATE OR REPLACE FUNCTION generate_uuid_from_text(input_text TEXT) RETURNS UUID AS $$
BEGIN
    -- Create deterministic UUID from text using MD5 hash
    RETURN MD5(input_text)::UUID;
EXCEPTION 
    WHEN OTHERS THEN
        RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

-- Function to batch insert with conflict handling
CREATE OR REPLACE FUNCTION batch_upsert_entities(
    entities_data JSONB[]
) RETURNS INTEGER AS $$
DECLARE
    entity JSONB;
    inserted_count INTEGER := 0;
BEGIN
    FOREACH entity IN ARRAY entities_data LOOP
        BEGIN
            INSERT INTO entities (
                name,
                entity_type,
                symbol,
                metadata
            ) VALUES (
                entity->>'name',
                entity->>'entity_type',
                entity->>'symbol',
                COALESCE(entity->'metadata', '{}'::JSONB)
            ) ON CONFLICT (symbol) DO UPDATE SET
                name = EXCLUDED.name,
                metadata = entities.metadata || EXCLUDED.metadata,
                updated_at = NOW();
                
            inserted_count := inserted_count + 1;
        EXCEPTION 
            WHEN OTHERS THEN
                -- Log error but continue processing
                CONTINUE;
        END;
    END LOOP;
    
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate business days between dates
CREATE OR REPLACE FUNCTION calculate_business_days(
    start_date DATE,
    end_date DATE
) RETURNS INTEGER AS $$
DECLARE
    business_days INTEGER;
    total_days INTEGER;
    weekend_days INTEGER;
BEGIN
    total_days := end_date - start_date;
    
    -- Calculate weekend days
    weekend_days := (
        SELECT COUNT(*)
        FROM generate_series(start_date, end_date - 1, '1 day'::INTERVAL) AS d
        WHERE EXTRACT(ISODOW FROM d) IN (6, 7)  -- Saturday and Sunday
    );
    
    business_days := total_days - weekend_days;
    
    RETURN GREATEST(0, business_days);
END;
$$ LANGUAGE plpgsql;

-- Function to format currency
CREATE OR REPLACE FUNCTION format_currency(
    amount NUMERIC,
    currency_code VARCHAR(3) DEFAULT 'USD'
) RETURNS TEXT AS $$
BEGIN
    IF amount IS NULL THEN
        RETURN NULL;
    END IF;
    
    CASE currency_code
        WHEN 'USD' THEN
            RETURN '$' || TO_CHAR(amount, 'FM999,999,999,990.00');
        WHEN 'EUR' THEN
            RETURN '€' || TO_CHAR(amount, 'FM999,999,999,990.00');
        WHEN 'GBP' THEN
            RETURN '£' || TO_CHAR(amount, 'FM999,999,999,990.00');
        ELSE
            RETURN currency_code || ' ' || TO_CHAR(amount, 'FM999,999,999,990.00');
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to compress JSON for storage
CREATE OR REPLACE FUNCTION compress_json(input_json JSONB) RETURNS JSONB AS $$
BEGIN
    -- Remove null values and empty objects/arrays
    RETURN (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(input_json)
        WHERE value IS NOT NULL 
        AND value != 'null'::JSONB
        AND value != '{}'::JSONB
        AND value != '[]'::JSONB
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check data freshness
CREATE OR REPLACE FUNCTION is_data_fresh(
    last_updated TIMESTAMP WITH TIME ZONE,
    max_age_hours INTEGER DEFAULT 24
) RETURNS BOOLEAN AS $$
BEGIN
    IF last_updated IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN last_updated > NOW() - (max_age_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to get system health status
CREATE OR REPLACE FUNCTION get_system_health() RETURNS JSONB AS $$
DECLARE
    health_data JSONB := '{}';
    db_size BIGINT;
    active_connections INTEGER;
    cache_hit_ratio NUMERIC;
BEGIN
    -- Database size
    SELECT pg_database_size(current_database()) INTO db_size;
    
    -- Active connections
    SELECT COUNT(*) INTO active_connections
    FROM pg_stat_activity 
    WHERE state = 'active';
    
    -- Cache hit ratio
    SELECT 
        ROUND(
            (sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100)::NUMERIC, 
            2
        ) INTO cache_hit_ratio
    FROM pg_stat_database;
    
    -- Build health data
    health_data := jsonb_build_object(
        'database_size_mb', ROUND(db_size::NUMERIC / 1024 / 1024, 2),
        'active_connections', active_connections,
        'cache_hit_ratio', COALESCE(cache_hit_ratio, 0),
        'timestamp', NOW(),
        'status', CASE 
            WHEN active_connections > 100 THEN 'warning'
            WHEN cache_hit_ratio < 90 THEN 'warning'
            ELSE 'healthy'
        END
    );
    
    RETURN health_data;
END;
$$ LANGUAGE plpgsql;

-- Function to log application events
CREATE OR REPLACE FUNCTION log_application_event(
    event_type VARCHAR(50),
    event_data JSONB DEFAULT '{}',
    user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO application_logs (
        event_type,
        event_data,
        user_id,
        created_at
    ) VALUES (
        event_type,
        event_data,
        user_id,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
EXCEPTION 
    WHEN OTHERS THEN
        -- If logging table doesn't exist, fail silently
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION validate_json_schema IS 'Validate JSON data against required fields';
COMMENT ON FUNCTION safe_numeric IS 'Safely convert text to numeric with null on error';
COMMENT ON FUNCTION calculate_percentage_change IS 'Calculate percentage change between two values';
COMMENT ON FUNCTION normalize_text IS 'Normalize text for consistent search and comparison';
COMMENT ON FUNCTION extract_stock_symbols IS 'Extract valid stock symbols from text';
COMMENT ON FUNCTION generate_uuid_from_text IS 'Generate deterministic UUID from text';
COMMENT ON FUNCTION batch_upsert_entities IS 'Batch insert/update entities with error handling';
COMMENT ON FUNCTION calculate_business_days IS 'Calculate business days between two dates';
COMMENT ON FUNCTION format_currency IS 'Format numeric amount as currency string';
COMMENT ON FUNCTION compress_json IS 'Remove null and empty values from JSON';
COMMENT ON FUNCTION is_data_fresh IS 'Check if timestamp is within acceptable age';
COMMENT ON FUNCTION get_system_health IS 'Get current system health metrics';
COMMENT ON FUNCTION log_application_event IS 'Log application events for monitoring';