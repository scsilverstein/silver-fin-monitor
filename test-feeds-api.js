const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pnjtzwqieqcrchhjouaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI'
);

async function testFeedQuery() {
  console.log('Testing feeds query similar to controller...');
  
  try {
    // Mimic the exact query from the controller
    let query = supabase.from('feed_sources').select('*', { count: 'exact' });
    
    // Add pagination like the controller
    const limit = 20;
    const offset = 0;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: feeds, error, count } = await query;
    
    console.log('Query result:', {
      success: !error,
      feedCount: feeds?.length,
      total: count,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details
    });
    
    if (feeds && feeds.length > 0) {
      console.log('First feed:', feeds[0]);
    }
    
  } catch (err) {
    console.log('Caught error:', err);
  }
}

testFeedQuery();