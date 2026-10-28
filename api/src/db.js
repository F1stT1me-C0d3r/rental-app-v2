import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function audit(actorId, action, entity, entityId, detail) {
  await prisma.auditLog.create({
    data: { actorId, action, entity, entityId: String(entityId), detail: detail ? JSON.stringify(detail) : null },
  });
}

export async function getSetting(key, fallback) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}
