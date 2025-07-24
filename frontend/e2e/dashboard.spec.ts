import { test, expect } from '@playwright/test';

test.describe('Dashboard UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:5177/login');
    await page.click('text=Use Demo Account');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should display all dashboard sections', async ({ page }) => {
    // Header
    await expect(page.locator('h1')).toContainText('Market Intelligence Dashboard');
    await expect(page.locator('text=Generate Report')).toBeVisible();
    await expect(page.locator('text=Last 7 Days')).toBeVisible();

    // Metrics cards
    await expect(page.locator('text=Market Sentiment')).toBeVisible();
    await expect(page.locator('text=Prediction Accuracy')).toBeVisible();
    await expect(page.locator('text=Active Feeds')).toBeVisible();
    await expect(page.locator('text=AI Credits')).toBeVisible();

    // Chart section
    await expect(page.locator('text=Market Sentiment Analysis')).toBeVisible();
    await expect(page.locator('.recharts-wrapper')).toBeVisible();

    // Recent activity
    await expect(page.locator('text=Recent Activity')).toBeVisible();
    await expect(page.locator('text=Daily Analysis Completed')).toBeVisible();

    // Active predictions
    await expect(page.locator('text=Active Predictions')).toBeVisible();
    await expect(page.locator('text=Tech Sector Rally')).toBeVisible();

    // Quick actions
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=Generate Analysis')).toBeVisible();
  });

  test('should have responsive layout', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('.lg\\:col-span-2')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.md\\:flex-row')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.grid-cols-1')).toBeVisible();
  });

  test('should toggle sidebar', async ({ page }) => {
    // Check sidebar is visible
    await expect(page.locator('nav.sidebar')).toBeVisible();

    // Toggle sidebar
    await page.click('button[aria-label="Toggle sidebar"]');
    
    // Check sidebar state changed
    await expect(page.locator('nav.sidebar')).toHaveClass(/collapsed/);

    // Toggle back
    await page.click('button[aria-label="Toggle sidebar"]');
    await expect(page.locator('nav.sidebar')).not.toHaveClass(/collapsed/);
  });

  test('should navigate to different pages', async ({ page }) => {
    // Navigate to Feeds
    await page.click('nav a:has-text("Feeds")');
    await page.waitForURL('**/feeds');
    await expect(page.locator('h1')).toContainText('Feed Management');

    // Navigate to Analysis
    await page.click('nav a:has-text("Analysis")');
    await page.waitForURL('**/analysis');
    await expect(page.locator('h1')).toContainText('Analysis Page');

    // Navigate back to Dashboard
    await page.click('nav a:has-text("Dashboard")');
    await page.waitForURL('**/dashboard');
    await expect(page.locator('h1')).toContainText('Market Intelligence Dashboard');
  });

  test('should display user menu', async ({ page }) => {
    // Click user avatar
    await page.click('button[aria-label="User menu"]');

    // Check dropdown menu
    await expect(page.locator('text=admin@silverfin.com')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Logout')).toBeVisible();
  });

  test('should handle theme toggle', async ({ page }) => {
    // Check initial theme
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/light/);

    // Toggle theme
    await page.click('button[aria-label="Toggle theme"]');
    
    // Check dark theme applied
    await expect(htmlElement).toHaveClass(/dark/);

    // Toggle back
    await page.click('button[aria-label="Toggle theme"]');
    await expect(htmlElement).toHaveClass(/light/);
  });

  test('should show notifications', async ({ page }) => {
    // Click notifications button
    await page.click('button[aria-label="Notifications"]');

    // Check notification panel
    await expect(page.locator('text=Notifications')).toBeVisible();
    await expect(page.locator('text=New prediction available')).toBeVisible();
  });

  test('should display loading states', async ({ page }) => {
    // Reload page to see loading states
    await page.reload();

    // Check for skeleton loaders
    await expect(page.locator('.skeleton')).toBeVisible();

    // Wait for content to load
    await page.waitForSelector('.skeleton', { state: 'hidden' });
    await expect(page.locator('text=Market Intelligence Dashboard')).toBeVisible();
  });
});