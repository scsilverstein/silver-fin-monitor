-- Create intelligence alerts table
CREATE TABLE IF NOT EXISTS intelligence_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL,
    alert_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Alert details
    severity VARCHAR(20) NOT NULL,
    alert_title VARCHAR(500) NOT NULL,
    alert_message TEXT NOT NULL,
    
    -- Context
    entity_id UUID,
    metric_type VARCHAR(50),
    metric_value DECIMAL(20, 4),
    threshold_value DECIMAL(20, 4),
    
    -- Additional data
    context_data JSONB DEFAULT '{}',
    recommendation TEXT,
    action_required BOOLEAN DEFAULT false,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'new',
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,
    
    -- Notification tracking
    notifications_sent JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_intelligence_alerts_rule 
        FOREIGN KEY (rule_id) 
        REFERENCES intelligence_alert_rules(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_intelligence_alerts_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT chk_intelligence_alerts_severity CHECK (
        severity IN ('critical', 'high', 'medium', 'low', 'info')
    ),
    
    CONSTRAINT chk_intelligence_alerts_status CHECK (
        status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'dismissed')
    )
);

-- Add table comment
COMMENT ON TABLE intelligence_alerts IS 'Store generated alerts from intelligence system';

-- Add column comments
COMMENT ON COLUMN intelligence_alerts.severity IS 'Alert severity: critical, high, medium, low, info';
COMMENT ON COLUMN intelligence_alerts.context_data IS 'Additional context data for the alert';
COMMENT ON COLUMN intelligence_alerts.status IS 'Alert status: new, acknowledged, in_progress, resolved, dismissed';
COMMENT ON COLUMN intelligence_alerts.notifications_sent IS 'Array of notification records {channel, sent_at, status}';