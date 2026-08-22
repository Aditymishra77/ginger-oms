import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createUserSchema, updateUserSchema, validate } from './validation';

const router = Router();

router.use(requireAuth);
router.use(requireRole('ADMIN'));

router.get('/', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.post('/', validate(createUserSchema), async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(400).json({ error: 'Email already registered' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashedPassword, role },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        newValues: JSON.stringify({ ...user, password: '[REDACTED]' }),
      },
    });

    return user;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

router.put('/:id', validate(updateUserSchema), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (req.body.email && req.body.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (emailTaken) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        oldValues: JSON.stringify({ name: existing.name, email: existing.email, role: existing.role }),
        newValues: JSON.stringify(user),
      },
    });

    return user;
  });

  res.json(result);
});

router.patch('/:id/password', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }

  if (newPassword.length < 8 || newPassword.length > 100) {
    res.status(400).json({ error: 'New password must be 8-100 characters' });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (req.user!.role !== 'ADMIN' && req.user!.userId !== id) {
    res.status(403).json({ error: 'Can only change your own password' });
    return;
  }

  if (req.user!.role !== 'ADMIN' || req.user!.userId === id) {
    const valid = await bcrypt.compare(currentPassword, targetUser.password);
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: id,
        newValues: JSON.stringify({ password: '[REDACTED]' }),
      },
    });
  });

  res.json({ message: 'Password updated successfully' });
});

router.patch('/:id/archive', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (targetUser.id === req.user!.userId) {
    res.status(400).json({ error: 'Cannot deactivate your own account' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'ARCHIVE',
        entityType: 'User',
        entityId: id,
        oldValues: JSON.stringify({ name: targetUser.name, role: targetUser.role }),
        newValues: JSON.stringify({ archived: true }),
      },
    });
  });

  res.json({ message: 'User deactivation recorded', user: { id: targetUser.id, name: targetUser.name } });
});

export default router;
