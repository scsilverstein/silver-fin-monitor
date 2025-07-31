-- Create indexes for feed source metrics table
-- Support feed performance monitoring

-- feed_source_metrics indexes
CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_source_date 
ON feed_source_metrics(source_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_success_rate 
ON feed_source_metrics(metric_date DESC, fetch_success_rate DESC) 
WHERE fetch_success_rate < 95;

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_errors 
ON feed_source_metrics(metric_date DESC, error_count DESC) 
WHERE error_count > 0;

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_performance 
ON feed_source_metrics(metric_date DESC, avg_response_time_ms DESC) 
WHERE avg_response_time_ms > 5000;

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_volume 
ON feed_source_metrics(metric_date DESC, items_processed DESC) 
WHERE items_processed > 0;

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_quality 
ON feed_source_metrics(metric_date DESC, sentiment_coverage DESC) 
WHERE sentiment_coverage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_uptime 
ON feed_source_metrics(source_id, uptime_percentage DESC) 
WHERE uptime_percentage < 99;

CREATE INDEX IF NOT EXISTS idx_feed_source_metrics_errors_detail 
ON feed_source_metrics USING GIN(error_details) 
WHERE jsonb_array_length(error_details) > 0;

-- Add index comments
COMMENT ON INDEX idx_feed_source_metrics_source_date IS 'Source metric history';
COMMENT ON INDEX idx_feed_source_metrics_success_rate IS 'Low success rate monitoring';
COMMENT ON INDEX idx_feed_source_metrics_errors IS 'Error tracking';
COMMENT ON INDEX idx_feed_source_metrics_performance IS 'Performance issues';
COMMENT ON INDEX idx_feed_source_metrics_volume IS 'Processing volume tracking';
COMMENT ON INDEX idx_feed_source_metrics_quality IS 'Data quality metrics';
COMMENT ON INDEX idx_feed_source_metrics_uptime IS 'Uptime monitoring';
COMMENT ON INDEX idx_feed_source_metrics_errors_detail IS 'Detailed error analysis';