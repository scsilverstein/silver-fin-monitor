import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Create Supabase client with service key for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDailyAnalysis() {
  console.log('Connecting to Supabase...');
  console.log('URL:', supabaseUrl);
  
  try {
    // First, let's check if the table exists
    console.log('\nChecking if daily_analysis table exists...');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'daily_analysis');
    
    if (tableError) {
      console.error('Error checking table existence:', tableError);
    } else {
      console.log('Table check result:', tables);
    }

    // Now let's query the daily_analysis table
    console.log('\nQuerying daily_analysis table...');
    const { data, error, count } = await supabase
      .from('daily_analysis')
      .select('*', { count: 'exact' })
      .order('analysis_date', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error querying daily_analysis:', error);
      return;
    }

    console.log(`\nTotal records found: ${count}`);
    
    if (data && data.length > 0) {
      console.log('\nLatest daily_analysis records:');
      data.forEach((record, index) => {
        console.log(`\n--- Record ${index + 1} ---`);
        console.log('ID:', record.id);
        console.log('Analysis Date:', record.analysis_date);
        console.log('Market Sentiment:', record.market_sentiment);
        console.log('Key Themes:', record.key_themes);
        console.log('Confidence Score:', record.confidence_score);
        console.log('Sources Analyzed:', record.sources_analyzed);
        console.log('Created At:', record.created_at);
        console.log('Summary:', record.overall_summary?.substring(0, 200) + '...');
      });
    } else {
      console.log('\nNo daily_analysis records found in the database.');
    }

    // Check distinct dates
    console.log('\n\nChecking distinct analysis dates...');
    const { data: dates, error: dateError } = await supabase
      .from('daily_analysis')
      .select('analysis_date')
      .order('analysis_date', { ascending: false });

    if (!dateError && dates) {
      const uniqueDates = [...new Set(dates.map(d => d.analysis_date))];
      console.log('Unique analysis dates found:', uniqueDates.length);
      console.log('Date range:', uniqueDates[uniqueDates.length - 1], 'to', uniqueDates[0]);
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the check
checkDailyAnalysis().then(() => {
  console.log('\nCheck complete.');
  process.exit(0);
}).catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});