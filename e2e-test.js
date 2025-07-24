// Comprehensive E2E Testing Script for Silver Fin Monitor
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runComprehensiveTests() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for debugging
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Create results directory
  const resultsDir = '/Users/scott/silver-fin-mon-V2/test-results-manual';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const testResults = {
    authentication: {},
    dashboard: {},
    feeds: {},
    navigation: {},
    queue: {},
    errors: {},
    performance: {}
  };
  
  try {
    console.log('🚀 Starting comprehensive E2E testing of Silver Fin Monitor...');
    
    // Test 1: Authentication Flow
    console.log('\n📋 Testing Authentication Flow...');
    await page.goto('http://localhost:5177');
    await page.screenshot({ path: `${resultsDir}/01-initial-load.png`, fullPage: true });
    
    // Check if we land on login page or dashboard
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasLoginForm = await page.locator('input[type="email"]').count() > 0;
    
    if (hasLoginForm) {
      console.log('✅ Login page detected');
      testResults.authentication.loginPageLoad = 'PASS';
      
      // Check login form elements
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login")');
      const demoButton = page.locator('button:has-text("Demo"), button:has-text("Use Demo")');
      
      testResults.authentication.formElements = {
        email: await emailInput.count() > 0 ? 'PASS' : 'FAIL',
        password: await passwordInput.count() > 0 ? 'PASS' : 'FAIL',
        loginButton: await loginButton.count() > 0 ? 'PASS' : 'FAIL',
        demoButton: await demoButton.count() > 0 ? 'PASS' : 'FAIL'
      };
      
      // Test demo credentials
      try {
        if (await demoButton.count() > 0) {
          await demoButton.first().click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${resultsDir}/02-demo-credentials.png`, fullPage: true });
          console.log('✅ Demo credentials populated');
          testResults.authentication.demoCredentials = 'PASS';
        }
        
        // Attempt login
        await loginButton.first().click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${resultsDir}/03-after-login.png`, fullPage: true });
        
        // Check if redirected to dashboard
        const currentUrl = page.url();
        if (currentUrl.includes('dashboard') || currentUrl === 'http://localhost:5177/') {
          console.log('✅ Login successful - redirected to dashboard');
          testResults.authentication.loginSuccess = 'PASS';
        } else {
          console.log('❌ Login failed - still on login page');
          testResults.authentication.loginSuccess = 'FAIL';
        }
      } catch (error) {
        console.log('❌ Login process failed:', error.message);
        testResults.authentication.loginSuccess = 'FAIL';
      }
    } else {
      console.log('✅ Already authenticated - on dashboard');
      testResults.authentication.alreadyAuthenticated = 'PASS';
    }
    
    // Test 2: Dashboard Testing
    console.log('\n📊 Testing Dashboard...');
    
    // Navigate to dashboard if not already there
    if (!page.url().includes('dashboard')) {
      await page.goto('http://localhost:5177/dashboard');
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: `${resultsDir}/04-dashboard-main.png`, fullPage: true });
    
    // Check dashboard elements
    const dashboardElements = {
      title: await page.locator('h1, h2').count(),
      cards: await page.locator('[class*="card"], .card').count(),
      charts: await page.locator('svg, canvas, [class*="chart"]').count(),
      buttons: await page.locator('button').count(),
      navigation: await page.locator('nav, [class*="nav"], [class*="sidebar"]').count()
    };
    
    testResults.dashboard.elements = dashboardElements;
    console.log('📊 Dashboard elements found:', dashboardElements);
    
    // Test interactive elements
    const interactiveButtons = await page.locator('button:visible').all();
    console.log(`🔘 Found ${interactiveButtons.length} interactive buttons`);
    testResults.dashboard.interactiveElements = interactiveButtons.length;
    
    // Test 3: Navigation Testing
    console.log('\n🧭 Testing Navigation...');
    
    const navigationItems = [
      { name: 'Dashboard', selectors: ['[href="/dashboard"], [href="/"], text=Dashboard'] },
      { name: 'Feeds', selectors: ['[href="/feeds"], text=Feeds'] },
      { name: 'Analysis', selectors: ['[href="/analysis"], text=Analysis'] },
      { name: 'Settings', selectors: ['[href="/settings"], text=Settings'] },
      { name: 'Insights', selectors: ['[href="/insights"], text=Insights'] },
      { name: 'Help', selectors: ['[href="/help"], text=Help'] }
    ];
    
    for (const navItem of navigationItems) {
      try {
        let navElement = null;
        for (const selector of navItem.selectors) {
          const elements = await page.locator(selector).all();
          if (elements.length > 0) {
            navElement = elements[0];
            break;
          }
        }
        
        if (navElement) {
          console.log(`✅ ${navItem.name} navigation found`);
          testResults.navigation[navItem.name.toLowerCase()] = 'FOUND';
          
          // Try to click and test navigation
          try {
            await navElement.click();
            await page.waitForTimeout(1000);
            const currentUrl = page.url();
            console.log(`🔗 ${navItem.name} navigation works - URL: ${currentUrl}`);
            testResults.navigation[navItem.name.toLowerCase() + '_navigation'] = 'PASS';
            
            // Take screenshot
            await page.screenshot({ 
              path: `${resultsDir}/nav-${navItem.name.toLowerCase()}.png`, 
              fullPage: true 
            });
          } catch (clickError) {
            console.log(`⚠️  ${navItem.name} navigation click failed:`, clickError.message);
            testResults.navigation[navItem.name.toLowerCase() + '_navigation'] = 'FAIL';
          }
        } else {
          console.log(`❌ ${navItem.name} navigation not found`);
          testResults.navigation[navItem.name.toLowerCase()] = 'NOT_FOUND';
        }
      } catch (error) {
        console.log(`❌ Error testing ${navItem.name}:`, error.message);
        testResults.navigation[navItem.name.toLowerCase()] = 'ERROR';
      }
    }
    
    // Test 4: Feeds Management
    console.log('\n📡 Testing Feeds Management...');
    
    // Navigate to feeds page
    try {
      await page.goto('http://localhost:5177/feeds');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${resultsDir}/05-feeds-page.png`, fullPage: true });
      
      // Check feeds page elements
      const feedElements = {
        feedsList: await page.locator('[class*="feed"], .feed-item, tbody tr').count(),
        processButton: await page.locator('button:has-text("Process"), button:has-text("Process Now")').count(),
        addButton: await page.locator('button:has-text("Add"), button:has-text("New")').count(),
        searchInput: await page.locator('input[type="search"], input[placeholder*="search"]').count(),
        statusIndicators: await page.locator('[class*="status"], [class*="badge"]').count()
      };
      
      testResults.feeds.elements = feedElements;
      console.log('📡 Feeds page elements:', feedElements);
      
      // Test "Process Now" functionality
      const processButtons = await page.locator('button:has-text("Process"), button:has-text("Process Now")').all();
      if (processButtons.length > 0) {
        console.log('🔄 Testing feed processing...');
        await processButtons[0].click();
        await page.waitForTimeout(2000);
        
        // Look for loading indicators or status changes
        const hasLoadingIndicator = await page.locator('[class*="loading"], [class*="spinner"], [class*="processing"]').count() > 0;
        testResults.feeds.processingFeedback = hasLoadingIndicator ? 'PASS' : 'NO_FEEDBACK';
        console.log('🔄 Processing feedback:', hasLoadingIndicator ? 'Found' : 'Not found');
        
        await page.screenshot({ path: `${resultsDir}/06-feeds-processing.png`, fullPage: true });
      }
      
      testResults.feeds.pageLoad = 'PASS';
    } catch (error) {
      console.log('❌ Feeds page error:', error.message);
      testResults.feeds.pageLoad = 'FAIL';
      testResults.feeds.error = error.message;
    }
    
    // Test 5: Queue System Integration
    console.log('\n⚡ Testing Queue System...');
    
    // Look for queue-related UI elements
    const queueElements = await page.locator('[class*="queue"], [class*="job"], [class*="task"]').count();
    const statusElements = await page.locator('[class*="status"], [class*="progress"]').count();
    
    testResults.queue = {
      queueElements,
      statusElements,
      realTimeUpdates: 'UNKNOWN' // Would need longer observation
    };
    
    console.log('⚡ Queue system elements found:', { queueElements, statusElements });
    
    // Test 6: Error Handling
    console.log('\n🚨 Testing Error Handling...');
    
    // Test invalid route
    await page.goto('http://localhost:5177/invalid-route-test');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${resultsDir}/07-invalid-route.png`, fullPage: true });
    
    const has404 = await page.locator('text=404, text="Not Found", text="Page not found"').count() > 0;
    const hasErrorMessage = await page.locator('[class*="error"], .error-message').count() > 0;
    
    testResults.errors = {
      invalidRoute: has404 || hasErrorMessage ? 'HANDLED' : 'NOT_HANDLED',
      errorDisplay: has404 || hasErrorMessage
    };
    
    console.log('🚨 Error handling:', testResults.errors);
    
    // Test 7: Performance Check
    console.log('\n⚡ Testing Performance...');
    
    const performanceMetrics = await page.evaluate(() => {
      return JSON.parse(JSON.stringify(performance.getEntriesByType('navigation')[0]));
    });
    
    testResults.performance = {
      loadTime: Math.round(performanceMetrics.loadEventEnd - performanceMetrics.navigationStart),
      domContentLoaded: Math.round(performanceMetrics.domContentLoadedEventEnd - performanceMetrics.navigationStart),
      firstPaint: Math.round(performanceMetrics.responseEnd - performanceMetrics.navigationStart)
    };
    
    console.log('⚡ Performance metrics:', testResults.performance);
    
    // Final screenshot of current state
    await page.screenshot({ path: `${resultsDir}/08-final-state.png`, fullPage: true });
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    testResults.executionError = error.message;
  } finally {
    // Save detailed results
    fs.writeFileSync(
      `${resultsDir}/test-results.json`, 
      JSON.stringify(testResults, null, 2)
    );
    
    // Generate summary report
    const summaryReport = generateSummaryReport(testResults);
    fs.writeFileSync(
      `${resultsDir}/summary-report.md`, 
      summaryReport
    );
    
    console.log('\n📋 Test Results Summary:');
    console.log(summaryReport);
    
    await browser.close();
  }
}

