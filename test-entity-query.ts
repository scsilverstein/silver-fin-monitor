import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEntityQuery() {
  try {
    console.log('Testing entity analytics query...\n');
    
    // Test the actual query from the controller
    const query = `
      SELECT 
        entity->>'name' as entity_name,
        entity->>'type' as entity_type,
        COUNT(*) as mention_count,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(DISTINCT source_id) as source_count
      FROM processed_content pc
      CROSS JOIN LATERAL jsonb_array_elements(entities) as entity
      WHERE pc.created_at >= NOW() - INTERVAL '7 days'
        AND entity->>'name' IS NOT NULL
      GROUP BY entity->>'name', entity->>'type'
      ORDER BY mention_count DESC
      LIMIT 20
    `;
    
    const { data, error } = await supabase.rpc('query', query);
    
    if (error) {
      console.error('Query error:', error);
      console.log('Trying direct table query instead...');
      
      // Try querying the table directly to see entities structure
      const { data: directData, error: directError } = await supabase
        .from('processed_content')
        .select('entities, sentiment_score, created_at')
        .not('entities', 'is', null)
        .limit(3);
        
      if (directError) {
        console.error('Direct query error:', directError);
        return;
      }
      
      console.log('Sample entities from direct query:');
      directData?.forEach((row: any, i: number) => {
        console.log(`${i+1}. Entities:`, JSON.stringify(row.entities, null, 2));
        console.log(`   Sentiment: ${row.sentiment_score}, Created: ${row.created_at}\n`);
      });
      return;
    }
    
    console.log('Query results:', data?.length || 0);
    if (data?.length > 0) {
      data.forEach((row: any, i: number) => {
        console.log(`${i+1}. ${row.entity_name} (${row.entity_type}): ${row.mention_count} mentions, sentiment: ${parseFloat(row.avg_sentiment).toFixed(2)}`);
      });
    } else {
      console.log('No results found. Let me try a simpler query...');
      
      // Test simpler query to understand the data structure
      const simpleQuery = `
        SELECT 
          entities,
          sentiment_score,
          created_at
        FROM processed_content 
        WHERE entities IS NOT NULL 
          AND jsonb_array_length(entities) > 0
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      const { data: simpleData, error: simpleError } = await supabase.rpc('execute_sql', { query: simpleQuery });
      
      if (simpleError) {
        console.error('Simple query error:', simpleError);
      } else {
        console.log('\nSample entities data:');
        simpleData?.forEach((row: any, i: number) => {
          console.log(`${i+1}. Entities:`, JSON.stringify(row.entities, null, 2));
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEntityQuery();