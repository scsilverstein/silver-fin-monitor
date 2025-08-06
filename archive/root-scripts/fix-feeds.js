const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const workingFeeds = [
  {
    name: "NPR Planet Money",
    url: "https://feeds.npr.org/510289/podcast.xml",
    type: "podcast",
    is_active: true
  },
  {
    name: "The Indicator from Planet Money", 
    url: "https://feeds.npr.org/510325/podcast.xml",
    type: "podcast",
    is_active: true
  },
  {
    name: "CNBC Closing Bell",
    url: "https://feeds.simplecast.com/Nh1wIaXT",
    type: "podcast", 
    is_active: true
  },
  {
    name: "CNBC Power Lunch",
    url: "https://feeds.simplecast.com/_qvRgwME",
    type: "podcast",
    is_active: true
  },
  {
    name: "CNBC Fast Money",
    url: "https://feeds.simplecast.com/szW8tJ16", 
    type: "podcast",
    is_active: true
  },
  {
    name: "MarketWatch on Demand",
    url: "https://feeds.megaphone.fm/marketwatch-on-demand",
    type: "podcast",
    is_active: true
  },
  {
    name: "Wall Street Breakfast",
    url: "https://feeds.simplecast.com/xwmzg5n7",
    type: "podcast", 
    is_active: true
  },
  {
    name: "Motley Fool Money",
    url: "https://feeds.megaphone.fm/motley-fool-money",
    type: "podcast",
    is_active: true
  },
  {
    name: "Chat with Traders",
    url: "https://feeds.buzzsprout.com/1895/rss",
    type: "podcast",
    is_active: true
  },
  {
    name: "Invest Like the Best",
    url: "https://feeds.megaphone.fm/investlikethebest",
    type: "podcast",
    is_active: true
  }
];

async function fixFeeds() {
  console.log('🔧 Fixing podcast feeds...');
  
  // First, deactivate all existing feeds
  const { error: deactivateError } = await supabase
    .from('feed_sources')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all
    
  if (deactivateError) {
    console.error('Error deactivating feeds:', deactivateError);
    return;
  }
  
  console.log('✅ Deactivated existing feeds');

  // Add/update working feeds
  for (const feed of workingFeeds) {
    // Check if feed already exists
    const { data: existing } = await supabase
      .from('feed_sources')
      .select('id, name')
      .eq('name', feed.name)
      .single();
    
    if (existing) {
      // Update existing feed
      const { error: updateError } = await supabase
        .from('feed_sources')
        .update({
          url: feed.url,
          type: feed.type,
          is_active: feed.is_active,
          config: {
            categories: ["finance", "business", "economics"],
            priority: "medium",
            update_frequency: "hourly"
          }
        })
        .eq('id', existing.id);
        
      if (updateError) {
        console.error(`❌ Error updating ${feed.name}:`, updateError);
      } else {
        console.log(`✅ Updated ${feed.name}`);
      }
    } else {
      // Insert new feed
      const { error: insertError } = await supabase
        .from('feed_sources')
        .insert({
          name: feed.name,
          url: feed.url,
          type: feed.type,
          is_active: feed.is_active,
          config: {
            categories: ["finance", "business", "economics"],
            priority: "medium", 
            update_frequency: "hourly"
          }
        });
        
      if (insertError) {
        console.error(`❌ Error inserting ${feed.name}:`, insertError);
      } else {
        console.log(`✅ Added ${feed.name}`);
      }
    }
  }
  
  console.log('🎉 Feed update complete!');
  
  // Show active feeds
  const { data: activeFeeds } = await supabase
    .from('feed_sources')
    .select('name, url, is_active')
    .eq('is_active', true);
    
  console.log('\n📡 Active feeds:');
  activeFeeds.forEach(feed => {
    console.log(`  ✅ ${feed.name}`);
  });
}

fixFeeds().catch(console.error);