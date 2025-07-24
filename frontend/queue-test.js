import { chromium } from '@playwright/test';

async function testQueueSystem() {
  console.log('🔄 Testing Queue System and Real-time Updates...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to application
    await page.goto('http://localhost:5177');
    await page.waitForTimeout(2000);
    
    // Check if login is needed
    const hasLoginForm = await page.locator('input[type="email"]').count() > 0;
    if (hasLoginForm) {
      const demoButton = page.locator('button:has-text("Demo")');
      if (await demoButton.count() > 0) {
        await demoButton.click();
        await page.waitForTimeout(1000);
      }
      
      const loginButton = page.locator('button[type="submit"], button:has-text("Sign In")').first();
      await loginButton.click();
      await page.waitForTimeout(3000);
    }
    
    console.log('✅ Authenticated');
    
    // Go to feeds page
    await page.goto('http://localhost:5177/feeds');
    await page.waitForTimeout(2000);
    
    console.log('📡 On feeds page, looking for process buttons...');
    
    // Find all process buttons
    const processButtons = await page.locator('button:has-text("Process")').all();
    console.log(`Found ${processButtons.length} process buttons`);
    
    if (processButtons.length > 0) {
      // Take before screenshot
      await page.screenshot({ path: './test-results-simple/queue-before.png', fullPage: true });
      
      // Click first process button
      console.log('🔄 Clicking process button...');
      await processButtons[0].click();
      
      // Watch for changes over 10 seconds
      console.log('👀 Watching for real-time updates...');
      
      const observations = [];
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);
        
        // Check for loading indicators
        const loadingElements = await page.locator('[class*="loading"], [class*="spinner"], [class*="processing"]').count();
        const statusElements = await page.locator('[class*="status"], [class*="badge"]').count();
        const progressElements = await page.locator('[class*="progress"]').count();
        
        observations.push({
          second: i + 1,
          loading: loadingElements,
          status: statusElements,
          progress: progressElements
        });
        
        console.log(`Second ${i + 1}: Loading(${loadingElements}) Status(${statusElements}) Progress(${progressElements})`);
        
        // Take screenshot at 3, 6, and 9 seconds
        if ([3, 6, 9].includes(i + 1)) {
          await page.screenshot({ 
            path: `./test-results-simple/queue-${i + 1}s.png`, 
            fullPage: true 
          });
        }
      }
      
      // Final screenshot
      await page.screenshot({ path: './test-results-simple/queue-after.png', fullPage: true });
      
      // Analyze observations
      const hasLoadingStates = observations.some(obs => obs.loading > 0);
      const hasStatusChanges = observations.some(obs => obs.status > 0);
      const hasProgressIndicators = observations.some(obs => obs.progress > 0);
      
      console.log('\n📊 Queue System Analysis:');
      console.log(`- Loading indicators detected: ${hasLoadingStates ? '✅' : '❌'}`);
      console.log(`- Status elements detected: ${hasStatusChanges ? '✅' : '❌'}`);
      console.log(`- Progress indicators detected: ${hasProgressIndicators ? '✅' : '❌'}`);
      
      // Check for network requests
      const networkRequests = [];
      page.on('request', request => {
        if (request.url().includes('api')) {
          networkRequests.push({
            url: request.url(),
            method: request.method(),
            timestamp: new Date()
          });
        }
      });
      
      // Wait a bit more to catch any delayed API calls
      await page.waitForTimeout(5000);
      
      console.log(`\n🌐 Network Activity: ${networkRequests.length} API requests detected`);
      networkRequests.forEach(req => {
        console.log(`  - ${req.method} ${req.url}`);
      });
      
      // Final assessment
      let queueScore = 0;
      if (hasLoadingStates) queueScore += 1;
      if (hasStatusChanges) queueScore += 1;
      if (hasProgressIndicators) queueScore += 1;
      if (networkRequests.length > 0) queueScore += 1;
      
      console.log(`\n🎯 Queue System Score: ${queueScore}/4`);
      
      if (queueScore >= 3) {
        console.log('✅ Queue system appears to be working well');
      } else if (queueScore >= 2) {
        console.log('⚠️ Queue system partially working');
      } else {
        console.log('❌ Queue system may have issues');
      }
      
    } else {
      console.log('❌ No process buttons found');
    }
    
    // Test dashboard real-time updates
    console.log('\n📊 Testing dashboard real-time updates...');
    
    await page.goto('http://localhost:5177/dashboard');
    await page.waitForTimeout(2000);
    
    // Take initial dashboard state
    const initialCards = await page.locator('[class*="card"]').count();
    const initialCharts = await page.locator('svg').count();
    
    console.log(`Initial dashboard state: ${initialCards} cards, ${initialCharts} charts`);
    
    // Wait and observe changes
    await page.waitForTimeout(5000);
    
    const finalCards = await page.locator('[class*="card"]').count();
    const finalCharts = await page.locator('svg').count();
    
    console.log(`Final dashboard state: ${finalCards} cards, ${finalCharts} charts`);
    
    if (finalCards !== initialCards || finalCharts !== initialCharts) {
      console.log('✅ Dashboard content appears to be dynamic');
    } else {
      console.log('⚠️ Dashboard content appears static');
    }
    
  } catch (error) {
    console.error('❌ Queue test error:', error.message);
  }
  
  await browser.close();
  console.log('✅ Queue system testing completed');
}

testQueueSystem().catch(console.error);