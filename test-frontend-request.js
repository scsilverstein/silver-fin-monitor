const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api/v1';

// Create axios instance exactly like the frontend
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add the same request interceptor
api.interceptors.request.use(
  (config) => {
    // Don't add auth token for this test
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add the same response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      const networkError = new Error('Network error - please check if the backend server is running');
      networkError.name = 'NetworkError';
      return Promise.reject(networkError);
    }

    // Log detailed error information for debugging
    console.error('API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method
    });
    
    return Promise.reject(error);
  }
);

// Test feed creation exactly like the frontend
const testFeedCreation = async () => {
  try {
    console.log('Testing feed creation...');
    
    const feedData = {
      name: 'Test Podcast Frontend',
      type: 'podcast',
      url: 'https://feeds.megaphone.fm/example-test',
      config: {
        categories: ['finance', 'investing'],
        priority: 'medium',
        updateFrequency: 'hourly',
        extractGuests: true,
        processTranscript: false
      }
    };
    
    console.log('Sending request with data:', JSON.stringify(feedData, null, 2));
    
    const response = await api.post('/feeds', feedData);
    
    console.log('Success!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Feed creation failed!');
    
    if (error.name === 'NetworkError') {
      console.error('Network Error:', error.message);
    } else if (error.response) {
      console.error('HTTP Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else {
      console.error('Unknown Error:', error.message);
    }
  }
};

testFeedCreation();