-- Create indexes for analytics-related tables
-- Support unified and derived analytics queries

-- unified_analytics indexes
CREATE INDEX IF NOT EXISTS idx_unified_analytics_entity_date 
ON unified_analytics(entity_id, analytics_date DESC);

CREATE INDEX IF NOT EXISTS idx_unified_analytics_type_date 
ON unified_analytics(analytics_type, analytics_date DESC);

CREATE INDEX IF NOT EXISTS idx_unified_analytics_score 
ON unified_analytics(analytics_date DESC, overall_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_unified_analytics_signals 
ON unified_analytics USING GIN(signals) 
WHERE jsonb_array_length(signals) > 0;

-- derived_analytics indexes
CREATE INDEX IF NOT EXISTS idx_derived_analytics_scope 
ON derived_analytics(scope_type, scope_identifier, analytics_date DESC);

CREATE INDEX IF NOT EXISTS idx_derived_analytics_type_date 
ON derived_analytics(analytics_type, analytics_date DESC);

CREATE INDEX IF NOT EXISTS idx_derived_analytics_insights 
ON derived_analytics USING GIN(key_insights) 
WHERE jsonb_array_length(key_insights) > 0;

CREATE INDEX IF NOT EXISTS idx_derived_analytics_anomalies 
ON derived_analytics USING GIN(anomalies_detected) 
WHERE jsonb_array_length(anomalies_detected) > 0;

-- intelligence_metrics indexes
CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_date_type 
ON intelligence_metrics(metric_date DESC, metric_type);

CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_category 
ON intelligence_metrics(metric_category, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_entity 
ON intelligence_metrics(entity_id, metric_date DESC) 
WHERE entity_id IS NOT NULL;

-- intelligence_alerts indexes
CREATE INDEX IF NOT EXISTS idx_intelligence_alerts_severity 
ON intelligence_alerts(severity, alert_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_alerts_status 
ON intelligence_alerts(status, alert_timestamp DESC) 
WHERE status IN ('new', 'acknowledged');

CREATE INDEX IF NOT EXISTS idx_intelligence_alerts_entity 
ON intelligence_alerts(entity_id, alert_timestamp DESC) 
WHERE entity_id IS NOT NULL;

-- Add index comments
COMMENT ON INDEX idx_unified_analytics_entity_date IS 'Entity analytics history';
COMMENT ON INDEX idx_unified_analytics_type_date IS 'Analytics type queries';
COMMENT ON INDEX idx_unified_analytics_score IS 'Score-based ranking';
COMMENT ON INDEX idx_unified_analytics_signals IS 'Signal detection';
COMMENT ON INDEX idx_derived_analytics_scope IS 'Scope-based analytics';
COMMENT ON INDEX idx_derived_analytics_type_date IS 'Derived analytics type';
COMMENT ON INDEX idx_derived_analytics_insights IS 'Key insights search';
COMMENT ON INDEX idx_derived_analytics_anomalies IS 'Anomaly detection';
COMMENT ON INDEX idx_intelligence_metrics_date_type IS 'Metric date-type queries';
COMMENT ON INDEX idx_intelligence_metrics_category IS 'Metric category analysis';
COMMENT ON INDEX idx_intelligence_metrics_entity IS 'Entity metric tracking';
COMMENT ON INDEX idx_intelligence_alerts_severity IS 'Alert severity filtering';
COMMENT ON INDEX idx_intelligence_alerts_status IS 'Alert status tracking';
COMMENT ON INDEX idx_intelligence_alerts_entity IS 'Entity alert tracking';