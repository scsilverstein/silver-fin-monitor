// Test script for analysis trigger endpoint
import axios from 'axios';

async function testAnalysisTrigger() {
  console.log('🧪 Testing Analysis Trigger Endpoint\n');
  
  // Test configuration
  const servers = [
    { 
      name: 'Express', 
      loginUrl: 'http://localhost:3001/api/v1/auth/login',
      triggerUrl: 'http://localhost:3001/api/v1/analysis/trigger' 
    },
    { 
      name: 'Netlify Dev', 
      loginUrl: 'http://localhost:8888/api/v1/auth/login',
      triggerUrl: 'http://localhost:8888/api/v1/analysis/trigger' 
    }
  ];
  
  for (const server of servers) {
    console.log(`\n📍 Testing ${server.name} Server`);
    console.log('━'.repeat(40));
    
    try {
      // First, let's login to get a token
      console.log('1️⃣ Logging in...');
      const loginResponse = await axios.post(server.loginUrl, {
        email: 'demo@example.com',
        password: 'demo'
      });
      
      const token = loginResponse.data.data.token;
      console.log('✅ Login successful, got token');
      
      // Now test the trigger endpoint
      console.log('\n2️⃣ Testing analysis trigger endpoint...');
      const triggerResponse = await axios.post(
        server.triggerUrl,
        {
          date: new Date().toISOString().split('T')[0],
          force: false
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Analysis trigger response:', triggerResponse.data);
      
    } catch (error: any) {
      console.error('❌ Error:', error.response?.data || error.message);
      console.error('Status:', error.response?.status);
      console.error('URL:', error.config?.url);
      
      // If connection refused, server is not running
      if (error.code === 'ECONNREFUSED') {
        console.log(`⚠️  ${server.name} server is not running`);
      }
    }
  }
}

testAnalysisTrigger();