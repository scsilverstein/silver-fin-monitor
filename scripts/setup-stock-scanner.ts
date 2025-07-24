#!/usr/bin/env npx tsx
import { supabase } from '../src/services/database/client';
import { logger } from '../src/utils/logger';

// Initial stock symbols to track
const initialStocks = [
  // Technology
  { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', marketCapCategory: 'mega' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', marketCapCategory: 'mega' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services', marketCapCategory: 'mega' },
  { symbol: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Internet Services', marketCapCategory: 'mega' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', marketCapCategory: 'mega' },
  
  // Finance
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', industry: 'Banks', marketCapCategory: 'mega' },
  { symbol: 'BAC', name: 'Bank of America Corp', sector: 'Financial Services', industry: 'Banks', marketCapCategory: 'large' },
  { symbol: 'GS', name: 'Goldman Sachs Group Inc', sector: 'Financial Services', industry: 'Investment Banking', marketCapCategory: 'large' },
  { symbol: 'BLK', name: 'BlackRock Inc.', sector: 'Financial Services', industry: 'Asset Management', marketCapCategory: 'large' },
  
  // Healthcare
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCapCategory: 'mega' },
  { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCapCategory: 'large' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc', sector: 'Healthcare', industry: 'Health Insurance', marketCapCategory: 'mega' },
  
  // Consumer
  { symbol: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'E-Commerce', marketCapCategory: 'mega' },
  { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', marketCapCategory: 'mega' },
  { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Retail', marketCapCategory: 'mega' },
  
  // Energy
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas', marketCapCategory: 'mega' },
  { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy', industry: 'Oil & Gas', marketCapCategory: 'large' },
  
  // Industrial
  { symbol: 'BA', name: 'Boeing Company', sector: 'Industrials', industry: 'Aerospace & Defense', marketCapCategory: 'large' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Heavy Machinery', marketCapCategory: 'large' },
  
  // Communication
  { symbol: 'DIS', name: 'Walt Disney Company', sector: 'Communication Services', industry: 'Entertainment', marketCapCategory: 'large' },
  { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Entertainment', marketCapCategory: 'large' },
  
  // Real Estate
  { symbol: 'AMT', name: 'American Tower Corp', sector: 'Real Estate', industry: 'REIT - Infrastructure', marketCapCategory: 'large' },
  
  // Materials
  { symbol: 'LIN', name: 'Linde plc', sector: 'Basic Materials', industry: 'Chemicals', marketCapCategory: 'large' },
  
  // Utilities
  { symbol: 'NEE', name: 'NextEra Energy Inc', sector: 'Utilities', industry: 'Electric Utilities', marketCapCategory: 'large' },
];

async function setupStockScanner() {
  try {
    logger.info('Setting up stock scanner with initial symbols...');
    
    // Insert initial stocks
    for (const stock of initialStocks) {
      const { data, error } = await supabase
        .from('stock_symbols')
        .upsert({
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          industry: stock.industry,
          market_cap_category: stock.marketCapCategory,
          is_active: true
        }, {
          onConflict: 'symbol'
        })
        .select()
        .single();
      
      if (error) {
        logger.error(`Failed to insert ${stock.symbol}:`, error);
      } else {
        logger.info(`Added stock: ${stock.symbol} - ${stock.name}`);
      }
    }
    
    // Verify insertion
    const { count } = await supabase
      .from('stock_symbols')
      .select('*', { count: 'exact', head: true });
    
    logger.info(`Total stocks in database: ${count}`);
    
    // Add some sample watchlist entries
    const watchlistStocks = ['NVDA', 'TSLA', 'META', 'AAPL'];
    
    for (const symbol of watchlistStocks) {
      const { data: stockData } = await supabase
        .from('stock_symbols')
        .select('id')
        .eq('symbol', symbol)
        .single();
      
      if (stockData) {
        await supabase
          .from('stock_watchlist')
          .upsert({
            symbol_id: stockData.id,
            reason: 'High momentum stock for monitoring',
            priority: 'high',
            added_by: 'system'
          }, {
            onConflict: 'symbol_id,added_by'
          });
      }
    }
    
    logger.info('Stock scanner setup completed!');
    logger.info('You can now:');
    logger.info('1. Run stock scans using the API: POST /api/stocks/scanner/run');
    logger.info('2. View scanner results: GET /api/stocks/scanner/results');
    logger.info('3. Check alerts: GET /api/stocks/scanner/alerts');
    logger.info('4. View watchlist: GET /api/stocks/watchlist');
    
  } catch (error) {
    logger.error('Failed to setup stock scanner:', error);
    process.exit(1);
  }
}

// Run setup
setupStockScanner()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Setup failed:', error);
    process.exit(1);
  });