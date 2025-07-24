import { test, expect } from '@playwright/test';

test.describe('Silver Fin Monitor - Comprehensive UI Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5177');
  });

  test('App loads without JavaScript errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');
    
    // Check for critical errors (ignore HMR warnings)
    const criticalErrors = errors.filter(err => 
      !err.includes('HMR') && 
      !err.includes('vite') &&
      !err.includes('socket connection')
    );
    
    console.log('Console errors found:', criticalErrors);
    expect(criticalErrors.length).toBe(0);
  });

  test('Dashboard displays without authentication errors', async ({ page }) => {
    // Take a screenshot of the initial state
    await page.screenshot({ path: 'ui-test-initial.png', fullPage: true });
    
    // Check if login is required
    const loginForm = await page.locator('form').first().isVisible().catch(() => false);
    
    if (loginForm) {
      console.log('Login form detected');
      // Try to find navigation elements without logging in
      const navElements = await page.locator('[data-testid*="nav"], nav, header').count();
      console.log('Navigation elements found:', navElements);
    } else {
      console.log('No login form - app may be in development mode');
    }
  });

  test('Navigation and page structure', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for main navigation elements
    const navigation = await page.locator('nav, [role="navigation"], header').first();
    if (await navigation.isVisible()) {
      console.log('Navigation found');
      
      // Look for common navigation items
      const navItems = ['dashboard', 'feeds', 'analysis', 'predictions'];
      for (const item of navItems) {
        const navLink = await page.locator(`text=${item}`, { hasText: new RegExp(item, 'i') }).first().isVisible().catch(() => false);
        console.log(`Navigation item "${item}":`, navLink ? 'found' : 'not found');
      }
    }
    
    // Take screenshot of navigation
    await page.screenshot({ path: 'ui-test-navigation.png', fullPage: true });
  });

  test('Feeds page functionality', async ({ page }) => {
    // Try to navigate to feeds page
    const feedsLink = page.locator('text=feeds', { hasText: /feeds/i }).first();
    if (await feedsLink.isVisible()) {
      await feedsLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct navigation
      await page.goto('http://localhost:5177/feeds');
      await page.waitForLoadState('networkidle');
    }
    
    // Take screenshot of feeds page
    await page.screenshot({ path: 'ui-test-feeds-page.png', fullPage: true });
    
    // Check for feed cards or feed list
    const feedCards = await page.locator('[data-testid*="feed"], .feed-card, .card').count();
    console.log('Feed cards/elements found:', feedCards);
    
    // Check for key feed page elements
    const feedElements = {
      refreshButton: await page.locator('button:has-text("refresh")', { hasText: /refresh/i }).isVisible().catch(() => false),
      generateButton: await page.locator('button:has-text("generate")', { hasText: /generate|prediction/i }).isVisible().catch(() => false),
      addButton: await page.locator('button:has-text("add")', { hasText: /add/i }).isVisible().catch(() => false),
      feedList: await page.locator('.feed, [class*="feed"]').count()
    };
    
    console.log('Feed page elements:', feedElements);
  });

  test('Feed items display when expanded', async ({ page }) => {
    // Navigate to feeds
    await page.goto('http://localhost:5177/feeds');
    await page.waitForLoadState('networkidle');
    
    // Look for expandable feed cards
    const expandButton = page.locator('button:has-text("view details"), button:has-text("details"), [aria-expanded]').first();
    
    if (await expandButton.isVisible()) {
      console.log('Found expandable feed element');
      await expandButton.click();
      await page.waitForTimeout(1000); // Wait for expansion
      
      // Take screenshot after expansion
      await page.screenshot({ path: 'ui-test-feed-expanded.png', fullPage: true });
      
      // Check for feed items
      const feedItems = await page.locator('.feed-item, [class*="item"], li').count();
      console.log('Feed items found after expansion:', feedItems);
      
      // Look for processing status indicators
      const processed = await page.locator('text=processed', { hasText: /processed/i }).count();
      const pending = await page.locator('text=pending', { hasText: /pending/i }).count();
      console.log('Processing status indicators:', { processed, pending });
    }
  });

  test('Dashboard data visualization', async ({ page }) => {
    // Try to navigate to dashboard
    await page.goto('http://localhost:5177/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'ui-test-dashboard.png', fullPage: true });
    
    // Check for dashboard elements
    const dashboardElements = {
      charts: await page.locator('canvas, svg, .chart, [class*="chart"]').count(),
      cards: await page.locator('.card, [class*="card"]').count(),
      stats: await page.locator('.stat, [class*="stat"], .metric').count(),
      loading: await page.locator('[class*="loading"], .spinner, [class*="spinner"]').count()
    };
    
    console.log('Dashboard elements:', dashboardElements);
  });

  test('API integration and data loading', async ({ page }) => {
    // Monitor network requests
    const apiCalls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push(request.url());
      }
    });
    
    // Monitor responses
    const apiErrors: string[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        apiErrors.push(`${response.status()} - ${response.url()}`);
      }
    });
    
    // Navigate through the app
    await page.goto('http://localhost:5177/feeds');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('API calls made:', apiCalls);
    console.log('API errors:', apiErrors);
    
    // Take final screenshot
    await page.screenshot({ path: 'ui-test-final-state.png', fullPage: true });
  });

  test('Responsive design check', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('http://localhost:5177/feeds');
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ 
        path: `ui-test-${viewport.name}-${viewport.width}x${viewport.height}.png`, 
        fullPage: true 
      });
    }
  });

  test('Check for missing data display components', async ({ page }) => {
    await page.goto('http://localhost:5177');
    await page.waitForLoadState('networkidle');
    
    // Check what data should be displayed based on our database content
    const dataComponents = {
      // We have 20 feeds - should show feed list
      feedsList: await page.locator('.feed, [class*="feed"]').count(),
      
      // We have 83 raw feeds - should show in feed details
      rawFeedItems: await page.locator('.raw-feed, [class*="raw"]').count(),
      
      // We have 134 processed content - should show processing status
      processedContent: await page.locator('.processed, [class*="processed"]').count(),
      
      // We have 1 daily analysis - should show on dashboard
      dailyAnalysis: await page.locator('.analysis, [class*="analysis"]').count(),
      
      // Should have stats/metrics displays
      statsCards: await page.locator('.stats, .metric, [class*="stat"]').count(),
      
      // Should have data visualization
      charts: await page.locator('canvas, svg, .chart').count()
    };
    
    console.log('Data component analysis:', dataComponents);
    
    // Take screenshot for analysis
    await page.screenshot({ path: 'ui-test-data-components.png', fullPage: true });
  });
});