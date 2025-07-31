-- Seed sample data for development and testing
-- Representative data samples for various tables

-- Insert sample processed content
INSERT INTO processed_content (raw_feed_id, processed_text, key_topics, sentiment_score, entities, summary, processing_metadata) VALUES
-- Sample from financial news
((SELECT id FROM raw_feeds LIMIT 1),
 'The Federal Reserve''s latest meeting minutes revealed concerns about persistent inflation despite recent rate hikes. Committee members expressed cautious optimism about economic resilience but emphasized the need for continued vigilance. Market participants are closely watching upcoming employment data for signals about future monetary policy direction.',
 ARRAY['Federal Reserve', 'inflation', 'interest rates', 'employment', 'monetary policy'],
 -0.2,
 jsonb_build_object(
   'organizations', ARRAY['Federal Reserve'],
   'topics', ARRAY['monetary policy', 'inflation', 'employment'],
   'sentiment_keywords', ARRAY['concerns', 'cautious', 'vigilance']
 ),
 'Fed minutes show continued concern about inflation with focus on upcoming employment data for policy guidance.',
 jsonb_build_object(
   'processing_time_ms', 2847,
   'confidence_score', 0.87,
   'model_version', 'gpt-4-turbo',
   'extracted_entities_count', 5
 )),

-- Sample from tech news
((SELECT id FROM raw_feeds LIMIT 1),
 'Apple''s latest quarterly earnings exceeded analyst expectations, driven by strong iPhone sales and robust services revenue growth. The company announced plans for significant AI integration across its product ecosystem, signaling a strategic shift toward artificial intelligence capabilities. Investors responded positively to the forward-looking guidance.',
 ARRAY['Apple', 'earnings', 'iPhone', 'AI integration', 'services revenue'],
 0.6,
 jsonb_build_object(
   'companies', ARRAY['Apple Inc.'],
   'topics', ARRAY['earnings', 'artificial intelligence', 'product development'],
   'financial_metrics', ARRAY['revenue growth', 'analyst expectations']
 ),
 'Apple beats earnings with strong iPhone sales and announces major AI integration plans.',
 jsonb_build_object(
   'processing_time_ms', 1923,
   'confidence_score', 0.92,
   'model_version', 'gpt-4-turbo',
   'extracted_entities_count', 8
 ))

ON CONFLICT DO NOTHING;

-- Insert sample daily analysis
INSERT INTO daily_analysis (analysis_date, market_sentiment, key_themes, overall_summary, ai_analysis, confidence_score, sources_analyzed) VALUES
('2024-01-15', 'cautiously_optimistic',
 ARRAY['Fed policy uncertainty', 'Tech earnings season', 'Inflation concerns', 'Economic resilience'],
 'Markets showed mixed signals today as investors balanced positive corporate earnings against ongoing concerns about Federal Reserve policy direction. Technology stocks led gains on strong quarterly results, while financial stocks faced pressure from interest rate uncertainty. Overall market sentiment remains cautiously optimistic with focus on upcoming economic data releases.',
 jsonb_build_object(
   'key_drivers', ARRAY['earnings beats', 'Fed policy speculation', 'sector rotation'],
   'risk_factors', ARRAY['interest rate uncertainty', 'geopolitical tensions'],
   'opportunities', ARRAY['oversold quality stocks', 'dividend plays'],
   'outlook', 'neutral to positive with selective opportunities'
 ),
 0.73,
 47),

('2024-01-16', 'bearish',
 ARRAY['Market volatility', 'Economic data concerns', 'Sector rotation', 'Risk-off sentiment'],
 'Broad market decline as disappointing economic data sparked concerns about growth trajectory. Technology and growth stocks particularly affected as investors rotated into defensive sectors. Volume patterns suggest institutional selling with flight to quality assets including bonds and utilities.',
 jsonb_build_object(
   'key_drivers', ARRAY['weak economic data', 'growth concerns', 'institutional selling'],
   'risk_factors', ARRAY['recession fears', 'earnings downgrades', 'liquidity concerns'],
   'opportunities', ARRAY['defensive stocks', 'quality bonds', 'cash positions'],
   'outlook', 'near-term bearish with focus on risk management'
 ),
 0.81,
 52)

