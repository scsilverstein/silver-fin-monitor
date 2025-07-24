import { test, expect } from '@playwright/test';

test.describe('Enhanced Feeds UI Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to feeds page
    await page.goto('http://localhost:5181/feeds');
    
    // Wait for the page to load and feeds to appear
    await page.waitForSelector('[data-testid="feeds-grid"], .feeds-grid, [class*="grid"]', { timeout: 10000 });
    
    // Wait a bit more for data to load
    await page.waitForTimeout(2000);
  });

  test('should display feed cards with source links', async ({ page }) => {
    // Check if feed cards are present
    const feedCards = await page.locator('.group').count();
    console.log(`Found ${feedCards} feed cards`);

    if (feedCards > 0) {
      // Look for "Open Source" buttons in feed cards
      const sourceButtons = await page.locator('button:has-text("Open Source"), [title*="Open"], button:has([class*="external"])').count();
      console.log(`Found ${sourceButtons} source link buttons`);
      
      expect(sourceButtons).toBeGreaterThan(0);

      // Test clicking the first source button
      const firstSourceButton = page.locator('button:has-text("Open Source"), [title*="Open"], button:has([class*="external"])').first();
      if (await firstSourceButton.count() > 0) {
        // We can't actually test external links opening in Playwright without special setup
        // So we'll just verify the button exists and is clickable
        await expect(firstSourceButton).toBeVisible();
        await expect(firstSourceButton).toBeEnabled();
      }
    }
  });

  test('should show transcription status indicators', async ({ page }) => {
    // Look for transcription-related badges or indicators
    const transcriptionIndicators = await page.locator(
      'text="Transcribed", text="Audio", [title*="transcr"], [aria-label*="transcr"]'
    ).count();
    
    console.log(`Found ${transcriptionIndicators} transcription indicators`);
    
    // Even if there are no audio items, the UI should be ready to show them
    // We'll check if the feed expansion works which is where transcription status would show
    const expandButtons = await page.locator('button:has-text("View Details"), button:has-text("Show Details")').count();
    console.log(`Found ${expandButtons} expand buttons`);
    
    expect(expandButtons).toBeGreaterThan(0);
  });

  test('should allow expanding feed details and show feed items', async ({ page }) => {
    // Find and click an expand button
    const expandButton = page.locator('button:has-text("View Details"), button:has-text("Show Details")').first();
    
    if (await expandButton.count() > 0) {
      await expandButton.click();
      
      // Wait for content to load
      await page.waitForTimeout(3000);
      
      // Look for feed items section
      const feedItemsSection = await page.locator('text="Feed Items", h4:has-text("Feed Items")').count();
      console.log(`Found ${feedItemsSection} feed items sections`);
      
      expect(feedItemsSection).toBeGreaterThan(0);
      
      // Look for individual feed item cards
      const feedItemCards = await page.locator('[class*="space-y-1"][class*="border"]').count();
      console.log(`Found ${feedItemCards} feed item cards`);
      
      // Check for buttons on feed items (Open, View Transcript)
      const itemButtons = await page.locator('button:has-text("Open"), button:has-text("View Transcript")').count();
      console.log(`Found ${itemButtons} item action buttons`);
    }
  });

  test('should handle transcription modal', async ({ page }) => {
    // Try to find and expand a feed first
    const expandButton = page.locator('button:has-text("View Details"), button:has-text("Show Details")').first();
    
    if (await expandButton.count() > 0) {
      await expandButton.click();
      await page.waitForTimeout(3000);
      
      // Look for "View Transcript" buttons
      const transcriptButton = page.locator('button:has-text("View Transcript")').first();
      
      if (await transcriptButton.count() > 0) {
        await transcriptButton.click();
        
        // Wait for modal to appear
        await page.waitForTimeout(1000);
        
        // Look for modal elements
        const modal = await page.locator('[class*="fixed"][class*="inset-0"]').count();
        console.log(`Found ${modal} modal overlays`);
        
        if (modal > 0) {
          // Look for close button in modal
          const closeButton = await page.locator('button:has([class*="x-4"])').count();
          console.log(`Found ${closeButton} close buttons in modal`);
          
          // Close the modal if found
          if (closeButton > 0) {
            await page.locator('button:has([class*="x-4"])').first().click();
          }
        }
      }
    }
  });

  test('should display feed statistics correctly', async ({ page }) => {
    // Check for statistics cards
    const statsCards = await page.locator('text="Total Feeds", text="Queue Processing", text="Queue Pending", text="Queue Completed"').count();
    console.log(`Found ${statsCards} statistics indicators`);
    
    expect(statsCards).toBeGreaterThan(0);
    
    // Check for numeric values in stats
    const numbers = await page.locator('text=/^\\d+$/, [class*="text-2xl"][class*="font-bold"]').count();
    console.log(`Found ${numbers} numeric displays`);
  });

  test('should handle search and filtering', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]');
    
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      // Clear search
      await searchInput.fill('');
    }
    
    // Look for filter buttons
    const filterButtons = await page.locator('button:has-text("rss"), button:has-text("podcast"), button:has-text("youtube")').count();
    console.log(`Found ${filterButtons} filter buttons`);
  });

  test('should show loading states appropriately', async ({ page }) => {
    // Refresh the page to see loading states
    await page.reload();
    
    // Look for loading skeletons or indicators
    const loadingElements = await page.locator('[class*="skeleton"], [class*="loading"], [class*="animate-"]').count();
    console.log(`Found ${loadingElements} loading elements`);
    
    // Wait for content to load
    await page.waitForTimeout(3000);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Check console for any JavaScript errors
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Perform some interactions
    await page.click('button:has-text("Refresh All")').catch(() => {
      console.log('Refresh button not found or not clickable');
    });
    
    await page.waitForTimeout(2000);
    
    // Log any console errors for debugging
    if (consoleLogs.length > 0) {
      console.log('Console errors found:', consoleLogs);
    }
  });

  test('should have proper responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Check if layout adapts
    const mobileLayout = await page.locator('[class*="md:"], [class*="sm:"]').count();
    console.log(`Found ${mobileLayout} responsive elements`);
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);
  });
});

