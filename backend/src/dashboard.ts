import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth } from './auth';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req: Request, res: Response) => {
  const [
    totalClients,
    activeClients,
    totalOrders,
    totalProducts,
    activeProducts,
    totalRevenue,
    pendingInvoices,
    overdueInvoices,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { isArchived: false } }),
    prisma.order.count(),
    prisma.product.count(),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.order.aggregate({ _sum: { totalAmountCents: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.invoiceRecord.count({ where: { status: 'UNPAID' } }),
    prisma.invoiceRecord.count({
      where: {
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  });

  const recentPayments = await prisma.payment.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  });

  const upcomingFollowUps = await prisma.followUp.findMany({
    where: { status: 'PENDING', scheduledAt: { gte: new Date() } },
    take: 5,
    orderBy: { scheduledAt: 'asc' },
    include: { client: { select: { id: true, name: true } } },
  });

  res.json({
    totalClients,
    activeClients,
    totalOrders,
    totalProducts,
    activeProducts,
    totalRevenueCents: totalRevenue._sum.totalAmountCents || 0,
    pendingInvoices,
    overdueInvoices,
    recentOrders,
    recentPayments,
    upcomingFollowUps,
  });
});

export default router;
