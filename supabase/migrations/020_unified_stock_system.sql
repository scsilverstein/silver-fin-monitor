-- Unified Stock System Database Schema
-- Comprehensive, normalized design for stock data, earnings, options, and analysis
-- Optimized for daily analysis and non-duplicative storage

-- =====================================================
-- PART 1: CORE ENTITY TABLES
-- =====================================================

-- Master companies/entities table (single source of truth)
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    
    -- Legal entity information
    cik VARCHAR(10), -- SEC Central Index Key
    lei VARCHAR(20), -- Legal Entity Identifier
    cusip VARCHAR(9), -- Committee on Uniform Securities Identification
    isin VARCHAR(12), -- International Securities Identification Number
    
    -- Company classification
    entity_type VARCHAR(50) DEFAULT 'corporation', -- 'corporation', 'etf', 'mutual_fund', 'reit'
    incorporation_date DATE,
    incorporation_country VARCHAR(2) DEFAULT 'US',
    
    -- Exchange information
    primary_exchange VARCHAR(50),
    listing_date DATE,
    delisting_date DATE,
    
    -- Business classification
    sic_code VARCHAR(4), -- Standard Industrial Classification
    naics_code VARCHAR(6), -- North American Industry Classification System
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_sp500 BOOLEAN DEFAULT false,
    is_nasdaq100 BOOLEAN DEFAULT false,
    is_dow30 BOOLEAN DEFAULT false,
    
    -- Metadata
    website_url TEXT,
    logo_url TEXT,
    description TEXT,
    employee_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sector and industry classification (normalized)
CREATE TABLE sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_name VARCHAR(100) NOT NULL UNIQUE,
    sector_code VARCHAR(10) UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID NOT NULL REFERENCES sectors(id),
    industry_name VARCHAR(100) NOT NULL,
    industry_code VARCHAR(20) UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sector_id, industry_name)
);

-- Entity classification mapping
CREATE TABLE entity_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    industry_id UUID NOT NULL REFERENCES industries(id),
    classification_type VARCHAR(50) DEFAULT 'primary', -- 'primary', 'secondary'
    effective_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_id, industry_id, classification_type)
);

-- =====================================================
-- PART 2: MARKET DATA TABLES
-- =====================================================

-- Daily price and volume data
CREATE TABLE market_data_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    market_date DATE NOT NULL,
    
    -- Price data
    open_price DECIMAL(12, 4),
    high_price DECIMAL(12, 4),
    low_price DECIMAL(12, 4),
    close_price DECIMAL(12, 4),
    adjusted_close DECIMAL(12, 4),
    
    -- Volume data
    volume BIGINT,
    dollar_volume DECIMAL(20, 2), -- volume * close_price
    
    -- Additional metrics
    vwap DECIMAL(12, 4), -- Volume Weighted Average Price
    num_trades INTEGER,
    
    -- Data quality
    data_source VARCHAR(50) NOT NULL,
    is_adjusted BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, market_date, data_source)
);

