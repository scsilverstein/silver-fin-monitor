import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function createTestFeedItems() {
  console.log('Creating test feed items...');
  
  // Get all feed sources
  const { data: feedSources, error: feedError } = await supabase
    .from('feed_sources')
    .select('id, name')
    .limit(5);
    
  if (feedError) {
    console.error('Error fetching feed sources:', feedError);
    return;
  }
  
  console.log(`Found ${feedSources?.length || 0} feed sources`);
  
  // Create test items for each feed
  for (const source of feedSources || []) {
    console.log(`Creating items for ${source.name}...`);
    
    const testItems = [
      {
        source_id: source.id,
        title: `Test Item 1 for ${source.name}`,
        description: 'This is a test feed item with proper date',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        published_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        external_id: `test-${source.id}-1`,
        metadata: { test: true },
        processing_status: 'pending'
      },
      {
        source_id: source.id,
        title: `Test Item 2 for ${source.name}`,
        description: 'Another test item with different status',
        content: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        external_id: `test-${source.id}-2`,
        metadata: { test: true },
        processing_status: 'completed'
      },
      {
        source_id: source.id,
        title: `Test Item 3 for ${source.name}`,
        description: 'Processing test item',
        content: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco.',
        published_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        external_id: `test-${source.id}-3`,
        metadata: { test: true },
        processing_status: 'processing'
      }
    ];
    
    const { error: insertError } = await supabase
      .from('raw_feeds')
      .insert(testItems);
      
    if (insertError) {
      console.error(`Error inserting items for ${source.name}:`, insertError);
    } else {
      console.log(`Created ${testItems.length} items for ${source.name}`);
    }
  }
  
  console.log('Done creating test feed items!');
}

createTestFeedItems().catch(console.error);