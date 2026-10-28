import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { signToken, requireAuth, httpError } from '../middleware/auth.js';

const router = Router();
const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email: body.email.toLowerCase(), passwordHash, name: body.name ?? '', phone: body.phone, role: 'CUSTOMER' },
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === 'P2002') return next(httpError(409, 'Email already registered'));
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentials.pick({ email: true, password: true }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return next(httpError(401, 'Wrong email or password'));
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  res.json(publicUser(user));
});

export function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role };
}
export default router;