-- Intraday data (optional, for high-frequency analysis)
CREATE TABLE market_data_intraday (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    price DECIMAL(12, 4),
    volume INTEGER,
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    bid_size INTEGER,
    ask_size INTEGER,
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 3: FUNDAMENTAL DATA TABLES
-- =====================================================

-- Quarterly/Annual fundamentals
CREATE TABLE fundamentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Period information
    period_type VARCHAR(10) NOT NULL, -- 'quarterly', 'annual', 'ttm'
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER, -- NULL for annual
    period_end_date DATE NOT NULL,
    filing_date DATE,
    
    -- Income statement
    revenue DECIMAL(20, 2),
    gross_profit DECIMAL(20, 2),
    operating_income DECIMAL(20, 2),
    net_income DECIMAL(20, 2),
    eps_basic DECIMAL(10, 4),
    eps_diluted DECIMAL(10, 4),
    
    -- Balance sheet
    total_assets DECIMAL(20, 2),
    total_liabilities DECIMAL(20, 2),
    total_equity DECIMAL(20, 2),
    cash_and_equivalents DECIMAL(20, 2),
    total_debt DECIMAL(20, 2),
    
    -- Cash flow
    operating_cash_flow DECIMAL(20, 2),
    free_cash_flow DECIMAL(20, 2),
    capex DECIMAL(20, 2),
    
    -- Shares
    shares_outstanding BIGINT,
    shares_float BIGINT,
    
    -- Growth rates (calculated)
    revenue_growth_yoy DECIMAL(10, 4),
    earnings_growth_yoy DECIMAL(10, 4),
    
    -- Margins (calculated)
    gross_margin DECIMAL(10, 4),
    operating_margin DECIMAL(10, 4),
    net_margin DECIMAL(10, 4),
    
    -- Returns (calculated)
    roe DECIMAL(10, 4), -- Return on Equity
    roa DECIMAL(10, 4), -- Return on Assets
    roic DECIMAL(10, 4), -- Return on Invested Capital
    
    -- Data source
    data_source VARCHAR(50) NOT NULL,
    source_filing_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, period_type, fiscal_year, fiscal_quarter, data_source)
);

-- Real-time fundamental metrics (updated daily)
CREATE TABLE fundamental_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    
    -- Valuation metrics
    market_cap DECIMAL(20, 2),
    enterprise_value DECIMAL(20, 2),
    pe_ratio DECIMAL(10, 2),
    forward_pe_ratio DECIMAL(10, 2),
    peg_ratio DECIMAL(10, 2),
    price_to_book DECIMAL(10, 2),
    price_to_sales DECIMAL(10, 2),
    ev_to_ebitda DECIMAL(10, 2),
    ev_to_revenue DECIMAL(10, 2),
    
    -- Dividend metrics
    dividend_yield DECIMAL(10, 4),
    dividend_rate DECIMAL(10, 4),
    payout_ratio DECIMAL(10, 4),
    
    -- Trading metrics
    beta DECIMAL(8, 4),
    avg_volume_10d BIGINT,
    avg_volume_30d BIGINT,
    volatility_30d DECIMAL(10, 4),
    
    -- Short interest
    short_interest BIGINT,
    short_ratio DECIMAL(10, 4),
    short_percent_float DECIMAL(10, 4),
    
    -- Analyst data
    analyst_rating DECIMAL(3, 2), -- 1-5 scale
    analyst_count INTEGER,
    price_target_mean DECIMAL(12, 2),
    price_target_high DECIMAL(12, 2),
    price_target_low DECIMAL(12, 2),
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, metric_date, data_source)
);

-- =====================================================
-- PART 4: EARNINGS DATA TABLES
-- =====================================================

-- Earnings calendar with estimates and actuals
CREATE TABLE earnings_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Event information
    earnings_date DATE NOT NULL,
    earnings_time VARCHAR(20), -- 'bmo', 'amc', 'during'
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER NOT NULL,
    
    -- Estimates (consensus)
    eps_estimate DECIMAL(10, 4),
    eps_estimate_count INTEGER, -- number of analysts
    revenue_estimate DECIMAL(20, 2),
    revenue_estimate_count INTEGER,
    
    -- Actuals
    eps_actual DECIMAL(10, 4),
    revenue_actual DECIMAL(20, 2),
    
    -- Surprises (calculated)
    eps_surprise DECIMAL(10, 4),
    eps_surprise_percent DECIMAL(10, 4),
    revenue_surprise DECIMAL(20, 2),
    revenue_surprise_percent DECIMAL(10, 4),
    
    -- Status
    is_confirmed BOOLEAN DEFAULT false,
    has_reported BOOLEAN DEFAULT false,
    
    -- Guidance
    eps_guidance_low DECIMAL(10, 4),
    eps_guidance_high DECIMAL(10, 4),
    revenue_guidance_low DECIMAL(20, 2),
    revenue_guidance_high DECIMAL(20, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, earnings_date, fiscal_year, fiscal_quarter)
);

