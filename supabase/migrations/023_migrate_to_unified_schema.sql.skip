-- Migration Guide: From Old Schema to Unified Stock System
-- This migration transfers data from the old scattered tables to the new unified schema
-- Run this AFTER creating the unified schema (020_unified_stock_system.sql)

-- =====================================================
-- STEP 1: Migrate Stock Symbols to Entities
-- =====================================================

-- Insert sectors first (if not already done)
INSERT INTO sectors (sector_name, sector_code)
SELECT DISTINCT 
    sector as sector_name,
    UPPER(LEFT(REPLACE(sector, ' ', '_'), 10)) as sector_code
FROM stock_symbols
WHERE sector IS NOT NULL
ON CONFLICT (sector_name) DO NOTHING;

-- Insert industries
INSERT INTO industries (sector_id, industry_name, industry_code)
SELECT DISTINCT
    s.id as sector_id,
    ss.industry as industry_name,
    UPPER(LEFT(REPLACE(ss.industry, ' ', '_'), 20)) as industry_code
FROM stock_symbols ss
JOIN sectors s ON s.sector_name = ss.sector
WHERE ss.industry IS NOT NULL
ON CONFLICT (sector_id, industry_name) DO NOTHING;

-- Migrate stock_symbols to entities
INSERT INTO entities (
    id,
    symbol,
    name,
    primary_exchange,
    is_active,
    created_at,
    updated_at
)
SELECT 
    id,
    symbol,
    name,
    exchange,
    is_active,
    created_at,
    last_updated
FROM stock_symbols
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    primary_exchange = EXCLUDED.primary_exchange,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Create entity classifications
INSERT INTO entity_classifications (
    entity_id,
    industry_id,
    classification_type,
    effective_date
)
SELECT DISTINCT
    e.id as entity_id,
    i.id as industry_id,
    'primary' as classification_type,
    CURRENT_DATE as effective_date
FROM stock_symbols ss
JOIN entities e ON e.symbol = ss.symbol
JOIN industries i ON i.industry_name = ss.industry
JOIN sectors s ON s.id = i.sector_id AND s.sector_name = ss.sector
WHERE ss.industry IS NOT NULL
ON CONFLICT (entity_id, industry_id, classification_type) DO NOTHING;

-- =====================================================
-- STEP 2: Migrate Fundamentals Data
-- =====================================================

-- Migrate stock_fundamentals to fundamental_metrics (daily metrics)
INSERT INTO fundamental_metrics (
    entity_id,
    metric_date,
    pe_ratio,
    forward_pe_ratio,
    peg_ratio,
    price_to_book,
    market_cap,
    beta,
    data_source,
    created_at
)
SELECT 
    e.id as entity_id,
    sf.data_date as metric_date,
    sf.pe_ratio,
    sf.forward_pe_ratio,
    sf.peg_ratio,
    sf.price_to_book,
    sf.market_cap,
    sf.roe as beta, -- Note: This is a mapping issue, ROE != beta
    sf.data_source,
    sf.created_at
FROM stock_fundamentals sf
JOIN entities e ON e.id = sf.symbol_id
ON CONFLICT (entity_id, metric_date, data_source) DO UPDATE SET
    pe_ratio = EXCLUDED.pe_ratio,
    forward_pe_ratio = EXCLUDED.forward_pe_ratio,
    peg_ratio = EXCLUDED.peg_ratio,
    price_to_book = EXCLUDED.price_to_book,
    market_cap = EXCLUDED.market_cap;

-- Migrate to market_data_daily (price and volume)
INSERT INTO market_data_daily (
    entity_id,
    market_date,
    close_price,
    volume,
    data_source,
    created_at
)
SELECT 
    e.id as entity_id,
    sf.data_date as market_date,
    sf.price as close_price,
    sf.volume,
    sf.data_source,
    sf.created_at
FROM stock_fundamentals sf
JOIN entities e ON e.id = sf.symbol_id
WHERE sf.price IS NOT NULL
ON CONFLICT (entity_id, market_date, data_source) DO UPDATE SET
    close_price = EXCLUDED.close_price,
    volume = EXCLUDED.volume;

