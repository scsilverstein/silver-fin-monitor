-- Create earnings events table
CREATE TABLE IF NOT EXISTS earnings_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    
    -- Event timing
    earnings_date DATE NOT NULL,
    earnings_time VARCHAR(20),
    fiscal_year INTEGER NOT NULL,
    fiscal_quarter INTEGER NOT NULL,
    
    -- Estimates
    eps_estimate DECIMAL(10, 4),
    eps_estimate_count INTEGER,
    revenue_estimate DECIMAL(20, 2),
    revenue_estimate_count INTEGER,
    
    -- Actual results
    eps_actual DECIMAL(10, 4),
    revenue_actual DECIMAL(20, 2),
    
    -- Calculated fields
    eps_surprise DECIMAL(10, 4),
    eps_surprise_percent DECIMAL(10, 2),
    revenue_surprise DECIMAL(20, 2),
    revenue_surprise_percent DECIMAL(10, 2),
    
    -- Status
    has_reported BOOLEAN DEFAULT false,
    is_confirmed BOOLEAN DEFAULT false,
    report_url TEXT,
    
    -- Metadata
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_earnings_events_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_earnings_events_time CHECK (
        earnings_time IS NULL OR 
        earnings_time IN ('pre-market', 'post-market', 'during-market', 'unknown')
    ),
    
    CONSTRAINT chk_earnings_events_quarter CHECK (
        fiscal_quarter BETWEEN 1 AND 4
    ),
    
    CONSTRAINT uq_earnings_events 
        UNIQUE(entity_id, fiscal_year, fiscal_quarter)
);

-- Add table comment
COMMENT ON TABLE earnings_events IS 'Earnings calendar events with estimates and actuals';

-- Add column comments
COMMENT ON COLUMN earnings_events.earnings_time IS 'Time of earnings release: pre-market, post-market, during-market';
COMMENT ON COLUMN earnings_events.eps_surprise IS 'Actual EPS minus estimate';
COMMENT ON COLUMN earnings_events.eps_surprise_percent IS 'EPS surprise as percentage of estimate';
COMMENT ON COLUMN earnings_events.has_reported IS 'Whether earnings have been reported';
COMMENT ON COLUMN earnings_events.is_confirmed IS 'Whether the earnings date is confirmed';