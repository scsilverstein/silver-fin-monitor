#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import { db } from '@/services/database';

config();

async function checkEarningsData() {
  try {
    console.log('Checking earnings calendar data...\n');

    // Check total entries
    const totalCount = await db.query('SELECT COUNT(*) as count FROM earnings_calendar');
    console.log('Total earnings entries:', totalCount[0].count);

    // Check January 2025 data
    const janData = await db.query(`
      SELECT symbol, company_name, earnings_date, time_of_day, importance_rating, status
      FROM earnings_calendar 
      WHERE earnings_date >= '2025-01-01' AND earnings_date <= '2025-01-31'
      ORDER BY earnings_date, importance_rating DESC
    `);
    
    console.log('\nJanuary 2025 earnings:', janData.length, 'entries');
    janData.forEach((e: any) => {
      console.log(`${e.earnings_date} - ${e.symbol}: ${e.company_name} (${e.time_of_day}) - Rating: ${e.importance_rating}`);
    });

    // Check if view exists
    const viewCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'earnings_calendar_with_stats'
      ) as exists
    `);
    console.log('\nView earnings_calendar_with_stats exists:', viewCheck[0].exists);

    // Try the exact query from the controller
    const earnings = await db.query(`
      SELECT 
        earnings_date,
        json_agg(
          json_build_object(
            'id', id,
            'symbol', symbol,
            'company_name', company_name,
            'time_of_day', time_of_day,
            'importance_rating', importance_rating,
            'status', status,
            'confirmed', confirmed,
            'has_reports', has_reports
          ) ORDER BY importance_rating DESC NULLS LAST, symbol
        ) as earnings
      FROM earnings_calendar_with_stats
      WHERE earnings_date >= '2025-01-01' AND earnings_date <= '2025-01-31'
      GROUP BY earnings_date
      ORDER BY earnings_date
    `);

    console.log('\nQuery result:', earnings.length, 'days with earnings');
    earnings.forEach((day: any) => {
      console.log(`${day.earnings_date}: ${day.earnings.length} companies`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEarningsData();