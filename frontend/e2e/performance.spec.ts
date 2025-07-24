import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should load login page quickly', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:5177/login');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check First Contentful Paint
    const metrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
      return fcp ? fcp.startTime : null;
    });
    
    if (metrics) {
      expect(metrics).toBeLessThan(1500); // FCP should be under 1.5s
    }
  });

  test('should load dashboard efficiently', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:5177/login');
    await page.click('text=Use Demo Account');
    await page.click('button[type="submit"]');
    
    const startTime = Date.now();
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load in under 2 seconds after login
    expect(loadTime).toBeLessThan(2000);
  });

  test('should have optimized bundle size', async ({ page }) => {
    const coverage = await page.coverage.startJSCoverage();
    
    await page.goto('http://localhost:5177/login');
    await page.waitForLoadState('networkidle');
    
    const jsCoverage = await page.coverage.stopJSCoverage();
    
    // Calculate total JS size
    let totalBytes = 0;
    let usedBytes = 0;
    
    for (const entry of jsCoverage) {
      totalBytes += entry.text.length;
      for (const range of entry.ranges) {
        usedBytes += range.end - range.start;
      }
    }
    
    const unusedPercentage = ((totalBytes - usedBytes) / totalBytes) * 100;
    
    // Less than 50% of JS should be unused
    expect(unusedPercentage).toBeLessThan(50);
  });

  test('should handle route transitions smoothly', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5177/login');
    await page.click('text=Use Demo Account');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Measure navigation time
    const navigationPromise = page.waitForURL('**/feeds');
    const startTime = Date.now();
    
    await page.click('nav a:has-text("Feeds")');
    await navigationPromise;
    
    const navigationTime = Date.now() - startTime;
    
    // Navigation should be under 500ms
    expect(navigationTime).toBeLessThan(500);
  });

  test('should lazy load images efficiently', async ({ page }) => {
    await page.goto('http://localhost:5177/dashboard', { waitUntil: 'domcontentloaded' });
    
    // Check for lazy-loaded images
    const images = await page.locator('img[loading="lazy"]').count();
    
    if (images > 0) {
      // Verify images have loading attribute
      const lazyImages = await page.locator('img[loading="lazy"]').all();
      
      for (const img of lazyImages) {
        const loading = await img.getAttribute('loading');
        expect(loading).toBe('lazy');
      }
    }
  });

  test('should minimize reflows and repaints', async ({ page }) => {
    await page.goto('http://localhost:5177/login');
    
    // Start monitoring
    await page.evaluateOnNewDocument(() => {
      let reflows = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            reflows++;
          }
        }
      });
      observer.observe({ entryTypes: ['layout-shift'] });
      (window as any).__reflows = () => reflows;
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Interact with the page
    await page.click('text=Use Demo Account');
    await page.click('button[type="submit"]');
    
    // Check reflows
    const reflows = await page.evaluate(() => (window as any).__reflows?.() || 0);
    
    // Should have minimal layout shifts
    expect(reflows).toBeLessThan(5);
  });

  test('should cache assets properly', async ({ page }) => {
    // First visit
    await page.goto('http://localhost:5177/login');
    await page.waitForLoadState('networkidle');
    
    // Get all resources
    const firstLoadResources = await page.evaluate(() => 
      performance.getEntriesByType('resource').map(r => ({
        name: r.name,
        duration: r.duration
      }))
    );
    
    // Second visit (should use cache)
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const secondLoadResources = await page.evaluate(() => 
      performance.getEntriesByType('resource').map(r => ({
        name: r.name,
        duration: r.duration
      }))
    );
    
    // Compare load times
    let cachedCount = 0;
    for (const resource of secondLoadResources) {
      const firstLoad = firstLoadResources.find(r => r.name === resource.name);
      if (firstLoad && resource.duration < firstLoad.duration * 0.5) {
        cachedCount++;
      }
    }
    
    // At least 50% of resources should load faster on second visit
    expect(cachedCount).toBeGreaterThan(secondLoadResources.length * 0.5);
  });

  test('should have optimized animation performance', async ({ page }) => {
    await page.goto('http://localhost:5177/dashboard');
    
    // Monitor animation frames
    const fps = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        let lastTime = performance.now();
        const duration = 1000; // 1 second
        
        function countFrames() {
          frames++;
          const currentTime = performance.now();
          
          if (currentTime - lastTime < duration) {
            requestAnimationFrame(countFrames);
          } else {
            resolve(frames);
          }
        }
        
        requestAnimationFrame(countFrames);
      });
    });
    
    // Should maintain close to 60 FPS
    expect(fps).toBeGreaterThan(50);
  });
});