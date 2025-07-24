// Simple test to isolate server startup issues
const dotenv = require('dotenv');
const path = require('path');

console.log('Loading environment variables...');
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log('Environment result:', {
  parsed: Object.keys(result.parsed || {}),
  error: result.error
});

console.log('Key variables loaded:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'LOADED' : 'MISSING');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'LOADED' : 'MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'LOADED' : 'MISSING');

console.log('Testing basic imports...');
try {
  console.log('Testing express import...');
  const express = require('express');
  console.log('Express imported successfully');
  
  console.log('Testing app creation...');
  const app = express();
  console.log('Express app created successfully');
  
  console.log('Testing server start...');
  const server = app.listen(3002, () => {
    console.log('Test server started on port 3002');
    server.close();
    console.log('Test completed successfully');
  });
} catch (error) {
  console.error('Test failed:', error);
}