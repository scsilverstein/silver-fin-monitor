-- Create final specialized views
-- Complete the view system with remaining specialized views

-- View for real-time market snapshot
CREATE OR REPLACE VIEW real_time_market_snapshot AS
SELECT 
    'market_overview' as snapshot_type,
    jsonb_build_object(
        'timestamp', NOW(),
        'total_stocks', COUNT(DISTINCT sd.symbol),
        'market_cap_weighted_change', 
            SUM(sd.change_percent * COALESCE((e.metadata->>'market_cap')::NUMERIC, 1)) / 
            NULLIF(SUM(COALESCE((e.metadata->>'market_cap')::NUMERIC, 1)), 0),
        'gainers', COUNT(*) FILTER (WHERE sd.change_percent > 0),
        'losers', COUNT(*) FILTER (WHERE sd.change_percent < 0),
        'unchanged', COUNT(*) FILTER (WHERE sd.change_percent = 0),
        'volume_leaders', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'symbol', symbol,
                    'volume', volume,
                    'change_percent', change_percent
                )
            )
            FROM (
                SELECT symbol, volume, change_percent
                FROM stock_data 
                WHERE date = CURRENT_DATE AND volume > 0
                ORDER BY volume DESC 
                LIMIT 5
            ) top_volume
        ),
        'biggest_movers', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'symbol', symbol,
                    'change_percent', change_percent,
                    'volume', volume
                )
            )
            FROM (
                SELECT symbol, change_percent, volume
                FROM stock_data 
                WHERE date = CURRENT_DATE
                ORDER BY ABS(change_percent) DESC 
                LIMIT 10
            ) big_movers
        )
    ) as snapshot_data
FROM stock_data sd
LEFT JOIN entities e ON e.symbol = sd.symbol AND e.entity_type = 'stock'
WHERE sd.date = CURRENT_DATE;

-- View for AI insights dashboard
CREATE OR REPLACE VIEW ai_insights_dashboard AS
SELECT 
    'latest_analysis' as insight_type,
    da.analysis_date,
    jsonb_build_object(
        'market_sentiment', da.market_sentiment,
        'confidence_score', da.confidence_score,
        'key_themes', da.key_themes,
        'summary', LEFT(da.overall_summary, 500),
        'sources_analyzed', da.sources_analyzed,
        'predictions_count', (
            SELECT COUNT(*) FROM predictions p WHERE p.daily_analysis_id = da.id
        ),
        'high_confidence_predictions', (
            SELECT COUNT(*) FROM predictions p 
            WHERE p.daily_analysis_id = da.id AND p.confidence_level > 0.8
        ),
        'sentiment_trend', (
            SELECT 
                CASE 
                    WHEN da.market_sentiment = 'bullish' AND 
                         LAG(da2.market_sentiment) OVER (ORDER BY da2.analysis_date) != 'bullish' THEN 'improving'
                    WHEN da.market_sentiment = 'bearish' AND 
                         LAG(da2.market_sentiment) OVER (ORDER BY da2.analysis_date) != 'bearish' THEN 'declining'
                    ELSE 'stable'
                END
            FROM daily_analysis da2
            WHERE da2.analysis_date <= da.analysis_date
            ORDER BY da2.analysis_date DESC
            LIMIT 1
        )
    ) as insight_data
FROM daily_analysis da
WHERE da.analysis_date = (SELECT MAX(analysis_date) FROM daily_analysis)

UNION ALL

SELECT 
    'prediction_performance' as insight_type,
    CURRENT_DATE as analysis_date,
    jsonb_build_object(
        'total_predictions', COUNT(*),
        'evaluated_predictions', COUNT(*) FILTER (WHERE is_evaluated = true),
        'avg_accuracy', AVG(accuracy_score) FILTER (WHERE is_evaluated = true),
        'accuracy_by_horizon', jsonb_object_agg(
            time_horizon,
            ROUND(AVG(accuracy_score) FILTER (WHERE is_evaluated = true), 3)
        ),
        'calibration_score', ABS(
            AVG(confidence_level) - 
            AVG(accuracy_score * 100) FILTER (WHERE is_evaluated = true)
        ),
        'recent_trend', (
            SELECT 
                CASE 
                    WHEN recent_acc > older_acc + 0.05 THEN 'improving'
                    WHEN recent_acc < older_acc - 0.05 THEN 'declining'
                    ELSE 'stable'
                END
            FROM (
                SELECT 
                    AVG(accuracy_score) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_acc,
                    AVG(accuracy_score) FILTER (WHERE created_at < CURRENT_DATE - INTERVAL '7 days') as older_acc
                FROM predictions
                WHERE is_evaluated = true AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            ) trend_calc
        )
    ) as insight_data
