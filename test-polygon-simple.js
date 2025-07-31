const axios = require('axios');
require('dotenv').config();

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;

async function testPolygonAPI() {
  if (!POLYGON_API_KEY) {
    console.error('POLYGON_API_KEY not found in environment variables');
    return;
  }

  console.log('Testing Polygon API with key:', POLYGON_API_KEY.substring(0, 8) + '...');

  try {
    // Test 1: Get NASDAQ stocks
    console.log('\n1. Fetching NASDAQ stocks...');
    const tickersResponse = await axios.get('https://api.polygon.io/v3/reference/tickers', {
      params: {
        apiKey: POLYGON_API_KEY,
        market: 'stocks',
        exchange: 'XNAS',
        active: true,
        limit: 10,
        sort: 'ticker',
        order: 'asc'
      }
    });

    console.log('Response status:', tickersResponse.data.status);
    console.log('Number of stocks:', tickersResponse.data.results?.length || 0);
    if (tickersResponse.data.results && tickersResponse.data.results.length > 0) {
      console.log('First stock:', tickersResponse.data.results[0]);
    }

    // Test 2: Get ticker details for AAPL
    console.log('\n2. Fetching AAPL details...');
    const detailsResponse = await axios.get('https://api.polygon.io/v3/reference/tickers/AAPL', {
      params: { apiKey: POLYGON_API_KEY }
    });

    console.log('AAPL details:', {
      name: detailsResponse.data.results?.name,
      marketCap: detailsResponse.data.results?.market_cap,
      description: detailsResponse.data.results?.description?.substring(0, 100) + '...'
    });

    // Test 3: Get snapshot
    console.log('\n3. Fetching AAPL snapshot...');
    const snapshotResponse = await axios.get('https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/AAPL', {
      params: { apiKey: POLYGON_API_KEY }
    });

    console.log('AAPL snapshot:', {
      price: snapshotResponse.data.ticker?.day?.c,
      volume: snapshotResponse.data.ticker?.day?.v,
      change: snapshotResponse.data.ticker?.todaysChange,
      changePercent: snapshotResponse.data.ticker?.todaysChangePerc
    });

  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
}

testPolygonAPI();