-- Earnings estimate history (tracks changes over time)
CREATE TABLE earnings_estimates_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_event_id UUID NOT NULL REFERENCES earnings_events(id) ON DELETE CASCADE,
    estimate_date DATE NOT NULL,
    
    -- EPS estimates at this point in time
    eps_mean DECIMAL(10, 4),
    eps_high DECIMAL(10, 4),
    eps_low DECIMAL(10, 4),
    eps_std_dev DECIMAL(10, 4),
    eps_analyst_count INTEGER,
    
    -- Revenue estimates at this point in time
    revenue_mean DECIMAL(20, 2),
    revenue_high DECIMAL(20, 2),
    revenue_low DECIMAL(20, 2),
    revenue_analyst_count INTEGER,
    
    -- Estimate revisions
    eps_revisions_up INTEGER,
    eps_revisions_down INTEGER,
    revenue_revisions_up INTEGER,
    revenue_revisions_down INTEGER,
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 5: OPTIONS DATA TABLES
-- =====================================================

-- Options chains (all available contracts)
CREATE TABLE options_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Contract specifications
    option_symbol VARCHAR(50) NOT NULL UNIQUE,
    contract_type VARCHAR(4) NOT NULL CHECK (contract_type IN ('call', 'put')),
    strike DECIMAL(12, 2) NOT NULL,
    expiration DATE NOT NULL,
    
    -- Contract details
    contract_size INTEGER DEFAULT 100,
    currency VARCHAR(3) DEFAULT 'USD',
    exercise_style VARCHAR(10) DEFAULT 'american',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_weekly BOOLEAN DEFAULT false,
    is_quarterly BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, contract_type, strike, expiration)
);

-- Options market data (real-time/EOD snapshots)
CREATE TABLE options_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id UUID NOT NULL REFERENCES options_chains(id) ON DELETE CASCADE,
    quote_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Pricing
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    mid DECIMAL(12, 4), -- (bid + ask) / 2
    last DECIMAL(12, 4),
    mark DECIMAL(12, 4),
    
    -- Volume and OI
    volume INTEGER,
    open_interest INTEGER,
    volume_oi_ratio DECIMAL(10, 4), -- volume / open_interest
    
    -- Greeks
    implied_volatility DECIMAL(10, 6),
    delta DECIMAL(8, 6),
    gamma DECIMAL(8, 6),
    theta DECIMAL(12, 6),
    vega DECIMAL(12, 6),
    rho DECIMAL(12, 6),
    
    -- Underlying reference
    underlying_price DECIMAL(12, 2),
    
    -- Liquidity metrics
    bid_size INTEGER,
    ask_size INTEGER,
    spread DECIMAL(12, 4), -- ask - bid
    spread_percent DECIMAL(10, 4), -- spread / mid
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(option_id, quote_timestamp, data_source)
);

