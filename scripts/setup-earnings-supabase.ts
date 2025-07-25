import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupEarningsData() {
  try {
    console.log('Setting up earnings data via Supabase...\n');

    // Insert sample earnings data
    const earningsData = [
      // Tech Giants
      { symbol: 'AAPL', company_name: 'Apple Inc.', earnings_date: '2025-01-28', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'MSFT', company_name: 'Microsoft Corporation', earnings_date: '2025-01-24', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'GOOGL', company_name: 'Alphabet Inc.', earnings_date: '2025-01-30', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'AMZN', company_name: 'Amazon.com Inc.', earnings_date: '2025-01-31', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'META', company_name: 'Meta Platforms Inc.', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      
      // Finance
      { symbol: 'JPM', company_name: 'JPMorgan Chase & Co.', earnings_date: '2025-01-15', time_of_day: 'before_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'BAC', company_name: 'Bank of America Corp.', earnings_date: '2025-01-16', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'GS', company_name: 'Goldman Sachs Group Inc.', earnings_date: '2025-01-17', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      
      // Healthcare
      { symbol: 'JNJ', company_name: 'Johnson & Johnson', earnings_date: '2025-01-23', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'PFE', company_name: 'Pfizer Inc.', earnings_date: '2025-01-28', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      
      // Energy
      { symbol: 'XOM', company_name: 'Exxon Mobil Corp.', earnings_date: '2025-01-31', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'CVX', company_name: 'Chevron Corporation', earnings_date: '2025-01-25', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      
      // Consumer
      { symbol: 'WMT', company_name: 'Walmart Inc.', earnings_date: '2025-01-21', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'PG', company_name: 'Procter & Gamble Co.', earnings_date: '2025-01-22', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'KO', company_name: 'Coca-Cola Company', earnings_date: '2025-01-14', time_of_day: 'before_market', importance_rating: 3, status: 'scheduled', confirmed: true },
      
      // Semiconductors
      { symbol: 'NVDA', company_name: 'NVIDIA Corporation', earnings_date: '2025-01-22', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'TSM', company_name: 'Taiwan Semiconductor', earnings_date: '2025-01-16', time_of_day: 'before_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'INTC', company_name: 'Intel Corporation', earnings_date: '2025-01-23', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      
      // Streaming & Entertainment
      { symbol: 'NFLX', company_name: 'Netflix Inc.', earnings_date: '2025-01-21', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      { symbol: 'DIS', company_name: 'Walt Disney Company', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 4, status: 'scheduled', confirmed: true },
      
      // Automotive
      { symbol: 'TSLA', company_name: 'Tesla Inc.', earnings_date: '2025-01-29', time_of_day: 'after_market', importance_rating: 5, status: 'scheduled', confirmed: true },
      { symbol: 'F', company_name: 'Ford Motor Company', earnings_date: '2025-01-27', time_of_day: 'after_market', importance_rating: 3, status: 'scheduled', confirmed: true },
      { symbol: 'GM', company_name: 'General Motors Company', earnings_date: '2025-01-28', time_of_day: 'before_market', importance_rating: 3, status: 'scheduled', confirmed: true }
    ];

    console.log('Inserting earnings data...');
    
    // Try to insert each record individually to handle conflicts
    let insertedCount = 0;
    for (const earning of earningsData) {
      try {
        const { data, error } = await supabase
          .from('earnings_calendar')
          .insert(earning);
        
        if (!error) {
          insertedCount++;
        } else if (error.code !== '23505') { // Ignore duplicate key violations
          console.warn(`Warning inserting ${earning.symbol}: ${error.message}`);
        }
      } catch (err) {
        console.warn(`Error inserting ${earning.symbol}:`, err);
      }
    }
    
    console.log(`Successfully inserted ${insertedCount} earnings records.`);
    let error = null; // Reset error for the check below

    if (error) {
      console.error('Error inserting data:', error);
      throw error;
    }

    console.log('Data inserted successfully!');

    // Check the data
    const { data: checkData, error: checkError } = await supabase
      .from('earnings_calendar')
      .select('*')
      .gte('earnings_date', '2025-01-01')
      .lte('earnings_date', '2025-01-31')
      .order('earnings_date', { ascending: true })
      .order('importance_rating', { ascending: false });

    if (checkError) {
      console.error('Error checking data:', checkError);
      throw checkError;
    }

    console.log('\nJanuary 2025 earnings:', checkData?.length || 0, 'entries');
    checkData?.forEach((e: any) => {
      console.log(`${e.earnings_date} - ${e.symbol}: ${e.company_name} (${e.time_of_day}) - Rating: ${e.importance_rating}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setupEarningsData();