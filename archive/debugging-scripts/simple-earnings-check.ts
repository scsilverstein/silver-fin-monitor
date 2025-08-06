import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEarnings() {
  console.log('🔍 Simple Earnings Database Check...\n');

  try {
    // 1. Check earnings_calendar table
    console.log('1. Checking earnings_calendar table...');
    const { count: earningsCount, error: countError } = await supabase
      .from('earnings_calendar')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ earnings_calendar table error:', countError);
    } else {
      console.log(`✅ earnings_calendar table exists with ${earningsCount || 0} records`);
    }

    // 2. Check earnings_calendar_with_stats view
    console.log('\n2. Checking earnings_calendar_with_stats view...');
    const { count: viewCount, error: viewError } = await supabase
      .from('earnings_calendar_with_stats')
      .select('*', { count: 'exact', head: true });

    if (viewError) {
      console.error('❌ earnings_calendar_with_stats view error:', viewError);
      console.log('   This view might not exist, which explains API errors');
    } else {
      console.log(`✅ earnings_calendar_with_stats view exists with ${viewCount || 0} records`);
    }

    // 3. Test API query exactly as it would be called
    console.log('\n3. Testing exact API query...');
    const limit = 20;
    const offset = 0;
    
    const { data: apiData, error: apiError, count: apiCount } = await supabase
      .from('earnings_calendar_with_stats')
      .select('*', { count: 'exact' })
      .order('earnings_date', { ascending: true })
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (apiError) {
      console.error('❌ API query failed:', apiError);
      
      // Try fallback without view
      console.log('\n   Trying fallback query without view...');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('earnings_calendar')
        .select('*')
        .order('earnings_date', { ascending: true })
        .limit(limit);

      if (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
      } else {
        console.log(`✅ Fallback query worked, returned ${fallbackData?.length || 0} records`);
        if (fallbackData && fallbackData.length > 0) {
          console.log('   Sample record:', fallbackData[0]);
        }
      }
    } else {
      console.log(`✅ API query successful! Returned ${apiData?.length || 0} records from ${apiCount || 0} total`);
      if (apiData && apiData.length > 0) {
        console.log('   Sample record:', apiData[0]);
      }
    }

    // 4. Check current date against earnings dates
    console.log('\n4. Checking date ranges...');
    const today = new Date().toISOString().split('T')[0];
    console.log(`   Today: ${today}`);
    
    const { data: dateRange, error: dateError } = await supabase
      .from('earnings_calendar')
      .select('earnings_date')
      .order('earnings_date', { ascending: true });

    if (dateError) {
      console.error('❌ Error checking date range:', dateError);
    } else if (dateRange && dateRange.length > 0) {
      const minDate = dateRange[0].earnings_date;
      const maxDate = dateRange[dateRange.length - 1].earnings_date;
      console.log(`   Earnings date range: ${minDate} to ${maxDate}`);
      console.log(`   Total unique dates: ${dateRange.length}`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkEarnings().catch(console.error);