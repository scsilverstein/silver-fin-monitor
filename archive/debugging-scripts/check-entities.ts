import { supabase } from '../src/services/database/client';
import { logger } from '../src/utils/logger';

async function checkEntities() {
  try {
    // Get all processed content with entities
    const { data: content, error } = await supabase
      .from('processed_content')
      .select('id, entities, created_at')
      .not('entities', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error('Failed to fetch content', { error });
      return;
    }

    console.log(`Found ${content?.length || 0} content items with entities\n`);

    // Aggregate all entities
    const entityCounts = new Map<string, { type: string; count: number }>();

    content?.forEach(item => {
      if (item.entities && typeof item.entities === 'object') {
        // Handle different entity structures
        if (Array.isArray(item.entities)) {
          // entities is an array
          item.entities.forEach((entity: any) => {
            const name = entity.name || entity.text || entity;
            const type = entity.type || 'unknown';
            const key = `${name}|${type}`;
            
            if (entityCounts.has(key)) {
              entityCounts.get(key)!.count++;
            } else {
              entityCounts.set(key, { type, count: 1 });
            }
          });
        } else if (typeof item.entities === 'object') {
          // entities is an object with categories
          Object.entries(item.entities).forEach(([category, entities]: [string, any]) => {
            if (Array.isArray(entities)) {
              entities.forEach((entity: any) => {
                const name = typeof entity === 'string' ? entity : entity.name || entity.text;
                const type = category;
                const key = `${name}|${type}`;
                
                if (entityCounts.has(key)) {
                  entityCounts.get(key)!.count++;
                } else {
                  entityCounts.set(key, { type, count: 1 });
                }
              });
            }
          });
        }
      }
    });

    // Sort by count and display
    const sortedEntities = Array.from(entityCounts.entries())
      .map(([key, data]) => {
        const [name] = key.split('|');
        return { name, ...data };
      })
      .sort((a, b) => b.count - a.count);

    console.log('Top Entities Found:');
    console.log('==================');
    
    // Group by type
    const byType: Record<string, any[]> = {};
    sortedEntities.forEach(entity => {
      if (!byType[entity.type]) {
        byType[entity.type] = [];
      }
      byType[entity.type].push(entity);
    });

    Object.entries(byType).forEach(([type, entities]) => {
      console.log(`\n${type.toUpperCase()} (${entities.length} unique):`);
      entities.slice(0, 10).forEach(entity => {
        console.log(`  - ${entity.name}: ${entity.count} mentions`);
      });
      if (entities.length > 10) {
        console.log(`  ... and ${entities.length - 10} more`);
      }
    });

    console.log(`\nTotal unique entities: ${sortedEntities.length}`);
    console.log(`Total entity mentions: ${sortedEntities.reduce((sum, e) => sum + e.count, 0)}`);

    // Check a specific content item to see entity structure
    if (content && content.length > 0) {
      console.log('\nSample entity structure from latest content:');
      console.log(JSON.stringify(content[0].entities, null, 2));
    }

  } catch (error) {
    logger.error('Failed to check entities', { error });
  } finally {
    process.exit(0);
  }
}

checkEntities();