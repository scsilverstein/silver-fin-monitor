const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRedditConstraint() {
  console.log('Testing Reddit type constraint...\n');

  // First, let's see what types currently exist
  console.log('1. Checking existing feed types:');
  const { data: feeds, error: listError } = await supabase
    .from('feed_sources')
    .select('type')
    .order('type');

  if (!listError && feeds) {
    const types = [...new Set(feeds.map(f => f.type))];
    console.log('   Current types in use:', types.join(', ') || 'none');
  }

  // Try to create a reddit feed
  console.log('\n2. Attempting to create a Reddit feed:');
  const testFeed = {
    name: 'Reddit Test Feed ' + Date.now(),
    type: 'reddit',
    url: 'https://www.reddit.com/r/wallstreetbets/',
    config: {
      categories: ['finance'],
      priority: 'medium',
      updateFrequency: 'hourly',
      subreddit: 'wallstreetbets'
    }
  };

  const { data: insertData, error: insertError } = await supabase
    .from('feed_sources')
    .insert(testFeed)
    .select()
    .single();

  if (insertError) {
    console.error('   ✗ Failed to create reddit feed:', insertError.message);
    console.error('   Error code:', insertError.code);
    console.error('   Error details:', insertError.details);
    
    if (insertError.message.includes('violates check constraint')) {
      console.log('\n❌ The database still has a constraint blocking reddit type.');
      console.log('\nTo fix this, please run the following SQL in your Supabase SQL Editor:');
      console.log('----------------------------------------');
      console.log(`ALTER TABLE feed_sources DROP CONSTRAINT IF EXISTS feed_sources_type_check;

ALTER TABLE feed_sources ADD CONSTRAINT feed_sources_type_check 
CHECK (type IN ('rss', 'podcast', 'youtube', 'api', 'multi_source', 'reddit'));`);
      console.log('----------------------------------------');
    }
  } else {
    console.log('   ✓ Reddit feed created successfully!');
    console.log('   Feed ID:', insertData.id);
    console.log('   Feed name:', insertData.name);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('feed_sources')
      .delete()
      .eq('id', insertData.id);

    if (!deleteError) {
      console.log('   ✓ Test feed cleaned up');
    }
    
    console.log('\n✅ Reddit type is working correctly!');
  }
}

testRedditConstraint().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});