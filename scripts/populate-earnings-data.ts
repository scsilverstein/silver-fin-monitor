import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Sample real earnings data for January 2025
const earningsData = [
  // Week of Jan 27-31, 2025
  {
    symbol: 'AAPL',
    company_name: 'Apple Inc.',
    earnings_date: '2025-01-30',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q1',
    fiscal_year: 2025,
    eps_estimate: 2.15,
    revenue_estimate: 124500000, // $124.5B
    importance_rating: 5,
    confirmed: true,
    status: 'scheduled',
    market_cap: 3400000000 // $3.4T
  },
  {
    symbol: 'MSFT',
    company_name: 'Microsoft Corporation',
    earnings_date: '2025-01-28',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 3.12,
    revenue_estimate: 65700000, // $65.7B
    importance_rating: 5,
    confirmed: true,
    status: 'scheduled',
    market_cap: 3100000000 // $3.1T
  },
  {
    symbol: 'GOOGL',
    company_name: 'Alphabet Inc.',
    earnings_date: '2025-01-29',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 1.85,
    revenue_estimate: 89200000, // $89.2B
    importance_rating: 5,
    confirmed: true,
    status: 'scheduled',
    market_cap: 2100000000 // $2.1T
  },
  {
    symbol: 'AMZN',
    company_name: 'Amazon.com Inc.',
    earnings_date: '2025-01-30',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 1.82,
    revenue_estimate: 166800000, // $166.8B
    importance_rating: 5,
    confirmed: true,
    status: 'scheduled',
    market_cap: 1800000000 // $1.8T
  },
  {
    symbol: 'META',
    company_name: 'Meta Platforms Inc.',
    earnings_date: '2025-01-29',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 5.21,
    revenue_estimate: 41250000, // $41.25B
    importance_rating: 4,
    confirmed: true,
    status: 'scheduled',
    market_cap: 1400000000 // $1.4T
  },
  {
    symbol: 'TSLA',
    company_name: 'Tesla Inc.',
    earnings_date: '2025-01-27',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 0.73,
    revenue_estimate: 27200000, // $27.2B
    importance_rating: 4,
    confirmed: true,
    status: 'scheduled',
    market_cap: 1300000000 // $1.3T
  },
  {
    symbol: 'NVDA',
    company_name: 'NVIDIA Corporation',
    earnings_date: '2025-02-19',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2025,
    eps_estimate: 0.82,
    revenue_estimate: 37500000, // $37.5B
    importance_rating: 5,
    confirmed: true,
    status: 'scheduled',
    market_cap: 1600000000 // $1.6T
  },
  // Additional tech companies
  {
    symbol: 'AMD',
    company_name: 'Advanced Micro Devices',
    earnings_date: '2025-01-28',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 0.96,
    revenue_estimate: 7500000, // $7.5B
    importance_rating: 3,
    confirmed: true,
    status: 'scheduled',
    market_cap: 280000000 // $280B
  },
  {
    symbol: 'INTC',
    company_name: 'Intel Corporation',
    earnings_date: '2025-01-30',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 0.12,
    revenue_estimate: 14500000, // $14.5B
    importance_rating: 3,
    confirmed: true,
    status: 'scheduled',
    market_cap: 130000000 // $130B
  },
  // Banks
  {
    symbol: 'JPM',
    company_name: 'JPMorgan Chase & Co.',
    earnings_date: '2025-01-15',
    time_of_day: 'before_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 4.11,
    revenue_estimate: 41900000, // $41.9B
    importance_rating: 4,
    confirmed: true,
    status: 'scheduled',
    market_cap: 650000000 // $650B
  },
  {
    symbol: 'BAC',
    company_name: 'Bank of America Corp',
    earnings_date: '2025-01-16',
    time_of_day: 'before_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2024,
    eps_estimate: 0.87,
    revenue_estimate: 25100000, // $25.1B
    importance_rating: 4,
    confirmed: true,
    status: 'scheduled',
    market_cap: 380000000 // $380B
  }
];

