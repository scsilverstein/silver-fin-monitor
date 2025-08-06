#!/usr/bin/env npx tsx
/**
 * Check Topic Data - Diagnose why topics aren't showing in the chart
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTopicsData() {
  console.log('🔍 Checking Topics Data...\n');
  
  // 1. Check if processed content has key_topics
  console.log('1️⃣ Checking processed content for topics:');
  const { data: content, error: contentError } = await supabase
    .from('processed_content')
    .select('id, key_topics, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (contentError) {
    console.error('❌ Error fetching content:', contentError);
    return;
  }
  
  if (!content || content.length === 0) {
    console.log('❌ No processed content found');
    return;
  }
  
  // Count content with topics
  const withTopics = content.filter(c => c.key_topics && c.key_topics.length > 0);
  console.log(`   ✅ Found ${content.length} processed items`);
  console.log(`   📊 Items with topics: ${withTopics.length}/${content.length} (${Math.round(withTopics.length/content.length*100)}%)`);
  
  // Show sample topics
  if (withTopics.length > 0) {
    console.log('\n   Sample topics from recent content:');
    withTopics.slice(0, 3).forEach((item, idx) => {
      console.log(`   ${idx + 1}. Topics: ${item.key_topics.join(', ')}`);
    });
  } else {
    console.log('   ⚠️  No content has topics! This is why the chart is empty.');
  }
  
  // 2. Check topic distribution over time
  console.log('\n2️⃣ Checking topic trends over last 7 days:');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentContent, error: recentError } = await supabase
    .from('processed_content')
    .select('key_topics, created_at')
    .gte('created_at', sevenDaysAgo.toISOString());
    
  if (recentError) {
    console.error('❌ Error fetching recent content:', recentError);
    return;
  }
  
  // Aggregate topics by day
  const topicsByDay = new Map<string, Map<string, number>>();
  recentContent?.forEach(item => {
    if (item.key_topics && item.key_topics.length > 0) {
      const day = item.created_at.split('T')[0];
      if (!topicsByDay.has(day)) {
        topicsByDay.set(day, new Map());
      }
      const dayTopics = topicsByDay.get(day)!;
      item.key_topics.forEach((topic: string) => {
        dayTopics.set(topic, (dayTopics.get(topic) || 0) + 1);
      });
    }
  });
  
  console.log(`   📅 Days with topic data: ${topicsByDay.size}`);
  
  if (topicsByDay.size > 0) {
    console.log('\n   Topics by day:');
    Array.from(topicsByDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, topics]) => {
        const topTopics = Array.from(topics.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([topic, count]) => `${topic} (${count})`)
          .join(', ');
        console.log(`   ${date}: ${topTopics}`);
      });
  }
  
  // 3. Check if AI processing is enabled
  console.log('\n3️⃣ Checking processing methods:');
  const { data: processingMeta } = await supabase
    .from('processed_content')
    .select('processing_metadata')
    .order('created_at', { ascending: false })
    .limit(5);
    
  const aiProcessed = processingMeta?.filter(item => 
    item.processing_metadata?.aiModel && 
    item.processing_metadata.aiModel !== 'basic'
  ).length || 0;
  
  console.log(`   🤖 AI processed: ${aiProcessed}/${processingMeta?.length || 0}`);
  
  if (aiProcessed === 0) {
    console.log('   ⚠️  No content processed with AI! Topics extraction requires AI.');
    console.log('   💡 Solution: Set OPENAI_API_KEY and reprocess content');
  }
  
  // 4. Summary and recommendations
  console.log('\n📋 Summary:');
  if (withTopics.length === 0) {
    console.log('   ❌ No topics found in processed content');
    console.log('\n💡 Recommendations:');
    console.log('   1. Ensure OPENAI_API_KEY is set in .env');
    console.log('   2. Run: npm run scripts:reprocess-content');
    console.log('   3. Or process new feeds: npm run queue:process');
  } else if (withTopics.length < content.length / 2) {
    console.log('   ⚠️  Only some content has topics');
    console.log('\n💡 Recommendations:');
    console.log('   1. Reprocess content without topics');
    console.log('   2. Check for processing errors in logs');
  } else {
    console.log('   ✅ Topics are being extracted correctly');
    console.log('   📊 Chart should display data properly');
  }
}

// Run the check
checkTopicsData().catch(console.error);