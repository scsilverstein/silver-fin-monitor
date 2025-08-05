import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.error('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'Set' : 'Not set');
  console.error('\nAvailable Supabase env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', '));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProcessedContent() {
  console.log('Checking processed_content table...\n');

  try {
    // Get count of records
    const { count, error: countError } = await supabase
      .from('processed_content')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting count:', countError);
      return;
    }

    console.log(`Total records in processed_content: ${count}\n`);

    // Get first few records with their actual content
    const { data: records, error } = await supabase
      .from('processed_content')
      .select(`
        id,
        raw_feed_id,
        processed_text,
        key_topics,
        sentiment_score,
        entities,
        summary,
        processing_metadata,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching records:', error);
      return;
    }

    if (!records || records.length === 0) {
      console.log('No records found in processed_content table');
      return;
    }

    console.log(`Showing ${records.length} most recent records:\n`);

    records.forEach((record, index) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Record ${index + 1}:`);
      console.log(`${'='.repeat(80)}`);
      
      console.log(`ID: ${record.id}`);
      console.log(`Raw Feed ID: ${record.raw_feed_id}`);
      console.log(`Created At: ${new Date(record.created_at).toLocaleString()}`);
      console.log(`Sentiment Score: ${record.sentiment_score || 'null'}`);
      
      console.log(`\nKey Topics: ${record.key_topics ? JSON.stringify(record.key_topics) : 'null'}`);
      
      console.log(`\nEntities: ${record.entities ? JSON.stringify(record.entities, null, 2) : 'null'}`);
      
      console.log(`\nSummary: ${record.summary || 'null'}`);
      
      console.log(`\nProcessed Text (first 500 chars):`);
      if (record.processed_text) {
        console.log(record.processed_text.substring(0, 500) + (record.processed_text.length > 500 ? '...' : ''));
      } else {
        console.log('null');
      }
      
      console.log(`\nProcessing Metadata: ${record.processing_metadata ? JSON.stringify(record.processing_metadata, null, 2) : 'null'}`);
    });

    // Also check for any records with actual content
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('Checking for records with non-null content...');
    console.log(`${'='.repeat(80)}\n`);

    const { data: contentRecords, error: contentError } = await supabase
      .from('processed_content')
      .select('id, created_at, summary, sentiment_score')
      .not('summary', 'is', null)
      .limit(10);

    if (contentError) {
      console.error('Error checking content records:', contentError);
      return;
    }

    if (contentRecords && contentRecords.length > 0) {
      console.log(`Found ${contentRecords.length} records with summaries:\n`);
      contentRecords.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}`);
        console.log(`   Created: ${new Date(record.created_at).toLocaleString()}`);
        console.log(`   Sentiment: ${record.sentiment_score}`);
        console.log(`   Summary: ${record.summary}\n`);
      });
    } else {
      console.log('No records found with non-null summaries');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkProcessedContent().catch(console.error);