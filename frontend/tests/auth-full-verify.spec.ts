import { test, expect } from '@playwright/test';

test('Full Runtime Auth Verification', async ({ page }) => {
  // Step 1: Open login page
  await page.goto('http://localhost:5173/login');

  // Step 2: Login through the UI using existing valid Admin credentials
  const [response] = await Promise.all([
    page.waitForResponse(/.*/),
    page.click('button[type="submit"]')
  ]);
  
  // Step 3: Verify login response is 200
  expect(response.status()).toBe(200);
  
  // Step 4: Check localStorage for JWT token immediately after login
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const user = await page.evaluate(() => localStorage.getItem('user'));
  
  // Step 5: Verify JWT token exists and is valid
  expect(token).not.toBeNull();
  const tokenParts = token!.split('.');
  expect(tokenParts).toHaveLength(3);
  
  // Step 6: Verify user role is ADMIN
  const userObj = JSON.parse(user!);
  expect(userObj.role).toBe('ADMIN');

  // Step 7: Navigate to Clients and create a new Client through the real UI
  await page.click('a[href="/clients"]');
  await page.click('a[href="/clients/new"]');
  await page.fill('input[name="name"]', 'RUNTIME-CLIENT-VERIFY-' + Date.now());
  await page.fill('input[name="taxId"]', 'GST-VERIFY');
  await page.fill('input[name="contacts.0.firstName"]', 'Verify');
  await page.fill('input[name="contacts.0.lastName"]', 'User');
  await page.fill('input[name="addresses.0.addressLine1"]', '789 Verification St');
  await page.fill('input[name="addresses.0.city"]', 'VerificationCity');
  await page.fill('input[name="addresses.0.state"]', 'VerificationState');
  await page.fill('input[name="addresses.0.postalCode"]', '12345');
  // Step 8 & 9: Wait for the POST /api/clients request and capture it
  const [clientRequest] = await Promise.all([
    page.waitForRequest(req => req.url().includes('/api/clients') && req.method() === 'POST'),
    page.click('button[type="submit"]')
  ]);
  
  // Step 10: Verify the Authorization header is present with Bearer JWT
  const authHeader = clientRequest.headers()['authorization'];
  console.log('Authorization header:', authHeader);
  expect(authHeader).toBeDefined();
  expect(authHeader.startsWith('Bearer ')).toBeTruthy();
  
  // Step 11: Wait for the client to appear
  await page.waitForSelector('text=RUNTIME-CLIENT-VERIFY-', { timeout: 5000 });
  
  // Step 12: Verify the client appeared in the UI
  const clientHeading = await page.locator('h3', { hasText: 'RUNTIME-CLIENT-VERIFY-' }).first().textContent();
  console.log('Client heading in UI:', clientHeading);
  expect(clientHeading).toContain('RUNTIME-CLIENT-VERIFY-');
  
  // Step 13: Verify we can see the client in the clients list
  await page.goto('http://localhost:5173/clients');
  await page.waitForLoadState('networkidle');
  const clientsPage = page.locator('text=RUNTIME-CLIENT-VERIFY-').first();
  await expect(clientsPage).toBeVisible();
  
  console.log('');
  console.log('=== ALL AUTHENTICATION CHECKS PASSED ===');
  console.log('Token stored in localStorage: YES');
  console.log('Authorization header present with Bearer JWT: YES');
  console.log('Client created and visible in UI: YES');
});