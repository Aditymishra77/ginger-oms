import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import path from 'path';
import fs from 'fs';
import { authRouter, requireAuth } from './auth';
import clientsRouter from './clients';
import ordersRouter from './orders';
import productsRouter from './products';
import invoicesRouter from './invoices';
import paymentsRouter from './payments';
import dispatchRouter from './dispatch';
import documentsRouter from './documents';
import followupsRouter from './followups';
import usersRouter from './users';
import dashboardRouter from './dashboard';
import reportsRouter from './reports';

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(helmet());
app.use(morgan('combined'));

const corsOrigin = process.env.NODE_ENV === 'production'
  ? (FRONTEND_URL || undefined)
  : (FRONTEND_URL || '*');

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', requireAuth, express.static(uploadsDir));

app.use('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/dispatches', dispatchRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/followups', followupsRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProduction ? 'Internal server error' : err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

export default app;
