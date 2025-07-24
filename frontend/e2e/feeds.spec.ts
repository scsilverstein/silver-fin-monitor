import { test, expect } from '@playwright/test';

test.describe('Feeds Management UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:5177/login');
    await page.click('text=Use Demo Account');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Navigate to feeds
    await page.click('nav a:has-text("Feeds")');
    await page.waitForURL('**/feeds');
  });

  test('should display feeds page with all sections', async ({ page }) => {
    // Header
    await expect(page.locator('h1')).toContainText('Feed Management');
    await expect(page.locator('text=Monitor and manage your data sources')).toBeVisible();
    await expect(page.locator('text=Add Feed')).toBeVisible();
    await expect(page.locator('text=Sync All')).toBeVisible();

    // Stats cards
    await expect(page.locator('text=Total Feeds')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();
    await expect(page.locator('text=Items Processed')).toBeVisible();
    await expect(page.locator('text=Avg Health')).toBeVisible();

    // Search and filters
    await expect(page.locator('input[placeholder="Search feeds..."]')).toBeVisible();
    await expect(page.locator('button:has-text("RSS")')).toBeVisible();
    await expect(page.locator('button:has-text("Podcast")')).toBeVisible();

    // Feed cards
    await expect(page.locator('text=CNBC Squawk Box')).toBeVisible();
    await expect(page.locator('text=Bloomberg Surveillance')).toBeVisible();
  });

  test('should filter feeds by type', async ({ page }) => {
    // Click podcast filter
    await page.click('button:has-text("Podcast")');

    // Check only podcast feeds are visible
    await expect(page.locator('text=CNBC Squawk Box')).toBeVisible();
    await expect(page.locator('text=Bloomberg Surveillance')).toBeVisible();
    await expect(page.locator('text=Financial Times - Markets')).not.toBeVisible();

    // Click RSS filter
    await page.click('button:has-text("RSS")');

    // Check only RSS feeds are visible
    await expect(page.locator('text=Financial Times - Markets')).toBeVisible();
    await expect(page.locator('text=CNBC Squawk Box')).not.toBeVisible();

    // Clear filter
    await page.click('button[aria-label="Clear filters"]');
    await expect(page.locator('text=CNBC Squawk Box')).toBeVisible();
    await expect(page.locator('text=Financial Times - Markets')).toBeVisible();
  });

  test('should search feeds', async ({ page }) => {
    // Search for "Bloomberg"
    await page.fill('input[placeholder="Search feeds..."]', 'Bloomberg');

    // Check results
    await expect(page.locator('text=Bloomberg Surveillance')).toBeVisible();
    await expect(page.locator('text=CNBC Squawk Box')).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder="Search feeds..."]', '');
    await expect(page.locator('text=CNBC Squawk Box')).toBeVisible();
  });

  test('should display feed status correctly', async ({ page }) => {
    // Check active feed
    const activeCard = page.locator('div:has-text("CNBC Squawk Box")').first();
    await expect(activeCard.locator('text=active')).toBeVisible();
    await expect(activeCard.locator('.text-success')).toBeVisible();

    // Check processing feed
    const processingCard = page.locator('div:has-text("Financial Times - Markets")').first();
    await expect(processingCard.locator('text=processing')).toBeVisible();
    await expect(processingCard.locator('.animate-spin')).toBeVisible();

    // Check error feed
    const errorCard = page.locator('div:has-text("Peter Zeihan YouTube")').first();
    await expect(errorCard.locator('text=error')).toBeVisible();
    await expect(errorCard.locator('text=API rate limit exceeded')).toBeVisible();
  });

  test('should display feed health scores', async ({ page }) => {
    // Check health bar visualization
    const feedCard = page.locator('div:has-text("CNBC Squawk Box")').first();
    const healthBar = feedCard.locator('.bg-success');
    
    // Check health bar width
    const width = await healthBar.evaluate(el => el.style.width);
    expect(parseInt(width)).toBeGreaterThan(80);

    // Check low health feed
    const errorFeed = page.locator('div:has-text("Peter Zeihan YouTube")').first();
    const errorHealthBar = errorFeed.locator('.bg-destructive');
    const errorWidth = await errorHealthBar.evaluate(el => el.style.width);
    expect(parseInt(errorWidth)).toBeLessThan(50);
  });

  test('should show feed actions on hover', async ({ page }) => {
    const feedCard = page.locator('div:has-text("CNBC Squawk Box")').first();
    
    // Hover over card
    await feedCard.hover();

    // Check more options button appears
    await expect(feedCard.locator('button[aria-label="More options"]')).toBeVisible();

    // Check action buttons
    await expect(feedCard.locator('text=View Details')).toBeVisible();
    await expect(feedCard.locator('text=Process Now')).toBeVisible();
  });

  test('should display feed categories', async ({ page }) => {
    const feedCard = page.locator('div:has-text("CNBC Squawk Box")').first();
    
    // Check categories are displayed
    await expect(feedCard.locator('text=finance')).toBeVisible();
    await expect(feedCard.locator('text=markets')).toBeVisible();
  });

  test('should handle responsive grid layout', async ({ page }) => {
    // Desktop view - 2 columns
    await page.setViewportSize({ width: 1920, height: 1080 });
    const grid = page.locator('.grid');
    await expect(grid).toHaveClass(/grid-cols-2/);

    // Mobile view - 1 column
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(grid).toHaveClass(/grid-cols-1/);
  });

  test('should show add feed modal', async ({ page }) => {
    // Click Add Feed button
    await page.click('text=Add Feed');

    // Wait for modal
    await expect(page.locator('text=Add New Feed')).toBeVisible();
    await expect(page.locator('input[placeholder="Feed name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Feed URL"]')).toBeVisible();
    await expect(page.locator('select[name="feedType"]')).toBeVisible();
  });
});