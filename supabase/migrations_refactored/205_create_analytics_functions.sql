-- Create analytics and calculation functions
-- Functions for data analysis and metrics

-- Function to calculate stock price changes
CREATE OR REPLACE FUNCTION calculate_price_changes(
    stock_symbol VARCHAR(20),
    base_date DATE
) RETURNS TABLE (
    change_1d DECIMAL(10, 4),
    change_5d DECIMAL(10, 4),
    change_30d DECIMAL(10, 4),
    change_ytd DECIMAL(10, 4)
) AS $$
DECLARE
    base_price DECIMAL(10, 4);
    price_1d DECIMAL(10, 4);
    price_5d DECIMAL(10, 4);
    price_30d DECIMAL(10, 4);
    price_ytd DECIMAL(10, 4);
BEGIN
    -- Get base price
    SELECT close INTO base_price 
    FROM stock_data 
    WHERE symbol = stock_symbol AND date = base_date;
    
    IF base_price IS NULL THEN
        RETURN;
    END IF;
    
    -- Get comparison prices
    SELECT close INTO price_1d 
    FROM stock_data 
    WHERE symbol = stock_symbol AND date = base_date - INTERVAL '1 day'
    ORDER BY date DESC LIMIT 1;
    
    SELECT close INTO price_5d 
    FROM stock_data 
    WHERE symbol = stock_symbol AND date = base_date - INTERVAL '5 days'
    ORDER BY date DESC LIMIT 1;
    
    SELECT close INTO price_30d 
    FROM stock_data 
    WHERE symbol = stock_symbol AND date = base_date - INTERVAL '30 days'
    ORDER BY date DESC LIMIT 1;
    
    SELECT close INTO price_ytd 
    FROM stock_data 
    WHERE symbol = stock_symbol 
    AND date = DATE_TRUNC('year', base_date)::DATE
    ORDER BY date LIMIT 1;
    
    -- Calculate percentage changes
    RETURN QUERY SELECT 
        CASE WHEN price_1d > 0 THEN (base_price - price_1d) / price_1d * 100 ELSE NULL END,
        CASE WHEN price_5d > 0 THEN (base_price - price_5d) / price_5d * 100 ELSE NULL END,
        CASE WHEN price_30d > 0 THEN (base_price - price_30d) / price_30d * 100 ELSE NULL END,
        CASE WHEN price_ytd > 0 THEN (base_price - price_ytd) / price_ytd * 100 ELSE NULL END;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate sentiment score aggregation
CREATE OR REPLACE FUNCTION calculate_sentiment_aggregate(
    entity_uuid UUID,
    start_date DATE,
    end_date DATE
) RETURNS TABLE (
    avg_sentiment DECIMAL(5, 2),
    sentiment_trend VARCHAR(20),
    mention_count INTEGER,
    confidence_score DECIMAL(5, 2)
) AS $$
DECLARE
    recent_sentiment DECIMAL(5, 2);
    older_sentiment DECIMAL(5, 2);
    trend_direction VARCHAR(20);
BEGIN
    -- Calculate average sentiment and mention count
    SELECT 
        AVG(overall_sentiment)::DECIMAL(5, 2),
        SUM(mention_count)::INTEGER,
        AVG(confidence_score)::DECIMAL(5, 2)
    INTO avg_sentiment, mention_count, confidence_score
    FROM sentiment_analysis 
    WHERE entity_id = entity_uuid 
    AND analysis_date BETWEEN start_date AND end_date;
    
    -- Calculate trend (compare first half vs second half of period)
    SELECT AVG(overall_sentiment) INTO recent_sentiment
    FROM sentiment_analysis 
    WHERE entity_id = entity_uuid 
    AND analysis_date BETWEEN start_date + (end_date - start_date) / 2 AND end_date;
    
    SELECT AVG(overall_sentiment) INTO older_sentiment
    FROM sentiment_analysis 
    WHERE entity_id = entity_uuid 
    AND analysis_date BETWEEN start_date AND start_date + (end_date - start_date) / 2;
    
    -- Determine trend direction
    IF recent_sentiment > older_sentiment + 0.1 THEN
        trend_direction := 'improving';
    ELSIF recent_sentiment < older_sentiment - 0.1 THEN
        trend_direction := 'declining';
    ELSE
        trend_direction := 'stable';
    END IF;
    
    RETURN QUERY SELECT avg_sentiment, trend_direction, mention_count, confidence_score;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate portfolio metrics