ON CONFLICT (analysis_date) DO UPDATE SET
    market_sentiment = EXCLUDED.market_sentiment,
    key_themes = EXCLUDED.key_themes,
    overall_summary = EXCLUDED.overall_summary,
    ai_analysis = EXCLUDED.ai_analysis,
    confidence_score = EXCLUDED.confidence_score,
    sources_analyzed = EXCLUDED.sources_analyzed,
    updated_at = NOW();

-- Insert sample predictions
INSERT INTO predictions (daily_analysis_id, prediction_type, time_horizon, confidence_level, prediction_text, prediction_data) VALUES
((SELECT id FROM daily_analysis WHERE analysis_date = '2024-01-15'),
 'market_direction', '1_week',
 0.67,
 'Market likely to trend higher over next week as earnings momentum overcomes Fed uncertainty. Expect 2-4% upside with technology and healthcare leading gains.',
 jsonb_build_object(
   'target_level', 2150,
   'probability_up', 0.67,
   'key_catalysts', ARRAY['positive earnings', 'dovish Fed signals'],
   'risk_factors', ARRAY['geopolitical events', 'disappointing data']
 )),

((SELECT id FROM daily_analysis WHERE analysis_date = '2024-01-15'),
 'sector_performance', '1_month',
 0.74,
 'Technology sector expected to outperform broader market by 5-8% over next month driven by AI investment theme and strong fundamentals.',
 jsonb_build_object(
   'sector', 'Technology',
   'expected_outperformance', 6.5,
   'key_drivers', ARRAY['AI adoption', 'earnings growth', 'innovation cycle'],
   'top_picks', ARRAY['NVDA', 'MSFT', 'GOOGL']
 )),

((SELECT id FROM daily_analysis WHERE analysis_date = '2024-01-16'),
 'market_direction', '2_weeks',
 0.71,
 'Near-term market correction likely to continue with 5-10% additional downside before stabilization. Focus on quality defensive names and cash preservation.',
 jsonb_build_object(
   'target_level', 1950,
   'probability_down', 0.71,
   'correction_depth', 8.5,
   'defensive_plays', ARRAY['utilities', 'consumer staples', 'quality bonds']
 ))

ON CONFLICT DO NOTHING;

-- Insert sample stock data for major symbols
INSERT INTO stock_data (symbol, date, open, high, low, close, volume, change_percent) VALUES
('AAPL', '2024-01-15', 185.50, 188.25, 184.75, 187.50, 45623400, 1.85),
('AAPL', '2024-01-16', 187.25, 188.90, 182.30, 183.75, 62847300, -2.00),
('MSFT', '2024-01-15', 378.25, 382.45, 376.80, 381.90, 25847200, 2.15),
('MSFT', '2024-01-16', 381.50, 383.20, 375.60, 377.25, 31456700, -1.22),
('GOOGL', '2024-01-15', 142.80, 145.30, 142.15, 144.75, 18523600, 1.95),
('GOOGL', '2024-01-16', 144.25, 145.80, 140.90, 141.60, 22847100, -2.18),
('AMZN', '2024-01-15', 152.30, 155.40, 151.80, 154.25, 35246800, 2.45),
('AMZN', '2024-01-16', 153.90, 154.70, 148.25, 149.80, 48365200, -2.88),
('NVDA', '2024-01-15', 520.40, 535.80, 518.90, 532.45, 42856300, 4.25),
('NVDA', '2024-01-16', 531.20, 534.60, 512.70, 518.30, 58947600, -2.66),
('TSLA', '2024-01-15', 238.70, 245.80, 236.50, 243.20, 67485300, 3.15),
('TSLA', '2024-01-16', 242.80, 244.90, 232.40, 235.60, 84562700, -3.12),
-- ETFs
('SPY', '2024-01-15', 475.20, 478.60, 474.85, 477.35, 62847500, 1.45),
('SPY', '2024-01-16', 476.80, 478.20, 468.90, 470.25, 95847200, -1.49),
('QQQ', '2024-01-15', 405.80, 410.25, 404.60, 408.90, 48562300, 2.10),
('QQQ', '2024-01-16', 408.30, 409.70, 398.40, 401.75, 67485600, -1.75)

