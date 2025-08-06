import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

async function checkTableSchema() {
  try {
    // Get table info using a simple query
    const { data, error } = await supabase
      .from('daily_analysis')
      .select('*')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error querying table:', error);
      return;
    }
    
    console.log('Sample daily_analysis record:', data);
    
    // Try a minimal insert to see what fields are required
    console.log('\nAttempting minimal insert...');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkTableSchema()
  .then(() => {
    console.log('\nScript completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });