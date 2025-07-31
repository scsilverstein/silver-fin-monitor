-- Create real-time fundamental metrics table
CREATE TABLE IF NOT EXISTS fundamental_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
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
    analyst_rating DECIMAL(3, 2),
    analyst_count INTEGER,
    price_target_mean DECIMAL(12, 2),
    price_target_high DECIMAL(12, 2),
    price_target_low DECIMAL(12, 2),
    
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_fundamental_metrics_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_fundamental_metrics_ratios CHECK (
        (pe_ratio IS NULL OR pe_ratio > 0) AND
        (forward_pe_ratio IS NULL OR forward_pe_ratio > 0) AND
        (peg_ratio IS NULL OR peg_ratio > 0) AND
        (price_to_book IS NULL OR price_to_book > 0) AND
        (price_to_sales IS NULL OR price_to_sales > 0)
    ),
    
    CONSTRAINT chk_fundamental_metrics_analyst_rating CHECK (
        analyst_rating IS NULL OR analyst_rating BETWEEN 1 AND 5
    ),
    
    CONSTRAINT uq_fundamental_metrics 
        UNIQUE(entity_id, metric_date, data_source)
);

-- Add table comment
COMMENT ON TABLE fundamental_metrics IS 'Daily updated fundamental metrics and ratios';

-- Add column comments
COMMENT ON COLUMN fundamental_metrics.metric_date IS 'Date these metrics were calculated';
COMMENT ON COLUMN fundamental_metrics.pe_ratio IS 'Price to Earnings ratio';
COMMENT ON COLUMN fundamental_metrics.forward_pe_ratio IS 'Forward Price to Earnings ratio';
COMMENT ON COLUMN fundamental_metrics.peg_ratio IS 'Price/Earnings to Growth ratio';
COMMENT ON COLUMN fundamental_metrics.ev_to_ebitda IS 'Enterprise Value to EBITDA';
COMMENT ON COLUMN fundamental_metrics.analyst_rating IS 'Average analyst rating (1-5 scale)';