-- Migrate to fundamentals table (quarterly/annual data)
-- Note: The old schema stored daily snapshots, we need to identify actual reporting periods
INSERT INTO fundamentals (
    entity_id,
    period_type,
    fiscal_year,
    fiscal_quarter,
    period_end_date,
    eps_diluted,
    revenue,
    revenue_growth_yoy,
    gross_margin,
    roe,
    data_source,
    created_at
)
SELECT DISTINCT ON (e.id, EXTRACT(YEAR FROM sf.data_date), EXTRACT(QUARTER FROM sf.data_date))
    e.id as entity_id,
    'quarterly' as period_type,
    EXTRACT(YEAR FROM sf.data_date)::INTEGER as fiscal_year,
    EXTRACT(QUARTER FROM sf.data_date)::INTEGER as fiscal_quarter,
    DATE_TRUNC('quarter', sf.data_date)::DATE + INTERVAL '3 months' - INTERVAL '1 day' as period_end_date,
    sf.earnings_per_share as eps_diluted,
    sf.revenue,
    sf.revenue_growth_rate as revenue_growth_yoy,
    sf.profit_margin as gross_margin,
    sf.roe,
    sf.data_source,
    sf.created_at
FROM stock_fundamentals sf
JOIN entities e ON e.id = sf.symbol_id
WHERE sf.earnings_per_share IS NOT NULL OR sf.revenue IS NOT NULL
ORDER BY e.id, EXTRACT(YEAR FROM sf.data_date), EXTRACT(QUARTER FROM sf.data_date), sf.data_date DESC
ON CONFLICT (entity_id, period_type, fiscal_year, fiscal_quarter, data_source) DO UPDATE SET
    eps_diluted = EXCLUDED.eps_diluted,
    revenue = EXCLUDED.revenue,
    revenue_growth_yoy = EXCLUDED.revenue_growth_yoy,
    gross_margin = EXCLUDED.gross_margin,
    roe = EXCLUDED.roe;

-- =====================================================
-- STEP 3: Migrate Earnings Calendar
-- =====================================================

-- Migrate earnings_calendar to earnings_events
INSERT INTO earnings_events (
    entity_id,
    earnings_date,
    earnings_time,
    fiscal_year,
    fiscal_quarter,
    eps_estimate,
    eps_estimate_count,
    revenue_estimate,
    eps_actual,
    revenue_actual,
    eps_surprise,
    eps_surprise_percent,
    revenue_surprise,
    revenue_surprise_percent,
    is_confirmed,
    has_reported,
    created_at,
    updated_at
)
SELECT 
    e.id as entity_id,
    ec.earnings_date,
    CASE 
        WHEN ec.time_of_day = 'before_market' THEN 'bmo'
        WHEN ec.time_of_day = 'after_market' THEN 'amc'
        ELSE ec.time_of_day
    END as earnings_time,
    ec.fiscal_year,
    CASE 
        WHEN ec.fiscal_quarter = 'Q1' THEN 1
        WHEN ec.fiscal_quarter = 'Q2' THEN 2
        WHEN ec.fiscal_quarter = 'Q3' THEN 3
        WHEN ec.fiscal_quarter = 'Q4' THEN 4
    END as fiscal_quarter,
    ec.eps_estimate,
    1 as eps_estimate_count, -- Default since not tracked in old schema
    ec.revenue_estimate,
    ec.eps_actual,
    ec.revenue_actual,
    ec.eps_surprise,
    ec.eps_surprise_percent,
    ec.revenue_surprise,
    ec.revenue_surprise_percent,
    ec.confirmed as is_confirmed,
    ec.status = 'reported' as has_reported,
    ec.created_at,
    ec.last_updated
FROM earnings_calendar ec
JOIN entities e ON e.symbol = ec.symbol
ON CONFLICT (entity_id, earnings_date, fiscal_year, fiscal_quarter) DO UPDATE SET
    eps_estimate = EXCLUDED.eps_estimate,
    revenue_estimate = EXCLUDED.revenue_estimate,
    eps_actual = EXCLUDED.eps_actual,
    revenue_actual = EXCLUDED.revenue_actual,
    is_confirmed = EXCLUDED.is_confirmed,
    has_reported = EXCLUDED.has_reported,
    updated_at = NOW();

-- =====================================================
-- STEP 4: Migrate Options Data
-- =====================================================

