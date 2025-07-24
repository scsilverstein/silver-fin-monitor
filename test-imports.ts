// Test imports to debug the issue
console.log('Starting import test...');

try {
  console.log('1. Testing config import...');
  const config = require('./src/config');
  console.log('✓ Config imported successfully');
} catch (error: any) {
  console.error('✗ Config import failed:', error.message);
}

try {
  console.log('2. Testing database import...');
  const db = require('./src/services/database');
  console.log('✓ Database imported successfully');
} catch (error: any) {
  console.error('✗ Database import failed:', error.message);
}

try {
  console.log('3. Testing cache import...');
  const cache = require('./src/services/cache');
  console.log('✓ Cache imported successfully');
} catch (error: any) {
  console.error('✗ Cache import failed:', error.message);
}

try {
  console.log('4. Testing logger import...');
  const logger = require('./src/utils/logger');
  console.log('✓ Logger imported successfully');
} catch (error: any) {
  console.error('✗ Logger import failed:', error.message);
}

console.log('Import test completed.');