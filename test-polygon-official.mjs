import { config } from 'dotenv';
import { restClient } from '@polygon.io/client-js';

config();

async function testOfficialPolygonClient() {
  console.log('Testing Official Polygon Client...');
  
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error('POLYGON_API_KEY not found');
    return;
  }
  
  console.log('API Key found:', apiKey.substring(0, 8) + '...');
  
  try {
    const rest = restClient(apiKey);
    
    // Test 1: Get stock aggregates for AAPL
    console.log('\n1. Testing aggregates for AAPL...');
    const aggregates = await rest.stocks.aggregates("AAPL", 1, "day", "2025-01-20", "2025-01-28");
    console.log('Aggregates:', aggregates);
    
    // Test 2: Get last trade for AAPL
    console.log('\n2. Testing last trade for AAPL...');
    const lastTrade = await rest.stocks.lastTrade("AAPL");
    console.log('Last Trade:', lastTrade);
    
    // Test 3: Get last quote for AAPL
    console.log('\n3. Testing last quote for AAPL...');
    const lastQuote = await rest.stocks.lastQuote("AAPL");
    console.log('Last Quote:', lastQuote);
    
    // Test 4: Get snapshot of all tickers (limited)
    console.log('\n4. Testing snapshot (this may fail on basic tier)...');
    try {
      const snapshot = await rest.stocks.snapshotAllTickers();
      console.log('Snapshot results:', snapshot.results?.length || 0);
    } catch (snapshotError) {
      console.log('Snapshot failed (expected on basic tier):', snapshotError.message);
    }
    
    console.log('\n✅ Tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testOfficialPolygonClient();