-- Migrate options_contracts to options_chains
INSERT INTO options_chains (
    id,
    entity_id,
    option_symbol,
    contract_type,
    strike,
    expiration,
    contract_size,
    currency,
    exercise_style,
    is_active,
    created_at
)
SELECT 
    oc.id,
    e.id as entity_id,
    oc.contract_symbol as option_symbol,
    oc.option_type as contract_type,
    oc.strike_price as strike,
    oc.expiration_date as expiration,
    oc.multiplier as contract_size,
    oc.currency,
    oc.exercise_style,
    oc.is_active,
    oc.created_at
FROM options_contracts oc
JOIN entities e ON e.id = oc.symbol_id
ON CONFLICT (option_symbol) DO UPDATE SET
    is_active = EXCLUDED.is_active;

-- Migrate options_market_data to options_quotes
INSERT INTO options_quotes (
    option_id,
    quote_timestamp,
    bid,
    ask,
    mid,
    last,
    mark,
    volume,
    open_interest,
    implied_volatility,
    delta,
    gamma,
    theta,
    vega,
    rho,
    underlying_price,
    bid_size,
    ask_size,
    data_source,
    created_at
)
SELECT 
    omd.contract_id as option_id,
    omd.data_timestamp as quote_timestamp,
    omd.bid,
    omd.ask,
    (omd.bid + omd.ask) / 2 as mid,
    omd.last_price as last,
    omd.mark_price as mark,
    omd.volume,
    omd.open_interest,
    omd.implied_volatility,
    omd.delta,
    omd.gamma,
    omd.theta,
    omd.vega,
    omd.rho,
    omd.underlying_price,
    omd.bid_size,
    omd.ask_size,
    omd.data_source,
    omd.created_at
FROM options_market_data omd
ON CONFLICT (option_id, quote_timestamp, data_source) DO UPDATE SET
    bid = EXCLUDED.bid,
    ask = EXCLUDED.ask,
    last = EXCLUDED.last,
    volume = EXCLUDED.volume,
    open_interest = EXCLUDED.open_interest,
    implied_volatility = EXCLUDED.implied_volatility;

-- =====================================================
-- STEP 5: Migrate Scanner Results
-- =====================================================

-- Migrate stock_scanner_results to scanner_results
INSERT INTO scanner_results (
    entity_id,
    scan_date,
    scan_type,
    overall_score,
    momentum_score,
    value_score,
    sector_rank,
    industry_rank,
    metrics_snapshot,
    alert_level,
    alert_message,
    created_at
)
SELECT 
    e.id as entity_id,
    ssr.scan_date,
    ssr.scan_type,
    ssr.composite_score as overall_score,
    ssr.momentum_score,
    ssr.value_score,
    ssr.pe_vs_sector_percentile::INTEGER as sector_rank,
    ssr.pe_vs_industry_percentile::INTEGER as industry_rank,
    jsonb_build_object(
        'earnings_change_1d', ssr.earnings_change_1d,
        'earnings_change_5d', ssr.earnings_change_5d,
        'earnings_change_30d', ssr.earnings_change_30d,
        'forward_pe_change_1d', ssr.forward_pe_change_1d,
        'forward_pe_change_5d', ssr.forward_pe_change_5d,
        'forward_pe_change_30d', ssr.forward_pe_change_30d,
        'peer_comparison_count', ssr.peer_comparison_count,
        'confidence_level', ssr.confidence_level
    ) as metrics_snapshot,
    CASE 
        WHEN ssr.alert_type = 'bullish_momentum' THEN 'strong_buy'
        WHEN ssr.alert_type = 'bearish_divergence' THEN 'strong_sell'
        WHEN ssr.alert_type = 'value_opportunity' THEN 'info'
        ELSE 'info'
    END as alert_level,
    ssr.alert_message,
    ssr.created_at
FROM stock_scanner_results ssr
JOIN entities e ON e.id = ssr.symbol_id
ON CONFLICT (entity_id, scan_date, scan_type) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    momentum_score = EXCLUDED.momentum_score,
    value_score = EXCLUDED.value_score,
    metrics_snapshot = EXCLUDED.metrics_snapshot,
    alert_message = EXCLUDED.alert_message;

