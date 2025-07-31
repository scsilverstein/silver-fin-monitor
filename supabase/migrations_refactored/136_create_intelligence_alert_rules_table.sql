-- Create intelligence alert rules table
CREATE TABLE IF NOT EXISTS intelligence_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Rule configuration
    condition_type VARCHAR(50) NOT NULL,
    condition_config JSONB NOT NULL,
    threshold_value DECIMAL(20, 4),
    comparison_operator VARCHAR(10),
    
    -- Alert settings
    severity VARCHAR(20) NOT NULL,
    notification_channels JSONB DEFAULT '[]',
    cool_down_minutes INTEGER DEFAULT 60,
    max_alerts_per_day INTEGER DEFAULT 10,
    
    -- Scope
    entity_filters JSONB DEFAULT '{}',
    metric_filters JSONB DEFAULT '{}',
    
    -- Metadata
    description TEXT,
    created_by VARCHAR(255),
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_intelligence_alert_rules_type CHECK (
        rule_type IN ('threshold', 'anomaly', 'pattern', 'correlation', 'prediction')
    ),
    
    CONSTRAINT chk_intelligence_alert_rules_condition CHECK (
        condition_type IN ('value_exceeds', 'value_below', 'change_exceeds', 'anomaly_detected', 'pattern_match')
    ),
    
    CONSTRAINT chk_intelligence_alert_rules_operator CHECK (
        comparison_operator IS NULL OR 
        comparison_operator IN ('>', '<', '>=', '<=', '=', '!=')
    ),
    
    CONSTRAINT chk_intelligence_alert_rules_severity CHECK (
        severity IN ('critical', 'high', 'medium', 'low', 'info')
    ),
    
    CONSTRAINT chk_intelligence_alert_rules_cooldown CHECK (
        cool_down_minutes >= 0
    ),
    
    CONSTRAINT chk_intelligence_alert_rules_max_alerts CHECK (
        max_alerts_per_day > 0
    )
);

-- Add table comment
COMMENT ON TABLE intelligence_alert_rules IS 'Define alert rules for intelligence system monitoring';

-- Add column comments
COMMENT ON COLUMN intelligence_alert_rules.rule_type IS 'Type of rule: threshold, anomaly, pattern, correlation, prediction';
COMMENT ON COLUMN intelligence_alert_rules.condition_type IS 'Type of condition: value_exceeds, value_below, change_exceeds, anomaly_detected, pattern_match';
COMMENT ON COLUMN intelligence_alert_rules.condition_config IS 'JSON configuration for the condition';
COMMENT ON COLUMN intelligence_alert_rules.severity IS 'Alert severity: critical, high, medium, low, info';
COMMENT ON COLUMN intelligence_alert_rules.notification_channels IS 'Array of notification channels to use';
COMMENT ON COLUMN intelligence_alert_rules.entity_filters IS 'Filters to apply to entities';
COMMENT ON COLUMN intelligence_alert_rules.metric_filters IS 'Filters to apply to metrics';