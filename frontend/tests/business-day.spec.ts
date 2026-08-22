import { test, expect } from '@playwright/test';

test.describe('Business Day Execution & Edge Cases', () => {
  test('Business Day Workflow', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@ginger.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();

    const ts = Date.now();
    const clientName = 'BizDay Client ' + ts;

    // 1. Create client with contact & address
    await page.click('a[href="/clients"]');
    await page.click('a[href="/clients/new"]');
    await page.fill('input[name="name"]', clientName);
    await page.fill('input[name="taxId"]', 'GST-BIZ');
    await page.fill('input[name="contacts.0.firstName"]', 'Biz');
    await page.fill('input[name="contacts.0.lastName"]', 'User');
    await page.fill('input[name="addresses.0.addressLine1"]', '456 Biz St');
    await page.fill('input[name="addresses.0.city"]', 'Business');
    await page.fill('input[name="addresses.0.state"]', 'BizState');
    await page.fill('input[name="addresses.0.postalCode"]', '67890');
    await page.click('button[type="submit"]');
    await expect(page.locator('h3', { hasText: clientName })).toBeVisible();

    // 2. Create order (qty 1000)
    await page.click('a[href="/orders"]');
    await page.click('a[href="/orders/new"]');
    await page.locator('select').filter({ hasText: '-- Select Client --' }).selectOption({ label: clientName });
    await page.click('button:has-text("Add Product")');
    await page.locator('select').filter({ hasText: 'Select Product...' }).selectOption({ index: 1 });
    await page.getByPlaceholder('Qty').fill('1000');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:5173/orders');

    // 3. Click order row by client name
    const orderRow = page.locator('tr', { hasText: clientName }).first();
    await expect(orderRow).toBeVisible();
    await orderRow.locator('td:first-child a').click();

    // 4. Confirm order: DRAFT -> CONFIRMED
    await page.selectOption('select', { label: 'CONFIRMED' });
    page.once('dialog', (d) => d.accept());
    await page.click('button:has-text("Apply")');
    await expect(page.locator('span', { hasText: 'CONFIRMED' })).toBeVisible();

    // 5. Partial dispatch 600 -> remaining 400
    await page.fill('input[placeholder="Qty"]', '600');
    await page.locator('input[type="text"]').first().fill('Carrier600');
    await page.click('button:has-text("Confirm Dispatch")');
    await expect(page.locator('span', { hasText: 'Remaining: 400' })).toBeVisible();

    // 6. Full dispatch 400 -> remaining 0
    await page.fill('input[placeholder="Qty"]', '400');
    await page.locator('input[type="text"]').first().fill('Carrier400');
    await page.click('button:has-text("Confirm Dispatch")');
    await expect(page.locator('span', { hasText: 'Remaining: 0' })).toBeVisible();
    await expect(page.locator('span', { hasText: 'FULLY_DISPATCHED' })).toBeVisible();

    // 7. Mark as Completed
    page.once('dialog', (d) => d.accept());
    await page.click('button:has-text("Mark as Completed")');
    await expect(page.locator('span', { hasText: 'COMPLETED' })).toBeVisible();

    // 8. External Invoice: INV-BIZ-<ts> subtotal 181000
    await page.goto('http://localhost:5173/invoices/new');
    const invoiceNumber = 'INV-BIZ-' + ts;
    await page.locator('select').first().selectOption({ label: clientName });
    await page.locator('input[type="text"]').first().fill(invoiceNumber);
    await page.locator('input[type="date"]').nth(1).fill(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    await page.locator('input[type="number"]').nth(0).fill('1810');
    await page.locator('input[type="number"]').nth(1).fill('0');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:5173/invoices');
    const invRow = page.locator('tr', { hasText: invoiceNumber }).first();
    await expect(invRow).toBeVisible();

    // 9. Payment: 1810.00
    await page.goto('http://localhost:5173/payments/new');
    await page.locator('select').first().selectOption({ label: clientName });
    await page.locator('input[type="number"]').first().fill('1810');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1', { hasText: 'Payment Allocation Grid' })).toBeVisible();

    // 10. Allocate 1810 -> Apply -> PAID
    const paymentOptionValue = await page.locator(`select option`, { hasText: clientName }).first().getAttribute('value');
    await page.locator('select').first().selectOption(paymentOptionValue || '');

    // 11. Over-allocate 2000 -> button disabled
    await page.fill('input[placeholder="0.00"]', '2000');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();

    // 12. Allocate 1810 -> enabled -> Apply
    await page.fill('input[placeholder="0.00"]', '1810');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    page.once('dialog', (d) => d.accept());
    await page.click('button[type="submit"]');

    // Verify invoice PAID
    const paidInvRow = page.locator('tr', { hasText: invoiceNumber }).first();
    await expect(paidInvRow.locator('span', { hasText: 'PAID' })).toBeVisible();

    // 13. Documents: upload + delete
    await page.goto('http://localhost:5173/documents');
    await page.click('button:has-text("Upload Document")');
    const docName = 'Biz POD ' + ts;
    await page.fill('input[placeholder="e.g. Purchase Order POD"]', docName);
    await page.locator('select').first().selectOption({ label: clientName });
    await page.setInputFiles('input[type="file"]', {
      name: 'pod.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Biz proof of delivery')
    });
    await page.click('button[type="submit"]');
    const uploadDocRow = page.locator('tr', { hasText: docName }).first();
    await expect(uploadDocRow).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await uploadDocRow.locator('button[title="Delete"]').click();
    await expect(page.locator('tr', { hasText: docName })).toHaveCount(0);

    // 14. Follow-ups: create + delete
    await page.goto('http://localhost:5173/followups');
    await page.click('button:has-text("New Follow-up")');
    await page.locator('select').first().selectOption({ label: clientName });
    await page.fill('input[type="datetime-local"]', '2026-08-25T14:00');
    const bizNote = 'Biz day follow-up note ' + Date.now();
    await page.fill('textarea', bizNote);
    await page.click('button:has-text("Save Follow-up")');
    const followCard = page.locator('div.rounded-xl', { hasText: bizNote }).first();
    await expect(followCard).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await followCard.locator('button:has-text("Delete")').click();
    await expect(page.locator('div', { hasText: bizNote })).toHaveCount(0);
  });
});
