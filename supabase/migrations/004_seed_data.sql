-- Silver Fin Monitor - Seed Data
-- Migration 004: Initial Feed Sources

-- Insert initial feed sources based on CLAUDE.md specification
INSERT INTO feed_sources (name, type, url, config) VALUES
-- Financial News & Analysis
(
  'CNBC Squawk Box',
  'podcast',
  'https://feeds.nbcuni.com/cnbc/podcast/squawk-box',
  '{
    "categories": ["finance", "markets", "economy"],
    "priority": "high",
    "update_frequency": "hourly",
    "process_transcript": true
  }'::jsonb
),
(
  'Bloomberg Surveillance',
  'podcast',
  'https://feeds.bloomberg.fm/surveillance',
  '{
    "categories": ["finance", "markets", "global_economy"],
    "priority": "high",
    "update_frequency": "hourly",
    "extract_guests": true
  }'::jsonb
),
(
  'Financial Times - Markets',
  'rss',
  'https://www.ft.com/markets?format=rss',
  '{
    "categories": ["finance", "markets", "analysis"],
    "priority": "high",
    "update_frequency": "15min"
  }'::jsonb
),

-- Tech & Venture Capital
(
  'All-In Podcast',
  'podcast',
  'https://feeds.megaphone.fm/all-in-with-chamath-jason-sacks-friedberg',
  '{
    "categories": ["technology", "venture_capital", "politics"],
    "priority": "medium",
    "update_frequency": "weekly",
    "extract_guests": true
  }'::jsonb
),
(
  'This Week in Startups',
  'podcast',
  'https://feeds.megaphone.fm/thisweekin',
  '{
    "categories": ["startups", "venture_capital", "technology"],
    "priority": "medium",
    "update_frequency": "daily"
  }'::jsonb
),

-- Geopolitical & Economic Analysis
(
  'Peter Zeihan',
  'multi_source',
  'https://zeihan.com/feed/',
  '{
    "categories": ["geopolitics", "economics", "demographics"],
    "priority": "high",
    "update_frequency": "daily",
    "sources": [
      {
        "url": "https://zeihan.com/feed/",
        "type": "rss"
      },
      {
        "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCTiL1q9YgXJhRI7muKXjvOg",
        "type": "youtube"
      }
    ],
    "extract_video_transcript": true
  }'::jsonb
),
(
  'The Economist - World News',
  'rss',
  'https://www.economist.com/the-world-this-week/rss.xml',
  '{
    "categories": ["geopolitics", "economics", "analysis"],
    "priority": "medium",
    "update_frequency": "daily"
  }'::jsonb
),

-- Market Insights & Trading
(
  'Chat with Traders',
  'podcast',
  'https://chatwithtraders.com/feed/',
  '{
    "categories": ["trading", "markets", "strategy"],
    "priority": "medium",
    "update_frequency": "weekly",
    "extract_guests": true
  }'::jsonb
),
(
  'MacroVoices',
  'podcast',
  'https://feeds.feedburner.com/MacroVoices',
  '{
    "categories": ["macro", "commodities", "global_markets"],
    "priority": "medium",
    "update_frequency": "weekly"
  }'::jsonb
),

-- Alternative Perspectives
(
  'Grant Williams Podcast',
  'podcast',
  'https://feeds.megaphone.fm/TGPN7186847623',
  '{
    "categories": ["finance", "macro", "alternative_views"],
    "priority": "low",
    "update_frequency": "weekly"
  }'::jsonb
),
(
  'Real Vision Daily',
  'podcast',
  'https://feeds.megaphone.fm/realvision',
  '{
    "categories": ["finance", "crypto", "macro"],
    "priority": "medium",
    "update_frequency": "daily"
  }'::jsonb
),

-- Crypto & Digital Assets
(
  'Bankless',
  'podcast',
  'https://feeds.simplecast.com/0KaAW2NV',
  '{
    "categories": ["crypto", "defi", "web3"],
    "priority": "low",
    "update_frequency": "twice_weekly"
  }'::jsonb
),

-- Economic Data & Research
(
  'IMF Economic Outlook',
  'rss',
  'https://www.imf.org/en/News/RSS',
  '{
    "categories": ["global_economy", "policy", "forecasts"],
    "priority": "low",
    "update_frequency": "daily"
  }'::jsonb
),

-- Energy & Commodities
(
  'OilPrice.com',
  'rss',
  'https://oilprice.com/rss/main',
  '{
    "categories": ["energy", "commodities", "oil"],
    "priority": "medium",
    "update_frequency": "hourly"
  }'::jsonb
),

-- Additional high-quality sources
(
  'The Wall Street Journal - Markets',
  'rss',
  'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
  '{
    "categories": ["finance", "markets", "analysis"],
    "priority": "high",
    "update_frequency": "hourly"
  }'::jsonb
);

-- Insert some initial queue jobs for testing
SELECT enqueue_job('feed_fetch', '{"source_type": "all"}', 1);
SELECT enqueue_job('cleanup_expired_data', '{}', 5, 3600);