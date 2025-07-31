-- Create reporting views
-- Views for business intelligence and reporting

-- View for daily system metrics report
CREATE OR REPLACE VIEW daily_system_metrics AS
SELECT 
    CURRENT_DATE as report_date,
    -- Feed processing metrics
    (SELECT COUNT(*) FROM raw_feeds WHERE created_at::DATE = CURRENT_DATE) as feeds_ingested,
    (SELECT COUNT(*) FROM processed_content WHERE created_at::DATE = CURRENT_DATE) as content_processed,
    (SELECT AVG(confidence_score) FROM processed_content 
     WHERE created_at::DATE = CURRENT_DATE AND confidence_score IS NOT NULL) as avg_content_confidence,
    -- Analysis metrics
    (SELECT COUNT(*) FROM daily_analysis WHERE analysis_date = CURRENT_DATE) as analyses_generated,
    (SELECT COUNT(*) FROM predictions WHERE created_at::DATE = CURRENT_DATE) as predictions_created,
    (SELECT AVG(confidence_level) FROM predictions 
     WHERE created_at::DATE = CURRENT_DATE) as avg_prediction_confidence,
    -- Alert metrics
    (SELECT COUNT(*) FROM alerts WHERE last_triggered_at::DATE = CURRENT_DATE) as alerts_triggered,
    (SELECT COUNT(*) FROM alerts WHERE is_active = true) as active_alerts,
    -- User activity metrics
    (SELECT COUNT(DISTINCT user_id) FROM alerts 
     WHERE last_triggered_at::DATE = CURRENT_DATE) as active_users,
    (SELECT COUNT(*) FROM trades WHERE executed_at::DATE = CURRENT_DATE) as trades_executed,
    -- System health metrics
    (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' 
     AND completed_at::DATE = CURRENT_DATE) as failed_jobs,
    (SELECT AVG(EXTRACT(EPOCH FROM completed_at - started_at)) FROM job_queue 
     WHERE status = 'completed' AND completed_at::DATE = CURRENT_DATE) as avg_job_duration,
    -- Data quality metrics
    (SELECT COUNT(*) FROM stock_data WHERE date = CURRENT_DATE) as stock_records_updated,
    (SELECT COUNT(DISTINCT symbol) FROM stock_data WHERE date = CURRENT_DATE) as unique_stocks_updated;

-- View for weekly performance report
CREATE OR REPLACE VIEW weekly_performance_report AS
WITH week_bounds AS (
    SELECT 
        DATE_TRUNC('week', CURRENT_DATE) as week_start,
        DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days' as week_end
),
current_week AS (
    SELECT 
        wb.week_start,
        wb.week_end,
        -- Prediction accuracy
        COUNT(p.id) FILTER (WHERE p.is_evaluated = true) as evaluated_predictions,
        AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true) as avg_accuracy,
        -- Feed processing
        COUNT(rf.id) as feeds_processed,
        COUNT(pc.id) as content_items_processed,
        AVG(pc.confidence_score) as avg_content_quality,
        -- Market coverage
        COUNT(DISTINCT sd.symbol) as stocks_tracked,
        COUNT(DISTINCT sa.entity_id) as entities_with_sentiment,
        -- User engagement
        COUNT(DISTINCT a.user_id) as active_alert_users,
        COUNT(t.id) as trades_executed,
        SUM(t.total_amount) as total_trade_value
    FROM week_bounds wb
    LEFT JOIN predictions p ON p.created_at >= wb.week_start AND p.created_at <= wb.week_end
    LEFT JOIN raw_feeds rf ON rf.created_at >= wb.week_start AND rf.created_at <= wb.week_end
    LEFT JOIN processed_content pc ON pc.created_at >= wb.week_start AND pc.created_at <= wb.week_end
    LEFT JOIN stock_data sd ON sd.date >= wb.week_start::DATE AND sd.date <= wb.week_end::DATE
    LEFT JOIN sentiment_analysis sa ON sa.analysis_date >= wb.week_start::DATE AND sa.analysis_date <= wb.week_end::DATE
    LEFT JOIN alerts a ON a.last_triggered_at >= wb.week_start AND a.last_triggered_at <= wb.week_end
    LEFT JOIN trades t ON t.executed_at >= wb.week_start AND t.executed_at <= wb.week_end
    GROUP BY wb.week_start, wb.week_end
),
previous_week AS (
    SELECT 
        DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') as prev_week_start,
        DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') + INTERVAL '6 days' as prev_week_end,
        COUNT(p.id) FILTER (WHERE p.is_evaluated = true) as prev_evaluated_predictions,
        AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true) as prev_avg_accuracy,
        COUNT(rf.id) as prev_feeds_processed,
        COUNT(pc.id) as prev_content_items_processed
    FROM predictions p
    FULL OUTER JOIN raw_feeds rf ON rf.created_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')
        AND rf.created_at <= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') + INTERVAL '6 days'
    FULL OUTER JOIN processed_content pc ON pc.created_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')
        AND pc.created_at <= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') + INTERVAL '6 days'
    WHERE p.created_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')
        AND p.created_at <= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') + INTERVAL '6 days'
)
SELECT 
    cw.week_start,
    cw.week_end,
    cw.evaluated_predictions,
    cw.avg_accuracy,
    cw.feeds_processed,
    cw.content_items_processed,
    cw.avg_content_quality,
    cw.stocks_tracked,
    cw.entities_with_sentiment,
    cw.active_alert_users,
    cw.trades_executed,
    cw.total_trade_value,
    -- Week-over-week changes
    CASE 
        WHEN pw.prev_evaluated_predictions > 0 THEN
            ((cw.evaluated_predictions - pw.prev_evaluated_predictions)::DECIMAL / pw.prev_evaluated_predictions * 100)
        ELSE NULL
    END as prediction_growth_pct,
    CASE 
        WHEN pw.prev_feeds_processed > 0 THEN
            ((cw.feeds_processed - pw.prev_feeds_processed)::DECIMAL / pw.prev_feeds_processed * 100)
        ELSE NULL
    END as feed_processing_growth_pct,
    cw.avg_accuracy - pw.prev_avg_accuracy as accuracy_improvement
