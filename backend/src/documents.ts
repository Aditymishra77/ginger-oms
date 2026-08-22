import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from './db';
import { requireAuth, requireRole } from './auth';
import { createDocumentSchema, validate } from './validation';

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const router = Router();

router.use(requireAuth);

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const useS3 = process.env.STORAGE_PROVIDER === 's3';
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'ginger-order-documents';

const storage = useS3 ? multer.memoryStorage() : multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PDF, PNG, JPG, JPEG`));
    }
  },
});

router.get('/', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const search = (req.query.search as string) || '';
  const clientId = (req.query.clientId as string) || '';
  const orderId = (req.query.orderId as string) || '';
  const skip = (page - 1) * pageSize;

  const where: any = { isArchived: false };

  if (clientId) where.clientId = clientId;
  if (orderId) where.orderId = orderId;

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { fileType: { contains: search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        client: { select: { id: true, name: true } },
        order: { select: { id: true, status: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'File is required' });
    return;
  }

  const { name, clientId, orderId } = req.body;

  if (!name || typeof name !== 'string') {
    if (!useS3 && file.path) fs.unlinkSync(file.path);
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      if (!useS3 && file.path) fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Invalid clientId' });
      return;
    }
  }

  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      if (!useS3 && file.path) fs.unlinkSync(file.path);
      res.status(400).json({ error: 'Invalid orderId' });
      return;
    }
  }

  let fileUrl = '';
  if (useS3) {
    const s3Key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    fileUrl = s3Key;
  } else {
    fileUrl = `/uploads/${file.filename}`;
  }

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        name,
        clientId: clientId || null,
        orderId: orderId || null,
        url: fileUrl,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: req.user!.userId,
      },
      include: {
        client: { select: { id: true, name: true } },
        order: { select: { id: true, status: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entityType: 'Document',
        entityId: document.id,
        newValues: JSON.stringify(document),
      },
    });

    return document;
  });

  res.status(201).json(result);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, salesRepId: true } },
      order: { select: { id: true, status: true } },
      user: { select: { id: true, name: true } },
    },
  });

  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (document.clientId) {
    if (req.user?.role === 'SALES_REP' && document.client?.salesRepId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (req.user?.role === 'SALES_MANAGER' && document.client?.salesRepId !== undefined && req.user.userId !== document.client.salesRepId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  res.json(document);
});

router.get('/:id/download', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const document = await prisma.document.findUnique({ 
    where: { id },
    include: { client: true }
  });

  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (document.clientId) {
    if (req.user?.role === 'SALES_REP' && document.client?.salesRepId !== req.user.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (req.user?.role === 'SALES_MANAGER' && document.client?.salesRepId !== undefined && req.user.userId !== document.client.salesRepId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
  }

  const ext = path.extname(document.url).toLowerCase() || '.pdf';
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  res.setHeader('Content-Type', contentTypes[ext] || document.fileType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${document.name}${ext}"`);

  if (useS3) {
    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: document.url,
      }));
      (response.Body as any).pipe(res);
    } catch (err) {
      res.status(404).json({ error: 'File not found on S3' });
    }
  } else {
    const filePath = path.join(uploadsDir, path.basename(document.url));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
});

router.patch('/:id/archive', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const newArchived = !existing.isArchived;

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.document.update({
      where: { id },
      data: { isArchived: newArchived },
    });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: newArchived ? 'ARCHIVE' : 'UNARCHIVE',
        entityType: 'Document',
        entityId: document.id,
        oldValues: JSON.stringify({ isArchived: existing.isArchived }),
        newValues: JSON.stringify({ isArchived: newArchived }),
      },
    });

    return document;
  });

  res.json(result);
});

router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.delete({ where: { id } });

    await tx.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        entityType: 'Document',
        entityId: id,
        oldValues: JSON.stringify(existing),
      },
    });
  });

  if (useS3) {
    try {
      await s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: existing.url,
      }));
    } catch (err) {
      console.error('Failed to delete from S3', err);
    }
  } else {
    const filePath = path.join(uploadsDir, path.basename(existing.url));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  res.json({ message: 'Document permanently deleted' });
});

export default router;
