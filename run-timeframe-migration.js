const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
require('dotenv').config();

async function runMigration() {
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: { persistSession: false }
    }
  );

  console.log('Running timeframe analysis migration...');

  try {
    // Read the migration file
    const migration = readFileSync('./supabase/migrations/011_add_timeframe_analysis.sql', 'utf-8');
    
    // Split into individual statements
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        const { data, error } = await supabase.rpc('query', {
          query: statement
        });
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error);
          // Continue with next statement for non-critical errors
          if (error.message && !error.message.includes('already exists')) {
            throw error;
          }
        }
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();