ON CONFLICT (symbol, date) DO UPDATE SET
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume,
    change_percent = EXCLUDED.change_percent,
    updated_at = NOW();

-- Insert sample technical indicators
INSERT INTO technical_indicators (symbol, date, indicator_type, timeframe, values) VALUES
('AAPL', '2024-01-15', 'RSI', 'daily', jsonb_build_object('rsi', 58.4, 'signal', 'neutral')),
('AAPL', '2024-01-15', 'MACD', 'daily', jsonb_build_object('macd', 2.34, 'signal', 1.87, 'histogram', 0.47)),
('AAPL', '2024-01-15', 'BB', 'daily', jsonb_build_object('upper_band', 192.45, 'middle_band', 187.20, 'lower_band', 181.95)),
('MSFT', '2024-01-15', 'RSI', 'daily', jsonb_build_object('rsi', 62.8, 'signal', 'bullish')),
('MSFT', '2024-01-15', 'MACD', 'daily', jsonb_build_object('macd', 8.45, 'signal', 6.23, 'histogram', 2.22)),
('GOOGL', '2024-01-15', 'RSI', 'daily', jsonb_build_object('rsi', 55.2, 'signal', 'neutral')),
('SPY', '2024-01-15', 'RSI', 'daily', jsonb_build_object('rsi', 54.7, 'signal', 'neutral')),
('SPY', '2024-01-15', 'VIX', 'daily', jsonb_build_object('vix_level', 16.8, 'signal', 'low_volatility'))

ON CONFLICT DO NOTHING;

-- Insert sample sentiment analysis
INSERT INTO sentiment_analysis (entity_id, analysis_date, overall_sentiment, confidence_score, sentiment_breakdown, source_count) VALUES
((SELECT id FROM entities WHERE symbol = 'AAPL' AND entity_type = 'stock'),
 '2024-01-15', 0.35,
 0.78,
 jsonb_build_object(
   'positive', 0.45,
   'neutral', 0.40,
   'negative', 0.15,
   'key_themes', ARRAY['strong earnings', 'AI integration', 'iPhone demand']
 ),
 23),

((SELECT id FROM entities WHERE symbol = 'TSLA' AND entity_type = 'stock'),
 '2024-01-15', -0.12,
 0.82,
 jsonb_build_object(
   'positive', 0.28,
   'neutral', 0.32,
   'negative', 0.40,
   'key_themes', ARRAY['production concerns', 'competition', 'valuation questions']
 ),
 18),

((SELECT id FROM entities WHERE symbol = 'NVDA' AND entity_type = 'stock'),
 '2024-01-15', 0.67,
 0.89,
 jsonb_build_object(
   'positive', 0.72,
   'neutral', 0.18,
   'negative', 0.10,
   'key_themes', ARRAY['AI leadership', 'data center growth', 'strong guidance']
 ),
 31)

ON CONFLICT DO NOTHING;

-- Insert sample news items
INSERT INTO news_items (title, content, source, published_at, sentiment_score, importance, symbols, category) VALUES
('Federal Reserve Signals Cautious Approach to Rate Cuts',
 'Federal Reserve officials indicated a measured approach to future interest rate adjustments, citing ongoing inflation concerns and labor market strength. The central bank emphasized data-dependent decision making for upcoming meetings.',
 'Reuters', NOW() - INTERVAL '2 hours',
 -0.15, 8,
 ARRAY['SPY', 'QQQ', 'IWM'],
 'monetary_policy'),

('Apple Reports Strong Q4 Earnings Beat',
 'Apple Inc. reported quarterly earnings that exceeded Wall Street expectations, driven by robust iPhone sales and growing services revenue. The company provided optimistic guidance for the upcoming holiday quarter.',
 'Bloomberg', NOW() - INTERVAL '4 hours',
 0.72, 9,
 ARRAY['AAPL'],
 'earnings'),

('Technology Sector Leads Market Gains',
 'Major technology stocks rallied in morning trading as investors rotated into growth names following positive earnings reports. Semiconductor and software companies showed particular strength.',
 'CNBC', NOW() - INTERVAL '1 hour',
 0.55, 6,
 ARRAY['QQQ', 'XLK', 'NVDA', 'MSFT'],
 'sector_analysis'),

