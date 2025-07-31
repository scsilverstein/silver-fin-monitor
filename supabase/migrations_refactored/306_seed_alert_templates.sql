-- Seed alert templates
-- Pre-configured alert templates for common market scenarios

-- Insert price movement alert templates
INSERT INTO alert_templates (name, alert_type, description, conditions, message_template, default_config) VALUES
-- Stock Price Alerts
('Price Breakout Alert', 'price_breakout', 'Alert when stock breaks above resistance or below support',
 jsonb_build_object(
   'price_type', 'close',
   'direction', 'above',
   'threshold_type', 'resistance_level',
   'confirmation_bars', 1
 ),
 'ALERT: {{symbol}} has broken {{direction}} {{threshold_type}} at ${{current_price}} ({{change_percent}}%)',
 jsonb_build_object(
   'enabled', true,
   'priority', 'high',
   'channels', ARRAY['email', 'push'],
   'cooldown_minutes', 60
 )),

('Large Price Movement', 'price_change', 'Alert for significant intraday price movements',
 jsonb_build_object(
   'change_threshold', 5.0,
   'time_period', '1d',
   'direction', 'both',
   'volume_confirmation', true
 ),
 'ALERT: {{symbol}} is {{direction}} {{change_percent}}% to ${{current_price}} with {{volume_ratio}}x average volume',
 jsonb_build_object(
   'enabled', true,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 30
 )),

('Gap Up/Down Alert', 'gap_alert', 'Alert for significant gaps at market open',
 jsonb_build_object(
   'gap_threshold', 3.0,
   'direction', 'both',
   'market_open_only', true
 ),
 'ALERT: {{symbol}} gapped {{direction}} {{gap_percent}}% at open to ${{current_price}}',
 jsonb_build_object(
   'enabled', true,
   'priority', 'high',
   'channels', ARRAY['email', 'push'],
   'cooldown_minutes', 1440
 )),

-- Volume Alerts
('Unusual Volume Alert', 'volume_spike', 'Alert for unusual trading volume',
 jsonb_build_object(
   'volume_multiplier', 3.0,
   'comparison_period', '20d',
   'minimum_volume', 100000
 ),
 'ALERT: {{symbol}} trading {{volume_ratio}}x average volume ({{current_volume}} vs {{avg_volume}})',
 jsonb_build_object(
   'enabled', true,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 120
 )),

-- Technical Indicator Alerts
('RSI Overbought/Oversold', 'rsi_alert', 'Alert when RSI reaches extreme levels',
 jsonb_build_object(
   'overbought_threshold', 80,
   'oversold_threshold', 20,
   'rsi_period', 14
 ),
 'ALERT: {{symbol}} RSI is {{condition}} at {{rsi_value}} - potential {{signal}}',
 jsonb_build_object(
   'enabled', true,
   'priority', 'low',
   'channels', ARRAY['email'],
   'cooldown_minutes', 240
 )),

('Moving Average Crossover', 'ma_crossover', 'Alert for moving average crossovers',
 jsonb_build_object(
   'fast_period', 50,
   'slow_period', 200,
   'crossover_type', 'both'
 ),
 'ALERT: {{symbol}} {{fast_ma}}-day MA crossed {{direction}} {{slow_ma}}-day MA - {{signal}} signal',
 jsonb_build_object(
   'enabled', true,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 1440
 )),

-- Earnings and Events
('Earnings Announcement', 'earnings_alert', 'Alert for upcoming earnings announcements',
 jsonb_build_object(
   'days_before', 3,
   'importance_level', 'high',
   'include_estimates', true
 ),
 'ALERT: {{symbol}} earnings announcement in {{days}} days. Est EPS: ${{estimated_eps}}',
 jsonb_build_object(
   'enabled', true,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 1440
 )),

('Dividend Ex-Date', 'dividend_alert', 'Alert for upcoming dividend ex-dates',
 jsonb_build_object(
   'days_before', 2,
   'minimum_yield', 2.0
 ),
 'ALERT: {{symbol}} goes ex-dividend in {{days}} days. Dividend: ${{dividend_amount}} ({{yield}}%)',
 jsonb_build_object(
   'enabled', true,
   'priority', 'low',
   'channels', ARRAY['email'],
   'cooldown_minutes', 1440
 )),

-- Analyst and Rating Alerts
('Analyst Rating Change', 'rating_change', 'Alert for analyst rating changes',
 jsonb_build_object(
   'rating_types', ARRAY['upgrade', 'downgrade'],
   'minimum_firms', 1,
   'significant_only', true
 ),
 'ALERT: {{symbol}} {{rating_change}} by {{analyst_firm}} from {{old_rating}} to {{new_rating}}',
 jsonb_build_object(
   'enabled', true,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 60
 )),

('Price Target Change', 'price_target', 'Alert for significant price target changes',
 jsonb_build_object(
   'change_threshold', 10.0,
   'direction', 'both',
   'tier1_analysts_only', false
 ),
 'ALERT: {{symbol}} price target {{direction}} {{change_percent}}% to ${{new_target}} by {{analyst_firm}}',
 jsonb_build_object(
   'enabled', true,
   'priority', 'low',
   'channels', ARRAY['email'],
   'cooldown_minutes', 120
 )),