-- Options flow (large/unusual trades)
CREATE TABLE options_flow (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id UUID NOT NULL REFERENCES options_chains(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Trade information
    trade_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    trade_price DECIMAL(12, 4) NOT NULL,
    trade_size INTEGER NOT NULL,
    trade_value DECIMAL(20, 2), -- size * price * 100
    
    -- Trade classification
    trade_condition VARCHAR(50),
    is_sweep BOOLEAN DEFAULT false,
    is_block BOOLEAN DEFAULT false,
    is_split BOOLEAN DEFAULT false,
    
    -- Market context
    bid_at_trade DECIMAL(12, 4),
    ask_at_trade DECIMAL(12, 4),
    underlying_at_trade DECIMAL(12, 2),
    
    -- Analysis
    trade_sentiment VARCHAR(10), -- 'bullish', 'bearish', 'neutral'
    is_unusual BOOLEAN DEFAULT false,
    unusual_reason VARCHAR(100),
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 6: ANALYSIS AND SCANNER TABLES
-- =====================================================

-- Daily technical analysis
CREATE TABLE technical_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    analysis_date DATE NOT NULL,
    
    -- Moving averages
    sma_20 DECIMAL(12, 4),
    sma_50 DECIMAL(12, 4),
    sma_200 DECIMAL(12, 4),
    ema_12 DECIMAL(12, 4),
    ema_26 DECIMAL(12, 4),
    
    -- Technical indicators
    rsi_14 DECIMAL(6, 2),
    macd_line DECIMAL(12, 4),
    macd_signal DECIMAL(12, 4),
    macd_histogram DECIMAL(12, 4),
    
    -- Bollinger Bands
    bb_upper DECIMAL(12, 4),
    bb_middle DECIMAL(12, 4),
    bb_lower DECIMAL(12, 4),
    
    -- Volume indicators
    obv BIGINT, -- On Balance Volume
    adl DECIMAL(20, 2), -- Accumulation/Distribution Line
    
    -- Support/Resistance
    support_1 DECIMAL(12, 4),
    support_2 DECIMAL(12, 4),
    resistance_1 DECIMAL(12, 4),
    resistance_2 DECIMAL(12, 4),
    
    -- Trend analysis
    trend_short VARCHAR(10), -- 'bullish', 'bearish', 'neutral'
    trend_medium VARCHAR(10),
    trend_long VARCHAR(10),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, analysis_date)
);

-- Scanner results (unified for all scan types)
CREATE TABLE scanner_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    scan_date DATE NOT NULL,
    scan_type VARCHAR(50) NOT NULL, -- 'momentum', 'value', 'growth', 'technical', 'options_flow'
    
    -- Common scoring metrics
    overall_score DECIMAL(5, 2), -- 0-100
    momentum_score DECIMAL(5, 2),
    value_score DECIMAL(5, 2),
    quality_score DECIMAL(5, 2),
    technical_score DECIMAL(5, 2),
    
    -- Ranking
    sector_rank INTEGER,
    industry_rank INTEGER,
    market_cap_rank INTEGER,
    overall_rank INTEGER,
    
    -- Key metrics snapshot
    metrics_snapshot JSONB NOT NULL, -- Flexible storage for scan-specific metrics
    
    -- Alerts and recommendations
    alert_level VARCHAR(20), -- 'info', 'warning', 'strong_buy', 'strong_sell'
    alert_message TEXT,
    action_items JSONB, -- Array of recommended actions
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, scan_date, scan_type)
);

-- Peer analysis
CREATE TABLE peer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    group_type VARCHAR(50) NOT NULL, -- 'industry', 'market_cap', 'custom', 'factor'
    criteria JSONB NOT NULL, -- Criteria for peer selection
    is_dynamic BOOLEAN DEFAULT true, -- Whether membership updates automatically
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE peer_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peer_group_id UUID NOT NULL REFERENCES peer_groups(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Membership details
    weight DECIMAL(5, 4) DEFAULT 1.0, -- For weighted calculations
    joined_date DATE DEFAULT CURRENT_DATE,
    left_date DATE,
    
    UNIQUE(peer_group_id, entity_id)
);

-- =====================================================
-- PART 7: COMPUTED METRICS AND ANALYTICS
-- =====================================================

