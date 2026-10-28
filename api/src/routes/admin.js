import { Router } from 'express';
import { z } from 'zod';
import { prisma, audit } from '../db.js';
import { requireAuth, requireRole, httpError } from '../middleware/auth.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

router.get('/users', async (_req, res, next) => {
  try { res.json((await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })).map(publicUser)); } catch (err) { next(err); }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(['CUSTOMER', 'ADMIN']) }).parse(req.body);
    if (req.params.id === req.user.sub) return next(httpError(400, 'You cannot change your own role'));
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    await audit(req.user.sub, 'user.role', 'User', user.id, { role });
    res.json(publicUser(user));
  } catch (err) { next(err); }
});

router.get('/settings', async (_req, res, next) => {
  try { res.json(await prisma.setting.findMany()); } catch (err) { next(err); }
});

router.put('/settings/:key', async (req, res, next) => {
  try {
    const { value } = z.object({ value: z.string() }).parse(req.body);
    const row = await prisma.setting.upsert({ where: { key: req.params.key }, update: { value }, create: { key: req.params.key, value } });
    await audit(req.user.sub, 'setting.set', 'Setting', row.key, { value });
    res.json(row);
  } catch (err) { next(err); }
});

router.get('/audit', async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({ take: Number(req.query.limit ?? 100), orderBy: { createdAt: 'desc' }, include: { actor: { select: { email: true, role: true } } } });
    res.json(logs);
  } catch (err) { next(err); }
});

router.get('/dashboard', async (_req, res, next) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const boxes = await prisma.lockbox.findMany({ where: { vehicleId: { not: null } } });
    let boxesToRotate = 0;
    for (const b of boxes) {
      const last = await prisma.booking.findFirst({ where: { vehicleId: b.vehicleId, status: 'COMPLETED' }, orderBy: { endAt: 'desc' } });
      if (last && last.endAt > b.updatedAt) boxesToRotate++;
    }
    const [pickupsToday, returnsToday, inMaintenance, pendingApproval, openTickets] = await Promise.all([
      prisma.booking.count({ where: { startAt: { gte: start, lt: end }, status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { endAt: { gte: start, lt: end }, status: 'ACTIVE' } }),
      prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
      prisma.booking.count({ where: { status: 'PENDING' } }),
      prisma.ticket.count({ where: { status: 'OPEN' } }),
    ]);
    res.json({ pickupsToday, returnsToday, inMaintenance, pendingApproval, openTickets, boxesToRotate });
  } catch (err) { next(err); }
});

export default router;
