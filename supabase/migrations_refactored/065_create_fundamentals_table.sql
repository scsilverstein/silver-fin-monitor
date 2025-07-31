-- Create fundamentals table
CREATE TABLE IF NOT EXISTS fundamentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    
    -- Period information
    period_type VARCHAR(10) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER,
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
    roe DECIMAL(10, 4),
    roa DECIMAL(10, 4),
    roic DECIMAL(10, 4),
    
    -- Data source
    data_source VARCHAR(50) NOT NULL,
    source_filing_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_fundamentals_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_fundamentals_period_type CHECK (
        period_type IN ('quarterly', 'annual', 'ttm')
    ),
    
    CONSTRAINT chk_fundamentals_quarter CHECK (
        (period_type = 'quarterly' AND fiscal_quarter BETWEEN 1 AND 4) OR
        (period_type IN ('annual', 'ttm') AND fiscal_quarter IS NULL)
    ),
    
    CONSTRAINT uq_fundamentals 
        UNIQUE(entity_id, period_type, fiscal_year, fiscal_quarter, data_source)
);

-- Add table comment
COMMENT ON TABLE fundamentals IS 'Quarterly and annual fundamental financial data';

-- Add column comments
COMMENT ON COLUMN fundamentals.period_type IS 'Type of period: quarterly, annual, ttm (trailing twelve months)';
COMMENT ON COLUMN fundamentals.fiscal_year IS 'Fiscal year for this data';
COMMENT ON COLUMN fundamentals.fiscal_quarter IS 'Fiscal quarter (1-4) for quarterly data, NULL for annual';
COMMENT ON COLUMN fundamentals.roe IS 'Return on Equity';
COMMENT ON COLUMN fundamentals.roa IS 'Return on Assets';
COMMENT ON COLUMN fundamentals.roic IS 'Return on Invested Capital';