('Oil Prices Surge on Supply Concerns',
 'Crude oil futures jumped 3.2% amid concerns about potential supply disruptions and stronger than expected demand data. Energy stocks rallied in sympathy with rising commodity prices.',
 'MarketWatch', NOW() - INTERVAL '3 hours',
 0.41, 7,
 ARRAY['XLE', 'XOM', 'CVX'],
 'commodities')

ON CONFLICT DO NOTHING;

-- Insert sample scanner results
INSERT INTO scanner_results (scanner_type, scan_date, symbol, score, signal_strength, metrics) VALUES
('momentum', CURRENT_DATE, 'NVDA', 87.5, 'strong',
 jsonb_build_object(
   'price_momentum', 8.7,
   'volume_confirmation', 9.2,
   'technical_score', 8.5,
   'earnings_momentum', 9.0
 )),

('momentum', CURRENT_DATE, 'AAPL', 73.2, 'moderate',
 jsonb_build_object(
   'price_momentum', 7.1,
   'volume_confirmation', 6.8,
   'technical_score', 7.5,
   'earnings_momentum', 8.2
 )),

('value', CURRENT_DATE, 'JPM', 81.3, 'strong',
 jsonb_build_object(
   'pe_ratio', 8.9,
   'pb_ratio', 7.8,
   'div_yield', 8.5,
   'quality_score', 8.7
 )),

('technical', CURRENT_DATE, 'MSFT', 78.6, 'moderate',
 jsonb_build_object(
   'rsi_score', 7.2,
   'macd_score', 8.1,
   'trend_score', 7.9,
   'support_resistance', 8.0
 ))

ON CONFLICT DO NOTHING;

-- Insert sample alerts for testing
INSERT INTO alerts (user_id, alert_type, title, description, conditions, status, is_active) VALUES
((SELECT id FROM users LIMIT 1),
 'price_breakout', 'AAPL Resistance Break',
 'Alert when AAPL breaks above $190 resistance level',
 jsonb_build_object(
   'symbol', 'AAPL',
   'trigger_price', 190.00,
   'direction', 'above'
 ),
 'pending', true),

((SELECT id FROM users LIMIT 1),
 'volume_spike', 'TSLA Volume Alert',
 'Alert for unusual volume in TSLA',
 jsonb_build_object(
   'symbol', 'TSLA',
   'volume_multiplier', 2.0
 ),
 'pending', true),

((SELECT id FROM users LIMIT 1),
 'earnings_alert', 'MSFT Earnings Reminder',
 'Reminder for MSFT earnings announcement',
 jsonb_build_object(
   'symbol', 'MSFT',
   'days_before', 2
 ),
 'pending', true)

ON CONFLICT DO NOTHING;

-- Insert sample system metrics
INSERT INTO system_metrics (metric_name, metric_value, metric_date) VALUES
('feeds_processed', 127, CURRENT_DATE),
('content_analyzed', 89, CURRENT_DATE),
('predictions_generated', 15, CURRENT_DATE),
('alerts_triggered', 34, CURRENT_DATE),
('api_requests', 2847, CURRENT_DATE),
('active_users', 156, CURRENT_DATE),
('database_size_mb', 1247.5, CURRENT_DATE),
('cache_hit_ratio', 87.3, CURRENT_DATE)

ON CONFLICT (metric_name, metric_date) DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    updated_at = NOW();

-- Add comments
COMMENT ON TABLE processed_content IS 'AI-processed content from various feeds with extracted insights';
COMMENT ON TABLE daily_analysis IS 'Daily market analysis and AI-generated insights';
COMMENT ON TABLE predictions IS 'AI-generated market predictions with confidence scores';
COMMENT ON TABLE stock_data IS 'Historical and real-time stock price and volume data';
COMMENT ON TABLE technical_indicators IS 'Calculated technical analysis indicators for stocks';
COMMENT ON TABLE sentiment_analysis IS 'Sentiment analysis results for market entities';
COMMENT ON TABLE news_items IS 'Curated news items with sentiment and importance scoring';
COMMENT ON TABLE scanner_results IS 'Stock screening results based on various criteria';
COMMENT ON TABLE alerts IS 'User-configured alerts for market events and conditions';
COMMENT ON TABLE system_metrics IS 'System performance and usage metrics';