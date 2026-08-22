import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createPaymentSchema, createAllocationSchema, validate } from './validation';

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
      { referenceNumber: { contains: search } },
      { client: { name: { contains: search } } },
      { notes: { contains: search } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true } },
        allocations: { include: { invoiceRecord: { select: { id: true, invoiceNumber: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createPaymentSchema), async (req: Request, res: Response) => {
  const { clientId } = req.body;

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

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        clientId,
        amountCents: req.body.amountCents,
        paymentDate: new Date(req.body.paymentDate),
        paymentMethod: req.body.paymentMethod,
        referenceNumber: req.body.referenceNumber || null,
        notes: req.body.notes || null,
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Payment',
        entityId: payment.id,
        newValues: JSON.stringify(payment),
      },
    });

    return payment;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, salesRepId: true } },
      allocations: { include: { invoiceRecord: true } },
    },
  });

  if (!payment) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && payment.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  
  if (req.user?.role === 'SALES_MANAGER' && payment.client.salesRepId !== undefined && req.user.userId !== payment.client.salesRepId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(payment);
});

router.post('/:id/allocations', validate(createAllocationSchema), async (req: Request, res: Response) => {
  const paymentId = req.params.id as string;
  const { invoiceRecordId, allocatedAmountCents } = req.body;

  // First find the payment outside the transaction to check RBAC
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { client: { select: { id: true, salesRepId: true } } },
  });
  if (!payment) {
    if (req.user?.role === 'ADMIN') {
      return res.status(404).json({ error: 'Payment not found' });
    }
    return res.status(403).json({ error: 'Access denied' });
  }
  // Check RBAC BEFORE the transaction
  if (req.user?.role === 'SALES_REP' && payment.client.salesRepId !== req.user.userId) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  if (req.user?.role === 'SALES_MANAGER' && payment.client.salesRepId !== undefined && req.user.userId !== payment.client.salesRepId) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const result = await prisma.$transaction(async (tx) => {

    if (!payment) {
      throw new Error('Payment not found');
    }
    if (payment.status === 'VOIDED') {
      throw new Error('Cannot allocate to a voided payment');
    }

    const invoice = await tx.invoiceRecord.findUnique({ where: { id: invoiceRecordId } });
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status === 'VOIDED' || invoice.status === 'PAID') {
      throw new Error('Cannot allocate to a voided or fully paid invoice');
    }

    if (payment.clientId !== invoice.clientId) {
      throw new Error('Payment and invoice must belong to the same client');
    }

    const existingAllocations = await tx.paymentAllocation.findMany({
      where: { paymentId },
    });
    const totalAllocated = existingAllocations.reduce((sum, a) => sum + a.allocatedAmountCents, 0);
    const remainingPayment = payment.amountCents - totalAllocated;

    if (allocatedAmountCents > remainingPayment) {
      throw new Error(`Insufficient payment balance. Remaining: ${remainingPayment} cents`);
    }

    const invoiceAllocations = await tx.paymentAllocation.findMany({
      where: { invoiceRecordId },
    });
    const totalInvoiceAllocated = invoiceAllocations.reduce((sum, a) => sum + a.allocatedAmountCents, 0);
    const remainingInvoice = invoice.totalAmountCents - totalInvoiceAllocated;

    if (allocatedAmountCents > remainingInvoice) {
      throw new Error(`Allocation exceeds invoice balance. Remaining: ${remainingInvoice} cents`);
    }

    const allocation = await tx.paymentAllocation.create({
      data: {
        paymentId,
        invoiceRecordId,
        allocatedAmountCents,
      },
    });

    const newTotalAllocated = totalAllocated + allocatedAmountCents;
    let paymentStatus = payment.status;
    if (newTotalAllocated >= payment.amountCents) {
      paymentStatus = 'FULLY_ALLOCATED';
    } else if (newTotalAllocated > 0) {
      paymentStatus = 'PARTIALLY_ALLOCATED';
    }
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: paymentStatus },
    });

    const newPaidAmount = invoice.paidAmountCents + allocatedAmountCents;
    let invoiceStatus = invoice.status;
    if (newPaidAmount >= invoice.totalAmountCents) {
      invoiceStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      invoiceStatus = 'PARTIALLY_PAID';
    }
    await tx.invoiceRecord.update({
      where: { id: invoiceRecordId },
      data: {
        paidAmountCents: newPaidAmount,
        status: invoiceStatus,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ALLOCATE',
        entityType: 'PaymentAllocation',
        entityId: allocation.id,
        newValues: JSON.stringify({
          paymentId,
          invoiceRecordId,
          allocatedAmountCents,
          paymentStatus,
          invoiceStatus,
        }),
      },
    });

    return allocation;
  });

  res.status(201).json(result);
});

router.patch('/:id/void', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  if (!['ADMIN', 'FINANCE'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Only ADMIN or FINANCE can void payments' });
    return;
  }

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  if (existing.status === 'VOIDED') {
    res.status(400).json({ error: 'Payment is already voided' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const allocations = await tx.paymentAllocation.findMany({
      where: { paymentId: id },
    });

    for (const alloc of allocations) {
      const invoice = await tx.invoiceRecord.findUnique({ where: { id: alloc.invoiceRecordId } });
      if (invoice) {
        const newPaidAmount = Math.max(0, invoice.paidAmountCents - alloc.allocatedAmountCents);
        let invoiceStatus = invoice.status;
        if (newPaidAmount === 0) {
          invoiceStatus = 'UNPAID';
        } else if (newPaidAmount < invoice.totalAmountCents) {
          invoiceStatus = 'PARTIALLY_PAID';
        }
        await tx.invoiceRecord.update({
          where: { id: alloc.invoiceRecordId },
          data: { paidAmountCents: newPaidAmount, status: invoiceStatus },
        });
      }
    }

    await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });

    const payment = await tx.payment.update({
      where: { id },
      data: { status: 'VOIDED' },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'VOID',
        entityType: 'Payment',
        entityId: payment.id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: 'VOIDED' }),
      },
    });

    return payment;
  });

  res.json(result);
});

export default router;
