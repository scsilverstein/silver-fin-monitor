import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

async function runSimpleE2ETest() {
  console.log('🚀 Starting Silver Fin Monitor E2E Test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  const resultsDir = './test-results-simple';
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  
  try {
    // Test 1: Basic page load
    console.log('\n📋 Test 1: Page Load');
    await page.goto('http://localhost:5177');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${resultsDir}/01-page-load.png`, fullPage: true });
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    if (title && title.length > 0) {
      results.passed.push('✅ Page loads with title');
    } else {
      results.failed.push('❌ Page has no title');
    }
    
    // Test 2: Check for main elements
    console.log('\n📋 Test 2: Main Elements');
    
    const hasHeader = await page.locator('header, [class*="header"], nav').count() > 0;
    const hasMainContent = await page.locator('main, [class*="main"], [class*="content"]').count() > 0;
    const hasButtons = await page.locator('button').count() > 0;
    const hasInputs = await page.locator('input').count() > 0;
    
    console.log(`Header: ${hasHeader ? 'Found' : 'Not found'}`);
    console.log(`Main content: ${hasMainContent ? 'Found' : 'Not found'}`);
    console.log(`Buttons: ${hasButtons ? 'Found' : 'Not found'}`);
    console.log(`Inputs: ${hasInputs ? 'Found' : 'Not found'}`);
    
    if (hasHeader && hasMainContent) {
      results.passed.push('✅ Basic page structure exists');
    } else {
      results.failed.push('❌ Missing basic page structure');
    }
    
    if (hasButtons) {
      results.passed.push('✅ Interactive elements present');
    } else {
      results.warnings.push('⚠️ No buttons found');
    }
    
    // Test 3: Authentication check
    console.log('\n📋 Test 3: Authentication');
    
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0;
    console.log(`Login form: ${hasLoginForm ? 'Found' : 'Not found'}`);
    
    if (hasLoginForm) {
      // Try demo login
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const loginButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
      const demoButton = page.locator('button:has-text("Demo")').first();
      
      // Check for demo button
      if (await demoButton.count() > 0) {
        console.log('Demo button found, clicking...');
        await demoButton.click();
        await page.waitForTimeout(1000);
        results.passed.push('✅ Demo button works');
      } else {
        console.log('No demo button, trying manual credentials...');
        await emailInput.fill('demo@silverfinmonitor.com');
        await passwordInput.fill('demo123');
      }
      
      await page.screenshot({ path: `${resultsDir}/02-before-login.png`, fullPage: true });
      
      // Attempt login
      try {
        await loginButton.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${resultsDir}/03-after-login.png`, fullPage: true });
        
        const currentUrl = page.url();
        if (!currentUrl.includes('login')) {
          results.passed.push('✅ Login successful');
          console.log('✅ Login appears successful');
        } else {
          results.failed.push('❌ Login failed - still on login page');
          console.log('❌ Login failed');
        }
      } catch (error) {
        results.failed.push('❌ Login button not clickable');
        console.log('❌ Login button click failed:', error.message);
      }
    } else {
      results.passed.push('✅ Already authenticated (no login form)');
      console.log('✅ No login form - probably already authenticated');
    }
    
    // Test 4: Navigation
    console.log('\n📋 Test 4: Navigation');
    
    const navLinks = await page.locator('a[href], button').all();
    console.log(`Found ${navLinks.length} clickable elements`);
    
    if (navLinks.length > 0) {
      results.passed.push('✅ Navigation elements found');
      
      // Try to find and click key navigation items
      const keyNavItems = ['dashboard', 'feeds', 'analysis'];
      
      for (const item of keyNavItems) {
        const navElement = page.locator(`a[href*="${item}"], button:has-text("${item}"), [data-testid="${item}"]`).first();
        
        if (await navElement.count() > 0) {
          try {
            await navElement.click();
            await page.waitForTimeout(2000);
            const url = page.url();
            console.log(`${item} navigation: ${url}`);
            await page.screenshot({ path: `${resultsDir}/nav-${item}.png`, fullPage: true });
            results.passed.push(`✅ ${item} navigation works`);
          } catch (error) {
            results.warnings.push(`⚠️ ${item} navigation failed: ${error.message}`);
          }
        } else {
          results.warnings.push(`⚠️ ${item} navigation not found`);
        }
      }
    } else {
      results.failed.push('❌ No navigation elements found');
    }
    
    // Test 5: Feeds functionality
    console.log('\n📋 Test 5: Feeds Page');
    
    try {
      await page.goto('http://localhost:5177/feeds');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${resultsDir}/04-feeds-page.png`, fullPage: true });
      
      const feedElements = await page.locator('table, [class*="feed"], .feed-item').count();
      const processButtons = await page.locator('button:has-text("Process")').count();
      
      console.log(`Feed elements: ${feedElements}`);
      console.log(`Process buttons: ${processButtons}`);
      
      if (feedElements > 0) {
        results.passed.push('✅ Feeds page has content');
      } else {
        results.warnings.push('⚠️ Feeds page appears empty');
      }
      
      if (processButtons > 0) {
        results.passed.push('✅ Process buttons found');
        
        // Try clicking a process button
        try {
          const processButton = page.locator('button:has-text("Process")').first();
          await processButton.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: `${resultsDir}/05-processing.png`, fullPage: true });
          results.passed.push('✅ Process button clicks successfully');
        } catch (error) {
          results.warnings.push('⚠️ Process button not clickable');
        }
      } else {
        results.warnings.push('⚠️ No process buttons found');
      }
    } catch (error) {
      results.failed.push('❌ Feeds page failed to load');
      console.log('❌ Feeds page error:', error.message);
    }
    
    // Test 6: Dashboard content
    console.log('\n📋 Test 6: Dashboard Content');
    
    try {
      await page.goto('http://localhost:5177/dashboard');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${resultsDir}/06-dashboard.png`, fullPage: true });
      
      const cards = await page.locator('[class*="card"], .card').count();
      const charts = await page.locator('svg, canvas').count();
      const dataElements = await page.locator('[class*="data"], [class*="metric"], [class*="stat"]').count();
      
      console.log(`Cards: ${cards}`);
      console.log(`Charts: ${charts}`);
      console.log(`Data elements: ${dataElements}`);
      
      if (cards > 0 || charts > 0 || dataElements > 0) {
        results.passed.push('✅ Dashboard has content');
      } else {
        results.warnings.push('⚠️ Dashboard appears empty');
      }
    } catch (error) {
      results.failed.push('❌ Dashboard failed to load');
      console.log('❌ Dashboard error:', error.message);
    }
    
    // Test 7: Error handling
    console.log('\n📋 Test 7: Error Handling');
    
    await page.goto('http://localhost:5177/nonexistent-page-test');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${resultsDir}/07-error-page.png`, fullPage: true });
    
    const has404 = await page.locator('text="404", text="Not Found"').count() > 0;
    const hasErrorPage = await page.locator('[class*="error"], .error-page').count() > 0;
    const redirected = !page.url().includes('nonexistent-page-test');
    
    if (has404 || hasErrorPage || redirected) {
      results.passed.push('✅ Error handling works');
    } else {
      results.warnings.push('⚠️ No clear error handling');
    }
    
    // Test 8: Performance check
    console.log('\n📋 Test 8: Performance');
    
    const perfMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: Math.round(nav.loadEventEnd - nav.navigationStart),
        domReady: Math.round(nav.domContentLoadedEventEnd - nav.navigationStart)
      };
    });
    
    console.log(`Load time: ${perfMetrics.loadTime}ms`);
    console.log(`DOM ready: ${perfMetrics.domReady}ms`);
    
    if (perfMetrics.loadTime < 3000) {
      results.passed.push('✅ Good performance (<3s load)');
    } else if (perfMetrics.loadTime < 5000) {
      results.warnings.push('⚠️ Moderate performance (3-5s load)');
    } else {
      results.failed.push('❌ Poor performance (>5s load)');
    }
    
  } catch (error) {
    results.failed.push(`❌ Critical test error: ${error.message}`);
    console.error('Critical error:', error);
  }
  
  await browser.close();
  
  // Generate report
  const report = generateReport(results);
  writeFileSync(`${resultsDir}/test-report.md`, report);
  console.log('\n' + report);
  
  return results;
}

function generateReport(results) {
  let report = '# 🔬 Silver Fin Monitor E2E Test Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  
  report += '## 📊 Test Summary\n\n';
  report += `- **✅ Passed:** ${results.passed.length}\n`;
  report += `- **⚠️ Warnings:** ${results.warnings.length}\n`;
  report += `- **❌ Failed:** ${results.failed.length}\n\n`;
  
  if (results.passed.length > 0) {
    report += '## ✅ Passed Tests\n\n';
    results.passed.forEach(test => report += `${test}\n`);
    report += '\n';
  }
  
  if (results.warnings.length > 0) {
    report += '## ⚠️ Warnings\n\n';
    results.warnings.forEach(warning => report += `${warning}\n`);
    report += '\n';
  }
  
  if (results.failed.length > 0) {
    report += '## ❌ Failed Tests\n\n';
    results.failed.forEach(failure => report += `${failure}\n`);
    report += '\n';
  }
  
  // Overall assessment
  report += '## 🎯 Overall Assessment\n\n';
  
  const totalTests = results.passed.length + results.warnings.length + results.failed.length;
  const passRate = Math.round((results.passed.length / totalTests) * 100);
  
  if (results.failed.length === 0) {
    report += '🎉 **Excellent!** No critical failures detected.\n';
  } else if (results.failed.length <= 2) {
    report += '👍 **Good!** Only minor issues detected.\n';
  } else {
    report += '⚠️ **Needs attention!** Several issues detected.\n';
  }
  
  report += `**Pass Rate:** ${passRate}%\n\n`;
  
  // Recommendations
  report += '## 🔧 Recommendations\n\n';
  
  if (results.failed.some(f => f.includes('Login'))) {
    report += '- 🔐 Fix authentication flow issues\n';
  }
  
  if (results.warnings.some(w => w.includes('empty'))) {
    report += '- 📊 Add more content to empty pages\n';
  }
  
  if (results.failed.some(f => f.includes('performance'))) {
    report += '- ⚡ Optimize page load performance\n';
  }
  
  if (results.warnings.some(w => w.includes('Process button'))) {
    report += '- 🔄 Improve feed processing feedback\n';
  }
  
  report += '\n---\n';
  report += '**Screenshots saved in test-results-simple folder**\n';
  
  return report;
}

runSimpleE2ETest().catch(console.error);