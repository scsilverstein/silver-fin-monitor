-- Create performance-specific indexes
-- Final optimization for high-frequency queries

-- Real-time data access patterns
CREATE INDEX IF NOT EXISTS idx_realtime_stock_data 
ON stock_data(symbol, date DESC, close) 
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_realtime_market_data 
ON market_data(symbol, timestamp DESC) 
WHERE timestamp >= NOW() - INTERVAL '1 hour';

-- Dashboard performance indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_latest_analysis 
ON daily_analysis(analysis_date DESC) 
WHERE confidence_score > 0.7 AND sources_analyzed > 5;

CREATE INDEX IF NOT EXISTS idx_dashboard_top_predictions 
ON predictions(confidence_level DESC, created_at DESC) 
WHERE time_horizon IN ('1_week', '1_month') AND is_evaluated = false;

CREATE INDEX IF NOT EXISTS idx_dashboard_active_alerts 
ON alerts(user_id, status, created_at DESC) 
WHERE status IN ('pending', 'triggered') AND is_active = true;

-- Scanner performance indexes
CREATE INDEX IF NOT EXISTS idx_scanner_hot_symbols 
ON scanner_results(scan_date DESC, score DESC) 
WHERE signal_strength > 0.8 AND scanner_type IN ('momentum', 'breakout');

CREATE INDEX IF NOT EXISTS idx_scanner_volume_leaders 
ON stock_data(date DESC, relative_volume DESC) 
WHERE relative_volume > 3 AND volume > 1000000;

-- Feed processing performance
CREATE INDEX IF NOT EXISTS idx_feed_processing_queue 
ON raw_feeds(processing_status, error_count, created_at) 
WHERE processing_status = 'failed' AND error_count < 3;

CREATE INDEX IF NOT EXISTS idx_feed_recent_content 
ON processed_content(created_at DESC, confidence_score DESC) 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Analytics performance
CREATE INDEX IF NOT EXISTS idx_analytics_trending 
ON unified_analytics(analytics_date DESC, momentum_score DESC) 
WHERE analytics_date >= CURRENT_DATE - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_analytics_signals 
ON unified_analytics(analytics_date DESC) 
WHERE jsonb_array_length(signals) > 2;

-- Knowledge graph performance
CREATE INDEX IF NOT EXISTS idx_kg_hot_entities 
ON kg_entities(created_at DESC, confidence_score DESC) 
WHERE created_at >= NOW() - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_kg_strong_relationships 
ON kg_relationships(created_at DESC, strength DESC) 
WHERE strength > 0.8;

-- Cleanup and maintenance indexes
CREATE INDEX IF NOT EXISTS idx_cache_cleanup 
ON cache_store(expires_at) 
WHERE expires_at < NOW();

CREATE INDEX IF NOT EXISTS idx_job_cleanup 
ON job_queue(completed_at, status) 
WHERE status IN ('completed', 'failed') AND completed_at < NOW() - INTERVAL '7 days';

-- Add index comments
COMMENT ON INDEX idx_realtime_stock_data IS 'Real-time stock data access';
COMMENT ON INDEX idx_realtime_market_data IS 'Real-time market data access';
COMMENT ON INDEX idx_dashboard_latest_analysis IS 'Dashboard latest analysis';
COMMENT ON INDEX idx_dashboard_top_predictions IS 'Dashboard top predictions';
COMMENT ON INDEX idx_dashboard_active_alerts IS 'Dashboard active alerts';
COMMENT ON INDEX idx_scanner_hot_symbols IS 'Scanner hot symbols';
COMMENT ON INDEX idx_scanner_volume_leaders IS 'Volume leaders identification';
COMMENT ON INDEX idx_feed_processing_queue IS 'Feed processing retry queue';
COMMENT ON INDEX idx_feed_recent_content IS 'Recent processed content';
COMMENT ON INDEX idx_analytics_trending IS 'Trending analytics';
COMMENT ON INDEX idx_analytics_signals IS 'Analytics with signals';
COMMENT ON INDEX idx_kg_hot_entities IS 'Recently added entities';
COMMENT ON INDEX idx_kg_strong_relationships IS 'Strong relationships';
COMMENT ON INDEX idx_cache_cleanup IS 'Expired cache cleanup';
COMMENT ON INDEX idx_job_cleanup IS 'Old job cleanup';