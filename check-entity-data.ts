import { db } from './src/services/database/index';

async function checkEntityData() {
  try {
    console.log('Checking entity data in database...\n');
    
    // Connect to database first
    await db.connect();
    
    // Check if we have processed content with entities
    const contentCount = await db.query('SELECT COUNT(*) as count FROM processed_content');
    console.log('Total processed content:', contentCount[0].count);
    
    // Check if entities field exists and has data
    const entitiesCount = await db.query(`
      SELECT COUNT(*) as count 
      FROM processed_content 
      WHERE entities IS NOT NULL 
      AND jsonb_array_length(entities) > 0
    `);
    console.log('Content with entities:', entitiesCount[0].count);
    
    // Check recent processed content
    const recentContent = await db.query(`
      SELECT id, summary, entities, sentiment_score, created_at 
      FROM processed_content 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('\nRecent processed content:');
    recentContent.forEach((row, i) => {
      console.log(`${i+1}. ${row.summary?.substring(0, 100)}...`);
      console.log(`   Entities: ${row.entities ? JSON.stringify(row.entities).substring(0, 200) : 'null'}...`);
      console.log(`   Sentiment: ${row.sentiment_score}, Created: ${row.created_at}\n`);
    });
    
    // Try to get some entity aggregation
    if (entitiesCount[0].count > 0) {
      const entityStats = await db.query(`
        SELECT 
          entity->>'name' as entity_name,
          entity->>'type' as entity_type,
          COUNT(*) as mention_count,
          AVG(sentiment_score) as avg_sentiment
        FROM processed_content pc
        CROSS JOIN LATERAL jsonb_array_elements(entities) as entity
        WHERE pc.created_at >= NOW() - INTERVAL '30 days'
          AND entity->>'name' IS NOT NULL
        GROUP BY entity->>'name', entity->>'type'
        ORDER BY mention_count DESC
        LIMIT 10
      `);
      
      console.log('Top entities by mentions:');
      entityStats.forEach((row, i) => {
        console.log(`${i+1}. ${row.entity_name} (${row.entity_type}): ${row.mention_count} mentions, avg sentiment: ${parseFloat(row.avg_sentiment).toFixed(2)}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEntityData();