// Test if stock screener controller can be imported
const path = require('path');

console.log('Testing stock screener controller import...');

try {
  // Test the controller import
  const { stockScreenerController } = require('./src/controllers/stock-screener.controller.ts');
  console.log('✅ Stock screener controller imported successfully');
  console.log('Available methods:', Object.keys(stockScreenerController));
} catch (error) {
  console.error('❌ Error importing stock screener controller:', error.message);
  console.error('Stack:', error.stack);
}

try {
  // Test the routes import
  const stockScreenerRoutes = require('./src/routes/stock-screener.routes.ts');
  console.log('✅ Stock screener routes imported successfully');
} catch (error) {
  console.error('❌ Error importing stock screener routes:', error.message);
  console.error('Stack:', error.stack);
}

try {
  // Test minimal routes import
  const { apiV1 } = require('./src/routes/index-minimal.ts');
  console.log('✅ Minimal routes imported successfully');
} catch (error) {
  console.error('❌ Error importing minimal routes:', error.message);
  console.error('Stack:', error.stack);
}