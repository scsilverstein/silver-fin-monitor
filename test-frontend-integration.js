const { chromium } = require('playwright');

async function testFrontendIntegration() {
  console.log('🚀 Starting frontend integration test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Navigate to frontend
    console.log('📱 Navigating to http://localhost:5177...');
    await page.goto('http://localhost:5177');
    await page.waitForTimeout(2000);
    
    // 2. Check if login page loads
    console.log('🔐 Checking login page...');
    const loginTitle = await page.locator('h1, h2, [data-testid="login-title"]').first().textContent();
    console.log(`   Login page title: ${loginTitle}`);
    
    // 3. Fill in login credentials
    console.log('📝 Filling login credentials...');
    await page.fill('input[type="email"], [data-testid="email"]', 'admin@silverfin.com');
    await page.fill('input[type="password"], [data-testid="password"]', 'password');
    
    // 4. Click login button
    console.log('🔑 Clicking login button...');
    await page.click('button[type="submit"], [data-testid="login-button"], button:has-text("Sign in"), button:has-text("Login")');
    
    // Wait for navigation or redirect
    await page.waitForTimeout(3000);
    
    // 5. Check if dashboard loads
    console.log('📊 Checking dashboard...');
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);
    
    // Look for dashboard elements
    const dashboardTitle = await page.locator('h1, h2, [data-testid="dashboard-title"]').first().textContent().catch(() => 'Not found');
    console.log(`   Dashboard title: ${dashboardTitle}`);
    
    // 6. Check for market sentiment
    console.log('📈 Checking market sentiment...');
    const sentimentElement = await page.locator('[data-testid="market-sentiment"], .market-sentiment, *:has-text("Market Sentiment")').first().isVisible().catch(() => false);
    console.log(`   Market sentiment visible: ${sentimentElement}`);
    
    // 7. Check for active feeds count
    console.log('📡 Checking active feeds...');
    const feedsCount = await page.locator('[data-testid="active-feeds"], *:has-text("Active Feeds"), *:has-text("Feed Sources")').first().isVisible().catch(() => false);
    console.log(`   Active feeds section visible: ${feedsCount}`);
    
    // 8. Check for recent content
    console.log('📰 Checking recent content...');
    const recentContent = await page.locator('[data-testid="recent-content"], *:has-text("Recent Content"), *:has-text("Content")').first().isVisible().catch(() => false);
    console.log(`   Recent content section visible: ${recentContent}`);
    
    // 9. Check for queue status
    console.log('⚡ Checking queue status...');
    const queueStatus = await page.locator('[data-testid="queue-status"], *:has-text("Queue"), *:has-text("Processing")').first().isVisible().catch(() => false);
    console.log(`   Queue status section visible: ${queueStatus}`);
    
    // 10. Check for predictions
    console.log('🔮 Checking predictions...');
    const predictions = await page.locator('[data-testid="predictions"], *:has-text("Prediction"), *:has-text("Forecast")').first().isVisible().catch(() => false);
    console.log(`   Predictions section visible: ${predictions}`);
    
    // 11. Take a screenshot
    await page.screenshot({ path: 'dashboard-test.png', fullPage: true });
    console.log('📸 Screenshot saved as dashboard-test.png');
    
    // 12. Check for any error messages
    const errors = await page.locator('.error, [class*="error"], .alert-error').count();
    console.log(`   Error messages found: ${errors}`);
    
    // 13. Check if data is loading vs loaded
    const loadingElements = await page.locator('.loading, [class*="loading"], .skeleton').count();
    const dataElements = await page.locator('[data-testid*="data"], .data-card, .stats-card').count();
    console.log(`   Loading elements: ${loadingElements}, Data elements: ${dataElements}`);
    
    console.log('✅ Frontend integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as test-error.png');
  } finally {
    await browser.close();
  }
}

testFrontendIntegration().catch(console.error);