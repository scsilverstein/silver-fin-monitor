-- Seed initial feed sources
INSERT INTO feed_sources (name, type, url, config) VALUES
-- Financial News & Analysis
('CNBC Squawk Box', 'podcast', 'https://feeds.nbcuni.com/cnbc/podcast/squawk-box', 
 '{"categories": ["finance", "markets", "economy"], "priority": "high", "update_frequency": "hourly", "process_transcript": true}'::jsonb),

('Bloomberg Surveillance', 'podcast', 'https://feeds.bloomberg.fm/surveillance',
 '{"categories": ["finance", "markets", "global_economy"], "priority": "high", "update_frequency": "hourly", "extract_guests": true}'::jsonb),

('Financial Times - Markets', 'rss', 'https://www.ft.com/markets?format=rss',
 '{"categories": ["finance", "markets", "analysis"], "priority": "high", "update_frequency": "15min"}'::jsonb),

-- Tech & Venture Capital
('All-In Podcast', 'podcast', 'https://feeds.megaphone.fm/all-in-with-chamath-jason-sacks-friedberg',
 '{"categories": ["technology", "venture_capital", "politics"], "priority": "medium", "update_frequency": "weekly", "extract_guests": true}'::jsonb),

('This Week in Startups', 'podcast', 'https://feeds.megaphone.fm/thisweekin',
 '{"categories": ["startups", "venture_capital", "technology"], "priority": "medium", "update_frequency": "daily"}'::jsonb),

-- Geopolitical & Economic Analysis
('The Economist - World News', 'rss', 'https://www.economist.com/the-world-this-week/rss.xml',
 '{"categories": ["geopolitics", "economics", "analysis"], "priority": "medium", "update_frequency": "daily"}'::jsonb),

-- Market Insights & Trading
('Chat with Traders', 'podcast', 'https://chatwithtraders.com/feed/',
 '{"categories": ["trading", "markets", "strategy"], "priority": "medium", "update_frequency": "weekly", "extract_guests": true}'::jsonb),

('MacroVoices', 'podcast', 'https://feeds.feedburner.com/MacroVoices',
 '{"categories": ["macro", "commodities", "global_markets"], "priority": "medium", "update_frequency": "weekly"}'::jsonb),

-- Alternative Perspectives
('Real Vision Daily', 'podcast', 'https://feeds.megaphone.fm/realvision',
 '{"categories": ["finance", "crypto", "macro"], "priority": "medium", "update_frequency": "daily"}'::jsonb),

-- Crypto & Digital Assets
('Bankless', 'podcast', 'https://feeds.simplecast.com/0KaAW2NV',
 '{"categories": ["crypto", "defi", "web3"], "priority": "low", "update_frequency": "twice_weekly"}'::jsonb),

-- Energy & Commodities
('OilPrice.com', 'rss', 'https://oilprice.com/rss/main',
 '{"categories": ["energy", "commodities", "oil"], "priority": "medium", "update_frequency": "hourly"}'::jsonb)

ON CONFLICT DO NOTHING;