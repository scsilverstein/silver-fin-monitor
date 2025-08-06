import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabaseFunctions() {
  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_KEY as string
  );

  console.log('🔍 Checking database functions...');

  // Check if dequeue_job function exists
  const { data: functions, error } = await supabase
    .from('pg_proc')
    .select('proname')
    .like('proname', '%queue%');

  if (error) {
    console.error('Error checking functions:', error);
    
    // Try alternative method - query information_schema
    const { data: altFunctions, error: altError } = await supabase.rpc('sql', {
      query: `
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name LIKE '%queue%'
      `
    });
    
    if (altError) {
      console.error('Alternative check also failed:', altError);
      
      // Manual check by trying to call the function
      console.log('Trying to call dequeue_job() directly...');
      const { data: testCall, error: testError } = await supabase.rpc('dequeue_job');
      
      if (testError) {
        console.error('❌ dequeue_job function does not exist:', testError.message);
        console.log('\n💡 You need to run the queue functions migration:');
        console.log('   npx supabase db push');
        console.log('   OR apply migration: supabase/migrations/005_queue_cache_functions.sql');
      } else {
        console.log('✅ dequeue_job function exists and working');
        console.log('Result:', testCall);
      }
    } else {
      console.log('Functions found:', altFunctions);
    }
  } else {
    console.log('Queue functions found:', functions);
  }
}

checkDatabaseFunctions().catch(console.error);