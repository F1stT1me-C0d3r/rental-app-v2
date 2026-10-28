// Seed: users, vehicles, lockboxes, and one booking whose pickup window is open NOW.
// Safe to re-run (upserts). Run: npm run seed
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { encrypt } from '../src/crypto.js';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'changeme', 12);
  const users = {};
  for (const u of [
    { email: 'owner@example.com', name: 'Owner', role: 'ADMIN' },
    { email: 'customer@example.com', name: 'Test Customer', role: 'CUSTOMER', phone: '859-555-0101' },
    { email: 'customer2@example.com', name: 'Second Customer', role: 'CUSTOMER' },
  ]) {
    users[u.email] = await prisma.user.upsert({ where: { email: u.email }, update: { role: u.role }, create: { ...u, passwordHash } });
  }
  const admin = users['owner@example.com'];

  const vehicles = [];
  for (const v of [
    { make: 'Toyota', model: 'Camry', year: 2022, vin: '4T1C11AK5NU000001', plate: 'KY-RENT1', dailyRate: 55, deposit: 200, color: 'Silver' },
    { make: 'Honda', model: 'CR-V', year: 2023, vin: '2HKRW2H58PH000002', plate: 'KY-RENT2', dailyRate: 70, deposit: 250, color: 'Blue' },
    { make: 'Ford', model: 'Transit 12-pass', year: 2021, vin: '1FBAX2CM5MKA00003', plate: 'KY-RENT3', dailyRate: 140, deposit: 500, seats: 12, color: 'White' },
  ]) {
    vehicles.push(await prisma.vehicle.upsert({ where: { vin: v.vin }, update: {}, create: v }));
  }

  const boxes = [
    { number: 1, code: '4821', location: 'Spot B4, north lot', vehicleId: vehicles[0].id },
    { number: 2, code: '7390', location: 'Spot B5, north lot', vehicleId: vehicles[1].id },
    { number: 3, code: '1156', location: 'Van bay, south lot', vehicleId: vehicles[2].id },
  ];
  for (const b of boxes) {
    await prisma.lockbox.upsert({
      where: { number: b.number },
      update: { vehicleId: b.vehicleId },
      create: { number: b.number, codeEncrypted: encrypt(b.code), location: b.location, vehicleId: b.vehicleId, updatedById: admin.id },
    });
  }

  // One confirmed + paid booking whose window is open now (started 30 min ago, 2 days long).
  const customer = users['customer@example.com'];
  const startAt = new Date(Date.now() - 30 * 60_000);
  const endAt = new Date(startAt.getTime() + 2 * 86_400_000);
  const existing = await prisma.booking.findFirst({ where: { userId: customer.id, vehicleId: vehicles[0].id } });
  if (!existing) {
    await prisma.booking.create({ data: { userId: customer.id, vehicleId: vehicles[0].id, startAt, endAt, status: 'CONFIRMED', paid: true, totalAmount: 110 } });
  }

  for (const [key, value] of [['bookings.autoConfirm', 'false'], ['pickup.windowHours', '1']]) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log('Seeded 3 users, 3 vehicles, 3 lockboxes (codes 4821 / 7390 / 1156), 1 open booking.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
