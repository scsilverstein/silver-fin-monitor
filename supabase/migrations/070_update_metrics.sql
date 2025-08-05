-- Create update metrics table for tracking user-triggered updates
CREATE TABLE IF NOT EXISTS update_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('feed', 'analysis', 'prediction', 'stock')),
    resource_id VARCHAR(255) NOT NULL,
    user_id UUID,
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failure')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for analytics
    INDEX idx_update_metrics_type_time (type, timestamp DESC),
    INDEX idx_update_metrics_user (user_id, timestamp DESC),
    INDEX idx_update_metrics_resource (resource_id, timestamp DESC)
);

-- Create feed sync metrics table
CREATE TABLE IF NOT EXISTS feed_sync_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_ms INTEGER NOT NULL,
    items_checked INTEGER NOT NULL DEFAULT 0,
    items_added INTEGER NOT NULL DEFAULT 0,
    dedupe_efficiency DECIMAL(3,2) CHECK (dedupe_efficiency >= 0 AND dedupe_efficiency <= 1),
    cache_hit_rate DECIMAL(3,2) CHECK (cache_hit_rate >= 0 AND cache_hit_rate <= 1),
    error_count INTEGER NOT NULL DEFAULT 0,
    
    -- Performance tracking
    INDEX idx_sync_metrics_source_time (source_id, timestamp DESC),
    INDEX idx_sync_metrics_duration (duration_ms),
    INDEX idx_sync_metrics_efficiency (dedupe_efficiency)
);

-- Add sync metadata column to feed_sources if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'feed_sources' AND column_name = 'sync_metadata'
    ) THEN
        ALTER TABLE feed_sources ADD COLUMN sync_metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create function to get feed update statistics
CREATE OR REPLACE FUNCTION get_feed_update_stats(
    p_source_id UUID DEFAULT NULL,
    p_time_window INTERVAL DEFAULT INTERVAL '24 hours'
) RETURNS TABLE (
    source_id UUID,
    source_name VARCHAR(255),
    total_syncs INTEGER,
    successful_syncs INTEGER,
    failed_syncs INTEGER,
    avg_duration_ms NUMERIC,
    avg_items_added NUMERIC,
    avg_dedupe_efficiency NUMERIC,
    last_sync_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fs.id,
        fs.name,
        COUNT(fsm.id)::INTEGER as total_syncs,
        COUNT(CASE WHEN fsm.error_count = 0 THEN 1 END)::INTEGER as successful_syncs,
        COUNT(CASE WHEN fsm.error_count > 0 THEN 1 END)::INTEGER as failed_syncs,
        AVG(fsm.duration_ms)::NUMERIC as avg_duration_ms,
        AVG(fsm.items_added)::NUMERIC as avg_items_added,
        AVG(fsm.dedupe_efficiency)::NUMERIC as avg_dedupe_efficiency,
        MAX(fsm.timestamp) as last_sync_at
    FROM feed_sources fs
    LEFT JOIN feed_sync_metrics fsm ON fs.id = fsm.source_id
        AND fsm.timestamp > NOW() - p_time_window
    WHERE (p_source_id IS NULL OR fs.id = p_source_id)
    GROUP BY fs.id, fs.name
    ORDER BY fs.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if feed needs update
CREATE OR REPLACE FUNCTION check_feed_needs_update(
    p_source_id UUID
) RETURNS TABLE (
    needs_update BOOLEAN,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    time_since_update INTERVAL,
    recommended_priority INTEGER
) AS $$
DECLARE
    v_feed_record RECORD;
    v_update_frequency VARCHAR(50);
    v_time_since_update INTERVAL;
    v_max_age INTERVAL;
    v_needs_update BOOLEAN;
    v_priority INTEGER;
BEGIN
    -- Get feed details
    SELECT 
        fs.*,
        config->>'update_frequency' as update_freq
    INTO v_feed_record
    FROM feed_sources fs
    WHERE id = p_source_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    v_update_frequency := COALESCE(v_feed_record.update_freq, 'daily');
    v_time_since_update := NOW() - COALESCE(v_feed_record.last_processed_at, '2000-01-01'::TIMESTAMP);
    
    -- Determine max age based on update frequency
    v_max_age := CASE v_update_frequency
        WHEN 'realtime' THEN INTERVAL '5 minutes'
        WHEN 'hourly' THEN INTERVAL '1 hour'
        WHEN 'daily' THEN INTERVAL '24 hours'
        WHEN 'weekly' THEN INTERVAL '7 days'
        ELSE INTERVAL '24 hours'
    END;
    
    v_needs_update := v_time_since_update > v_max_age;
    
    -- Calculate priority
    v_priority := CASE 
        WHEN v_time_since_update > v_max_age * 3 THEN 1  -- Very stale
        WHEN v_time_since_update > v_max_age * 2 THEN 2  -- Moderately stale
        WHEN v_time_since_update > v_max_age THEN 3      -- Slightly stale
        ELSE 5  -- Not stale
    END;
    
    RETURN QUERY SELECT 
        v_needs_update,
        v_feed_record.last_processed_at,
        v_time_since_update,
        v_priority;
END;
$$ LANGUAGE plpgsql;

-- Create view for feed update dashboard
CREATE OR REPLACE VIEW feed_update_status AS
SELECT 
    fs.id,
    fs.name,
    fs.type,
    fs.url,
    fs.last_processed_at,
    fs.is_active,
    COALESCE(fs.config->>'update_frequency', 'daily') as update_frequency,
    NOW() - COALESCE(fs.last_processed_at, '2000-01-01'::TIMESTAMP) as time_since_update,
    (
        SELECT COUNT(*) 
        FROM raw_feeds rf 
        WHERE rf.source_id = fs.id 
        AND rf.created_at > NOW() - INTERVAL '24 hours'
    ) as items_last_24h,
    (
        SELECT status 
        FROM job_queue jq 
        WHERE jq.job_type = 'feed_sync' 
        AND jq.payload->>'sourceId' = fs.id::TEXT
        AND jq.status IN ('pending', 'processing')
        ORDER BY jq.created_at DESC
        LIMIT 1
    ) as current_job_status,
    (
        SELECT AVG(duration_ms) 
        FROM feed_sync_metrics fsm 
        WHERE fsm.source_id = fs.id 
        AND fsm.timestamp > NOW() - INTERVAL '7 days'
    ) as avg_sync_duration_ms
FROM feed_sources fs
WHERE fs.is_active = true
ORDER BY 
    CASE 
        WHEN fs.last_processed_at IS NULL THEN 0
        ELSE EXTRACT(EPOCH FROM (NOW() - fs.last_processed_at))
    END DESC;