FROM predictions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- View for risk monitoring dashboard
CREATE OR REPLACE VIEW risk_monitoring_dashboard AS
SELECT 
    'portfolio_risk' as risk_type,
    p.id as portfolio_id,
    p.name as portfolio_name,
    jsonb_build_object(
        'total_value', SUM(ph.position_value),
        'concentration_risk', (
            SELECT MAX(position_value) / NULLIF(SUM(position_value), 0) * 100
            FROM portfolio_holdings ph2 WHERE ph2.portfolio_id = p.id
        ),
        'sector_concentration', (
            SELECT jsonb_object_agg(sector, allocation_pct)
            FROM (
                SELECT 
                    COALESCE(e.sector, 'Unknown') as sector,
                    ROUND(SUM(ph3.position_value) / NULLIF(total_value.total, 0) * 100, 2) as allocation_pct
                FROM portfolio_holdings ph3
                LEFT JOIN entities e ON e.symbol = ph3.symbol
                CROSS JOIN (SELECT SUM(position_value) as total FROM portfolio_holdings WHERE portfolio_id = p.id) total_value
                WHERE ph3.portfolio_id = p.id
                GROUP BY COALESCE(e.sector, 'Unknown'), total_value.total
                HAVING SUM(ph3.position_value) / NULLIF(total_value.total, 0) > 0.05
            ) sector_alloc
        ),
        'volatility_estimate', (
            SELECT STDDEV(day_change_pct) * SQRT(252)
            FROM (
                SELECT 
                    SUM(ph4.day_change) / NULLIF(SUM(ph4.position_value - ph4.day_change), 0) * 100 as day_change_pct
                FROM portfolio_holdings ph4
                WHERE ph4.portfolio_id = p.id
                GROUP BY p.id
            ) daily_returns
        ),
        'positions_at_risk', COUNT(*) FILTER (WHERE ph.unrealized_pnl / NULLIF(ph.position_value, 0) < -0.1)
    ) as risk_data
FROM portfolios p
LEFT JOIN portfolio_holdings ph ON ph.portfolio_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name

UNION ALL

SELECT 
    'system_risk' as risk_type,
    NULL as portfolio_id,
    'System Health' as portfolio_name,
    jsonb_build_object(
        'failed_jobs_24h', (
            SELECT COUNT(*) FROM job_queue 
            WHERE status = 'failed' AND completed_at >= NOW() - INTERVAL '24 hours'
        ),
        'stuck_jobs', (
            SELECT COUNT(*) FROM job_queue 
            WHERE status = 'processing' AND started_at < NOW() - INTERVAL '1 hour'
        ),
        'data_freshness_issues', (
            SELECT COUNT(*) FROM feed_sources 
            WHERE is_active = true AND last_processed_at < NOW() - INTERVAL '6 hours'
        ),
        'cache_hit_ratio', (
            SELECT ROUND(
                (SELECT COUNT(*) FROM cache_store WHERE expires_at > NOW())::DECIMAL /
                NULLIF((SELECT COUNT(*) FROM cache_store), 0) * 100, 2
            )
        ),
        'disk_usage_mb', (
            SELECT pg_database_size(current_database()) / 1024 / 1024
        )
    ) as risk_data;

-- View for market screening results
CREATE OR REPLACE VIEW market_screening_results AS
SELECT 
    'momentum_screen' as screen_type,
    sr.scan_date,
    jsonb_agg(
        jsonb_build_object(
            'symbol', sr.symbol,
            'score', sr.score,
            'signal_strength', sr.signal_strength,
            'metrics', sr.metrics
        ) ORDER BY sr.score DESC
    ) as results
FROM scanner_results sr
WHERE sr.scanner_type = 'momentum' 
AND sr.scan_date = CURRENT_DATE
AND sr.score > 50
GROUP BY sr.scan_date

UNION ALL

SELECT 
    'value_screen' as screen_type,
    sr.scan_date,
    jsonb_agg(
        jsonb_build_object(
            'symbol', sr.symbol,
            'score', sr.score,
            'signal_strength', sr.signal_strength,
            'metrics', sr.metrics
        ) ORDER BY sr.score DESC
    ) as results
FROM scanner_results sr
WHERE sr.scanner_type = 'value' 
AND sr.scan_date = CURRENT_DATE
AND sr.score > 50
GROUP BY sr.scan_date

UNION ALL

SELECT 
    'technical_screen' as screen_type,
    sr.scan_date,
    jsonb_agg(
        jsonb_build_object(
            'symbol', sr.symbol,
            'score', sr.score,
            'signal_strength', sr.signal_strength,
            'metrics', sr.metrics
        ) ORDER BY sr.score DESC
    ) as results
