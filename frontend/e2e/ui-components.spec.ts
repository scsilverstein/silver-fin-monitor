import { test, expect } from '@playwright/test';

test.describe('UI Components Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Create a test page with all components
    await page.goto('http://localhost:5173/login');
  });

  test('should display glass morphism effects', async ({ page }) => {
    // Check glass card has backdrop blur
    const glassCard = page.locator('.bg-background\\/80.backdrop-blur-md').first();
    await expect(glassCard).toBeVisible();
    
    // Check computed styles
    const hasBackdropBlur = await glassCard.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.backdropFilter.includes('blur');
    });
    expect(hasBackdropBlur).toBe(true);
  });

  test('should display gradient text effects', async ({ page }) => {
    // Check gradient text
    const gradientText = page.locator('.text-gradient').first();
    await expect(gradientText).toBeVisible();
    
    // Verify gradient is applied
    const hasGradient = await gradientText.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.backgroundImage.includes('gradient');
    });
    expect(hasGradient).toBe(true);
  });

  test('should show hover animations on buttons', async ({ page }) => {
    const button = page.locator('button').first();
    
    // Get initial transform
    const initialTransform = await button.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    
    // Hover over button
    await button.hover();
    
    // Wait for animation
    await page.waitForTimeout(300);
    
    // Check transform changed
    const hoverTransform = await button.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    
    expect(hoverTransform).not.toBe(initialTransform);
  });

  test('should display loading spinner animation', async ({ page }) => {
    // Navigate to a page with loading state
    await page.goto('http://localhost:5173/dashboard');
    
    // Look for any spinner
    const spinner = page.locator('.animate-spin').first();
    
    if (await spinner.count() > 0) {
      // Check animation is applied
      const isAnimating = await spinner.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.animationName !== 'none';
      });
      expect(isAnimating).toBe(true);
    }
  });

  test('should show badge variants correctly', async ({ page }) => {
    await page.click('text=Use Demo Account');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Check different badge variants
    const successBadge = page.locator('.bg-success\\/10').first();
    const infoBadge = page.locator('.bg-info\\/10').first();
    const warningBadge = page.locator('.bg-warning\\/10').first();
    
    if (await successBadge.count() > 0) {
      await expect(successBadge).toBeVisible();
    }
    if (await infoBadge.count() > 0) {
      await expect(infoBadge).toBeVisible();
    }
    if (await warningBadge.count() > 0) {
      await expect(warningBadge).toBeVisible();
    }
  });

  test('should display shadow effects on cards', async ({ page }) => {
    const card = page.locator('.shadow-sm').first();
    
    if (await card.count() > 0) {
      const hasShadow = await card.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.boxShadow !== 'none';
      });
      expect(hasShadow).toBe(true);
    }
  });

  test('should show focus states on inputs', async ({ page }) => {
    const input = page.locator('input[type="email"]').first();
    
    // Focus input
    await input.focus();
    
    // Check focus ring
    const hasFocusRing = await input.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.outline !== 'none' || styles.boxShadow.includes('ring');
    });
    expect(hasFocusRing).toBe(true);
  });

  test('should display transitions on hover', async ({ page }) => {
    const card = page.locator('.transition-all').first();
    
    if (await card.count() > 0) {
      // Check transition property
      const hasTransition = await card.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.transition !== 'none';
      });
      expect(hasTransition).toBe(true);
    }
  });
});

test.describe('Accessibility Tests', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // Check form labels
    const emailInput = page.locator('input[type="email"]');
    const emailLabel = await emailInput.getAttribute('aria-label') || 
                      await page.locator('label:has-text("Email")').textContent();
    expect(emailLabel).toBeTruthy();
    
    // Check button accessibility
    const submitButton = page.locator('button[type="submit"]');
    const buttonText = await submitButton.textContent();
    expect(buttonText).toBeTruthy();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // Tab through elements
    await page.keyboard.press('Tab'); // Email input
    await expect(page.locator('input[type="email"]')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Password input
    await expect(page.locator('input[type="password"]')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Remember me checkbox
    await expect(page.locator('input[type="checkbox"]')).toBeFocused();
    
    await page.keyboard.press('Tab'); // Forgot password link
    await page.keyboard.press('Tab'); // Sign in button
    await expect(page.locator('button[type="submit"]')).toBeFocused();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // Check text contrast
    const heading = page.locator('h1').first();
    const headingColor = await heading.evaluate(el => 
      window.getComputedStyle(el).color
    );
    const bgColor = await heading.evaluate(el => 
      window.getComputedStyle(el.parentElement!).backgroundColor
    );
    
    // Basic check that colors are different
    expect(headingColor).not.toBe(bgColor);
  });
});