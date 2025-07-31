-- Create analytics views
-- Views for detailed analysis and reporting

-- View for stock performance analytics
CREATE OR REPLACE VIEW stock_performance_analytics AS
SELECT 
    e.symbol,
    e.name as company_name,
    e.sector,
    e.industry,
    sd.close as current_price,
    sd.volume as current_volume,
    sd.change_percent as day_change,
    -- Price changes over different periods
    calculate_price_changes(e.symbol, CURRENT_DATE).change_1d as change_1d,
    calculate_price_changes(e.symbol, CURRENT_DATE).change_5d as change_5d,
    calculate_price_changes(e.symbol, CURRENT_DATE).change_30d as change_30d,
    calculate_price_changes(e.symbol, CURRENT_DATE).change_ytd as change_ytd,
    -- Technical indicators
    ti_rsi.values->>'rsi' as rsi,
    ti_macd.values->>'macd' as macd,
    ti_bb.values->>'upper_band' as bollinger_upper,
    ti_bb.values->>'lower_band' as bollinger_lower,
    -- Volume analysis
    CASE 
        WHEN sd.volume > 0 AND avg_vol.avg_volume > 0 THEN
            sd.volume::DECIMAL / avg_vol.avg_volume
        ELSE NULL
    END as relative_volume,
    -- Sentiment
    sa.overall_sentiment,
    sa.confidence_score as sentiment_confidence,
    -- Analyst data
    ar.current_rating,
    ar.price_target,
    sd.date as data_date
FROM entities e
LEFT JOIN stock_data sd ON sd.symbol = e.symbol AND sd.date = CURRENT_DATE
LEFT JOIN (
    SELECT symbol, AVG(volume) as avg_volume
    FROM stock_data 
    WHERE date >= CURRENT_DATE - INTERVAL '20 days'
    GROUP BY symbol
) avg_vol ON avg_vol.symbol = e.symbol
LEFT JOIN technical_indicators ti_rsi ON ti_rsi.symbol = e.symbol 
    AND ti_rsi.indicator_type = 'RSI' AND ti_rsi.date = CURRENT_DATE
LEFT JOIN technical_indicators ti_macd ON ti_macd.symbol = e.symbol 
    AND ti_macd.indicator_type = 'MACD' AND ti_macd.date = CURRENT_DATE
LEFT JOIN technical_indicators ti_bb ON ti_bb.symbol = e.symbol 
    AND ti_bb.indicator_type = 'BB' AND ti_bb.date = CURRENT_DATE
LEFT JOIN sentiment_analysis sa ON sa.entity_id = e.id 
    AND sa.analysis_date = CURRENT_DATE
LEFT JOIN analyst_ratings ar ON ar.symbol = e.symbol 
    AND ar.rating_date = (
        SELECT MAX(rating_date) FROM analyst_ratings ar2 
        WHERE ar2.symbol = e.symbol
    )
WHERE e.entity_type = 'stock' AND e.is_active = true;

-- View for sector performance analysis
CREATE OR REPLACE VIEW sector_performance_analysis AS
SELECT 
    e.sector,
    COUNT(DISTINCT e.symbol) as stock_count,
    AVG(sd.change_percent) as avg_change,
    STDDEV(sd.change_percent) as volatility,
    SUM(sd.volume * sd.close) as market_value_traded,
    COUNT(*) FILTER (WHERE sd.change_percent > 0) as gainers,
    COUNT(*) FILTER (WHERE sd.change_percent < 0) as losers,
    COUNT(*) FILTER (WHERE sd.change_percent = 0) as unchanged,
    -- Momentum indicators
    AVG(CASE WHEN ti.values->>'rsi' IS NOT NULL 
        THEN (ti.values->>'rsi')::DECIMAL ELSE NULL END) as avg_rsi,
    -- Sentiment analysis
    AVG(sa.overall_sentiment) as avg_sentiment,
    COUNT(sa.id) as sentiment_coverage,
    -- Performance ranking
    RANK() OVER (ORDER BY AVG(sd.change_percent) DESC) as performance_rank
