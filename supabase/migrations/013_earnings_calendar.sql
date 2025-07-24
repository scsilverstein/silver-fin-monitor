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

-- Indexes for performance
CREATE INDEX idx_earnings_calendar_date ON earnings_calendar(earnings_date DESC);
CREATE INDEX idx_earnings_calendar_symbol ON earnings_calendar(symbol);
CREATE INDEX idx_earnings_calendar_symbol_date ON earnings_calendar(symbol, earnings_date DESC);
CREATE INDEX idx_earnings_calendar_upcoming ON earnings_calendar(earnings_date) WHERE earnings_date >= CURRENT_DATE;
CREATE INDEX idx_earnings_calendar_reported ON earnings_calendar(earnings_date DESC) WHERE status = 'reported';
CREATE INDEX idx_earnings_calendar_importance ON earnings_calendar(importance_rating DESC, earnings_date);

-- Historical earnings performance tracking
CREATE TABLE earnings_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    earnings_date DATE NOT NULL,
    
    -- Price performance metrics
    price_1d_before DECIMAL(10,2),
    price_at_close DECIMAL(10,2),
    price_1d_after DECIMAL(10,2),
    price_3d_after DECIMAL(10,2),
    price_7d_after DECIMAL(10,2),
    
    -- Volume metrics
    avg_volume_30d BIGINT,
    volume_on_date BIGINT,
    volume_1d_after BIGINT,
    
    -- Performance calculations
    return_1d DECIMAL(10,4), -- (price_1d_after - price_at_close) / price_at_close
    return_3d DECIMAL(10,4),
    return_7d DECIMAL(10,4),
    
    -- Volatility
    implied_volatility DECIMAL(10,4),
    realized_volatility_7d DECIMAL(10,4),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (symbol, earnings_date) REFERENCES earnings_calendar(symbol, earnings_date) ON DELETE CASCADE
);

-- Indexes for performance tracking
CREATE INDEX idx_earnings_performance_symbol ON earnings_performance(symbol);
CREATE INDEX idx_earnings_performance_date ON earnings_performance(earnings_date DESC);
CREATE INDEX idx_earnings_performance_returns ON earnings_performance(return_1d DESC, return_3d DESC);

-- Earnings estimates tracking (for tracking estimate changes over time)
CREATE TABLE earnings_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    earnings_date DATE NOT NULL,
    estimate_date DATE NOT NULL,
    
    -- Estimates at this point in time
    eps_estimate DECIMAL(10,4),
    revenue_estimate BIGINT,
    
    -- Analyst counts
    analyst_count INTEGER,
    high_estimate DECIMAL(10,4),
    low_estimate DECIMAL(10,4),
    
    -- Source
    data_source VARCHAR(50) DEFAULT 'polygon',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (symbol, earnings_date) REFERENCES earnings_calendar(symbol, earnings_date) ON DELETE CASCADE
);

-- Indexes for estimates tracking
CREATE INDEX idx_earnings_estimates_symbol_date ON earnings_estimates(symbol, earnings_date, estimate_date DESC);
CREATE INDEX idx_earnings_estimates_date ON earnings_estimates(estimate_date DESC);

-- Function to calculate surprise percentages
CREATE OR REPLACE FUNCTION calculate_earnings_surprises()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate EPS surprise
    IF NEW.eps_actual IS NOT NULL AND NEW.eps_estimate IS NOT NULL THEN
        NEW.eps_surprise := NEW.eps_actual - NEW.eps_estimate;
        IF NEW.eps_estimate != 0 THEN
            NEW.eps_surprise_percent := (NEW.eps_surprise / ABS(NEW.eps_estimate)) * 100;
        END IF;
    END IF;
    
    -- Calculate revenue surprise
    IF NEW.revenue_actual IS NOT NULL AND NEW.revenue_estimate IS NOT NULL THEN
        NEW.revenue_surprise := NEW.revenue_actual - NEW.revenue_estimate;
        IF NEW.revenue_estimate != 0 THEN
            NEW.revenue_surprise_percent := (NEW.revenue_surprise::DECIMAL / NEW.revenue_estimate) * 100;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate surprises
