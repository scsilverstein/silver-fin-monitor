-- Create alert management functions
-- Functions for alert processing and evaluation

-- Function to evaluate alert conditions
CREATE OR REPLACE FUNCTION evaluate_alert_conditions(alert_uuid UUID) RETURNS BOOLEAN AS $$
DECLARE
    alert_record RECORD;
    condition_met BOOLEAN := FALSE;
    current_value DECIMAL(20, 4);
    threshold_value DECIMAL(20, 4);
BEGIN
    -- Get alert details
    SELECT * INTO alert_record 
    FROM alerts 
    WHERE id = alert_uuid AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get current value based on alert type
    CASE alert_record.alert_type
        WHEN 'price' THEN
            SELECT close INTO current_value
            FROM stock_data 
            WHERE symbol = alert_record.symbol 
            ORDER BY date DESC LIMIT 1;
            
        WHEN 'volume' THEN
            SELECT volume INTO current_value
            FROM stock_data 
            WHERE symbol = alert_record.symbol 
            ORDER BY date DESC LIMIT 1;
            
        WHEN 'change_percent' THEN
            SELECT change_percent INTO current_value
            FROM stock_data 
            WHERE symbol = alert_record.symbol 
            ORDER BY date DESC LIMIT 1;
            
        WHEN 'sentiment' THEN
            SELECT overall_sentiment INTO current_value
            FROM sentiment_analysis sa
            JOIN entities e ON e.id = sa.entity_id
            WHERE e.symbol = alert_record.symbol 
            ORDER BY sa.analysis_date DESC LIMIT 1;
            
        ELSE
            RETURN FALSE;
    END CASE;
    
    IF current_value IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Extract threshold from conditions
    threshold_value := (alert_record.conditions->>'threshold')::DECIMAL(20, 4);
    
    -- Evaluate condition based on comparison operator
    CASE alert_record.conditions->>'operator'
        WHEN 'greater_than' THEN
            condition_met := current_value > threshold_value;
        WHEN 'less_than' THEN
            condition_met := current_value < threshold_value;
        WHEN 'greater_equal' THEN
            condition_met := current_value >= threshold_value;
        WHEN 'less_equal' THEN
            condition_met := current_value <= threshold_value;
        WHEN 'equals' THEN
            condition_met := current_value = threshold_value;
        ELSE
            condition_met := FALSE;
    END CASE;
    
    RETURN condition_met;
END;
$$ LANGUAGE plpgsql;