-- Pre-computed daily analytics (for performance)
CREATE TABLE daily_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    analytics_date DATE NOT NULL,
    
    -- Price performance
    return_1d DECIMAL(10, 4),
    return_5d DECIMAL(10, 4),
    return_1m DECIMAL(10, 4),
    return_3m DECIMAL(10, 4),
    return_6m DECIMAL(10, 4),
    return_ytd DECIMAL(10, 4),
    return_1y DECIMAL(10, 4),
    
    -- Volatility metrics
    volatility_10d DECIMAL(10, 4),
    volatility_30d DECIMAL(10, 4),
    volatility_90d DECIMAL(10, 4),
    
    -- Relative performance
    return_vs_sector_1m DECIMAL(10, 4),
    return_vs_market_1m DECIMAL(10, 4),
    
    -- Risk metrics
    sharpe_ratio_1y DECIMAL(8, 4),
    sortino_ratio_1y DECIMAL(8, 4),
    max_drawdown_1y DECIMAL(10, 4),
    
    -- Factor exposures
    beta_market DECIMAL(8, 4),
    beta_sector DECIMAL(8, 4),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_id, analytics_date)
);

-- =====================================================
-- PART 8: INDEXES FOR PERFORMANCE
-- =====================================================

-- Entity indexes
CREATE INDEX idx_entities_symbol ON entities(symbol) WHERE is_active = true;
CREATE INDEX idx_entities_cik ON entities(cik);
CREATE INDEX idx_entities_exchange ON entities(primary_exchange) WHERE is_active = true;

-- Market data indexes
CREATE INDEX idx_market_data_daily_entity_date ON market_data_daily(entity_id, market_date DESC);
CREATE INDEX idx_market_data_daily_date ON market_data_daily(market_date DESC);
CREATE INDEX idx_market_data_intraday_entity_time ON market_data_intraday(entity_id, timestamp DESC);

-- Fundamentals indexes
CREATE INDEX idx_fundamentals_entity_period ON fundamentals(entity_id, period_end_date DESC);
CREATE INDEX idx_fundamental_metrics_entity_date ON fundamental_metrics(entity_id, metric_date DESC);

-- Earnings indexes
CREATE INDEX idx_earnings_events_date ON earnings_events(earnings_date DESC);
CREATE INDEX idx_earnings_events_entity ON earnings_events(entity_id, earnings_date DESC);
CREATE INDEX idx_earnings_events_upcoming ON earnings_events(earnings_date) 
    WHERE has_reported = false;

-- Options indexes
CREATE INDEX idx_options_chains_entity_exp ON options_chains(entity_id, expiration);
CREATE INDEX idx_options_chains_active ON options_chains(expiration) WHERE is_active = true;
CREATE INDEX idx_options_quotes_option_time ON options_quotes(option_id, quote_timestamp DESC);
CREATE INDEX idx_options_flow_entity_time ON options_flow(entity_id, trade_timestamp DESC);
CREATE INDEX idx_options_flow_unusual ON options_flow(trade_timestamp DESC) WHERE is_unusual = true;

-- Analysis indexes
CREATE INDEX idx_scanner_results_date_type ON scanner_results(scan_date DESC, scan_type);
CREATE INDEX idx_scanner_results_entity ON scanner_results(entity_id, scan_date DESC);
CREATE INDEX idx_scanner_results_alerts ON scanner_results(scan_date DESC, alert_level) 
    WHERE alert_level IN ('strong_buy', 'strong_sell');

-- Analytics indexes
CREATE INDEX idx_daily_analytics_entity_date ON daily_analytics(entity_id, analytics_date DESC);
CREATE INDEX idx_daily_analytics_date ON daily_analytics(analytics_date DESC);

-- =====================================================
-- PART 9: FUNCTIONS AND TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earnings_events_updated_at BEFORE UPDATE ON earnings_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate earnings surprises
CREATE OR REPLACE FUNCTION calculate_earnings_surprises()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.eps_actual IS NOT NULL AND NEW.eps_estimate IS NOT NULL THEN
        NEW.eps_surprise := NEW.eps_actual - NEW.eps_estimate;
        IF NEW.eps_estimate != 0 THEN
            NEW.eps_surprise_percent := (NEW.eps_surprise / ABS(NEW.eps_estimate)) * 100;
        END IF;
    END IF;
    
    IF NEW.revenue_actual IS NOT NULL AND NEW.revenue_estimate IS NOT NULL THEN
        NEW.revenue_surprise := NEW.revenue_actual - NEW.revenue_estimate;
        IF NEW.revenue_estimate != 0 THEN
            NEW.revenue_surprise_percent := (NEW.revenue_surprise::DECIMAL / NEW.revenue_estimate) * 100;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_earnings_surprises
    BEFORE INSERT OR UPDATE ON earnings_events
    FOR EACH ROW
    EXECUTE FUNCTION calculate_earnings_surprises();

