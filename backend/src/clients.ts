import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createClientSchema, updateClientSchema, validate } from './validation';

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
    where.salesRepId = req.user.userId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { taxId: { contains: search } },
      { contacts: { some: { firstName: { contains: search } } } },
      { contacts: { some: { lastName: { contains: search } } } },
    ];
  }

  if (status === 'archived') {
    where.isArchived = true;
  } else if (status === 'active') {
    where.isArchived = false;
  }

  const [data, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        addresses: true,
        contacts: true,
        _count: { select: { orders: true, invoices: true, payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createClientSchema), async (req: Request, res: Response) => {
  const { addresses, contacts, salesRepId, ...clientData } = req.body;

  if (salesRepId) {
    const rep = await prisma.user.findUnique({ where: { id: salesRepId } });
    if (!rep) {
      res.status(400).json({ error: 'Invalid salesRepId: user not found' });
      return;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        ...clientData,
        salesRepId: salesRepId || null,
        addresses: addresses ? {
          create: addresses.map((a: any) => ({
            type: a.type,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            isDefault: a.isDefault || false,
          })),
        } : undefined,
        contacts: contacts ? {
          create: contacts.map((c: any) => ({
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email || null,
            phone: c.phone || null,
            role: c.role || null,
            isPrimary: c.isPrimary || false,
          })),
        } : undefined,
      },
      include: { addresses: true, contacts: true },
    });

    await tx.auditLog.create({
      data: {
        userId: (console.log('USER:', req.user), req.user!.userId),
        action: 'CREATE',
        entityType: 'Client',
        entityId: client.id,
        newValues: JSON.stringify(client),
      },
    });

    return client;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      addresses: true,
      contacts: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      documents: { where: { isArchived: false }, orderBy: { createdAt: 'desc' }, take: 10 },
      followUps: { orderBy: { scheduledAt: 'desc' }, take: 10 },
    },
  });

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
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

  res.json(client);
});

router.put('/:id', validate(updateClientSchema), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { addresses, contacts, salesRepId, ...clientData } = req.body;

  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (salesRepId) {
    const rep = await prisma.user.findUnique({ where: { id: salesRepId } });
    if (!rep) {
      res.status(400).json({ error: 'Invalid salesRepId: user not found' });
      return;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (addresses) {
      await tx.clientAddress.deleteMany({ where: { clientId: id } });
    }
    if (contacts) {
      await tx.contactPerson.deleteMany({ where: { clientId: id } });
    }

    const client = await tx.client.update({
      where: { id },
      data: {
        ...clientData,
        salesRepId: salesRepId !== undefined ? (salesRepId || null) : undefined,
        addresses: addresses ? {
          create: addresses.map((a: any) => ({
            type: a.type,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country,
            isDefault: a.isDefault || false,
          })),
        } : undefined,
        contacts: contacts ? {
          create: contacts.map((c: any) => ({
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email || null,
            phone: c.phone || null,
            role: c.role || null,
            isPrimary: c.isPrimary || false,
          })),
        } : undefined,
      },
      include: { addresses: true, contacts: true },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'Client',
        entityId: client.id,
        oldValues: JSON.stringify(existing),
        newValues: JSON.stringify(client),
      },
    });

    return client;
  });

  res.json(result);
});

router.patch('/:id/archive', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const newArchived = !existing.isArchived;

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id },
      data: {
        isArchived: newArchived,
        status: newArchived ? 'ARCHIVED' : 'ACTIVE',
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: newArchived ? 'ARCHIVE' : 'UNARCHIVE',
        entityType: 'Client',
        entityId: client.id,
        oldValues: JSON.stringify({ isArchived: existing.isArchived, status: existing.status }),
        newValues: JSON.stringify({ isArchived: client.isArchived, status: client.status }),
      },
    });

    return client;
  });

  res.json(result);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id },
      data: { isArchived: true, status: 'ARCHIVED' },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'Client',
        entityId: client.id,
        oldValues: JSON.stringify(existing),
        newValues: JSON.stringify({ isArchived: true, status: 'ARCHIVED' }),
      },
    });

    return client;
  });

  res.json({ message: 'Client archived', client: result });
});

export default router;
