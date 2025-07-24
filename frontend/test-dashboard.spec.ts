import { test, expect } from '@playwright/test';

test('Dashboard CSS validation', async ({ page }) => {
  // Navigate to the dashboard
  await page.goto('http://localhost:8889/dashboard');
  
  // Take a screenshot for visual inspection
  await page.screenshot({ path: 'dashboard-screenshot.png', fullPage: true });
  
  // Check if CSS variables are properly loaded
  const rootStyles = await page.evaluate(() => {
    const root = document.documentElement;
    const computedStyles = window.getComputedStyle(root);
    return {
      background: computedStyles.getPropertyValue('--background'),
      foreground: computedStyles.getPropertyValue('--foreground'),
      primary: computedStyles.getPropertyValue('--primary'),
      border: computedStyles.getPropertyValue('--border'),
    };
  });
  
  console.log('CSS Variables:', rootStyles);
  
  // Check if Tailwind classes are being applied
  const bodyStyles = await page.evaluate(() => {
    const body = document.body;
    const computedStyles = window.getComputedStyle(body);
    return {
      backgroundColor: computedStyles.backgroundColor,
      color: computedStyles.color,
      fontFamily: computedStyles.fontFamily,
    };
  });
  
  console.log('Body Styles:', bodyStyles);
  
  // Check if modern components have styles
  const modernCard = await page.locator('.bg-background\\/80').first();
  if (await modernCard.count() > 0) {
    const cardStyles = await modernCard.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        backdropFilter: styles.backdropFilter,
        border: styles.border,
      };
    });
    console.log('Modern Card Styles:', cardStyles);
  }
  
  // Check for gradient elements
  const gradientElements = await page.locator('.text-gradient').all();
  console.log('Gradient elements found:', gradientElements.length);
  
  // Check if theme classes are present
  const htmlClasses = await page.evaluate(() => {
    return document.documentElement.className;
  });
  console.log('HTML classes:', htmlClasses);
  
  // Check for specific components
  const hasHeader = await page.locator('h1').count() > 0;
  const hasCards = await page.locator('[class*="card"]').count() > 0;
  const hasButtons = await page.locator('button').count() > 0;
  
  console.log('Component check:', {
    hasHeader,
    hasCards,
    hasButtons
  });
  
  // Verify CSS is loaded by checking computed styles
  const h1Styles = await page.locator('h1').first().evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      color: styles.color,
    };
  });
  console.log('H1 Styles:', h1Styles);
});

test('Check specific Tailwind utilities', async ({ page }) => {
  await page.goto('http://localhost:8889/dashboard');
  
  // Check if any elements have Tailwind spacing classes
  const elementsWithPadding = await page.locator('[class*="p-"]').count();
  const elementsWithMargin = await page.locator('[class*="m-"]').count();
  const elementsWithFlex = await page.locator('[class*="flex"]').count();
  
  console.log('Tailwind utility classes:', {
    padding: elementsWithPadding,
    margin: elementsWithMargin,
    flex: elementsWithFlex
  });
  
  // Check for modern design system classes
  const glassEffects = await page.locator('.glass').count();
  const gradientBackgrounds = await page.locator('[class*="gradient"]').count();
  const animations = await page.locator('[class*="animate-"]').count();
  
  console.log('Modern design classes:', {
    glass: glassEffects,
    gradients: gradientBackgrounds,
    animations: animations
  });
});