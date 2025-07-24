import { db } from './src/services/database/index';

async function testSimpleEntities() {
  try {
    console.log('Testing simple entity queries...\n');
    
    // Connect to database first
    await db.connect();
    
    // Test 1: Look for any data in the last month
    console.log('1. Recent processed content count:');
    const recentCount = await db.query(`
      SELECT COUNT(*) as count 
      FROM processed_content 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    console.log('Recent content:', recentCount[0].count);
    
    // Test 2: Check what entity formats we have
    console.log('\n2. Entity formats in database:');
    const entityFormats = await db.query(`
      SELECT 
        jsonb_typeof(entities) as entity_type,
        COUNT(*) as count,
        entities as sample_entities
      FROM processed_content 
      WHERE entities IS NOT NULL
      GROUP BY jsonb_typeof(entities), entities
      ORDER BY count DESC
      LIMIT 10
    `);
    entityFormats.forEach((row, i) => {
      console.log(`${i+1}. Type: ${row.entity_type}, Count: ${row.count}`);
      const sampleStr = JSON.stringify(row.sample_entities);
      console.log(`   Sample: ${sampleStr ? sampleStr.substring(0, 200) + '...' : 'null'}`);
    });
    
    // Test 3: Try to get entities from the new format specifically
    console.log('\n3. Testing new format (nested object):');
    const newFormatTest = await db.query(`
      SELECT 
        id,
        entities->'companies' as companies,
        entities->'tickers' as tickers,
        sentiment_score,
        created_at
      FROM processed_content 
      WHERE entities IS NOT NULL
        AND jsonb_typeof(entities) = 'object'
        AND entities ? 'companies'
        AND jsonb_array_length(entities->'companies') > 0
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('Found', newFormatTest.length, 'items with companies in new format');
    newFormatTest.forEach((row, i) => {
      console.log(`${i+1}. Companies: ${JSON.stringify(row.companies)}, Created: ${row.created_at}`);
    });
    
    // Test 4: Try to get entities from the old format
    console.log('\n4. Testing old format (array of objects):');
    const oldFormatTest = await db.query(`
      SELECT 
        id,
        entities,
        sentiment_score,
        created_at
      FROM processed_content 
      WHERE entities IS NOT NULL
        AND jsonb_typeof(entities) = 'array'
        AND jsonb_array_length(entities) > 0
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('Found', oldFormatTest.length, 'items with entities in old format');
    oldFormatTest.forEach((row, i) => {
      console.log(`${i+1}. Entities: ${JSON.stringify(row.entities)}, Created: ${row.created_at}`);
    });
    
    // Test 5: Try the exact query from our controller
    console.log('\n5. Testing controller query (simplified):');
    const controllerTest = await db.query(`
      SELECT 
        jsonb_array_elements_text(entities->'companies') as entity_name,
        'company' as entity_type,
        COUNT(*) as mention_count
      FROM processed_content pc
      WHERE pc.created_at >= NOW() - INTERVAL '7 days'
        AND entities->'companies' IS NOT NULL
        AND jsonb_array_length(entities->'companies') > 0
      GROUP BY entity_name
      ORDER BY mention_count DESC
      LIMIT 10
    `);
    console.log('Controller query results:', controllerTest.length);
    controllerTest.forEach((row, i) => {
      console.log(`${i+1}. ${row.entity_name}: ${row.mention_count} mentions`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSimpleEntities();