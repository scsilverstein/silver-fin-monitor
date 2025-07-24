#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigrations() {
  try {
    console.log('Starting database setup...');

    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      console.log(`\nRunning migration: ${file}`);
      
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      // Execute the entire SQL file
      const { error } = await supabase.from('_migrations').select('*').limit(1);
      
      // Since we can't run raw SQL directly through Supabase client,
      // we'll need to use the SQL editor in Supabase dashboard
      console.log(`Please run the following migration in Supabase SQL editor:`);
      console.log(`File: ${file}`);
      console.log('---');
      console.log(sql.substring(0, 200) + '...');
      console.log('---');
    }

    console.log('\nMigrations need to be run manually in Supabase SQL editor.');
    console.log('Copy the contents of each migration file and run them in order.');
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();