-- Create dashboard views
-- Views for dashboard data aggregation and display

-- View for market overview
CREATE OR REPLACE VIEW market_overview AS
SELECT 
    COUNT(DISTINCT sd.symbol) as total_stocks,
    AVG(sd.close) as avg_price,
    SUM(sd.volume) as total_volume,
    COUNT(*) FILTER (WHERE sd.change_percent > 0) as gainers,
    COUNT(*) FILTER (WHERE sd.change_percent < 0) as losers,
    AVG(sd.change_percent) as avg_change,
    STDDEV(sd.change_percent) as volatility,
    MAX(sd.date) as last_update
FROM stock_data sd
WHERE sd.date = CURRENT_DATE
AND sd.symbol IN (
    SELECT e.symbol 
    FROM entities e 
    WHERE e.entity_type = 'stock' 
    AND e.is_active = true
);

-- View for latest analysis summary
CREATE OR REPLACE VIEW latest_analysis_summary AS
SELECT 
    da.id,
    da.analysis_date,
    da.market_sentiment,
    da.confidence_score,
    da.key_themes,
    LEFT(da.overall_summary, 300) || '...' as summary_preview,
    da.sources_analyzed,
    COUNT(p.id) as prediction_count,
    AVG(p.confidence_level) as avg_prediction_confidence
FROM daily_analysis da
LEFT JOIN predictions p ON p.daily_analysis_id = da.id
WHERE da.analysis_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY da.id, da.analysis_date, da.market_sentiment, da.confidence_score, 
         da.key_themes, da.overall_summary, da.sources_analyzed
ORDER BY da.analysis_date DESC;

-- View for top predictions
CREATE OR REPLACE VIEW top_predictions AS
SELECT 
    p.id,
    p.prediction_type,
    p.time_horizon,
    p.confidence_level,
    LEFT(p.prediction_text, 200) || '...' as prediction_preview,
    p.created_at,
    p.is_evaluated,
    p.accuracy_score,
    da.analysis_date,
    da.market_sentiment as context_sentiment
FROM predictions p
JOIN daily_analysis da ON da.id = p.daily_analysis_id
WHERE p.confidence_level > 0.7
AND p.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY p.confidence_level DESC, p.created_at DESC
LIMIT 20;

-- View for active alerts summary
CREATE OR REPLACE VIEW active_alerts_summary AS
SELECT 
    a.alert_type,
    COUNT(*) as alert_count,
    COUNT(*) FILTER (WHERE a.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE a.status = 'triggered') as triggered_count,
    AVG(CASE WHEN a.last_triggered_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM NOW() - a.last_triggered_at) / 3600 
        ELSE NULL END) as avg_hours_since_trigger
FROM alerts a
WHERE a.is_active = true
GROUP BY a.alert_type
ORDER BY alert_count DESC;

-- View for portfolio performance summary
CREATE OR REPLACE VIEW portfolio_performance_summary AS
SELECT 
    p.id as portfolio_id,
    p.name as portfolio_name,
    p.user_id,
    COUNT(ph.symbol) as position_count,
    SUM(ph.position_value) as total_value,
    SUM(ph.unrealized_pnl) as total_unrealized_pnl,
    SUM(ph.day_change) as day_change,
    CASE 
        WHEN SUM(ph.position_value - ph.day_change) > 0 THEN
            SUM(ph.day_change) / SUM(ph.position_value - ph.day_change) * 100
        ELSE 0
    END as day_change_percent,
    p.created_at,
    p.updated_at
FROM portfolios p
LEFT JOIN portfolio_holdings ph ON ph.portfolio_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.user_id, p.created_at, p.updated_at;

-- View for recent news summary
CREATE OR REPLACE VIEW recent_news_summary AS
SELECT 
    ni.id,
    ni.title,
    ni.source,
    ni.published_at,
    ni.sentiment_score,
    ni.importance,
    array_length(ni.symbols, 1) as symbol_count,
    ni.symbols,
    ni.category,
    CASE 
        WHEN ni.sentiment_score > 0.3 THEN 'Positive'
        WHEN ni.sentiment_score < -0.3 THEN 'Negative'
        ELSE 'Neutral'
    END as sentiment_label