// Add July 2025 earnings (Q2 earnings season)
const julyEarnings = [
  {
    symbol: 'AAPL',
    company_name: 'Apple Inc.',
    earnings_date: '2025-07-29',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q3',
    fiscal_year: 2025,
    eps_estimate: 1.45,
    revenue_estimate: 89500000, // $89.5B
    importance_rating: 5,
    confirmed: false,
    status: 'scheduled',
    market_cap: 3400000000 // $3.4T
  },
  {
    symbol: 'MSFT',
    company_name: 'Microsoft Corporation',
    earnings_date: '2025-07-22',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q4',
    fiscal_year: 2025,
    eps_estimate: 2.98,
    revenue_estimate: 64200000, // $64.2B
    importance_rating: 5,
    confirmed: false,
    status: 'scheduled',
    market_cap: 3100000000 // $3.1T
  },
  {
    symbol: 'GOOGL',
    company_name: 'Alphabet Inc.',
    earnings_date: '2025-07-23',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 1.92,
    revenue_estimate: 92100000, // $92.1B
    importance_rating: 5,
    confirmed: false,
    status: 'scheduled',
    market_cap: 2100000000 // $2.1T
  },
  {
    symbol: 'AMZN',
    company_name: 'Amazon.com Inc.',
    earnings_date: '2025-07-31',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 1.15,
    revenue_estimate: 154300000, // $154.3B
    importance_rating: 5,
    confirmed: false,
    status: 'scheduled',
    market_cap: 1800000000 // $1.8T
  },
  {
    symbol: 'META',
    company_name: 'Meta Platforms Inc.',
    earnings_date: '2025-07-24',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 5.45,
    revenue_estimate: 43800000, // $43.8B
    importance_rating: 4,
    confirmed: false,
    status: 'scheduled',
    market_cap: 1400000000 // $1.4T
  },
  {
    symbol: 'TSLA',
    company_name: 'Tesla Inc.',
    earnings_date: '2025-07-23',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 0.82,
    revenue_estimate: 29800000, // $29.8B
    importance_rating: 4,
    confirmed: false,
    status: 'scheduled',
    market_cap: 1300000000 // $1.3T
  },
  {
    symbol: 'NFLX',
    company_name: 'Netflix Inc.',
    earnings_date: '2025-07-17',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 4.82,
    revenue_estimate: 9560000, // $9.56B
    importance_rating: 3,
    confirmed: false,
    status: 'scheduled',
    market_cap: 280000000 // $280B
  },
  {
    symbol: 'JPM',
    company_name: 'JPMorgan Chase & Co.',
    earnings_date: '2025-07-14',
    time_of_day: 'before_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 4.25,
    revenue_estimate: 43200000, // $43.2B
    importance_rating: 4,
    confirmed: false,
    status: 'scheduled',
    market_cap: 650000000 // $650B
  },
  {
    symbol: 'UNH',
    company_name: 'UnitedHealth Group',
    earnings_date: '2025-07-18',
    time_of_day: 'before_market',
    fiscal_quarter: 'Q2',
    fiscal_year: 2025,
    eps_estimate: 6.75,
    revenue_estimate: 98500000, // $98.5B
    importance_rating: 3,
    confirmed: false,
    status: 'scheduled',
    market_cap: 520000000 // $520B
  },
  {
    symbol: 'V',
    company_name: 'Visa Inc.',
    earnings_date: '2025-07-25',
    time_of_day: 'after_market',
    fiscal_quarter: 'Q3',
    fiscal_year: 2025,
    eps_estimate: 2.42,
    revenue_estimate: 8900000, // $8.9B
    importance_rating: 3,
    confirmed: false,
    status: 'scheduled',
    market_cap: 560000000 // $560B
  }
];

async function populateEarningsData() {
  try {
    console.log('Populating earnings data...');
    
    // Combine all earnings data
    const allEarnings = [...earningsData, ...julyEarnings];
    
    // Insert earnings data
    for (const earning of allEarnings) {
      const { data, error } = await supabase
        .from('earnings_calendar')
        .upsert(earning, {
          onConflict: 'symbol,earnings_date,fiscal_quarter,fiscal_year'
        });
      
      if (error) {
        console.error(`Error inserting ${earning.symbol} for ${earning.earnings_date}:`, error);
      } else {
        console.log(`✓ Inserted ${earning.symbol} for ${earning.earnings_date}`);
      }
    }
    
    console.log('\nEarnings data population complete!');
    
    // Verify the data
    const { data: count, error: countError } = await supabase
      .from('earnings_calendar')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\nTotal earnings entries in database: ${count}`);
    }
    
  } catch (error) {
    console.error('Error populating earnings data:', error);
  }
}

// Run the script
populateEarningsData();