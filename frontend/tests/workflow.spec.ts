import { test, expect } from '@playwright/test';

test.describe('E2E QA Workflow: Critical Business Tests via UI', () => {
  test('Complete System Walkthrough', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@ginger.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Welcome back,' })).toBeVisible();

    const ts = Date.now();
    const clientName = 'Playwright E2E Client ' + ts;

    await page.click('a[href="/clients"]');
    await expect(page.locator('h1', { hasText: 'Clients' })).toBeVisible();

    await page.click('a[href="/clients/new"]');
    await page.fill('input[name="name"]', clientName);
    await page.fill('input[name="taxId"]', 'GST-E2E');
    await page.fill('input[name="contacts.0.firstName"]', 'Test');
    await page.fill('input[name="contacts.0.lastName"]', 'User');
    await page.fill('input[name="addresses.0.addressLine1"]', '123 Test St');
    await page.fill('input[name="addresses.0.city"]', 'Selenium');
    await page.fill('input[name="addresses.0.state"]', 'Testing');
    await page.fill('input[name="addresses.0.postalCode"]', '12345');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:5173/clients');
    await expect(page.locator('h3', { hasText: clientName })).toBeVisible();

    await page.locator('h3', { hasText: clientName }).click();
    await expect(page.locator('h1', { hasText: clientName })).toBeVisible();

    await page.locator('a[href^="/orders/new"]').click();
    await page.locator('select').filter({ hasText: '-- Select Client --' }).selectOption({ label: clientName });
    await page.click('button:has-text("Add Product")');
    await page.locator('select').filter({ hasText: 'Select Product...' }).selectOption({ index: 1 });
    await page.getByPlaceholder('Qty').fill('10');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:5173/orders');
    const orderRow = page.locator('tr', { hasText: clientName }).first();
    await expect(orderRow).toBeVisible();
    await orderRow.locator('td:first-child a').click();

    await page.selectOption('select', { label: 'CONFIRMED' });
    page.once('dialog', (d) => d.accept());
    await page.click('button:has-text("Apply")');
    await expect(page.locator('span', { hasText: 'CONFIRMED' })).toBeVisible();

    await page.fill('input[placeholder="Qty"]', '5');
    await page.locator('input[type="text"]').first().fill('DHL');
    await page.click('button:has-text("Confirm Dispatch")');
    await expect(page.locator('span', { hasText: 'Remaining: 5' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'PARTIALLY_DISPATCHED' })).toBeVisible();

    await page.fill('input[placeholder="Qty"]', '5');
    await page.locator('input[type="text"]').first().fill('DHL2');
    await page.click('button:has-text("Confirm Dispatch")');
    await expect(page.locator('span', { hasText: 'Remaining: 0' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'FULLY_DISPATCHED' })).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.click('button:has-text("Mark as Completed")');
    await expect(page.locator('span', { hasText: 'COMPLETED' })).toBeVisible();

    await page.goto('http://localhost:5173/invoices/new');
    const invoiceNumber = 'INV-E2E-' + ts;
    await page.locator('select').first().selectOption({ label: clientName });
    await page.locator('input[type="text"]').first().fill(invoiceNumber);
    await page.locator('input[type="date"]').nth(1).fill(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    await page.locator('input[type="number"]').nth(0).fill('4520');
    await page.locator('input[type="number"]').nth(1).fill('0');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('http://localhost:5173/invoices');
    const invoiceRow = page.locator('tr', { hasText: invoiceNumber }).first();
    await expect(invoiceRow).toBeVisible();
    await expect(invoiceRow.locator('span', { hasText: 'UNPAID' })).toBeVisible();

    await page.goto('http://localhost:5173/payments/new');
    await page.locator('select').first().selectOption({ label: clientName });
    await page.locator('input[type="number"]').first().fill('4520');
    await page.click('button[type="submit"]');

    await expect(page.locator('h1', { hasText: 'Payment Allocation Grid' })).toBeVisible();
    const paymentOptionValue = await page.locator(`select option`, { hasText: clientName }).first().getAttribute('value');
    await page.locator('select').first().selectOption(paymentOptionValue || '');
    await page.fill('input[placeholder="0.00"]', '4520');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    page.once('dialog', (d) => d.accept());
    await page.click('button[type="submit"]');

    const allocatedInvoiceRow = page.locator('tr', { hasText: invoiceNumber }).first();
    await expect(allocatedInvoiceRow.locator('span', { hasText: 'PAID' })).toBeVisible();

    await page.goto('http://localhost:5173/documents');
    await page.click('button:has-text("Upload Document")');
    const docName = 'E2E POD ' + ts;
    await page.fill('input[placeholder="e.g. Purchase Order POD"]', docName);
    await page.locator('select').first().selectOption({ label: clientName });
    await page.setInputFiles('input[type="file"]', {
      name: 'pod.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('E2E proof of delivery')
    });
    await page.click('button[type="submit"]');
    const docRow = page.locator('tr', { hasText: docName }).first();
    await expect(docRow).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await docRow.locator('button[title="Delete"]').click();
    await expect(page.locator('tr', { hasText: docName })).toHaveCount(0);

    await page.goto('http://localhost:5173/followups');
    await page.click('button:has-text("New Follow-up")');
    await page.locator('select').first().selectOption({ label: clientName });
    await page.fill('input[type="datetime-local"]', '2026-08-25T10:30');
    const followUpNotes = 'E2E Follow-up notes ' + ts;
    await page.fill('textarea', followUpNotes);
    await page.click('button:has-text("Save Follow-up")');
    const followUpCard = page.locator('div.rounded-xl', { hasText: followUpNotes }).first();
    await expect(followUpCard).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await followUpCard.locator('button:has-text("Delete")').click();
    await expect(page.locator('div', { hasText: followUpNotes })).toHaveCount(0);
  });
});
