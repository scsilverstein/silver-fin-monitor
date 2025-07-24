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

async function diagnoseEarnings() {
  console.log('🔍 Diagnosing Earnings Calendar Database...\n');

  try {
    // 1. Check if earnings_calendar table exists
    console.log('1. Checking if earnings_calendar table exists...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'earnings_calendar');

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else if (tables && tables.length > 0) {
      console.log('✅ earnings_calendar table exists');
    } else {
      console.log('❌ earnings_calendar table does NOT exist');
    }

    // 2. Check earnings_calendar table structure
    console.log('\n2. Checking earnings_calendar table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', 'earnings_calendar')
      .order('ordinal_position');

    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
    } else if (columns && columns.length > 0) {
      console.log('✅ Table columns:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ No columns found');
    }

    // 3. Count records in earnings_calendar
    console.log('\n3. Counting records in earnings_calendar...');
    const { count: earningsCount, error: countError } = await supabase
      .from('earnings_calendar')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting records:', countError);
    } else {
      console.log(`✅ Total records: ${earningsCount || 0}`);
    }

    // 4. Get sample earnings records
    console.log('\n4. Getting sample earnings records...');
    const { data: sampleEarnings, error: sampleError } = await supabase
      .from('earnings_calendar')
      .select('*')
      .limit(5)
      .order('earnings_date', { ascending: false });

    if (sampleError) {
      console.error('❌ Error getting sample records:', sampleError);
    } else if (sampleEarnings && sampleEarnings.length > 0) {
      console.log('✅ Sample records:');
      sampleEarnings.forEach(earning => {
        console.log(`   - ${earning.symbol}: ${earning.earnings_date} (${earning.earnings_time})`);
      });
    } else {
      console.log('❌ No earnings records found');
    }

    // 5. Check if earnings_calendar_with_stats view exists
    console.log('\n5. Checking if earnings_calendar_with_stats view exists...');
    const { data: views, error: viewsError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'earnings_calendar_with_stats');

    if (viewsError) {
      console.error('❌ Error checking views:', viewsError);
    } else if (views && views.length > 0) {
      console.log('✅ earnings_calendar_with_stats view exists');
    } else {
      console.log('❌ earnings_calendar_with_stats view does NOT exist');
    }

    // 6. Test the view if it exists
    if (views && views.length > 0) {
      console.log('\n6. Testing earnings_calendar_with_stats view...');
      const { data: viewData, error: viewError } = await supabase
        .from('earnings_calendar_with_stats')
        .select('*')
        .limit(5);

      if (viewError) {
        console.error('❌ Error querying view:', viewError);
      } else if (viewData && viewData.length > 0) {
        console.log('✅ View is working, sample data:');
        viewData.forEach(item => {
          console.log(`   - ${item.symbol}: ${item.earnings_date}`);
        });
      } else {
        console.log('❌ View returns no data');
      }
    }

    // 7. Check for upcoming earnings
    console.log('\n7. Checking for upcoming earnings...');
    const today = new Date().toISOString().split('T')[0];
    const { data: upcomingEarnings, error: upcomingError } = await supabase
      .from('earnings_calendar')
      .select('*')
      .gte('earnings_date', today)
      .order('earnings_date', { ascending: true })
      .limit(10);

    if (upcomingError) {
      console.error('❌ Error checking upcoming earnings:', upcomingError);
    } else if (upcomingEarnings && upcomingEarnings.length > 0) {
      console.log(`✅ Found ${upcomingEarnings.length} upcoming earnings:`);
      upcomingEarnings.forEach(earning => {
        console.log(`   - ${earning.symbol}: ${earning.earnings_date} (${earning.earnings_time})`);
      });
    } else {
      console.log('❌ No upcoming earnings found');
    }

    // 8. Check migration history
    console.log('\n8. Checking migration history...');
    const { data: migrations, error: migrationsError } = await supabase
      .from('supabase_migrations')
      .select('*')
      .like('name', '%earnings%')
      .order('executed_at', { ascending: false });

    if (migrationsError) {
      // Try alternative table name
      const { data: altMigrations, error: altError } = await supabase
        .from('schema_migrations')
        .select('*')
        .like('version', '%earnings%')
        .order('version', { ascending: false });

      if (altError) {
        console.log('⚠️  Could not check migration history');
      } else if (altMigrations && altMigrations.length > 0) {
        console.log('✅ Earnings-related migrations found:');
        altMigrations.forEach(m => console.log(`   - ${m.version}`));
      }
    } else if (migrations && migrations.length > 0) {
      console.log('✅ Earnings-related migrations found:');
      migrations.forEach(m => console.log(`   - ${m.name} (${m.executed_at})`));
    } else {
      console.log('❌ No earnings-related migrations found');
    }

    // 9. Test direct query that API uses
    console.log('\n9. Testing API query directly...');
    const limit = 20;
    const offset = 0;
    
    const { data: apiData, error: apiError } = await supabase
      .from('earnings_calendar_with_stats')
      .select('*', { count: 'exact' })
      .order('earnings_date', { ascending: true })
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (apiError) {
      console.error('❌ API query failed:', apiError);
      
      // Try without the view
      console.log('\n   Trying direct table query...');
      const { data: directData, error: directError } = await supabase
        .from('earnings_calendar')
        .select('*', { count: 'exact' })
        .order('earnings_date', { ascending: true })
        .limit(limit);

      if (directError) {
        console.error('❌ Direct table query also failed:', directError);
      } else {
        console.log(`✅ Direct table query works, returned ${directData?.length || 0} records`);
      }
    } else {
      console.log(`✅ API query works, returned ${apiData?.length || 0} records`);
    }

    // 10. Check RLS policies
    console.log('\n10. Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'earnings_calendar' })
      .select('*');

    if (policiesError) {
      console.log('⚠️  Could not check RLS policies (this is normal if the function doesn\'t exist)');
    } else if (policies && policies.length > 0) {
      console.log('✅ RLS policies found:');
      policies.forEach(p => console.log(`   - ${p.policyname}: ${p.cmd}`));
    } else {
      console.log('ℹ️  No RLS policies found (table might not have RLS enabled)');
    }

    console.log('\n✅ Diagnosis complete!');

  } catch (error) {
    console.error('❌ Unexpected error during diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseEarnings().catch(console.error);