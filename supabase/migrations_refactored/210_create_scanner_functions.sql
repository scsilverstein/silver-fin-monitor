-- Create stock scanner functions
-- Functions for stock screening and scanning operations

-- Function to scan for unusual volume
CREATE OR REPLACE FUNCTION scan_unusual_volume(
    volume_threshold DECIMAL DEFAULT 2.0, -- 2x average volume
    min_price DECIMAL DEFAULT 1.0,
    max_results INTEGER DEFAULT 50
) RETURNS TABLE (
    symbol VARCHAR(20),
    current_volume BIGINT,
    average_volume BIGINT,
    volume_ratio DECIMAL(5, 2),
    current_price DECIMAL(10, 4),
    price_change_percent DECIMAL(10, 4),
    market_cap DECIMAL(20, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH volume_analysis AS (
        SELECT 
            sd.symbol,
            sd.volume as current_vol,
            sd.close as current_prc,
            sd.change_percent,
            -- Calculate 20-day average volume
            AVG(sd_avg.volume) as avg_vol
        FROM stock_data sd
        JOIN stock_data sd_avg ON sd_avg.symbol = sd.symbol
            AND sd_avg.date BETWEEN sd.date - INTERVAL '20 days' AND sd.date - INTERVAL '1 day'
        WHERE sd.date = CURRENT_DATE
        AND sd.close >= min_price
        AND sd.volume > 0
        GROUP BY sd.symbol, sd.volume, sd.close, sd.change_percent
    ),
    filtered_results AS (
        SELECT 
            va.*,
            (va.current_vol::DECIMAL / NULLIF(va.avg_vol, 0)) as vol_ratio,
            e.metadata->>'market_cap' as market_cap_text
        FROM volume_analysis va
        LEFT JOIN entities e ON e.symbol = va.symbol AND e.entity_type = 'stock'
        WHERE va.avg_vol > 0 
        AND (va.current_vol::DECIMAL / va.avg_vol) >= volume_threshold
    )
    SELECT 
        fr.symbol,
        fr.current_vol,
        fr.avg_vol::BIGINT,
        fr.vol_ratio::DECIMAL(5, 2),
        fr.current_prc,
        fr.change_percent,
        COALESCE(fr.market_cap_text::DECIMAL, 0)::DECIMAL(20, 2)
    FROM filtered_results fr
    ORDER BY fr.vol_ratio DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to scan for price breakouts
CREATE OR REPLACE FUNCTION scan_price_breakouts(
    breakout_period INTEGER DEFAULT 20,
    min_volume INTEGER DEFAULT 100000,
    max_results INTEGER DEFAULT 50
) RETURNS TABLE (
    symbol VARCHAR(20),
    current_price DECIMAL(10, 4),
    resistance_level DECIMAL(10, 4),
    breakout_strength DECIMAL(5, 2),
    volume BIGINT,
    price_change_percent DECIMAL(10, 4)
) AS $$
BEGIN
    RETURN QUERY
    WITH resistance_levels AS (
        SELECT 
            sd.symbol,
            sd.close as current_price,
            sd.volume,
            sd.change_percent,
            -- Calculate resistance as max high in lookback period
            MAX(sd_hist.high) as resistance_high
        FROM stock_data sd
        JOIN stock_data sd_hist ON sd_hist.symbol = sd.symbol
            AND sd_hist.date BETWEEN sd.date - (breakout_period || ' days')::INTERVAL AND sd.date - INTERVAL '1 day'
        WHERE sd.date = CURRENT_DATE
        AND sd.volume >= min_volume
        GROUP BY sd.symbol, sd.close, sd.volume, sd.change_percent
    )
    SELECT 
        rl.symbol,
        rl.current_price,
        rl.resistance_high,
        -- Breakout strength as percentage above resistance
        CASE 
            WHEN rl.resistance_high > 0 THEN 
                ((rl.current_price - rl.resistance_high) / rl.resistance_high * 100)::DECIMAL(5, 2)
            ELSE 0::DECIMAL(5, 2)
        END as breakout_str,
        rl.volume,
        rl.change_percent
    FROM resistance_levels rl
    WHERE rl.current_price > rl.resistance_high  -- Price broke above resistance
    ORDER BY breakout_str DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to scan for earnings momentum
CREATE OR REPLACE FUNCTION scan_earnings_momentum(
    min_surprise_percent DECIMAL DEFAULT 5.0,
    days_since_earnings INTEGER DEFAULT 5,
    max_results INTEGER DEFAULT 50
) RETURNS TABLE (
    symbol VARCHAR(20),
    earnings_date DATE,
    surprise_percent DECIMAL(10, 4),
    current_price DECIMAL(10, 4),
    price_change_since_earnings DECIMAL(10, 4),
    forward_pe DECIMAL(10, 4),
    recommendation VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_earnings AS (
        SELECT 
            ed.symbol,
            ed.report_date,
            ed.surprise_percent,
            sd_earnings.close as earnings_day_price,
            sd_current.close as current_price,
            sd_current.date as current_date
        FROM earnings_data ed
        JOIN stock_data sd_earnings ON sd_earnings.symbol = ed.symbol 
            AND sd_earnings.date = ed.report_date
        JOIN stock_data sd_current ON sd_current.symbol = ed.symbol 
            AND sd_current.date = CURRENT_DATE
        WHERE ed.report_date >= CURRENT_DATE - (days_since_earnings || ' days')::INTERVAL
        AND ed.surprise_percent >= min_surprise_percent
    ),
    analysis_data AS (
        SELECT 
            re.*,
            CASE 
                WHEN re.earnings_day_price > 0 THEN 
                    ((re.current_price - re.earnings_day_price) / re.earnings_day_price * 100)
                ELSE 0
            END as price_change_pct,
            e.metadata->>'forward_pe' as forward_pe_text
        FROM recent_earnings re
        LEFT JOIN entities e ON e.symbol = re.symbol AND e.entity_type = 'stock'
    )
    SELECT 
        ad.symbol,
        ad.report_date,
        ad.surprise_percent,
        ad.current_price,
        ad.price_change_pct::DECIMAL(10, 4),
        COALESCE(ad.forward_pe_text::DECIMAL, 0)::DECIMAL(10, 4),
        CASE 
            WHEN ad.surprise_percent > 10 AND ad.price_change_pct > 5 THEN 'Strong Buy'
            WHEN ad.surprise_percent > 5 AND ad.price_change_pct > 0 THEN 'Buy'
            WHEN ad.surprise_percent > 0 THEN 'Hold'
            ELSE 'Monitor'
        END as recommendation
    FROM analysis_data ad
    ORDER BY ad.surprise_percent DESC, ad.price_change_pct DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to scan for oversold conditions
CREATE OR REPLACE FUNCTION scan_oversold_stocks(
    rsi_threshold DECIMAL DEFAULT 30.0,
    min_market_cap DECIMAL DEFAULT 1000000000, -- $1B market cap
    max_results INTEGER DEFAULT 50
) RETURNS TABLE (
    symbol VARCHAR(20),
    current_price DECIMAL(10, 4),
    rsi_value DECIMAL(5, 2),
    price_change_percent DECIMAL(10, 4),
    volume BIGINT,
    market_cap DECIMAL(20, 2),
    oversold_score DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH rsi_data AS (
        SELECT 
            ti.symbol,
            sd.close as current_price,
            sd.change_percent,
            sd.volume,
            (ti.values->>'rsi')::DECIMAL(5, 2) as rsi_val,
            e.metadata->>'market_cap' as market_cap_text
        FROM technical_indicators ti
        JOIN stock_data sd ON sd.symbol = ti.symbol AND sd.date = ti.date
        LEFT JOIN entities e ON e.symbol = ti.symbol AND e.entity_type = 'stock'
        WHERE ti.indicator_type = 'RSI'
        AND ti.date = CURRENT_DATE
        AND (ti.values->>'rsi')::DECIMAL <= rsi_threshold
    )
    SELECT 
        rd.symbol,
        rd.current_price,
        rd.rsi_val,
        rd.change_percent,
        rd.volume,
        COALESCE(rd.market_cap_text::DECIMAL, 0)::DECIMAL(20, 2) as mkt_cap,
        -- Oversold score: lower RSI = higher score
        (100 - rd.rsi_val)::DECIMAL(5, 2) as oversold_scr
    FROM rsi_data rd
    WHERE COALESCE(rd.market_cap_text::DECIMAL, 0) >= min_market_cap
    ORDER BY oversold_scr DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to create custom scanner
CREATE OR REPLACE FUNCTION run_custom_scanner(
    scanner_criteria JSONB,
    max_results INTEGER DEFAULT 100
) RETURNS TABLE (
    symbol VARCHAR(20),
    current_price DECIMAL(10, 4),
    score DECIMAL(5, 2),
    metrics JSONB
) AS $$
DECLARE
    min_price DECIMAL := COALESCE((scanner_criteria->>'min_price')::DECIMAL, 0);
    max_price DECIMAL := COALESCE((scanner_criteria->>'max_price')::DECIMAL, 999999);
    min_volume BIGINT := COALESCE((scanner_criteria->>'min_volume')::BIGINT, 0);
    min_market_cap DECIMAL := COALESCE((scanner_criteria->>'min_market_cap')::DECIMAL, 0);
    sector_filter TEXT := scanner_criteria->>'sector';
BEGIN
    RETURN QUERY
    WITH base_filter AS (
        SELECT 
            sd.symbol,
            sd.close as price,
            sd.volume,
            sd.change_percent,
            e.sector,
            e.metadata->>'market_cap' as market_cap_text
        FROM stock_data sd
        LEFT JOIN entities e ON e.symbol = sd.symbol AND e.entity_type = 'stock'
        WHERE sd.date = CURRENT_DATE
        AND sd.close BETWEEN min_price AND max_price
        AND sd.volume >= min_volume
        AND (sector_filter IS NULL OR e.sector = sector_filter)
        AND COALESCE((e.metadata->>'market_cap')::DECIMAL, 0) >= min_market_cap
    ),
    scored_results AS (
        SELECT 
            bf.symbol,
            bf.price,
            -- Simple scoring based on price change and volume
            (CASE 
                WHEN bf.change_percent > 5 THEN 20
                WHEN bf.change_percent > 2 THEN 15
                WHEN bf.change_percent > 0 THEN 10
                ELSE 5
            END +
            CASE 
                WHEN bf.volume > 1000000 THEN 15
                WHEN bf.volume > 500000 THEN 10
                ELSE 5
            END)::DECIMAL(5, 2) as calculated_score,
            jsonb_build_object(
                'price_change', bf.change_percent,
                'volume', bf.volume,
                'sector', bf.sector,
                'market_cap', bf.market_cap_text
            ) as stock_metrics
        FROM base_filter bf
    )
    SELECT 
        sr.symbol,
        sr.price,
        sr.calculated_score,
        sr.stock_metrics
    FROM scored_results sr
    ORDER BY sr.calculated_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get scanner results summary
CREATE OR REPLACE FUNCTION get_scanner_summary(scan_date DATE DEFAULT CURRENT_DATE) RETURNS TABLE (
    scanner_type VARCHAR(50),
    results_count INTEGER,
    avg_score DECIMAL(5, 2),
    top_symbol VARCHAR(20),
    top_score DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH scanner_stats AS (
        SELECT 
            sr.scanner_type,
            COUNT(*) as result_count,
            AVG(sr.score) as average_score,
            MAX(sr.score) as max_score
        FROM scanner_results sr
        WHERE sr.scan_date = scan_date
        GROUP BY sr.scanner_type
    ),
    top_results AS (
        SELECT DISTINCT ON (sr.scanner_type)
            sr.scanner_type,
            sr.symbol as top_sym,
            sr.score as top_scr
        FROM scanner_results sr
        WHERE sr.scan_date = scan_date
        ORDER BY sr.scanner_type, sr.score DESC
    )
    SELECT 
        ss.scanner_type,
        ss.result_count::INTEGER,
        ss.average_score::DECIMAL(5, 2),
        tr.top_sym,
        tr.top_scr::DECIMAL(5, 2)
    FROM scanner_stats ss
    LEFT JOIN top_results tr ON tr.scanner_type = ss.scanner_type
    ORDER BY ss.average_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION scan_unusual_volume IS 'Scan for stocks with unusual volume activity';
COMMENT ON FUNCTION scan_price_breakouts IS 'Scan for stocks breaking above resistance levels';
COMMENT ON FUNCTION scan_earnings_momentum IS 'Scan for stocks with positive earnings momentum';
COMMENT ON FUNCTION scan_oversold_stocks IS 'Scan for oversold stocks using RSI';
COMMENT ON FUNCTION run_custom_scanner IS 'Run custom stock scanner with flexible criteria';
COMMENT ON FUNCTION get_scanner_summary IS 'Get summary statistics for scanner results';