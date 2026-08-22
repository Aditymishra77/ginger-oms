import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createInvoiceSchema, validate } from './validation';

const router = Router();

router.use(requireAuth);

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
      { invoiceNumber: { contains: search } },
      { client: { name: { contains: search } } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.invoiceRecord.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true } },
        orders: { include: { order: { select: { id: true, status: true } } } },
        allocations: true,
        _count: { select: { allocations: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoiceRecord.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createInvoiceSchema), async (req: Request, res: Response) => {
  const {
    clientId, invoiceNumber, invoiceDate, dueDate,
    subtotalCents, gstAmountCents, totalAmountCents,
    documentUrl, orderIds,
  } = req.body;

  if (subtotalCents + gstAmountCents !== totalAmountCents) {
    res.status(400).json({ error: 'subtotalCents + gstAmountCents must equal totalAmountCents' });
    return;
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.isArchived) {
    res.status(400).json({ error: 'Invalid or archived client' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  
  if (req.user?.role === 'SALES_MANAGER' && client.salesRepId !== undefined && req.user.userId !== client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (orderIds && orderIds.length > 0) {
    const orders = await prisma.order.findMany({ where: { id: { in: orderIds } } });
    if (orders.length !== orderIds.length) {
      res.status(400).json({ error: 'One or more order IDs are invalid' });
      return;
    }
  }

  const existingInvoice = await prisma.invoiceRecord.findUnique({ where: { invoiceNumber } });
  if (existingInvoice) {
    res.status(400).json({ error: 'Invoice number already exists' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoiceRecord.create({
      data: {
        clientId,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        subtotalCents,
        gstAmountCents,
        totalAmountCents,
        documentUrl: documentUrl || null,
        orders: orderIds ? {
          create: orderIds.map((orderId: string) => ({ orderId })),
        } : undefined,
      },
      include: {
        client: { select: { id: true, name: true } },
        orders: { include: { order: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Invoice',
        entityId: invoice.id,
        newValues: JSON.stringify(invoice),
      },
    });

    return invoice;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const invoice = await prisma.invoiceRecord.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, salesRepId: true } },
      orders: { include: { order: { include: { items: { include: { product: true } } } } } },
      allocations: { include: { payment: true } },
    },
  });

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && invoice.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  
  if (req.user?.role === 'SALES_MANAGER' && invoice.client.salesRepId !== undefined && req.user.userId !== invoice.client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(invoice);
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status: newStatus } = req.body;

  if (!['ADMIN', 'FINANCE'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Only ADMIN or FINANCE can manually change invoice status' });
    return;
  }

  if (!newStatus || typeof newStatus !== 'string') {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const validInvoiceStatuses = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOIDED'];
  if (!validInvoiceStatuses.includes(newStatus)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validInvoiceStatuses.join(', ')}` });
    return;
  }

  const existing = await prisma.invoiceRecord.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  const validTransitions: Record<string, string[]> = {
    UNPAID: ['PARTIALLY_PAID', 'PAID', 'VOIDED'],
    PARTIALLY_PAID: ['PAID', 'VOIDED'],
    PAID: [],
    VOIDED: [],
  };

  const allowed = validTransitions[existing.status] || [];
  if (!allowed.includes(newStatus)) {
    res.status(400).json({
      error: `Invalid transition: ${existing.status} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoiceRecord.update({
      where: { id },
      data: { status: newStatus },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'Invoice',
        entityId: invoice.id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: newStatus }),
      },
    });

    return invoice;
  });

  res.json(result);
});

export default router;
