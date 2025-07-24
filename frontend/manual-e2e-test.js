import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

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
  const resultsDir = './test-results-manual';
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
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
      const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]');
      const demoButton = page.locator('button:has-text("Demo"), button:has-text("Use Demo")');
      
      testResults.authentication.formElements = {
        email: await emailInput.count() > 0 ? 'PASS' : 'FAIL',
        password: await passwordInput.count() > 0 ? 'PASS' : 'FAIL',
        loginButton: await loginButton.count() > 0 ? 'PASS' : 'FAIL',
        demoButton: await demoButton.count() > 0 ? 'PASS' : 'FAIL'
      };
      
      console.log('📋 Form elements:', testResults.authentication.formElements);
      
      // Test demo credentials if available
      try {
        if (await demoButton.count() > 0) {
          await demoButton.first().click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${resultsDir}/02-demo-credentials.png`, fullPage: true });
          console.log('✅ Demo credentials populated');
          testResults.authentication.demoCredentials = 'PASS';
        }
        
        // Try to fill demo credentials manually if no demo button
        if (await demoButton.count() === 0) {
          await emailInput.fill('demo@silverfinmonitor.com');
          await passwordInput.fill('demo123');
          console.log('📝 Manual demo credentials filled');
        }
        
        // Attempt login
        await loginButton.first().click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${resultsDir}/03-after-login.png`, fullPage: true });
        
        // Check if redirected to dashboard
        const currentUrl = page.url();
        console.log('🔗 Current URL after login:', currentUrl);
        
        if (currentUrl.includes('dashboard') || currentUrl === 'http://localhost:5177/') {
          console.log('✅ Login successful - redirected to dashboard');
          testResults.authentication.loginSuccess = 'PASS';
        } else {
          console.log('❌ Login failed - still on login page or error');
          testResults.authentication.loginSuccess = 'FAIL';
        }
      } catch (error) {
        console.log('❌ Login process failed:', error.message);
        testResults.authentication.loginSuccess = 'FAIL';
        testResults.authentication.error = error.message;
      }
    } else {
      console.log('✅ Already authenticated - on dashboard');
      testResults.authentication.alreadyAuthenticated = 'PASS';
    }
    
    // Test 2: Dashboard Testing
    console.log('\n📊 Testing Dashboard...');
    
    // Navigate to dashboard if not already there
    if (!page.url().includes('dashboard')) {
      try {
        await page.goto('http://localhost:5177/dashboard');
        await page.waitForTimeout(3000);
      } catch (error) {
        console.log('⚠️  Dashboard navigation failed, trying root URL');
        await page.goto('http://localhost:5177/');
        await page.waitForTimeout(3000);
      }
    }
    
    await page.screenshot({ path: `${resultsDir}/04-dashboard-main.png`, fullPage: true });
    
    // Check dashboard elements
    const dashboardElements = {
      titles: await page.locator('h1, h2, h3').count(),
      cards: await page.locator('[class*="card"], .card, [data-testid*="card"]').count(),
      charts: await page.locator('svg, canvas, [class*="chart"]').count(),
      buttons: await page.locator('button').count(),
      navigation: await page.locator('nav, [class*="nav"], [class*="sidebar"]').count(),
      loadingStates: await page.locator('[class*="loading"], [class*="skeleton"]').count()
    };
    
    testResults.dashboard.elements = dashboardElements;
    console.log('📊 Dashboard elements found:', dashboardElements);
    
    // Check for specific dashboard content
    const marketSentiment = await page.locator('text="Market Sentiment", [data-testid="market-sentiment"]').count();
    const recentPredictions = await page.locator('text="Recent Predictions", [data-testid="predictions"]').count();
    const feedsOverview = await page.locator('text="Feeds", text="Feed Status"').count();
    
    testResults.dashboard.specificContent = {
      marketSentiment: marketSentiment > 0 ? 'FOUND' : 'NOT_FOUND',
      recentPredictions: recentPredictions > 0 ? 'FOUND' : 'NOT_FOUND',
      feedsOverview: feedsOverview > 0 ? 'FOUND' : 'NOT_FOUND'
    };
    
    console.log('📈 Dashboard content:', testResults.dashboard.specificContent);
    
    // Test interactive elements
    const interactiveButtons = await page.locator('button:visible').all();
    console.log(`🔘 Found ${interactiveButtons.length} interactive buttons`);
    testResults.dashboard.interactiveElements = interactiveButtons.length;
    
    // Test 3: Navigation Testing
    console.log('\n🧭 Testing Navigation...');
    
    const navigationItems = [
      { name: 'Dashboard', paths: ['/dashboard', '/', '#dashboard'] },
      { name: 'Feeds', paths: ['/feeds', '#feeds'] },
      { name: 'Analysis', paths: ['/analysis', '#analysis'] },
      { name: 'Insights', paths: ['/insights', '#insights'] },
      { name: 'Settings', paths: ['/settings', '#settings'] },
      { name: 'Help', paths: ['/help', '#help'] }
    ];
    
    for (const navItem of navigationItems) {
      try {
        // Look for navigation elements
        const selectors = [
          `a[href="${navItem.paths[0]}"]`,
          `a[href*="${navItem.name.toLowerCase()}"]`,
          `button:has-text("${navItem.name}")`,
          `[data-testid="${navItem.name.toLowerCase()}"]`,
          `text="${navItem.name}"`
        ];
        
        let navElement = null;
        for (const selector of selectors) {
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
            await page.waitForTimeout(2000);
            const currentUrl = page.url();
            console.log(`🔗 ${navItem.name} navigation - URL: ${currentUrl}`);
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
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${resultsDir}/05-feeds-page.png`, fullPage: true });
      
      // Check feeds page elements
      const feedElements = {
        feedsList: await page.locator('table tbody tr, [class*="feed-item"], .feed-row').count(),
        processButtons: await page.locator('button:has-text("Process"), button:has-text("Process Now")').count(),
        addButton: await page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').count(),
        searchInput: await page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="filter"]').count(),
        statusIndicators: await page.locator('[class*="status"], [class*="badge"], [class*="indicator"]').count(),
        headers: await page.locator('th, [class*="header"]').count()
      };
      
      testResults.feeds.elements = feedElements;
      console.log('📡 Feeds page elements:', feedElements);
      
      // Test "Process Now" functionality
      const processButtons = await page.locator('button:has-text("Process"), button:has-text("Process Now")').all();
      if (processButtons.length > 0) {
        console.log('🔄 Testing feed processing...');
        const buttonText = await processButtons[0].textContent();
        console.log('🔘 Process button text:', buttonText);
        
        await processButtons[0].click();
        await page.waitForTimeout(3000);
        
        // Look for loading indicators or status changes
        const loadingIndicators = await page.locator('[class*="loading"], [class*="spinner"], [class*="processing"], [class*="pending"]').count();
        const statusChanges = await page.locator('[class*="success"], [class*="completed"], [class*="active"]').count();
        
        testResults.feeds.processingFeedback = {
          loadingIndicators,
          statusChanges,
          overall: (loadingIndicators > 0 || statusChanges > 0) ? 'PASS' : 'NO_FEEDBACK'
        };
        
        console.log('🔄 Processing feedback:', testResults.feeds.processingFeedback);
        
        await page.screenshot({ path: `${resultsDir}/06-feeds-processing.png`, fullPage: true });
      } else {
        console.log('⚠️  No process buttons found');
        testResults.feeds.processingFeedback = 'NO_BUTTONS';
      }
      
      testResults.feeds.pageLoad = 'PASS';
    } catch (error) {
      console.log('❌ Feeds page error:', error.message);
      testResults.feeds.pageLoad = 'FAIL';
      testResults.feeds.error = error.message;
      await page.screenshot({ path: `${resultsDir}/05-feeds-error.png`, fullPage: true });
    }
    
    // Test 5: Queue System Integration
    console.log('\n⚡ Testing Queue System...');
    
    // Look for queue-related UI elements
    const queueElements = await page.locator('[class*="queue"], [class*="job"], [class*="task"], [data-testid*="queue"]').count();
    const statusElements = await page.locator('[class*="status"], [class*="progress"], [class*="pending"], [class*="processing"]').count();
    const realTimeElements = await page.locator('[class*="live"], [class*="real-time"], [class*="update"]').count();
    
    testResults.queue = {
      queueElements,
      statusElements,
      realTimeElements,
      integration: queueElements > 0 ? 'INTEGRATED' : 'NOT_VISIBLE'
    };
    
    console.log('⚡ Queue system elements:', testResults.queue);
    
    // Test 6: Error Handling
    console.log('\n🚨 Testing Error Handling...');
    
    // Test invalid route
    await page.goto('http://localhost:5177/invalid-route-test-12345');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${resultsDir}/07-invalid-route.png`, fullPage: true });
    
    const has404 = await page.locator('text="404", text="Not Found", text="Page not found", h1:has-text("404")').count() > 0;
    const hasErrorMessage = await page.locator('[class*="error"], .error-message, .error-page').count() > 0;
    const hasRedirect = !page.url().includes('invalid-route-test-12345');
    
    testResults.errors = {
      invalidRoute: {
        has404Page: has404,
        hasErrorMessage: hasErrorMessage,
        redirectsToValid: hasRedirect,
        overall: (has404 || hasErrorMessage || hasRedirect) ? 'HANDLED' : 'NOT_HANDLED'
      }
    };
    
    console.log('🚨 Error handling:', testResults.errors);
    
    // Test network error simulation (if possible)
    try {
      await page.route('**/api/**', route => {
        route.abort('internetdisconnected');
      });
      
      await page.goto('http://localhost:5177/dashboard');
      await page.waitForTimeout(3000);
      
      const hasNetworkError = await page.locator('text="Network Error", text="Connection Failed", [class*="error"]').count() > 0;
      testResults.errors.networkError = hasNetworkError ? 'HANDLED' : 'NOT_HANDLED';
      console.log('🌐 Network error handling:', testResults.errors.networkError);
      
      await page.screenshot({ path: `${resultsDir}/08-network-error.png`, fullPage: true });
      
      // Remove the route to restore functionality
      await page.unroute('**/api/**');
    } catch (error) {
      console.log('⚠️  Network error test failed:', error.message);
    }
    
    // Test 7: Performance Check
    console.log('\n⚡ Testing Performance...');
    
    // Navigate to dashboard for performance test
    await page.goto('http://localhost:5177/dashboard');
    
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: Math.round(navigation.loadEventEnd - navigation.navigationStart),
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
        firstPaint: Math.round(navigation.responseEnd - navigation.navigationStart),
        transferSize: navigation.transferSize || 0
      };
    });
    
    testResults.performance = performanceMetrics;
    console.log('⚡ Performance metrics:', testResults.performance);
    
    // Final screenshot of current state
    await page.goto('http://localhost:5177/dashboard');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${resultsDir}/09-final-state.png`, fullPage: true });
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    testResults.executionError = error.message;
  } finally {
    // Save detailed results
    writeFileSync(
      `${resultsDir}/test-results.json`, 
      JSON.stringify(testResults, null, 2)
    );
    
    // Generate summary report
    const summaryReport = generateSummaryReport(testResults);
    writeFileSync(
      `${resultsDir}/summary-report.md`, 
      summaryReport
    );
    
    console.log('\n📋 Test Results Summary:');
    console.log(summaryReport);
    
    await browser.close();
    console.log('\n✅ Testing completed! Check the test-results-manual folder for screenshots and detailed results.');
  }
}

function generateSummaryReport(results) {
  let report = '# 🔬 Silver Fin Monitor E2E Test Results\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Test Environment:** http://localhost:5177\n\n`;
  
  report += '## 📋 Executive Summary\n\n';
  
  // Quick status indicators
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;
  
  // Authentication Summary
  report += '## 🔐 Authentication Flow\n\n';
  if (results.authentication.loginPageLoad === 'PASS') {
    report += '✅ **Login page loads correctly**\n';
    passCount++;
  } else {
    report += '❌ **Login page failed to load**\n';
    failCount++;
  }
  
  if (results.authentication.formElements) {
    const elements = results.authentication.formElements;
    report += `📋 **Form Elements Status:**\n`;
    report += `- Email Input: ${elements.email === 'PASS' ? '✅' : '❌'} ${elements.email}\n`;
    report += `- Password Input: ${elements.password === 'PASS' ? '✅' : '❌'} ${elements.password}\n`;
    report += `- Login Button: ${elements.loginButton === 'PASS' ? '✅' : '❌'} ${elements.loginButton}\n`;
    report += `- Demo Button: ${elements.demoButton === 'PASS' ? '✅' : '⚠️'} ${elements.demoButton}\n`;
    
    if (elements.email === 'PASS' && elements.password === 'PASS' && elements.loginButton === 'PASS') {
      passCount++;
    } else {
      failCount++;
    }
  }
  
  if (results.authentication.loginSuccess === 'PASS') {
    report += '✅ **Demo login works correctly**\n';
    passCount++;
  } else if (results.authentication.loginSuccess === 'FAIL') {
    report += '❌ **Demo login failed**\n';
    failCount++;
    if (results.authentication.error) {
      report += `   Error: ${results.authentication.error}\n`;
    }
  } else if (results.authentication.alreadyAuthenticated === 'PASS') {
    report += '✅ **Already authenticated (bypassed login)**\n';
    passCount++;
  }
  
  report += '\n';
  
  // Dashboard Summary
  report += '## 📊 Dashboard Testing\n\n';
  if (results.dashboard.elements) {
    const elements = results.dashboard.elements;
    report += '✅ **Dashboard loaded successfully**\n';
    report += `📊 **Elements Found:**\n`;
    report += `- Titles/Headers: ${elements.titles}\n`;
    report += `- Cards: ${elements.cards}\n`;
    report += `- Charts/Visualizations: ${elements.charts}\n`;
    report += `- Interactive Buttons: ${elements.buttons}\n`;
    report += `- Navigation Elements: ${elements.navigation}\n`;
    report += `- Loading States: ${elements.loadingStates}\n`;
    
    if (elements.cards > 0 && elements.buttons > 0) {
      passCount++;
    } else {
      warningCount++;
    }
  }
  
  if (results.dashboard.specificContent) {
    const content = results.dashboard.specificContent;
    report += `\n📈 **Dashboard Content:**\n`;
    report += `- Market Sentiment: ${content.marketSentiment === 'FOUND' ? '✅' : '⚠️'} ${content.marketSentiment}\n`;
    report += `- Recent Predictions: ${content.recentPredictions === 'FOUND' ? '✅' : '⚠️'} ${content.recentPredictions}\n`;
    report += `- Feeds Overview: ${content.feedsOverview === 'FOUND' ? '✅' : '⚠️'} ${content.feedsOverview}\n`;
  }
  
  report += '\n';
  
  // Navigation Summary
  report += '## 🧭 Navigation Testing\n\n';
  const navItems = ['dashboard', 'feeds', 'analysis', 'insights', 'settings', 'help'];
  navItems.forEach(item => {
    const found = results.navigation[item];
    const navigation = results.navigation[item + '_navigation'];
    
    if (found === 'FOUND') {
      if (navigation === 'PASS') {
        report += \`✅ **\${item.charAt(0).toUpperCase() + item.slice(1)}:** Found and navigable\n\`;
        passCount++;
      } else if (navigation === 'FAIL') {
        report += \`⚠️ **\${item.charAt(0).toUpperCase() + item.slice(1)}:** Found but navigation failed\n\`;
        warningCount++;
      } else {
        report += \`✅ **\${item.charAt(0).toUpperCase() + item.slice(1)}:** Found\n\`;
      }
    } else if (found === 'NOT_FOUND') {
      report += \`❌ **\${item.charAt(0).toUpperCase() + item.slice(1)}:** Not found\n\`;
      failCount++;
    } else if (found === 'ERROR') {
      report += \`❌ **\${item.charAt(0).toUpperCase() + item.slice(1)}:** Error during test\n\`;
      failCount++;
    }
  });
  
  report += '\n';
  
  // Feeds Summary
  report += '## 📡 Feeds Management\n\n';
  if (results.feeds.pageLoad === 'PASS') {
    report += '✅ **Feeds page loads successfully**\n';
    passCount++;
    
    if (results.feeds.elements) {
      const elements = results.feeds.elements;
      report += \`📊 **Feeds Page Elements:**\n\`;
      report += \`- Feed List Items: \${elements.feedsList}\n\`;
      report += \`- Process Buttons: \${elements.processButtons}\n\`;
      report += \`- Add/Create Buttons: \${elements.addButton}\n\`;
      report += \`- Search/Filter Inputs: \${elements.searchInput}\n\`;
      report += \`- Status Indicators: \${elements.statusIndicators}\n\`;
      report += \`- Table Headers: \${elements.headers}\n\`;
    }
    
    if (results.feeds.processingFeedback) {
      const feedback = results.feeds.processingFeedback;
      if (typeof feedback === 'object') {
        report += \`\n🔄 **Processing Feedback:**\n\`;
        report += \`- Loading Indicators: \${feedback.loadingIndicators}\n\`;
        report += \`- Status Changes: \${feedback.statusChanges}\n\`;
        report += \`- Overall: \${feedback.overall === 'PASS' ? '✅' : '⚠️'} \${feedback.overall}\n\`;
        
        if (feedback.overall === 'PASS') {
          passCount++;
        } else {
          warningCount++;
        }
      } else if (feedback === 'NO_BUTTONS') {
        report += '\n⚠️ **No process buttons found**\n';
        warningCount++;
      } else if (feedback === 'NO_FEEDBACK') {
        report += '\n⚠️ **No visual feedback for processing**\n';
        warningCount++;
      }
    }
  } else {
    report += '❌ **Feeds page failed to load**\n';
    failCount++;
    if (results.feeds.error) {
      report += \`   Error: \${results.feeds.error}\n\`;
    }
  }
  
  report += '\n';
  
  // Queue System Summary
  report += '## ⚡ Queue System Integration\n\n';
  if (results.queue) {
    report += \`📊 **Queue System Elements:**\n\`;
    report += \`- Queue Elements: \${results.queue.queueElements}\n\`;
    report += \`- Status Elements: \${results.queue.statusElements}\n\`;
    report += \`- Real-time Elements: \${results.queue.realTimeElements}\n\`;
    report += \`- Integration Status: \${results.queue.integration === 'INTEGRATED' ? '✅' : '⚠️'} \${results.queue.integration}\n\`;
    
    if (results.queue.integration === 'INTEGRATED') {
      passCount++;
    } else {
      warningCount++;
    }
  }
  
  report += '\n';
  
  // Error Handling Summary
  report += '## 🚨 Error Handling\n\n';
  if (results.errors.invalidRoute) {
    const error = results.errors.invalidRoute;
    report += \`**Invalid Route Handling:**\n\`;
    report += \`- 404 Page: \${error.has404Page ? '✅' : '❌'}\n\`;
    report += \`- Error Message: \${error.hasErrorMessage ? '✅' : '❌'}\n\`;
    report += \`- Valid Redirect: \${error.redirectsToValid ? '✅' : '❌'}\n\`;
    report += \`- Overall: \${error.overall === 'HANDLED' ? '✅' : '❌'} \${error.overall}\n\`;
    
    if (error.overall === 'HANDLED') {
      passCount++;
    } else {
      failCount++;
    }
  }
  
  if (results.errors.networkError) {
    report += \`\n**Network Error Handling:** \${results.errors.networkError === 'HANDLED' ? '✅' : '⚠️'} \${results.errors.networkError}\n\`;
    if (results.errors.networkError === 'HANDLED') {
      passCount++;
    } else {
      warningCount++;
    }
  }
  
  report += '\n';
  
  // Performance Summary
  report += '## ⚡ Performance Metrics\n\n';
  if (results.performance && results.performance.loadTime) {
    const perf = results.performance;
    report += \`📊 **Performance Results:**\n\`;
    report += \`- Total Load Time: \${perf.loadTime}ms\n\`;
    report += \`- DOM Content Loaded: \${perf.domContentLoaded}ms\n\`;
    report += \`- First Paint: \${perf.firstPaint}ms\n\`;
    report += \`- Transfer Size: \${perf.transferSize} bytes\n\`;
    
    if (perf.loadTime < 3000) {
      report += '✅ **Load time acceptable (<3s)**\n';
      passCount++;
    } else if (perf.loadTime < 5000) {
      report += '⚠️ **Load time acceptable but could be improved (3-5s)**\n';
      warningCount++;
    } else {
      report += '❌ **Load time too slow (>5s)**\n';
      failCount++;
    }
  }
  
  report += '\n';
  
  // Issues & Recommendations
  report += '## 🔧 Issues & Recommendations\n\n';
  
  const issues = [];
  const recommendations = [];
  const criticalIssues = [];
  
  // Analyze results for issues
  if (results.authentication.loginSuccess === 'FAIL') {
    criticalIssues.push('Authentication flow is broken');
    recommendations.push('🔧 Fix demo login functionality and error handling');
  }
  
  if (results.feeds.pageLoad === 'FAIL') {
    criticalIssues.push('Feeds page fails to load');
    recommendations.push('🔧 Debug and fix feeds page routing and rendering');
  }
  
  if (results.feeds.processingFeedback === 'NO_FEEDBACK' || 
      (results.feeds.processingFeedback && results.feeds.processingFeedback.overall === 'NO_FEEDBACK')) {
    issues.push('No visual feedback for feed processing');
    recommendations.push('🔧 Add loading indicators and real-time status updates');
  }
  
  if (results.errors.invalidRoute && results.errors.invalidRoute.overall === 'NOT_HANDLED') {
    issues.push('404/error pages not properly implemented');
    recommendations.push('🔧 Add proper error pages and routing guards');
  }
  
  if (results.performance && results.performance.loadTime > 5000) {
    issues.push('Page load performance is poor');
    recommendations.push('🔧 Optimize bundle size, implement lazy loading, and improve caching');
  }
  
  let navMissing = 0;
  navItems.forEach(item => {
    if (results.navigation[item] === 'NOT_FOUND') {
      navMissing++;
    }
  });
  
  if (navMissing > 2) {
    issues.push(\`Many navigation items missing (\${navMissing} out of \${navItems.length})\`);
    recommendations.push('🔧 Implement missing navigation items and routing');
  }
  
  // Summary
  report += \`### 📊 Test Summary\n\`;
  report += \`- **Passed:** \${passCount} ✅\n\`;
  report += \`- **Warnings:** \${warningCount} ⚠️\n\`;
  report += \`- **Failed:** \${failCount} ❌\n\`;
  report += \`- **Critical Issues:** \${criticalIssues.length} 🚨\n\n\`;
  
  if (criticalIssues.length === 0 && failCount === 0) {
    report += '🎉 **Excellent! No critical issues found!**\n\n';
  } else if (criticalIssues.length > 0) {
    report += '🚨 **Critical Issues Found:**\n';
    criticalIssues.forEach(issue => report += \`- ❌ \${issue}\n\`);
    report += '\n';
  }
  
  if (issues.length > 0) {
    report += '### ⚠️ Issues Found:\n';
    issues.forEach(issue => report += \`- ⚠️ \${issue}\n\`);
    report += '\n';
  }
  
  if (recommendations.length > 0) {
    report += '### 🛠️ Recommendations:\n';
    recommendations.forEach(rec => report += \`- \${rec}\n\`);
  } else if (issues.length === 0 && criticalIssues.length === 0) {
    report += '### 🎯 Optimization Opportunities:\n';
    report += '- 🚀 Consider implementing real-time WebSocket updates\n';
    report += '- 📱 Test mobile responsiveness thoroughly\n';
    report += '- 🔍 Add comprehensive error logging and monitoring\n';
    report += '- 🎨 Consider adding loading animations and micro-interactions\n';
  }
  
  report += '\n---\n';
  report += \`**Test completed at:** \${new Date().toLocaleString()}\n\`;
  report += '**Screenshots and detailed results available in test-results-manual folder**\n';
  
  return report;
}

// Run the tests
runComprehensiveTests().catch(console.error);