#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pnjtzwqieqcrchhjouaz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuanR6d3FpZXFjcmNoaGpvdWF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjg2NDcxOSwiZXhwIjoyMDY4NDQwNzE5fQ.DZiD1TxAFnaK_ca7OBVcmyuiYXF4Dn4UmrSoovJ7PJI'
);

async function testNormalizedTopics() {
  console.log('=== TESTING NORMALIZED TOPIC MENTIONS ===\n');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  // Get topic data with content count per day
  const { data: topicData } = await supabase
    .from('processed_content')
    .select('key_topics, created_at')
    .gte('created_at', startDate.toISOString());

  if (!topicData || topicData.length === 0) {
    console.log('No topic data found');
    return;
  }

  const topicCounts = new Map<string, Map<string, number>>();
  const dailyContentCounts = new Map<string, number>();
  
  topicData.forEach(item => {
    const day = item.created_at.split('T')[0];
    
    // Track total content items per day
    dailyContentCounts.set(day, (dailyContentCounts.get(day) || 0) + 1);
    
    if (!topicCounts.has(day)) {
      topicCounts.set(day, new Map());
    }
    const dayTopics = topicCounts.get(day)!;
    item.key_topics.forEach((topic: string) => {
      dayTopics.set(topic, (dayTopics.get(topic) || 0) + 1);
    });
  });

  console.log('Daily Content Counts:');
  Array.from(dailyContentCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} items`);
    });

  console.log('\nNormalized Topic Mentions (% of daily content):');
  Array.from(topicCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, topics]) => {
      const totalContentItems = dailyContentCounts.get(date) || 1;
      console.log(`\n${date} (${totalContentItems} items):`);
      
      Array.from(topics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([topic, rawCount]) => {
          const percentage = (rawCount / totalContentItems * 100).toFixed(1);
          console.log(`  ${topic}: ${rawCount} mentions = ${percentage}%`);
        });
    });
}

testNormalizedTopics().catch(console.error);