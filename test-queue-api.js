#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api/v1';

async function testQueueAPI() {
  try {
    console.log('🧪 Testing Queue API with Authentication...');
    
    // Step 1: Login to get token
    console.log('\n1. Logging in with demo credentials...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@silverfin.com',
      password: 'password'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, got token');
    
    // Step 2: Test queue stats with token
    console.log('\n2. Testing queue stats API...');
    const statsResponse = await axios.get(`${API_BASE_URL}/queue/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Queue stats API response:');
    console.log(JSON.stringify(statsResponse.data, null, 2));
    
    // Step 3: Test queue status
    console.log('\n3. Testing queue status API...');
    const statusResponse = await axios.get(`${API_BASE_URL}/queue/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Queue status API response:');
    console.log(JSON.stringify(statusResponse.data, null, 2));
    
    // Step 4: Test jobs list
    console.log('\n4. Testing jobs list API...');
    const jobsResponse = await axios.get(`${API_BASE_URL}/queue/jobs?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Jobs list API response:');
    console.log(`Total jobs: ${jobsResponse.data.meta?.total || 'unknown'}`);
    console.log(`Returned: ${jobsResponse.data.data?.length || 0} jobs`);
    
    if (jobsResponse.data.data && jobsResponse.data.data.length > 0) {
      console.log('First job:', jobsResponse.data.data[0]);
    }
    
  } catch (error) {
    console.error('❌ Error testing queue API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testQueueAPI();