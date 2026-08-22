import prisma from '../src/db';
import * as bcrypt from 'bcryptjs';

/**
 * Group-based seeder.
 *
 * Usage:
 *   npx tsx prisma/seed.ts                             # seed ALL groups (wipes DB first)
 *   npx tsx prisma/seed.ts --groups=core               # seed only core users
 *   npx tsx prisma/seed.ts --groups=products,clients   # seed multiple groups
 *   npx tsx prisma/seed.ts --reset                     # wipe DB, then seed all groups
 *   npx tsx prisma/seed.ts --groups=demo --reset       # wipe DB, then seed demo data
 *   npx tsx prisma/seed.ts --groups=core --no-reset    # seed core without wiping
 *
 * Groups:
 *   core        – 6 role users (admin, sales manager, sales rep, logistics, finance, auditor)
 *   products    – 3 catalog products
 *   clients     – 3 sample clients with addresses + contacts
 *   orders      – 5 sample orders with priced line items (needs products + clients)
 *   fulfillment – 3 dispatches tied to orders (needs orders)
 *   finance     – 4 invoices + 2 payments + 2 allocations (needs clients + orders)
 *   followups   – 3 follow-ups (needs core + clients)
 *   eval/demo   – alias for products,clients,orders,fulfillment,finance,followups
 *   all         – every group (default)
 *
 * Behavior:
 *   - Every group is idempotent: existing records are found and reused, never duplicated.
 *   - By default (no --groups) the database is wiped first so a known-good state is restored.
 *   - With --groups, the database is NOT wiped unless --reset is also passed, so you can
 *     incrementally add seed data to a database that already has records.
 *   - Groups run in dependency order; a group that depends on absent parents (e.g. orders
 *     without clients) logs a warning and skips rather than crashing.
 */

const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
  console.error('ERROR: ADMIN_PASSWORD environment variable is required in production.');
  console.error('Set ADMIN_PASSWORD to a strong password before seeding production.');
  process.exit(1);
}

interface Ctx {
  users: Map<string, { id: string; email: string }>;
  products: Map<string, { id: string; sku: string; price: number }>;
  clients: Map<string, { id: string; name: string }>;
  orders: Map<string, { id: string; ref: string }>;
  invoices: Map<string, { id: string; number: string }>;
}

interface GroupDef {
  name: string;
  description: string;
  run: (ctx: Ctx) => Promise<void>;
}

