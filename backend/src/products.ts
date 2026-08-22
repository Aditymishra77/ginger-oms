import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createProductSchema, updateProductSchema, validate } from './validation';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (search) {
    where.OR = [
      { sku: { contains: search } },
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  if (status === 'archived') {
    where.status = 'ARCHIVED';
  } else if (status === 'active') {
    where.status = 'ACTIVE';
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: pageSize,
      include: { _count: { select: { orderItems: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createProductSchema), async (req: Request, res: Response) => {
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: req.body });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Product',
        entityId: product.id,
        newValues: JSON.stringify(product),
      },
    });

    return product;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
  });

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json(product);
});

router.put('/:id', validate(updateProductSchema), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: req.body,
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'Product',
        entityId: product.id,
        oldValues: JSON.stringify(existing),
        newValues: JSON.stringify(product),
      },
    });

    return product;
  });

  res.json(result);
});

router.patch('/:id/archive', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const newStatus = existing.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: { status: newStatus },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: newStatus === 'ARCHIVED' ? 'ARCHIVE' : 'UNARCHIVE',
        entityType: 'Product',
        entityId: product.id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: newStatus }),
      },
    });

    return product;
  });

  res.json(result);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'Product',
        entityId: product.id,
        oldValues: JSON.stringify(existing),
        newValues: JSON.stringify({ status: 'ARCHIVED' }),
      },
    });

    return product;
  });

  res.json({ message: 'Product archived', product: result });
});

export default router;
