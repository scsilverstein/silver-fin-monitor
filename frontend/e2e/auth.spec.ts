import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5177/login');
  });

  test('should display login page with all elements', async ({ page }) => {
    // Check logo and title
    await expect(page.locator('h1')).toContainText('Welcome to Silver Fin');
    await expect(page.locator('text=AI-Powered Market Intelligence Platform')).toBeVisible();

    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');

    // Check demo account button
    await expect(page.locator('text=Use Demo Account')).toBeVisible();

    // Check features section
    await expect(page.locator('text=AI-Powered Analysis')).toBeVisible();
    await expect(page.locator('text=Secure & Private')).toBeVisible();
    await expect(page.locator('text=Real-time Insights')).toBeVisible();
  });

  test('should handle invalid login attempt', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should populate demo credentials', async ({ page }) => {
    // Click demo account button
    await page.click('text=Use Demo Account');

    // Check if fields are populated
    await expect(page.locator('input[type="email"]')).toHaveValue('admin@silverfin.com');
    await expect(page.locator('input[type="password"]')).toHaveValue('password');
  });

  test('should successfully login with demo credentials', async ({ page }) => {
    // Click demo account button
    await page.click('text=Use Demo Account');
    
    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL('**/dashboard');

    // Verify dashboard is loaded
    await expect(page.locator('h1')).toContainText('Market Intelligence Dashboard');
    await expect(page.locator('text=Real-time insights powered by AI analysis')).toBeVisible();
  });

  test('should handle loading state during login', async ({ page }) => {
    // Fill demo credentials
    await page.click('text=Use Demo Account');

    // Intercept login request to delay it
    await page.route('**/api/v1/auth/login', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });

    // Submit form
    await page.click('button[type="submit"]');

    // Check loading state
    await expect(page.locator('button[type="submit"] svg.animate-spin')).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard directly
    await page.goto('http://localhost:5177/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('http://localhost:5177/login');
  });
});