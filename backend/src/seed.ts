import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up existing data
  await prisma.auditLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.document.deleteMany();
  await prisma.dispatchItem.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceOrder.deleteMany();
  await prisma.invoiceRecord.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.contactPerson.deleteMany();
  await prisma.clientAddress.deleteMany();
  await prisma.client.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 12);

  // Create users
  const admin = await prisma.user.create({
    data: { email: 'admin@ginger.com', password: adminPassword, name: 'Admin User', role: 'ADMIN' },
  });

  const salesManager = await prisma.user.create({
    data: { email: 'sales@ginger.com', password: adminPassword, name: 'Sales Manager', role: 'SALES_MANAGER' },
  });

  const salesRep1 = await prisma.user.create({
    data: { email: 'rep1@ginger.com', password: adminPassword, name: 'Alice Johnson', role: 'SALES_REP' },
  });

  const salesRep2 = await prisma.user.create({
    data: { email: 'rep2@ginger.com', password: adminPassword, name: 'Bob Smith', role: 'SALES_REP' },
  });

  const logistics = await prisma.user.create({
    data: { email: 'logistics@ginger.com', password: adminPassword, name: 'Logistics User', role: 'LOGISTICS' },
  });

  const finance = await prisma.user.create({
    data: { email: 'finance@ginger.com', password: adminPassword, name: 'Finance User', role: 'FINANCE' },
  });

  console.log('Users created:');
  console.log('  admin@ginger.com / admin123 (ADMIN)');
  console.log('  sales@ginger.com / admin123 (SALES_MANAGER)');
  console.log('  rep1@ginger.com / admin123 (SALES_REP)');
  console.log('  rep2@ginger.com / admin123 (SALES_REP)');
  console.log('  logistics@ginger.com / admin123 (LOGISTICS)');
  console.log('  finance@ginger.com / admin123 (FINANCE)');

  // Create products
  const product1 = await prisma.product.create({
    data: {
      sku: 'MTR-001',
      name: 'Premium Widget',
      description: 'High-quality premium widget for industrial use',
      baseUnitPriceCents: 1500,
      status: 'ACTIVE',
    },
  });

  const product2 = await prisma.product.create({
    data: {
      sku: 'MTR-002',
      name: 'Standard Gear',
      description: 'Standard gear assembly for general applications',
      baseUnitPriceCents: 2500,
      status: 'ACTIVE',
    },
  });

  const product3 = await prisma.product.create({
    data: {
      sku: 'MTR-003',
      name: 'Specialty Bearing',
      description: 'High-performance specialty bearing',
      baseUnitPriceCents: 5000,
      status: 'ACTIVE',
    },
  });

  console.log('Products created: MTR-001, MTR-002, MTR-003');

  // Create clients
  const client1 = await prisma.client.create({
    data: {
      name: 'ABC Industries',
      taxId: 'TAX-12345',
      salesRepId: salesRep1.id,
      status: 'ACTIVE',
      addresses: {
        create: {
          type: 'BOTH',
          addressLine1: '123 Industrial Blvd',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India',
          isDefault: true,
        },
      },
      contacts: {
        create: {
          firstName: 'Raj',
          lastName: 'Patel',
          email: 'raj@abcindustries.com',
          phone: '+91-9876543210',
          role: 'Procurement Manager',
          isPrimary: true,
        },
      },
    },
    include: { addresses: true, contacts: true },
  });

  const client2 = await prisma.client.create({
    data: {
      name: 'XYZ Manufacturing',
      taxId: 'TAX-67890',
      salesRepId: salesRep2.id,
      status: 'ACTIVE',
      addresses: {
        create: {
          type: 'BILLING',
          addressLine1: '456 Factory Road',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411001',
          country: 'India',
          isDefault: true,
        },
      },
      contacts: {
        create: {
          firstName: 'Priya',
          lastName: 'Sharma',
          email: 'priya@xyzmfg.com',
          phone: '+91-9876543211',
          role: 'Operations Director',
          isPrimary: true,
        },
      },
    },
    include: { addresses: true, contacts: true },
  });

  const client3 = await prisma.client.create({
    data: {
      name: 'Tech Solutions Ltd',
      salesRepId: salesRep1.id,
      status: 'ACTIVE',
      addresses: {
        create: {
          type: 'SHIPPING',
          addressLine1: '789 Tech Park',
          city: 'Bangalore',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'India',
          isDefault: true,
        },
      },
      contacts: {
        create: {
          firstName: 'Vikram',
          lastName: 'Reddy',
          email: 'vikram@techsolutions.com',
          phone: '+91-9876543212',
          role: 'CTO',
          isPrimary: true,
        },
      },
    },
  });

  console.log('Clients created: ABC Industries, XYZ Manufacturing, Tech Solutions Ltd');

  // Create orders in various states
  // Order 1: COMPLETED
  const order1 = await prisma.order.create({
    data: {
      clientId: client1.id,
      status: 'COMPLETED',
      totalAmountCents: 15000,
      notes: 'Completed order for ABC Industries',
      items: {
        create: [
          { productId: product1.id, quantity: 10, unitPriceCents: 1500, lineTotalCents: 15000 },
        ],
      },
    },
    include: { items: true },
  });

  // Order 2: FULLY_DISPATCHED
  const order2 = await prisma.order.create({
    data: {
      clientId: client1.id,
      status: 'FULLY_DISPATCHED',
      totalAmountCents: 25000,
      notes: 'Gear order for ABC Industries',
      items: {
        create: [
          { productId: product2.id, quantity: 10, unitPriceCents: 2500, lineTotalCents: 25000 },
        ],
      },
    },
    include: { items: true },
  });

  // Order 3: PROCESSING
  const order3 = await prisma.order.create({
    data: {
      clientId: client2.id,
      status: 'PROCESSING',
      totalAmountCents: 50000,
      notes: 'Large order for XYZ Manufacturing',
      items: {
        create: [
          { productId: product1.id, quantity: 10, unitPriceCents: 1500, lineTotalCents: 15000 },
          { productId: product2.id, quantity: 14, unitPriceCents: 2500, lineTotalCents: 35000 },
        ],
      },
    },
    include: { items: true },
  });

  // Order 4: CONFIRMED
  const order4 = await prisma.order.create({
    data: {
      clientId: client2.id,
      status: 'CONFIRMED',
      totalAmountCents: 10000,
      notes: 'Confirmed order for XYZ',
      items: {
        create: [
          { productId: product3.id, quantity: 2, unitPriceCents: 5000, lineTotalCents: 10000 },
        ],
      },
    },
    include: { items: true },
  });

  // Order 5: DRAFT
  const order5 = await prisma.order.create({
    data: {
      clientId: client3.id,
      status: 'DRAFT',
      totalAmountCents: 7500,
      notes: 'Draft order for Tech Solutions',
      items: {
        create: [
          { productId: product1.id, quantity: 5, unitPriceCents: 1500, lineTotalCents: 7500 },
        ],
      },
    },
    include: { items: true },
  });

  // Order 6: CANCELLED
  await prisma.order.create({
    data: {
      clientId: client3.id,
      status: 'CANCELLED',
      totalAmountCents: 5000,
      notes: 'Cancelled order',
      items: {
        create: [
          { productId: product2.id, quantity: 2, unitPriceCents: 2500, lineTotalCents: 5000 },
        ],
      },
    },
  });

  console.log('Orders created: 6 orders in various states');

  // Create dispatches
  await prisma.dispatch.create({
    data: {
      orderId: order1.id,
      status: 'DELIVERED',
      dispatchDate: new Date('2026-07-01'),
      carrier: 'BlueDart Express',
      trackingNumber: 'BD-2026-001',
      podUrl: '',
      items: {
        create: order1.items.map(item => ({
          orderItemId: item.id,
          quantityShipped: item.quantity,
        })),
      },
    },
  });

  await prisma.dispatch.create({
    data: {
      orderId: order2.id,
      status: 'DELIVERED',
      dispatchDate: new Date('2026-07-15'),
      carrier: 'DTDC Courier',
      trackingNumber: 'DTDC-2026-002',
      items: {
        create: order2.items.map(item => ({
          orderItemId: item.id,
          quantityShipped: item.quantity,
        })),
      },
    },
  });

  await prisma.dispatch.create({
    data: {
      orderId: order3.id,
      status: 'IN_TRANSIT',
      dispatchDate: new Date('2026-08-10'),
      carrier: 'FedEx',
      trackingNumber: 'FE-2026-003',
      items: {
        create: [
          { orderItemId: order3.items[0].id, quantityShipped: 10 },
        ],
      },
    },
  });

  await prisma.dispatch.create({
    data: {
      orderId: order3.id,
      status: 'SCHEDULED',
      dispatchDate: new Date('2026-08-25'),
      carrier: 'FedEx',
      trackingNumber: 'FE-2026-004',
      items: {
        create: [
          { orderItemId: order3.items[1].id, quantityShipped: 14 },
        ],
      },
    },
  });

  console.log('Dispatches created: 4 dispatches');

  // Create invoices
  const invoice1 = await prisma.invoiceRecord.create({
    data: {
      clientId: client1.id,
      invoiceNumber: 'INV-2026-001',
      invoiceDate: new Date('2026-07-01'),
      dueDate: new Date('2026-07-31'),
      subtotalCents: 15000,
      gstAmountCents: 2700,
      totalAmountCents: 17700,
      paidAmountCents: 17700,
      status: 'PAID',
      orders: { create: [{ orderId: order1.id }] },
    },
  });

  const invoice2 = await prisma.invoiceRecord.create({
    data: {
      clientId: client1.id,
      invoiceNumber: 'INV-2026-002',
      invoiceDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-31'),
      subtotalCents: 25000,
      gstAmountCents: 4500,
      totalAmountCents: 29500,
      paidAmountCents: 15000,
      status: 'PARTIALLY_PAID',
      orders: { create: [{ orderId: order2.id }] },
    },
  });

  const invoice3 = await prisma.invoiceRecord.create({
    data: {
      clientId: client2.id,
      invoiceNumber: 'INV-2026-003',
      invoiceDate: new Date('2026-08-10'),
      dueDate: new Date('2026-09-10'),
      subtotalCents: 50000,
      gstAmountCents: 9000,
      totalAmountCents: 59000,
      paidAmountCents: 0,
      status: 'UNPAID',
      orders: { create: [{ orderId: order3.id }] },
    },
  });

  const invoice4 = await prisma.invoiceRecord.create({
    data: {
      clientId: client2.id,
      invoiceNumber: 'INV-2026-004',
      invoiceDate: new Date('2026-08-15'),
      dueDate: new Date('2026-08-20'),
      subtotalCents: 10000,
      gstAmountCents: 1800,
      totalAmountCents: 11800,
      paidAmountCents: 0,
      status: 'UNPAID',
      orders: { create: [{ orderId: order4.id }] },
    },
  });

  console.log('Invoices created: INV-2026-001 through INV-2026-004');

  // Create payments
  const payment1 = await prisma.payment.create({
    data: {
      clientId: client1.id,
      amountCents: 17700,
      paymentDate: new Date('2026-07-28'),
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'NEFT-2026-001',
      status: 'FULLY_ALLOCATED',
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: payment1.id,
      invoiceRecordId: invoice1.id,
      allocatedAmountCents: 17700,
    },
  });

  const payment2 = await prisma.payment.create({
    data: {
      clientId: client1.id,
      amountCents: 15000,
      paymentDate: new Date('2026-08-15'),
      paymentMethod: 'CHEQUE',
      referenceNumber: 'CHQ-2026-002',
      status: 'PARTIALLY_ALLOCATED',
    },
  });

  await prisma.paymentAllocation.create({
    data: {
      paymentId: payment2.id,
      invoiceRecordId: invoice2.id,
      allocatedAmountCents: 15000,
    },
  });

  console.log('Payments created: 2 payments with allocations');

  // Create follow-ups
  await prisma.followUp.create({
    data: {
      clientId: client1.id,
      userId: salesRep1.id,
      type: 'CALL',
      notes: 'Follow up on new order requirements',
      scheduledAt: new Date('2026-08-25'),
      status: 'PENDING',
    },
  });

  await prisma.followUp.create({
    data: {
      clientId: client2.id,
      userId: salesRep2.id,
      type: 'MEETING',
      notes: 'Quarterly review meeting',
      scheduledAt: new Date('2026-09-01'),
      status: 'PENDING',
    },
  });

  await prisma.followUp.create({
    data: {
      clientId: client3.id,
      userId: salesRep1.id,
      type: 'EMAIL',
      notes: 'Sent product catalog and pricing',
      scheduledAt: new Date('2026-08-10'),
      status: 'COMPLETED',
    },
  });

  console.log('Follow-ups created: 3 follow-ups');

  console.log('\n=== Seeding complete ===');
  console.log('Test credentials:');
  console.log('  admin@ginger.com / admin123');
  console.log('  sales@ginger.com / admin123');
  console.log('  rep1@ginger.com / admin123');
  console.log('  rep2@ginger.com / admin123');
  console.log('  logistics@ginger.com / admin123');
  console.log('  finance@ginger.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
