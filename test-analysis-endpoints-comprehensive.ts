// Comprehensive test script for all analysis endpoints
import axios, { AxiosError } from 'axios';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  data?: any;
  error?: string;
}

async function testAnalysisEndpoints() {
  console.log('🧪 Comprehensive Analysis Endpoints Test');
  console.log('=====================================\n');
  
  const baseUrl = 'http://localhost:8888';
  const results: TestResult[] = [];
  
  // Test configurations
  const tests = [
    {
      name: 'GET /api/v1/analysis (Root endpoint)',
      method: 'GET',
      path: '/api/v1/analysis',
      expectedStatus: [200, 401],
      requiresAuth: true
    },
    {
      name: 'GET /api/v1/analysis/latest',
      method: 'GET',
      path: '/api/v1/analysis/latest',
      expectedStatus: [200, 401],
      requiresAuth: true
    },
    {
      name: 'GET /api/v1/analysis/2025-01-01 (by date)',
      method: 'GET',
      path: '/api/v1/analysis/2025-01-01',
      expectedStatus: [200, 401, 404], // 404 if no analysis for that date
      requiresAuth: true
    },
    {
      name: 'POST /api/v1/analysis/trigger',
      method: 'POST',
      path: '/api/v1/analysis/trigger',
      data: { date: '2025-01-01', force: false },
      expectedStatus: [200, 201, 401],
      requiresAuth: true
    },
    {
      name: 'GET /api/v1/analysis/trigger (should fail with 405)',
      method: 'GET',
      path: '/api/v1/analysis/trigger',
      expectedStatus: [405], // Method Not Allowed
      requiresAuth: false
    }
  ];
  
  // First, try to get an auth token
  console.log('🔐 Attempting authentication...');
  let token = '';
  
  try {
    const loginResponse = await axios.post(`${baseUrl}/api/v1/auth/login`, {
      email: 'demo@example.com',
      password: 'demo'
    });
    
    token = loginResponse.data.data?.token || loginResponse.data.token;
    console.log('✅ Authentication successful');
    console.log(`Token: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.log('⚠️  Authentication failed, testing without auth');
  }
  
  console.log('\n📊 Testing Analysis Endpoints:');
  console.log('─'.repeat(50));
  
  // Run all tests
  for (const test of tests) {
    console.log(`\n🔍 ${test.name}`);
    console.log(`   Method: ${test.method}`);
    console.log(`   Path: ${test.path}`);
    
    try {
      const config: any = {
        method: test.method,
        url: `${baseUrl}${test.path}`,
        headers: {}
      };
      
      // Add auth header if we have a token and test requires auth
      if (token && test.requiresAuth) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Add data for POST requests
      if (test.method === 'POST' && test.data) {
        config.data = test.data;
        config.headers['Content-Type'] = 'application/json';
      }
      
      const response = await axios(config);
      
      const success = test.expectedStatus.includes(response.status);
      results.push({
        endpoint: test.path,
        method: test.method,
        status: response.status,
        success,
        data: response.data
      });
      
      console.log(`   Status: ${response.status} ${success ? '✅' : '❌'}`);
      console.log(`   Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
      
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || 0;
      const success = test.expectedStatus.includes(status);
      
      results.push({
        endpoint: test.path,
        method: test.method,
        status,
        success,
        error: axiosError.message,
        data: axiosError.response?.data
      });
      
      console.log(`   Status: ${status} ${success ? '✅' : '❌'}`);
      console.log(`   Error: ${axiosError.message}`);
      if (axiosError.response?.data) {
        console.log(`   Response: ${JSON.stringify(axiosError.response.data).substring(0, 100)}...`);
      }
    }
  }
  
  // Summary
  console.log('\n📈 Test Summary:');
  console.log('─'.repeat(50));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);
  
  // Detailed failure report
  if (failed > 0) {
    console.log('\n⚠️  Failed Tests:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`\n   ${result.method} ${result.endpoint}`);
      console.log(`   Expected status: See test configuration`);
      console.log(`   Actual status: ${result.status}`);
      console.log(`   Error: ${result.error || 'N/A'}`);
    });
  }
  
  // Check if the critical issue is fixed
  console.log('\n🎯 Critical Issue Check:');
  console.log('─'.repeat(50));
  
  const triggerPostTest = results.find(r => 
    r.method === 'POST' && r.endpoint === '/api/v1/analysis/trigger'
  );
  
  const triggerGetTest = results.find(r => 
    r.method === 'GET' && r.endpoint === '/api/v1/analysis/trigger'
  );
  
  if (triggerPostTest && triggerPostTest.status !== 404) {
    console.log('✅ POST /api/v1/analysis/trigger is being served (not 404)');
  } else {
    console.log('❌ POST /api/v1/analysis/trigger still returning 404');
  }
  
  if (triggerGetTest && triggerGetTest.status === 405) {
    console.log('✅ GET /api/v1/analysis/trigger correctly returns 405 (Method Not Allowed)');
  } else {
    console.log('❌ GET /api/v1/analysis/trigger not returning expected 405');
  }
  
  // Test direct Netlify function paths for debugging
  console.log('\n🔧 Debug: Testing Direct Netlify Function Paths');
  console.log('─'.repeat(50));
  
  const debugPaths = [
    '/.netlify/functions/api/v1/analysis',
    '/.netlify/functions/api/v1/analysis/trigger',
    '/.netlify/functions/api/analysis',
    '/.netlify/functions/api/analysis/trigger'
  ];
  
  for (const path of debugPaths) {
    try {
      const response = await axios.get(`${baseUrl}${path}`);
      console.log(`✅ ${path} - Status: ${response.status}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      console.log(`❌ ${path} - Status: ${axiosError.response?.status || 'Network Error'}`);
    }
  }
}

// Run the tests
testAnalysisEndpoints().catch(console.error);