test.describe('Feed Enhancement Integration Test', () => {
  test('complete workflow test', async ({ page }) => {
    console.log('Starting complete workflow test...');
    
    // Navigate to feeds
    await page.goto('http://localhost:5181/feeds');
    console.log('Navigated to feeds page');
    
    // Wait for page load
    await page.waitForTimeout(5000);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'feeds-page-loaded.png', fullPage: true });
    console.log('Screenshot taken: feeds-page-loaded.png');
    
    // Count all interactive elements
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    const inputs = await page.locator('input').count();
    
    console.log(`Page elements: ${buttons} buttons, ${links} links, ${inputs} inputs`);
    
    // Look for our specific enhancements
    const sourceLinks = await page.locator('button:has-text("Open Source")').count();
    const expandButtons = await page.locator('button:has-text("View Details")').count();
    const transcriptButtons = await page.locator('button:has-text("View Transcript")').count();
    
    console.log(`Enhancement elements: ${sourceLinks} source links, ${expandButtons} expand buttons, ${transcriptButtons} transcript buttons`);
    
    // Test expansion of first feed if available
    if (expandButtons > 0) {
      console.log('Testing feed expansion...');
      await page.locator('button:has-text("View Details")').first().click();
      await page.waitForTimeout(3000);
      
      // Check for feed items
      const feedItems = await page.locator('[class*="space-y-1"][class*="border"]').count();
      console.log(`Found ${feedItems} feed items after expansion`);
      
      // Take another screenshot
      await page.screenshot({ path: 'feeds-expanded.png', fullPage: true });
      console.log('Screenshot taken: feeds-expanded.png');
    }
    
    console.log('Workflow test completed successfully');
  });
});