import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/db';

let adminToken: string;
let rep1Token: string;
let rep2Token: string;
let rep1Id: string;
let rep2Id: string;
let client1Id: string;
let order1Id: string;
let product1Id: string;

describe('Security / IDOR Tests', () => {
  beforeAll(async () => {
    const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@ginger.com', password: 'admin123' });
    adminToken = adminRes.body.token;

    const rep1Res = await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Rep 1', email: `rep1-${Date.now()}@ginger.com`, password: 'admin123', role: 'SALES_REP' });
    rep1Id = rep1Res.body.id;
    
    const rep2Res = await request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Rep 2', email: `rep2-${Date.now()}@ginger.com`, password: 'admin123', role: 'SALES_REP' });
    rep2Id = rep2Res.body.id;

    const rep1Login = await request(app).post('/api/auth/login').send({ email: rep1Res.body.email, password: 'admin123' });
    rep1Token = rep1Login.body.token;

    const rep2Login = await request(app).post('/api/auth/login').send({ email: rep2Res.body.email, password: 'admin123' });
    rep2Token = rep2Login.body.token;

    const prodRes = await request(app).get('/api/products').set('Authorization', `Bearer ${adminToken}`);
    product1Id = prodRes.body.data[0].id;

    // Admin creates a client assigned to rep1
    const clientRes = await request(app).post('/api/clients').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Rep1 Client ${Date.now()}`,
      salesRepId: rep1Id,
    });
    client1Id = clientRes.body.id;

    // Admin creates an order for client1
    const orderRes = await request(app).post('/api/orders').set('Authorization', `Bearer ${adminToken}`).send({
      clientId: client1Id,
      items: [{ productId: product1Id, quantity: 10 }],
    });
    order1Id = orderRes.body.id;
  });

  describe('Client IDOR', () => {
    it('Rep1 can access own client', async () => {
      const res = await request(app).get(`/api/clients/${client1Id}`).set('Authorization', `Bearer ${rep1Token}`);
      expect(res.status).toBe(200);
    });

    it('Rep2 cannot access Rep1 client (GET)', async () => {
      const res = await request(app).get(`/api/clients/${client1Id}`).set('Authorization', `Bearer ${rep2Token}`);
      expect(res.status).toBe(403);
    });

    it('Rep2 cannot update Rep1 client (PUT)', async () => {
      const res = await request(app).put(`/api/clients/${client1Id}`).set('Authorization', `Bearer ${rep2Token}`).send({ name: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('Rep2 cannot archive Rep1 client (PATCH)', async () => {
      const res = await request(app).patch(`/api/clients/${client1Id}/archive`).set('Authorization', `Bearer ${rep2Token}`);
      expect(res.status).toBe(403);
    });

    it('Rep2 cannot delete Rep1 client (DELETE)', async () => {
      const res = await request(app).delete(`/api/clients/${client1Id}`).set('Authorization', `Bearer ${rep2Token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Order IDOR', () => {
    it('Rep1 can access own order', async () => {
      const res = await request(app).get(`/api/orders/${order1Id}`).set('Authorization', `Bearer ${rep1Token}`);
      expect(res.status).toBe(200);
    });

    it('Rep2 cannot access Rep1 order (GET)', async () => {
      const res = await request(app).get(`/api/orders/${order1Id}`).set('Authorization', `Bearer ${rep2Token}`);
      expect(res.status).toBe(403);
    });

    it('Rep2 cannot update Rep1 order notes (PUT)', async () => {
      const res = await request(app).put(`/api/orders/${order1Id}`).set('Authorization', `Bearer ${rep2Token}`).send({ notes: 'Hacked notes' });
      expect(res.status).toBe(403);
    });

    it('Rep2 cannot archive Rep1 order (PATCH)', async () => {
      const res = await request(app).patch(`/api/orders/${order1Id}/archive`).set('Authorization', `Bearer ${rep2Token}`);
      expect(res.status).toBe(403);
    });
  });
});
