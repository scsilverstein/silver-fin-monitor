-- Seed market calendar and events
-- Important market events, earnings dates, and economic calendar

-- Insert major market holidays for 2024-2025
INSERT INTO market_calendar (event_date, event_type, title, description, market_impact, affected_markets) VALUES
-- 2024 Market Holidays
('2024-01-01', 'market_holiday', 'New Year''s Day', 'US markets closed for New Year''s Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-01-15', 'market_holiday', 'Martin Luther King Jr. Day', 'US markets closed for MLK Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-02-19', 'market_holiday', 'Presidents'' Day', 'US markets closed for Presidents'' Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-03-29', 'market_holiday', 'Good Friday', 'US markets closed for Good Friday', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-05-27', 'market_holiday', 'Memorial Day', 'US markets closed for Memorial Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-06-19', 'market_holiday', 'Juneteenth', 'US markets closed for Juneteenth National Independence Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-07-04', 'market_holiday', 'Independence Day', 'US markets closed for Independence Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-09-02', 'market_holiday', 'Labor Day', 'US markets closed for Labor Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-11-28', 'market_holiday', 'Thanksgiving Day', 'US markets closed for Thanksgiving', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2024-11-29', 'market_holiday', 'Day after Thanksgiving', 'US markets close early at 1:00 PM ET', 'early_close', ARRAY['NYSE', 'NASDAQ']),
('2024-12-25', 'market_holiday', 'Christmas Day', 'US markets closed for Christmas', 'market_closed', ARRAY['NYSE', 'NASDAQ']),

-- 2025 Market Holidays  
('2025-01-01', 'market_holiday', 'New Year''s Day', 'US markets closed for New Year''s Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-01-20', 'market_holiday', 'Martin Luther King Jr. Day', 'US markets closed for MLK Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-02-17', 'market_holiday', 'Presidents'' Day', 'US markets closed for Presidents'' Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-04-18', 'market_holiday', 'Good Friday', 'US markets closed for Good Friday', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-05-26', 'market_holiday', 'Memorial Day', 'US markets closed for Memorial Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-06-19', 'market_holiday', 'Juneteenth', 'US markets closed for Juneteenth National Independence Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-07-04', 'market_holiday', 'Independence Day', 'US markets closed for Independence Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-09-01', 'market_holiday', 'Labor Day', 'US markets closed for Labor Day', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-11-27', 'market_holiday', 'Thanksgiving Day', 'US markets closed for Thanksgiving', 'market_closed', ARRAY['NYSE', 'NASDAQ']),
('2025-11-28', 'market_holiday', 'Day after Thanksgiving', 'US markets close early at 1:00 PM ET', 'early_close', ARRAY['NYSE', 'NASDAQ']),
('2025-12-25', 'market_holiday', 'Christmas Day', 'US markets closed for Christmas', 'market_closed', ARRAY['NYSE', 'NASDAQ'])

ON CONFLICT (event_date, event_type, title) DO UPDATE SET
    description = EXCLUDED.description,
    market_impact = EXCLUDED.market_impact,
    affected_markets = EXCLUDED.affected_markets,
    updated_at = NOW();

-- Insert major economic events and data releases
INSERT INTO market_calendar (event_date, event_type, title, description, market_impact, metadata) VALUES
-- Federal Reserve Meetings (typical schedule)
('2024-03-20', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high', 
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),
('2024-05-01', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high',
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),
('2024-06-12', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high',
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),
('2024-07-31', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high',
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),
('2024-09-18', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high',
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),
('2024-11-07', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high',
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),
('2024-12-18', 'fomc_meeting', 'FOMC Meeting', 'Federal Open Market Committee Meeting', 'high',
 jsonb_build_object('institution', 'Federal Reserve', 'type', 'monetary_policy', 'press_conference', true)),

-- Key Economic Data Releases (recurring monthly/quarterly)
('2024-03-12', 'economic_data', 'CPI Release', 'Consumer Price Index for February', 'high',
 jsonb_build_object('indicator', 'CPI', 'frequency', 'monthly', 'agency', 'Bureau of Labor Statistics')),
('2024-04-03', 'economic_data', 'Employment Report', 'Non-farm Payrolls and Unemployment Rate', 'high',
 jsonb_build_object('indicator', 'NFP', 'frequency', 'monthly', 'agency', 'Bureau of Labor Statistics')),