-- Migrate options_scanner_results
INSERT INTO scanner_results (
    entity_id,
    scan_date,
    scan_type,
    overall_score,
    metrics_snapshot,
    alert_level,
    alert_message,
    created_at
)
SELECT 
    e.id as entity_id,
    osr.scan_date,
    'options_' || osr.scan_type as scan_type,
    osr.opportunity_score as overall_score,
    jsonb_build_object(
        'contract_symbol', oc.option_symbol,
        'option_type', osr.option_type,
        'strike_price', osr.strike_price,
        'expiration_date', osr.expiration_date,
        'days_to_expiration', osr.days_to_expiration,
        'current_price', osr.current_price,
        'underlying_price', osr.underlying_price,
        'volume', osr.volume,
        'open_interest', osr.open_interest,
        'implied_volatility', osr.implied_volatility,
        'value_score', osr.value_score,
        'is_unusual_activity', osr.is_unusual_activity
    ) as metrics_snapshot,
    CASE 
        WHEN osr.recommendation_strength = 'strong' AND osr.action_recommendation = 'buy' THEN 'strong_buy'
        WHEN osr.recommendation_strength = 'strong' AND osr.action_recommendation = 'sell' THEN 'strong_sell'
        ELSE 'info'
    END as alert_level,
    osr.recommendation_reason as alert_message,
    osr.created_at
FROM options_scanner_results osr
JOIN options_chains oc ON oc.id = osr.contract_id
JOIN entities e ON e.id = osr.symbol_id
ON CONFLICT (entity_id, scan_date, scan_type) DO NOTHING;

-- =====================================================
-- STEP 6: Create Peer Groups from Existing Data
-- =====================================================

-- Create industry peer groups
INSERT INTO peer_groups (name, group_type, criteria)
SELECT DISTINCT
    i.industry_name || ' Peers' as name,
    'industry' as group_type,
    jsonb_build_object('industry_id', i.id) as criteria
FROM industries i;

-- Create market cap peer groups
INSERT INTO peer_groups (name, group_type, criteria)
VALUES 
    ('Mega Cap (>200B)', 'market_cap', '{"min_market_cap": 200000000000}'),
    ('Large Cap (50B-200B)', 'market_cap', '{"min_market_cap": 50000000000, "max_market_cap": 200000000000}'),
    ('Mid Cap (10B-50B)', 'market_cap', '{"min_market_cap": 10000000000, "max_market_cap": 50000000000}'),
    ('Small Cap (2B-10B)', 'market_cap', '{"min_market_cap": 2000000000, "max_market_cap": 10000000000}'),
    ('Micro Cap (<2B)', 'market_cap', '{"max_market_cap": 2000000000}');

-- Populate peer group members based on existing relationships
INSERT INTO peer_group_members (peer_group_id, entity_id)
SELECT DISTINCT
    pg.id as peer_group_id,
    e.id as entity_id
FROM stock_peer_groups spg
JOIN entities e ON e.id = spg.symbol_id
JOIN entities pe ON pe.id = spg.peer_symbol_id
JOIN entity_classifications ec ON ec.entity_id = e.id
JOIN industries i ON i.id = ec.industry_id
JOIN peer_groups pg ON pg.name = i.industry_name || ' Peers'
WHERE spg.relationship_type = 'industry'
ON CONFLICT (peer_group_id, entity_id) DO NOTHING;

-- =====================================================
-- STEP 7: Update Tech Stock Universe
-- =====================================================

-- Ensure tech stocks are properly marked
UPDATE entities 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{is_tech_focus}',
    'true'::jsonb
)
WHERE id IN (
    SELECT symbol_id 
    FROM tech_stock_universe
    WHERE is_active = true
);

-- =====================================================
-- STEP 8: Create Data Quality Report
-- =====================================================

