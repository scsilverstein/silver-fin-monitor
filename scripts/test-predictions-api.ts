import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Try to read token from local storage file
const tokenPath = path.join(os.homedir(), '.silverfintoken');
let token = '';

try {
  if (fs.existsSync(tokenPath)) {
    token = fs.readFileSync(tokenPath, 'utf8').trim();
    console.log('Found saved token');
  }
} catch (error) {
  console.log('No saved token found');
}

async function testPredictionsApi() {
  const apiUrl = 'http://localhost:3001/api/v1';
  
  try {
    // First, try to login if we don't have a token
    if (!token) {
      console.log('No token found, attempting login...');
      try {
        const loginResponse = await axios.post(`${apiUrl}/auth/login`, {
          email: 'admin@silverfin.com',
          password: 'admin123!'
        });
        
        console.log('Login response structure:', JSON.stringify(loginResponse.data, null, 2));
        token = loginResponse.data.data?.access_token || loginResponse.data.data?.token || loginResponse.data.access_token || loginResponse.data.token;
        console.log('Login successful!');
        console.log('Token received:', token ? 'Yes' : 'No');
        
        // Save token for future use
        if (token) {
          fs.writeFileSync(tokenPath, token);
        }
      } catch (loginError) {
        console.error('Login failed:', loginError.response?.data || loginError.message);
        return;
      }
    }
    
    // Test predictions endpoint
    console.log('\nTesting /predictions endpoint...');
    const predictionsResponse = await axios.get(`${apiUrl}/predictions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Predictions response:', JSON.stringify(predictionsResponse.data, null, 2));
    
    if (predictionsResponse.data.data && predictionsResponse.data.data.length > 0) {
      console.log(`\nFound ${predictionsResponse.data.data.length} predictions!`);
      
      // Show first prediction details
      const firstPrediction = predictionsResponse.data.data[0];
      console.log('\nFirst prediction:');
      console.log('- Type:', firstPrediction.prediction_type);
      console.log('- Time Horizon:', firstPrediction.time_horizon);
      console.log('- Confidence:', firstPrediction.confidence_level);
      console.log('- Text:', firstPrediction.prediction_text?.substring(0, 150) + '...');
    } else {
      console.log('\nNo predictions returned from API');
    }
    
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);
      console.error('Status:', error.response?.status);
      
      if (error.response?.status === 401) {
        console.log('\nToken may be expired. Deleting saved token.');
        try {
          fs.unlinkSync(tokenPath);
        } catch {}
      }
    } else {
      console.error('Error:', error);
    }
  }
}

testPredictionsApi();