#!/usr/bin/env tsx
// Script to check job_queue table status

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkJobQueue() {
  console.log('🔍 Checking job_queue table...\n');

  try {
    // Check if table exists by trying to query it
    console.log('1. Checking if job_queue table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true });

    if (tableError) {
      console.error('❌ Error checking job_queue table:', tableError.message);
      console.error('   Details:', tableError);
      
      // If table doesn't exist, try to check what tables do exist
      console.log('\n2. Checking available tables...');
      const { data: tables, error: tablesError } = await supabase.rpc('get_tables');
      
      if (!tablesError && tables) {
        console.log('   Available tables:', tables);
      }
      
      return;
    }

    console.log('✅ job_queue table exists');

    // Check row count
    console.log('\n2. Checking job_queue row count...');
    const { count, error: countError } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting rows:', countError.message);
    } else {
      console.log(`✅ job_queue has ${count || 0} rows`);
    }

    // Check a few sample rows
    console.log('\n3. Fetching sample rows...');
    const { data: sampleRows, error: sampleError } = await supabase
      .from('job_queue')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false });

    if (sampleError) {
      console.error('❌ Error fetching sample rows:', sampleError.message);
    } else if (sampleRows && sampleRows.length > 0) {
      console.log('✅ Sample rows:');
      sampleRows.forEach((row, index) => {
        console.log(`   ${index + 1}. Job ${row.id} - Type: ${row.job_type}, Status: ${row.status}`);
      });
    } else {
      console.log('ℹ️  No rows found in job_queue');
    }

    // Test pagination
    console.log('\n4. Testing pagination...');
    const { data: paginatedData, error: paginationError } = await supabase
      .from('job_queue')
      .select('*')
      .range(0, 19)
      .order('created_at', { ascending: false });

    if (paginationError) {
      console.error('❌ Error with pagination:', paginationError.message);
    } else {
      console.log(`✅ Pagination works - fetched ${paginatedData?.length || 0} rows`);
    }

    // Check status counts
    console.log('\n5. Checking job status counts...');
    const statuses = ['pending', 'processing', 'completed', 'failed', 'retry'];
    
    for (const status of statuses) {
      const { count: statusCount, error: statusError } = await supabase
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      
      if (!statusError) {
        console.log(`   ${status}: ${statusCount || 0} jobs`);
      }
    }

    console.log('\n✅ All checks completed successfully!');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the check
checkJobQueue().catch(console.error);