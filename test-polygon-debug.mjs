import { config } from 'dotenv';
import { restClient } from '@polygon.io/client-js';

config();

async function debugPolygonClient() {
  console.log('Debugging Polygon Client...');
  
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error('POLYGON_API_KEY not found');
    return;
  }
  
  console.log('API Key found:', apiKey.substring(0, 8) + '...');
  
  try {
    const rest = restClient(apiKey);
    console.log('Client created:', typeof rest);
    console.log('Client properties:', Object.keys(rest));
    
    // Test direct HTTP call first
    console.log('\nTesting direct API call...');
    const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/AAPL/range/1/day/2025-01-20/2025-01-28?apikey=${apiKey}`);
    const data = await response.json();
    console.log('Direct API response:', data);
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugPolygonClient();