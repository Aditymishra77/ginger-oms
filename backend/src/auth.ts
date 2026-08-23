import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Router, Request, Response, NextFunction } from 'express';
import prisma from './db';
import { validRoles } from './validation';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const SECRET: string = JWT_SECRET;

export { validRoles };

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  resetRateLimit(ip);

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

export { authRouter };

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  return new Promise<void>(async (resolve) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      resolve();
      return;
    }
    const token = authHeader.substring(7);
    try {
      const decoded = verifyToken(token);
      const dbUser = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, role: true } });
      if (!dbUser) {
        res.status(401).json({ error: 'User no longer exists. Please log in again.' });
        resolve();
        return;
      }
      req.user = dbUser;
      resolve();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      resolve();
    }
  });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}