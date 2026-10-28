import { Router } from 'express';
import { z } from 'zod';
import { prisma, audit } from '../db.js';
import { requireAuth, requireRole, httpError } from '../middleware/auth.js';
import { encrypt, decrypt } from '../crypto.js';

// Admin only. Codes are decrypted here for the admin's Lockboxes page and nowhere else except the reveal endpoint.
const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const include = { vehicle: { select: { id: true, make: true, model: true, year: true, plate: true } }, updatedBy: { select: { name: true, email: true } } };

function present(box) {
  return { ...box, code: decrypt(box.codeEncrypted), codeEncrypted: undefined };
}

router.get('/', async (_req, res, next) => {
  try {
    const boxes = await prisma.lockbox.findMany({ include, orderBy: { number: 'asc' } });
    // Flag boxes whose code is older than the last completed booking on their vehicle.
    const out = [];
    for (const b of boxes) {
      let needsRotation = false;
      if (b.vehicleId) {
        const last = await prisma.booking.findFirst({ where: { vehicleId: b.vehicleId, status: 'COMPLETED' }, orderBy: { endAt: 'desc' } });
        needsRotation = !!last && last.endAt > b.updatedAt;
      }
      out.push({ ...present(b), needsRotation });
    }
    res.json(out);
  } catch (err) { next(err); }
});

const boxInput = z.object({
  number: z.coerce.number().int().positive(),
  code: z.string().min(3).max(12),
  location: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
});

router.post('/', async (req, res, next) => {
  try {
    const { number, code, location, vehicleId } = boxInput.parse(req.body);
    const box = await prisma.lockbox.create({
      data: { number, codeEncrypted: encrypt(code), location, vehicleId: vehicleId || null, updatedById: req.user.sub },
      include,
    });
    await audit(req.user.sub, 'lockbox.create', 'Lockbox', number, { location, vehicleId });
    res.status(201).json(present(box));
  } catch (err) {
    if (err.code === 'P2002') return next(httpError(409, 'That lockbox number or vehicle is already taken'));
    next(err);
  }
});

router.patch('/:number', async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    const { code, location, vehicleId } = boxInput.partial().omit({ number: true }).parse(req.body);
    const data = { updatedById: req.user.sub };
    if (code !== undefined) data.codeEncrypted = encrypt(code);
    if (location !== undefined) data.location = location;
    if (vehicleId !== undefined) data.vehicleId = vehicleId || null;
    const box = await prisma.lockbox.update({ where: { number }, data, include });
    await audit(req.user.sub, code ? 'lockbox.rotate' : 'lockbox.update', 'Lockbox', number, { location, vehicleId, rotated: !!code });
    res.json(present(box));
  } catch (err) {
    if (err.code === 'P2002') return next(httpError(409, 'That vehicle already has a lockbox'));
    if (err.code === 'P2025') return next(httpError(404, 'Lockbox not found'));
    next(err);
  }
});

router.delete('/:number', async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    await prisma.lockbox.delete({ where: { number } });
    await audit(req.user.sub, 'lockbox.delete', 'Lockbox', number);
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return next(httpError(404, 'Lockbox not found'));
    next(err);
  }
});

export default router;