FROM entities e
LEFT JOIN stock_data sd ON sd.symbol = e.symbol AND sd.date = CURRENT_DATE
LEFT JOIN technical_indicators ti ON ti.symbol = e.symbol 
    AND ti.indicator_type = 'RSI' AND ti.date = CURRENT_DATE
LEFT JOIN sentiment_analysis sa ON sa.entity_id = e.id 
    AND sa.analysis_date = CURRENT_DATE
WHERE e.entity_type = 'stock' 
AND e.is_active = true 
AND e.sector IS NOT NULL
GROUP BY e.sector
ORDER BY avg_change DESC;

-- View for prediction accuracy trends
CREATE OR REPLACE VIEW prediction_accuracy_trends AS
SELECT 
    DATE_TRUNC('week', p.created_at) as week_start,
    p.prediction_type,
    p.time_horizon,
    COUNT(*) as total_predictions,
    COUNT(*) FILTER (WHERE p.is_evaluated = true) as evaluated_predictions,
    AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true) as avg_accuracy,
    AVG(p.confidence_level) as avg_confidence,
    -- Calibration analysis
    CASE 
        WHEN COUNT(*) FILTER (WHERE p.is_evaluated = true) > 0 THEN
            ABS(AVG(p.confidence_level) - AVG(p.accuracy_score * 100) FILTER (WHERE p.is_evaluated = true))
        ELSE NULL
    END as calibration_error,
    -- Trend analysis
    LAG(AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true)) 
        OVER (PARTITION BY p.prediction_type, p.time_horizon ORDER BY DATE_TRUNC('week', p.created_at)) as prev_accuracy,
    COUNT(*) FILTER (WHERE p.accuracy_score > 0.8) as high_accuracy_count
FROM predictions p
WHERE p.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', p.created_at), p.prediction_type, p.time_horizon
ORDER BY week_start DESC, p.prediction_type, p.time_horizon;

-- View for feed source analytics
CREATE OR REPLACE VIEW feed_source_analytics AS
SELECT 
    fs.id,
    fs.name,
    fs.type,
    fs.priority,
    -- Processing metrics
    COUNT(rf.id) as total_items_7d,
    COUNT(*) FILTER (WHERE rf.processing_status = 'completed') as completed_items,
    COUNT(*) FILTER (WHERE rf.processing_status = 'failed') as failed_items,
    CASE 
        WHEN COUNT(rf.id) > 0 THEN
            COUNT(*) FILTER (WHERE rf.processing_status = 'completed')::DECIMAL / COUNT(rf.id) * 100
        ELSE 0
    END as success_rate,
    -- Content quality metrics
    AVG(pc.confidence_score) FILTER (WHERE pc.confidence_score IS NOT NULL) as avg_content_confidence,
    AVG(LENGTH(pc.processed_text)) FILTER (WHERE pc.processed_text IS NOT NULL) as avg_content_length,
    COUNT(DISTINCT pc.id) as processed_content_count,
    -- Unique entities extracted
    COUNT(DISTINCT entity_extracts.entity_id) as unique_entities_extracted,
    -- Sentiment distribution
    AVG(pc.sentiment_score) FILTER (WHERE pc.sentiment_score IS NOT NULL) as avg_sentiment,
    -- Timeliness
    AVG(EXTRACT(EPOCH FROM pc.created_at - rf.created_at)) / 60 as avg_processing_time_minutes,
    fs.last_processed_at,
    NOW() - fs.last_processed_at as time_since_last_process
FROM feed_sources fs
LEFT JOIN raw_feeds rf ON rf.source_id = fs.id 
    AND rf.created_at >= CURRENT_DATE - INTERVAL '7 days'
LEFT JOIN processed_content pc ON pc.raw_feed_id = rf.id
LEFT JOIN LATERAL (
    SELECT DISTINCT entity_id
    FROM kg_relationships kr
    WHERE kr.context_data->>'content_id' = pc.id::TEXT
) entity_extracts ON true
WHERE fs.is_active = true
GROUP BY fs.id, fs.name, fs.type, fs.priority, fs.last_processed_at
ORDER BY success_rate DESC, total_items_7d DESC;

