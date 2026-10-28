import { Router } from 'express';
import { z } from 'zod';
import { prisma, audit } from '../db.js';
import { requireAuth, requireRole, optionalAuth, httpError } from '../middleware/auth.js';
import { encrypt } from '../crypto.js';

const router = Router();

const vehicleInput = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1990).max(2100),
  vin: z.string().length(17),
  plate: z.string().min(2),
  color: z.string().optional().nullable(),
  seats: z.coerce.number().int().min(1).max(15).default(5),
  transmission: z.enum(['Automatic', 'Manual']).default('Automatic'),
  odometer: z.coerce.number().int().min(0).default(0),
  dailyRate: z.coerce.number().positive(),
  deposit: z.coerce.number().min(0),
  status: z.enum(['AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED']).default('AVAILABLE'),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
  lockboxNumber: z.coerce.number().int().positive().optional().nullable(),
});

const include = { lockbox: { select: { number: true, location: true } } };

// Public: available fleet. Admin with ?all=1 sees everything.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const where = req.query.all === '1' && req.user?.role === 'ADMIN' ? {} : { status: 'AVAILABLE' };
    res.json(await prisma.vehicle.findMany({ where, include, orderBy: { dailyRate: 'asc' } }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const v = await prisma.vehicle.findUnique({ where: { id: req.params.id }, include: { ...include, services: { orderBy: { date: 'desc' } } } });
    if (!v) return next(httpError(404, 'Vehicle not found'));
    res.json(v);
  } catch (err) { next(err); }
});

async function assignLockbox(vehicleId, lockboxNumber, actorId) {
  // Detach any box currently on this vehicle, then attach the requested one.
  await prisma.lockbox.updateMany({ where: { vehicleId }, data: { vehicleId: null } });
  if (lockboxNumber == null) return;
  const box = await prisma.lockbox.findUnique({ where: { number: lockboxNumber } });
  if (!box) throw httpError(404, `Lockbox ${lockboxNumber} does not exist; add it on the Lockboxes page first`);
  if (box.vehicleId && box.vehicleId !== vehicleId) throw httpError(409, `Lockbox ${lockboxNumber} is assigned to another vehicle`);
  await prisma.lockbox.update({ where: { number: lockboxNumber }, data: { vehicleId, updatedById: actorId } });
}

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { lockboxNumber, ...data } = vehicleInput.parse(req.body);
    if (data.photoUrl === '') data.photoUrl = null;
    const v = await prisma.vehicle.create({ data });
    await assignLockbox(v.id, lockboxNumber, req.user.sub);
    await audit(req.user.sub, 'vehicle.create', 'Vehicle', v.id, { ...data, lockboxNumber });
    res.status(201).json(await prisma.vehicle.findUnique({ where: { id: v.id }, include }));
  } catch (err) {
    if (err.code === 'P2002') return next(httpError(409, 'VIN or plate already exists'));
    next(err);
  }
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { lockboxNumber, ...data } = vehicleInput.partial().parse(req.body);
    if (data.photoUrl === '') data.photoUrl = null;
    if (data.status === 'RETIRED') {
      const upcoming = await prisma.booking.count({
        where: { vehicleId: req.params.id, endAt: { gt: new Date() }, status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] } },
      });
      if (upcoming > 0) return next(httpError(409, `Vehicle has ${upcoming} upcoming booking(s); move or cancel them first`));
    }
    const v = await prisma.vehicle.update({ where: { id: req.params.id }, data });
    if ('lockboxNumber' in req.body) await assignLockbox(v.id, lockboxNumber ?? null, req.user.sub);
    await audit(req.user.sub, 'vehicle.update', 'Vehicle', v.id, { ...data, lockboxNumber });
    res.json(await prisma.vehicle.findUnique({ where: { id: v.id }, include }));
  } catch (err) {
    if (err.code === 'P2002') return next(httpError(409, 'VIN or plate already exists'));
    next(err);
  }
});

// CSV import. Header: make,model,year,vin,plate,dailyRate,deposit,seats[,lockboxNumber,lockboxCode]
router.post('/import', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const text = typeof req.body === 'string' ? req.body : req.body?.csv;
    if (!text) return next(httpError(400, 'Send CSV as text/csv body or { csv: "..." }'));
    const [header, ...lines] = text.trim().split(/\r?\n/);
    const keys = header.split(',').map((k) => k.trim());
    const results = { added: 0, skipped: [] };
    for (const line of lines.filter(Boolean)) {
      const row = Object.fromEntries(line.split(',').map((val, i) => [keys[i], val.trim()]));
      try {
        const { lockboxNumber, ...data } = vehicleInput.parse(row);
        const v = await prisma.vehicle.create({ data });
        if (lockboxNumber && row.lockboxCode) {
          await prisma.lockbox.upsert({
            where: { number: lockboxNumber },
            update: { codeEncrypted: encrypt(row.lockboxCode), vehicleId: v.id, updatedById: req.user.sub },
            create: { number: lockboxNumber, codeEncrypted: encrypt(row.lockboxCode), vehicleId: v.id, updatedById: req.user.sub },
          });
        } else if (lockboxNumber) {
          await assignLockbox(v.id, lockboxNumber, req.user.sub);
        }
        results.added++;
      } catch (e) {
        results.skipped.push({ vin: row.vin, reason: e.code === 'P2002' ? 'VIN or plate already exists' : e.message });
      }
    }
    await audit(req.user.sub, 'vehicle.import', 'Vehicle', 'csv', results);
    res.json(results);
  } catch (err) { next(err); }
});

router.post('/:id/services', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const input = z.object({
      date: z.coerce.date(),
      odometer: z.coerce.number().int().min(0),
      workDone: z.string().min(1),
      cost: z.coerce.number().min(0),
      notes: z.string().optional(),
    }).parse(req.body);
    const record = await prisma.serviceRecord.create({ data: { ...input, vehicleId: req.params.id } });
    await prisma.vehicle.update({ where: { id: req.params.id }, data: { odometer: input.odometer } });
    res.status(201).json(record);
  } catch (err) { next(err); }
});

export default router;