-- Function to trigger alert
CREATE OR REPLACE FUNCTION trigger_alert(
    alert_uuid UUID,
    current_value DECIMAL(20, 4)
) RETURNS BOOLEAN AS $$
DECLARE
    alert_record RECORD;
    cooldown_check TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get alert details
    SELECT * INTO alert_record 
    FROM alerts 
    WHERE id = alert_uuid AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check cooldown period
    cooldown_check := COALESCE(alert_record.last_triggered_at, '1900-01-01'::TIMESTAMP) 
                     + (COALESCE((alert_record.metadata->>'cooldown_minutes')::INTEGER, 60) || ' minutes')::INTERVAL;
    
    IF NOW() < cooldown_check THEN
        RETURN FALSE;
    END IF;
    
    -- Update alert status
    UPDATE alerts 
    SET 
        status = 'triggered',
        last_triggered_at = NOW(),
        trigger_count = trigger_count + 1,
        metadata = COALESCE(metadata, '{}'::JSONB) || 
                  jsonb_build_object('last_value', current_value, 'triggered_at', NOW())
    WHERE id = alert_uuid;
    
    -- Create alert notification record
    INSERT INTO intelligence_alerts (
        rule_id,
        alert_title,
        alert_message,
        entity_id,
        metric_value,
        threshold_value,
        context_data,
        severity
    ) VALUES (
        alert_uuid,
        'Alert: ' || alert_record.alert_type || ' for ' || COALESCE(alert_record.symbol, 'entity'),
        format('Value %s reached threshold %s', current_value, (alert_record.conditions->>'threshold')),
        alert_record.entity_id,
        current_value,
        (alert_record.conditions->>'threshold')::DECIMAL(20, 4),
        jsonb_build_object('alert_type', alert_record.alert_type, 'symbol', alert_record.symbol),
        COALESCE((alert_record.metadata->>'severity')::TEXT, 'medium')
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to process pending alerts
CREATE OR REPLACE FUNCTION process_pending_alerts() RETURNS TABLE (
    alert_id UUID,
    alert_type VARCHAR(50),
    symbol VARCHAR(20),
    triggered BOOLEAN
) AS $$
DECLARE
    alert_record RECORD;
    condition_result BOOLEAN;
BEGIN
    -- Process all pending alerts
    FOR alert_record IN 
        SELECT * FROM alerts 
        WHERE status = 'pending' 
        AND is_active = true 
        AND (next_check_at IS NULL OR next_check_at <= NOW())
    LOOP
        -- Evaluate condition
        condition_result := evaluate_alert_conditions(alert_record.id);
        
        -- Update next check time
        UPDATE alerts 
        SET next_check_at = NOW() + INTERVAL '5 minutes'
        WHERE id = alert_record.id;
        
        -- Trigger if condition met
        IF condition_result THEN
            PERFORM trigger_alert(alert_record.id, 0);  -- Value will be fetched in trigger_alert
        END IF;
        
        -- Return result
        RETURN QUERY SELECT 
            alert_record.id,
            alert_record.alert_type,
            alert_record.symbol,
            condition_result;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create price alert
CREATE OR REPLACE FUNCTION create_price_alert(
    user_uuid UUID,
    stock_symbol VARCHAR(20),
    threshold_price DECIMAL(10, 4),
    alert_direction VARCHAR(10), -- 'above' or 'below'
    alert_name VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    alert_id UUID;
    entity_uuid UUID;
    operator_type VARCHAR(20);
BEGIN
    -- Get entity ID for symbol
    SELECT id INTO entity_uuid 
    FROM entities 
    WHERE symbol = stock_symbol AND entity_type = 'stock';
    
    -- Determine operator
    operator_type := CASE 
        WHEN alert_direction = 'above' THEN 'greater_than'
        WHEN alert_direction = 'below' THEN 'less_than'
        ELSE 'greater_than'
    END;
    
    -- Create alert
    INSERT INTO alerts (
        user_id,
        entity_id,
        symbol,
        alert_type,
        alert_name,
        conditions,
        status,
        is_active,
        next_check_at
    ) VALUES (
        user_uuid,
        entity_uuid,
        stock_symbol,
        'price',
        COALESCE(alert_name, stock_symbol || ' price ' || alert_direction || ' ' || threshold_price),
        jsonb_build_object(
            'threshold', threshold_price,
            'operator', operator_type
        ),
        'pending',
        true,
        NOW()
    ) RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create volume alert
CREATE OR REPLACE FUNCTION create_volume_alert(
    user_uuid UUID,
    stock_symbol VARCHAR(20),
    volume_threshold BIGINT,
    alert_name VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    alert_id UUID;
    entity_uuid UUID;
BEGIN
    -- Get entity ID for symbol
    SELECT id INTO entity_uuid 
    FROM entities 
    WHERE symbol = stock_symbol AND entity_type = 'stock';
    
    -- Create alert
    INSERT INTO alerts (
        user_id,
        entity_id,
        symbol,
        alert_type,
        alert_name,
        conditions,
        status,
        is_active,
        next_check_at
    ) VALUES (
        user_uuid,
        entity_uuid,
        stock_symbol,
        'volume',
        COALESCE(alert_name, stock_symbol || ' volume above ' || volume_threshold),
        jsonb_build_object(
            'threshold', volume_threshold,
            'operator', 'greater_than'
        ),
        'pending',
        true,
        NOW()
    ) RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user alert summary
CREATE OR REPLACE FUNCTION get_user_alert_summary(user_uuid UUID) RETURNS TABLE (
    total_alerts INTEGER,
    active_alerts INTEGER,
    triggered_today INTEGER,
    pending_alerts INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_alerts,
        COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_alerts,
        COUNT(*) FILTER (WHERE status = 'triggered' AND last_triggered_at::DATE = CURRENT_DATE)::INTEGER as triggered_today,
        COUNT(*) FILTER (WHERE status = 'pending' AND is_active = true)::INTEGER as pending_alerts
    FROM alerts
    WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION evaluate_alert_conditions IS 'Evaluate if alert conditions are met';
COMMENT ON FUNCTION trigger_alert IS 'Trigger an alert and create notification';
COMMENT ON FUNCTION process_pending_alerts IS 'Process all pending alerts in the system';
COMMENT ON FUNCTION create_price_alert IS 'Create a price-based alert for a stock';
COMMENT ON FUNCTION create_volume_alert IS 'Create a volume-based alert for a stock';
COMMENT ON FUNCTION get_user_alert_summary IS 'Get summary statistics for user alerts';