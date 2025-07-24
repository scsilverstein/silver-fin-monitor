// Script to apply database migrations
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrations() {
  console.log('Starting database migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20250719020736_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split the SQL into individual statements
    // This is a simple split - in production you'd want more robust SQL parsing
    const statements = migrationSQL
      .split(/;(?=\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SET|GRANT|REVOKE|BEGIN|COMMIT|ROLLBACK|--)\s)/i)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement ? statement.substring(0, 50).replace(/\n/g, ' ') : '';
      
      try {
        // For Supabase, we need to use the SQL editor endpoint
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Statement ${i + 1} failed: ${preview}...`);
          console.error(`   Error: ${error.message}`);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1} executed: ${preview}...`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Statement ${i + 1} failed: ${preview}...`);
        console.error(`   Error: ${err}`);
        errorCount++;
      }
    }
    
    console.log('\n========================================');
    console.log(`Migration Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('========================================\n');
    
    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. This might be because:');
      console.log('   - Tables/functions already exist');
      console.log('   - Missing permissions');
      console.log('   - Syntax differences in Supabase\n');
      console.log('You may need to apply the migration manually through the Supabase dashboard.');
    } else {
      console.log('🎉 All migrations applied successfully!');
    }
    
  } catch (error) {
    console.error('Failed to read or parse migration file:', error);
  }
}

// Alternative approach using direct SQL execution
async function applyMigrationsDirectly() {
  console.log('\nAttempting alternative migration approach...\n');
  
  try {
    // Since Supabase doesn't have a direct SQL execution endpoint,
    // we'll create the tables using the JS client
    
    // Check if tables already exist
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['feed_sources', 'raw_feeds', 'processed_content', 'daily_analysis', 'predictions', 'job_queue', 'cache_store']);
    
    if (tables && tables.length > 0) {
      console.log('⚠️  Some tables already exist:', tables.map(t => t.table_name).join(', '));
      console.log('   Skipping table creation...\n');
    }
    
    // Since we can't execute raw SQL, provide instructions
    console.log('📝 To apply the migrations:');
    console.log('1. Go to your Supabase dashboard: https://app.supabase.com');
    console.log('2. Select your project: silver-fin-monitor');
    console.log('3. Go to SQL Editor');
    console.log('4. Create a new query');
    console.log('5. Copy and paste the contents of:');
    console.log('   supabase/migrations/20250719020736_initial_schema.sql');
    console.log('6. Click "Run" to execute the migration\n');
    
    console.log('The migration file contains:');
    console.log('- 7 tables (feed_sources, raw_feeds, processed_content, etc.)');
    console.log('- 15 indexes for performance');
    console.log('- 10 database functions for queue and cache management');
    console.log('- Update triggers for timestamp management\n');
    
  } catch (error) {
    console.error('Error checking database state:', error);
  }
}

// Run the migration
console.log('=== Silver Fin Monitor Database Migration ===\n');
applyMigrations().then(() => {
  applyMigrationsDirectly();
}).catch(console.error);