CREATE OR REPLACE FUNCTION calculate_portfolio_metrics(portfolio_uuid UUID) RETURNS TABLE (
    total_value DECIMAL(20, 2),
    total_cost DECIMAL(20, 2),
    unrealized_pnl DECIMAL(20, 2),
    day_change DECIMAL(20, 2),
    day_change_percent DECIMAL(10, 4),
    position_count INTEGER,
    top_holding VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(ph.position_value)::DECIMAL(20, 2) as total_value,
        SUM(ph.cost_basis * ph.quantity)::DECIMAL(20, 2) as total_cost,
        SUM(ph.unrealized_pnl)::DECIMAL(20, 2) as unrealized_pnl,
        SUM(ph.day_change)::DECIMAL(20, 2) as day_change,
        CASE 
            WHEN SUM(ph.position_value - ph.day_change) > 0 THEN
                (SUM(ph.day_change) / SUM(ph.position_value - ph.day_change) * 100)::DECIMAL(10, 4)
            ELSE NULL 
        END as day_change_percent,
        COUNT(*)::INTEGER as position_count,
        (SELECT symbol FROM portfolio_holdings 
         WHERE portfolio_id = portfolio_uuid 
         ORDER BY position_value DESC LIMIT 1) as top_holding
    FROM portfolio_holdings ph
    WHERE ph.portfolio_id = portfolio_uuid
    AND ph.quantity > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate correlation coefficient
CREATE OR REPLACE FUNCTION calculate_correlation(
    symbol1 VARCHAR(20),
    symbol2 VARCHAR(20),
    days_back INTEGER DEFAULT 252
) RETURNS DECIMAL(10, 6) AS $$
DECLARE
    correlation_result DECIMAL(10, 6);
BEGIN
    WITH price_data AS (
        SELECT 
            sd1.date,
            sd1.change_percent as change1,
            sd2.change_percent as change2
        FROM stock_data sd1
        JOIN stock_data sd2 ON sd1.date = sd2.date
        WHERE sd1.symbol = symbol1 
        AND sd2.symbol = symbol2
        AND sd1.date >= CURRENT_DATE - (days_back || ' days')::INTERVAL
        AND sd1.change_percent IS NOT NULL
        AND sd2.change_percent IS NOT NULL
    ),
    stats AS (
        SELECT 
            AVG(change1) as mean1,
            AVG(change2) as mean2,
            STDDEV_POP(change1) as std1,
            STDDEV_POP(change2) as std2,
            COUNT(*) as n
        FROM price_data
    )
    SELECT 
        CASE 
            WHEN stats.std1 > 0 AND stats.std2 > 0 AND stats.n > 1 THEN
                (SUM((pd.change1 - stats.mean1) * (pd.change2 - stats.mean2)) / (stats.n - 1)) 
                / (stats.std1 * stats.std2)
            ELSE NULL 
        END::DECIMAL(10, 6)
    INTO correlation_result
    FROM price_data pd, stats
    GROUP BY stats.mean1, stats.mean2, stats.std1, stats.std2, stats.n;
    
    RETURN correlation_result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate moving average
CREATE OR REPLACE FUNCTION calculate_moving_average(
    stock_symbol VARCHAR(20),
    periods INTEGER,
    end_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL(10, 4) AS $$
DECLARE
    ma_result DECIMAL(10, 4);
BEGIN
    SELECT AVG(close)::DECIMAL(10, 4) INTO ma_result
    FROM (
        SELECT close 
        FROM stock_data 
        WHERE symbol = stock_symbol 
        AND date <= end_date
        ORDER BY date DESC 
        LIMIT periods
    ) recent_prices;
    
    RETURN ma_result;
END;
$$ LANGUAGE plpgsql;

-- Function to detect anomalies in data
CREATE OR REPLACE FUNCTION detect_anomalies(
    metric_values DECIMAL[],
    threshold_multiplier DECIMAL DEFAULT 2.0
) RETURNS BOOLEAN[] AS $$
DECLARE
    mean_val DECIMAL;
    std_val DECIMAL;
    anomalies BOOLEAN[] := '{}';
    i INTEGER;
BEGIN
    -- Calculate mean and standard deviation
    SELECT AVG(val), STDDEV_POP(val) 
    INTO mean_val, std_val
    FROM unnest(metric_values) AS val;
    
    -- If std_val is NULL or 0, no anomalies can be detected
    IF std_val IS NULL OR std_val = 0 THEN
        FOR i IN 1..array_length(metric_values, 1) LOOP
            anomalies := array_append(anomalies, FALSE);
        END LOOP;
        RETURN anomalies;
    END IF;
    
    -- Check each value for anomaly
    FOR i IN 1..array_length(metric_values, 1) LOOP
        IF ABS(metric_values[i] - mean_val) > (threshold_multiplier * std_val) THEN
            anomalies := array_append(anomalies, TRUE);
        ELSE
            anomalies := array_append(anomalies, FALSE);
        END IF;
    END LOOP;
    
    RETURN anomalies;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION calculate_price_changes IS 'Calculate price changes over multiple time periods';
COMMENT ON FUNCTION calculate_sentiment_aggregate IS 'Aggregate sentiment data with trend analysis';
COMMENT ON FUNCTION calculate_portfolio_metrics IS 'Calculate comprehensive portfolio metrics';
COMMENT ON FUNCTION calculate_correlation IS 'Calculate correlation coefficient between two assets';
COMMENT ON FUNCTION calculate_moving_average IS 'Calculate simple moving average for specified periods';
COMMENT ON FUNCTION detect_anomalies IS 'Detect statistical anomalies in metric arrays';