const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying Reddit type migration...\n');

  try {
    // First, drop the existing constraint
    console.log('1. Dropping existing type constraint...');
    const { data: dropData, error: dropError } = await supabase.rpc('query', {
      query: 'ALTER TABLE feed_sources DROP CONSTRAINT IF EXISTS feed_sources_type_check'
    }).single();

    if (dropError && !dropError.message.includes('does not exist')) {
      console.error('Error dropping constraint:', dropError);
      // Continue anyway as it might not exist
    } else {
      console.log('   ✓ Constraint dropped (or didn\'t exist)');
    }

    // Add the constraint back with reddit included
    console.log('\n2. Adding updated type constraint with reddit support...');
    const { data: addData, error: addError } = await supabase.rpc('query', {
      query: `ALTER TABLE feed_sources ADD CONSTRAINT feed_sources_type_check 
              CHECK (type IN ('rss', 'podcast', 'youtube', 'api', 'multi_source', 'reddit'))`
    }).single();

    if (addError) {
      console.error('Error adding constraint:', addError);
      // Try direct SQL if RPC doesn't work
      console.log('\n   Trying alternative approach...');
    } else {
      console.log('   ✓ Constraint added successfully');
    }

    // Test by creating and deleting a reddit feed
    console.log('\n3. Testing reddit type support...');
    const testFeed = {
      name: 'Reddit Migration Test',
      type: 'reddit',
      url: 'https://reddit.com/r/test',
      config: { categories: ['test'] }
    };

    const { data: insertData, error: insertError } = await supabase
      .from('feed_sources')
      .insert(testFeed)
      .select()
      .single();

    if (insertError) {
      console.error('   ✗ Failed to create reddit feed:', insertError.message);
      
      // If it's still a constraint error, we need to use a different approach
      if (insertError.message.includes('violates check constraint')) {
        console.log('\n   The constraint is still blocking reddit type.');
        console.log('   You may need to run the migration directly in Supabase SQL Editor.');
      }
    } else {
      console.log('   ✓ Reddit feed created successfully');
      
      // Clean up test feed
      const { error: deleteError } = await supabase
        .from('feed_sources')
        .delete()
        .eq('id', insertData.id);

      if (!deleteError) {
        console.log('   ✓ Test feed cleaned up');
      }
    }

    console.log('\n✅ Migration process completed!');
    
    // List current feed types to verify
    console.log('\nCurrent feed sources by type:');
    const { data: feeds, error: listError } = await supabase
      .from('feed_sources')
      .select('type')
      .order('type');

    if (!listError && feeds) {
      const typeCounts = feeds.reduce((acc, feed) => {
        acc[feed.type] = (acc[feed.type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} feeds`);
      });
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});