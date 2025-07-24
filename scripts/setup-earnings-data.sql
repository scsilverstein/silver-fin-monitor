-- Create the view if it doesn't exist
CREATE VIEW IF NOT EXISTS earnings_calendar_with_stats AS
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
    (SELECT COUNT(*) FROM earnings_content_mapping ecm WHERE ecm.earnings_calendar_id = ec.id)::INTEGER as related_content_count
FROM earnings_calendar ec;

-- Insert sample earnings data for January 2025
INSERT INTO earnings_calendar (symbol, company_name, earnings_date, time_of_day, importance_rating, status, confirmed) VALUES
-- Tech Giants
('AAPL', 'Apple Inc.', '2025-01-28', 'after_market', 5, 'scheduled', true),
('MSFT', 'Microsoft Corporation', '2025-01-24', 'after_market', 5, 'scheduled', true),
('GOOGL', 'Alphabet Inc.', '2025-01-30', 'after_market', 5, 'scheduled', true),
('AMZN', 'Amazon.com Inc.', '2025-01-31', 'after_market', 5, 'scheduled', true),
('META', 'Meta Platforms Inc.', '2025-01-29', 'after_market', 5, 'scheduled', true),

-- Finance
('JPM', 'JPMorgan Chase & Co.', '2025-01-15', 'before_market', 5, 'scheduled', true),
('BAC', 'Bank of America Corp.', '2025-01-16', 'before_market', 4, 'scheduled', true),
('GS', 'Goldman Sachs Group Inc.', '2025-01-17', 'before_market', 4, 'scheduled', true),

-- Healthcare
('JNJ', 'Johnson & Johnson', '2025-01-23', 'before_market', 4, 'scheduled', true),
('PFE', 'Pfizer Inc.', '2025-01-28', 'before_market', 4, 'scheduled', true),

-- Energy
('XOM', 'Exxon Mobil Corp.', '2025-01-31', 'before_market', 4, 'scheduled', true),
('CVX', 'Chevron Corporation', '2025-01-25', 'before_market', 4, 'scheduled', true),

-- Consumer
('WMT', 'Walmart Inc.', '2025-01-21', 'before_market', 4, 'scheduled', true),
('PG', 'Procter & Gamble Co.', '2025-01-22', 'before_market', 4, 'scheduled', true),
('KO', 'Coca-Cola Company', '2025-01-14', 'before_market', 3, 'scheduled', true),

-- Semiconductors
('NVDA', 'NVIDIA Corporation', '2025-01-22', 'after_market', 5, 'scheduled', true),
('TSM', 'Taiwan Semiconductor', '2025-01-16', 'before_market', 4, 'scheduled', true),
('INTC', 'Intel Corporation', '2025-01-23', 'after_market', 4, 'scheduled', true),

-- Streaming & Entertainment
('NFLX', 'Netflix Inc.', '2025-01-21', 'after_market', 4, 'scheduled', true),
('DIS', 'Walt Disney Company', '2025-01-29', 'after_market', 4, 'scheduled', true),

-- Automotive
('TSLA', 'Tesla Inc.', '2025-01-29', 'after_market', 5, 'scheduled', true),
('F', 'Ford Motor Company', '2025-01-27', 'after_market', 3, 'scheduled', true),
('GM', 'General Motors Company', '2025-01-28', 'before_market', 3, 'scheduled', true)
ON CONFLICT (symbol, earnings_date) DO NOTHING;

-- Verify the data
SELECT COUNT(*) as total_count FROM earnings_calendar;

SELECT symbol, company_name, earnings_date, time_of_day, importance_rating 
FROM earnings_calendar 
WHERE earnings_date >= '2025-01-01' AND earnings_date <= '2025-01-31'
ORDER BY earnings_date, importance_rating DESC;