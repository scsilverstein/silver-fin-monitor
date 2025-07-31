import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import the Polygon service
import { polygonStockService } from './src/services/polygon/polygon-stock.service';

async function testPolygonAPI() {
  try {
    console.log('Testing Polygon API...');
    console.log('API Key available:', !!process.env.POLYGON_API_KEY);
    
    // Test 1: Get NASDAQ stocks
    console.log('\n1. Fetching NASDAQ stocks...');
    const nasdaqResult = await polygonStockService.getNasdaqStocks(10);
    
    if (nasdaqResult.success && nasdaqResult.data) {
      console.log(`✓ Found ${nasdaqResult.data.length} NASDAQ stocks`);
      console.log('Sample stock:', nasdaqResult.data[0]);
    } else {
      console.log('✗ Failed to fetch NASDAQ stocks:', nasdaqResult.error);
    }
    
    // Test 2: Get ticker details
    console.log('\n2. Fetching ticker details for AAPL...');
    const detailsResult = await polygonStockService.getTickerDetails('AAPL');
    
    if (detailsResult.success && detailsResult.data) {
      console.log('✓ Got details for AAPL');
      console.log('Name:', detailsResult.data.name);
      console.log('Market Cap:', detailsResult.data.market_cap);
    } else {
      console.log('✗ Failed to fetch ticker details:', detailsResult.error);
    }
    
    // Test 3: Get snapshot
    console.log('\n3. Fetching snapshot for AAPL...');
    const snapshotResult = await polygonStockService.getSnapshot('AAPL');
    
    if (snapshotResult.success && snapshotResult.data) {
      console.log('✓ Got snapshot for AAPL');
      console.log('Current Price:', snapshotResult.data.ticker.day.c);
      console.log('Volume:', snapshotResult.data.ticker.day.v);
    } else {
      console.log('✗ Failed to fetch snapshot:', snapshotResult.error);
    }
    
    // Test 4: Get stock screener data
    console.log('\n4. Fetching screener data for tech stocks...');
    const screenerResult = await polygonStockService.getStockScreenerData(['AAPL', 'MSFT', 'GOOGL']);
    
    if (screenerResult.success && screenerResult.data) {
      console.log(`✓ Got screener data for ${screenerResult.data.length} stocks`);
      screenerResult.data.forEach(stock => {
        console.log(`- ${stock.symbol}: P/E=${stock.pe.toFixed(2)}, Price=$${stock.price.toFixed(2)}`);
      });
    } else {
      console.log('✗ Failed to fetch screener data:', screenerResult.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testPolygonAPI();