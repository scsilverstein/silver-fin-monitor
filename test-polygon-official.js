require('dotenv').config();
const { restClient } = require('@polygon.io/client-js');

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
    
    // Test 1: Market Status
    console.log('\n1. Testing market status...');
    const status = await rest.reference.marketStatus();
    console.log('Market Status:', status);
    
    // Test 2: Get a few NASDAQ tickers
    console.log('\n2. Testing tickers endpoint...');
    const tickers = await rest.reference.tickers({
      market: 'stocks',
      exchange: 'XNAS',
      active: true,
      limit: 5,
      sort: 'ticker',
      order: 'asc'
    });
    
    console.log('Tickers response status:', tickers.status);
    console.log('Number of tickers:', tickers.results?.length || 0);
    if (tickers.results && tickers.results.length > 0) {
      console.log('First ticker:', tickers.results[0]);
    }
    
    // Test 3: Get details for AAPL
    console.log('\n3. Testing ticker details for AAPL...');
    const aaplDetails = await rest.reference.tickerDetails('AAPL');
    console.log('AAPL Details:', {
      name: aaplDetails.results?.name,
      marketCap: aaplDetails.results?.market_cap,
      sicDescription: aaplDetails.results?.sic_description
    });
    
    // Test 4: Get recent aggregates for AAPL
    console.log('\n4. Testing aggregates for AAPL...');
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const aggregates = await rest.stocks.aggregates(
      'AAPL',
      1,
      'day',
      lastWeek.toISOString().split('T')[0],
      today.toISOString().split('T')[0],
      { limit: 5 }
    );
    
    console.log('Aggregates status:', aggregates.status);
    console.log('Number of bars:', aggregates.results?.length || 0);
    if (aggregates.results && aggregates.results.length > 0) {
      const latest = aggregates.results[aggregates.results.length - 1];
      console.log('Latest price data:', {
        date: new Date(latest.t).toISOString().split('T')[0],
        close: latest.c,
        volume: latest.v
      });
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testOfficialPolygonClient();