FROM current_week cw
CROSS JOIN previous_week pw;

-- View for user activity report
CREATE OR REPLACE VIEW user_activity_report AS
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_since,
    -- Portfolio metrics
    COUNT(DISTINCT p.id) as portfolio_count,
    SUM(ph.position_value) as total_portfolio_value,
    SUM(ph.unrealized_pnl) as total_unrealized_pnl,
    -- Alert activity
    COUNT(DISTINCT a.id) as total_alerts,
    COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = true) as active_alerts,
    COUNT(*) FILTER (WHERE a.last_triggered_at >= CURRENT_DATE - INTERVAL '30 days') as alerts_triggered_30d,
    -- Trading activity
    COUNT(DISTINCT t.id) as trades_count,
    SUM(t.total_amount) as total_trade_volume,
    MAX(t.executed_at) as last_trade_date,
    -- Watchlist activity
    COUNT(DISTINCT w.id) as watchlist_count,
    COUNT(DISTINCT wi.symbol) as unique_symbols_watched,
    -- Engagement metrics
    CASE 
        WHEN MAX(GREATEST(
            COALESCE(a.last_triggered_at, '1900-01-01'::TIMESTAMP),
            COALESCE(t.executed_at, '1900-01-01'::TIMESTAMP),
            COALESCE(p.updated_at, '1900-01-01'::TIMESTAMP)
        )) >= CURRENT_DATE - INTERVAL '7 days' THEN 'Active'
        WHEN MAX(GREATEST(
            COALESCE(a.last_triggered_at, '1900-01-01'::TIMESTAMP),
            COALESCE(t.executed_at, '1900-01-01'::TIMESTAMP),
            COALESCE(p.updated_at, '1900-01-01'::TIMESTAMP)
        )) >= CURRENT_DATE - INTERVAL '30 days' THEN 'Semi-Active'
        ELSE 'Inactive'
    END as activity_status
FROM users u
LEFT JOIN portfolios p ON p.user_id = u.id
LEFT JOIN portfolio_holdings ph ON ph.portfolio_id = p.id
LEFT JOIN alerts a ON a.user_id = u.id
LEFT JOIN trades t ON t.user_id = u.id
LEFT JOIN watchlists w ON w.user_id = u.id
LEFT JOIN watchlist_items wi ON wi.watchlist_id = w.id
GROUP BY u.id, u.email, u.created_at
ORDER BY total_portfolio_value DESC NULLS LAST;

-- View for data quality report
CREATE OR REPLACE VIEW data_quality_report AS
SELECT 
    'stock_data' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE close > 0 AND high >= low AND volume >= 0) as valid_records,
    ROUND(
        (COUNT(*) FILTER (WHERE close > 0 AND high >= low AND volume >= 0)::DECIMAL / COUNT(*) * 100), 
        2
    ) as quality_percentage,
    COUNT(*) FILTER (WHERE volume = 0) as zero_volume_records,
    COUNT(*) FILTER (WHERE ABS(change_percent) > 50) as extreme_change_records,
    MAX(date) as latest_data_date
