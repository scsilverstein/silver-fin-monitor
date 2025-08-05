// Test script to debug Netlify function path parsing
import axios from 'axios';

async function testNetlifyPaths() {
  console.log('🧪 Testing Netlify Function Path Parsing\n');
  
  const testPaths = [
    '/api/v1/analysis',
    '/api/v1/analysis/trigger',
    '/.netlify/functions/api/api/v1/analysis',
    '/.netlify/functions/api/api/v1/analysis/trigger',
    '/.netlify/functions/api/analysis',
    '/.netlify/functions/api/analysis/trigger'
  ];
  
  const port = 8888; // Netlify Dev port
  
  for (const path of testPaths) {
    console.log(`\n📍 Testing path: ${path}`);
    console.log('━'.repeat(50));
    
    try {
      // Test GET for analysis endpoints
      if (!path.includes('trigger')) {
        const getResponse = await axios.get(`http://localhost:${port}${path}`);
        console.log('✅ GET Success:', getResponse.status);
        console.log('Data:', getResponse.data);
      } else {
        // Test POST for trigger endpoint
        const postResponse = await axios.post(
          `http://localhost:${port}${path}`,
          { date: '2025-01-01', force: false },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log('✅ POST Success:', postResponse.status);
        console.log('Data:', postResponse.data);
      }
    } catch (error: any) {
      console.error('❌ Error:', error.response?.status || error.code);
      console.error('Message:', error.response?.data || error.message);
      
      // Log the response headers if available
      if (error.response?.headers) {
        console.log('Response headers:', error.response.headers);
      }
    }
  }
  
  // Also test the direct test endpoint
  console.log('\n📍 Testing direct test endpoint');
  console.log('━'.repeat(50));
  try {
    const testResponse = await axios.get(`http://localhost:${port}/api/v1/direct-test`);
    console.log('✅ Direct test success:', testResponse.data);
  } catch (error: any) {
    console.error('❌ Direct test error:', error.response?.data || error.message);
  }
}

testNetlifyPaths();