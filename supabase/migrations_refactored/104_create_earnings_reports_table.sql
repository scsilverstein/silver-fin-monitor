-- Create earnings reports table
CREATE TABLE IF NOT EXISTS earnings_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_event_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Report details
    report_type VARCHAR(50) NOT NULL,
    filing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Key metrics
    revenue DECIMAL(20, 2),
    gross_profit DECIMAL(20, 2),
    operating_income DECIMAL(20, 2),
    net_income DECIMAL(20, 2),
    eps_diluted DECIMAL(10, 4),
    
    -- Year-over-year changes
    revenue_yoy DECIMAL(10, 2),
    gross_profit_yoy DECIMAL(10, 2),
    operating_income_yoy DECIMAL(10, 2),
    net_income_yoy DECIMAL(10, 2),
    eps_yoy DECIMAL(10, 2),
    
    -- Guidance
    revenue_guidance_low DECIMAL(20, 2),
    revenue_guidance_high DECIMAL(20, 2),
    eps_guidance_low DECIMAL(10, 4),
    eps_guidance_high DECIMAL(10, 4),
    guidance_notes TEXT,
    
    -- Document references
    report_url TEXT,
    presentation_url TEXT,
    webcast_url TEXT,
    
    -- Metadata
    data_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_earnings_reports_event 
        FOREIGN KEY (earnings_event_id) 
        REFERENCES earnings_events(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_earnings_reports_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_earnings_reports_type CHECK (
        report_type IN ('10-Q', '10-K', '8-K', 'earnings_release', 'investor_presentation')
    ),
    
    CONSTRAINT chk_earnings_reports_guidance CHECK (
        (revenue_guidance_low IS NULL AND revenue_guidance_high IS NULL) OR
        (revenue_guidance_low <= revenue_guidance_high)
    )
);

-- Add table comment
COMMENT ON TABLE earnings_reports IS 'Detailed earnings report data and guidance';

-- Add column comments
COMMENT ON COLUMN earnings_reports.report_type IS 'Type of report: 10-Q, 10-K, 8-K, earnings_release, investor_presentation';
COMMENT ON COLUMN earnings_reports.revenue_yoy IS 'Year-over-year revenue change percentage';
COMMENT ON COLUMN earnings_reports.guidance_notes IS 'Management commentary on guidance';