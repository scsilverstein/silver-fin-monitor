-- Stock Scanner Database Schema
-- This migration adds tables for stock scanning functionality

-- Stock symbols master table
CREATE TABLE stock_symbols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(50),
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap_category VARCHAR(50), -- 'micro', 'small', 'mid', 'large', 'mega'
    is_active BOOLEAN DEFAULT true,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock fundamentals historical data
CREATE TABLE stock_fundamentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    data_date DATE NOT NULL,
    
    -- Earnings data
    earnings_per_share DECIMAL(15, 4),
    forward_earnings_per_share DECIMAL(15, 4),
    earnings_growth_rate DECIMAL(10, 4), -- Percentage
    
    -- P/E ratios
    pe_ratio DECIMAL(10, 2),
    forward_pe_ratio DECIMAL(10, 2),
    peg_ratio DECIMAL(10, 2),
    
    -- Other fundamentals
    price DECIMAL(12, 2),
    volume BIGINT,
    market_cap BIGINT,
    
    -- Revenue and profitability
    revenue BIGINT,
    revenue_growth_rate DECIMAL(10, 4),
    profit_margin DECIMAL(10, 4),
    
    -- Additional metrics
    book_value_per_share DECIMAL(15, 4),
    price_to_book DECIMAL(10, 2),
    roe DECIMAL(10, 4), -- Return on Equity
    
    data_source VARCHAR(50), -- 'yahoo', 'alpha_vantage', 'polygon', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol_id, data_date, data_source)
);

-- Peer groups for relative comparison
CREATE TABLE stock_peer_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    peer_symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50), -- 'sector', 'industry', 'market_cap', 'custom'
    similarity_score DECIMAL(5, 2), -- 0-100 score
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol_id, peer_symbol_id, relationship_type)
);

-- Stock scanner results
CREATE TABLE stock_scanner_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    scan_date DATE NOT NULL,
    scan_type VARCHAR(50) NOT NULL, -- 'earnings_momentum', 'pe_anomaly', 'peer_relative'
    
    -- Change metrics
    earnings_change_1d DECIMAL(10, 4), -- 1-day change percentage
    earnings_change_5d DECIMAL(10, 4), -- 5-day change percentage
    earnings_change_30d DECIMAL(10, 4), -- 30-day change percentage
    
    forward_pe_change_1d DECIMAL(10, 4),
    forward_pe_change_5d DECIMAL(10, 4),
    forward_pe_change_30d DECIMAL(10, 4),
    
    -- Relative metrics
    pe_vs_sector_percentile DECIMAL(5, 2), -- 0-100
    pe_vs_industry_percentile DECIMAL(5, 2),
    earnings_growth_vs_sector_percentile DECIMAL(5, 2),
    
    -- Scoring
    momentum_score DECIMAL(5, 2), -- 0-100
    value_score DECIMAL(5, 2), -- 0-100
    composite_score DECIMAL(5, 2), -- 0-100
    
    -- Alert flags
    is_significant_change BOOLEAN DEFAULT false,
    alert_type VARCHAR(50), -- 'bullish_momentum', 'bearish_divergence', 'value_opportunity'
    alert_message TEXT,
    
    -- Analysis metadata
    peer_comparison_count INTEGER,
    confidence_level DECIMAL(5, 2), -- 0-100
    analysis_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol_id, scan_date, scan_type)
);

-- Watchlist for high-priority stocks
CREATE TABLE stock_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_id UUID NOT NULL REFERENCES stock_symbols(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    added_by VARCHAR(100), -- Can be 'system' or user identifier
    alert_threshold JSONB DEFAULT '{}', -- Custom alert conditions
    is_active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(symbol_id, added_by)
);

-- Indexes for performance
CREATE INDEX idx_stock_fundamentals_symbol_date ON stock_fundamentals(symbol_id, data_date DESC);
CREATE INDEX idx_stock_fundamentals_date ON stock_fundamentals(data_date DESC);
CREATE INDEX idx_scanner_results_symbol_scan ON stock_scanner_results(symbol_id, scan_date DESC);
CREATE INDEX idx_scanner_results_significant ON stock_scanner_results(is_significant_change, scan_date DESC) WHERE is_significant_change = true;
CREATE INDEX idx_scanner_results_composite_score ON stock_scanner_results(composite_score DESC, scan_date DESC);
CREATE INDEX idx_stock_symbols_sector_industry ON stock_symbols(sector, industry) WHERE is_active = true;
CREATE INDEX idx_peer_groups_symbol ON stock_peer_groups(symbol_id);
CREATE INDEX idx_watchlist_active ON stock_watchlist(is_active, priority) WHERE is_active = true;

-- Functions for stock scanner operations

-- Function to calculate percentile rank within peer group
CREATE OR REPLACE FUNCTION calculate_peer_percentile(
    p_symbol_id UUID,
    p_metric_name VARCHAR(50),
    p_metric_value DECIMAL,
    p_comparison_type VARCHAR(50) DEFAULT 'industry'
) RETURNS DECIMAL AS $$
DECLARE
    v_percentile DECIMAL;
    v_peer_count INTEGER;
