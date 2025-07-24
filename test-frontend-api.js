// Simple test to verify frontend can connect to backend API
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';

async function testFrontendAPIConnection() {
  console.log('🔧 Testing Frontend-Backend API Connection...\n');

  try {
    // Test 1: Direct dashboard overview call (should work)
    console.log('📊 Testing /dashboard/overview...');
    const overviewResponse = await axios.get(`${API_BASE}/dashboard/overview`);
    console.log('✅ Dashboard overview success');
    console.log('Active Feed Sources:', overviewResponse.data.data.activeFeedSources);
    console.log('Recent Content Count:', overviewResponse.data.data.recentContentCount);
    console.log('Active Predictions:', overviewResponse.data.data.activePredictions.length);
    console.log('');

    // Test 2: Try with browser-like headers (simulating frontend request)
    console.log('🌐 Testing with browser headers...');
    const browserResponse = await axios.get(`${API_BASE}/dashboard/overview`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    console.log('✅ Browser-like request success');
    console.log('Response size:', JSON.stringify(browserResponse.data).length, 'bytes');
    console.log('');

    // Test 3: Check if CORS headers are present
    console.log('🔒 Checking CORS headers...');
    console.log('Access-Control-Allow-Origin:', browserResponse.headers['access-control-allow-origin']);
    console.log('Access-Control-Allow-Methods:', browserResponse.headers['access-control-allow-methods']);
    console.log('Access-Control-Allow-Headers:', browserResponse.headers['access-control-allow-headers']);
    console.log('');

    console.log('✅ All tests passed! Frontend should be able to connect to backend.');

  } catch (error) {
    console.error('❌ Connection test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   Backend server is not running on port 3001');
    } else if (error.response?.status === 401) {
      console.error('   Authentication required but not provided');
    } else if (error.response?.status >= 500) {
      console.error('   Backend server error');
    }
  }
}

testFrontendAPIConnection();