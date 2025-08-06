// Simple test script to create sample data for testing
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnjtzwqieqcrchhjouaz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestData() {
  try {
    console.log('Creating test data...');
    
    // 1. Get first feed source
    const { data: feedSources } = await supabase
      .from('feed_sources')
      .select('id')
      .limit(1);
    
    if (!feedSources || feedSources.length === 0) {
      console.error('No feed sources found');
      return;
    }
    
    const sourceId = feedSources[0].id;
    console.log('Using feed source:', sourceId);
    
    // 2. Create a raw feed
    const { data: rawFeed, error: rawFeedError } = await supabase
      .from('raw_feeds')
      .insert({
        source_id: sourceId,
        title: 'Test Market Analysis Feed',
        description: 'Test content for market analysis',
        content: 'Market analysis content for testing purposes. The market shows bullish sentiment with strong growth indicators.',
        published_at: new Date().toISOString(),
        external_id: 'test-' + Date.now(),
        processing_status: 'completed'
      })
      .select()
      .single();
    
    if (rawFeedError) {
      console.error('Error creating raw feed:', rawFeedError);
      return;
    }
    
    console.log('Created raw feed:', rawFeed.id);
    
    // 3. Create processed content
    const { data: processedContent, error: processedError } = await supabase
      .from('processed_content')
      .insert({
        raw_feed_id: rawFeed.id,
        processed_text: 'Market analysis shows bullish sentiment with technology stocks leading gains. Economic indicators point to continued growth with inflation remaining stable.',
        key_topics: ['market_analysis', 'technology', 'economic_indicators', 'inflation', 'growth'],
        sentiment_score: 0.7,
        entities: {
          companies: ['Apple', 'Microsoft', 'Google'],
          sectors: ['Technology', 'Finance'],
          indicators: ['GDP', 'Inflation', 'Employment']
        },
        summary: 'Market shows positive sentiment with tech sector outperforming. Economic data supports continued bullish outlook.',
        processing_metadata: {
          processor_version: '1.0.0',
          created_for_testing: true
        }
      })
      .select();
    
    if (processedError) {
      console.error('Error creating processed content:', processedError);
      return;
    }
    
    console.log('Created processed content:', processedContent[0].id);
    
    // 4. Create a few more pieces of content for variety
    for (let i = 0; i < 3; i++) {
      await supabase
        .from('raw_feeds')
        .insert({
          source_id: sourceId,
          title: `Test Content ${i + 2}`,
          description: `Test description ${i + 2}`,
          content: `Market content ${i + 2} with various sentiment indicators.`,
          published_at: new Date(Date.now() - (i * 3600000)).toISOString(), // Stagger by hours
          external_id: `test-${Date.now()}-${i}`,
          processing_status: 'completed'
        })
        .select()
        .single()
        .then(({ data: rf }) => {
          if (rf) {
            return supabase
              .from('processed_content')
              .insert({
                raw_feed_id: rf.id,
                processed_text: `Market analysis content ${i + 2} with sentiment score ${0.3 + (i * 0.2)}.`,
                key_topics: ['market', 'analysis', `topic_${i}`],
                sentiment_score: 0.3 + (i * 0.2),
                entities: { test: true },
                summary: `Summary ${i + 2} for market analysis.`,
                processing_metadata: { test: true }
              });
          }
        });
    }
    
    console.log('✅ Test data created successfully!');
    console.log('You can now run daily analysis and prediction generation.');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  }
}

createTestData();