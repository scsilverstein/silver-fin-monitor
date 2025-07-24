import { supabase } from '../src/services/database/client';
import { logger } from '../src/utils/logger';

const redditFeeds = [
  {
    name: 'r/wallstreetbets',
    type: 'reddit' as const,
    url: 'https://reddit.com/r/wallstreetbets',
    is_active: true,
    config: {
      subreddit: 'wallstreetbets',
      sort: 'hot',
      time: 'day',
      minScore: 100,
      minComments: 20,
      minUpvoteRatio: 0.8,
      excludeNSFW: true,
      categories: ['finance', 'markets', 'social_sentiment'],
      priority: 'high',
      updateFrequency: 'hourly',
      includeComments: true
    }
  },
  {
    name: 'r/stocks',
    type: 'reddit' as const,
    url: 'https://reddit.com/r/stocks',
    is_active: true,
    config: {
      subreddit: 'stocks',
      sort: 'hot',
      time: 'day',
      minScore: 50,
      minComments: 10,
      minUpvoteRatio: 0.75,
      excludeNSFW: true,
      categories: ['finance', 'markets', 'analysis'],
      priority: 'medium',
      updateFrequency: 'hourly',
      includeComments: true
    }
  },
  {
    name: 'r/investing',
    type: 'reddit' as const,
    url: 'https://reddit.com/r/investing',
    is_active: true,
    config: {
      subreddit: 'investing',
      sort: 'hot',
      time: 'day',
      minScore: 30,
      minComments: 10,
      minUpvoteRatio: 0.7,
      excludeNSFW: true,
      categories: ['finance', 'markets', 'long_term'],
      priority: 'medium',
      updateFrequency: 'hourly',
      includeComments: true
    }
  },
  {
    name: 'r/cryptocurrency',
    type: 'reddit' as const,
    url: 'https://reddit.com/r/cryptocurrency',
    is_active: true,
    config: {
      subreddit: 'cryptocurrency',
      sort: 'hot',
      time: 'day',
      minScore: 50,
      minComments: 15,
      minUpvoteRatio: 0.75,
      excludeNSFW: true,
      categories: ['crypto', 'blockchain', 'digital_assets'],
      priority: 'medium',
      updateFrequency: 'hourly',
      includeComments: true,
      flairFilter: ['News', 'Analysis', 'Discussion']
    }
  },
  {
    name: 'r/economics',
    type: 'reddit' as const,
    url: 'https://reddit.com/r/economics',
    is_active: true,
    config: {
      subreddit: 'economics',
      sort: 'hot',
      time: 'day',
      minScore: 25,
      minComments: 10,
      minUpvoteRatio: 0.7,
      excludeNSFW: true,
      categories: ['economics', 'policy', 'analysis'],
      priority: 'medium',
      updateFrequency: '4hours',
      includeComments: false
    }
  },
  {
    name: 'r/StockMarket',
    type: 'reddit' as const,
    url: 'https://reddit.com/r/StockMarket',
    is_active: true,
    config: {
      subreddit: 'StockMarket',
      sort: 'hot',
      time: 'day',
      minScore: 40,
      minComments: 10,
      minUpvoteRatio: 0.75,
      excludeNSFW: true,
      categories: ['finance', 'markets', 'trading'],
      priority: 'medium',
      updateFrequency: 'hourly',
      includeComments: true
    }
  }
];

async function addRedditFeeds() {
  logger.info('Adding Reddit feeds to database...');

  for (const feed of redditFeeds) {
    try {
      // Check if feed already exists
      const { data: existing } = await supabase
        .from('feed_sources')
        .select('id, name')
        .eq('url', feed.url)
        .single();

      if (existing) {
        logger.info(`Feed ${feed.name} already exists, skipping...`);
        continue;
      }

      // Insert new feed
      const { data, error } = await supabase
        .from('feed_sources')
        .insert(feed)
        .select()
        .single();

      if (error) {
        logger.error(`Failed to add feed ${feed.name}:`, error);
      } else {
        logger.info(`Successfully added feed: ${feed.name}`);
      }
    } catch (error) {
      logger.error(`Error processing feed ${feed.name}:`, error);
    }
  }

  logger.info('Finished adding Reddit feeds');
}

// Run the script
addRedditFeeds().catch(console.error);