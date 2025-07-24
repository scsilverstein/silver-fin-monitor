import 'dotenv/config';
import 'tsconfig-paths/register';

console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
console.log('- SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Not set');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');

// Test config loading
try {
  const config = require('./src/config').default;
  console.log('\nConfig loaded successfully');
  console.log('- Port:', config.port);
  console.log('- Database URL:', config.database.url ? 'Set' : 'Not set');
} catch (error: any) {
  console.error('\nConfig loading failed:', error.message);
}

// Test basic imports
try {
  console.log('\nTesting service imports...');
  const { db } = require('./src/services/database');
  console.log('- Database service: OK');
  
  const { cache } = require('./src/services/cache');
  console.log('- Cache service: OK');
  
  const { queue } = require('./src/services/queue');
  console.log('- Queue service: OK');
  
  console.log('\nAll imports successful!');
} catch (error: any) {
  console.error('\nImport error:', error.message);
  console.error(error.stack);
}