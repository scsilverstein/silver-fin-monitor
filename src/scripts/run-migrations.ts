import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrations() {
  const migrations = [
    '001_create_tables.sql',
    '002_create_functions.sql',
    '003_seed_feeds.sql'
  ];

  console.log('Starting database migrations...');

  for (const migration of migrations) {
    try {
      console.log(`Running migration: ${migration}`);
      const sqlPath = join(__dirname, '../database/migrations', migration);
      const sql = readFileSync(sqlPath, 'utf-8');
      
      // Split SQL into individual statements (Supabase doesn't support multiple statements in one call)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        // Skip comments
        if (statement.startsWith('--')) continue;
        
        // Execute via Supabase SQL editor endpoint (if available) or as individual operations
        // For now, we'll need to run these manually in Supabase SQL editor
        console.log(`Statement: ${statement.substring(0, 50)}...`);
      }
      
      console.log(`✓ Migration ${migration} prepared for execution`);
    } catch (error) {
      console.error(`Error preparing migration ${migration}:`, error);
      process.exit(1);
    }
  }

  console.log('\nMigration SQL prepared. Please execute the following in Supabase SQL editor:');
  console.log('1. Go to your Supabase project SQL editor');
  console.log('2. Copy and paste the contents of each migration file in order');
  console.log('3. Execute each migration');
}

runMigrations().catch(console.error);