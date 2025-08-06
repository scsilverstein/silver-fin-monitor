-- Check if table exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'earnings_calendar') THEN
        
        -- Create earnings calendar table
        CREATE TABLE earnings_calendar (
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

        -- Create indexes
        CREATE INDEX idx_earnings_calendar_date ON earnings_calendar(earnings_date DESC);
        CREATE INDEX idx_earnings_calendar_symbol ON earnings_calendar(symbol);
        CREATE INDEX idx_earnings_calendar_symbol_date ON earnings_calendar(symbol, earnings_date DESC);
        CREATE INDEX idx_earnings_calendar_upcoming ON earnings_calendar(earnings_date) WHERE earnings_date >= CURRENT_DATE;
        CREATE INDEX idx_earnings_calendar_reported ON earnings_calendar(earnings_date DESC) WHERE status = 'reported';
        CREATE INDEX idx_earnings_calendar_importance ON earnings_calendar(importance_rating DESC, earnings_date);

        -- Create earnings reports table
        CREATE TABLE earnings_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            earnings_calendar_id UUID REFERENCES earnings_calendar(id) ON DELETE CASCADE,
            
            -- Report details
            report_type VARCHAR(50), -- 'earnings_release', 'transcript', '8k', '10q', etc.
            report_date TIMESTAMP WITH TIME ZONE,
            
            -- Content
            title VARCHAR(500),
            content TEXT,
            summary TEXT,
            
            -- Analysis
            ai_summary TEXT,
            sentiment_score DECIMAL(5,4),
            key_highlights JSONB, -- Array of key points
            mentioned_products JSONB, -- Array of products mentioned
            guidance_notes JSONB, -- Forward guidance extracted
            
            -- Source
            source_url VARCHAR(500),
            pdf_url VARCHAR(500),
            
            -- Metadata
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            UNIQUE(earnings_calendar_id, report_type)
        );

        -- Create index for reports
        CREATE INDEX idx_earnings_reports_calendar ON earnings_reports(earnings_calendar_id);
        CREATE INDEX idx_earnings_reports_date ON earnings_reports(report_date DESC);

        -- Create view for calendar with stats
        CREATE OR REPLACE VIEW earnings_calendar_with_stats AS
        SELECT 
            ec.*,
            CASE 
                WHEN ec.earnings_date < CURRENT_DATE THEN 'past'
                WHEN ec.earnings_date = CURRENT_DATE THEN 'today'
                ELSE 'upcoming'
            END as relative_date,
            ec.earnings_date - CURRENT_DATE as days_until,
            CASE 
                WHEN ec.status = 'reported' THEN 'reported'
                WHEN ec.earnings_date < CURRENT_DATE - INTERVAL '2 days' THEN 'missed'
                ELSE 'scheduled'
            END as reporting_status,
            EXISTS (
                SELECT 1 FROM earnings_reports er 
                WHERE er.earnings_calendar_id = ec.id
            ) as has_reports,
            EXISTS (
                SELECT 1 FROM earnings_reports er 
                WHERE er.earnings_calendar_id = ec.id 
                AND er.report_type = 'transcript'
            ) as has_transcript
        FROM earnings_calendar ec;

        RAISE NOTICE 'Earnings calendar tables created successfully';
    ELSE
        RAISE NOTICE 'Earnings calendar table already exists';
    END IF;
END$$;