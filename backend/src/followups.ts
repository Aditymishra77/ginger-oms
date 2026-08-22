import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createFollowUpSchema, updateFollowUpStatusSchema, validate } from './validation';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const type = (req.query.type as string) || '';
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (req.user?.role === 'SALES_REP') {
    where.userId = req.user.userId;
  }

  if (search) {
    where.OR = [
      { notes: { contains: search } },
      { client: { name: { contains: search } } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  const [data, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.followUp.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createFollowUpSchema), async (req: Request, res: Response) => {
  const { clientId, type, notes, scheduledAt } = req.body;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.isArchived) {
    res.status(400).json({ error: 'Invalid or archived client' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.create({
      data: {
        clientId,
        userId: req.user!.userId,
        type,
        notes: notes || '',
        scheduledAt: new Date(scheduledAt),
      },
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'FollowUp',
        entityId: followUp.id,
        newValues: JSON.stringify(followUp),
      },
    });

    return followUp;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const followUp = await prisma.followUp.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
    },
  });

  if (!followUp) {
    res.status(404).json({ error: 'Follow-up not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && followUp.userId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(followUp);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { notes, scheduledAt, type } = req.body;

  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Follow-up not found' });
    return;
  }

  if (existing.status !== 'PENDING') {
    res.status(400).json({ error: 'Can only update PENDING follow-ups' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && existing.userId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.update({
      where: { id },
      data: {
        notes: notes !== undefined ? notes : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        type: type || undefined,
      },
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'FollowUp',
        entityId: followUp.id,
        oldValues: JSON.stringify(existing),
        newValues: JSON.stringify(followUp),
      },
    });

    return followUp;
  });

  res.json(result);
});

router.patch('/:id/status', validate(updateFollowUpStatusSchema), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status: newStatus } = req.body;

  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Follow-up not found' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.update({
      where: { id },
      data: { status: newStatus },
      include: {
        client: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'FollowUp',
        entityId: followUp.id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: newStatus }),
      },
    });

    return followUp;
  });

  res.json(result);
});

router.delete('/:id', requireRole('ADMIN', 'SALES_MANAGER'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Follow-up not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.followUp.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'FollowUp',
        entityId: id,
        oldValues: JSON.stringify(existing),
      },
    });
  });

  res.json({ message: 'Follow-up deleted' });
});

export default router;
