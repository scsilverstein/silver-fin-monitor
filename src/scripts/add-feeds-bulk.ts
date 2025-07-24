#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface FeedToAdd {
  name: string;
  type: 'podcast' | 'rss' | 'api';
  url: string;
}

const feedsToAdd: FeedToAdd[] = [
  { name: "Freakonomics Radio", type: "podcast", url: "https://feeds.simplecast.com/Y8lFbOT4" },
  { name: "Bloomberg Markets", type: "podcast", url: "https://feeds.simplecast.com/c8BHYNHg" },
  { name: "Bloomberg Markets News", type: "rss", url: "https://feeds.bloomberg.com/markets/news.rss" },
  { name: "Forbes Daily Briefing", type: "podcast", url: "https://rss.art19.com/forbes-daily-briefing" },
  { name: "The Verge", type: "rss", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Wall Street Journal Markets", type: "rss", url: "https://feeds.wsj.com/public/resources/documents/WSJ_MARKETS.xml" },
  { name: "Bloomberg Surveillance", type: "podcast", url: "https://feeds.simplecast.com/54nAGcIl" },
  { name: "CNBC Halftime Report", type: "podcast", url: "https://feeds.simplecast.com/qltQrd_8" },
  { name: "FRED Economic Data", type: "api", url: "https://api.stlouisfed.org/fred/series" },
  { name: "MIT Technology Review", type: "rss", url: "https://www.technologyreview.com/feed/" },
  { name: "Masters of Scale", type: "podcast", url: "https://rss.art19.com/masters-of-scale" },
  { name: "Grant Williams Podcast", type: "podcast", url: "https://feeds.megaphone.fm/TGPN7186847623" },
  { name: "The Economist - World News", type: "rss", url: "https://www.economist.com/the-world-this-week/rss.xml" },
  { name: "MacroVoices", type: "podcast", url: "https://feeds.feedburner.com/MacroVoices" },
  { name: "Unchained Podcast", type: "podcast", url: "https://unchained.libsyn.com/rss" },
  { name: "The Meb Faber Research Podcast", type: "podcast", url: "https://mebfaber.libsyn.com/rss" },
  { name: "Wall Street Journal - Markets", type: "rss", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { name: "Financial Times", type: "rss", url: "https://www.ft.com/?format=rss" },
  { name: "Ars Technica", type: "rss", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "CNBC Your Money Minute", type: "podcast", url: "https://feeds.simplecast.com/_mQMEG_J" },
  { name: "WSJ What's News", type: "podcast", url: "https://video-api.wsj.com/podcast/rss/wsj/whats-news" },
  { name: "Hacker News", type: "rss", url: "https://news.ycombinator.com/rss" },
  { name: "CNBC Mad Money", type: "podcast", url: "https://feeds.megaphone.fm/madmoney" },
  { name: "IMF Economic Outlook", type: "rss", url: "https://www.imf.org/en/News/RSS" },
  { name: "The Tim Ferriss Show", type: "podcast", url: "https://rss.art19.com/tim-ferriss-show" },
  { name: "CNBC Fast Money", type: "podcast", url: "https://feeds.simplecast.com/szW8tJ16" },
  { name: "CNBC Worldwide Exchange", type: "podcast", url: "https://feeds.simplecast.com/Bt3ITxGl" },
  { name: "MarketWatch", type: "rss", url: "https://feeds.marketwatch.com/marketwatch/marketpulse/" },
  { name: "Test Audio Feed", type: "podcast", url: "https://example.com/test" },
  { name: "All-In Podcast", type: "podcast", url: "https://allinchamathjason.libsyn.com/rss" },
  { name: "CNBC Squawk Box", type: "podcast", url: "https://feeds.megaphone.fm/squawkbox" },
  { name: "CNBC Top News", type: "rss", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "Chat with Traders", type: "podcast", url: "https://chatwithtraders.libsyn.com/rss" },
  { name: "CNBC Power Lunch", type: "podcast", url: "https://feeds.simplecast.com/_qvRgwME" },
  { name: "Real Vision Podcast", type: "podcast", url: "https://feeds.megaphone.fm/realvision" },
  { name: "OilPrice.com", type: "rss", url: "https://oilprice.com/rss/main" },
  { name: "MarketWatch TopStories", type: "rss", url: "http://feeds.marketwatch.com/marketwatch/topstories/" },
  { name: "Steve Forbes: What's Ahead", type: "podcast", url: "https://rss.art19.com/steve-forbes-whats-ahead" },
  { name: "Huberman Lab", type: "podcast", url: "https://feeds.libsyn.com/356646/rss" },
  { name: "CNBC Opening Bell", type: "podcast", url: "https://feeds.megaphone.fm/openingbell" },
  { name: "Peter Zeihan Blog", type: "rss", url: "https://zeihan.com/feed/" },
  { name: "Seeking Alpha Market News", type: "rss", url: "https://seekingalpha.com/market_currents.xml" },
  { name: "CNBC Squawk Box Europe Express", type: "podcast", url: "https://rss.art19.com/squawk-box-europe" },
  { name: "CNBC Options Action", type: "podcast", url: "https://feeds.simplecast.com/CqxTohm7" },
  { name: "Bloomberg Surveillance Alt", type: "podcast", url: "https://feeds.bloomberg.fm/surveillance" },
  { name: "USA Today 5 Things", type: "podcast", url: "https://rss.art19.com/5-things" },
  { name: "CNBC Podcasts", type: "podcast", url: "https://feeds.megaphone.fm/CNBC1378508608" },
  { name: "CNBC Mad Money w/ Jim Cramer", type: "podcast", url: "https://feeds.simplecast.com/TkQfZXMD" },
  { name: "This Week in Startups", type: "podcast", url: "https://feeds.megaphone.fm/thisweekin" },
  { name: "VentureBeat", type: "rss", url: "https://venturebeat.com/feed/" },
  { name: "TechCrunch", type: "rss", url: "https://techcrunch.com/feed/" },
  { name: "Marketplace", type: "podcast", url: "https://feeds.publicradio.org/public_feeds/marketplace-pm/rss/rss" },
  { name: "CNBC The Exchange", type: "podcast", url: "https://feeds.simplecast.com/tc4zxWgX" },
  { name: "Capital Allocators", type: "podcast", url: "https://feeds.megaphone.fm/capitalallocators" },
  { name: "CNBC Squawk on the Street", type: "podcast", url: "https://feeds.simplecast.com/GcylmXl7" },
  { name: "The Indicator from Planet Money", type: "podcast", url: "https://feeds.npr.org/510325/podcast.xml" },
  { name: "Macro Musings", type: "podcast", url: "https://macromusings.libsyn.com/rss" },
  { name: "All-In Podcast Alt", type: "podcast", url: "https://feeds.megaphone.fm/all-in-with-chamath-jason-sacks-friedberg" },
  { name: "CNBC Closing Bell", type: "podcast", url: "https://feeds.simplecast.com/Nh1wIaXT" },
  { name: "Federal Reserve Economic Data Blog", type: "rss", url: "https://fredblog.stlouisfed.org/feed/" },
  { name: "The Acquirers Podcast", type: "podcast", url: "https://feeds.megaphone.fm/acquirers" },
  { name: "Lex Fridman Podcast", type: "podcast", url: "https://lexfridman.com/feed/podcast/" },
  { name: "CNBC Squawk Box Alt", type: "podcast", url: "https://feeds.nbcuni.com/cnbc/podcast/squawk-box" },
  { name: "Bankless", type: "podcast", url: "https://feeds.simplecast.com/0KaAW2NV" },
  { name: "Planet Money", type: "podcast", url: "https://feeds.npr.org/510289/podcast.xml" },
  { name: "How I Built This", type: "podcast", url: "https://feeds.npr.org/510313/podcast.xml" },
  { name: "Bloomberg Odd Lots", type: "podcast", url: "https://feeds.simplecast.com/47qQJ8Ub" },
  { name: "Financial Times - Markets", type: "rss", url: "https://www.ft.com/markets?format=rss" },
  { name: "Reuters Business", type: "rss", url: "https://feeds.reuters.com/reuters/businessNews" },
  { name: "Chat with Traders Alt", type: "podcast", url: "https://chatwithtraders.com/feed/" }
];

async function getDefaultConfig(type: string): Promise<any> {
  const baseConfig = {
    priority: 'medium',
    categories: ['finance', 'markets'],
    update_frequency: 'hourly'
  };

  switch (type) {
    case 'podcast':
      return {
        ...baseConfig,
        categories: ['finance', 'markets', 'podcasts'],
        process_transcript: true,
        extract_guests: true
      };
    case 'rss':
      return {
        ...baseConfig,
        categories: ['finance', 'markets', 'news']
      };
    case 'api':
      return {
        ...baseConfig,
        categories: ['finance', 'markets', 'data'],
        api_key_required: false
      };
    default:
      return baseConfig;
  }
}

async function addFeedsBulk() {
  try {
    console.log(`🚀 Adding ${feedsToAdd.length} feeds to Silver Fin Monitor...\n`);

    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [index, feed] of feedsToAdd.entries()) {
      try {
        console.log(`[${index + 1}/${feedsToAdd.length}] Adding: ${feed.name}`);
        console.log(`   Type: ${feed.type}`);
        console.log(`   URL: ${feed.url}`);

        // Check if feed already exists
        const { data: existingFeed, error: checkError } = await supabase
          .from('feed_sources')
          .select('id, name')
          .eq('url', feed.url)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`   ❌ Error checking for existing feed: ${checkError.message}`);
          errorCount++;
          continue;
        }

        if (existingFeed) {
          console.log(`   ⏭️  Skipped: Feed already exists (${existingFeed.name})`);
          skippedCount++;
          continue;
        }

        // Get default config for this feed type
        const config = await getDefaultConfig(feed.type);

        // Add the feed
        const { data, error } = await supabase
          .from('feed_sources')
          .insert([
            {
              name: feed.name,
              type: feed.type,
              url: feed.url,
              is_active: feed.name === "Test Audio Feed" ? false : true, // Keep test feed disabled
              config: config,
              created_at: new Date().toISOString()
            }
          ])
          .select()
          .single();

        if (error) {
          console.error(`   ❌ Error adding feed: ${error.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ Added successfully (ID: ${data.id})`);
          addedCount++;
        }

      } catch (error) {
        console.error(`   ❌ Unexpected error: ${error}`);
        errorCount++;
      }

      console.log(''); // Empty line for readability
    }

    console.log('🏁 Bulk feed addition complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully added: ${addedCount} feeds`);
    console.log(`   ⏭️  Skipped (already exist): ${skippedCount} feeds`);
    console.log(`   ❌ Errors encountered: ${errorCount} feeds`);
    console.log(`   📝 Total processed: ${addedCount + skippedCount + errorCount} feeds\n`);

    // Get final count of active feeds
    const { data: activeFeedsCount, error: countError } = await supabase
      .from('feed_sources')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    if (!countError) {
      console.log(`🎯 Current active feeds: ${activeFeedsCount?.length || 0}`);
    }

    // Show some sample feeds that were added
    if (addedCount > 0) {
      console.log('\n🔍 Sample of newly added feeds:');
      const { data: sampleFeeds, error: sampleError } = await supabase
        .from('feed_sources')
        .select('name, type, url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!sampleError && sampleFeeds) {
        sampleFeeds.forEach((feed, index) => {
          console.log(`   ${index + 1}. ${feed.name} (${feed.type})`);
        });
      }
    }

    console.log('\n🎉 Your Silver Fin Monitor now has premium financial feeds!');
    console.log('💡 Next steps:');
    console.log('   1. Start feed processing: POST /api/feeds/[feed-id]/process');
    console.log('   2. Monitor queue status: GET /api/queue/stats');
    console.log('   3. View dashboard: Your feeds will appear in the UI');

  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

// Run the script
addFeedsBulk().then(() => {
  console.log('\n✨ Script completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});