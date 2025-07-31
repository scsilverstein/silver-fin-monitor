-- Options Scanner Database Schema
-- This migration adds tables for options trading and analysis functionality

-- Options contracts master table
CREATE TABLE options_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    contract_symbol VARCHAR(50) NOT NULL UNIQUE, -- OCC standard option symbol
    
    -- Contract specifications
    option_type VARCHAR(4) NOT NULL CHECK (option_type IN ('call', 'put')),
    strike_price DECIMAL(12, 2) NOT NULL,
    expiration_date DATE NOT NULL,
    
    -- Contract details
    multiplier INTEGER DEFAULT 100,
    currency VARCHAR(3) DEFAULT 'USD',
    exercise_style VARCHAR(10) DEFAULT 'american', -- 'american', 'european'
    
    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    last_trade_date TIMESTAMP WITH TIME ZONE,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(symbol_id, option_type, strike_price, expiration_date)
);

-- Options market data (real-time/daily snapshots)
CREATE TABLE options_market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES options_contracts(id) ON DELETE CASCADE,
    data_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Pricing data
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    last_price DECIMAL(12, 4),
    mark_price DECIMAL(12, 4), -- (bid + ask) / 2
    
    -- Volume and liquidity
    volume INTEGER,
    open_interest INTEGER,
    bid_size INTEGER,
    ask_size INTEGER,
    
    -- Greeks
    implied_volatility DECIMAL(10, 6), -- As decimal (0.25 = 25%)
    delta DECIMAL(8, 6),
    gamma DECIMAL(8, 6),
    theta DECIMAL(12, 6),
    vega DECIMAL(12, 6),
    rho DECIMAL(12, 6),
    
    -- Underlying reference
    underlying_price DECIMAL(12, 2),
    
    -- Data source
    data_source VARCHAR(50) DEFAULT 'polygon',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate data points
    UNIQUE(contract_id, data_timestamp, data_source)
);

-- Options value analysis results
CREATE TABLE options_value_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES options_contracts(id) ON DELETE CASCADE,
    analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Value metrics
    intrinsic_value DECIMAL(12, 4),
    time_value DECIMAL(12, 4),
    
    -- Pricing analysis
    theoretical_value DECIMAL(12, 4), -- Black-Scholes or other model
    market_price DECIMAL(12, 4),
    value_discrepancy DECIMAL(10, 4), -- (theoretical - market) / market
    
    -- Risk/Reward metrics
    breakeven_price DECIMAL(12, 2),
    max_profit DECIMAL(12, 2),
    max_loss DECIMAL(12, 2),
    risk_reward_ratio DECIMAL(10, 4),
    
    -- Probability metrics
    probability_itm DECIMAL(5, 4), -- Probability of finishing in-the-money
    probability_profit DECIMAL(5, 4),
    expected_value DECIMAL(12, 4),
    
    -- Relative value scores (0-100)
    iv_rank DECIMAL(5, 2), -- IV relative to 52-week range
    iv_percentile DECIMAL(5, 2), -- Percentile over last year
    volume_liquidity_score DECIMAL(5, 2),
    spread_quality_score DECIMAL(5, 2),
    
    -- Composite scores
    value_score DECIMAL(5, 2), -- Overall value assessment (0-100)
    opportunity_score DECIMAL(5, 2), -- Trading opportunity score
    risk_adjusted_score DECIMAL(5, 2),
    
    -- Strategy recommendations
    recommended_strategy VARCHAR(50), -- 'long_call', 'cash_secured_put', etc.
    strategy_rationale TEXT,
    
    -- Analysis metadata
    model_used VARCHAR(50), -- 'black_scholes', 'binomial', etc.
    confidence_level DECIMAL(5, 2),
    analysis_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(contract_id, analysis_timestamp)
);

-- Options scanner results (daily comprehensive scan)
CREATE TABLE options_scanner_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_date DATE NOT NULL,
    contract_id UUID NOT NULL REFERENCES options_contracts(id) ON DELETE CASCADE,
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    
    -- Scanner criteria met
    scan_type VARCHAR(50) NOT NULL, -- 'high_volume', 'iv_spike', 'value_opportunity', etc.
    
    -- Quick reference data
    symbol VARCHAR(10) NOT NULL,
    option_type VARCHAR(4) NOT NULL,
    strike_price DECIMAL(12, 2) NOT NULL,
    expiration_date DATE NOT NULL,
    days_to_expiration INTEGER NOT NULL,
    
    -- Key metrics snapshot
    current_price DECIMAL(12, 4),
    underlying_price DECIMAL(12, 2),
    volume INTEGER,
    open_interest INTEGER,
    implied_volatility DECIMAL(10, 6),
    
    -- Value metrics
    value_score DECIMAL(5, 2),
    opportunity_score DECIMAL(5, 2),
    
    -- Alert flags
    is_unusual_activity BOOLEAN DEFAULT false,
    is_value_opportunity BOOLEAN DEFAULT false,
    is_high_probability BOOLEAN DEFAULT false,
    
    -- Recommendation
    action_recommendation VARCHAR(20), -- 'buy', 'sell', 'monitor', 'avoid'
    recommendation_strength VARCHAR(20), -- 'strong', 'moderate', 'weak'
    recommendation_reason TEXT,
    
    -- Ranking
    sector_rank INTEGER,
    overall_rank INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(scan_date, contract_id, scan_type)
);