FROM news_items ni
WHERE ni.published_at >= CURRENT_DATE - INTERVAL '7 days'
AND ni.importance >= 5
ORDER BY ni.published_at DESC, ni.importance DESC
LIMIT 50;

-- View for feed processing status
CREATE OR REPLACE VIEW feed_processing_status AS
SELECT 
    fs.id,
    fs.name as feed_name,
    fs.type as feed_type,
    fs.is_active,
    fs.last_processed_at,
    COUNT(rf.id) as total_items,
    COUNT(*) FILTER (WHERE rf.processing_status = 'completed') as completed_items,
    COUNT(*) FILTER (WHERE rf.processing_status = 'failed') as failed_items,
    COUNT(*) FILTER (WHERE rf.processing_status = 'pending') as pending_items,
    CASE 
        WHEN COUNT(rf.id) > 0 THEN
            COUNT(*) FILTER (WHERE rf.processing_status = 'completed')::DECIMAL / COUNT(rf.id) * 100
        ELSE 0
    END as success_rate,
    MAX(rf.created_at) as last_item_date
FROM feed_sources fs
LEFT JOIN raw_feeds rf ON rf.source_id = fs.id 
    AND rf.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY fs.id, fs.name, fs.type, fs.is_active, fs.last_processed_at
ORDER BY fs.is_active DESC, success_rate DESC;

-- View for system health metrics
CREATE OR REPLACE VIEW system_health_metrics AS
SELECT 
    'database' as component,
    pg_database_size(current_database())::BIGINT / 1024 / 1024 as size_mb,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    ROUND(
        (SELECT sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100
         FROM pg_stat_database)::NUMERIC, 2
    ) as cache_hit_ratio,
    NOW() as last_check
UNION ALL
SELECT 
    'job_queue' as component,
    (SELECT COUNT(*) FROM job_queue WHERE status = 'pending')::BIGINT as pending_jobs,
    (SELECT COUNT(*) FROM job_queue WHERE status = 'processing')::BIGINT as processing_jobs,
    (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' 
     AND completed_at > NOW() - INTERVAL '1 hour')::BIGINT as recent_failures,
    NOW() as last_check
UNION ALL
SELECT 
    'cache' as component,
    (SELECT COUNT(*) FROM cache_store)::BIGINT as total_entries,
    (SELECT COUNT(*) FROM cache_store WHERE expires_at > NOW())::BIGINT as active_entries,
    ROUND((SELECT SUM(pg_column_size(value)) / 1024 / 1024 FROM cache_store)::NUMERIC, 2) as size_mb,
    NOW() as last_check;

-- View for knowledge graph insights
CREATE OR REPLACE VIEW knowledge_graph_insights AS
SELECT 
    'entities' as metric_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE confidence_score > 0.8) as high_confidence_count,
    AVG(confidence_score) as avg_confidence,
    COUNT(DISTINCT entity_type) as unique_types
FROM kg_entities
UNION ALL
SELECT 
    'relationships' as metric_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE strength > 0.5) as strong_relationships,
    AVG(strength) as avg_strength,
    COUNT(DISTINCT relationship_type) as unique_types
FROM kg_relationships
WHERE valid_to IS NULL OR valid_to > NOW();

-- Add view comments
COMMENT ON VIEW market_overview IS 'High-level market statistics for dashboard';
COMMENT ON VIEW latest_analysis_summary IS 'Recent analysis summaries with prediction counts';
COMMENT ON VIEW top_predictions IS 'Highest confidence predictions for display';
COMMENT ON VIEW active_alerts_summary IS 'Summary of active alerts by type';
COMMENT ON VIEW portfolio_performance_summary IS 'Portfolio performance metrics';
COMMENT ON VIEW recent_news_summary IS 'Recent high-importance news items';
COMMENT ON VIEW feed_processing_status IS 'Feed processing health and statistics';
COMMENT ON VIEW system_health_metrics IS 'System health and performance metrics';
COMMENT ON VIEW knowledge_graph_insights IS 'Knowledge graph statistics and insights';