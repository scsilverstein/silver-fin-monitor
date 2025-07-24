# Silver Fin Monitor - E2E Test Suite

This directory contains end-to-end tests for the Silver Fin Monitor UI using Playwright.

## Test Coverage

### Authentication Tests (`auth.spec.ts`)
- Login page display and functionality
- Invalid login handling
- Demo account functionality
- Loading states during authentication
- Protected route redirects

### Dashboard Tests (`dashboard.spec.ts`)
- Dashboard layout and sections
- Responsive design verification
- Navigation between pages
- Sidebar toggle functionality
- Theme switching
- User menu interactions
- Notification display
- Loading states

### Feeds Management Tests (`feeds.spec.ts`)
- Feed listing and display
- Filtering by feed type
- Search functionality
- Feed status indicators
- Health score visualization
- Hover interactions
- Category display
- Responsive grid layout
- Add feed modal

### UI Components Tests (`ui-components.spec.ts`)
- Glass morphism effects
- Gradient text rendering
- Hover animations
- Loading spinners
- Badge variants
- Shadow effects
- Focus states
- Transitions
- Accessibility compliance
- Keyboard navigation

### Performance Tests (`performance.spec.ts`)
- Page load times
- First Contentful Paint metrics
- Bundle size optimization
- Route transition performance
- Lazy loading
- Layout stability
- Asset caching
- Animation performance (FPS)

## Running Tests

### Install Dependencies
```bash
npm install -D @playwright/test
npx playwright install
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
npx playwright test auth.spec.ts
npx playwright test dashboard.spec.ts
npx playwright test --grep "Performance"
```

### Run in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run with Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

### Generate Test Report
```bash
npx playwright show-report
```

## Test Configuration

Tests are configured to:
- Run against local development servers (backend: 3001, frontend: 5173)
- Test on multiple browsers (Chrome, Firefox, Safari)
- Test on mobile and tablet viewports
- Capture screenshots on failure
- Record videos for failed tests
- Generate trace files for debugging

## Writing New Tests

### Test Structure
```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup steps
  });

  test('should do something', async ({ page }) => {
    // Test steps
    await page.goto('/path');
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

### Best Practices
1. Use descriptive test names
2. Keep tests independent and atomic
3. Use page object pattern for complex pages
4. Leverage Playwright's auto-waiting
5. Add meaningful assertions
6. Test both happy and error paths
7. Include accessibility checks

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E Tests
  run: npm run test:e2e

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```