#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

async function checkFeeds() {
  const { data: feeds, error } = await supabase
    .from('feed_sources')
    .select('id, name, type, is_active, last_processed_at')
    .order('name');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Feed Sources Status:');
  console.log('==================');
  feeds?.forEach(feed => {
    console.log(`${feed.is_active ? '✅' : '❌'} ${feed.name}`);
    console.log(`   Type: ${feed.type}`);
    console.log(`   Active: ${feed.is_active}`);
    console.log(`   Last Processed: ${feed.last_processed_at || 'Never'}`);
    console.log('');
  });
  
  const activeCount = feeds?.filter(f => f.is_active).length || 0;
  const inactiveCount = feeds?.filter(f => !f.is_active).length || 0;
  
  console.log(`Summary: ${activeCount} active, ${inactiveCount} inactive`);
}

checkFeeds().catch(console.error);