('2024-04-25', 'economic_data', 'GDP Release', 'Gross Domestic Product Q1 2024 Preliminary', 'high',
 jsonb_build_object('indicator', 'GDP', 'frequency', 'quarterly', 'agency', 'Bureau of Economic Analysis')),

-- Earnings Season Dates (approximate)
('2024-04-10', 'earnings_season', 'Q1 2024 Earnings Season Begins', 'Major companies begin reporting Q1 2024 earnings', 'medium',
 jsonb_build_object('quarter', 'Q1', 'year', 2024, 'phase', 'start')),
('2024-07-10', 'earnings_season', 'Q2 2024 Earnings Season Begins', 'Major companies begin reporting Q2 2024 earnings', 'medium',
 jsonb_build_object('quarter', 'Q2', 'year', 2024, 'phase', 'start')),
('2024-10-10', 'earnings_season', 'Q3 2024 Earnings Season Begins', 'Major companies begin reporting Q3 2024 earnings', 'medium',
 jsonb_build_object('quarter', 'Q3', 'year', 2024, 'phase', 'start')),
('2025-01-10', 'earnings_season', 'Q4 2024 Earnings Season Begins', 'Major companies begin reporting Q4 2024 earnings', 'medium',
 jsonb_build_object('quarter', 'Q4', 'year', 2024, 'phase', 'start'))

ON CONFLICT (event_date, event_type, title) DO UPDATE SET
    description = EXCLUDED.description,
    market_impact = EXCLUDED.market_impact,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert specific earnings dates for major companies (sample data)
