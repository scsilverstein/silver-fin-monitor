import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Create Supabase client with service key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseSchema() {
  console.log('Checking database schema...\n');
  
  try {
    // Check all tables
    console.log('Fetching all tables in public schema...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_all_tables');
    
    if (tablesError) {
      // Try alternative approach
      const { data: rawData, error: rawError } = await supabase
        .from('daily_analysis')
        .select()
        .limit(0);
      
      if (!rawError) {
        console.log('✓ daily_analysis table exists');
      } else {
        console.log('✗ daily_analysis table error:', rawError.message);
      }
    } else if (tables) {
      console.log('Tables found:', tables);
    }

    // Check daily_analysis structure by attempting a query
    console.log('\nChecking daily_analysis table structure...');
    const { data: sampleData, error: structureError } = await supabase
      .from('daily_analysis')
      .select()
      .limit(1);
    
    if (!structureError) {
      console.log('✓ daily_analysis table is accessible');
      
      // Get column info from a dummy insert attempt
      const { error: insertError } = await supabase
        .from('daily_analysis')
        .insert({})
        .select();
      
      if (insertError) {
        console.log('\nTable structure hints from error:', insertError.message);
      }
    }

    // Check other related tables
    const tablesToCheck = [
      'feed_sources',
      'raw_feeds', 
      'processed_content',
      'predictions',
      'job_queue',
      'cache_store'
    ];

    console.log('\nChecking existence of other core tables:');
    for (const table of tablesToCheck) {
      const { error } = await supabase
        .from(table)
        .select()
        .limit(0);
      
      if (!error) {
        console.log(`✓ ${table} exists`);
      } else {
        console.log(`✗ ${table}: ${error.message}`);
      }
    }

    // Count records in key tables
    console.log('\nChecking record counts in key tables:');
    for (const table of ['feed_sources', 'raw_feeds', 'processed_content', 'daily_analysis', 'predictions']) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`${table}: ${count} records`);
      }
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the check
checkDatabaseSchema().then(() => {
  console.log('\nSchema check complete.');
  process.exit(0);
}).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});