import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth } from './auth';

const router = Router();

router.use(requireAuth);

router.get('/pending-orders', async (_req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { status: { in: ['DRAFT', 'CONFIRMED', 'PROCESSING'] } },
    include: {
      client: { select: { id: true, name: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(orders);
});

router.get('/dispatch-status', async (_req: Request, res: Response) => {
  const statuses = ['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

  const detailed = await Promise.all(
    statuses.map(async (status) => {
      const count = await prisma.dispatch.count({ where: { status } });
      const items = await prisma.dispatchItem.findMany({
        where: { dispatch: { status } },
      });
      const totalQuantity = items.reduce((sum, i) => sum + i.quantityShipped, 0);
      return {
        status,
        count,
        totalQuantityShipped: totalQuantity,
      };
    })
  );

  res.json(detailed);
});

router.get('/monthly-sales', async (_req: Request, res: Response) => {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: twelveMonthsAgo },
      status: { not: 'CANCELLED' },
    },
    select: { totalAmountCents: true, createdAt: true },
  });

  const monthlyData: Record<string, { month: string; totalCents: number; orderCount: number }> = {};

  // Initialize last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { month: key, totalCents: 0, orderCount: 0 };
  }

  for (const order of orders) {
    const d = new Date(order.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) {
      monthlyData[key].totalCents += order.totalAmountCents;
      monthlyData[key].orderCount++;
    }
  }

  res.json(Object.values(monthlyData));
});

router.get('/top-clients', async (_req: Request, res: Response) => {
  const topClients = await prisma.client.findMany({
    where: { isArchived: false },
    include: {
      orders: {
        where: { status: { not: 'CANCELLED' } },
        select: { totalAmountCents: true },
      },
    },
  });

  const clientsWithTotal = topClients
    .map((client) => ({
      id: client.id,
      name: client.name,
      totalOrderValueCents: client.orders.reduce((sum, o) => sum + o.totalAmountCents, 0),
      orderCount: client.orders.length,
    }))
    .sort((a, b) => b.totalOrderValueCents - a.totalOrderValueCents)
    .slice(0, 10);

  res.json(clientsWithTotal);
});

router.get('/client-ledger', async (req: Request, res: Response) => {
  const clientId = req.query.clientId as string;

  if (!clientId) {
    res.status(400).json({ error: 'clientId query parameter is required' });
    return;
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const [orders, invoices, payments] = await Promise.all([
    prisma.order.findMany({
      where: { clientId },
      select: { id: true, status: true, totalAmountCents: true, createdAt: true, notes: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoiceRecord.findMany({
      where: { clientId },
      select: {
        id: true, invoiceNumber: true, status: true,
        totalAmountCents: true, paidAmountCents: true, invoiceDate: true, dueDate: true,
      },
      orderBy: { invoiceDate: 'desc' },
    }),
    prisma.payment.findMany({
      where: { clientId },
      select: {
        id: true, status: true, amountCents: true,
        paymentDate: true, paymentMethod: true, referenceNumber: true,
      },
      orderBy: { paymentDate: 'desc' },
    }),
  ]);

  // Build ledger entries
  const ledger: any[] = [];

  for (const order of orders) {
    ledger.push({
      type: 'ORDER',
      date: order.createdAt,
      reference: order.id,
      status: order.status,
      debit: order.totalAmountCents,
      credit: 0,
      balance: 0,
      details: order.notes || '',
    });
  }

  for (const invoice of invoices) {
    ledger.push({
      type: 'INVOICE',
      date: invoice.invoiceDate,
      reference: invoice.invoiceNumber,
      status: invoice.status,
      debit: invoice.totalAmountCents,
      credit: invoice.paidAmountCents,
      balance: invoice.totalAmountCents - invoice.paidAmountCents,
      details: `Due: ${invoice.dueDate}`,
    });
  }

  for (const payment of payments) {
    ledger.push({
      type: 'PAYMENT',
      date: payment.paymentDate,
      reference: payment.referenceNumber || payment.id,
      status: payment.status,
      debit: 0,
      credit: payment.amountCents,
      balance: 0,
      details: payment.paymentMethod,
    });
  }

  // Sort by date descending
  ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate running balance (from oldest to newest)
  const sortedAsc = [...ledger].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningBalance = 0;
  for (const entry of sortedAsc) {
    runningBalance += entry.debit - entry.credit;
    entry.balance = runningBalance;
  }

  res.json({
    client: { id: client.id, name: client.name },
    ledger: ledger.reverse(),
    summary: {
      totalDebits: ledger.reduce((sum, e) => sum + e.debit, 0),
      totalCredits: ledger.reduce((sum, e) => sum + e.credit, 0),
      currentBalance: runningBalance,
    },
  });
});

export default router;
