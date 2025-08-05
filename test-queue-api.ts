#!/usr/bin/env tsx

import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/v1';

// Test token - this should work with our mock authentication
const TEST_TOKEN = 'mock-jwt-token-admin';

async function testQueueAPI() {
  console.log('🧪 Testing Queue API Endpoints...\n');

  try {
    const headers = {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // Test 1: Get Worker Status
    console.log('1️⃣ Testing worker status endpoint...');
    try {
      const response = await axios.get(`${API_BASE}/queue/worker/status`, { headers });
      console.log('✅ Worker status:', response.data);
    } catch (error: any) {
      console.log('❌ Worker status failed:', error.response?.data?.error || error.message);
    }

    // Test 2: Get Queue Stats
    console.log('\n2️⃣ Testing queue stats endpoint...');
    try {
      const response = await axios.get(`${API_BASE}/queue/stats`, { headers });
      console.log('✅ Queue stats:', response.data);
    } catch (error: any) {
      console.log('❌ Queue stats failed:', error.response?.data?.error || error.message);
    }

    // Test 3: List Jobs
    console.log('\n3️⃣ Testing list jobs endpoint...');
    try {
      const response = await axios.get(`${API_BASE}/queue/jobs?limit=5`, { headers });
      console.log('✅ Jobs list:', {
        success: response.data.success,
        jobCount: response.data.data?.length || 0,
        meta: response.data.meta
      });
    } catch (error: any) {
      console.log('❌ List jobs failed:', error.response?.data?.error || error.message);
    }

    // Test 4: Test without authentication (should fail)
    console.log('\n4️⃣ Testing without authentication (should fail)...');
    try {
      const response = await axios.get(`${API_BASE}/queue/stats`);
      console.log('❌ Unexpected success without auth:', response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected unauthorized request');
      } else {
        console.log('❌ Unexpected error:', error.response?.data?.error || error.message);
      }
    }

    console.log('\n🎉 Queue API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testQueueAPI();