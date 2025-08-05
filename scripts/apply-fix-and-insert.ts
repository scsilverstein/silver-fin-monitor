import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFixAndInsert() {
  const targetDate = '2025-07-30';
  
  try {
    // Read the migration file
    const migrationPath = resolve(__dirname, '../supabase/migrations/050_fix_daily_analysis_trigger.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('Applying migration to fix daily_analysis table...');
    
    // Note: Supabase doesn't have a direct SQL execution method via the client
    // So we'll need to apply this through the Supabase dashboard or CLI
    console.log('Migration SQL to apply:');
    console.log(migrationSQL);
    console.log('\nPlease apply this migration through Supabase dashboard or CLI.');
    console.log('Then run: npx tsx scripts/check-and-insert-daily-analysis.ts');
    
    // For now, let's check if the column exists
    const { data: tableInfo, error: infoError } = await supabase
      .from('daily_analysis')
      .select('*')
      .limit(0);
    
    console.log('\nCurrent table structure check completed.');
    console.log('To proceed:');
    console.log('1. Go to Supabase SQL Editor');
    console.log('2. Run: ALTER TABLE daily_analysis ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT \'{}\';');
    console.log('3. Then run the insert script again');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run
applyFixAndInsert()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });