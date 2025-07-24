const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLXVzZXItaWQiLCJlbWFpbCI6ImRlbW9Ac2lsdmVyZmluLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc1MzE4ODU3NiwiZXhwIjoxNzUzNzkzMzc2fQ.6ArltQY-pM2fBvtkl7R0VvOeeOTTo0ewix63HOdghLs';

async function testFeedCreation() {
  console.log('Testing feed creation...\n');
  
  const feedData = {
    name: 'Test Feed ' + Date.now(),
    type: 'rss',
    url: 'https://example.com/feed-' + Date.now() + '.xml',
    config: {
      categories: ['finance', 'technology'],
      priority: 'medium',
      updateFrequency: 'hourly'
    }
  };
  
  console.log('Request data:', JSON.stringify(feedData, null, 2));
  console.log('\nMaking request to:', `${API_URL}/feeds`);
  console.log('Headers:', {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer [TOKEN]'
  });
  
  try {
    const response = await axios.post(`${API_URL}/feeds`, feedData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\nSuccess! Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\nError occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testFeedCreation();