async function resetDb() {
  console.log('Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceOrder.deleteMany();
  await prisma.invoiceRecord.deleteMany();
  await prisma.dispatchItem.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.contactPerson.deleteMany();
  await prisma.clientAddress.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
}

const groups: GroupDef[] = [
  {
    name: 'core',
    description: '6 role users',
    async run(ctx) {
      const password = await bcrypt.hash(PASSWORD, 12);
      const users = [
        { email: 'admin@ginger.com', name: 'System Admin', role: 'ADMIN' },
        { email: 'sales@ginger.com', name: 'Sales Manager', role: 'SALES_MANAGER' },
        { email: 'rep@ginger.com', name: 'Sales Rep', role: 'SALES_REP' },
        { email: 'logistics@ginger.com', name: 'Logistics Manager', role: 'LOGISTICS' },
        { email: 'finance@ginger.com', name: 'Finance Manager', role: 'FINANCE' },
        { email: 'auditor@ginger.com', name: 'Auditor', role: 'AUDITOR' },
      ];
      for (const u of users) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (existing) {
          console.log(`User ${u.email} already exists, reusing`);
          ctx.users.set(u.email, { id: existing.id, email: existing.email });
          continue;
        }
        const created = await prisma.user.create({
          data: { email: u.email, password, name: u.name, role: u.role },
        });
        ctx.users.set(u.email, { id: created.id, email: created.email });
        console.log(`Created user ${u.email} (${u.role})`);
      }
    },
  },

  {
    name: 'products',
    description: '3 catalog products',
    async run(ctx) {
      const products = [
        { sku: 'MTR-001', name: 'Industrial Wire 10mm', description: 'High-grade copper wire 10mm', baseUnitPriceCents: 15000 },
        { sku: 'MTR-002', name: 'Industrial Wire 15mm', description: 'High-grade copper wire 15mm', baseUnitPriceCents: 22000 },
        { sku: 'MTR-003', name: 'Steel Cable 12mm', description: 'Galvanized steel cable', baseUnitPriceCents: 35000 },
      ];
      for (const p of products) {
        const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
        if (existing) {
          console.log(`Product ${p.sku} already exists, reusing`);
          ctx.products.set(p.sku, { id: existing.id, sku: existing.sku, price: existing.baseUnitPriceCents });
          continue;
        }
        const created = await prisma.product.create({ data: p });
        ctx.products.set(p.sku, { id: created.id, sku: created.sku, price: created.baseUnitPriceCents });
        console.log(`Created product ${p.sku} (₹${(p.baseUnitPriceCents / 100).toFixed(2)})`);
      }
    },
  },

  {
    name: 'clients',
    description: '3 sample clients with addresses and contacts',
    async run(ctx) {
      const rep = ctx.users.get('rep@ginger.com');
      const admin = ctx.users.get('admin@ginger.com');
      if (!rep) console.warn('  [clients] core group not run – clients will have no sales rep assigned');

      const clientDefs = [
        {
          name: 'ABC Industries',
          taxId: 'GSTIN123456789',
          salesRepId: rep?.id ?? admin?.id ?? null,
          addresses: [
            { type: 'BOTH', addressLine1: '100 Business Park', city: 'Mumbai', state: 'MH', postalCode: '400001', country: 'India', isDefault: true },
          ],
          contacts: [
            { firstName: 'Ramesh', lastName: 'Kumar', email: 'ramesh@abc.com', phone: '9876543210', role: 'Purchasing Manager', isPrimary: true },
          ],
        },
        {
          name: 'XYZ Manufacturing',
          taxId: 'GSTIN987654321',
          salesRepId: rep?.id ?? admin?.id ?? null,
          addresses: [
            { type: 'BOTH', addressLine1: '50 Industrial Area', city: 'Pune', state: 'MH', postalCode: '411001', country: 'India', isDefault: true },
          ],
          contacts: [
            { firstName: 'Vikram', lastName: 'Patel', email: 'vikram@xyz.com', phone: '9123456789', role: 'Director', isPrimary: true },
          ],
        },
        {
          name: 'Global Exports Ltd',
          taxId: 'GSTIN555666777',
          salesRepId: null,
          addresses: [
            { type: 'BOTH', addressLine1: '300 Export Hub', city: 'Delhi', state: 'DL', postalCode: '110001', country: 'India', isDefault: true },
          ],
          contacts: [
            { firstName: 'Anita', lastName: 'Gupta', email: 'anita@global.com', phone: '9988776655', role: 'Procurement', isPrimary: true },
          ],
        },
      ];

      for (const c of clientDefs) {
        const existing = await prisma.client.findFirst({ where: { name: c.name } });
        if (existing) {
          ctx.clients.set(c.name, { id: existing.id, name: existing.name });
          console.log(`Client ${c.name} already exists, reusing`);
          continue;
        }
        const created = await prisma.client.create({
          data: {
            name: c.name,
            taxId: c.taxId,
            salesRepId: c.salesRepId || undefined,
            addresses: { create: c.addresses },
            contacts: { create: c.contacts },
          },
        });
        ctx.clients.set(c.name, { id: created.id, name: created.name });
        console.log(`Created client ${c.name}`);
      }
    },
  },

  {
    name: 'orders',
    description: '5 sample orders with priced line items',
    async run(ctx) {
      const clientABC = ctx.clients.get('ABC Industries');
      const clientXYZ = ctx.clients.get('XYZ Manufacturing');
      const clientGlobal = ctx.clients.get('Global Exports Ltd');
      if (!clientABC || !clientXYZ || !clientGlobal) {
        console.warn('  [orders] skipping – clients group has not been seeded');
        return;
      }
      const prod1 = ctx.products.get('MTR-001');
      const prod2 = ctx.products.get('MTR-002');
      const prod3 = ctx.products.get('MTR-003');
      if (!prod1 || !prod2 || !prod3) {
        console.warn('  [orders] skipping – products group has not been seeded');
        return;
      }

      const orderDefs = [
        {
          ref: 'ABC:Urgent order for Q1',
          clientId: clientABC.id,
          status: 'CONFIRMED',
          totalAmountCents: 450000,
          notes: 'Urgent order for Q1',
          items: [
            { productId: prod1.id, quantity: 20, unitPriceCents: 15000, lineTotalCents: 300000 },
            { productId: prod2.id, quantity: 5, unitPriceCents: 22000, lineTotalCents: 110000 },
          ],
        },
        {
          ref: 'ABC:Standard order',
          clientId: clientABC.id,
          status: 'DRAFT',
          totalAmountCents: 175000,
          notes: 'Standard order',
          items: [
            { productId: prod3.id, quantity: 5, unitPriceCents: 35000, lineTotalCents: 175000 },
          ],
        },
        {
          ref: 'XYZ:PROCESSING',
          clientId: clientXYZ.id,
          status: 'PROCESSING',
          totalAmountCents: 660000,
          items: [
            { productId: prod1.id, quantity: 30, unitPriceCents: 15000, lineTotalCents: 450000 },
            { productId: prod2.id, quantity: 5, unitPriceCents: 22000, lineTotalCents: 110000 },
            { productId: prod3.id, quantity: 3, unitPriceCents: 35000, lineTotalCents: 105000 },
          ],
        },
        {
          ref: 'XYZ:COMPLETED',
          clientId: clientXYZ.id,
          status: 'COMPLETED',
          totalAmountCents: 300000,
          items: [
            { productId: prod1.id, quantity: 20, unitPriceCents: 15000, lineTotalCents: 300000 },
          ],
        },
        {
          ref: 'GlobalExports:CANCELLED',
          clientId: clientGlobal.id,
          status: 'CANCELLED',
          totalAmountCents: 220000,
          items: [
            { productId: prod2.id, quantity: 10, unitPriceCents: 22000, lineTotalCents: 220000 },
          ],
        },
      ];

      for (const def of orderDefs) {
        const existing = await prisma.order.findFirst({
          where: { clientId: def.clientId, status: def.status, notes: def.notes ?? null },
        });
        if (existing) {
          console.log(`Order ${def.ref} already exists, reusing`);
          ctx.orders.set(def.ref, { id: existing.id, ref: existing.status });
          continue;
        }
        const order = await prisma.order.create({
          data: {
            clientId: def.clientId,
            status: def.status,
            totalAmountCents: def.totalAmountCents,
            notes: def.notes,
            items: { create: def.items },
          },
        });
        ctx.orders.set(def.ref, { id: order.id, ref: order.status });
        console.log(`Created order ${def.ref} (₹${(def.totalAmountCents / 100).toFixed(2)})`);
      }
    },
  },

  {
    name: 'fulfillment',
    description: '3 dispatches tied to seeded orders',
    async run(ctx) {
      const order1 = ctx.orders.get('ABC:Urgent order for Q1');
      const order3 = ctx.orders.get('XYZ:PROCESSING');
      if (!order1 || !order3) {
        console.warn('  [fulfillment] skipping – orders group has not been seeded');
        return;
      }

      const dispatchDefs = [
        {
          order: order1,
          status: 'DELIVERED',
          dispatchDate: new Date('2026-08-15'),
          carrier: 'BlueDart',
          trackingNumber: 'BD123456789',
          onOrder: order1,
          quantities: [10, 5],
        },
        {
          order: order1,
          status: 'SCHEDULED',
          dispatchDate: new Date('2026-08-25'),
          carrier: 'FedEx',
          trackingNumber: null,
          quantities: [10],
        },
        {
          order: order3,
          status: 'IN_TRANSIT',
          dispatchDate: new Date('2026-08-18'),
          carrier: 'DTDC',
          trackingNumber: 'DTDC987654',
          quantities: [15, 5],
        },
      ];

      for (const def of dispatchDefs) {
        if (def.order === null) continue;
        const existing = await prisma.dispatch.findFirst({
          where: { orderId: def.order.id, carrier: def.carrier },
        });
        if (existing) {
          console.log(`Dispatch ${def.carrier} for ${def.order.ref} already exists, reusing`);
          continue;
        }
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: def.order.id },
          orderBy: { createdAt: 'asc' },
        });
        const items = def.quantities
          .map((qty, idx) => ({ item: orderItems[idx], qty }))
          .filter((x): x is { item: { id: string }; qty: number } => !!x.item)
          .map((x) => ({ orderItemId: x.item.id, quantityShipped: x.qty }));
        if (items.length === 0) {
          console.warn(`  [fulfillment] no order items found for ${def.order.ref}, skipping dispatch`);
          continue;
        }
        await prisma.dispatch.create({
          data: {
            orderId: def.order.id,
            status: def.status,
            dispatchDate: def.dispatchDate,
            carrier: def.carrier,
            trackingNumber: def.trackingNumber ?? undefined,
            items: { create: items },
          },
        });
        console.log(`Created dispatch ${def.carrier} (${def.status})`);
      }
    },
  },

  {
    name: 'finance',
    description: '4 invoices, 2 payments, and 2 allocations',
    async run(ctx) {
      const clientABC = ctx.clients.get('ABC Industries');
      const clientXYZ = ctx.clients.get('XYZ Manufacturing');
      const clientGlobal = ctx.clients.get('Global Exports Ltd');
      if (!clientABC || !clientXYZ || !clientGlobal) {
        console.warn('  [finance] skipping – clients group has not been seeded');
        return;
      }
      const order1 = ctx.orders.get('ABC:Urgent order for Q1');
      const order3 = ctx.orders.get('XYZ:PROCESSING');
      const order4 = ctx.orders.get('XYZ:COMPLETED');

      const invoiceDefs = [
        {
          clientId: clientABC.id,
          invoiceNumber: 'INV-2026-001',
          invoiceDate: new Date('2026-08-01'),
          dueDate: new Date('2026-08-31'),
          subtotalCents: 383051,
          gstAmountCents: 68949,
          totalAmountCents: 452000,
          paidAmountCents: 0,
          status: 'UNPAID',
          orders: order1 ? [{ orderId: order1.id }] : [],
        },
        {
          clientId: clientXYZ.id,
          invoiceNumber: 'INV-2026-002',
          invoiceDate: new Date('2026-07-15'),
          dueDate: new Date('2026-08-14'),
          subtotalCents: 254237,
          gstAmountCents: 45763,
          totalAmountCents: 300000,
          paidAmountCents: 300000,
          status: 'PAID',
          orders: order4 ? [{ orderId: order4.id }] : [],
        },
        {
          clientId: clientXYZ.id,
          invoiceNumber: 'INV-2026-003',
          invoiceDate: new Date('2026-08-10'),
          dueDate: new Date('2026-09-09'),
          subtotalCents: 559322,
          gstAmountCents: 100678,
          totalAmountCents: 660000,
          paidAmountCents: 200000,
          status: 'PARTIALLY_PAID',
          orders: order3 ? [{ orderId: order3.id }] : [],
        },
        {
          clientId: clientGlobal.id,
          invoiceNumber: 'INV-2026-004',
          invoiceDate: new Date('2026-06-01'),
          dueDate: new Date('2026-07-01'),
          subtotalCents: 186441,
          gstAmountCents: 33559,
          totalAmountCents: 220000,
          paidAmountCents: 0,
          status: 'UNPAID',
          orders: [],
        },
      ];

      for (const def of invoiceDefs) {
        const existing = await prisma.invoiceRecord.findUnique({ where: { invoiceNumber: def.invoiceNumber } });
        if (existing) {
          console.log(`Invoice ${def.invoiceNumber} already exists, reusing`);
          ctx.invoices.set(def.invoiceNumber, { id: existing.id, number: def.invoiceNumber });
          continue;
        }
        const invoice = await prisma.invoiceRecord.create({
          data: {
            clientId: def.clientId,
            invoiceNumber: def.invoiceNumber,
            invoiceDate: def.invoiceDate,
            dueDate: def.dueDate,
            subtotalCents: def.subtotalCents,
            gstAmountCents: def.gstAmountCents,
            totalAmountCents: def.totalAmountCents,
            paidAmountCents: def.paidAmountCents,
            status: def.status,
            orders: def.orders.length > 0 ? { create: def.orders } : undefined,
          },
        });
        ctx.invoices.set(def.invoiceNumber, { id: invoice.id, number: def.invoiceNumber });
        console.log(`Created invoice ${def.invoiceNumber} (${def.status})`);
      }

      const invoice2 = ctx.invoices.get('INV-2026-002');
      const invoice3 = ctx.invoices.get('INV-2026-003');
      const client2 = clientXYZ;

      const paymentDefs = [
        {
          clientId: client2.id,
          amountCents: 300000,
          paymentDate: new Date('2026-08-05'),
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'NEFT-20260805-001',
          status: 'FULLY_ALLOCATED',
          allocation: invoice2 ? { invoiceRecordId: invoice2.id, allocatedAmountCents: 300000 } : null,
        },
        {
          clientId: client2.id,
          amountCents: 500000,
          paymentDate: new Date('2026-08-20'),
          paymentMethod: 'CHEQUE',
          referenceNumber: 'CHQ-789012',
          status: 'PARTIALLY_ALLOCATED',
          allocation: invoice3 ? { invoiceRecordId: invoice3.id, allocatedAmountCents: 200000 } : null,
        },
      ];

      for (const def of paymentDefs) {
        const existing = await prisma.payment.findFirst({ where: { referenceNumber: def.referenceNumber } });
        if (existing) {
          console.log(`Payment ${def.referenceNumber} already exists, reusing`);
          continue;
        }
        await prisma.payment.create({
          data: {
            clientId: def.clientId,
            amountCents: def.amountCents,
            paymentDate: def.paymentDate,
            paymentMethod: def.paymentMethod,
            referenceNumber: def.referenceNumber,
            status: def.status,
            ...(def.allocation ? { allocations: { create: [def.allocation] } } : {}),
          },
        });
        console.log(`Created payment ${def.referenceNumber} (${def.status})`);
      }
    },
  },

  {
    name: 'followups',
    description: '3 follow-ups (call / email / meeting)',
    async run(ctx) {
      const clientABC = ctx.clients.get('ABC Industries');
      const clientXYZ = ctx.clients.get('XYZ Manufacturing');
      const clientGlobal = ctx.clients.get('Global Exports Ltd');
      const salesRep = ctx.users.get('rep@ginger.com') ?? ctx.users.get('admin@ginger.com');
      const salesManager = ctx.users.get('sales@ginger.com') ?? ctx.users.get('admin@ginger.com');
      if (!clientABC || !clientXYZ || !clientGlobal) {
        console.warn('  [followups] skipping – clients group has not been seeded');
        return;
      }
      if (!salesRep || !salesManager) console.warn('  [followups] core group not run – assignees may fall back to admin');

      const followUpDefs = [
        { clientId: clientABC.id, userId: salesRep?.id, type: 'CALL', notes: 'Discuss Q1 delivery schedule', scheduledAt: new Date('2026-08-22'), status: 'PENDING' },
        { clientId: clientXYZ.id, userId: salesRep?.id, type: 'EMAIL', notes: 'Send overdue payment reminder for INV-2026-003', scheduledAt: new Date('2026-08-18'), status: 'COMPLETED' },
        { clientId: clientGlobal.id, userId: salesManager?.id, type: 'MEETING', notes: 'New product catalog presentation', scheduledAt: new Date('2026-08-25'), status: 'PENDING' },
      ];

      for (const def of followUpDefs) {
        if (!def.userId) {
          console.warn(`  [followups] no user available for ${def.type}, skipping`);
          continue;
        }
        const existing = await prisma.followUp.findFirst({
          where: { clientId: def.clientId, type: def.type, notes: def.notes },
        });
        if (existing) {
          console.log(`Follow-up ${def.type} for client already exists, reusing`);
          continue;
        }
        await prisma.followUp.create({ data: def });
        console.log(`Created follow-up ${def.type}`);
      }
    },
  },
];