INSERT INTO earnings_calendar (symbol, company_name, earnings_date, fiscal_quarter, fiscal_year, estimated_eps, metadata) VALUES
-- Technology Sector Q1 2024
('AAPL', 'Apple Inc.', '2024-05-02', 'Q2', 2024, 1.53, 
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', true, 'importance', 'high')),
('MSFT', 'Microsoft Corporation', '2024-04-24', 'Q3', 2024, 2.83,
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', true, 'importance', 'high')),
('GOOGL', 'Alphabet Inc.', '2024-04-25', 'Q1', 2024, 1.23,
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', false, 'importance', 'high')),
('AMZN', 'Amazon.com Inc.', '2024-04-30', 'Q1', 2024, 0.83,
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', true, 'importance', 'high')),
('NVDA', 'NVIDIA Corporation', '2024-05-22', 'Q1', 2025, 5.65,
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', true, 'importance', 'high')),
('META', 'Meta Platforms Inc.', '2024-04-24', 'Q1', 2024, 4.71,
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', true, 'importance', 'high')),
('TSLA', 'Tesla Inc.', '2024-04-23', 'Q1', 2024, 0.51,
 jsonb_build_object('report_time', 'after_close', 'guidance_expected', true, 'importance', 'high')),

-- Financial Sector
('JPM', 'JPMorgan Chase & Co.', '2024-04-12', 'Q1', 2024, 4.11,
 jsonb_build_object('report_time', 'before_open', 'guidance_expected', false, 'importance', 'high')),
('BAC', 'Bank of America Corp.', '2024-04-15', 'Q1', 2024, 0.76,
 jsonb_build_object('report_time', 'before_open', 'guidance_expected', false, 'importance', 'medium')),
('WFC', 'Wells Fargo & Company', '2024-04-12', 'Q1', 2024, 1.26,
 jsonb_build_object('report_time', 'before_open', 'guidance_expected', false, 'importance', 'medium')),

-- Healthcare Sector
('JNJ', 'Johnson & Johnson', '2024-04-16', 'Q1', 2024, 2.67,
 jsonb_build_object('report_time', 'before_open', 'guidance_expected', true, 'importance', 'medium')),
('PFE', 'Pfizer Inc.', '2024-05-01', 'Q1', 2024, 0.55,
 jsonb_build_object('report_time', 'before_open', 'guidance_expected', true, 'importance', 'medium')),
('UNH', 'UnitedHealth Group Inc.', '2024-04-16', 'Q1', 2024, 6.61,
 jsonb_build_object('report_time', 'before_open', 'guidance_expected', true, 'importance', 'high'))

ON CONFLICT (symbol, earnings_date, fiscal_quarter, fiscal_year) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    estimated_eps = EXCLUDED.estimated_eps,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert dividend calendar data
INSERT INTO dividend_calendar (symbol, company_name, ex_date, pay_date, dividend_amount, dividend_type, metadata) VALUES
-- Quarterly Dividends
('AAPL', 'Apple Inc.', '2024-05-10', '2024-05-16', 0.24, 'quarterly',
 jsonb_build_object('yield_estimate', 0.50, 'growth_rate', 4.3)),
('MSFT', 'Microsoft Corporation', '2024-05-15', '2024-06-13', 0.75, 'quarterly',
 jsonb_build_object('yield_estimate', 0.72, 'growth_rate', 9.65)),
('JNJ', 'Johnson & Johnson', '2024-05-21', '2024-06-11', 1.19, 'quarterly',
 jsonb_build_object('yield_estimate', 2.92, 'growth_rate', 5.8)),
('PG', 'Procter & Gamble Co.', '2024-04-19', '2024-05-15', 0.9133, 'quarterly',
 jsonb_build_object('yield_estimate', 2.35, 'growth_rate', 3.1)),
('KO', 'Coca-Cola Company', '2024-06-14', '2024-07-01', 0.485, 'quarterly',
 jsonb_build_object('yield_estimate', 3.07, 'growth_rate', 2.8)),

-- Monthly Dividends (REITs)
('O', 'Realty Income Corporation', '2024-04-30', '2024-05-15', 0.263, 'monthly',
 jsonb_build_object('yield_estimate', 5.45, 'reit_type', 'retail')),

-- Special Dividends
('MSFT', 'Microsoft Corporation', '2024-09-18', '2024-12-12', 3.00, 'special',
 jsonb_build_object('type', 'special_distribution', 'reason', 'cash_return'))

ON CONFLICT (symbol, ex_date, dividend_type) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    pay_date = EXCLUDED.pay_date,
    dividend_amount = EXCLUDED.dividend_amount,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Insert options expiration dates
INSERT INTO options_calendar (expiration_date, expiration_type, description, affected_symbols) VALUES
-- Weekly Options Expirations (every Friday)
('2024-04-05', 'weekly', 'Weekly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA']),
('2024-04-12', 'weekly', 'Weekly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA']),
('2024-04-19', 'weekly', 'Weekly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA']),
('2024-04-26', 'weekly', 'Weekly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA']),

-- Monthly Options Expirations (third Friday of each month)
('2024-04-19', 'monthly', 'Monthly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'VIX']),
('2024-05-17', 'monthly', 'Monthly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'VIX']),
('2024-06-21', 'monthly', 'Monthly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'VIX']),
('2024-07-19', 'monthly', 'Monthly options expiration', ARRAY['SPY', 'QQQ', 'IWM', 'VIX']),

-- Quarterly Options Expirations (LEAPS)
('2024-06-21', 'quarterly', 'Quarterly options expiration (LEAPS)', ARRAY['SPY', 'QQQ', 'IWM']),
('2024-09-20', 'quarterly', 'Quarterly options expiration (LEAPS)', ARRAY['SPY', 'QQQ', 'IWM']),
('2024-12-20', 'quarterly', 'Quarterly options expiration (LEAPS)', ARRAY['SPY', 'QQQ', 'IWM']),

-- Index Rebalancing Dates
('2024-06-21', 'index_rebalance', 'Russell Index Rebalancing', ARRAY['IWM', 'IWD', 'IWF']),
('2024-09-20', 'index_rebalance', 'S&P Index Quarterly Rebalancing', ARRAY['SPY', 'SPYG', 'SPYV'])

ON CONFLICT (expiration_date, expiration_type) DO UPDATE SET
    description = EXCLUDED.description,
    affected_symbols = EXCLUDED.affected_symbols,
    updated_at = NOW();

-- Add table comments
COMMENT ON TABLE market_calendar IS 'Calendar of market holidays, economic events, and important dates';
COMMENT ON TABLE earnings_calendar IS 'Scheduled earnings announcements for publicly traded companies';
COMMENT ON TABLE dividend_calendar IS 'Dividend payment schedule and ex-dividend dates';
COMMENT ON TABLE options_calendar IS 'Options expiration dates and related derivatives events';