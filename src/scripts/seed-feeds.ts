// Seed script for initial feed sources from CLAUDE.md specification
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Feed sources from CLAUDE.md specification
const feedSources = [
  {
    name: 'CNBC Squawk Box',
    type: 'podcast',
    url: 'https://feeds.nbcuni.com/cnbc/podcast/squawk-box',
    config: {
      categories: ['finance', 'markets', 'economy'],
      priority: 'high',
      update_frequency: 'hourly',
      process_transcript: true
    }
  },
  {
    name: 'Bloomberg Surveillance',
    type: 'podcast',
    url: 'https://feeds.bloomberg.fm/surveillance',
    config: {
      categories: ['finance', 'markets', 'global_economy'],
      priority: 'high',
      update_frequency: 'hourly',
      extract_guests: true
    }
  },
  {
    name: 'Financial Times - Markets',
    type: 'rss',
    url: 'https://www.ft.com/markets?format=rss',
    config: {
      categories: ['finance', 'markets', 'analysis'],
      priority: 'high',
      update_frequency: '15min'
    }
  },
  {
    name: 'All-In Podcast',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/all-in-with-chamath-jason-sacks-friedberg',
    config: {
      categories: ['technology', 'venture_capital', 'politics'],
      priority: 'medium',
      update_frequency: 'weekly',
      extract_guests: true
    }
  },
  {
    name: 'This Week in Startups',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/thisweekin',
    config: {
      categories: ['startups', 'venture_capital', 'technology'],
      priority: 'medium',
      update_frequency: 'daily'
    }
  },
  {
    name: 'Peter Zeihan',
    type: 'multi_source',
    url: 'https://zeihan.com/feed/',
    config: {
      categories: ['geopolitics', 'economics', 'demographics'],
      priority: 'high',
      update_frequency: 'daily',
      extract_video_transcript: true,
      sources: [
        { url: 'https://zeihan.com/feed/', type: 'rss' },
        { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCTiL1q9YgXJhRI7muKXjvOg', type: 'youtube' }
      ]
    }
  },
  {
    name: 'The Economist - World News',
    type: 'rss',
    url: 'https://www.economist.com/the-world-this-week/rss.xml',
    config: {
      categories: ['geopolitics', 'economics', 'analysis'],
      priority: 'medium',
      update_frequency: 'daily'
    }
  },
  {
    name: 'Chat with Traders',
    type: 'podcast',
    url: 'https://chatwithtraders.com/feed/',
    config: {
      categories: ['trading', 'markets', 'strategy'],
      priority: 'medium',
      update_frequency: 'weekly',
      extract_guests: true
    }
  },
  {
    name: 'MacroVoices',
    type: 'podcast',
    url: 'https://feeds.feedburner.com/MacroVoices',
    config: {
      categories: ['macro', 'commodities', 'global_markets'],
      priority: 'medium',
      update_frequency: 'weekly'
    }
  },
  {
    name: 'Grant Williams Podcast',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/TGPN7186847623',
    config: {
      categories: ['finance', 'macro', 'alternative_views'],
      priority: 'low',
      update_frequency: 'weekly'
    }
  },
  {
    name: 'Real Vision Daily',
    type: 'podcast',
    url: 'https://feeds.megaphone.fm/realvision',
    config: {
      categories: ['finance', 'crypto', 'macro'],
      priority: 'medium',
      update_frequency: 'daily'
    }
  },
  {
    name: 'Bankless',
    type: 'podcast',
    url: 'https://feeds.simplecast.com/0KaAW2NV',
    config: {
      categories: ['crypto', 'defi', 'web3'],
      priority: 'low',
      update_frequency: 'twice_weekly'
    }
  },
  {
    name: 'FRED Economic Data',
    type: 'api',
    url: 'https://api.stlouisfed.org/fred/series',
    config: {
      categories: ['economic_data', 'indicators', 'statistics'],
      priority: 'high',
      update_frequency: 'daily',
      api_key_required: true,
      series: ['DGS10', 'UNRATE', 'CPIAUCSL', 'GDP']
    }
  },
  {
    name: 'IMF Economic Outlook',
    type: 'rss',
    url: 'https://www.imf.org/en/News/RSS',
    config: {
      categories: ['global_economy', 'policy', 'forecasts'],
      priority: 'low',
      update_frequency: 'daily'
    }
  },
  {
    name: 'OilPrice.com',
    type: 'rss',
    url: 'https://oilprice.com/rss/main',
    config: {
      categories: ['energy', 'commodities', 'oil'],
      priority: 'medium',
      update_frequency: 'hourly'
    }
  }
];

async function seedFeeds() {
  console.log('Starting feed source seeding...');
  
  for (const feed of feedSources) {
    try {
      // Check if feed already exists
      const { data: existingFeed } = await supabase
        .from('feed_sources')
        .select('id, name')
        .eq('url', feed.url)
        .single();
      
      if (existingFeed) {
        console.log(`Feed "${feed.name}" already exists, skipping...`);
        continue;
      }
      
      // Insert new feed
      const { data, error } = await supabase
        .from('feed_sources')
        .insert({
          name: feed.name,
          type: feed.type,
          url: feed.url,
          config: feed.config,
          is_active: true
        })
        .select()
        .single();
      
      if (error) {
        console.error(`Failed to insert feed "${feed.name}":`, error);
      } else {
        console.log(`✓ Successfully added feed: ${feed.name}`);
      }
    } catch (err) {
      console.error(`Error processing feed "${feed.name}":`, err);
    }
  }
  
  console.log('\nFeed seeding completed!');
  
  // Display summary
  const { count } = await supabase
    .from('feed_sources')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal feeds in database: ${count}`);
}

// Run the seed script
seedFeeds().catch(console.error);