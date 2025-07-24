const { createClient } = require('@supabase/supabase-js');

// Simulate the database service
const supabase = createClient(
  'https://pnjtzwqieqcrchhjouaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI'
);

const mockDb = {
  getClient: () => supabase,
  query: async (sql, params) => {
    console.log('Mock db.query called:', { sql, params });
    throw new Error('db.query not implemented in test');
  }
};

// Simulate the cache service
const mockCache = {
  get: async (key) => {
    console.log('Mock cache.get called:', key);
    return null; // Cache miss
  },
  set: async (key, value, ttl) => {
    console.log('Mock cache.set called:', { key, ttl });
  },
  invalidateByTag: async (tag) => {
    console.log('Mock cache.invalidateByTag called:', tag);
  }
};

async function testListFeeds() {
  console.log('Testing listFeeds logic...');
  
  try {
    const req = { query: { limit: 20, offset: 0 } };
    
    // Simulate the controller logic
    const { type, category, isActive, limit = 20, offset = 0 } = req.query;
    
    console.log('Query params:', { type, category, isActive, limit, offset });

    // Get feeds from database using Supabase client directly
    const client = mockDb.getClient();
    let query = client.from('feed_sources').select('*', { count: 'exact' });
    
    if (type) query = query.eq('type', type);
    if (isActive !== undefined) query = query.eq('is_active', isActive === 'true');
    
    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: feeds, error, count } = await query;
    
    console.log('Query result:', {
      success: !error,
      feedCount: feeds?.length,
      total: count,
      error: error?.message
    });
    
    if (error) {
      console.log('Database error details:', error);
      throw new Error(`Failed to fetch feeds: ${error.message}`);
    }
    
    const total = count || 0;
    const filteredFeeds = feeds || [];

    const response = {
      success: true,
      data: filteredFeeds,
      meta: {
        total,
        page: Math.floor(Number(offset) / Number(limit)) + 1,
        limit: Number(limit)
      }
    };
    
    console.log('Response structure:', {
      success: response.success,
      dataLength: response.data.length,
      meta: response.meta
    });
    
  } catch (error) {
    console.log('Caught error:', error.message);
    console.log('Error details:', error);
  }
}

testListFeeds();