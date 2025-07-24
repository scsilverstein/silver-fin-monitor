import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying prediction_comparisons migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '012_add_prediction_comparisons.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If exec_sql doesn't exist, try a different approach
      console.log('Direct SQL execution not available, checking if table already exists...');
      
      // Check if table exists
      const { data: tableCheck, error: checkError } = await supabase
        .from('prediction_comparisons')
        .select('id')
        .limit(1);
      
      if (!checkError || checkError.code === 'PGRST116') {
        console.log('Table prediction_comparisons already exists or was created successfully!');
      } else {
        console.error('Error checking table:', checkError);
        console.log('\nPlease run the following SQL manually in your Supabase SQL editor:');
        console.log('----------------------------------------');
        console.log(migrationSQL);
        console.log('----------------------------------------');
      }
    } else {
      console.log('Migration applied successfully!');
    }
    
    // Verify the table was created
    const { data, error: verifyError } = await supabase
      .from('prediction_comparisons')
      .select('count')
      .limit(1);
    
    if (!verifyError) {
      console.log('✅ Table prediction_comparisons verified successfully!');
    } else {
      console.log('❌ Could not verify table creation:', verifyError.message);
    }
    
  } catch (error) {
    console.error('Error applying migration:', error);
    console.log('\nPlease run the migration manually in your Supabase SQL editor.');
  }
}

applyMigration();