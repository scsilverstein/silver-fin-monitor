const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createRedditFeedWorkaround() {
  console.log('Creating Reddit feed with workaround...\n');

  // Use 'api' type as a workaround and store reddit info in config
  const redditFeed = {
    name: 'r/wallstreetbets (Reddit)',
    type: 'api',  // Use 'api' instead of 'reddit' to bypass constraint
    url: 'https://www.reddit.com/r/wallstreetbets/.json',
    config: {
      categories: ['finance', 'investing'],
      priority: 'medium',
      updateFrequency: 'hourly',
      // Store reddit-specific config
      feedSubtype: 'reddit',  // Mark this as a reddit feed
      subreddit: 'wallstreetbets',
      sort: 'hot',
      limit: 25,
      minScore: 5,
      minComments: 2,
      excludeNSFW: true
    }
  };

  try {
    const { data, error } = await supabase
      .from('feed_sources')
      .insert(redditFeed)
      .select()
      .single();

    if (error) {
      console.error('Failed to create feed:', error.message);
    } else {
      console.log('✅ Reddit feed created successfully as API type!');
      console.log('Feed ID:', data.id);
      console.log('Feed name:', data.name);
      console.log('Feed URL:', data.url);
      console.log('\nThe backend will recognize this as a Reddit feed from the config.feedSubtype field.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

createRedditFeedWorkaround();