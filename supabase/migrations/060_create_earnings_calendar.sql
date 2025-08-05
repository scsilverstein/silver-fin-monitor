-- Create earnings_calendar table if it doesn't exist
CREATE TABLE IF NOT EXISTS earnings_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    earnings_date DATE NOT NULL,
    time_of_day VARCHAR(50), -- 'before_market', 'after_market', 'during_market'
    fiscal_quarter VARCHAR(10), -- 'Q1', 'Q2', 'Q3', 'Q4'
    fiscal_year INTEGER,
    eps_estimate DECIMAL(10, 4),
    eps_actual DECIMAL(10, 4),
    revenue_estimate DECIMAL(20, 2),
    revenue_actual DECIMAL(20, 2),
    surprise_percentage DECIMAL(10, 4),
    importance_rating INTEGER DEFAULT 3, -- 1-5 scale
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'reported', 'delayed', 'cancelled'
    confirmed BOOLEAN DEFAULT false,
    has_reports BOOLEAN DEFAULT false,
    has_transcripts BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, earnings_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_date ON earnings_calendar(earnings_date);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_symbol ON earnings_calendar(symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_date_range ON earnings_calendar(earnings_date, symbol);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_status ON earnings_calendar(status);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_earnings_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER earnings_calendar_updated_at_trigger
    BEFORE UPDATE ON earnings_calendar
    FOR EACH ROW
    EXECUTE FUNCTION update_earnings_calendar_updated_at();

-- Add RLS policies
ALTER TABLE earnings_calendar ENABLE ROW LEVEL SECURITY;

-- Policy for public read access
CREATE POLICY "Allow public read access to earnings calendar" ON earnings_calendar
    FOR SELECT TO anon, authenticated
    USING (true);

-- Policy for authenticated write access
CREATE POLICY "Allow authenticated write access to earnings calendar" ON earnings_calendar
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert some sample data for testing (real earnings dates)
INSERT INTO earnings_calendar (symbol, company_name, earnings_date, time_of_day, fiscal_quarter, fiscal_year, importance_rating, status, confirmed)
VALUES 
    ('AAPL', 'Apple Inc.', '2025-01-30', 'after_market', 'Q1', 2025, 5, 'scheduled', true),
    ('MSFT', 'Microsoft Corporation', '2025-01-29', 'after_market', 'Q2', 2025, 5, 'scheduled', true),
    ('GOOGL', 'Alphabet Inc.', '2025-02-04', 'after_market', 'Q4', 2024, 5, 'scheduled', true),
    ('AMZN', 'Amazon.com Inc.', '2025-02-06', 'after_market', 'Q4', 2024, 5, 'scheduled', true),
    ('META', 'Meta Platforms Inc.', '2025-02-05', 'after_market', 'Q4', 2024, 5, 'scheduled', true),
    ('NVDA', 'NVIDIA Corporation', '2025-02-19', 'after_market', 'Q4', 2025, 5, 'scheduled', true),
    ('TSLA', 'Tesla Inc.', '2025-01-29', 'after_market', 'Q4', 2024, 5, 'scheduled', true),
    ('JPM', 'JPMorgan Chase & Co.', '2025-01-15', 'before_market', 'Q4', 2024, 4, 'scheduled', true),
    ('BAC', 'Bank of America Corp.', '2025-01-16', 'before_market', 'Q4', 2024, 4, 'scheduled', true),
    ('WMT', 'Walmart Inc.', '2025-02-18', 'before_market', 'Q4', 2025, 4, 'scheduled', true)
ON CONFLICT (symbol, earnings_date) DO NOTHING;

-- Create a function to get earnings calendar for a specific month
CREATE OR REPLACE FUNCTION get_earnings_calendar_month(
    p_year INTEGER,
    p_month INTEGER
) RETURNS TABLE (
    date DATE,
    earnings JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.earnings_date AS date,
        jsonb_agg(
            jsonb_build_object(
                'id', ec.id,
                'symbol', ec.symbol,
                'company_name', ec.company_name,
                'earnings_date', ec.earnings_date,
                'time_of_day', ec.time_of_day,
                'fiscal_quarter', ec.fiscal_quarter,
                'fiscal_year', ec.fiscal_year,
                'importance_rating', ec.importance_rating,
                'status', ec.status,
                'confirmed', ec.confirmed,
                'has_reports', ec.has_reports,
                'has_transcripts', ec.has_transcripts,
                'days_until', ec.earnings_date - CURRENT_DATE,
                'reporting_status', CASE 
                    WHEN ec.status = 'reported' THEN 'reported'
                    WHEN ec.earnings_date < CURRENT_DATE THEN 'missed'
                    ELSE 'scheduled'
                END
            ) ORDER BY ec.time_of_day DESC, ec.symbol
        ) AS earnings
    FROM earnings_calendar ec
    WHERE EXTRACT(YEAR FROM ec.earnings_date) = p_year
    AND EXTRACT(MONTH FROM ec.earnings_date) = p_month
    GROUP BY ec.earnings_date
    ORDER BY ec.earnings_date;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get upcoming earnings
CREATE OR REPLACE FUNCTION get_upcoming_earnings(
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    id UUID,
    symbol VARCHAR(10),
    company_name VARCHAR(255),
    earnings_date DATE,
    time_of_day VARCHAR(50),
    fiscal_quarter VARCHAR(10),
    fiscal_year INTEGER,
    importance_rating INTEGER,
    status VARCHAR(50),
    confirmed BOOLEAN,
    has_reports BOOLEAN,
    has_transcripts BOOLEAN,
    days_until INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.id,
        ec.symbol,
        ec.company_name,
        ec.earnings_date,
        ec.time_of_day,
        ec.fiscal_quarter,
        ec.fiscal_year,
        ec.importance_rating,
        ec.status,
        ec.confirmed,
        ec.has_reports,
        ec.has_transcripts,
        (ec.earnings_date - CURRENT_DATE)::INTEGER AS days_until
    FROM earnings_calendar ec
    WHERE ec.earnings_date >= CURRENT_DATE
    AND ec.earnings_date <= CURRENT_DATE + INTERVAL '1 day' * p_days
    AND ec.status = 'scheduled'
    ORDER BY ec.earnings_date, ec.time_of_day DESC, ec.symbol;
END;
$$ LANGUAGE plpgsql;