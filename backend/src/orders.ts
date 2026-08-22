import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createOrderSchema, validate } from './validation';

const router = Router();

router.use(requireAuth);

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'COMPLETED'],
  PROCESSING: ['PARTIALLY_DISPATCHED', 'FULLY_DISPATCHED', 'COMPLETED', 'CANCELLED'],
  PARTIALLY_DISPATCHED: ['FULLY_DISPATCHED', 'COMPLETED'],
  FULLY_DISPATCHED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TRANSITION_ROLES: Record<string, string[]> = {
  DRAFT_TO_CONFIRMED: ['ADMIN', 'SALES_MANAGER'],
  DRAFT_TO_CANCELLED: ['ADMIN'],
  CONFIRMED_TO_PROCESSING: ['ADMIN', 'SALES_MANAGER', 'LOGISTICS'],
  CONFIRMED_TO_CANCELLED: ['ADMIN'],
  CONFIRMED_TO_COMPLETED: ['ADMIN', 'SALES_MANAGER'],
  PROCESSING_TO_CANCELLED: ['ADMIN'],
  PROCESSING_TO_COMPLETED: ['ADMIN', 'SALES_MANAGER'],
  PROCESSING_TO_PARTIALLY_DISPATCHED: ['ADMIN', 'LOGISTICS'],
  PROCESSING_TO_FULLY_DISPATCHED: ['ADMIN', 'LOGISTICS'],
  PARTIALLY_DISPATCHED_TO_FULLY_DISPATCHED: ['ADMIN', 'LOGISTICS'],
  PARTIALLY_DISPATCHED_TO_COMPLETED: ['ADMIN', 'SALES_MANAGER'],
  FULLY_DISPATCHED_TO_COMPLETED: ['ADMIN', 'SALES_MANAGER'],
};

router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (req.user?.role === 'SALES_REP') {
    where.client = { salesRepId: req.user.userId };
  }

  if (search) {
    where.OR = [
      { client: { name: { contains: search } } },
      { notes: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true } },
        items: { include: { product: true } },
        _count: { select: { dispatches: true, items: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createOrderSchema), async (req: Request, res: Response) => {
  const { clientId, items, notes } = req.body;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.isArchived) {
    res.status(400).json({ error: 'Invalid or archived client' });
    return;
  }

  const productIds = items.map((i: any) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: 'ACTIVE' },
  });

  if (products.length !== productIds.length) {
    res.status(400).json({ error: 'One or more products are invalid or archived' });
    return;
  }

  const productMap = new Map(products.map(p => [p.id, p]));

  const result = await prisma.$transaction(async (tx) => {
    let totalAmountCents = 0;
    const orderItems = items.map((item: any) => {
      const product = productMap.get(item.productId)!;
      const lineTotal = product.baseUnitPriceCents * item.quantity;
      totalAmountCents += lineTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: product.baseUnitPriceCents,
        lineTotalCents: Math.round(lineTotal),
      };
    });

    const order = await tx.order.create({
      data: {
        clientId,
        totalAmountCents,
        notes: notes || null,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, client: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Order',
        entityId: order.id,
        newValues: JSON.stringify(order),
      },
    });

    return order;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, salesRepId: true } },
      items: { include: { product: true } },
      dispatches: { include: { items: true } },
      invoices: { include: { invoiceRecord: true } },
    },
  });

  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && order.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (req.user?.role === 'SALES_MANAGER' && order.client.salesRepId !== undefined && req.user.userId !== order.client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(order);
});

router.put('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { notes } = req.body;

  const existing = await prisma.order.findUnique({ where: { id }, include: { client: true } });
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  
  if (req.user?.role === 'SALES_MANAGER' && existing.client.salesRepId !== undefined && req.user.userId !== existing.client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (existing.status !== 'DRAFT') {
    res.status(400).json({ error: 'Can only update notes on DRAFT orders' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id },
      data: { notes },
      include: { items: { include: { product: true } }, client: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'Order',
        entityId: order.id,
        oldValues: JSON.stringify({ notes: existing.notes }),
        newValues: JSON.stringify({ notes }),
      },
    });

    return order;
  });

  res.json(result);
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status: newStatus } = req.body;

  if (!newStatus || typeof newStatus !== 'string') {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const existing = await prisma.order.findUnique({ where: { id }, include: { client: true } });
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  
  if (req.user?.role === 'SALES_MANAGER' && existing.client.salesRepId !== undefined && req.user.userId !== existing.client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const allowedNext = VALID_TRANSITIONS[existing.status] || [];
  if (!allowedNext.includes(newStatus)) {
    res.status(400).json({
      error: `Invalid transition: ${existing.status} → ${newStatus}. Allowed: ${allowedNext.join(', ') || 'none'}`,
    });
    return;
  }

  const transitionKey = `${existing.status}_TO_${newStatus}`;
  const allowedRoles = TRANSITION_ROLES[transitionKey] || [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(req.user!.role)) {
    res.status(403).json({ error: `Role ${req.user!.role} cannot perform transition ${transitionKey}` });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id },
      data: { status: newStatus },
      include: { items: { include: { product: true } }, client: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'Order',
        entityId: order.id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: newStatus }),
      },
    });

    return order;
  });

  res.json(result);
});

router.patch('/:id/archive', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.order.findUnique({ where: { id }, include: { client: true } });
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  
  if (req.user?.role === 'SALES_MANAGER' && existing.client.salesRepId !== undefined && req.user.userId !== existing.client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const newArchived = !existing.isArchived;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id },
      data: { isArchived: newArchived },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: newArchived ? 'ARCHIVE' : 'UNARCHIVE',
        entityType: 'Order',
        entityId: order.id,
        oldValues: JSON.stringify({ isArchived: existing.isArchived }),
        newValues: JSON.stringify({ isArchived: newArchived }),
      },
    });

    return order;
  });

  res.json(result);
});

export default router;