-- Get entity with all related data
CREATE OR REPLACE FUNCTION get_entity_complete(p_symbol VARCHAR)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'entity', row_to_json(e.*),
        'classification', row_to_json(ic.*),
        'latest_quote', row_to_json(lq.*),
        'latest_fundamentals', row_to_json(lf.*),
        'next_earnings', row_to_json(ne.*),
        'technical_analysis', row_to_json(ta.*)
    ) INTO result
    FROM entities e
    LEFT JOIN LATERAL (
        SELECT i.industry_name, s.sector_name
        FROM entity_classifications ec
        JOIN industries i ON ec.industry_id = i.id
        JOIN sectors s ON i.sector_id = s.id
        WHERE ec.entity_id = e.id AND ec.classification_type = 'primary'
        ORDER BY ec.effective_date DESC
        LIMIT 1
    ) ic ON true
    LEFT JOIN LATERAL (
        SELECT *
        FROM market_data_daily
        WHERE entity_id = e.id
        ORDER BY market_date DESC
        LIMIT 1
    ) lq ON true
    LEFT JOIN LATERAL (
        SELECT *
        FROM fundamental_metrics
        WHERE entity_id = e.id
        ORDER BY metric_date DESC
        LIMIT 1
    ) lf ON true
    LEFT JOIN LATERAL (
        SELECT *
        FROM earnings_events
        WHERE entity_id = e.id 
        AND earnings_date >= CURRENT_DATE
        AND has_reported = false
        ORDER BY earnings_date
        LIMIT 1
    ) ne ON true
    LEFT JOIN LATERAL (
        SELECT *
        FROM technical_analysis
        WHERE entity_id = e.id
        ORDER BY analysis_date DESC
        LIMIT 1
    ) ta ON true
    WHERE e.symbol = p_symbol;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Peer comparison function
CREATE OR REPLACE FUNCTION compare_to_peers(
    p_entity_id UUID,
    p_metric VARCHAR,
    p_peer_group_id UUID DEFAULT NULL
) RETURNS TABLE (
    percentile DECIMAL,
    peer_count INTEGER,
    entity_value DECIMAL,
    peer_median DECIMAL,
    peer_average DECIMAL
) AS $$
BEGIN
    -- Implementation would calculate percentile ranking
    -- within peer group for specified metric
    RETURN QUERY
    WITH peer_data AS (
        SELECT 
            e.id,
            CASE p_metric
                WHEN 'pe_ratio' THEN fm.pe_ratio
                WHEN 'market_cap' THEN fm.market_cap
                WHEN 'revenue_growth' THEN f.revenue_growth_yoy
                -- Add more metrics as needed
            END as metric_value
        FROM entities e
        JOIN fundamental_metrics fm ON e.id = fm.entity_id
        JOIN fundamentals f ON e.id = f.entity_id
        WHERE (p_peer_group_id IS NULL OR e.id IN (
            SELECT entity_id FROM peer_group_members 
            WHERE peer_group_id = p_peer_group_id
        ))
        AND fm.metric_date = (SELECT MAX(metric_date) FROM fundamental_metrics)
    ),
    ranked_data AS (
        SELECT 
            id,
            metric_value,
            PERCENT_RANK() OVER (ORDER BY metric_value) * 100 as pct_rank
        FROM peer_data
        WHERE metric_value IS NOT NULL
    )
    SELECT 
        rd.pct_rank as percentile,
        COUNT(*) OVER() as peer_count,
        rd.metric_value as entity_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pd.metric_value) as peer_median,
        AVG(pd.metric_value) as peer_average
    FROM ranked_data rd
    CROSS JOIN peer_data pd
    WHERE rd.id = p_entity_id
    GROUP BY rd.pct_rank, rd.metric_value;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 10: MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Top movers view
