import 'dotenv/config';
import 'tsconfig-paths/register';

console.log('Starting minimal test...');

async function test() {
  try {
    console.log('\n1. Testing server import...');
    const server = await import('./src/server');
    console.log('Server imported successfully');
  } catch (error: any) {
    console.error('Server import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();