-- View for market sentiment trends
CREATE OR REPLACE VIEW market_sentiment_trends AS
SELECT 
    sa.analysis_date,
    AVG(sa.overall_sentiment) as avg_sentiment,
    STDDEV(sa.overall_sentiment) as sentiment_volatility,
    COUNT(*) as entity_count,
    COUNT(*) FILTER (WHERE sa.overall_sentiment > 0.2) as positive_count,
    COUNT(*) FILTER (WHERE sa.overall_sentiment < -0.2) as negative_count,
    COUNT(*) FILTER (WHERE ABS(sa.overall_sentiment) <= 0.2) as neutral_count,
    -- Sector breakdown
    jsonb_object_agg(
        COALESCE(e.sector, 'Unknown'),
        ROUND(AVG(sa.overall_sentiment), 3)
    ) FILTER (WHERE e.sector IS NOT NULL) as sentiment_by_sector,
    -- Confidence metrics
    AVG(sa.confidence_score) as avg_confidence,
    -- Market correlation
    CORR(sa.overall_sentiment, mo.avg_change) as sentiment_market_correlation
FROM sentiment_analysis sa
LEFT JOIN entities e ON e.id = sa.entity_id
LEFT JOIN (
    SELECT 
        date,
        AVG(change_percent) as avg_change
    FROM stock_data 
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY date
) mo ON mo.date = sa.analysis_date
WHERE sa.analysis_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sa.analysis_date
ORDER BY sa.analysis_date DESC;

-- View for options flow analysis
CREATE OR REPLACE VIEW options_flow_analysis AS
SELECT 
    od.symbol,
    od.date,
    od.expiration_date,
    CASE 
        WHEN od.expiration_date <= od.date + INTERVAL '7 days' THEN 'Weekly'
        WHEN od.expiration_date <= od.date + INTERVAL '30 days' THEN 'Monthly'
        ELSE 'Longer'
    END as expiration_category,
    -- Volume and interest metrics
    SUM(od.volume) FILTER (WHERE od.option_type = 'call') as call_volume,
    SUM(od.volume) FILTER (WHERE od.option_type = 'put') as put_volume,
    SUM(od.open_interest) FILTER (WHERE od.option_type = 'call') as call_oi,
    SUM(od.open_interest) FILTER (WHERE od.option_type = 'put') as put_oi,
    -- Ratios
    CASE 
        WHEN SUM(od.volume) FILTER (WHERE od.option_type = 'put') > 0 THEN
            SUM(od.volume) FILTER (WHERE od.option_type = 'call')::DECIMAL / 
            SUM(od.volume) FILTER (WHERE od.option_type = 'put')
        ELSE NULL
    END as call_put_volume_ratio,
    -- Unusual activity
    SUM(od.volume) as total_volume,
    SUM(od.open_interest) as total_oi,
    AVG(od.volume_oi_ratio) as avg_volume_oi_ratio,
    -- Implied volatility
    AVG(od.implied_volatility) as avg_iv,
    -- Greeks summary
    AVG((od.greeks->>'delta')::DECIMAL) as avg_delta,
    AVG((od.greeks->>'gamma')::DECIMAL) as avg_gamma,
    AVG((od.greeks->>'theta')::DECIMAL) as avg_theta,
    AVG((od.greeks->>'vega')::DECIMAL) as avg_vega
FROM options_data od
WHERE od.date >= CURRENT_DATE - INTERVAL '7 days'
AND od.volume > 0
GROUP BY od.symbol, od.date, od.expiration_date
HAVING SUM(od.volume) > 100  -- Filter for meaningful volume
ORDER BY od.date DESC, total_volume DESC;

-- Add view comments
COMMENT ON VIEW stock_performance_analytics IS 'Comprehensive stock performance metrics with technical and fundamental data';
COMMENT ON VIEW sector_performance_analysis IS 'Sector-level performance comparison and rankings';
COMMENT ON VIEW prediction_accuracy_trends IS 'Track prediction accuracy over time with calibration analysis';
COMMENT ON VIEW feed_source_analytics IS 'Feed source performance and content quality metrics';
COMMENT ON VIEW market_sentiment_trends IS 'Market sentiment trends with sector breakdown and correlation';
COMMENT ON VIEW options_flow_analysis IS 'Options trading flow analysis with volume and Greeks';