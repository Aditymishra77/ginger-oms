import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';

let adminToken: string;
let clientId: string;
let product1Id: string;
let product1Price: number;

describe('Financial Constraints Tests', () => {
  beforeAll(async () => {
    const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@ginger.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    const prodRes = await request(app).get('/api/products').set('Authorization', `Bearer ${adminToken}`);
    product1Id = prodRes.body.data[0].id;
    product1Price = prodRes.body.data[0].baseUnitPriceCents;

    const clientRes = await request(app).post('/api/clients').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Fin Client ${Date.now()}`,
    });
    clientId = clientRes.body.id;
  });

  describe('Invoice Constraints', () => {
    it('Rejects invoice if total !== subtotal + gst', async () => {
      const res = await request(app).post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          invoiceNumber: `INV-FIN-${Date.now()}`,
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          subtotalCents: 1000,
          gstAmountCents: 100,
          totalAmountCents: 999, // Should be 1100
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must equal');
    });
  });

  describe('Order Constraints', () => {
    it('Order item totals are calculated correctly from product master price', async () => {
      const res = await request(app).post('/api/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          items: [{ productId: product1Id, quantity: 5 }],
        });
      
      expect(res.status).toBe(201);
      const order = res.body;
      const expectedLineTotal = product1Price * 5;
      expect(order.items[0].unitPriceCents).toBe(product1Price);
      expect(order.items[0].lineTotalCents).toBe(expectedLineTotal);
      expect(order.totalAmountCents).toBe(expectedLineTotal);
    });
  });

  describe('Payment Allocation Constraints', () => {
    it('Rejects allocation exceeding payment balance', async () => {
      const invRes = await request(app).post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          invoiceNumber: `INV-FIN2-${Date.now()}`,
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          subtotalCents: 50000,
          gstAmountCents: 0,
          totalAmountCents: 50000,
        });
      const invoiceId = invRes.body.id;

      const pmtRes = await request(app).post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          amountCents: 10000, // Only 10000
          paymentDate: new Date().toISOString(),
          paymentMethod: 'CASH',
        });
      const paymentId = pmtRes.body.id;

      // Try allocating 20000 from a 10000 payment
      const allocRes = await request(app).post(`/api/payments/${paymentId}/allocations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceRecordId: invoiceId,
          allocatedAmountCents: 20000,
        });
      
      expect(allocRes.status).toBe(500); // Throws Error in transaction
    });

    it('Rejects allocation exceeding invoice balance', async () => {
      const invRes = await request(app).post('/api/invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          invoiceNumber: `INV-FIN3-${Date.now()}`,
          invoiceDate: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          subtotalCents: 10000, // Only 10000
          gstAmountCents: 0,
          totalAmountCents: 10000,
        });
      const invoiceId = invRes.body.id;

      const pmtRes = await request(app).post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientId,
          amountCents: 50000, // Large payment
          paymentDate: new Date().toISOString(),
          paymentMethod: 'CASH',
        });
      const paymentId = pmtRes.body.id;

      // Try allocating 20000 to a 10000 invoice
      const allocRes = await request(app).post(`/api/payments/${paymentId}/allocations`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invoiceRecordId: invoiceId,
          allocatedAmountCents: 20000,
        });
      
      expect(allocRes.status).toBe(500); // Throws Error in transaction
    });
  });
});
