#!/usr/bin/env npx tsx
/**
 * Reprocess Content with AI Entity Extraction
 * 
 * This script reprocesses existing content to extract entities using AI
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { contentProcessor } from '../src/services/content/processor.js';
import { QueueService } from '../src/services/workers/queue-worker.js';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!openaiKey) {
  console.error('❌ Missing OpenAI API key - required for entity extraction');
  console.log('📝 Add OPENAI_API_KEY to your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const queueService = new QueueService();

console.log('🔄 Starting Content Reprocessing with AI Entity Extraction...\n');

async function reprocessContent(limit: number = 50) {
  try {
    // Get content that needs reprocessing (no entities or processed with basic model)
    const { data: content, error } = await supabase
      .from('processed_content')
      .select(`
        id,
        raw_feed_id,
        processed_text,
        processing_metadata,
        entities,
        raw_feeds!inner(
          id,
          title,
          content,
          description
        )
      `)
      .or('entities.is.null,processing_metadata->aiModel.eq.basic')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('❌ Error fetching content:', error);
      return;
    }
    
    if (!content || content.length === 0) {
      console.log('✅ All content already has AI-extracted entities!');
      return;
    }
    
    console.log(`📊 Found ${content.length} items to reprocess\n`);
    
    let processed = 0;
    let failed = 0;
    
    for (const item of content) {
      try {
        console.log(`Processing: ${item.raw_feeds.title || 'Untitled'}...`);
        
        // Combine all text content
        const fullText = [
          item.raw_feeds.title || '',
          item.raw_feeds.description || '',
          item.raw_feeds.content || '',
          item.processed_text || ''
        ].join('\n\n');
        
        // Process with AI to extract entities
        const result = await contentProcessor.processContent({
          id: item.raw_feed_id,
          title: item.raw_feeds.title,
          content: fullText,
          description: item.raw_feeds.description,
          published_at: new Date(),
          source_id: '',
          external_id: '',
          metadata: {},
          processing_status: 'processing',
          created_at: new Date()
        });
        
        // Update the processed content with new entities
        const { error: updateError } = await supabase
          .from('processed_content')
          .update({
            entities: result.entities,
            key_topics: result.keyTopics,
            sentiment_score: result.sentimentScore,
            summary: result.summary,
            processing_metadata: result.processingMetadata
          })
          .eq('id', item.id);
          
        if (updateError) {
          console.error(`   ❌ Update failed: ${updateError.message}`);
          failed++;
        } else {
          console.log(`   ✅ Extracted ${result.entities.length} entities`);
          if (result.entities.length > 0) {
            console.log(`   📋 Types: ${[...new Set(result.entities.map(e => e.type))].join(', ')}`);
          }
          processed++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Processing failed: ${error.message}`);
        failed++;
      }
    }
    
    console.log('\n📈 Reprocessing Complete:');
    console.log(`   ✅ Successfully processed: ${processed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Success rate: ${Math.round(processed/(processed+failed)*100)}%`);
    
  } catch (error) {
    console.error('❌ Reprocessing error:', error);
  }
}

// Command line arguments
const args = process.argv.slice(2);
const limit = args[0] ? parseInt(args[0]) : 50;

console.log(`📝 Reprocessing up to ${limit} content items...\n`);

// Run reprocessing
reprocessContent(limit).then(() => {
  console.log('\n✅ Reprocessing complete!');
  console.log('🔍 Check Entity Analytics at: http://localhost:5173/entity-analytics');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});