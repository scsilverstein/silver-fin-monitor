-- Create the earnings calendar view
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

-- Check if data exists
SELECT COUNT(*) as total_count FROM earnings_calendar;

-- Check January 2025 data
SELECT symbol, company_name, earnings_date, time_of_day, importance_rating 
FROM earnings_calendar 
WHERE earnings_date >= '2025-01-01' AND earnings_date <= '2025-01-31'
ORDER BY earnings_date, importance_rating DESC
LIMIT 10;
EOF < /dev/null