FROM scanner_results sr
WHERE sr.scanner_type = 'technical' 
AND sr.scan_date = CURRENT_DATE
AND sr.score > 50
GROUP BY sr.scan_date;

-- View for knowledge graph visualization
CREATE OR REPLACE VIEW knowledge_graph_visualization AS
SELECT 
    'entities' as element_type,
    jsonb_agg(
        jsonb_build_object(
            'id', ke.id,
            'name', ke.name,
            'type', ke.entity_type,
            'confidence', ke.confidence_score,
            'properties', ke.properties,
            'position', COALESCE(layout.entity_positions->ke.id::TEXT, '{"x": 0, "y": 0}')
        )
    ) as elements
FROM kg_entities ke
LEFT JOIN kg_graph_layouts layout ON layout.is_default = true
WHERE ke.confidence_score > 0.5
AND ke.created_at >= CURRENT_DATE - INTERVAL '30 days'

UNION ALL

SELECT 
    'relationships' as element_type,
    jsonb_agg(
        jsonb_build_object(
            'source', kr.source_entity_id,
            'target', kr.target_entity_id,
            'type', kr.relationship_type,
            'strength', kr.strength,
            'context', kr.context_data
        )
    ) as elements
FROM kg_relationships kr
WHERE kr.strength > 0.3
AND (kr.valid_to IS NULL OR kr.valid_to > NOW())
AND kr.created_at >= CURRENT_DATE - INTERVAL '30 days';

-- View for API usage analytics
CREATE OR REPLACE VIEW api_usage_analytics AS
SELECT 
    DATE_TRUNC('day', aul.created_at) as usage_date,
    aul.endpoint,
    aul.method,
    COUNT(*) as request_count,
    AVG(aul.response_time_ms) as avg_response_time,
    COUNT(*) FILTER (WHERE aul.status_code >= 200 AND aul.status_code < 300) as success_count,
    COUNT(*) FILTER (WHERE aul.status_code >= 400) as error_count,
    ROUND(
        (COUNT(*) FILTER (WHERE aul.status_code >= 200 AND aul.status_code < 300)::DECIMAL / COUNT(*) * 100), 
        2
    ) as success_rate,
    COUNT(DISTINCT ak.user_id) as unique_users,
    MAX(aul.response_time_ms) as max_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY aul.response_time_ms) as p95_response_time
FROM api_usage_logs aul
LEFT JOIN api_keys ak ON ak.key_hash = aul.api_key_hash
WHERE aul.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', aul.created_at), aul.endpoint, aul.method
ORDER BY usage_date DESC, request_count DESC;

-- View for comprehensive system status
CREATE OR REPLACE VIEW system_status_overview AS
SELECT 
    'overall' as status_type,
    jsonb_build_object(
        'timestamp', NOW(),
        'system_health', CASE 
            WHEN (SELECT COUNT(*) FROM job_queue WHERE status = 'failed' AND completed_at >= NOW() - INTERVAL '1 hour') > 10 THEN 'critical'
            WHEN (SELECT COUNT(*) FROM job_queue WHERE status = 'processing' AND started_at < NOW() - INTERVAL '30 minutes') > 5 THEN 'warning'
            ELSE 'healthy'
        END,
        'data_freshness', CASE 
            WHEN (SELECT COUNT(*) FROM feed_sources WHERE is_active = true AND last_processed_at < NOW() - INTERVAL '4 hours') > 3 THEN 'stale'
            WHEN (SELECT COUNT(*) FROM feed_sources WHERE is_active = true AND last_processed_at < NOW() - INTERVAL '2 hours') > 1 THEN 'warning'
            ELSE 'fresh'
        END,
        'prediction_accuracy', (
            SELECT AVG(accuracy_score) FROM predictions 
            WHERE is_evaluated = true AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        ),
        'active_alerts', (SELECT COUNT(*) FROM alerts WHERE is_active = true),
        'processing_backlog', (SELECT COUNT(*) FROM job_queue WHERE status = 'pending'),
        'cache_efficiency', (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE expires_at > NOW())::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2
            ) FROM cache_store
        )
    ) as status_data;

-- Add final view comments
COMMENT ON VIEW real_time_market_snapshot IS 'Real-time market overview with key metrics and movers';
COMMENT ON VIEW ai_insights_dashboard IS 'AI-powered insights and analysis summary for dashboard';
COMMENT ON VIEW risk_monitoring_dashboard IS 'Risk assessment metrics for portfolios and system';
COMMENT ON VIEW market_screening_results IS 'Latest market screening results by strategy type';
COMMENT ON VIEW knowledge_graph_visualization IS 'Knowledge graph data formatted for visualization';
COMMENT ON VIEW api_usage_analytics IS 'API usage statistics and performance metrics';
COMMENT ON VIEW system_status_overview IS 'Comprehensive system health and status overview';