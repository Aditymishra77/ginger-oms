import { Router, Request, Response } from 'express';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createDispatchSchema, updateDispatchStatusSchema, validate } from './validation';

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
    where.order = { client: { salesRepId: req.user.userId } };
  }

  if (search) {
    where.OR = [
      { trackingNumber: { contains: search } },
      { carrier: { contains: search } },
      { order: { client: { name: { contains: search } } } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.dispatch.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            status: true,
            clientId: true,
            client: { select: { id: true, name: true } },
          },
        },
        items: { include: { orderItem: { include: { product: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dispatch.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', validate(createDispatchSchema), async (req: Request, res: Response) => {
  const { orderId, dispatchDate, carrier, trackingNumber, podUrl, items } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new Error('Order not found');
    }

    if (!['CONFIRMED', 'PROCESSING', 'PARTIALLY_DISPATCHED'].includes(order.status)) {
      throw new Error(`Cannot dispatch order in ${order.status} status`);
    }

    for (const item of items) {
      const orderItem = order.items.find(oi => oi.id === item.orderItemId);
      if (!orderItem) {
        throw new Error(`Order item ${item.orderItemId} not found in order`);
      }

      const existingDispatchItems = await tx.dispatchItem.findMany({
        where: { orderItemId: item.orderItemId },
      });
      const totalDispatched = existingDispatchItems.reduce((sum, di) => sum + di.quantityShipped, 0);
      const remaining = orderItem.quantity - totalDispatched;

      if (item.quantityShipped > remaining) {
        throw new Error(
          `Cannot ship ${item.quantityShipped} of order item ${item.orderItemId}. Only ${remaining} remaining`
        );
      }
    }

    const dispatch = await tx.dispatch.create({
      data: {
        orderId,
        dispatchDate: new Date(dispatchDate),
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
        podUrl: podUrl || null,
        items: {
          create: items.map((item: any) => ({
            orderItemId: item.orderItemId,
            quantityShipped: item.quantityShipped,
          })),
        },
      },
      include: {
        items: { include: { orderItem: { include: { product: true } } } },
        order: { select: { id: true, status: true } },
      },
    });

    const allOrderItems = order.items;
    let allFullyDispatched = true;
    let anyDispatched = false;

    for (const oi of allOrderItems) {
      const dispatchItems = await tx.dispatchItem.findMany({
        where: { orderItemId: oi.id },
      });
      const totalShipped = dispatchItems.reduce((sum, di) => sum + di.quantityShipped, 0);

      if (totalShipped > 0) anyDispatched = true;
      if (totalShipped < oi.quantity) allFullyDispatched = false;
    }

    let newOrderStatus = order.status;
    if (allFullyDispatched) {
      newOrderStatus = 'FULLY_DISPATCHED';
    } else if (anyDispatched) {
      newOrderStatus = 'PARTIALLY_DISPATCHED';
    }

    if (newOrderStatus !== order.status) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: newOrderStatus },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Dispatch',
        entityId: dispatch.id,
        newValues: JSON.stringify(dispatch),
      },
    });

    return dispatch;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          client: { select: { id: true, name: true, salesRepId: true } },
          items: { include: { product: true } },
        },
      },
      items: { include: { orderItem: { include: { product: true } } } },
    },
  });

  if (!dispatch) {
    res.status(404).json({ error: 'Dispatch not found' });
    return;
  }

  if (req.user?.role === 'SALES_REP' && dispatch.order.client.salesRepId !== req.user.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json(dispatch);
});

router.patch('/:id/status', validate(updateDispatchStatusSchema), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status: newStatus, podUrl } = req.body;

  const existing = await prisma.dispatch.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Dispatch not found' });
    return;
  }

  const validTransitions: Record<string, string[]> = {
    SCHEDULED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  };

  const allowed = validTransitions[existing.status] || [];
  if (!allowed.includes(newStatus)) {
    res.status(400).json({
      error: `Invalid transition: ${existing.status} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateData: any = { status: newStatus };
    if (podUrl) updateData.podUrl = podUrl;

    const dispatch = await tx.dispatch.update({
      where: { id },
      data: updateData,
      include: {
        items: { include: { orderItem: { include: { product: true } } } },
        order: { select: { id: true, status: true } },
      },
    });

    if (newStatus === 'CANCELLED') {
      const order = await tx.order.findUnique({
        where: { id: existing.orderId },
        include: { items: true },
      });
      if (order) {
        let allFullyDispatched = true;
        let anyDispatched = false;

        for (const oi of order.items) {
          const dispatchItems = await tx.dispatchItem.findMany({
            where: { orderItemId: oi.id },
          });
          const totalShipped = dispatchItems.reduce((sum, di) => sum + di.quantityShipped, 0);

          if (totalShipped > 0) anyDispatched = true;
          if (totalShipped < oi.quantity) allFullyDispatched = false;
        }

        let newOrderStatus = order.status;
        if (allFullyDispatched) {
          newOrderStatus = 'FULLY_DISPATCHED';
        } else if (anyDispatched) {
          newOrderStatus = 'PARTIALLY_DISPATCHED';
        } else {
          newOrderStatus = 'PROCESSING';
        }

        if (newOrderStatus !== order.status) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: newOrderStatus },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'STATUS_CHANGE',
        entityType: 'Dispatch',
        entityId: dispatch.id,
        oldValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: newStatus }),
      },
    });

    return dispatch;
  });

  res.json(result);
});

export default router;
