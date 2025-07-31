-- Seed initial feed sources
-- Core financial news and analysis sources for production use

-- Insert RSS feed sources
INSERT INTO feed_sources (name, type, url, config, is_active) VALUES
-- Financial News Sources
('Financial Times Markets', 'rss', 'https://www.ft.com/markets?format=rss', 
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'analysis'],
   'priority', 'high',
   'update_frequency', '15min',
   'extract_entities', true
 ), true),

('Reuters Business News', 'rss', 'https://feeds.reuters.com/reuters/businessNews',
 jsonb_build_object(
   'categories', ARRAY['finance', 'business', 'markets'],
   'priority', 'high',
   'update_frequency', '30min',
   'extract_entities', true
 ), true),

('Bloomberg Markets', 'rss', 'https://feeds.bloomberg.com/markets/news.rss',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'economy'],
   'priority', 'high',
   'update_frequency', '30min',
   'extract_entities', true
 ), true),

('MarketWatch', 'rss', 'https://feeds.marketwatch.com/marketwatch/topstories/',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'stocks'],
   'priority', 'medium',
   'update_frequency', '1hour',
   'extract_entities', true
 ), true),

('Yahoo Finance', 'rss', 'https://feeds.finance.yahoo.com/rss/2.0/headline',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'economy'],
   'priority', 'medium',
   'update_frequency', '1hour',
   'extract_entities', true
 ), true),

-- Economic Data Sources
('Federal Reserve News', 'rss', 'https://www.federalreserve.gov/feeds/press_all.xml',
 jsonb_build_object(
   'categories', ARRAY['monetary_policy', 'central_banking', 'economy'],
   'priority', 'high',
   'update_frequency', '2hour',
   'extract_entities', true
 ), true),

('Treasury News', 'rss', 'https://home.treasury.gov/rss/news',
 jsonb_build_object(
   'categories', ARRAY['fiscal_policy', 'government', 'economy'],
   'priority', 'medium',
   'update_frequency', '4hour',
   'extract_entities', true
 ), true),

-- Technology and Innovation
('TechCrunch Finance', 'rss', 'https://techcrunch.com/category/fintech/feed/',
 jsonb_build_object(
   'categories', ARRAY['fintech', 'technology', 'startups'],
   'priority', 'medium',
   'update_frequency', '2hour',
   'extract_entities', true
 ), true),

-- International Sources
('Financial Times Global Economy', 'rss', 'https://www.ft.com/global-economy?format=rss',
 jsonb_build_object(
   'categories', ARRAY['global_economy', 'international', 'trade'],
   'priority', 'medium',
   'update_frequency', '4hour',
   'extract_entities', true
 ), true),

-- Energy and Commodities
('OilPrice.com', 'rss', 'https://oilprice.com/rss/main',
 jsonb_build_object(
   'categories', ARRAY['energy', 'commodities', 'oil'],
   'priority', 'medium',
   'update_frequency', '2hour',
   'extract_entities', true
 ), true)

ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Insert podcast sources
INSERT INTO feed_sources (name, type, url, config, is_active) VALUES
-- Financial Podcasts
('CNBC Squawk Box', 'podcast', 'https://feeds.nbcuni.com/cnbc/podcast/squawk-box',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'economy'],
   'priority', 'high',
   'update_frequency', 'daily',
   'process_transcript', true,
   'extract_guests', true
 ), true),

('Bloomberg Surveillance', 'podcast', 'https://feeds.bloomberg.fm/surveillance',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'global_economy'],
   'priority', 'high',
   'update_frequency', 'daily',
   'process_transcript', true,
   'extract_guests', true
 ), true),

('Chat with Traders', 'podcast', 'https://chatwithtraders.com/feed/',
 jsonb_build_object(
   'categories', ARRAY['trading', 'markets', 'strategy'],
   'priority', 'medium',
   'update_frequency', 'weekly',
   'process_transcript', true,
   'extract_guests', true
 ), true),

('MacroVoices', 'podcast', 'https://feeds.feedburner.com/MacroVoices',
 jsonb_build_object(
   'categories', ARRAY['macro', 'commodities', 'global_markets'],
   'priority', 'medium',
   'update_frequency', 'weekly',
   'process_transcript', true,
   'extract_guests', true
 ), true),

('The Acquirers Podcast', 'podcast', 'https://acquirersmultiple.com/feed/podcast/',
 jsonb_build_object(
   'categories', ARRAY['value_investing', 'stocks', 'analysis'],
   'priority', 'medium',
   'update_frequency', 'weekly',
   'process_transcript', true,
   'extract_guests', true
 ), true)

ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Insert YouTube channel sources
INSERT INTO feed_sources (name, type, url, config, is_active) VALUES
-- YouTube Channels
('Bloomberg Television', 'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCIALMKvObZNtJ6AmdCLP7Lg',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'news'],
   'priority', 'medium',
   'update_frequency', '6hour',
   'process_transcript', true,
   'extract_video_transcript', true
 ), true),

('CNBC Television', 'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCrp_UI8XtuYfpiqluWLD7Lw',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'business'],
   'priority', 'medium',
   'update_frequency', '6hour',
   'process_transcript', true,
   'extract_video_transcript', true
 ), true),

('Yahoo Finance', 'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCEAZeUIeJs0IjQiqMLs2mbA',
 jsonb_build_object(
   'categories', ARRAY['finance', 'markets', 'interviews'],
   'priority', 'low',
   'update_frequency', '12hour',
   'process_transcript', true,
   'extract_video_transcript', true
 ), true)

ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Insert API-based sources
INSERT INTO feed_sources (name, type, url, config, is_active) VALUES
-- API Sources
('Federal Reserve Economic Data', 'api', 'https://api.stlouisfed.org/fred/series',
 jsonb_build_object(
   'categories', ARRAY['economic_data', 'indicators', 'statistics'],
   'priority', 'high',
   'update_frequency', 'daily',
   'api_key_required', true,
   'data_series', ARRAY['DGS10', 'UNRATE', 'CPIAUCSL', 'GDP']
 ), true),

('Alpha Vantage Economic Indicators', 'api', 'https://www.alphavantage.co/query',
 jsonb_build_object(
   'categories', ARRAY['economic_data', 'stocks', 'forex'],
   'priority', 'medium',
   'update_frequency', 'daily',
   'api_key_required', true,
   'rate_limit', jsonb_build_object('requests', 5, 'period', 'minute')
 ), true),

('World Bank Open Data', 'api', 'https://api.worldbank.org/v2/country/all/indicator',
 jsonb_build_object(
   'categories', ARRAY['global_economy', 'development', 'statistics'],
   'priority', 'low',
   'update_frequency', 'weekly',
   'api_key_required', false
 ), true)

ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    config = EXCLUDED.config,
    updated_at = NOW();

-- Add source metadata
COMMENT ON TABLE feed_sources IS 'Configuration for external data sources including RSS, podcasts, YouTube, and APIs';