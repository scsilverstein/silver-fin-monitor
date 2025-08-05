-- Create simple earnings calendar table
CREATE TABLE IF NOT EXISTS earnings_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    earnings_date DATE NOT NULL,
    time_of_day VARCHAR(20), -- 'before_market', 'after_market', 'during_market'
    fiscal_quarter VARCHAR(10), -- 'Q1', 'Q2', 'Q3', 'Q4'
    fiscal_year INTEGER,
    
    -- Estimates
    eps_estimate DECIMAL(10,4),
    revenue_estimate BIGINT, -- in thousands
    
    -- Actuals (null until reported)
    eps_actual DECIMAL(10,4),
    revenue_actual BIGINT, -- in thousands
    
    -- Calculated fields
    eps_surprise DECIMAL(10,4), -- actual - estimate
    eps_surprise_percent DECIMAL(10,4),
    revenue_surprise BIGINT,
    revenue_surprise_percent DECIMAL(10,4),
    
    -- Metadata
    importance_rating INTEGER CHECK (importance_rating >= 0 AND importance_rating <= 5), -- 0-5 scale
    confirmed BOOLEAN DEFAULT false, -- true if date is confirmed, false if estimated
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'reported', 'delayed', 'cancelled'
    
    -- Market data
    market_cap BIGINT, -- in thousands
    previous_close DECIMAL(10,2),
    
    -- Source tracking
    data_source VARCHAR(50) DEFAULT 'polygon',
    external_id VARCHAR(255), -- polygon's identifier
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(symbol, earnings_date, fiscal_quarter, fiscal_year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_date ON earnings_calendar(earnings_date DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_symbol ON earnings_calendar(symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_symbol_date ON earnings_calendar(symbol, earnings_date DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_upcoming ON earnings_calendar(earnings_date);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_reported ON earnings_calendar(earnings_date DESC) WHERE status = 'reported';
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_importance ON earnings_calendar(importance_rating DESC, earnings_date);