-- Market-wide Alerts
('Market Volatility Spike', 'vix_alert', 'Alert for significant VIX movements',
 jsonb_build_object(
   'vix_level', 30,
   'change_threshold', 20.0,
   'direction', 'above'
 ),
 'ALERT: Market volatility spike - VIX at {{vix_level}} ({{change_percent}}% change)',
 jsonb_build_object(
   'enabled', true,
   'priority', 'high',
   'channels', ARRAY['email', 'push'],
   'cooldown_minutes', 30
 )),

('Sector Rotation Alert', 'sector_rotation', 'Alert for significant sector performance divergence',
 jsonb_build_object(
   'performance_threshold', 3.0,
   'comparison_period', '1d',
   'min_sector_count', 2
 ),
 'ALERT: Sector rotation detected - {{outperforming_sectors}} outperforming {{underperforming_sectors}}',
 jsonb_build_object(
   'enabled', true,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 240
 )),

-- Options Flow Alerts
('Unusual Options Activity', 'options_flow', 'Alert for unusual options trading activity',
 jsonb_build_object(
   'volume_threshold', 1000,
   'oi_ratio_threshold', 2.0,
   'expiration_range', '30d'
 ),
 'ALERT: Unusual options activity in {{symbol}} - {{volume}} contracts, {{call_put_ratio}} C/P ratio',
 jsonb_build_object(
   'enabled', false,
   'priority', 'medium',
   'channels', ARRAY['email'],
   'cooldown_minutes', 60
 )),

-- News and Sentiment Alerts
('News Sentiment Alert', 'news_sentiment', 'Alert for significant sentiment changes',
 jsonb_build_object(
   'sentiment_threshold', 0.5,
   'direction', 'both',
   'news_count_min', 3
 ),
 'ALERT: {{symbol}} news sentiment {{direction}} to {{sentiment_score}} based on {{news_count}} articles',
 jsonb_build_object(
   'enabled', true,
   'priority', 'low',
   'channels', ARRAY['email'],
   'cooldown_minutes', 360
 )),

-- Economic Indicator Alerts
('Economic Data Release', 'economic_data', 'Alert for important economic data releases',
 jsonb_build_object(
   'indicators', ARRAY['CPI', 'GDP', 'NFP', 'FOMC'],
   'surprise_threshold', 0.2,
   'importance_level', 'high'
 ),
 'ALERT: {{indicator}} released - {{actual}} vs {{expected}} ({{surprise}}% surprise)',
 jsonb_build_object(
   'enabled', true,
   'priority', 'high',
   'channels', ARRAY['email', 'push'],
   'cooldown_minutes', 1440
 ))

ON CONFLICT (name) DO UPDATE SET
    alert_type = EXCLUDED.alert_type,
    description = EXCLUDED.description,
    conditions = EXCLUDED.conditions,
    message_template = EXCLUDED.message_template,
    default_config = EXCLUDED.default_config,
    updated_at = NOW();

-- Insert watchlist templates for common investment strategies
INSERT INTO watchlist_templates (name, description, criteria, default_symbols) VALUES
('Large Cap Growth', 'Large capitalization growth stocks',
 jsonb_build_object(
   'market_cap_min', 10000000000,
   'growth_rate_min', 15.0,
   'sectors', ARRAY['Technology', 'Consumer Discretionary', 'Communication Services']
 ),
 ARRAY['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']),

('Dividend Aristocrats', 'Stocks with consistent dividend growth',
 jsonb_build_object(
   'dividend_yield_min', 2.0,
   'dividend_growth_years', 25,
   'sectors', ARRAY['Consumer Staples', 'Utilities', 'Industrials']
 ),
 ARRAY['JNJ', 'PG', 'KO', 'WMT', 'MCD', 'MMM', 'CAT']),

('High Beta Momentum', 'High volatility momentum plays',
 jsonb_build_object(
   'beta_min', 1.5,
   'momentum_score_min', 0.7,
   'volume_requirement', 1000000
 ),
 ARRAY['TSLA', 'NVDA', 'AMD', 'ARKK', 'SOXL', 'TQQQ']),

('Value Stocks', 'Undervalued quality companies',
 jsonb_build_object(
   'pe_ratio_max', 15.0,
   'pb_ratio_max', 2.0,
   'debt_to_equity_max', 0.5
 ),
 ARRAY['BRK.B', 'JPM', 'BAC', 'WFC', 'VZ', 'T', 'XOM']),

('Tech Disruptors', 'Emerging technology and disruptive companies',
 jsonb_build_object(
   'sectors', ARRAY['Technology', 'Communication Services'],
   'revenue_growth_min', 20.0,
   'market_cap_range', ARRAY[1000000000, 100000000000]
 ),
 ARRAY['CRM', 'SNOW', 'PLTR', 'SQ', 'ROKU', 'ZOOM', 'DDOG']),

('Energy Transition', 'Clean energy and transition stocks',
 jsonb_build_object(
   'sectors', ARRAY['Utilities', 'Industrials', 'Technology'],
   'themes', ARRAY['renewable_energy', 'electric_vehicles', 'energy_storage']
 ),
 ARRAY['NEE', 'TSLA', 'ENPH', 'SEDG', 'PLUG', 'BE', 'ICLN'])

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    criteria = EXCLUDED.criteria,
    default_symbols = EXCLUDED.default_symbols,
    updated_at = NOW();

-- Add comments
COMMENT ON TABLE alert_templates IS 'Pre-configured alert templates for common market monitoring scenarios';
COMMENT ON TABLE watchlist_templates IS 'Template watchlists for different investment strategies and themes';