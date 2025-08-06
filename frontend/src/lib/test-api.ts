// Test API client to debug the issue
import axios from 'axios';

export async function testFeedCreation() {
  console.log('=== Test Feed Creation ===');
  
  const token = localStorage.getItem('auth_token');
  console.log('Token exists:', !!token);
  console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'none');
  
  const testData = {
    name: 'Debug Test Feed ' + Date.now(),
    type: 'rss',
    url: 'https://example.com/debug-' + Date.now() + '.xml',
    config: {
      categories: ['test'],
      priority: 'medium',
      updateFrequency: 'daily'
    }
  };
  
  console.log('Request data:', testData);
  
  try {
    // First test: direct axios call
    console.log('\n1. Testing direct axios call...');
    const directResponse = await axios.post(
      '/api/feeds',
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    console.log('Direct axios success:', directResponse.data);
  } catch (error: any) {
    console.error('Direct axios failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  
  try {
    // Second test: using our configured api instance
    console.log('\n2. Testing with configured API instance...');
    const { api } = await import('./api');
    const apiResponse = await api.post('/feeds', testData);
    console.log('API instance success:', apiResponse.data);
  } catch (error: any) {
    console.error('API instance failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Export to window for easy testing
(window as any).testFeedCreation = testFeedCreation;