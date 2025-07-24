#!/usr/bin/env npx tsx
/**
 * Diagnose Entity Extraction Issues
 * 
 * This script helps identify why entities aren't being populated in your system
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Diagnosing Entity Extraction Issues...\n');

async function checkConfiguration() {
  console.log('1️⃣ Checking Configuration:');
  console.log(`   ✅ Supabase URL: ${supabaseUrl}`);
  console.log(`   ${openaiKey ? '✅' : '❌'} OpenAI API Key: ${openaiKey ? 'Configured' : 'NOT CONFIGURED'}`);
  
  if (!openaiKey) {
    console.log('\n   ⚠️  Without OpenAI API key, only basic entity extraction will work.');
    console.log('   📝 Basic extraction only finds: exchanges, indexes, and potential tickers.\n');
  } else {
    // Test OpenAI connection
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      await openai.models.list();
      console.log('   ✅ OpenAI connection successful\n');
    } catch (error) {
      console.log('   ❌ OpenAI connection failed:', error.message);
      console.log('   📝 Please check your API key\n');
    }
  }
}

async function checkProcessedContent() {
  console.log('2️⃣ Checking Processed Content:');
  
  // Get recent processed content
  const { data: content, error } = await supabase
    .from('processed_content')
    .select('id, created_at, entities, processing_metadata')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.log('   ❌ Error fetching content:', error.message);
    return;
  }
  
  if (!content || content.length === 0) {
    console.log('   ❌ No processed content found');
    return;
  }
  
  console.log(`   ✅ Found ${content.length} processed items\n`);
  
  // Analyze entity extraction
  let withEntities = 0;
  let withAI = 0;
  let entityTypes = new Set<string>();
  let totalEntities = 0;
  
  content.forEach(item => {
    if (item.entities && Array.isArray(item.entities) && item.entities.length > 0) {
      withEntities++;
      totalEntities += item.entities.length;
      
      item.entities.forEach((entity: any) => {
        if (entity.type) {
          entityTypes.add(entity.type);
        }
      });
    }
    
    if (item.processing_metadata?.aiModel && item.processing_metadata.aiModel !== 'basic') {
      withAI++;
    }
  });
  
  console.log('3️⃣ Entity Extraction Analysis:');
  console.log(`   📊 Content with entities: ${withEntities}/${content.length} (${Math.round(withEntities/content.length*100)}%)`);
  console.log(`   🤖 Content processed with AI: ${withAI}/${content.length} (${Math.round(withAI/content.length*100)}%)`);
  console.log(`   📈 Total entities found: ${totalEntities}`);
  console.log(`   🏷️  Entity types found: ${Array.from(entityTypes).join(', ') || 'None'}\n`);
  
  if (withEntities === 0) {
    console.log('   ⚠️  No entities found in recent content!');
    console.log('   Possible causes:');
    console.log('   - OpenAI API key not configured');
    console.log('   - Content processing failed');
    console.log('   - Content doesn\'t contain recognizable entities\n');
  }
  
  // Show example entity
  const itemWithEntities = content.find(item => 
    item.entities && Array.isArray(item.entities) && item.entities.length > 0
  );
  
  if (itemWithEntities) {
    console.log('4️⃣ Example Entity Structure:');
    console.log(JSON.stringify(itemWithEntities.entities.slice(0, 3), null, 2));
  }
}

async function checkRecentFeeds() {
  console.log('\n5️⃣ Checking Recent Feed Processing:');
  
  const { data: feeds, error } = await supabase
    .from('raw_feeds')
    .select('id, title, processing_status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.log('   ❌ Error fetching feeds:', error.message);
    return;
  }
  
  const statusCounts = feeds.reduce((acc: any, feed: any) => {
    acc[feed.processing_status] = (acc[feed.processing_status] || 0) + 1;
    return acc;
  }, {});
  
  console.log('   Feed Processing Status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });
  
  const failed = feeds.filter(f => f.processing_status === 'failed');
  if (failed.length > 0) {
    console.log(`\n   ⚠️  ${failed.length} feeds failed processing`);
    console.log('   Failed feeds:', failed.map(f => f.title).slice(0, 3).join(', '));
  }
}

async function suggestFixes() {
  console.log('\n\n🔧 Suggested Fixes:');
  
  if (!openaiKey) {
    console.log('\n1. Configure OpenAI API Key:');
    console.log('   Add to your .env file:');
    console.log('   OPENAI_API_KEY=your_api_key_here\n');
  }
  
  console.log('2. Reprocess existing content with AI:');
  console.log('   Run: npm run scripts:reprocess-content\n');
  
  console.log('3. Process new feeds:');
  console.log('   Run: npm run queue:process\n');
  
  console.log('4. Check the Entity Analytics page:');
  console.log('   Visit: http://localhost:5173/entity-analytics\n');
}

// Run diagnostics
async function main() {
  try {
    await checkConfiguration();
    await checkProcessedContent();
    await checkRecentFeeds();
    await suggestFixes();
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

main();