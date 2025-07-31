-- Final optimization indexes
-- Complete the indexing strategy with remaining optimizations

-- User experience optimization
CREATE INDEX IF NOT EXISTS idx_user_dashboard_composite 
ON watchlist_items(watchlist_id) 
WHERE watchlist_id IN (
    SELECT id FROM watchlists WHERE is_active = true
);

CREATE INDEX IF NOT EXISTS idx_user_alert_summary 
ON alerts(user_id, status, severity) 
WHERE is_active = true AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- System monitoring indexes
CREATE INDEX IF NOT EXISTS idx_system_health_metrics 
ON intelligence_metrics(metric_date DESC, metric_type) 
WHERE metric_category = 'system' AND metric_date >= CURRENT_DATE - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_system_error_tracking 
ON intelligence_alerts(alert_timestamp DESC, severity) 
WHERE severity IN ('critical', 'high') AND status != 'resolved';

-- Data quality indexes
CREATE INDEX IF NOT EXISTS idx_data_quality_scores 
ON processed_content(confidence_score, created_at DESC) 
WHERE confidence_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_completeness 
ON stock_data(symbol, date DESC) 
WHERE close IS NOT NULL AND volume > 0;

-- Research and analysis optimization
CREATE INDEX IF NOT EXISTS idx_research_latest 
ON research_reports(symbol, published_date DESC) 
WHERE published_date >= CURRENT_DATE - INTERVAL '90 days';

CREATE INDEX IF NOT EXISTS idx_correlation_recent 
ON market_correlations(calculated_date DESC) 
WHERE calculated_date >= CURRENT_DATE - INTERVAL '30 days';

-- Machine learning feature indexes
CREATE INDEX IF NOT EXISTS idx_ml_features_latest 
ON technical_indicators(symbol, date DESC, indicator_type) 
WHERE date >= CURRENT_DATE - INTERVAL '365 days';

CREATE INDEX IF NOT EXISTS idx_ml_sentiment_features 
ON sentiment_analysis(entity_id, analysis_date DESC) 
WHERE confidence_score > 0.7;

-- Backup and archival optimization
CREATE INDEX IF NOT EXISTS idx_archival_old_data 
ON raw_feeds(created_at) 
WHERE created_at < NOW() - INTERVAL '1 year' AND processing_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_archival_completed_jobs 
ON job_queue(completed_at) 
WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '30 days';

-- Final performance tuning
CREATE INDEX IF NOT EXISTS idx_hot_path_optimization 
ON entities(entity_type, is_active, updated_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_critical_path_cache 
ON cache_store(key) 
WHERE key LIKE 'dashboard:%' OR key LIKE 'realtime:%';

-- Statistics and reporting indexes
CREATE INDEX IF NOT EXISTS idx_reporting_daily_stats 
ON daily_analysis(analysis_date, sources_analyzed, confidence_score) 
WHERE analysis_date >= CURRENT_DATE - INTERVAL '1 year';

CREATE INDEX IF NOT EXISTS idx_reporting_prediction_accuracy 
ON predictions(created_at, time_horizon, accuracy_score) 
WHERE is_evaluated = true AND created_at >= CURRENT_DATE - INTERVAL '1 year';

-- Add final index comments
COMMENT ON INDEX idx_user_dashboard_composite IS 'User dashboard optimization';
COMMENT ON INDEX idx_user_alert_summary IS 'User alert summary';
COMMENT ON INDEX idx_system_health_metrics IS 'System health monitoring';
COMMENT ON INDEX idx_system_error_tracking IS 'Critical error tracking';
COMMENT ON INDEX idx_data_quality_scores IS 'Data quality monitoring';
COMMENT ON INDEX idx_data_completeness IS 'Data completeness checks';
COMMENT ON INDEX idx_research_latest IS 'Latest research reports';
COMMENT ON INDEX idx_correlation_recent IS 'Recent correlation analysis';
COMMENT ON INDEX idx_ml_features_latest IS 'ML feature extraction';
COMMENT ON INDEX idx_ml_sentiment_features IS 'ML sentiment features';
COMMENT ON INDEX idx_archival_old_data IS 'Old data archival';
COMMENT ON INDEX idx_archival_completed_jobs IS 'Completed job cleanup';
COMMENT ON INDEX idx_hot_path_optimization IS 'Hot path performance';
COMMENT ON INDEX idx_critical_path_cache IS 'Critical cache paths';
COMMENT ON INDEX idx_reporting_daily_stats IS 'Daily statistics reporting';
COMMENT ON INDEX idx_reporting_prediction_accuracy IS 'Prediction accuracy reporting';