// Dependency order
const groupOrder = ['core', 'products', 'clients', 'orders', 'fulfillment', 'finance', 'followups'];

const ALIASES: Record<string, string[]> = {
  eval: ['products', 'clients', 'orders', 'fulfillment', 'finance', 'followups'],
  demo: ['products', 'clients', 'orders', 'fulfillment', 'finance', 'followups'],
  all: [...groupOrder],
};

function parseArgs(argv: string[]) {
  const args = { groups: [] as string[], reset: false, help: false };
  for (const arg of argv) {
    if (arg === '--reset') args.reset = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--groups=')) {
      args.groups = arg.slice('--groups='.length).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--no-reset') {
      args.reset = false;
    }
  }
  return args;
}

function resolveGroups(requested: string[]): GroupDef[] {
  if (requested.length === 0) requested = ['all'];
  const expanded = new Set<string>();
  for (const g of requested) {
    if (ALIASES[g]) ALIASES[g].forEach((x) => expanded.add(x));
    else if (groups.some((grp) => grp.name === g)) expanded.add(g);
    else console.warn(`Unknown group or alias: ${g}`);
  }
  return groupOrder.filter((name) => expanded.has(name)).map((name) => groups.find((g) => g.name === name)!);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Ginger OMS seed groups:

  core        – ${groups[0].description}
  products    – ${groups[1].description}
  clients     – ${groups[2].description}
  orders      – ${groups[3].description}
  fulfillment – ${groups[4].description}
  finance     – ${groups[5].description}
  followups   – ${groups[6].description}

Aliases:
  eval / demo – products,clients,orders,fulfillment,finance,followups
  all         – every group (default)

Usage:
  npx tsx prisma/seed.ts                          reset + seed all groups
  npx tsx prisma/seed.ts --groups=core,products   seed only those groups (no wipe)
  npx tsx prisma/seed.ts --groups=demo --reset    wipe, then seed demo data
  npx tsx prisma/seed.ts --help                   show this help
`);
    return;
  }

  const selected = resolveGroups(args.groups);
  const isDefaultAll = args.groups.length === 0;

  if (args.reset || isDefaultAll) {
    await resetDb();
  } else {
    console.log(`Preserving existing data (no --reset). Selected: ${selected.map((g) => g.name).join(', ')}`);
  }

  const ctx: Ctx = {
    users: new Map(),
    products: new Map(),
    clients: new Map(),
    orders: new Map(),
    invoices: new Map(),
  };

  for (const group of selected) {
    console.log(`\n=== Seeding group: ${group.name} ===`);
    await group.run(ctx);
  }

  console.log('\n=== SEED COMPLETE ===');
  console.log(`Groups seeded: ${selected.map((g) => g.name).join(', ') || '(none)'}`);
  if (ctx.users.has('admin@ginger.com')) {
    console.log('Credentials:');
    console.log('  admin@ginger.com / admin123 (ADMIN)');
    console.log('  sales@ginger.com / admin123 (SALES_MANAGER)');
    console.log('  rep@ginger.com / admin123 (SALES_REP)');
    console.log('  logistics@ginger.com / admin123 (LOGISTICS)');
    console.log('  finance@ginger.com / admin123 (FINANCE)');
    console.log('  auditor@ginger.com / admin123 (AUDITOR)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });