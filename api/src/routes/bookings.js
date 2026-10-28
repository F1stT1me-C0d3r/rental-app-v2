import { Router } from 'express';
import { z } from 'zod';
import { prisma, audit, getSetting } from '../db.js';
import { requireAuth, requireRole, httpError } from '../middleware/auth.js';
import { decrypt } from '../crypto.js';

const router = Router();
const include = { vehicle: { include: { lockbox: { select: { number: true, location: true } } } }, user: { select: { id: true, name: true, email: true, phone: true } } };

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { userId: req.user.sub };
    const rows = await prisma.booking.findMany({ where, include, orderBy: { startAt: 'desc' } });
    const windowHours = Number(await getSetting('pickup.windowHours', '1'));
    res.json(rows.map((b) => ({ ...b, canReveal: revealCheck(b, req.user, windowHours) === null })));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { vehicleId, startAt, endAt } = z.object({ vehicleId: z.string(), startAt: z.coerce.date(), endAt: z.coerce.date() }).parse(req.body);
    if (endAt <= startAt) return next(httpError(400, 'Return must be after pickup'));
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.status !== 'AVAILABLE') return next(httpError(409, 'Vehicle not available'));
    const conflict = await prisma.booking.findFirst({
      where: { vehicleId, status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
    });
    if (conflict) return next(httpError(409, 'Vehicle already booked for those dates'));
    const days = Math.max(1, Math.ceil((endAt - startAt) / 86_400_000));
    const autoConfirm = (await getSetting('bookings.autoConfirm', 'false')) === 'true';
    const booking = await prisma.booking.create({
      data: { userId: req.user.sub, vehicleId, startAt, endAt, totalAmount: vehicle.dailyRate * days, status: autoConfirm ? 'CONFIRMED' : 'PENDING' },
      include,
    });
    res.status(201).json(booking);
  } catch (err) { next(err); }
});

// Customers may only cancel their own; admins may set any status and tick paid.
router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status, paid } = z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELED']).optional(),
      paid: z.boolean().optional(),
    }).parse(req.body);
    const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!b) return next(httpError(404, 'Booking not found'));
    if (req.user.role !== 'ADMIN') {
      if (b.userId !== req.user.sub) return next(httpError(403, 'Not allowed'));
      if (status !== 'CANCELED' || paid !== undefined) return next(httpError(403, 'Customers can only cancel'));
      if (!['PENDING', 'CONFIRMED'].includes(b.status)) return next(httpError(409, 'This booking can no longer be canceled'));
    }
    const data = {};
    if (status) data.status = status;
    if (paid !== undefined) data.paid = paid;
    const updated = await prisma.booking.update({ where: { id: b.id }, data, include });
    if (req.user.role === 'ADMIN') await audit(req.user.sub, 'booking.update', 'Booking', b.id, data);
    res.json(updated);
  } catch (err) { next(err); }
});

/** Returns null when the code may be shown, otherwise the reason. */
function revealCheck(b, user, windowHours) {
  if (user.role !== 'ADMIN' && b.userId !== user.sub) return 'This booking is not yours.';
  if (!['CONFIRMED', 'ACTIVE'].includes(b.status)) return `Booking is ${b.status.toLowerCase()}; it must be confirmed first.`;
  if (!b.paid) return 'Payment has not been recorded yet.';
  if (!b.vehicle?.lockbox) return 'No lockbox is assigned to this vehicle.';
  const now = Date.now();
  const opens = new Date(b.startAt).getTime() - windowHours * 3_600_000;
  if (now < opens) return `The code becomes available ${windowHours} hour(s) before pickup.`;
  if (now > new Date(b.endAt).getTime()) return 'This rental period has ended.';
  return null;
}

// The pickup popup calls this. Every reveal is logged.
router.post('/:id/reveal-code', requireAuth, async (req, res, next) => {
  try {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include });
    if (!b) return next(httpError(404, 'Booking not found'));
    const windowHours = Number(await getSetting('pickup.windowHours', '1'));
    const reason = revealCheck(b, req.user, windowHours);
    if (reason) return res.status(403).json({ error: reason, officePhone: process.env.OFFICE_PHONE });
    const box = await prisma.lockbox.findUnique({ where: { number: b.vehicle.lockbox.number } });
    const data = { codeRevealedAt: new Date() };
    if (b.status === 'CONFIRMED') data.status = 'ACTIVE';
    await prisma.booking.update({ where: { id: b.id }, data });
    await audit(req.user.sub, 'booking.revealCode', 'Booking', b.id, { lockbox: box.number });
    res.json({
      lockboxNumber: box.number,
      code: decrypt(box.codeEncrypted),
      location: box.location,
      vehicle: `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}`,
      plate: b.vehicle.plate,
      returnBy: b.endAt,
      officePhone: process.env.OFFICE_PHONE,
    });
  } catch (err) { next(err); }
});

router.get('/today', requireAuth, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const [pickups, returns] = await Promise.all([
      prisma.booking.findMany({ where: { startAt: { gte: start, lt: end }, status: 'CONFIRMED' }, include }),
      prisma.booking.findMany({ where: { endAt: { gte: start, lt: end }, status: 'ACTIVE' }, include }),
    ]);
    res.json({ pickups, returns });
  } catch (err) { next(err); }
});

export default router;