-- Options strategies table (for multi-leg strategies)
CREATE TABLE options_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_name VARCHAR(100) NOT NULL,
    strategy_type VARCHAR(50) NOT NULL, -- 'spread', 'straddle', 'collar', etc.
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    
    -- Strategy components (leg details in JSONB)
    legs JSONB NOT NULL, -- Array of {contract_id, position_type, quantity}
    
    -- Strategy metrics
    max_profit DECIMAL(12, 2),
    max_loss DECIMAL(12, 2),
    breakeven_points JSONB, -- Array of breakeven prices
    
    -- Greeks (net for strategy)
    net_delta DECIMAL(8, 6),
    net_gamma DECIMAL(8, 6),
    net_theta DECIMAL(12, 6),
    net_vega DECIMAL(12, 6),
    
    -- Scoring
    strategy_score DECIMAL(5, 2),
    risk_score DECIMAL(5, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tech sector focus table (curated list of tech stocks for scanning)
CREATE TABLE tech_stock_universe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    
    -- Categorization
    tech_category VARCHAR(100), -- 'software', 'hardware', 'semiconductor', 'cloud', etc.
    market_cap_tier VARCHAR(20), -- 'mega', 'large', 'mid', 'small'
    
    -- Scanning priority
    scan_priority INTEGER DEFAULT 5, -- 1-10, higher = more frequent scanning
    options_liquidity_tier VARCHAR(20), -- 'high', 'medium', 'low'
    
    -- Company metrics for context
    revenue_growth_rate DECIMAL(10, 4),
    earnings_volatility DECIMAL(10, 4),
    beta DECIMAL(8, 4),
    
    -- Scanning preferences
    preferred_strategies JSONB DEFAULT '[]', -- Array of strategy types
    min_volume_threshold INTEGER DEFAULT 100,
    min_open_interest_threshold INTEGER DEFAULT 500,
    
    is_active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol_id)
);

-- Indexes for performance
CREATE INDEX idx_options_contracts_symbol_exp ON options_contracts(symbol_id, expiration_date);
CREATE INDEX idx_options_contracts_active ON options_contracts(is_active, expiration_date) WHERE is_active = true;
CREATE INDEX idx_options_market_data_contract_time ON options_market_data(contract_id, data_timestamp DESC);
CREATE INDEX idx_options_market_data_volume ON options_market_data(volume DESC) WHERE volume > 0;
CREATE INDEX idx_options_value_analysis_scores ON options_value_analysis(value_score DESC, opportunity_score DESC);
CREATE INDEX idx_options_scanner_results_date_score ON options_scanner_results(scan_date DESC, opportunity_score DESC);
CREATE INDEX idx_options_scanner_results_unusual ON options_scanner_results(is_unusual_activity, scan_date DESC) WHERE is_unusual_activity = true;
CREATE INDEX idx_tech_stock_universe_priority ON tech_stock_universe(scan_priority DESC) WHERE is_active = true;

-- Functions for options analysis

-- Function to calculate IV rank and percentile
CREATE OR REPLACE FUNCTION calculate_iv_metrics(
    p_contract_id UUID,
    p_current_iv DECIMAL
) RETURNS TABLE (
    iv_rank DECIMAL,
    iv_percentile DECIMAL
) AS $$
DECLARE
    v_min_iv DECIMAL;
    v_max_iv DECIMAL;
    v_percentile DECIMAL;
