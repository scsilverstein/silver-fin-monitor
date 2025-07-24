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

async function deleteDisabledFeeds() {
  try {
    console.log('🔍 Finding all disabled feeds...\n');

    // First, get all disabled feeds
    const { data: disabledFeeds, error: queryError } = await supabase
      .from('feed_sources')
      .select('id, name, type, url, is_active')
      .eq('is_active', false);

    if (queryError) {
      console.error('❌ Error querying disabled feeds:', queryError);
      return;
    }

    if (!disabledFeeds || disabledFeeds.length === 0) {
      console.log('✅ No disabled feeds found! All feeds are active.');
      return;
    }

    console.log(`📊 Found ${disabledFeeds.length} disabled feeds:\n`);

    // Display the disabled feeds
    disabledFeeds.forEach((feed, index) => {
      console.log(`${index + 1}. ${feed.name}`);
      console.log(`   Type: ${feed.type}`);
      console.log(`   URL: ${feed.url}`);
      console.log(`   Active: ${feed.is_active}`);
      console.log(`   ID: ${feed.id}`);
      console.log('');
    });

    // Confirm deletion
    console.log('⚠️  WARNING: This will permanently delete all disabled feeds and their associated data!');
    console.log('📝 This includes:');
    console.log('   - Feed source records');
    console.log('   - All raw feed data');
    console.log('   - All processed content');
    console.log('   - Related queue jobs');
    console.log('');

    // For safety, require manual confirmation
    const shouldDelete = process.argv.includes('--confirm');
    
    if (!shouldDelete) {
      console.log('🛑 Deletion not confirmed. To actually delete, run:');
      console.log('   tsx src/scripts/delete-disabled-feeds.ts --confirm');
      console.log('');
      console.log('📋 Summary:');
      console.log(`   - Found ${disabledFeeds.length} disabled feeds`);
      console.log('   - No changes made (add --confirm to delete)');
      return;
    }

    console.log('🗑️  Starting deletion process...\n');

    let deletedCount = 0;
    let errorCount = 0;

    for (const feed of disabledFeeds) {
      try {
        console.log(`Deleting: ${feed.name}...`);

        // Delete the feed source (this should cascade delete related data)
        const { error: deleteError } = await supabase
          .from('feed_sources')
          .delete()
          .eq('id', feed.id);

        if (deleteError) {
          console.error(`❌ Error deleting ${feed.name}:`, deleteError);
          errorCount++;
        } else {
          console.log(`✅ Deleted: ${feed.name}`);
          deletedCount++;
        }
      } catch (error) {
        console.error(`❌ Error deleting ${feed.name}:`, error);
        errorCount++;
      }
    }

    console.log('\n🏁 Deletion complete!');
    console.log(`✅ Successfully deleted: ${deletedCount} feeds`);
    if (errorCount > 0) {
      console.log(`❌ Errors encountered: ${errorCount} feeds`);
    }

    // Verify deletion
    const { data: remainingDisabled, error: verifyError } = await supabase
      .from('feed_sources')
      .select('id, name')
      .eq('is_active', false);

    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError);
    } else {
      console.log(`\n📊 Verification: ${remainingDisabled?.length || 0} disabled feeds remaining`);
    }

    // Show active feeds count
    const { data: activeFeeds, error: activeError } = await supabase
      .from('feed_sources')
      .select('id')
      .eq('is_active', true);

    if (!activeError) {
      console.log(`✅ Active feeds remaining: ${activeFeeds?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Script error:', error);
    process.exit(1);
  }
}

// Run the script
deleteDisabledFeeds().then(() => {
  console.log('\n🎉 Script completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});