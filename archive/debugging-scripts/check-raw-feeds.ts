import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkRawFeeds() {
  console.log('Checking raw_feeds table...');
  
  const feedId = '9e85edf4-cc29-48f0-ad25-7453e9c2e42e'; // CNBC feed
  
  // Count total raw feeds
  const { count: totalCount } = await supabase
    .from('raw_feeds')
    .select('*', { count: 'exact', head: true });
    
  console.log(`Total raw_feeds: ${totalCount}`);
  
  // Check for specific feed
  const { data: specificFeeds, error } = await supabase
    .from('raw_feeds')
    .select('id, source_id, title, published_at, processing_status')
    .eq('source_id', feedId)
    .limit(5);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`\nRaw feeds for CNBC (${feedId}):`);
    console.log(JSON.stringify(specificFeeds, null, 2));
  }
  
  // Check all source_ids in raw_feeds
  const { data: allSourceIds } = await supabase
    .from('raw_feeds')
    .select('source_id')
    .limit(10);
    
  console.log('\nUnique source_ids in raw_feeds:');
  const uniqueIds = [...new Set(allSourceIds?.map(f => f.source_id) || [])];
  console.log(uniqueIds);
}

checkRawFeeds().catch(console.error);