BEGIN
    -- Get min/max IV over past 252 trading days (1 year)
    SELECT 
        MIN(implied_volatility),
        MAX(implied_volatility)
    INTO v_min_iv, v_max_iv
    FROM options_market_data
    WHERE contract_id = p_contract_id
    AND data_timestamp >= CURRENT_DATE - INTERVAL '252 days'
    AND implied_volatility IS NOT NULL;
    
    -- Calculate IV Rank
    IF v_max_iv IS NOT NULL AND v_max_iv > v_min_iv THEN
        iv_rank := ((p_current_iv - v_min_iv) / (v_max_iv - v_min_iv)) * 100;
    ELSE
        iv_rank := 50; -- Default to middle if no range
    END IF;
    
    -- Calculate IV Percentile
    SELECT PERCENT_RANK() OVER (ORDER BY implied_volatility) * 100
    INTO v_percentile
    FROM options_market_data
    WHERE contract_id = p_contract_id
    AND data_timestamp >= CURRENT_DATE - INTERVAL '252 days'
    AND implied_volatility = p_current_iv
    LIMIT 1;
    
    iv_percentile := COALESCE(v_percentile, 50);
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to score option value opportunity
CREATE OR REPLACE FUNCTION score_option_value(
    p_contract_id UUID,
    p_analysis_data JSONB
) RETURNS TABLE (
    value_score DECIMAL,
    opportunity_score DECIMAL,
    risk_adjusted_score DECIMAL
) AS $$
DECLARE
    v_iv_rank DECIMAL;
    v_spread_ratio DECIMAL;
    v_volume_oi_ratio DECIMAL;
    v_moneyness DECIMAL;
    v_dte_factor DECIMAL;
BEGIN
    -- Extract metrics from analysis data
    v_iv_rank := (p_analysis_data->>'iv_rank')::DECIMAL;
    v_spread_ratio := (p_analysis_data->>'spread_ratio')::DECIMAL;
    v_volume_oi_ratio := (p_analysis_data->>'volume_oi_ratio')::DECIMAL;
    v_moneyness := (p_analysis_data->>'moneyness')::DECIMAL;
    v_dte_factor := (p_analysis_data->>'dte_factor')::DECIMAL;
    
    -- Calculate value score (focuses on pricing efficiency)
    value_score := (
        (100 - v_iv_rank) * 0.3 +  -- Lower IV rank is better value
        (100 - v_spread_ratio * 100) * 0.3 +  -- Tighter spreads
        LEAST(v_volume_oi_ratio * 20, 100) * 0.2 +  -- Good liquidity
        (100 - ABS(v_moneyness) * 100) * 0.2  -- Near the money options
    );
    
    -- Calculate opportunity score (focuses on profit potential)
    opportunity_score := (
        v_iv_rank * 0.25 +  -- Higher IV can mean more premium
        LEAST(v_volume_oi_ratio * 20, 100) * 0.25 +  -- Activity indicator
        v_dte_factor * 100 * 0.25 +  -- Time value component
        (CASE 
            WHEN v_moneyness BETWEEN -0.1 AND 0.1 THEN 100
            WHEN v_moneyness BETWEEN -0.2 AND 0.2 THEN 75
            ELSE 50
        END) * 0.25
    );
    
    -- Calculate risk-adjusted score
    risk_adjusted_score := (
        value_score * 0.4 +
        opportunity_score * 0.4 +
        (100 - v_iv_rank) * 0.2  -- Lower IV = lower risk
    );
    
    -- Ensure scores are between 0 and 100
    value_score := LEAST(GREATEST(value_score, 0), 100);
    opportunity_score := LEAST(GREATEST(opportunity_score, 0), 100);
    risk_adjusted_score := LEAST(GREATEST(risk_adjusted_score, 0), 100);
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- View for top tech options opportunities
CREATE OR REPLACE VIEW v_tech_options_opportunities AS
WITH latest_analysis AS (
    SELECT DISTINCT ON (ova.contract_id)
        ova.*,
        oc.symbol_id,
        oc.option_type,
        oc.strike_price,
        oc.expiration_date,
        s.symbol,
        s.name,
        tsu.tech_category,
        DATE_PART('day', oc.expiration_date - CURRENT_DATE) as days_to_expiration
    FROM options_value_analysis ova
    JOIN options_contracts oc ON oc.id = ova.contract_id
    JOIN stock_symbols s ON s.id = oc.symbol_id
    JOIN tech_stock_universe tsu ON tsu.symbol_id = s.id
    WHERE ova.analysis_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    AND tsu.is_active = true
    AND oc.is_active = true
    ORDER BY ova.contract_id, ova.analysis_timestamp DESC
)
SELECT 
    symbol,
    name,
    tech_category,
    option_type,
    strike_price,
    expiration_date,
    days_to_expiration,
    market_price,
    implied_volatility,
    volume_liquidity_score,
    value_score,
    opportunity_score,
    risk_adjusted_score,
    recommended_strategy,
    strategy_rationale
FROM latest_analysis
WHERE opportunity_score >= 70
ORDER BY opportunity_score DESC
LIMIT 50;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_options_contracts_timestamp
BEFORE UPDATE ON options_contracts
FOR EACH ROW
EXECUTE FUNCTION update_options_updated_at();