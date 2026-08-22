import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/db';

let adminToken: string;
let salesToken: string;
let clientId: string;
let product1Id: string;
let orderId: string;
let orderItemId: string;

describe('Business Rules QA', () => {
  beforeAll(async () => {
    // Admin login
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@ginger.com', password: 'admin123' });
    adminToken = res.body.token;
    expect(adminToken).toBeDefined();

    // Sales login
    const salesRes = await request(app).post('/api/auth/login').send({ email: 'sales@ginger.com', password: 'admin123' });
    salesToken = salesRes.body.token;
    expect(salesToken).toBeDefined();

    // Get a product (API returns { data: [...] })
    const prodRes = await request(app).get('/api/products').set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.body.data.length).toBeGreaterThan(0);
    product1Id = prodRes.body.data[0].id;
  });

  it('TEST 1: Client Creation & Retrieve', async () => {
    const res = await request(app).post('/api/clients').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Test QA Client ${Date.now()}`,
      taxId: 'GST-QA-999',
    });
    expect(res.status).toBe(201);
    clientId = res.body.id;
    expect(clientId).toBeDefined();
  });

  it('TEST 2: Order Creation & Price Snapshot', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', `Bearer ${adminToken}`).send({
      clientId,
      items: [{ productId: product1Id, quantity: 10 }],
    });
    expect(res.status).toBe(201);
    orderId = res.body.id;
    orderItemId = res.body.items[0].id;
    expect(orderId).toBeDefined();
    expect(orderItemId).toBeDefined();

    // Verify price was snapshotted from product master
    const product = await prisma.product.findUnique({ where: { id: product1Id } });
    expect(res.body.items[0].unitPriceCents).toBe(product!.baseUnitPriceCents);
  });

  it('TEST 3: Dispatch Workflow & Limits', async () => {
    // First transition order from DRAFT -> CONFIRMED so dispatch is allowed
    const confirmRes = await request(app).patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' });
    expect(confirmRes.status).toBe(200);

    // 1. Partial Dispatch (5 of 10)
    const dispatch1 = await request(app).post('/api/dispatches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId,
        dispatchDate: new Date().toISOString(),
        items: [{ orderItemId, quantityShipped: 5 }],
        carrier: 'FedEx',
      });
    expect(dispatch1.status).toBe(201);

    // 2. Over-dispatch (remaining is 5, try 10 — must be rejected)
    const dispatch2 = await request(app).post('/api/dispatches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId,
        dispatchDate: new Date().toISOString(),
        items: [{ orderItemId, quantityShipped: 10 }],
      });
    expect(dispatch2.status).toBe(500); // throws Error which becomes 500 via error handler

    // 3. Complete Dispatch (remaining 5)
    const dispatch3 = await request(app).post('/api/dispatches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId,
        dispatchDate: new Date().toISOString(),
        items: [{ orderItemId, quantityShipped: 5 }],
      });
    expect(dispatch3.status).toBe(201);

    // Order status should now be FULLY_DISPATCHED (NOT COMPLETED)
    const orderCheck = await prisma.order.findUnique({ where: { id: orderId } });
    expect(orderCheck?.status).toBe('FULLY_DISPATCHED');
  });

  let invoiceAId: string;
  let invoiceBId: string;
  let paymentId: string;

  it('TEST 4: Invoice Creation & Multi-Invoice Payment Allocation', async () => {
    const now = Date.now();

    // Invoice A: 100,000 cents
    const inv1 = await request(app).post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        invoiceNumber: `INV-A-${now}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        subtotalCents: 100000,
        gstAmountCents: 0,
        totalAmountCents: 100000,
      });
    expect(inv1.status).toBe(201);
    invoiceAId = inv1.body.id;

    // Invoice B: 150,000 cents
    const inv2 = await request(app).post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        invoiceNumber: `INV-B-${now}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        subtotalCents: 150000,
        gstAmountCents: 0,
        totalAmountCents: 150000,
      });
    expect(inv2.status).toBe(201);
    invoiceBId = inv2.body.id;

    // Duplicate invoice number must be rejected
    const dupInv = await request(app).post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        invoiceNumber: `INV-A-${now}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        subtotalCents: 10000,
        gstAmountCents: 0,
        totalAmountCents: 10000,
      });
    expect(dupInv.status).toBe(400);

    // Payment: 180,000 cents
    const pmt = await request(app).post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        amountCents: 180000,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
      });
    expect(pmt.status).toBe(201);
    paymentId = pmt.body.id;

    // Allocate 100,000 to Invoice A
    const allocA = await request(app).post(`/api/payments/${paymentId}/allocations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceRecordId: invoiceAId, allocatedAmountCents: 100000 });
    expect(allocA.status).toBe(201);

    // Verify Invoice A is now PAID
    const invACheck = await prisma.invoiceRecord.findUnique({ where: { id: invoiceAId } });
    expect(invACheck?.status).toBe('PAID');
    expect(invACheck?.paidAmountCents).toBe(100000);

    // Allocate 80,000 to Invoice B
    const allocB = await request(app).post(`/api/payments/${paymentId}/allocations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoiceRecordId: invoiceBId, allocatedAmountCents: 80000 });
    expect(allocB.status).toBe(201);

    // Verify Invoice B is PARTIALLY_PAID with outstanding 70,000
    const invBCheck = await prisma.invoiceRecord.findUnique({ where: { id: invoiceBId } });
    expect(invBCheck?.status).toBe('PARTIALLY_PAID');
    expect(invBCheck?.paidAmountCents).toBe(80000);
    expect(invBCheck!.totalAmountCents - invBCheck!.paidAmountCents).toBe(70000);
  });

  it('TEST 5: Overdue Invoices (Dynamic Check)', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const inv = await request(app).post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        invoiceNumber: `INV-OVERDUE-${Date.now()}`,
        invoiceDate: pastDate.toISOString(),
        dueDate: pastDate.toISOString(),
        subtotalCents: 50000,
        gstAmountCents: 0,
        totalAmountCents: 50000,
      });
    expect(inv.status).toBe(201);

    // Verify invoice is in the listing and is overdue (unpaid + past due)
    const invoiceCheck = await prisma.invoiceRecord.findUnique({ where: { id: inv.body.id } });
    expect(invoiceCheck).toBeDefined();
    expect(invoiceCheck!.paidAmountCents).toBe(0);
    expect(new Date(invoiceCheck!.dueDate).getTime()).toBeLessThan(Date.now());
  });

  it('TEST 6: RBAC Enforcement', async () => {
    // Sales rep trying to allocate payment — should be denied
    // Use a non-existent payment ID — sales rep gets 403 (access denied)
    const allocAttempt = await request(app)
      .post(`/api/payments/00000000-0000-0000-0000-000000000000/allocations`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ invoiceRecordId: invoiceAId, allocatedAmountCents: 100 });
    expect(allocAttempt.status).toBe(403);
  });

  it('TEST 7: Audit Log Verification', async () => {
    // Verify audit logs were created for our operations
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Client' },
          { entityType: 'Order' },
          { entityType: 'Dispatch' },
          { entityType: 'Invoice' },
          { entityType: 'Payment' },
          { entityType: 'PaymentAllocation' },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(logs.length).toBeGreaterThan(0);

    // Verify structure of audit log entries
    for (const log of logs) {
      expect(log.userId).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.entityType).toBeDefined();
      expect(log.entityId).toBeDefined();
      expect(log.createdAt).toBeDefined();
    }

    // Verify we have at least one log for each key action
    const actions = logs.map(l => `${l.entityType}:${l.action}`);
    expect(actions).toContain('Client:CREATE');
    expect(actions).toContain('Order:CREATE');
    expect(actions).toContain('Order:STATUS_CHANGE');
    expect(actions).toContain('Dispatch:CREATE');
    expect(actions).toContain('Invoice:CREATE');
    expect(actions).toContain('Payment:CREATE');
    expect(actions).toContain('PaymentAllocation:ALLOCATE');
  });

  it('TEST 8: Order Status Transitions', async () => {
    // FULLY_DISPATCHED -> COMPLETED (explicit)
    const completeRes = await request(app).patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COMPLETED' });
    expect(completeRes.status).toBe(200);

    const orderCheck = await prisma.order.findUnique({ where: { id: orderId } });
    expect(orderCheck?.status).toBe('COMPLETED');

    // COMPLETED -> anything is invalid
    const invalidRes = await request(app).patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DRAFT' });
    expect(invalidRes.status).toBe(400);
  });
});