CREATE TRIGGER trigger_calculate_earnings_surprises
    BEFORE INSERT OR UPDATE ON earnings_calendar
    FOR EACH ROW
    EXECUTE FUNCTION calculate_earnings_surprises();

-- Function to get upcoming earnings (next 30 days)
CREATE OR REPLACE FUNCTION get_upcoming_earnings(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
    symbol VARCHAR(10),
    company_name VARCHAR(255),
    earnings_date DATE,
    time_of_day VARCHAR(20),
    eps_estimate DECIMAL(10,4),
    revenue_estimate BIGINT,
    importance_rating INTEGER,
    days_until INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.symbol,
        ec.company_name,
        ec.earnings_date,
        ec.time_of_day,
        ec.eps_estimate,
        ec.revenue_estimate,
        ec.importance_rating,
        (ec.earnings_date - CURRENT_DATE)::INTEGER as days_until
    FROM earnings_calendar ec
    WHERE ec.earnings_date >= CURRENT_DATE 
    AND ec.earnings_date <= CURRENT_DATE + INTERVAL '1 day' * days_ahead
    AND ec.status = 'scheduled'
    ORDER BY ec.earnings_date ASC, ec.importance_rating DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get earnings performance stats
CREATE OR REPLACE FUNCTION get_earnings_performance_stats(
    symbol_param VARCHAR(10),
    lookback_quarters INTEGER DEFAULT 8
)
RETURNS TABLE (
    avg_eps_surprise_percent DECIMAL(10,4),
    avg_revenue_surprise_percent DECIMAL(10,4),
    avg_return_1d DECIMAL(10,4),
    avg_return_3d DECIMAL(10,4),
    surprise_accuracy_rate DECIMAL(10,4),
    beat_rate DECIMAL(10,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(ec.eps_surprise_percent) as avg_eps_surprise_percent,
        AVG(ec.revenue_surprise_percent) as avg_revenue_surprise_percent,
        AVG(ep.return_1d) as avg_return_1d,
        AVG(ep.return_3d) as avg_return_3d,
        (COUNT(CASE WHEN ABS(ec.eps_surprise_percent) <= 5 THEN 1 END)::DECIMAL / COUNT(*)) * 100 as surprise_accuracy_rate,
        (COUNT(CASE WHEN ec.eps_surprise > 0 THEN 1 END)::DECIMAL / COUNT(*)) * 100 as beat_rate
    FROM earnings_calendar ec
    LEFT JOIN earnings_performance ep ON ec.symbol = ep.symbol AND ec.earnings_date = ep.earnings_date
    WHERE ec.symbol = symbol_param 
    AND ec.status = 'reported'
    AND ec.earnings_date >= CURRENT_DATE - INTERVAL '2 years'
    LIMIT lookback_quarters;
END;
$$ LANGUAGE plpgsql;

-- Add earnings calendar to the cache cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_earnings_data() RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Clean up old earnings estimates (keep last 6 months)
    DELETE FROM earnings_estimates 
    WHERE estimate_date < NOW() - INTERVAL '6 months';
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Archive old earnings calendar entries (keep last 2 years)
    DELETE FROM earnings_calendar 
    WHERE earnings_date < CURRENT_DATE - INTERVAL '2 years'
    AND status = 'reported';
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Earnings reports table (for actual filings content)
CREATE TABLE earnings_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_calendar_id UUID NOT NULL REFERENCES earnings_calendar(id) ON DELETE CASCADE,
    
    -- Filing information
    filing_type VARCHAR(10) NOT NULL, -- '10-Q', '10-K', '8-K', etc.
    filing_date DATE NOT NULL,
    accession_number VARCHAR(50), -- SEC accession number
    cik VARCHAR(20), -- Central Index Key
    
    -- Document content
    document_url TEXT, -- URL to full filing
    document_html TEXT, -- Full HTML content
    document_text TEXT, -- Extracted text content
    
    -- Processed sections
    business_section TEXT, -- MD&A, Business section
    financial_statements TEXT, -- Balance sheet, income statement, cash flow
    risk_factors TEXT, -- Risk factors section
    management_discussion TEXT, -- Management discussion and analysis
    
    -- AI processing results
    key_themes TEXT[], -- Extracted themes from the report
    sentiment_score DECIMAL(5,4), -- Overall sentiment (-1 to 1)
    risk_assessment TEXT, -- AI-generated risk assessment
    opportunities TEXT, -- AI-identified opportunities
    summary TEXT, -- AI-generated summary
    
    -- Financial metrics extracted from report
    extracted_metrics JSONB DEFAULT '{}', -- Key financial figures
    
    -- Processing metadata
    processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    processing_metadata JSONB DEFAULT '{}',
    ai_analysis_completed BOOLEAN DEFAULT false,
    
    -- Timestamps
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(earnings_calendar_id, filing_type, accession_number)
);

-- Indexes for earnings reports
CREATE INDEX idx_earnings_reports_calendar_id ON earnings_reports(earnings_calendar_id);
CREATE INDEX idx_earnings_reports_filing_date ON earnings_reports(filing_date DESC);
CREATE INDEX idx_earnings_reports_cik ON earnings_reports(cik);
CREATE INDEX idx_earnings_reports_processing_status ON earnings_reports(processing_status);
CREATE INDEX idx_earnings_reports_ai_completed ON earnings_reports(ai_analysis_completed) WHERE ai_analysis_completed = false;

-- Earnings report sections table (for more granular content)
CREATE TABLE earnings_report_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_report_id UUID NOT NULL REFERENCES earnings_reports(id) ON DELETE CASCADE,
    
    section_type VARCHAR(50) NOT NULL, -- 'income_statement', 'balance_sheet', 'cash_flow', 'md_a', 'risk_factors', etc.
    section_title VARCHAR(255),
    section_content TEXT,
    section_order INTEGER,
    
    -- AI processing for this section
    section_summary TEXT,
    key_points TEXT[],
    sentiment_score DECIMAL(5,4),
    extracted_figures JSONB DEFAULT '{}', -- Numbers, percentages, etc. from this section
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for report sections
CREATE INDEX idx_earnings_report_sections_report_id ON earnings_report_sections(earnings_report_id);
CREATE INDEX idx_earnings_report_sections_type ON earnings_report_sections(section_type);

-- Earnings call transcripts (if available)
CREATE TABLE earnings_call_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_calendar_id UUID NOT NULL REFERENCES earnings_calendar(id) ON DELETE CASCADE,
    
    -- Call information
    call_date DATE NOT NULL,
    call_time TIME,
    duration_minutes INTEGER,
    
    -- Transcript content
    full_transcript TEXT,
    prepared_remarks TEXT, -- Management prepared remarks
    qa_section TEXT, -- Q&A portion
    
    -- Participants
    management_participants JSONB DEFAULT '[]', -- Array of management speakers
    analyst_participants JSONB DEFAULT '[]', -- Array of analyst participants
    
    -- AI analysis
    key_themes TEXT[],
    sentiment_score DECIMAL(5,4),
    management_tone VARCHAR(20), -- 'confident', 'cautious', 'defensive', etc.
    forward_guidance TEXT, -- Extracted forward-looking statements
    analyst_concerns TEXT[], -- Key concerns raised by analysts
    
    -- Processing
    processing_status VARCHAR(20) DEFAULT 'pending',
    ai_analysis_completed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for call transcripts
CREATE INDEX idx_earnings_call_transcripts_calendar_id ON earnings_call_transcripts(earnings_calendar_id);
CREATE INDEX idx_earnings_call_transcripts_date ON earnings_call_transcripts(call_date DESC);

-- Add earnings reports to processed content relationship
CREATE TABLE earnings_content_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_calendar_id UUID NOT NULL REFERENCES earnings_calendar(id),
    processed_content_id UUID NOT NULL REFERENCES processed_content(id),
    content_source VARCHAR(50) NOT NULL, -- 'filing', 'transcript', 'news', 'analysis'
    relevance_score DECIMAL(5,4), -- How relevant this content is to the earnings event
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(earnings_calendar_id, processed_content_id)
);

-- Function to get comprehensive earnings data
CREATE OR REPLACE FUNCTION get_earnings_with_reports(
    symbol_param VARCHAR(10),
    earnings_date_param DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'calendar', ec.*,
        'reports', COALESCE(reports.report_data, '[]'::json),
        'transcripts', COALESCE(transcripts.transcript_data, '[]'::json),
        'performance', ep.*,
        'related_content', COALESCE(content.content_data, '[]'::json)
    ) INTO result
    FROM earnings_calendar ec
    LEFT JOIN earnings_performance ep ON ec.symbol = ep.symbol AND ec.earnings_date = ep.earnings_date
    LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
            'id', er.id,
            'filing_type', er.filing_type,
            'filing_date', er.filing_date,
            'summary', er.summary,
            'sentiment_score', er.sentiment_score,
            'key_themes', er.key_themes,
            'processing_status', er.processing_status
        )) as report_data
        FROM earnings_reports er
        WHERE er.earnings_calendar_id = ec.id
    ) reports ON true
    LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
            'id', ect.id,
            'call_date', ect.call_date,
            'sentiment_score', ect.sentiment_score,
            'management_tone', ect.management_tone,
            'key_themes', ect.key_themes,
            'forward_guidance', ect.forward_guidance
        )) as transcript_data
        FROM earnings_call_transcripts ect
        WHERE ect.earnings_calendar_id = ec.id
    ) transcripts ON true
    LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
            'id', pc.id,
            'summary', pc.summary,
            'sentiment_score', pc.sentiment_score,
            'key_topics', pc.key_topics,
            'relevance_score', ecm.relevance_score
        )) as content_data
        FROM earnings_content_mapping ecm
        JOIN processed_content pc ON ecm.processed_content_id = pc.id
        WHERE ecm.earnings_calendar_id = ec.id
        ORDER BY ecm.relevance_score DESC
        LIMIT 10
    ) content ON true
    WHERE ec.symbol = symbol_param 
    AND ec.earnings_date = earnings_date_param;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to extract financial metrics from reports