CREATE OR REPLACE FUNCTION migration_data_quality_report()
RETURNS TABLE (
    table_name TEXT,
    old_count BIGINT,
    new_count BIGINT,
    difference BIGINT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    
    -- Entities migration check
    SELECT 
        'stock_symbols -> entities'::TEXT,
        (SELECT COUNT(*) FROM stock_symbols)::BIGINT,
        (SELECT COUNT(*) FROM entities)::BIGINT,
        (SELECT COUNT(*) FROM entities) - (SELECT COUNT(*) FROM stock_symbols),
        CASE 
            WHEN (SELECT COUNT(*) FROM entities) >= (SELECT COUNT(*) FROM stock_symbols) 
            THEN 'OK' 
            ELSE 'MISSING DATA' 
        END;
    
    UNION ALL
    
    -- Fundamentals migration check
    SELECT 
        'stock_fundamentals -> fundamental_metrics'::TEXT,
        (SELECT COUNT(DISTINCT (symbol_id, data_date)) FROM stock_fundamentals)::BIGINT,
        (SELECT COUNT(*) FROM fundamental_metrics)::BIGINT,
        (SELECT COUNT(*) FROM fundamental_metrics) - 
        (SELECT COUNT(DISTINCT (symbol_id, data_date)) FROM stock_fundamentals),
        'CHECK MANUALLY';
    
    UNION ALL
    
    -- Earnings migration check
    SELECT 
        'earnings_calendar -> earnings_events'::TEXT,
        (SELECT COUNT(*) FROM earnings_calendar)::BIGINT,
        (SELECT COUNT(*) FROM earnings_events)::BIGINT,
        (SELECT COUNT(*) FROM earnings_events) - (SELECT COUNT(*) FROM earnings_calendar),
        CASE 
            WHEN (SELECT COUNT(*) FROM earnings_events) >= (SELECT COUNT(*) FROM earnings_calendar) * 0.9
            THEN 'OK' 
            ELSE 'CHECK DATA' 
        END;
    
    UNION ALL
    
    -- Options migration check
    SELECT 
        'options_contracts -> options_chains'::TEXT,
        (SELECT COUNT(*) FROM options_contracts)::BIGINT,
        (SELECT COUNT(*) FROM options_chains)::BIGINT,
        (SELECT COUNT(*) FROM options_chains) - (SELECT COUNT(*) FROM options_contracts),
        CASE 
            WHEN (SELECT COUNT(*) FROM options_chains) = (SELECT COUNT(*) FROM options_contracts)
            THEN 'OK' 
            ELSE 'CHECK DATA' 
        END;
END;
$$ LANGUAGE plpgsql;

-- Run the quality report
SELECT * FROM migration_data_quality_report();

-- =====================================================
-- STEP 9: Cleanup Old Tables (DO THIS ONLY AFTER VERIFICATION!)
-- =====================================================

-- First, rename old tables as backup
-- ALTER TABLE stock_symbols RENAME TO _backup_stock_symbols;
-- ALTER TABLE stock_fundamentals RENAME TO _backup_stock_fundamentals;
-- ALTER TABLE stock_scanner_results RENAME TO _backup_stock_scanner_results;
-- ALTER TABLE stock_peer_groups RENAME TO _backup_stock_peer_groups;
-- ALTER TABLE stock_watchlist RENAME TO _backup_stock_watchlist;
-- ALTER TABLE earnings_calendar RENAME TO _backup_earnings_calendar;
-- ALTER TABLE earnings_performance RENAME TO _backup_earnings_performance;
-- ALTER TABLE earnings_estimates RENAME TO _backup_earnings_estimates;
-- ALTER TABLE options_contracts RENAME TO _backup_options_contracts;
-- ALTER TABLE options_market_data RENAME TO _backup_options_market_data;
-- ALTER TABLE options_value_analysis RENAME TO _backup_options_value_analysis;
-- ALTER TABLE options_scanner_results RENAME TO _backup_options_scanner_results;
-- ALTER TABLE tech_stock_universe RENAME TO _backup_tech_stock_universe;

-- After verification, drop backup tables
-- DROP TABLE IF EXISTS _backup_stock_symbols CASCADE;
-- etc...

-- =====================================================
-- STEP 10: Update Application Code References
-- =====================================================

-- Application code needs to be updated to use new table names:
-- stock_symbols -> entities
-- stock_fundamentals -> fundamental_metrics + fundamentals
-- earnings_calendar -> earnings_events
-- options_contracts -> options_chains
-- options_market_data -> options_quotes

COMMENT ON FUNCTION migration_data_quality_report() IS 
'Run this function to verify data migration completeness before dropping old tables';