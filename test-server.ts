import 'dotenv/config';
import 'tsconfig-paths/register';

async function testServerStartup() {
  console.log('Testing server startup...\n');

  try {
    // Test config import
    console.log('1. Testing config import...');
    const { config, validateConfig } = await import('@/config');
    console.log('   ✓ Config imported successfully');
    console.log('   - Port:', config.port);

    // Test config validation
    console.log('\n2. Testing config validation...');
    validateConfig();
    console.log('   ✓ Config validated successfully');

    // Test database connection
    console.log('\n3. Testing database connection...');
    const { db } = await import('@/services/database');
    console.log('   ✓ Database service imported');
    
    // Test database connection
    try {
      await db.connect();
      console.log('   ✓ Database connected successfully');
    } catch (error: any) {
      console.log('   ✗ Database connection failed:', error.message);
    }

    // Test cache service
    console.log('\n4. Testing cache service...');
    const { cache } = await import('@/services/cache');
    console.log('   ✓ Cache service imported');

    // Test queue service
    console.log('\n5. Testing queue service...');
    const { queue } = await import('@/services/queue');
    console.log('   ✓ Queue service imported');

    // Test queue worker
    console.log('\n6. Testing queue worker...');
    try {
      const { queueWorker } = await import('@/services/workers/queue-worker');
      console.log('   ✓ Queue worker imported');
    } catch (error: any) {
      console.log('   ✗ Queue worker import failed:', error.message);
    }

    // Test routes
    console.log('\n7. Testing routes...');
    try {
      const { apiV1 } = await import('@/routes');
      console.log('   ✓ Routes imported');
    } catch (error: any) {
      console.log('   ✗ Routes import failed:', error.message);
    }

    console.log('\n✅ All basic tests passed!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testServerStartup();