CREATE MATERIALIZED VIEW mv_top_movers AS
WITH latest_analytics AS (
    SELECT DISTINCT ON (entity_id) *
    FROM daily_analytics
    WHERE analytics_date >= CURRENT_DATE - 5
    ORDER BY entity_id, analytics_date DESC
)
SELECT 
    e.symbol,
    e.name,
    i.industry_name,
    s.sector_name,
    la.return_1d,
    la.return_5d,
    la.return_1m,
    la.volatility_30d,
    fm.market_cap,
    fm.pe_ratio,
    fm.avg_volume_30d as avg_volume
FROM latest_analytics la
JOIN entities e ON la.entity_id = e.id
JOIN entity_classifications ec ON e.id = ec.entity_id AND ec.classification_type = 'primary'
JOIN industries i ON ec.industry_id = i.id
JOIN sectors s ON i.sector_id = s.id
LEFT JOIN fundamental_metrics fm ON e.id = fm.entity_id 
    AND fm.metric_date = (SELECT MAX(metric_date) FROM fundamental_metrics)
WHERE e.is_active = true
ORDER BY ABS(la.return_1d) DESC;

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_movers;
    -- Add other materialized views here
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 11: ROW-LEVEL SECURITY (Optional)
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundamentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_events ENABLE ROW LEVEL SECURITY;

-- Create policies (example)
CREATE POLICY "Public entities are viewable by everyone" 
    ON entities FOR SELECT 
    USING (is_active = true);

-- Peer group policies can be added when user system is implemented

-- =====================================================
-- PART 12: INITIAL DATA SEEDS
-- =====================================================

-- Insert default sectors
INSERT INTO sectors (sector_name, sector_code) VALUES
    ('Technology', 'TECH'),
    ('Healthcare', 'HLTH'),
    ('Financials', 'FIN'),
    ('Consumer Discretionary', 'CONS_D'),
    ('Consumer Staples', 'CONS_S'),
    ('Industrials', 'INDU'),
    ('Energy', 'ENRG'),
    ('Materials', 'MATL'),
    ('Real Estate', 'RE'),
    ('Utilities', 'UTIL'),
    ('Communication Services', 'COMM');

-- Insert sample industries (Technology sector example)
INSERT INTO industries (sector_id, industry_name, industry_code)
SELECT 
    s.id,
    i.industry_name,
    i.industry_code
FROM sectors s
CROSS JOIN (VALUES
    ('Software', 'SOFT'),
    ('Semiconductors', 'SEMI'),
    ('Hardware', 'HARD'),
    ('Internet', 'INET'),
    ('IT Services', 'IT_SVC')
) AS i(industry_name, industry_code)
WHERE s.sector_code = 'TECH';

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE entities IS 'Master table for all tradeable entities (stocks, ETFs, etc.)';
COMMENT ON TABLE market_data_daily IS 'Daily OHLCV data for all entities';
COMMENT ON TABLE fundamentals IS 'Quarterly and annual fundamental data from financial statements';
COMMENT ON TABLE earnings_events IS 'Earnings calendar with estimates, actuals, and surprises';
COMMENT ON TABLE options_chains IS 'All available options contracts for each entity';
COMMENT ON TABLE scanner_results IS 'Unified results from all types of market scanners';
COMMENT ON TABLE daily_analytics IS 'Pre-computed daily metrics for performance optimization';

-- Grant appropriate permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON scanner_results, daily_analytics TO service_role;