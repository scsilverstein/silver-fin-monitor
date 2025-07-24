// Test script to check dashboard API endpoints
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testDashboardEndpoints() {
  console.log('🔍 Testing Dashboard API Endpoints...\n');

  try {
    // Test overview endpoint
    console.log('📊 Testing /dashboard/overview...');
    const overviewResponse = await axios.get(`${API_BASE}/dashboard/overview`);
    console.log('Overview data:', JSON.stringify(overviewResponse.data, null, 2));
    console.log('');

    // Test trends endpoint  
    console.log('📈 Testing /dashboard/trends...');
    const trendsResponse = await axios.get(`${API_BASE}/dashboard/trends`);
    console.log('Trends data:', JSON.stringify(trendsResponse.data, null, 2));
    console.log('');

    // Test stats endpoint
    console.log('📊 Testing /dashboard/stats...');
    const statsResponse = await axios.get(`${API_BASE}/dashboard/stats`);
    console.log('Stats data:', JSON.stringify(statsResponse.data, null, 2));
    console.log('');

    // Test feeds endpoint
    console.log('🔗 Testing /feeds...');
    const feedsResponse = await axios.get(`${API_BASE}/feeds`);
    console.log('Active feeds count:', feedsResponse.data.data?.filter(f => f.isActive).length || 0);
    console.log('Total feeds count:', feedsResponse.data.data?.length || 0);
    console.log('');

    // Test analysis endpoint
    console.log('🧠 Testing /analysis...');
    const analysisResponse = await axios.get(`${API_BASE}/analysis`);
    console.log('Analysis count:', analysisResponse.data.data?.length || 0);
    console.log('');

    console.log('✅ All API tests completed!');

  } catch (error) {
    console.error('❌ API test error:', error.response?.data || error.message);
  }
}

testDashboardEndpoints();