CREATE OR REPLACE FUNCTION extract_financial_metrics(report_id UUID)
RETURNS JSONB AS $$
DECLARE
    report_text TEXT;
    metrics JSONB := '{}';
BEGIN
    SELECT document_text INTO report_text 
    FROM earnings_reports 
    WHERE id = report_id;
    
    -- This would be enhanced with actual parsing logic
    -- For now, return empty object
    RETURN metrics;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easier earnings calendar queries
CREATE VIEW earnings_calendar_with_stats AS
SELECT 
    ec.*,
    CASE 
        WHEN ec.earnings_date = CURRENT_DATE THEN 'today'
        WHEN ec.earnings_date = CURRENT_DATE + 1 THEN 'tomorrow'
        WHEN ec.earnings_date <= CURRENT_DATE + 7 THEN 'this_week'
        WHEN ec.earnings_date <= CURRENT_DATE + 30 THEN 'this_month'
        ELSE 'future'
    END as time_bucket,
    (ec.earnings_date - CURRENT_DATE)::INTEGER as days_until,
    CASE 
        WHEN ec.eps_actual IS NOT NULL THEN 'reported'
        WHEN ec.earnings_date < CURRENT_DATE THEN 'missed'
        ELSE 'scheduled'
    END as reporting_status,
    -- Report availability indicators
    EXISTS(SELECT 1 FROM earnings_reports er WHERE er.earnings_calendar_id = ec.id) as has_reports,
    EXISTS(SELECT 1 FROM earnings_call_transcripts ect WHERE ect.earnings_calendar_id = ec.id) as has_transcripts,
    (SELECT COUNT(*) FROM earnings_content_mapping ecm WHERE ecm.earnings_calendar_id = ec.id) as related_content_count
FROM earnings_calendar ec;