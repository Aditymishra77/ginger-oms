import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validRoles = ['ADMIN', 'SALES_MANAGER', 'SALES_REP', 'LOGISTICS', 'FINANCE', 'AUDITOR'] as const;

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  taxId: z.string().max(50).optional(),
  salesRepId: z.string().uuid().optional(),
  addresses: z.array(z.object({
    type: z.enum(['BILLING', 'SHIPPING', 'BOTH']),
    addressLine1: z.string().min(1).max(200),
    addressLine2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(100),
    isDefault: z.boolean().optional(),
  })).optional(),
  contacts: z.array(z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    role: z.string().max(50).optional(),
    isPrimary: z.boolean().optional(),
  })).optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const createProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  baseUnitPriceCents: z.number().int().positive(),
});

export const updateProductSchema = createProductSchema.partial();

export const createOrderSchema = z.object({
  clientId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    // Optional client-specific selling rate for this order line.
    // When omitted, the product's baseUnitPriceCents is used.
    unitPriceCents: z.number().int().positive().optional(),
  })).min(1),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(50),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  subtotalCents: z.number().int().nonnegative(),
  gstAmountCents: z.number().int().nonnegative(),
  totalAmountCents: z.number().int().positive(),
  documentUrl: z.string().url().optional().or(z.literal('')),
  orderIds: z.array(z.string().uuid()).optional(),
});

export const createPaymentSchema = z.object({
  clientId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  paymentDate: z.string().or(z.date()),
  paymentMethod: z.string().min(1).max(50),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const createAllocationSchema = z.object({
  invoiceRecordId: z.string().uuid(),
  allocatedAmountCents: z.number().int().positive(),
});

export const createDispatchSchema = z.object({
  orderId: z.string().uuid(),
  dispatchDate: z.string().or(z.date()),
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  podUrl: z.string().url().optional().or(z.literal('')),
  items: z.array(z.object({
    orderItemId: z.string().uuid(),
    quantityShipped: z.number().positive(),
  })).min(1),
});

export const updateDispatchStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']),
  podUrl: z.string().url().optional().or(z.literal('')),
});

export const createFollowUpSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(['CALL', 'EMAIL', 'MEETING']),
  notes: z.string().max(2000).optional(),
  scheduledAt: z.string().or(z.date()),
});

export const updateFollowUpStatusSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']),
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(validRoles),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(validRoles).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const createDocumentSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.body = result.data;
    next();
  };
}
