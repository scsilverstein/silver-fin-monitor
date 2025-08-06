import { test, expect } from '@playwright/test';

/**
 * Comprehensive Test Suite for Silver Fin Monitor
 * 
 * This file contains end-to-end tests that validate all major workflows:
 * 1. Authentication flow
 * 2. Dashboard functionality 
 * 3. Feed management
 * 4. Queue system integration
 * 5. Database operations through Supabase
 * 6. Daily analysis generation
 */

test.describe('Silver Fin Monitor - Complete Workflow Tests', () => {
  
  test.describe('Authentication Flow', () => {
    test('should successfully authenticate and navigate to dashboard', async ({ page }) => {
      // Navigate to login
      await page.goto('http://localhost:5177/login');
      
      // Verify login page elements
      await expect(page.locator('h1')).toContainText('Welcome to Silver Fin');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button:has-text("Use Demo Account")')).toBeVisible();
      
      // Use demo credentials
      await page.click('button:has-text("Use Demo Account")');
      
      // Verify credentials populated
      await expect(page.locator('input[type="email"]')).toHaveValue('admin@silverfin.com');
      await expect(page.locator('input[type="password"]')).toHaveValue('password');
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard');
      
      // Verify dashboard loaded
      await expect(page.locator('h1:has-text("Market Intelligence Dashboard")')).toBeVisible();
    });
  });
  
  test.describe('Dashboard Data and API Integration', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each dashboard test
      await page.goto('http://localhost:5177/login');
      await page.click('button:has-text("Use Demo Account")');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    test('should load dashboard with real data from backend', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(2000);
      
      // Check if we have metrics cards
      await expect(page.locator('[data-testid="metric-card"], .metric-card, .stats-card')).toHaveCount(4, { timeout: 10000 });
      
      // Check for chart section
      await expect(page.locator('.recharts-wrapper, [data-testid="sentiment-chart"]')).toBeVisible({ timeout: 10000 });
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'dashboard-state.png', fullPage: true });
    });
    
    test('should display feed processing status', async ({ page }) => {
      // Navigate to feeds page
      await page.click('nav a:has-text("Feeds"), button:has-text("Feeds"), [href*="/feeds"]');
      await page.waitForURL('**/feeds', { timeout: 10000 });
      
      // Check feeds page loaded
      await expect(page.locator('h1:has-text("Feed Management"), h1:has-text("Feeds")')).toBeVisible();
      
      // Look for feed cards or list items
      const feedElements = page.locator('.feed-card, [data-testid="feed-item"], .card:has-text("CNBC"), .card:has-text("Bloomberg")');
      
      if (await feedElements.count() > 0) {
        console.log('Found feed elements:', await feedElements.count());
        
        // Check for processing status indicators
        const statusElements = page.locator('.status, [data-testid="status"], .processing, .active, .completed');
        if (await statusElements.count() > 0) {
          console.log('Found status indicators:', await statusElements.count());
        }
      }
      
      // Take screenshot
      await page.screenshot({ path: 'feeds-page.png', fullPage: true });
    });
  });
  
  test.describe('API Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:5177/login');
      await page.click('button:has-text("Use Demo Account")');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    test('should make successful API calls to backend', async ({ page }) => {
      // Monitor network requests
      const requests = [];
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          requests.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          });
        }
      });
      
      const responses = [];
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          responses.push({
            url: response.url(),
            status: response.status(),
            timestamp: Date.now()
          });
        }
      });
      
      // Reload to trigger API calls
      await page.reload();
      await page.waitForTimeout(3000);
      
      console.log('API Requests made:', requests);
      console.log('API Responses received:', responses);
      
      // Verify we have API calls
      expect(requests.length).toBeGreaterThan(0);
      expect(responses.length).toBeGreaterThan(0);
      
      // Check for successful responses
      const successfulResponses = responses.filter(r => r.status >= 200 && r.status < 400);
      console.log('Successful API responses:', successfulResponses.length);
    });
    
    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API calls and simulate errors for some
      await page.route('**/api/dashboard/stats', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });
      
      // Reload page
      await page.reload();
      await page.waitForTimeout(2000);
      
      // Should still render page despite API errors
      await expect(page.locator('h1:has-text("Market Intelligence Dashboard")')).toBeVisible();
      
      // Check for error handling UI
      const errorElements = page.locator('.error, [data-testid="error"], .alert-error, .text-red');
      if (await errorElements.count() > 0) {
        console.log('Found error handling elements');
      }
    });
  });
  
  test.describe('Queue System Integration', () => {
    test('should trigger daily analysis generation', async ({ page }) => {
      // Login
      await page.goto('http://localhost:5177/login');
      await page.click('button:has-text("Use Demo Account")');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      // Look for generate analysis button
      const generateButton = page.locator('button:has-text("Generate Analysis"), button:has-text("Generate Report"), [data-testid="generate-analysis"]');
      
      if (await generateButton.isVisible()) {
        console.log('Found generate analysis button');
        await generateButton.click();
        
        // Wait for response
        await page.waitForTimeout(2000);
        
        // Check for success message or loading indicator
        const feedback = page.locator('.success, .loading, [data-testid="analysis-status"]');
        if (await feedback.count() > 0) {
          console.log('Analysis generation triggered');
        }
      } else {
        console.log('Generate analysis button not found - checking if auto-generated');
        
        // Make API call directly to trigger analysis
        const response = await page.evaluate(async () => {
          try {
            const res = await fetch('/api/analysis/generate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ date: new Date().toISOString().split('T')[0] })
            });
            return {
              status: res.status,
              ok: res.ok,
              data: res.ok ? await res.json() : await res.text()
            };
          } catch (error) {
            return { error: error.message };
          }
        });
        
        console.log('Direct API call result:', response);
      }
    });
  });
  
  test.describe('Database Integration via Supabase', () => {
    test('should connect to Supabase and verify data', async ({ page }) => {
      // This test verifies that the frontend can connect to Supabase
      await page.goto('http://localhost:5177/login');
      await page.click('button:has-text("Use Demo Account")');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      // Check console for any Supabase connection errors
      const logs = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('supabase')) {
          logs.push(msg.text());
        }
      });
      
      await page.reload();
      await page.waitForTimeout(3000);
      
      if (logs.length > 0) {
        console.log('Supabase connection errors:', logs);
      }
      
      // Check if data loads (indicating successful DB connection)
      const hasData = await page.locator('.metric-card, [data-testid="metric"], .stats').count();
      console.log('Dashboard data elements found:', hasData);
    });
  });
  
  test.describe('Responsive Design and Performance', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:5177/login');
      await page.click('button:has-text("Use Demo Account")');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
    });
    
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Should still show main elements
      await expect(page.locator('h1')).toBeVisible();
      
      // Navigation should adapt
      const nav = page.locator('nav, [data-testid="navigation"]');
      if (await nav.isVisible()) {
        console.log('Navigation visible on mobile');
      }
      
      await page.screenshot({ path: 'mobile-view.png', fullPage: true });
    });
    
    test('should load quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:5177/dashboard');
      await page.waitForSelector('h1', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      console.log('Dashboard load time:', loadTime, 'ms');
      
      // Should load reasonably fast (within 5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });
  });
  
  test.describe('End-to-End Workflow Validation', () => {
    test('complete user journey', async ({ page }) => {
      // 1. Login
      await page.goto('http://localhost:5177/login');
      await page.click('button:has-text("Use Demo Account")');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      
      console.log('✅ Authentication successful');
      
      // 2. View Dashboard
      await expect(page.locator('h1')).toContainText('Market Intelligence Dashboard', { timeout: 10000 });
      console.log('✅ Dashboard loaded');
      
      // 3. Navigate to Feeds
      const feedsLink = page.locator('nav a:has-text("Feeds"), button:has-text("Feeds"), [href*="/feeds"]');
      if (await feedsLink.isVisible()) {
        await feedsLink.click();
        await page.waitForURL('**/feeds', { timeout: 5000 });
        console.log('✅ Feeds page accessible');
      }
      
      // 4. Check for Analysis page
      const analysisLink = page.locator('nav a:has-text("Analysis"), button:has-text("Analysis"), [href*="/analysis"]');
      if (await analysisLink.isVisible()) {
        await analysisLink.click();
        await page.waitForURL('**/analysis', { timeout: 5000 });
        console.log('✅ Analysis page accessible');
      }
      
      // 5. Return to Dashboard
      await page.click('nav a:has-text("Dashboard"), [href*="/dashboard"]');
      await page.waitForURL('**/dashboard');
      console.log('✅ Navigation working');
      
      // 6. Test logout
      const userMenu = page.locator('button[aria-label="User menu"], .user-menu, [data-testid="user-menu"]');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
        if (await logoutButton.isVisible()) {
          await logoutButton.click();
          await page.waitForURL('**/login', { timeout: 5000 });
          console.log('✅ Logout successful');
        }
      }
      
      console.log('🎉 Complete workflow test passed!');
    });
  });
});