BEGIN
    -- Get peer group based on comparison type
    WITH peer_metrics AS (
        SELECT 
            sf.symbol_id,
            CASE p_metric_name
                WHEN 'forward_pe_ratio' THEN sf.forward_pe_ratio
                WHEN 'earnings_growth' THEN sf.earnings_growth_rate
                WHEN 'pe_ratio' THEN sf.pe_ratio
                ELSE NULL
            END as metric_value
        FROM stock_fundamentals sf
        JOIN stock_symbols s ON s.id = sf.symbol_id
        JOIN stock_symbols target ON target.id = p_symbol_id
        WHERE sf.data_date = (SELECT MAX(data_date) FROM stock_fundamentals WHERE symbol_id = p_symbol_id)
        AND CASE p_comparison_type
            WHEN 'industry' THEN s.industry = target.industry
            WHEN 'sector' THEN s.sector = target.sector
            WHEN 'market_cap' THEN s.market_cap_category = target.market_cap_category
            ELSE FALSE
        END
        AND metric_value IS NOT NULL
    ),
    ranked_metrics AS (
        SELECT 
            symbol_id,
            metric_value,
            PERCENT_RANK() OVER (ORDER BY metric_value) * 100 as percentile
        FROM peer_metrics
    )
    SELECT percentile, COUNT(*) OVER() INTO v_percentile, v_peer_count
    FROM ranked_metrics
    WHERE symbol_id = p_symbol_id;
    
    -- Return NULL if insufficient peer data
    IF v_peer_count < 5 THEN
        RETURN NULL;
    END IF;
    
    RETURN v_percentile;
END;
$$ LANGUAGE plpgsql;

-- Function to detect significant changes
CREATE OR REPLACE FUNCTION detect_significant_changes(
    p_threshold_1d DECIMAL DEFAULT 5.0,
    p_threshold_5d DECIMAL DEFAULT 10.0,
    p_threshold_30d DECIMAL DEFAULT 20.0
) RETURNS TABLE (
    symbol_id UUID,
    change_type VARCHAR(50),
    change_magnitude DECIMAL,
    alert_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_scans AS (
        SELECT DISTINCT ON (symbol_id) *
        FROM stock_scanner_results
        ORDER BY symbol_id, scan_date DESC
    )
    SELECT 
        ls.symbol_id,
        CASE 
            WHEN ABS(ls.earnings_change_1d) > p_threshold_1d THEN 'earnings_1d'
            WHEN ABS(ls.earnings_change_5d) > p_threshold_5d THEN 'earnings_5d'
            WHEN ABS(ls.earnings_change_30d) > p_threshold_30d THEN 'earnings_30d'
            WHEN ABS(ls.forward_pe_change_1d) > p_threshold_1d THEN 'pe_1d'
            WHEN ABS(ls.forward_pe_change_5d) > p_threshold_5d THEN 'pe_5d'
            WHEN ABS(ls.forward_pe_change_30d) > p_threshold_30d THEN 'pe_30d'
        END as change_type,
        GREATEST(
            ABS(ls.earnings_change_1d),
            ABS(ls.earnings_change_5d),
            ABS(ls.earnings_change_30d),
            ABS(ls.forward_pe_change_1d),
            ABS(ls.forward_pe_change_5d),
            ABS(ls.forward_pe_change_30d)
        ) as change_magnitude,
        s.symbol || ': ' || 
        CASE 
            WHEN ls.earnings_change_30d > p_threshold_30d THEN 'Strong earnings momentum detected'
            WHEN ls.earnings_change_30d < -p_threshold_30d THEN 'Significant earnings decline detected'
            WHEN ls.forward_pe_change_30d < -p_threshold_30d AND ls.pe_vs_industry_percentile < 30 THEN 'Potential value opportunity'
            ELSE 'Notable fundamental change detected'
        END as alert_message
    FROM latest_scans ls
    JOIN stock_symbols s ON s.id = ls.symbol_id
    WHERE ls.is_significant_change = true
    OR ABS(ls.earnings_change_1d) > p_threshold_1d
    OR ABS(ls.earnings_change_5d) > p_threshold_5d
    OR ABS(ls.earnings_change_30d) > p_threshold_30d
    OR ABS(ls.forward_pe_change_1d) > p_threshold_1d
    OR ABS(ls.forward_pe_change_5d) > p_threshold_5d
    OR ABS(ls.forward_pe_change_30d) > p_threshold_30d;
END;
$$ LANGUAGE plpgsql;

-- View for top movers
CREATE OR REPLACE VIEW v_stock_top_movers AS
WITH latest_results AS (
    SELECT DISTINCT ON (symbol_id) *
    FROM stock_scanner_results
    WHERE scan_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY symbol_id, scan_date DESC
)
SELECT 
    s.symbol,
    s.name,
    s.sector,
    s.industry,
    lr.earnings_change_5d,
    lr.forward_pe_change_5d,
    lr.composite_score,
    lr.pe_vs_industry_percentile,
    lr.alert_type,
    lr.alert_message
FROM latest_results lr
JOIN stock_symbols s ON s.id = lr.symbol_id
WHERE lr.is_significant_change = true
ORDER BY lr.composite_score DESC;

-- Trigger to update last_updated on stock_symbols
CREATE OR REPLACE FUNCTION update_stock_symbol_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stock_symbols 
    SET last_updated = NOW()
    WHERE id = NEW.symbol_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_symbol_on_fundamentals_insert
AFTER INSERT ON stock_fundamentals
FOR EACH ROW
EXECUTE FUNCTION update_stock_symbol_timestamp();