import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/tickets', async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email(), subject: z.string().min(1).max(200), body: z.string().min(1).max(5000) }).parse(req.body);
    const t = await prisma.ticket.create({ data: input });
    res.status(201).json({ id: t.id });
  } catch (err) { next(err); }
});

router.get('/tickets', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    res.json(await prisma.ticket.findMany({ where: { status: String(req.query.status ?? 'OPEN') }, orderBy: { createdAt: 'desc' } }));
  } catch (err) { next(err); }
});

router.patch('/tickets/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']) }).parse(req.body);
    res.json(await prisma.ticket.update({ where: { id: req.params.id }, data: { status } }));
  } catch (err) { next(err); }
});

export default router;
