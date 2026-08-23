import { test, expect } from '@playwright/test';

test.describe('Final Staging Verification - All 12 Operations', () => {
  test.use({ baseURL: 'http://localhost:5173' });
  const timestamp = Date.now();
  const clientName = `FINAL-VERIFY-CLIENT-${timestamp}`;
  const productName = `FINAL-VERIFY-PRODUCT-${timestamp}`;
  const sku = `FV-SKU-${timestamp}`;
  
  test('Complete AuditLog and Operations Verification', async ({ page }) => {
    // 0. Login
    await test.step('Login', async () => {
      await page.goto('/login');
      await page.fill('input[type="email"]', 'admin@ginger.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
    });

    // 1. Client Create
    await test.step('1. Client Create', async () => {
      await page.goto('/clients/new');
      await page.fill('input[name="name"]', clientName);
      await page.fill('input[name="taxId"]', `TAX-${timestamp}`);
      // Fill primary contact
      await page.fill('input[name="contacts.0.firstName"]', 'John');
      await page.fill('input[name="contacts.0.lastName"]', 'Doe');
      await page.fill('input[name="contacts.0.email"]', `john-${timestamp}@example.com`);
      // Fill primary address
      await page.fill('input[name="addresses.0.addressLine1"]', '123 Test St');
      await page.fill('input[name="addresses.0.city"]', 'Test City');
      await page.fill('input[name="addresses.0.state"]', 'TS');
      await page.fill('input[name="addresses.0.postalCode"]', '12345');
      await page.fill('input[name="addresses.0.country"]', 'Testland');
      
      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Clients' })).toBeVisible();
      await expect(page.locator(`text=${clientName}`).first()).toBeVisible();
    });

    // 2. Client Edit
    await test.step('2. Client Edit', async () => {
      await page.click(`text=${clientName}`);
      await expect(page.locator('h1', { hasText: clientName })).toBeVisible();
      await page.click('a:has-text("Edit")');
      await expect(page.locator('h1', { hasText: 'Edit Client' })).toBeVisible();
      await page.fill('input[name="taxId"]', `EDITED-TAX-${timestamp}`);
      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: clientName })).toBeVisible();
      await expect(page.locator(`text=EDITED-TAX-${timestamp}`)).toBeVisible();
    });

    // 3. Product Create
    await test.step('3. Product Create', async () => {
      await page.goto('/products/new');
      await page.fill('input[placeholder="Product name"]', productName);
      await page.fill('input[placeholder="e.g. GIN-001"]', sku);
      await page.fill('input[placeholder="0.00"]', '1000.50'); // Price in rupees
      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Products' })).toBeVisible();
      await expect(page.locator(`text=${productName}`).first()).toBeVisible();
    });

    // 4. Product Edit
    await test.step('4. Product Edit', async () => {
      // Find the row for this product and click the edit button (which has title="Edit")
      await page.locator(`tr:has-text("${productName}")`).locator('a[title="Edit"]').click();
      await expect(page.locator('h1', { hasText: 'Edit Product' })).toBeVisible();
      await page.fill('input[type="number"]', '1500.00'); 
      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Products' })).toBeVisible();
      await expect(page.locator('td', { hasText: '1500.00' }).first()).toBeVisible();
    });

    // 5. Order Create
    await test.step('5. Order Create', async () => {
      await page.goto('/orders/new');
      // Wait for clients/products to load
      await page.waitForTimeout(1000); 
      // Select Client
      const clientSelect = page.locator('select').nth(0);
      const clientOptionValue = await clientSelect.locator(`option:has-text("${clientName}")`).getAttribute('value');
      await clientSelect.selectOption(clientOptionValue!);

      // Add item
      await page.click('button:has-text("+ Add Product")');
      const productSelect = page.locator('select').nth(1);
      const productOptionValue = await productSelect.locator(`option:has-text("${productName}")`).getAttribute('value');
      await productSelect.selectOption(productOptionValue!);
      await page.fill('input[type="number"]', '5'); // Qty 5

      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Order Details' })).toBeVisible();
    });

    // 6. Order Status Change
    await test.step('6. Order status change', async () => {
      await page.click('button:has-text("Confirm Order")');
      await expect(page.locator('span', { hasText: 'CONFIRMED' })).toBeVisible();
      await page.click('button:has-text("Mark as Processing")');
      await expect(page.locator('span', { hasText: 'PROCESSING' })).toBeVisible();
    });

    // 7. Dispatch
    await test.step('7. Dispatch', async () => {
      await page.click('button:has-text("Create Dispatch")');
      const dispatchDialog = page.locator('div[role="dialog"]');
      await expect(dispatchDialog).toBeVisible();
      // Select schedule date
      await dispatchDialog.locator('input[type="date"]').fill(new Date().toISOString().split('T')[0]);
      await dispatchDialog.locator('input[placeholder="Courier Name"]').fill('Test Carrier');
      await dispatchDialog.locator('input[type="number"]').first().fill('5');
      await dispatchDialog.locator('button:has-text("Create Dispatch")').click();
      // Order status should update
      await expect(page.locator('span', { hasText: 'FULLY_DISPATCHED' })).toBeVisible();
      
      // Complete Order
      await page.click('button:has-text("Mark as Completed")');
      await expect(page.locator('span', { hasText: 'COMPLETED' })).toBeVisible();
    });

    // 8. External Invoice Create
    await test.step('8. External Invoice Create', async () => {
      await page.goto('/invoices/new');
      await page.waitForTimeout(1000);
      const clientSelect = page.locator('select').nth(0);
      const clientOptionValue = await clientSelect.locator(`option:has-text("${clientName}")`).getAttribute('value');
      await clientSelect.selectOption(clientOptionValue!);

      await page.fill('input[placeholder="e.g. INV-2024-001"]', `INV-${timestamp}`);
      await page.fill('input[placeholder="Invoice Date"]', new Date().toISOString().split('T')[0]);
      await page.fill('input[placeholder="Due Date"]', new Date(Date.now() + 86400000).toISOString().split('T')[0]);

      await page.locator('input[placeholder="0.00"]').nth(0).fill('7500.00'); // Subtotal (5*1500)
      await page.locator('input[placeholder="0.00"]').nth(1).fill('0.00'); // GST
      await page.locator('input[placeholder="0.00"]').nth(2).fill('7500.00'); // Total

      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Invoice Details' })).toBeVisible();
    });

    // 9. Payment Create
    await test.step('9. Payment Create', async () => {
      await page.goto('/payments/new');
      await page.waitForTimeout(1000);
      const clientSelect = page.locator('select').nth(0);
      const clientOptionValue = await clientSelect.locator(`option:has-text("${clientName}")`).getAttribute('value');
      await clientSelect.selectOption(clientOptionValue!);

      await page.fill('input[placeholder="Payment Date"]', new Date().toISOString().split('T')[0]);
      
      const methodSelect = page.locator('select').nth(1);
      await methodSelect.selectOption('BANK_TRANSFER');

      await page.fill('input[placeholder="0.00"]', '7500.00');
      await page.fill('input[placeholder="e.g. NEFT-12345"]', `REF-${timestamp}`);

      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Payments' })).toBeVisible();
    });

    // 10. Payment Allocation
    await test.step('10. Payment Allocation', async () => {
      await page.click(`text=REF-${timestamp}`);
      await expect(page.locator('h1', { hasText: 'Payment Details' })).toBeVisible();
      
      await page.click('a:has-text("Allocate Payment")');
      await expect(page.locator('h1', { hasText: 'Payment Allocation Grid' })).toBeVisible();

      // Find the invoice in the grid and allocate
      await page.fill(`tr:has-text("INV-${timestamp}") input[placeholder="0.00"]`, '7500.00');
      await page.click('button:has-text("Save Allocations")');
      await expect(page.locator('h1', { hasText: 'Payment Details' })).toBeVisible();
      await expect(page.locator('span', { hasText: 'FULLY_ALLOCATED' })).toBeVisible();
    });

    // Navigate to Client to add Document & Follow-up
    await test.step('Navigate to Client', async () => {
      await page.goto('/clients');
      await page.click(`text=${clientName}`);
      await expect(page.locator('h1', { hasText: 'Client Details' })).toBeVisible();
    });

    // 11. Document Create/Upload
    await test.step('11. Document Create/Upload', async () => {
      await page.click('a:has-text("Documents")');
      await expect(page.locator('h1', { hasText: 'Documents' })).toBeVisible();
      
      // Upload a PDF
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF');
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('text=Upload Document'); // this opens file picker
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles({
        name: `test-doc-${timestamp}.pdf`,
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      // The upload happens automatically upon selection
      await expect(page.locator(`text=test-doc-${timestamp}.pdf`)).toBeVisible();
    });

    // Navigate back to Client
    await test.step('Navigate to Client again', async () => {
      await page.goto('/clients');
      await page.click(`text=${clientName}`);
    });

    // 12. Follow-up Create
    await test.step('12. Follow-up Create', async () => {
      await page.click('a:has-text("Follow-ups")');
      await expect(page.locator('h1', { hasText: 'Follow-ups' })).toBeVisible();

      await page.click('button:has-text("Add Follow-up")');
      const dialog = page.locator('div[role="dialog"]');
      await dialog.locator('select').first().selectOption('CALL');
      await dialog.locator('textarea').fill('Test follow-up note');
      await dialog.locator('input[type="date"]').fill(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
      await dialog.locator('button:has-text("Save Follow-up")').click();
      await expect(page.locator('div.rounded-xl', { hasText: 'Test follow-up note' })).toBeVisible();
    });

    // Logout -> Login test
    await test.step('Logout -> Login', async () => {
      await page.click('button:has-text("Sign Out")');
      await expect(page.locator('h1', { hasText: 'Sign in to your account' })).toBeVisible();
      
      // Login again
      await page.fill('input[type="email"]', 'admin@ginger.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await expect(page.locator('h1', { hasText: 'Dashboard' })).toBeVisible();
    });
  });
});