FROM stock_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
    'processed_content' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE confidence_score >= 0.5 AND LENGTH(processed_text) > 50) as valid_records,
    ROUND(
        (COUNT(*) FILTER (WHERE confidence_score >= 0.5 AND LENGTH(processed_text) > 50)::DECIMAL / COUNT(*) * 100), 
        2
    ) as quality_percentage,
    COUNT(*) FILTER (WHERE confidence_score < 0.5) as low_confidence_records,
    COUNT(*) FILTER (WHERE LENGTH(COALESCE(processed_text, '')) < 50) as short_content_records,
    MAX(created_at)::DATE as latest_data_date
FROM processed_content
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
    'predictions' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE confidence_level >= 0.5 AND LENGTH(prediction_text) > 10) as valid_records,
    ROUND(
        (COUNT(*) FILTER (WHERE confidence_level >= 0.5 AND LENGTH(prediction_text) > 10)::DECIMAL / COUNT(*) * 100), 
        2
    ) as quality_percentage,
    COUNT(*) FILTER (WHERE confidence_level < 0.5) as low_confidence_records,
    COUNT(*) FILTER (WHERE is_evaluated = true AND accuracy_score < 0.3) as low_accuracy_records,
    MAX(created_at)::DATE as latest_data_date
FROM predictions
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- View for financial performance summary
CREATE OR REPLACE VIEW financial_performance_summary AS
SELECT 
    DATE_TRUNC('month', t.executed_at) as month,
    COUNT(DISTINCT t.user_id) as active_traders,
    COUNT(*) as total_trades,
    SUM(t.total_amount) as total_volume,
    SUM(t.commission) as total_commissions,
    AVG(t.total_amount) as avg_trade_size,
    -- Performance by trade type
    COUNT(*) FILTER (WHERE t.trade_type = 'buy') as buy_trades,
    COUNT(*) FILTER (WHERE t.trade_type = 'sell') as sell_trades,
    SUM(t.total_amount) FILTER (WHERE t.trade_type = 'buy') as buy_volume,
    SUM(t.total_amount) FILTER (WHERE t.trade_type = 'sell') as sell_volume,
    -- Portfolio metrics
    AVG(ph.unrealized_pnl) as avg_unrealized_pnl,
    COUNT(DISTINCT ph.portfolio_id) as active_portfolios,
    SUM(ph.position_value) as total_assets_under_management
FROM trades t
LEFT JOIN portfolio_holdings ph ON ph.user_id = t.user_id
WHERE t.executed_at >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY DATE_TRUNC('month', t.executed_at)
ORDER BY month DESC;

-- View for system performance metrics
CREATE OR REPLACE VIEW system_performance_metrics AS
SELECT 
    DATE_TRUNC('hour', jq.created_at) as hour,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE jq.status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE jq.status = 'failed') as failed_jobs,
    ROUND(
        (COUNT(*) FILTER (WHERE jq.status = 'completed')::DECIMAL / COUNT(*) * 100), 
        2
    ) as success_rate,
    AVG(EXTRACT(EPOCH FROM jq.completed_at - jq.started_at)) FILTER (WHERE jq.status = 'completed') as avg_processing_time,
    MAX(EXTRACT(EPOCH FROM jq.completed_at - jq.started_at)) FILTER (WHERE jq.status = 'completed') as max_processing_time,
    -- By job type
    jsonb_object_agg(
        jq.job_type, 
        COUNT(*) FILTER (WHERE jq.job_type IS NOT NULL)
    ) as jobs_by_type
FROM job_queue jq
WHERE jq.created_at >= CURRENT_DATE - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', jq.created_at)
ORDER BY hour DESC;

-- Add view comments
COMMENT ON VIEW daily_system_metrics IS 'Daily system operational metrics for monitoring';
COMMENT ON VIEW weekly_performance_report IS 'Weekly performance summary with week-over-week comparisons';
COMMENT ON VIEW user_activity_report IS 'User engagement and activity analysis';
COMMENT ON VIEW data_quality_report IS 'Data quality assessment across key tables';
COMMENT ON VIEW financial_performance_summary IS 'Financial and trading activity summary by month';
COMMENT ON VIEW system_performance_metrics IS 'Hourly system performance and job processing metrics';