function generateSummaryReport(results) {
  let report = '# Silver Fin Monitor E2E Test Results\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Authentication Summary
  report += '## 🔐 Authentication Flow\n';
  if (results.authentication.loginPageLoad === 'PASS') {
    report += '✅ Login page loads correctly\n';
  }
  if (results.authentication.formElements) {
    report += `✅ Form elements: Email(${results.authentication.formElements.email}) Password(${results.authentication.formElements.password}) Login(${results.authentication.formElements.loginButton})\n`;
  }
  if (results.authentication.loginSuccess === 'PASS') {
    report += '✅ Demo login works correctly\n';
  } else if (results.authentication.loginSuccess === 'FAIL') {
    report += '❌ Demo login failed\n';
  }
  report += '\n';
  
  // Dashboard Summary
  report += '## 📊 Dashboard Testing\n';
  if (results.dashboard.elements) {
    report += `✅ Dashboard loaded with: ${results.dashboard.elements.title} titles, ${results.dashboard.elements.cards} cards, ${results.dashboard.elements.charts} charts\n`;
  }
  if (results.dashboard.interactiveElements) {
    report += `✅ Found ${results.dashboard.interactiveElements} interactive elements\n`;
  }
  report += '\n';
  
  // Navigation Summary
  report += '## 🧭 Navigation Testing\n';
  Object.entries(results.navigation).forEach(([key, value]) => {
    if (key.includes('_navigation')) {
      const pageName = key.replace('_navigation', '');
      if (value === 'PASS') {
        report += `✅ ${pageName} navigation works\n`;
      } else if (value === 'FAIL') {
        report += `❌ ${pageName} navigation broken\n`;
      }
    } else if (!key.includes('_')) {
      if (value === 'FOUND') {
        report += `✅ ${key} navigation found\n`;
      } else if (value === 'NOT_FOUND') {
        report += `❌ ${key} navigation missing\n`;
      }
    }
  });
  report += '\n';
  
  // Feeds Summary
  report += '## 📡 Feeds Management\n';
  if (results.feeds.pageLoad === 'PASS') {
    report += '✅ Feeds page loads successfully\n';
    if (results.feeds.elements) {
      report += `📊 Found: ${results.feeds.elements.feedsList} feeds, ${results.feeds.elements.processButton} process buttons\n`;
    }
    if (results.feeds.processingFeedback === 'PASS') {
      report += '✅ Processing feedback visible\n';
    } else if (results.feeds.processingFeedback === 'NO_FEEDBACK') {
      report += '⚠️  No visual feedback for processing\n';
    }
  } else {
    report += '❌ Feeds page failed to load\n';
    if (results.feeds.error) {
      report += `Error: ${results.feeds.error}\n`;
    }
  }
  report += '\n';
  
  // Queue System Summary
  report += '## ⚡ Queue System\n';
  report += `📊 Queue elements: ${results.queue.queueElements}, Status elements: ${results.queue.statusElements}\n`;
  report += '\n';
  
  // Error Handling Summary
  report += '## 🚨 Error Handling\n';
  if (results.errors.invalidRoute === 'HANDLED') {
    report += '✅ Invalid routes handled properly\n';
  } else {
    report += '❌ Invalid routes not handled\n';
  }
  report += '\n';
  
  // Performance Summary
  report += '## ⚡ Performance\n';
  if (results.performance.loadTime) {
    report += `📊 Load time: ${results.performance.loadTime}ms\n`;
    report += `📊 DOM ready: ${results.performance.domContentLoaded}ms\n`;
    
    if (results.performance.loadTime < 3000) {
      report += '✅ Load time acceptable (<3s)\n';
    } else {
      report += '⚠️  Load time slow (>3s)\n';
    }
  }
  report += '\n';
  
  // Issues & Recommendations
  report += '## 🔧 Issues & Recommendations\n';
  const issues = [];
  const recommendations = [];
  
  if (results.authentication.loginSuccess === 'FAIL') {
    issues.push('Authentication flow broken');
    recommendations.push('Fix demo login functionality');
  }
  
  if (results.feeds.processingFeedback === 'NO_FEEDBACK') {
    issues.push('No visual feedback for feed processing');
    recommendations.push('Add loading indicators and status updates');
  }
  
  if (results.errors.invalidRoute === 'NOT_HANDLED') {
    issues.push('404/error pages not implemented');
    recommendations.push('Add proper error pages and routing');
  }
  
  if (results.performance.loadTime > 3000) {
    issues.push('Slow page load times');
    recommendations.push('Optimize bundle size and implement lazy loading');
  }
  
  if (issues.length === 0) {
    report += '✅ No critical issues found!\n';
  } else {
    report += '### Issues Found:\n';
    issues.forEach(issue => report += `- ❌ ${issue}\n`);
    report += '\n### Recommendations:\n';
    recommendations.forEach(rec => report += `- 🔧 ${rec}\n`);
  }
  
  return report;
}

// Run the tests
runComprehensiveTests().catch(console.error);